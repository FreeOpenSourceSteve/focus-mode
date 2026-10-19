/**
 * ATI Time Hider — content.js
 *
 * Runs in both the top frame (lms.atitesting.com) and the embedded
 * iframe (pages-delivery.atitesting.com) thanks to all_frames: true
 * in manifest.json.
 *
 * Only the top frame creates the badge and keyboard shortcut.
 * The iframe receives toggle commands via postMessage so both frames
 * stay in sync from a single control point.
 *
 * Focus Mode also forces all accordion panels open simultaneously
 * and prevents clicking from closing them. Accordions collapse fully
 * when Focus Mode is turned off.
 *
 * Toggle: Option+H (⌥H) or the badge button (top frame only).
 */

(function () {
    'use strict';

    const HIDE_CLASS  = 'ati-hidden';
    const STORAGE_KEY = 'ati_focus_mode_active';
    const BADGE_ID    = 'ati-focus-badge';
    const IS_TOP      = window === window.top;

    // Selectors applied directly to matched elements
    const SELECTORS = [
        'app-white-hearder',
        '.blue-header',
        'div[role="toolbar"].navbar.navbar-expand-lg.fixed-top.nav-on-screen',
        'app-page-tools-toolbar',
        'app-site-header',
        'div[role="toolbar"].nav-on-screen',
        'app-text-to-speech-read-along',
        '.blue-footer',
        '.blue-footer1',
        '.btn-back-to-top',
        '._pendo-badge-image',
        '[data-_pendo-image-1]',
        '.content-question',
        'button[data-layout="badgeResourceCenter"]',
        '.component[data-component-type="video"]',
        '.component[data-component-type="biodigital"]',
    ];

    var observer = null;

    /* ── State (top frame only) ── */
    function isActive() {
        return sessionStorage.getItem(STORAGE_KEY) === '1';
    }
    function setActive(value) {
        sessionStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    }

    /* ── Hide / show ── */
    function hideAll() {
        SELECTORS.forEach(function (sel) {
            document.querySelectorAll(sel).forEach(function (el) {
                el.classList.add(HIDE_CLASS);
            });
        });
    }

    function showAll() {
        document.querySelectorAll('.' + HIDE_CLASS).forEach(function (el) {
            el.classList.remove(HIDE_CLASS);
        });
    }

    /* ── Accordion: expand all panels, block click-to-close ────────────
     *
     * Bootstrap enforces single-open via two mechanisms:
     *   1. data-parent on each .collapse panel — tells Bootstrap to close
     *      siblings when one opens. We store the value in data-ati-parent
     *      and remove the attribute to sever this link.
     *   2. Click handler on .btn.action-bar buttons — toggles individual
     *      panels. We intercept clicks in the capture phase to block it.
     *
     * On Focus Mode off: data-parent is restored, all panels collapsed,
     * click interception removed. Accordions return to normal behavior.
     * ────────────────────────────────────────────────────────────────── */

    function expandAccordions(root) {
        root = root || document;

        // Store data-parent then remove it so Bootstrap can't close siblings
        root.querySelectorAll('.collapse[data-parent]').forEach(function (panel) {
            panel.setAttribute('data-ati-parent', panel.getAttribute('data-parent'));
            panel.removeAttribute('data-parent');
        });

        // Open every panel
        root.querySelectorAll('.collapse').forEach(function (panel) {
            panel.classList.add('show');
        });

        // Update button state
        root.querySelectorAll('.btn.action-bar').forEach(function (btn) {
            btn.setAttribute('aria-expanded', 'true');
            btn.classList.remove('collapsed');
        });
    }

    function collapseAccordions() {
        // Restore data-parent on all panels we modified
        document.querySelectorAll('.collapse[data-ati-parent]').forEach(function (panel) {
            panel.setAttribute('data-parent', panel.getAttribute('data-ati-parent'));
            panel.removeAttribute('data-ati-parent');
            panel.classList.remove('show');
        });

        // Collapse any remaining open panels
        document.querySelectorAll('.collapse.show').forEach(function (panel) {
            panel.classList.remove('show');
        });

        // Reset button state
        document.querySelectorAll('.btn.action-bar').forEach(function (btn) {
            btn.setAttribute('aria-expanded', 'false');
            btn.classList.add('collapsed');
        });
    }

    // Intercept accordion button clicks in capture phase so Bootstrap never sees them
    function blockAccordionClick(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
    }

    function lockAccordions(root) {
        root = root || document;
        root.querySelectorAll('.btn.action-bar').forEach(function (btn) {
            btn.addEventListener('click', blockAccordionClick, true);
        });
    }

    function unlockAccordions() {
        document.querySelectorAll('.btn.action-bar').forEach(function (btn) {
            btn.removeEventListener('click', blockAccordionClick, true);
        });
    }

    /* ── MutationObserver: tag newly-rendered elements immediately ── */
    function startObserver() {
        if (observer) return;
        observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;

                    // Hide targeted UI elements
                    SELECTORS.forEach(function (sel) {
                        if (node.matches && node.matches(sel)) {
                            node.classList.add(HIDE_CLASS);
                        }
                        if (node.querySelectorAll) {
                            node.querySelectorAll(sel).forEach(function (el) {
                                el.classList.add(HIDE_CLASS);
                            });
                        }
                    });

                    // Expand any accordion panels in the new node
                    if (node.querySelectorAll) {
                        if (node.querySelector('.collapse')) {
                            expandAccordions(node);
                            lockAccordions(node);
                        }
                    }
                });
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function stopObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    /* ── Apply focus mode in this frame ── */
    function applyFocusMode(active) {
        if (active) {
            hideAll();
            expandAccordions();
            lockAccordions();
            startObserver();
        } else {
            stopObserver();
            showAll();
            unlockAccordions();
            collapseAccordions();
        }
        if (IS_TOP) {
            updateBadge(active);
            setActive(active);
            broadcastToFrames(active);
        }
    }

    function toggleFocusMode() {
        applyFocusMode(!isActive());
    }

    /* ── Cross-frame messaging ── */

    // Top frame → broadcast current state to all child frames
    function broadcastToFrames(active) {
        var msg = { atiAction: active ? 'focusOn' : 'focusOff' };
        for (var i = 0; i < window.frames.length; i++) {
            try { window.frames[i].postMessage(msg, '*'); } catch (e) {}
        }
    }

    // Top frame listens for iframes requesting current state or requesting a toggle
    function listenForFrameQueries() {
        window.addEventListener('message', function (e) {
            if (!e.data) return;
            if (e.data.atiQuery === 'getState' && e.source) {
                try {
                    e.source.postMessage(
                        { atiAction: isActive() ? 'focusOn' : 'focusOff' },
                        '*'
                    );
                } catch (err) {}
            }
            // Iframe keyboard shortcut forwards here to trigger a real toggle
            if (e.data.atiQuery === 'toggle') {
                toggleFocusMode();
            }
        });
    }

    // Iframe listens for commands from the top frame
    function listenForCommands() {
        window.addEventListener('message', function (e) {
            if (!e.data) return;
            if (e.data.atiAction === 'focusOn')  applyFocusMode(true);
            if (e.data.atiAction === 'focusOff') applyFocusMode(false);
        });
    }

    /* ── Badge (top frame only) ── */
    function createBadge() {
        if (document.getElementById(BADGE_ID)) return;
        var badge = document.createElement('button');
        badge.id          = BADGE_ID;
        badge.type        = 'button';
        badge.title       = 'Toggle ATI Focus Mode (Option+H)';
        badge.className   = 'badge-inactive';
        badge.textContent = 'Focus OFF  [⌥H]';
        badge.addEventListener('click', toggleFocusMode);
        document.body.appendChild(badge);
    }

    function updateBadge(active) {
        var badge = document.getElementById(BADGE_ID);
        if (!badge) return;
        badge.textContent = active ? 'Focus ON  [⌥H]' : 'Focus OFF  [⌥H]';
        badge.className   = active ? 'badge-active' : 'badge-inactive';
    }

    /* ── Keyboard shortcut (top frame) ── */
    function bindShortcut() {
        document.addEventListener('keydown', function (e) {
            if (e.altKey && e.code === 'KeyH') {
                e.preventDefault();
                toggleFocusMode();
            }
        });
    }

    /* ── Keyboard shortcut (iframe) — forwards to top frame ── */
    function bindIframeShortcut() {
        document.addEventListener('keydown', function (e) {
            if (e.altKey && e.code === 'KeyH') {
                e.preventDefault();
                window.parent.postMessage({ atiQuery: 'toggle' }, '*');
            }
        });
    }

    /* ── Init ── */
    function init() {
        if (IS_TOP) {
            createBadge();
            bindShortcut();
            listenForFrameQueries();
            if (isActive()) {
                applyFocusMode(true);
            }
            console.log('[ATI Focus Mode] Ready. Press Option+H (⌥H) or click the badge.');
        } else {
            // Iframe: listen for toggle commands, bind shortcut to message parent,
            // then ask the top frame for current state
            listenForCommands();
            bindIframeShortcut();
            window.parent.postMessage({ atiQuery: 'getState' }, '*');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
