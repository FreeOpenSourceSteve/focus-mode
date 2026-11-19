/* NavSet is local to each ATI document, including the reader iframe.
 * Refresh on user/layout events; no polling or DOM observer is needed. */
(function () {
    'use strict';

    const NAV_ID = 'ati-navset';
    const BUTTONS = [
        { id: 'btn-previous-h1', label: 'Previous ꜛ', level: 'h1', direction: -1 },
        { id: 'btn-previous-h2', label: 'Previous ꜛꜛ', level: 'h2', direction: -1 },
        { id: 'btn-next-h2', label: 'Next ꜜꜜ', level: 'h2', direction: 1 },
        { id: 'btn-next-h1', label: 'Next ꜜ', level: 'h1', direction: 1 },
        { id: 'ati-navset-top', label: '⬆ Top' }
    ];
    var enabled = true;
    var ready = false;
    var scheduled = false;
    var controls;
    var destinations = new Map();

    function scrollContainer(element) {
        for (var parent = element && element.parentElement; parent; parent = parent.parentElement) {
            if (parent === document.scrollingElement) break;
            if (/(auto|scroll|overlay)/.test(getComputedStyle(parent).overflowY) &&
                parent.scrollHeight > parent.clientHeight + 1) return parent;
        }
        return document.scrollingElement;
    }

    function rendered(element) {
        var style = getComputedStyle(element);
        return element.getClientRects().length > 0 &&
            style.visibility !== 'hidden' && style.visibility !== 'collapse';
    }

    function hasReader() {
        return Array.from(document.querySelectorAll('iframe')).some(function (frame) {
            try { return new URL(frame.src, location.href).origin === 'https://pages-delivery.atitesting.com'; }
            catch (error) { return false; }
        });
    }

    function refresh() {
        if (!controls) return;
        destinations.clear();
        if (!ready || !enabled) {
            controls.hidden = true;
            return;
        }

        // The LMS shell must not add a second set over its embedded reader.
        var article = document.querySelector('.component[data-component-type]');
        if (window === window.top && !article && hasReader()) {
            controls.hidden = true;
            return;
        }

        var headings = Array.from(document.querySelectorAll('h1, h2')).filter(rendered);
        var scroller = scrollContainer(article || headings[0] || document.body);
        if (!scroller) {
            controls.hidden = true;
            return;
        }
        var viewportTop = scroller === document.scrollingElement ? 0 :
            scroller.getBoundingClientRect().top + scroller.clientTop;
        var current = scroller.scrollTop;
        var maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        var targets = headings.filter(function (heading) {
            return scrollContainer(heading) === scroller;
        }).map(function (heading) {
            return {
                element: heading,
                top: Math.max(0, Math.min(maximum,
                    heading.getBoundingClientRect().top - viewportTop + current))
            };
        }).sort(function (a, b) { return a.top - b.top; });

        BUTTONS.forEach(function (definition) {
            var button = controls.querySelector('#' + definition.id);
            var target;
            if (definition.level) {
                var sameLevel = targets.filter(function (entry) {
                    return entry.element.localName === definition.level;
                });
                if (definition.level !== 'h1' || sameLevel.length >= 2) {
                    var candidates = sameLevel.filter(function (entry) {
                        return definition.direction * (entry.top - current) > 2;
                    });
                    target = definition.direction > 0 ? candidates[0] : candidates[candidates.length - 1];
                }
            } else if (current > 2) {
                target = { top: 0 };
            }
            button.hidden = !target;
            if (!target) return;
            var text = target.element ? target.element.textContent.replace(/\s+/g, ' ').trim() : 'Top of page';
            if (!text) text = 'Untitled ' + definition.level.toUpperCase() + ' heading';
            button.querySelector('.ati-nav-tooltip').textContent = text;
            button.setAttribute('aria-label', definition.level ?
                (definition.direction > 0 ? 'Next ' : 'Previous ') + definition.level.toUpperCase() + ': ' + text : text);
            destinations.set(definition.id, { scroller: scroller, top: target.top });
        });
        controls.hidden = destinations.size === 0;
    }

    function scheduleRefresh() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(function () {
            scheduled = false;
            refresh();
        });
    }

    function navigate(event) {
        var button = event.target.closest && event.target.closest('button');
        if (!button || !controls.contains(button) || button.disabled) return;
        // Own this click before page-level document handlers can swallow it.
        // Other page buttons and clicks retain their normal event handling.
        event.preventDefault();
        event.stopImmediatePropagation();
        refresh();
        var target = destinations.get(button.id);
        if (!target) return;
        target.scroller.scrollTo({ top: target.top,
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        scheduleRefresh();
    }

    function init() {
        controls = document.createElement('nav');
        controls.id = NAV_ID;
        controls.hidden = true;
        controls.setAttribute('aria-label', 'Article navigation');
        BUTTONS.forEach(function (definition) {
            var button = document.createElement('button');
            button.id = definition.id;
            button.type = 'button';
            button.hidden = true;
            button.appendChild(document.createTextNode(definition.label));
            var tooltip = document.createElement('span');
            tooltip.id = definition.id + '-tooltip';
            tooltip.className = 'ati-nav-tooltip';
            tooltip.setAttribute('role', 'tooltip');
            button.setAttribute('aria-describedby', tooltip.id);
            button.appendChild(tooltip);
            controls.appendChild(button);
        });
        document.body.appendChild(controls);
        // Replace ATI's Top with the matching NavSet Top in both ON and OFF modes.
        // CSS also covers a native button inserted after initial page load.
        document.documentElement.classList.add('ati-navset-ready');
        window.addEventListener('click', navigate, true);
        document.addEventListener('scroll', scheduleRefresh, { capture: true, passive: true });
        document.addEventListener('load', scheduleRefresh, true);
        document.addEventListener('click', scheduleRefresh);
        document.addEventListener('ati-focus-layout-change', scheduleRefresh);
        window.addEventListener('resize', scheduleRefresh);
        window.addEventListener('load', scheduleRefresh);

        var earlyChange = false;
        chrome.storage.onChanged.addListener(function (changes, area) {
            if (area !== 'local' || !Object.prototype.hasOwnProperty.call(changes, 'navSetEnabled')) return;
            enabled = typeof changes.navSetEnabled.newValue === 'boolean' ? changes.navSetEnabled.newValue : true;
            earlyChange = true;
            refresh();
        });
        chrome.storage.local.get({ navSetEnabled: true }).then(function (saved) {
            if (!earlyChange) enabled = typeof saved.navSetEnabled === 'boolean' ? saved.navSetEnabled : true;
        }).catch(function (error) {
            console.warn('[ATI Focus Mode] Could not load NavSet preference; using default.', error);
        }).then(function () {
            ready = true;
            refresh();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
