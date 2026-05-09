Add-Type -AssemblyName System.Drawing

$root = Resolve-Path "$PSScriptRoot\..\assets\onboarding"
$framePath = Join-Path $root "figma-frame.png"
# Pull the body figure from the raw 1024x1536 source asset so the cropped
# output stays crisp on retina screens.
$bodyPath = Join-Path $root "body-source-raw.png"
$linesOut = Join-Path $root "embody-lines.png"
$squiggleOut = Join-Path $root "embody-squiggle.png"
$bodyOut = Join-Path $root "body-figure.png"

# Helper: write a cropped portion of a source image to a Bitmap, then make
# any near-background pixels transparent so the asset blends in dark mode too.
function Export-AccentCrop {
  param(
    [System.Drawing.Image]$Source,
    [int]$X, [int]$Y, [int]$W, [int]$H,
    [string]$OutPath
  )

  $bmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($Source,
    (New-Object System.Drawing.Rectangle(0, 0, $W, $H)),
    $X, $Y, $W, $H,
    [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()

  for ($yy = 0; $yy -lt $H; $yy++) {
    for ($xx = 0; $xx -lt $W; $xx++) {
      $c = $bmp.GetPixel($xx, $yy)
      $r = $c.R; $g2 = $c.G; $b = $c.B
      # Background is ~#FAFAF8. Coral is ~#FF6B6B (high R, much lower G/B).
      # If the pixel is roughly equal R/G/B and bright, treat it as background.
      $minRGB = [Math]::Min([Math]::Min($r, $g2), $b)
      $maxRGB = [Math]::Max([Math]::Max($r, $g2), $b)
      $spread = $maxRGB - $minRGB
      if ($minRGB -ge 220 -and $spread -le 12) {
        # Solid background -> fully transparent.
        $bmp.SetPixel($xx, $yy, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
      } elseif ($minRGB -ge 180 -and $spread -le 12) {
        # Anti-alias edge against background -> partial transparency.
        $alpha = [int](255 * (1 - ([Math]::Min(255, $minRGB) - 180) / 75.0))
        if ($alpha -lt 0) { $alpha = 0 }
        if ($alpha -gt 255) { $alpha = 255 }
        $bmp.SetPixel($xx, $yy, [System.Drawing.Color]::FromArgb($alpha, $r, $g2, $b))
      }
    }
  }

  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $OutPath ($W x $H)"
}

# 1) Crop the wordmark accents from the Figma frame.
$frame = [System.Drawing.Image]::FromFile($framePath)
# Vector1 (3:87)  x=207 y=69 w=15 h=12
# Vector6 (27:30) x=208 y=82 w=28 h=12
# Vector3 (3:96)  x=208 y=106 w=24 h=3
# Combined: x=205..238, y=66..112 (34x46 with a little breathing room).
Export-AccentCrop -Source $frame -X 205 -Y 66 -W 34 -H 46 -OutPath $linesOut
# Vector5 (4:31) x=23 y=126 w=89.4 h=9.3 -> pad to x=20..115, y=122..137 (95x15).
Export-AccentCrop -Source $frame -X 20 -Y 122 -W 95 -H 15 -OutPath $squiggleOut
$frame.Dispose()

# 2) Re-balance the body figure: find the actual non-background bounds and
# re-export a centered, square-ish PNG so contentFit="contain" looks right.
$body = [System.Drawing.Image]::FromFile($bodyPath)
$bw = $body.Width; $bh = $body.Height
$bmp = New-Object System.Drawing.Bitmap($body)
$body.Dispose()

$minX = $bw; $maxX = 0; $minY = $bh; $maxY = 0
for ($yy = 0; $yy -lt $bh; $yy++) {
  for ($xx = 0; $xx -lt $bw; $xx++) {
    $c = $bmp.GetPixel($xx, $yy)
    if ($c.A -lt 12) { continue }
    $minRGB = [Math]::Min([Math]::Min($c.R, $c.G), $c.B)
    $maxRGB = [Math]::Max([Math]::Max($c.R, $c.G), $c.B)
    $spread = $maxRGB - $minRGB
    $isBg = ($minRGB -ge 230 -and $spread -le 8 -and $c.A -gt 240)
    if (-not $isBg) {
      if ($xx -lt $minX) { $minX = $xx }
      if ($xx -gt $maxX) { $maxX = $xx }
      if ($yy -lt $minY) { $minY = $yy }
      if ($yy -gt $maxY) { $maxY = $yy }
    }
  }
}

Write-Host "Body bounds: x=$minX..$maxX y=$minY..$maxY"

# Pad the bounds equally and force a 2:3 aspect ratio (matches the Figma frame).
$padX = 12
$padY = 12
$cropX = [Math]::Max(0, $minX - $padX)
$cropY = [Math]::Max(0, $minY - $padY)
$cropX2 = [Math]::Min($bw, $maxX + $padX)
$cropY2 = [Math]::Min($bh, $maxY + $padY)
$cropW = $cropX2 - $cropX
$cropH = $cropY2 - $cropY

# Pad horizontally to recenter the figure. The body sits left-of-center, so
# we add right-side padding equal to (max horizontal offset from center).
$figureCenterX = ($minX + $maxX) / 2
$canvasCenterX = $bw / 2
$shift = $canvasCenterX - $figureCenterX
if ($shift -gt 0) {
  # Body is to the left, expand the right padding by $shift on the crop.
  $cropX = [Math]::Max(0, $minX - $padX - [int]$shift)
  $cropW = ($cropX2 - $cropX)
}

$dst = New-Object System.Drawing.Bitmap($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($dst)
$g.Clear([System.Drawing.Color]::Transparent)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.DrawImage($bmp,
  (New-Object System.Drawing.Rectangle(0, 0, $cropW, $cropH)),
  $cropX, $cropY, $cropW, $cropH,
  [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$bmp.Dispose()

# Make pure background transparent so the figure floats on any theme.
for ($yy = 0; $yy -lt $cropH; $yy++) {
  for ($xx = 0; $xx -lt $cropW; $xx++) {
    $c = $dst.GetPixel($xx, $yy)
    $minRGB = [Math]::Min([Math]::Min($c.R, $c.G), $c.B)
    $maxRGB = [Math]::Max([Math]::Max($c.R, $c.G), $c.B)
    $spread = $maxRGB - $minRGB
    if ($minRGB -ge 240 -and $spread -le 6) {
      $dst.SetPixel($xx, $yy, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    }
  }
}

$dst.Save($bodyOut, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()
Write-Host "Wrote $bodyOut ($cropW x $cropH)"
