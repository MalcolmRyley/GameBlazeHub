/*!
 * popup.js — Global, reusable, image-based popup
 * ------------------------------------------------------------------
 * Drop this file and hero.png into any static website's root folder
 * and add ONE line to index.html:
 *
 *     <script src="popup.js" defer></script>
 *
 * The popup opens automatically when the page URL has ANY non-empty
 * query string (e.g. ?game, ?abc=123, ?utm_source=google).
 * No libraries, no cookies, no storage, no hardcoded domains.
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  /* ================================================================
   *  CONFIGURATION — the only part you normally need to edit
   * ================================================================ */

  // Add your custom destination URL here (opens when the image is clicked)
  const buttonRedirectURL = "https://api.whatsapp.com/send?phone=+919170742153&text=Get%2015%25%20Discount";

  const CONFIG = {
    imageFile: 'hero.png',           // Loaded relative to popup.js's own location
    imageAlt: 'Special offer',       // Screen-reader description of the image
    linkLabel: 'Open special offer', // Screen-reader name of the clickable image
    dialogLabel: 'Special offer',    // Screen-reader name of the popup
    openInNewTab: false,             // true = open destination in a new tab
    closeOnBackdropClick: true,      // Click/tap on the dark area closes the popup
    widthPercent: 80,                // Popup width  as % of the viewport
    heightPercent: 80,               // Popup height as % of the viewport
    imagePosition: 'center',         // object-position, e.g. 'center top'
    overlayOpacity: 0.35,            // Dark background: 0 = invisible, 1 = solid black
    overlayBlur: 0                   // Blur of the site behind, in px (0 = sharp)
  };

  /* ================================================================
   *  1. Guards: run once, and only when a non-empty query exists
   * ================================================================ */

  // Prevent duplicate popups if the script is included more than once.
  if (window.__heroPopupLoaded) return;
  window.__heroPopupLoaded = true;

  // window.location.search is "" for "https://example.com/" AND for
  // "https://example.com/?" (an empty query), so both are ignored.
  const query = window.location.search;
  const hasQueryParameter = query.length > 0 && query !== '?';
  if (!hasQueryParameter) return;

  /* ================================================================
   *  2. Resolve local resources relative to THIS script file
   *     (works on any domain, sub-domain, HTTP or HTTPS, and on pages
   *      inside sub-folders — nothing is hardcoded)
   * ================================================================ */

  const scriptEl =
    document.currentScript ||
    document.querySelector('script[src*="popup.js"]');
  const scriptBase = scriptEl && scriptEl.src ? scriptEl.src : document.baseURI;

  let imageURL;
  try {
    imageURL = new URL(CONFIG.imageFile, scriptBase).href;
  } catch (e) {
    imageURL = CONFIG.imageFile;
  }

  // Validate the destination but use it EXACTLY as written (never modified,
  // never combined with the page's query string).
  function getDestination(raw) {
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    if (!value || value === 'ADD_YOUR_URL_HERE') return null;
    try {
      const parsed = new URL(value, document.baseURI);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return value;
    } catch (e) {
      return null;
    }
  }
  const destination = getDestination(buttonRedirectURL);
  if (!destination) {
    console.warn('[popup.js] Set buttonRedirectURL in popup.js to a valid http(s) URL.');
  }

  /* ================================================================
   *  3. Styles (scoped inside Shadow DOM — cannot leak into the site,
   *     and the site's CSS cannot break the popup)
   * ================================================================ */

  const STYLES = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }

    .backdrop {
      position: fixed; inset: 0;
      background: rgba(6, 8, 14, var(--hp-overlay));
      -webkit-backdrop-filter: blur(var(--hp-blur));
      backdrop-filter: blur(var(--hp-blur));
      animation: hp-fade 0.25s ease-out both;
    }

    .wrap {
      position: fixed; inset: 0;
      display: flex; align-items: center; justify-content: center;
      /* keep clear of notches / home indicators */
      padding:
        max(12px, env(safe-area-inset-top))
        max(12px, env(safe-area-inset-right))
        max(12px, env(safe-area-inset-bottom))
        max(12px, env(safe-area-inset-left));
      overscroll-behavior: contain;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-tap-highlight-color: transparent;
    }

    .dialog {
      position: relative;
      width: calc(var(--hp-w) * 1vw);
      height: calc(var(--hp-h) * 1vh);
      max-width: 100%;
      max-height: 100%;
      overflow: hidden;
      border-radius: clamp(12px, 2vmin, 22px);
      background:
        radial-gradient(120% 90% at 50% 0%, #2c3a66 0%, transparent 60%),
        linear-gradient(160deg, #151a2b 0%, #0c0f18 100%);
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.08),
        0 30px 80px rgba(0, 0, 0, 0.55),
        0 10px 24px rgba(0, 0, 0, 0.35);
      outline: none;
      animation: hp-in 0.32s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    @supports (height: 1dvh) {
      .dialog { height: calc(var(--hp-h) * 1dvh); }
    }

    .media {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      display: block;
      object-fit: cover;
      object-position: var(--hp-pos);
      opacity: 0;
      transition: opacity 0.35s ease, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
      user-select: none; -webkit-user-drag: none;
    }
    .dialog.is-loaded .media { opacity: 1; }
    .dialog.no-image  .media { display: none; }

    /* the whole image is the link */
    .media-link {
      position: absolute; inset: 0; z-index: 1;
      display: block;
      cursor: pointer;
      outline: none;
    }
    .media-link:not([href]) { cursor: default; }
    .media-link[href]:hover .media { transform: scale(1.03); }
    .media-link:focus-visible::after {
      content: ""; position: absolute; inset: 0;
      border-radius: inherit;
      box-shadow: inset 0 0 0 4px #ffd54a;
    }

    /* ---------- Close button ---------- */
    .close {
      position: absolute; top: 12px; right: 12px; z-index: 3;
      width: 44px; height: 44px;              /* comfortable touch target */
      display: grid; place-items: center;
      padding: 0; margin: 0; border: 0; border-radius: 50%;
      color: #fff; cursor: pointer;
      background: rgba(12, 14, 20, 0.62);
      -webkit-backdrop-filter: blur(6px);
      backdrop-filter: blur(6px);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25), 0 4px 14px rgba(0, 0, 0, 0.35);
      transition: transform 0.2s ease, background-color 0.2s ease;
    }
    .close svg { width: 18px; height: 18px; display: block; }
    .close:hover { background: rgba(12, 14, 20, 0.85); transform: rotate(90deg); }
    .close:focus-visible { outline: 3px solid #ffd54a; outline-offset: 3px; }

    /* ---------- Responsive tweaks ---------- */
    @media (max-width: 600px) {
      .close { top: 10px; right: 10px; }
    }
    /* phones in landscape: short screens need a little more height */
    @media (orientation: landscape) and (max-height: 520px) {
      .dialog { height: 88vh; }
      @supports (height: 1dvh) { .dialog { height: 88dvh; } }
      .close { top: 8px; right: 8px; width: 40px; height: 40px; }
    }

    /* ---------- Motion ---------- */
    @keyframes hp-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes hp-in {
      from { opacity: 0; transform: translateY(14px) scale(0.97); }
      to   { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .backdrop, .dialog { animation: none; }
      .close, .media { transition: none; }
      .media-link[href]:hover .media { transform: none; }
    }
  `;

  /* ================================================================
   *  4. Build and show the popup
   * ================================================================ */

  let host = null;
  let lastFocused = null;
  let savedStyles = null;

  function lockScroll() {
    const html = document.documentElement;
    const body = document.body;
    const scrollbar = window.innerWidth - html.clientWidth;
    savedStyles = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (scrollbar > 0) {
      // avoid the page "jumping" when the scrollbar disappears
      const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = (current + scrollbar) + 'px';
    }
  }

  function unlockScroll() {
    if (!savedStyles) return;
    document.documentElement.style.overflow = savedStyles.htmlOverflow;
    document.body.style.overflow = savedStyles.bodyOverflow;
    document.body.style.paddingRight = savedStyles.bodyPaddingRight;
    savedStyles = null;
  }

  function showPopup() {
    if (host || document.getElementById('hero-popup-root')) return; // no duplicates

    host = document.createElement('div');
    host.id = 'hero-popup-root';
    // Inline + !important so site-wide CSS can't reposition the host.
    host.setAttribute(
      'style',
      'all: initial !important; position: fixed !important; inset: 0 !important;' +
      'z-index: 2147483647 !important; display: block !important;'
    );

    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>' + STYLES + '</style>' +
      '<div class="backdrop"></div>' +
      '<div class="wrap">' +
        '<section class="dialog" role="dialog" aria-modal="true" tabindex="-1">' +
          '<a class="media-link">' +
            '<img class="media" decoding="async" draggable="false">' +
          '</a>' +
          '<button class="close" type="button" aria-label="Close popup">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" ' +
              'stroke-linecap="round" aria-hidden="true" focusable="false">' +
              '<path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
        '</section>' +
      '</div>';

    const wrap = root.querySelector('.wrap');
    const dialog = root.querySelector('.dialog');
    const img = root.querySelector('.media');
    const closeBtn = root.querySelector('.close');
    const link = root.querySelector('.media-link');

    dialog.style.setProperty('--hp-w', String(CONFIG.widthPercent));
    dialog.style.setProperty('--hp-h', String(CONFIG.heightPercent));
    dialog.style.setProperty('--hp-pos', CONFIG.imagePosition);
    root.host.style.setProperty('--hp-overlay', String(CONFIG.overlayOpacity));
    root.host.style.setProperty('--hp-blur', CONFIG.overlayBlur + 'px');
    dialog.setAttribute('aria-label', CONFIG.dialogLabel);

    // Whole image = link. Destination used exactly as configured.
    link.setAttribute('aria-label', CONFIG.linkLabel);
    if (destination) {
      link.href = destination;
      if (CONFIG.openInNewTab) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    } else {
      // No valid URL yet: image is not clickable (warning already in console).
      link.setAttribute('tabindex', '-1');
    }

    // Image with graceful failure: popup keeps working on a styled background.
    img.alt = CONFIG.imageAlt;
    img.addEventListener('load', function () { dialog.classList.add('is-loaded'); });
    img.addEventListener('error', function () {
      dialog.classList.add('no-image');
      console.warn('[popup.js] Could not load image: ' + imageURL);
    });
    img.src = imageURL;

    closeBtn.addEventListener('click', closePopup);

    // Backdrop click: only closes if the press STARTED and ENDED on the
    // backdrop — prevents accidental dismissals from swipes/drags on mobile.
    if (CONFIG.closeOnBackdropClick) {
      let downOnBackdrop = false;
      wrap.addEventListener('pointerdown', function (e) {
        downOnBackdrop = e.target === wrap;
      });
      wrap.addEventListener('pointerup', function (e) {
        if (downOnBackdrop && e.target === wrap) closePopup();
        downOnBackdrop = false;
      });
      wrap.addEventListener('pointercancel', function () { downOnBackdrop = false; });
    }

    // Stop the page behind from scrolling on touch devices (iOS rubber-band).
    host.addEventListener('touchmove', preventDefault, { passive: false });
    host.addEventListener('wheel', preventDefault, { passive: false });

    document.addEventListener('keydown', onKeyDown, true);

    lastFocused = document.activeElement;
    lockScroll();
    document.body.appendChild(host);

    try { dialog.focus({ preventScroll: true }); } catch (e) { dialog.focus(); }
  }

  function preventDefault(e) { e.preventDefault(); }

  function onKeyDown(e) {
    if (!host) return;

    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      e.stopPropagation();
      closePopup();
      return;
    }

    // Focus trap: Tab / Shift+Tab cycle between the close button and image link.
    if (e.key === 'Tab') {
      const root = host.shadowRoot;
      const focusables = [root.querySelector('.close'), root.querySelector('.media-link[href]')]
        .filter(Boolean);
      if (!focusables.length) { e.preventDefault(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = root.activeElement;

      e.preventDefault();
      if (e.shiftKey) {
        (active === first || focusables.indexOf(active) === -1 ? last : first).focus();
      } else {
        (active === last || focusables.indexOf(active) === -1 ? first : last).focus();
      }
    }
  }

  function closePopup() {
    if (!host) return;
    document.removeEventListener('keydown', onKeyDown, true);
    host.remove();
    host = null;
    unlockScroll();
    // URL and query string are never touched.
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    lastFocused = null;
  }

  /* ================================================================
   *  5. Start once the page's <body> exists
   * ================================================================ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showPopup, { once: true });
  } else {
    showPopup();
  }
})();
