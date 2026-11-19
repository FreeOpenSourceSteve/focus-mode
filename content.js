/**
 * ATI Time Hider — content.js
 *
 * Runs in both the top frame (lms.atitesting.com) and the embedded
 * iframe (pages-delivery.atitesting.com) thanks to all_frames: true
 * in manifest.json.
 *
 * Only the top frame creates the Check/toggle controls and main shortcut.
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
    const CHECK_ID    = 'ati-focus-check';
    const CONTROLS_ID = 'ati-focus-controls';
    const ATI_ORIGINS = new Set(['https://lms.atitesting.com', 'https://pages-delivery.atitesting.com']);
    const HEADING_ID  = 'ati-focus-course-title';
    const IS_TOP      = window === window.top;
    const BIO_SELECTOR = '.component[data-component-type="biodigital"]';
    const ACCORDION_SELECTOR = '.component[data-component-type="accordion"]';
    const REFERENCE_HIDE_CLASS = 'ati-hidden-reference-accordion';

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
        '.asc-vm-avatar-image',
        '._pendo-badge-image',
        '[data-_pendo-image-1]',
        'button[data-layout="badgeResourceCenter"]',
    ];
    
    // Separate ownership prevents one preference from restoring fixed targets.
    const TARGETS = {
        hideVideos: { selector: '.component[data-component-type="video"]', hideClass: 'ati-hidden-video' },
        hideVisualizations: { selector: BIO_SELECTOR, hideClass: 'ati-hidden-visualization' },
        hidePracticeQuestions: { selector: '.content-question', hideClass: 'ati-hidden-question' },
        hideImages: { selector: '.content-image', hideClass: 'ati-hidden-image' }
    };
    const HIDDEN_SELECTOR = '.' + HIDE_CLASS + ', .' + REFERENCE_HIDE_CLASS + ', ' + Object.keys(TARGETS).map(function (key) {
        return '.' + TARGETS[key].hideClass;
    }).join(', ');
    var targetPreferences = { hideVideos: true, hideVisualizations: true, hidePracticeQuestions: true, hideImages: true };
    var preferencesReady = false;
    var pendingFocusActive = null;
    var preparedQuestionInputs = new WeakSet();

    // Browser-internal storage only: preferences never pass through ATI messages.
    function loadTargetPreferences() {
        var initialReadFinished = false;
        var earlyChanges = {};
        chrome.storage.onChanged.addListener(function (changes, area) {
            if (area !== 'local') return;
            Object.keys(TARGETS).forEach(function (key) {
                if (!Object.prototype.hasOwnProperty.call(changes, key)) return;
                var value = changes[key].newValue;
                targetPreferences[key] = typeof value === 'boolean' ? value : true;
                if (!initialReadFinished) earlyChanges[key] = targetPreferences[key];
                if (focusActive) {
                    applyTargetPreference(key, document);
                    if (key === 'hideVisualizations') updateVisualizationAccordions([document]);
                }
                if (key === 'hidePracticeQuestions') {
                    updateQuestionLayout();
                }
            });
            document.dispatchEvent(new Event('ati-focus-layout-change'));
        });
        return chrome.storage.local.get(targetPreferences).then(function (saved) {
            Object.keys(TARGETS).forEach(function (key) {
                targetPreferences[key] = Object.prototype.hasOwnProperty.call(earlyChanges, key) ?
                    earlyChanges[key] : (typeof saved[key] === 'boolean' ? saved[key] : true);
            });
        }).catch(function (error) {
            console.warn('[ATI Focus Mode] Could not load target preferences; using defaults.', error);
        }).then(function () { initialReadFinished = true; });
    }

    function applyTargetPreference(key, root) {
        var target = TARGETS[key];
        var hidden = focusActive && targetPreferences[key];
        if (root.matches && root.matches(target.selector)) root.classList.toggle(target.hideClass, hidden);
        root.querySelectorAll(target.selector).forEach(function (element) {
            element.classList.toggle(target.hideClass, hidden);
        });
    }

    function updateQuestionLayout() {
        document.documentElement.classList.toggle('ati-focus-questions-visible',
            focusActive && !targetPreferences.hidePracticeQuestions);
    }

    function prefillFreeTextQuestions(root) {
        if (!focusActive || targetPreferences.hidePracticeQuestions || !root) return;
        var selector = '.content-question app-freetext .question-body textarea:not(:disabled)';
        var inputs = [];
        if (root.matches && root.matches(selector)) inputs.push(root);
        if (root.querySelectorAll) inputs.push.apply(inputs, root.querySelectorAll(selector));
        inputs.forEach(function (input) {
            if (!input.isConnected || input.readOnly || preparedQuestionInputs.has(input)) return;
            // Initialize once per editable textarea, respecting existing drafts
            // and later edits/clears. Notify the form once so its own validation
            // can update Submit; never force-enable or click that button.
            preparedQuestionInputs.add(input);
            if (input.value === '') {
                input.value = 'SHOW ANSWER';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }

    var focusActive = false;
    var pendingSidebarState = null;
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
        Object.keys(TARGETS).forEach(function (key) { applyTargetPreference(key, document); });
        updateVisualizationAccordions([document]);
        updateReferenceAccordions([document]);
    }

    function showAll() {
        document.querySelectorAll(HIDDEN_SELECTOR).forEach(function (el) {
            el.classList.remove(HIDE_CLASS);
            el.classList.remove(REFERENCE_HIDE_CLASS);
            Object.keys(TARGETS).forEach(function (key) { el.classList.remove(TARGETS[key].hideClass); });
        });
        hiddenVisualizationAccordions = new WeakSet();
    }

    /* Match header titles, never body text or article-specific generated IDs. */
    function updateReferenceAccordions(roots) {
        var candidates = new Set();
        roots.forEach(function (root) {
            if (!root) return;
            var element = root.nodeType === 1 ? root : root.parentElement;
            // Include outer accordions when a nested component is updated.
            while (element) {
                var component = element.closest(ACCORDION_SELECTOR);
                if (!component) break;
                candidates.add(component);
                element = component.parentElement;
            }
            if (root.querySelectorAll) root.querySelectorAll(ACCORDION_SELECTOR).forEach(function (component) {
                candidates.add(component);
            });
        });
        candidates.forEach(function (component) {
            component.classList.remove(REFERENCE_HIDE_CLASS);
            component.querySelectorAll('.' + REFERENCE_HIDE_CLASS).forEach(function (element) {
                // Nested accordion components manage their own hiding.
                if (element.closest(ACCORDION_SELECTOR) === component) {
                    element.classList.remove(REFERENCE_HIDE_CLASS);
                }
            });
            if (!focusActive) return;
            var buttons = Array.from(component.querySelectorAll('.btn.action-bar')).filter(function (button) {
                return button.closest('.component') === component;
            });
            var matched = buttons.map(function (button) {
                var title = button.querySelector('.title');
                var text = title ? normalizeTitle(title.textContent) : '';
                if (text !== 'Legal' && text !== 'Credits') return false;
                var card = button.closest('.card');
                var panelId = button.getAttribute('aria-controls');
                var panel = panelId && component.ownerDocument.getElementById(panelId);
                if (!card || card.closest('.component') !== component || !panel ||
                    !panel.matches('.collapse') || !card.contains(panel) ||
                    panel.closest('.component') !== component ||
                    button.getAttribute('data-target') !== '#' + panelId) return false;
                card.classList.add(REFERENCE_HIDE_CLASS);
                return true;
            });
            // Hide the wrapper only if every section is a matching reference section.
            // Mixed accordions retain their other cards and content.
            if (matched.length && matched.every(function (value) { return value; })) {
                component.classList.add(REFERENCE_HIDE_CLASS);
            }
        });
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
        var hideClass = TARGETS.hideVisualizations.hideClass;
        if (!focusActive || !targetPreferences.hideVisualizations) {
            document.querySelectorAll(ACCORDION_SELECTOR + '.' + hideClass).forEach(function (component) {
                component.classList.remove(hideClass);
            });
            hiddenVisualizationAccordions = new WeakSet();
            return;
        }
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
                component.classList.add(hideClass);
                hiddenVisualizationAccordions.add(component);
            } else if (hiddenVisualizationAccordions.has(component)) {
                component.classList.remove(hideClass);
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
            var hidden = candidate.closest(HIDDEN_SELECTOR + ', [hidden]');
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

    /* One sidebar attempt per transition/check; never wait on DOM changes. */
    function applyPendingSidebar() {
        if (pendingSidebarState === null || location.hostname !== 'lms.atitesting.com') return;
        var sidebar = document.querySelector('mat-sidenav.lms-sidenav');
        if (!sidebar) return;
        var isOpen = sidebar.classList.contains('mat-drawer-opened');
        var button = document.querySelector('.blue-header button.menu-button');
        if (isOpen !== pendingSidebarState && (!button || button.disabled)) return;
        var open = pendingSidebarState;
        pendingSidebarState = null;
        if (isOpen !== open) button.click();
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

    /* One bounded pass. No observers, timers or automatic retries. */
    function runFocusCheck() {
        if (!preferencesReady || !focusActive) return;
        updateQuestionLayout();
        prefillFreeTextQuestions(document);
        hideAll();
        expandAccordions();
        lockAccordions();
        addCourseHeading();
        applyPendingSidebar();
        document.dispatchEvent(new Event('ati-focus-layout-change'));
    }

    function checkPage() {
        if (!focusActive) return;
        runFocusCheck();
        sendFrameCommand('check');
        var status = document.getElementById('ati-focus-check-status');
        if (status) {
            status.textContent = 'Check requested at ' + new Date().toLocaleTimeString();
            status.hidden = false;
        }
    }

    /* ── Apply focus mode in this frame ── */
    function applyFocusMode(active) {
        // Commands received during the asynchronous read use saved preferences.
        if (!preferencesReady) {
            pendingFocusActive = active;
            return;
        }
        var changed = focusActive !== active;
        // A reader can receive both its initial state reply and a broadcast.
        // Only actual transitions run a check; explicit Check always runs once.
        if (!changed) return;
        focusActive = active;
        if (IS_TOP && changed) pendingSidebarState = !active;
        if (active) {
            runFocusCheck();
        } else {
            updateQuestionLayout();
            showAll();
            unlockAccordions();
            collapseAccordions();
            removeCourseHeading();
            applyPendingSidebar();
            document.dispatchEvent(new Event('ati-focus-layout-change'));
        }
        // The LMS owns the navigation; reader-frame state messages never
        // toggle it again. Repeated state replies are also harmless.
        if (IS_TOP && changed) {
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
        applyFocusMode(!(pendingFocusActive === null ? isActive() : pendingFocusActive));
    }

    /* ── Cross-frame messaging ── */

    function readerOrigin(frame) {
        try {
            var origin = new URL(frame.src, location.href).origin;
            return ATI_ORIGINS.has(origin) ? origin : null;
        } catch (error) { return null; }
    }

    function sendFrameCommand(action) {
        document.querySelectorAll('iframe').forEach(function (frame) {
            var origin = readerOrigin(frame);
            if (origin && frame.contentWindow) {
                frame.contentWindow.postMessage({ atiAction: action }, origin);
            }
        });
    }

    function broadcastToFrames(active) {
        sendFrameCommand(active ? 'focusOn' : 'focusOff');
    }

    var parentOrigin = null;
    var pendingParentToggles = 0;

    function resolveParentOrigin() {
        // The first ancestor is the immediate parent, not necessarily the LMS.
        var ancestors = location.ancestorOrigins;
        if (ancestors && ancestors.length && ancestors[0] !== 'null') {
            return ATI_ORIGINS.has(ancestors[0]) ? ancestors[0] : null;
        }
        try {
            var origin = new URL(document.referrer).origin;
            return ATI_ORIGINS.has(origin) ? origin : null;
        } catch (error) { return null; }
    }

    function postToParent(message) {
        parentOrigin = parentOrigin || resolveParentOrigin();
        if (parentOrigin) {
            window.parent.postMessage(message, parentOrigin);
        } else if (message.atiQuery === 'toggle') {
            // A validated initial state will establish the route before replay.
            pendingParentToggles++;
        }
    }

    function sendInitialFrameState(frame) {
        var origin = readerOrigin(frame);
        if (!origin || !frame.contentWindow) return;
        frame.contentWindow.postMessage({
            atiAction: (pendingFocusActive === null ? isActive() : pendingFocusActive) ? 'focusOn' : 'focusOff'
        }, origin);
    }

    // Top frame listens for iframes requesting current state or requesting a toggle
    function listenForFrameQueries() {
        // One state handshake per frame load also covers hidden referrers.
        // Capture load events so dynamically inserted readers need no observer.
        document.addEventListener('load', function (e) {
            if (e.target.tagName === 'IFRAME') sendInitialFrameState(e.target);
        }, true);
        window.addEventListener('message', function (e) {
            if (!e.data || !ATI_ORIGINS.has(e.origin) ||
                !Array.from(document.querySelectorAll('iframe')).some(function (frame) {
                    return readerOrigin(frame) === e.origin && frame.contentWindow === e.source;
                })) return;
            if (e.data.atiQuery === 'getState' && e.source) {
                try {
                    e.source.postMessage(
                        { atiAction: (pendingFocusActive === null ? isActive() : pendingFocusActive) ? 'focusOn' : 'focusOff' },
                        e.origin
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
            if (!e.data || !ATI_ORIGINS.has(e.origin) || e.source !== window.parent) return;
            if (!['focusOn', 'focusOff', 'check'].includes(e.data.atiAction)) return;
            parentOrigin = e.origin;
            if (e.data.atiAction === 'focusOn')  applyFocusMode(true);
            if (e.data.atiAction === 'focusOff') applyFocusMode(false);
            if (e.data.atiAction === 'check') runFocusCheck();
            if (pendingParentToggles) {
                if (e.data.atiAction === 'check') {
                    postToParent({ atiQuery: 'getState' });
                } else {
                    var toggles = pendingParentToggles;
                    pendingParentToggles = 0;
                    for (var n = 0; n < toggles; n++) postToParent({ atiQuery: 'toggle' });
                }
            }
        });
    }

    /* ── Badge (top frame only) ── */
    function createBadge() {
        if (document.getElementById(BADGE_ID)) return;
        var controls = document.createElement('div');
        controls.id = CONTROLS_ID;
        var check = document.createElement('button');
        check.id = CHECK_ID;
        check.type = 'button';
        check.textContent = '♥';
        check.title = 'Run one Focus Mode check';
        check.setAttribute('aria-label', 'Run one Focus Mode check');
        check.disabled = true;
        var badge = document.createElement('button');
        badge.id          = BADGE_ID;
        badge.type        = 'button';
        badge.title       = 'Toggle ATI Focus Mode (Option+H)';
        badge.className   = 'badge-inactive';
        badge.textContent = 'Focus OFF  [⌥H]';
        var status = document.createElement('output');
        status.id = 'ati-focus-check-status';
        status.hidden = true;
        status.setAttribute('role', 'status');
        controls.append(check, badge, status);
        document.body.appendChild(controls);
        window.addEventListener('click', function (event) {
            var button = event.target.closest && event.target.closest('button');
            if ((button !== check && button !== badge) || button.disabled) return;
            // Capture only our controls before the page's document handlers.
            event.preventDefault();
            event.stopImmediatePropagation();
            if (button === check) checkPage();
            else toggleFocusMode();
        }, true);
    }

    function updateBadge(active) {
        var badge = document.getElementById(BADGE_ID);
        if (!badge) return;
        badge.textContent = active ? 'Focus ON  [⌥H]' : 'Focus OFF  [⌥H]';
        badge.className   = active ? 'badge-active' : 'badge-inactive';
        var check = document.getElementById(CHECK_ID);
        if (check) check.disabled = !active;
        var status = document.getElementById('ati-focus-check-status');
        if (status) status.hidden = true;
    }

    /* ── Keyboard shortcut (top frame) ── */
    function bindShortcut() {
        document.addEventListener('keydown', function (e) {
            if (e.altKey && e.code === 'KeyH') {
                e.preventDefault();
                if (e.repeat) return;
                toggleFocusMode();
            }
        });
    }

    /* ── Keyboard shortcut (iframe) — forwards to top frame ── */
    function bindIframeShortcut() {
        document.addEventListener('keydown', function (e) {
            if (e.altKey && e.code === 'KeyH') {
                e.preventDefault();
                if (e.repeat) return;
                postToParent({ atiQuery: 'toggle' });
            }
        });
    }

    /* ── Init ── */
    function init() {
        if (IS_TOP) {
            createBadge();
            bindShortcut();
            listenForFrameQueries();
            // Window load covers readers that finished before our load listener.
            // Wait for load: an unfinished iframe may still have its initial origin.
            window.addEventListener('load', function () {
                document.querySelectorAll('iframe').forEach(sendInitialFrameState);
            }, { once: true });
            console.log('[ATI Focus Mode] Ready. Press Option+H (⌥H) or click the badge.');
        } else {
            // Iframe: listen for toggle commands, bind shortcut to message parent,
            // then ask the top frame for current state
            listenForCommands();
            bindIframeShortcut();
            postToParent({ atiQuery: 'getState' });
        }
        loadTargetPreferences().then(function () {
            preferencesReady = true;
            if (pendingFocusActive !== null) {
                var active = pendingFocusActive;
                pendingFocusActive = null;
                applyFocusMode(active);
            } else if (IS_TOP && isActive()) {
                applyFocusMode(true);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
