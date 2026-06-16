/**
 * Loopi Pet — lightweight sprite animation + state machine
 * for yuanzehua.me personal homepage companion.
 *
 * Mount point:  <div id="loopi-pet" data-version="loopi_v0_3"></div>
 * Dependencies: none (vanilla JS)
 */
(function () {
  'use strict';

  // ── Config ──────────────────────────────────────
  const MOTION_URL = '/assets/images/pets/loopi/v0-3/loopi-v0-3-motion.json';
  const IDLE_TIMEOUT   = 20_000;   // ms → thinking
  const SLEEP_TIMEOUT  = 120_000;  // ms → sleep
  const HOVER_DEBOUNCE = 300;      // ms

  // ── State machine ──────────────────────────────
  const PRIORITY = { happy: 4, thinking: 3, wave: 2, idle: 1, sleep: 0 };

  let currentState = 'idle';
  let motionConfig = null;
  let timers = { idle: null, sleep: null, revert: null, hover: null };
  let spriteEl = null;
  let mountEl  = null;
  let lastInteraction = Date.now();

  // ── Init ────────────────────────────────────────
  function init() {
    mountEl = document.getElementById('loopi-pet');
    if (!mountEl) return;

    // Check reduced motion preference
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Build DOM
    buildDOM(prefersReduced);

    if (prefersReduced) {
      mountEl.classList.add('is-static');
      return;
    }

    // Load motion config
    loadMotionConfig().then(() => {
      setState('idle');
      bindEvents();
      startIdleTimers();
    }).catch(() => {
      // Fallback to static if config fails
      mountEl.classList.add('is-static');
    });
  }

  // ── DOM construction ────────────────────────────
  function buildDOM(prefersReduced) {
    // Sprite element
    spriteEl = document.createElement('div');
    spriteEl.className = 'loopi-pet__sprite';
    spriteEl.setAttribute('role', 'img');
    spriteEl.setAttribute('aria-label', 'Loopi v0.3 animated companion');

    // Poster fallback
    const poster = document.createElement('img');
    poster.className = 'loopi-pet__poster';
    poster.src = '/assets/images/pets/loopi/v0-3/loopi-v0-3-poster.webp';
    poster.alt = 'Loopi v0.3';
    poster.loading = 'lazy';

    // Particles
    const particles = document.createElement('div');
    particles.className = 'loopi-pet__particles';
    for (let i = 0; i < 3; i++) {
      const p = document.createElement('span');
      p.className = 'loopi-pet__particle';
      particles.appendChild(p);
    }

    // State label
    const label = document.createElement('span');
    label.className = 'loopi-pet__label';
    label.setAttribute('data-loopi-label', '');

    mountEl.appendChild(spriteEl);
    mountEl.appendChild(poster);
    mountEl.appendChild(particles);
    mountEl.appendChild(label);

    if (prefersReduced) {
      mountEl.classList.add('is-static');
    }
  }

  // ── Motion config loader ───────────────────────
  function loadMotionConfig() {
    return fetch(MOTION_URL)
      .then(r => r.json())
      .then(cfg => {
        motionConfig = cfg;
        // Preload spritesheet
        const img = new Image();
        img.src = cfg.spritesheet;
        // Set background image on sprite element
        spriteEl.style.backgroundImage = `url("${cfg.spritesheet}")`;
      });
  }

  // ── State transitions ──────────────────────────
  function setState(newState) {
    if (!motionConfig) return;
    if (newState === currentState) return;

    // Priority check: don't downgrade a higher-priority state
    if (PRIORITY[newState] < PRIORITY[currentState] && currentState !== 'idle' && currentState !== 'sleep') {
      return;
    }

    currentState = newState;
    mountEl.setAttribute('data-state', newState);

    // Update label
    const label = mountEl.querySelector('[data-loopi-label]');
    if (label) {
      const stateInfo = motionConfig.states[newState];
      label.textContent = stateInfo ? stateInfo.description : newState;
    }

    // Handle one-shot states (wave, thinking, happy → revert to idle)
    clearTimeout(timers.revert);
    const stateCfg = motionConfig.states[newState];
    if (stateCfg && !stateCfg.loop) {
      const duration = (stateCfg.frames / stateCfg.fps) * 1000;
      timers.revert = setTimeout(() => {
        currentState = 'idle';  // allow downgrade
        setState('idle');
      }, duration + 100);
    }
  }

  // ── Event binding ──────────────────────────────
  function bindEvents() {
    // Hover → wave
    mountEl.addEventListener('mouseenter', () => {
      clearTimeout(timers.hover);
      timers.hover = setTimeout(() => {
        recordInteraction();
        setState('wave');
      }, HOVER_DEBOUNCE);
    });

    mountEl.addEventListener('mouseleave', () => {
      clearTimeout(timers.hover);
      recordInteraction();
    });

    // Click → thinking
    mountEl.addEventListener('click', () => {
      recordInteraction();
      setState('thinking');
    });

    // Any interaction resets timers
    ['mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
      document.addEventListener(evt, () => {
        recordInteraction();
      }, { passive: true });
    });

    // Visibility change — pause when tab hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearAllTimers();
      } else {
        startIdleTimers();
        setState('idle');
      }
    });
  }

  // ── Idle / Sleep timers ────────────────────────
  function startIdleTimers() {
    clearAllTimers();
    timers.idle = setTimeout(() => {
      if (currentState === 'idle') {
        setState('thinking');
      }
    }, IDLE_TIMEOUT);

    timers.sleep = setTimeout(() => {
      setState('sleep');
    }, SLEEP_TIMEOUT);
  }

  function clearAllTimers() {
    Object.keys(timers).forEach(k => {
      clearTimeout(timers[k]);
      timers[k] = null;
    });
  }

  function recordInteraction() {
    lastInteraction = Date.now();
    if (currentState === 'sleep') {
      currentState = 'idle';  // allow transition
      setState('idle');
    }
    startIdleTimers();
  }

  // ── Public API (for Pet Lab feedback integration) ──
  window.LoopiPet = {
    triggerState(state) {
      if (motionConfig && motionConfig.states[state]) {
        // Force state regardless of priority
        currentState = 'idle';
        setState(state);
      }
    },
    getState() {
      return currentState;
    },
    reset() {
      currentState = 'idle';
      setState('idle');
      startIdleTimers();
    }
  };

  // ── Boot ────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
