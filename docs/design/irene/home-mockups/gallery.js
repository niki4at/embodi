(() => {
  'use strict';

  const conceptIds = [
    'cinematic',
    'editorial',
    'coach',
    'body-type',
    'kinetic',
    'quiet',
    'electric',
    'afterglow',
  ];

  const body = document.body;
  const galleryStage = document.querySelector('#gallery-stage');
  const conceptPanels = conceptIds.map((id) =>
    document.querySelector(`[data-concept="${id}"]`),
  );
  const selectorTabs = conceptIds.map((id) =>
    document.querySelector(`[data-concept-target="${id}"]`),
  );
  const previousButton = document.querySelector('[data-gallery-previous]');
  const nextButton = document.querySelector('[data-gallery-next]');
  const motionButton = document.querySelector('[data-motion-toggle]');
  const liveRegion = document.querySelector(
    '[data-gallery-live][aria-live="polite"]',
  );
  const remoteImages = Array.from(
    document.querySelectorAll('[data-remote-image]'),
  );
  const reducedMotionQuery = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  );

  const hasMissingPanel = conceptPanels.some((panel) => panel === null);
  const hasMissingTab = selectorTabs.some((tab) => tab === null);

  if (
    !body ||
    hasMissingPanel ||
    hasMissingTab ||
    !previousButton ||
    !nextButton ||
    !motionButton
  ) {
    return;
  }

  let activeIndex = 0;
  let hasAnnounced = false;

  function wrapConceptIndex(index) {
    return (
      ((index % conceptIds.length) + conceptIds.length) % conceptIds.length
    );
  }

  function getTabLabel(tab) {
    return tab.textContent.trim().replace(/\s+/g, ' ');
  }

  function updateLiveRegion(tab) {
    if (!liveRegion || !hasAnnounced) {
      return;
    }

    liveRegion.textContent = `Showing ${getTabLabel(tab)}`;
  }

  function showConcept(index, options = {}) {
    activeIndex = wrapConceptIndex(index);

    conceptPanels.forEach((panel, panelIndex) => {
      panel.hidden = panelIndex !== activeIndex;
    });

    selectorTabs.forEach((tab, tabIndex) => {
      const isActive = tabIndex === activeIndex;
      tab.setAttribute('aria-selected', String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });

    const activeTab = selectorTabs[activeIndex];
    updateLiveRegion(activeTab);

    if (options.focusTab) {
      activeTab.focus();
    }

    hasAnnounced = true;
  }

  function handleSelectorClick(event) {
    const selectedIndex = selectorTabs.indexOf(event.currentTarget);

    if (selectedIndex >= 0) {
      showConcept(selectedIndex);
    }
  }

  function showPreviousConcept(options = {}) {
    showConcept(activeIndex - 1, options);
  }

  function showNextConcept(options = {}) {
    showConcept(activeIndex + 1, options);
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    return (
      target.isContentEditable ||
      Boolean(target.closest('input, textarea, select, button, a'))
    );
  }

  function isFocusInsidePanel(target) {
    return (
      target instanceof Element &&
      Boolean(target.closest('.concept[role="tabpanel"]'))
    );
  }

  function getTabDestination(key, tabIndex) {
    if (key === 'ArrowLeft') {
      return tabIndex - 1;
    }

    if (key === 'ArrowRight') {
      return tabIndex + 1;
    }

    if (key === 'Home') {
      return 0;
    }

    if (key === 'End') {
      return conceptIds.length - 1;
    }

    return null;
  }

  function handleTabKeyboard(event, tabIndex) {
    const destination = getTabDestination(event.key, tabIndex);

    if (destination === null) {
      return false;
    }

    event.preventDefault();
    showConcept(destination, { focusTab: true });
    return true;
  }

  function handleGlobalKeyboard(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const tabIndex = selectorTabs.indexOf(event.target);
    if (tabIndex >= 0 && handleTabKeyboard(event, tabIndex)) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    const focusPanel = isFocusInsidePanel(event.target);

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showPreviousConcept({ focusTab: focusPanel });
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showNextConcept({ focusTab: focusPanel });
      return;
    }

    if (/^[1-8]$/.test(event.key)) {
      event.preventDefault();
      showConcept(Number(event.key) - 1, { focusTab: focusPanel });
    }
  }

  function setMotionPaused(isPaused, options = {}) {
    const systemReduced = reducedMotionQuery.matches;
    const paused = systemReduced || isPaused;

    body.dataset.motion = paused ? 'paused' : 'running';
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.disabled = systemReduced;

    if (systemReduced) {
      motionButton.textContent = 'Motion reduced by system';
      motionButton.setAttribute(
        'aria-label',
        'Pause gallery animations. System reduced motion is enabled.',
      );
      return;
    }

    motionButton.textContent = paused ? 'Resume motion' : 'Pause motion';
    motionButton.setAttribute('aria-label', 'Pause gallery animations');

    if (options.announce && liveRegion && hasAnnounced) {
      liveRegion.textContent = paused
        ? 'Gallery motion paused'
        : 'Gallery motion running';
    }
  }

  function toggleMotion() {
    if (reducedMotionQuery.matches) {
      return;
    }

    setMotionPaused(body.dataset.motion !== 'paused', { announce: true });
  }

  function markImageFailed(image) {
    const imageFrame = image.closest('.image-frame');

    if (imageFrame) {
      imageFrame.classList.add('image-failed');
    }
  }

  function handleRemoteImageError(event) {
    markImageFailed(event.currentTarget);
  }

  function prepareRemoteImage(image) {
    image.addEventListener('error', handleRemoteImageError);

    if (image.complete && image.naturalWidth === 0) {
      markImageFailed(image);
    }
  }

  selectorTabs.forEach((tab) => {
    tab.addEventListener('click', handleSelectorClick);
  });
  previousButton.addEventListener('click', () => showPreviousConcept());
  nextButton.addEventListener('click', () => showNextConcept());
  motionButton.addEventListener('click', toggleMotion);
  document.addEventListener('keydown', handleGlobalKeyboard);
  remoteImages.forEach(prepareRemoteImage);

  if (typeof reducedMotionQuery.addEventListener === 'function') {
    reducedMotionQuery.addEventListener('change', () => {
      setMotionPaused(body.dataset.motion === 'paused');
    });
  } else if (typeof reducedMotionQuery.addListener === 'function') {
    reducedMotionQuery.addListener(() => {
      setMotionPaused(body.dataset.motion === 'paused');
    });
  }

  const selectedTabIndex = selectorTabs.findIndex(
    (tab) => tab.getAttribute('aria-selected') === 'true',
  );

  setMotionPaused(
    body.dataset.motion === 'paused' || reducedMotionQuery.matches,
  );
  showConcept(selectedTabIndex >= 0 ? selectedTabIndex : 0);

  if (galleryStage) {
    galleryStage.setAttribute('data-gallery-ready', 'true');
  }
})();
