# Sody home HTML gallery design

## Outcome

Create one public, interactive HTML gallery containing eight polished mobile home-screen concepts for Sody. The gallery is a design artifact, not a replacement for the Expo home screen. It should make the visual directions easy to compare before any React Native work starts.

## Chosen direction

The concepts use editorial fitness photography as the human presence, following the supplied Sody reference: cream, royal blue, acid lime, lavender, dark green, rounded display type, monospaced secondary type, and hand-drawn line overlays.

The gallery starts from the cinematic hero direction. Each concept keeps one dominant workout action above the fold. Supporting information appears through open composition, type, image crops, ribbons, dividers, and flowing shapes instead of stacked cards.

## Gallery structure

- A responsive desktop canvas presents a phone viewport and a concise concept index.
- Mobile layouts show one concept at a time.
- A sticky concept selector switches between eight named directions.
- Previous and next controls, arrow keys, and number keys provide fast navigation.
- A motion toggle lets people pause nonessential animation.
- Every concept includes a title, short rationale, palette notes, and the mobile mockup.
- A compact source panel credits each remote editorial photograph.

## Eight concepts

1. **Cinematic start**: full-bleed athlete portrait, overlaid next workout, lime start action, and hand-drawn coach line.
2. **Editorial flow**: asymmetrical image crop and oversized headline lead into the workout action.
3. **Coach in motion**: layered photography and an animated coach annotation make adaptation feel present.
4. **Body typography**: a portrait is clipped through giant type while the workout details follow a curved baseline.
5. **Kinetic path**: a continuous route line connects greeting, context, session, and start action.
6. **Quiet strength**: calm negative space, close body detail, and restrained motion suit lower-energy days.
7. **Electric rhythm**: high-contrast split photography and animated progress typography create stronger training energy.
8. **Afterglow**: a dark-mode completed-today state celebrates momentum and offers one clear next movement.

## Interaction and motion

- Concept changes use a short crossfade and vertical slide.
- Hero photographs drift by a few pixels to create depth.
- Hand-drawn lines animate with stroke-dash movement.
- Primary buttons respond with scale and color.
- Small metadata enters with staggered transitions.
- `prefers-reduced-motion` disables continuous and entrance animation.
- Keyboard focus remains visible on every control.

## Image treatment

- Use remote Unsplash image URLs with descriptive `alt` text and source links.
- Add color washes and gradients so photos read as part of the Sody palette.
- Use `object-position` per concept to preserve faces and body gestures.
- Keep meaningful copy outside image-only regions where contrast may vary.
- Show a branded fallback gradient if a remote image fails.

## Files

- `docs/design/irene/home-mockups/index.html`: semantic gallery structure and eight concept scenes.
- `docs/design/irene/home-mockups/styles.css`: responsive layout, phone scenes, visual language, and motion.
- `docs/design/irene/home-mockups/gallery.js`: navigation, keyboard controls, motion preference, and image fallback handling.

## Verification

- Run the project linter to ensure repository-wide lint remains clean.
- Check `gallery.js` syntax with Node.
- Verify every remote image URL returns a successful response.
- Load the gallery at desktop and mobile widths.
- Exercise selector clicks, previous/next controls, keyboard navigation, and motion pause.
- Inspect browser console output for errors.
- Capture one screenshot and one short video showing concept switching.
- Publish the static directory through a public tunnel and verify the external URL responds.

## Scope boundaries

- Do not change the Expo home screen or Convex backend.
- Do not add application dependencies.
- Do not introduce new product behavior or data requirements.
- Do not commit downloaded stock photography; the mockup references remote images with attribution.
