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
    const HEADING_ID  = 'ati-focus-course-title';
    const IS_TOP      = window === window.top;
    const BIO_SELECTOR = '.component[data-component-type="biodigital"]';
    const ACCORDION_SELECTOR = '.component[data-component-type="accordion"]';

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
        BIO_SELECTOR,
    ];
    
    var observer = null;
    var focusActive = false;
    var sidebarObserver = null;
    var duplicateArticleHeading = null;
    var hiddenVisualizationAccordions = new WeakSet();

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
        updateVisualizationAccordions([document]);
    }

    function showAll() {
        document.querySelectorAll('.' + HIDE_CLASS).forEach(function (el) {
            el.classList.remove(HIDE_CLASS);
        });
        hiddenVisualizationAccordions = new WeakSet();
    }

    /* Hide only BioDigital instructions, never a generic neighboring accordion. */
    function isVisualizationAccordion(component) {
        var previous = component.previousElementSibling;
        var next = component.nextElementSibling;
        if (!(previous && previous.matches(BIO_SELECTOR)) &&
            !(next && next.matches(BIO_SELECTOR))) return false;

        // A multi-section wrapper must contain ONLY matching instructions.
        // Read header titles, not body text; require a real linked panel.
        var buttons = Array.from(component.querySelectorAll('.btn.action-bar'));
        return buttons.length > 0 && buttons.every(function (button) {
            if (button.closest('.component') !== component) return false;
            var title = button.querySelector('.title');
            var text = title ? normalizeTitle(title.textContent) : '';
            if (!text.startsWith('Explore') || !text.includes('3D visualization')) return false;
            var panelId = button.getAttribute('aria-controls');
            var panel = panelId && component.ownerDocument.getElementById(panelId);
            return !!panel && panel.matches('.collapse') &&
                panel.closest('.component') === component &&
                button.getAttribute('data-target') === '#' + panelId;
        });
    }

    function updateVisualizationAccordions(roots) {
        var candidates = new Set();
        function addComponent(component) {
            if (!component) return;
            if (component.matches(ACCORDION_SELECTOR)) candidates.add(component);
            // Inspect both neighbors, including when BioDigital renders later.
            [component.previousElementSibling, component.nextElementSibling].forEach(function (neighbor) {
                if (neighbor && neighbor.matches(ACCORDION_SELECTOR)) candidates.add(neighbor);
            });
        }
        roots.forEach(function (root) {
            if (!root) return;
            if (root.nodeType === 1) addComponent(root.closest('.component'));
            if (root.querySelectorAll) {
                root.querySelectorAll(ACCORDION_SELECTOR + ', ' + BIO_SELECTOR).forEach(addComponent);
            }
        });
        candidates.forEach(function (component) {
            if (isVisualizationAccordion(component)) {
                component.classList.add(HIDE_CLASS);
                hiddenVisualizationAccordions.add(component);
            } else if (hiddenVisualizationAccordions.has(component)) {
                component.classList.remove(HIDE_CLASS);
                hiddenVisualizationAccordions.delete(component);
            }
        });
    }

    /* ── Article heading: copy text, leaving ATI's title intact ── */
    function normalizeTitle(text) {
        return text.replace(/\s+/g, ' ').trim();
    }

    function getCourseTitle(source) {
        if (!source) return '';
        function read(node) {
            if (node.nodeType === 3) return node.nodeValue;
            if (node.nodeType !== 1) return '';
            // ATI can include desktop/mobile or accessible copies of a label.
            // Ignore hidden descendants, but not the source itself: its toolbar
            // is intentionally hidden by Focus Mode.
            if (node !== source && (node.hidden ||
                node.matches('script, style') || getComputedStyle(node).display === 'none')) return '';
            var parts = Array.from(node.childNodes).map(function (child) {
                return { text: read(child), element: child.nodeType === 1 };
            });
            var labels = parts.filter(function (part) { return normalizeTitle(part.text); });
            // Collapse equivalent sibling ELEMENT labels only. Do not rewrite
            // repeated words in a single title, e.g. "Very Very Important".
            if (labels.length > 1 && labels.every(function (part) {
                return part.element && normalizeTitle(part.text) === normalizeTitle(labels[0].text);
            })) return labels[0].text;
            return parts.map(function (part) { return part.text; }).join('');
        }
        return normalizeTitle(read(source));
    }

    function restoreArticleHeading() {
        if (duplicateArticleHeading) {
            duplicateArticleHeading.classList.remove(HIDE_CLASS);
            duplicateArticleHeading = null;
        }
    }

    function findLeadingArticleHeading(firstComponent, title) {
        var selector = 'h1, h2, h3, h4, h5, h6';
        var previous = firstComponent.previousElementSibling;
        if (previous && previous.id === HEADING_ID) previous = previous.previousElementSibling;
        var containers = previous ? [previous, firstComponent] : [firstComponent];
        for (var i = 0; i < containers.length; i++) {
            var container = containers[i];
            var candidate = container.matches(selector) ? container : container.querySelector(selector);
            if (!candidate || getCourseTitle(candidate) !== title) continue;
            // Only suppress an exact matching LEADING title. A later section
            // heading or other article text must remain visible.
            var preceding = document.createRange();
            preceding.selectNodeContents(container);
            preceding.setEndBefore(candidate === container ? container.firstChild : candidate);
            if (normalizeTitle(preceding.toString())) continue;
            var hidden = candidate.closest('.' + HIDE_CLASS + ', [hidden]');
            if (hidden && hidden !== duplicateArticleHeading) continue;
            return candidate;
        }
        return null;
    }

    function removeCourseHeading() {
        var heading = document.getElementById(HEADING_ID);
        if (heading) heading.remove();
        restoreArticleHeading();
    }

    function addCourseHeading() {
        if (!focusActive) return;
        removeCourseHeading();
        // The content script already runs inside the ATI reader iframe.
        // Read its title locally; cross-origin document access is unnecessary.
        var source = document.querySelector('.course-title');
        var title = getCourseTitle(source);
        var firstComponent = document.querySelector('.component[data-component-type]');
        if (!title || !firstComponent) return;

        var heading = document.createElement('h1');
        heading.id = HEADING_ID;
        heading.textContent = title;
        duplicateArticleHeading = findLeadingArticleHeading(firstComponent, title);
        if (duplicateArticleHeading) duplicateArticleHeading.classList.add(HIDE_CLASS);
        firstComponent.parentNode.insertBefore(heading, firstComponent);
    }

    /* ── Sidebar: one native state change per Focus Mode transition ── */
    function switchSidebar(open) {
        if (window.location.hostname !== 'lms.atitesting.com') return;
        if (sidebarObserver) {
            sidebarObserver.disconnect();
            sidebarObserver = null;
        }

        function applyWhenReady() {
            var sidebar = document.querySelector('mat-sidenav.lms-sidenav');
            if (!sidebar) return false;
            var isOpen = sidebar.classList.contains('mat-drawer-opened');
            var button = document.querySelector('.blue-header button.menu-button');
            if (isOpen !== open && (!button || button.disabled)) return false;

            // Stop waiting BEFORE clicking: later user actions must stay free.
            if (sidebarObserver) {
                sidebarObserver.disconnect();
                sidebarObserver = null;
            }
            if (isOpen !== open) button.click();
            return true;
        }

        if (applyWhenReady()) return;
        // Angular may not have rendered the controls when a saved ON state
        // is restored. Wait only until this one requested action is possible.
        sidebarObserver = new MutationObserver(applyWhenReady);
        sidebarObserver.observe(document.documentElement, {
            childList: true, subtree: true, attributes: true,
            attributeFilter: ['class', 'disabled']
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
            var visualizationRoots = new Set();
            mutations.forEach(function (mutation) {
                // Recheck locally when Angular fills a header/panel or changes
                // sibling order. Attribute/characterData observation is unnecessary.
                var component = mutation.target.nodeType === 1 && mutation.target.closest('.component');
                if (component) visualizationRoots.add(component);
                [mutation.previousSibling, mutation.nextSibling].forEach(function (sibling) {
                    // Angular comments/whitespace do not break element adjacency.
                    if (!sibling) return;
                    var previous = sibling;
                    var next = sibling;
                    while (previous && previous.nodeType !== 1) previous = previous.previousSibling;
                    while (next && next.nodeType !== 1) next = next.nextSibling;
                    if (previous) visualizationRoots.add(previous);
                    if (next) visualizationRoots.add(next);
                });
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    visualizationRoots.add(node);

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
            updateVisualizationAccordions(visualizationRoots);
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
        var changed = focusActive !== active;
        focusActive = active;
        if (active) {
            hideAll();
            expandAccordions();
            lockAccordions();
            if (changed) addCourseHeading();
            startObserver();
        } else {
            stopObserver();
            showAll();
            unlockAccordions();
            collapseAccordions();
            removeCourseHeading();
        }
        // The LMS owns the navigation; reader-frame state messages never
        // toggle it again. Repeated state replies are also harmless.
        if (IS_TOP && changed) {
            switchSidebar(!active);
            // Let the independent filename module read the current page once.
            if (active) document.dispatchEvent(new Event('ati-focus-mode-on'));
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
