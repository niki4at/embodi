# Sody Home HTML Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publicly expose one responsive HTML gallery with eight image-led, card-free Sody home-screen concepts.

**Architecture:** A semantic `index.html` holds gallery controls, concept metadata, and eight independent phone scenes. One stylesheet owns the shared gallery shell and concept-specific visual compositions. One dependency-free script owns navigation, keyboard input, motion preference, and remote-image fallback behavior.

**Tech Stack:** HTML5, CSS custom properties and animations, browser JavaScript, remote Unsplash images, Python static server, Cloudflare quick tunnel.

---

### Task 1: Build the semantic gallery and eight scenes

**Files:**
- Create: `docs/design/irene/home-mockups/index.html`

- [ ] **Step 1: Create the gallery shell**

Add a skip link, header, sticky concept selector, `<main>` stage, previous/next controls, motion control, and photo credits. Use buttons with `data-concept-target` values from `cinematic` through `afterglow`.

- [ ] **Step 2: Add eight complete concept scenes**

Each scene uses:

```html
<article class="concept" id="concept-cinematic" data-concept="cinematic">
  <section class="phone-scene cinematic-scene" aria-label="Cinematic start home screen">
    <!-- status, greeting, editorial photo, line artwork, workout copy, one primary action -->
  </section>
  <aside class="concept-notes">
    <p class="concept-number">01 / 08</p>
    <h2>Cinematic start</h2>
    <p>...</p>
  </aside>
</article>
```

Use the eight concepts and copy from `docs/superpowers/specs/2026-08-01-sody-home-html-gallery-design.md`. Keep every scene free of `.card` elements and stacked panel containers.

- [ ] **Step 3: Add accessible image and interaction markup**

Every remote image receives descriptive `alt` text. Every control receives a visible label or `aria-label`. The selected concept button uses `aria-pressed="true"`, while inactive scenes use `hidden`.

- [ ] **Step 4: Review static structure**

Run:

```bash
rg -c 'class="concept"' docs/design/irene/home-mockups/index.html
rg 'class="[^"]*card' docs/design/irene/home-mockups/index.html
```

Expected: 8 concepts and no card-class matches.

### Task 2: Create the responsive Sody visual system

**Files:**
- Create: `docs/design/irene/home-mockups/styles.css`
- Modify: `docs/design/irene/home-mockups/index.html`

- [ ] **Step 1: Define shared tokens and gallery layout**

Use:

```css
:root {
  --cream: #fffce9;
  --lime: #d8f24c;
  --blue: #4a43ec;
  --lavender: #d3cfff;
  --olive: #90aa47;
  --deep: #324b3e;
  --ink: #17163a;
  --display: "Fredoka", sans-serif;
  --mono: "DM Mono", monospace;
}
```

Create a desktop two-column stage with the phone scene and notes. Collapse to one column below 900px. Keep the phone viewport within `min(430px, 92vw)`.

- [ ] **Step 2: Style eight distinct flowing compositions**

Use full-bleed or organically clipped photography, large type, ribbons, curved SVG paths, open dividers, and solid pill actions. Do not use white rectangular panel stacks, border-box dashboards, or drop-shadow cards inside the phone.

- [ ] **Step 3: Add motion and reduced-motion behavior**

Animate scene entry, photo drift, line drawing, and button response. Add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}

body[data-motion="paused"] * {
  animation-play-state: paused !important;
}
```

- [ ] **Step 4: Check responsive overflow**

Inspect at 1440×1000, 1024×768, 430×932, and 375×812. Confirm text remains readable, phone scenes stay within the viewport, and navigation controls remain reachable.

### Task 3: Add dependency-free gallery behavior

**Files:**
- Create: `docs/design/irene/home-mockups/gallery.js`
- Modify: `docs/design/irene/home-mockups/index.html`

- [ ] **Step 1: Add concept navigation**

Use one ordered concept list and a single render function:

```js
const conceptIds = [
  'cinematic',
  'editorial',
  'coach',
  'body-type',
  'kinetic',
  'quiet',
  'electric',
  'afterglow',
]

function showConcept(index) {
  activeIndex = (index + conceptIds.length) % conceptIds.length
  const activeId = conceptIds[activeIndex]
  conceptElements.forEach((element) => {
    element.hidden = element.dataset.concept !== activeId
  })
  selectorButtons.forEach((button) => {
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.conceptTarget === activeId),
    )
  })
}
```

- [ ] **Step 2: Add click and keyboard controls**

Selector buttons jump to their concept. Previous/next buttons wrap. Left/right arrows navigate. Number keys 1–8 jump directly. Ignore shortcuts while focus is inside a form control.

- [ ] **Step 3: Add motion and image-fallback controls**

The motion button toggles `body.dataset.motion` between `running` and `paused`. Image error handlers add `.image-failed` to the nearest image frame and hide the broken image without collapsing the composition.

- [ ] **Step 4: Verify script syntax**

Run:

```bash
node --check docs/design/irene/home-mockups/gallery.js
```

Expected: exit 0 with no output.

### Task 4: Verify, document, and publish

**Files:**
- Modify only if verification reveals defects.

- [ ] **Step 1: Verify remote images**

Send a HEAD request to every unique `images.unsplash.com` URL in `index.html`. Replace any URL that does not return HTTP 200.

- [ ] **Step 2: Run repository checks**

Run:

```bash
npx expo lint
git diff --check
```

Expected: both exit 0.

- [ ] **Step 3: Commit, push, and open the draft PR before browser testing**

Stage only the gallery files and plan, commit them, push `cursor/sody-home-mockups-1d10`, and create a draft pull request against `main`.

- [ ] **Step 4: Test in a browser**

Serve `docs/design/irene/home-mockups` on a local port. Verify all eight concepts, pointer controls, keyboard controls, motion pause, responsive layouts, and an empty browser console. Capture a screenshot and a short concept-switching video.

- [ ] **Step 5: Publish through a public tunnel**

Start a Cloudflare quick tunnel to the static server in a named tmux session. Verify the public URL returns the gallery HTML and leave both processes running.

- [ ] **Step 6: Commit any browser-test fixes**

If browser testing changes files, rerun checks, commit the fixes, push, and update the pull request.
