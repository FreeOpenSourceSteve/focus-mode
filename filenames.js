/* ATI save-name suggestions. Local DOM reads only; no observers or requests. */
(function () {
    'use strict';

    if (window !== window.top || location.hostname !== 'lms.atitesting.com') return;

    const ROWS = 'app-branch-link > mat-list-item.branch-link, app-leaf-link > mat-list-item.leaf-link';
    var lastGeneratedTitle = '';

    function clean(text) {
        return (text || '').replace(/\s+/g, ' ').trim();
    }

    function filenamePart(text) {
        return clean(text).replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-')
            .replace(/[. ]+$/, '');
    }

    function letters(index) {
        var result = '';
        for (var n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
            result = String.fromCharCode(65 + (n - 1) % 26) + result;
        }
        return result;
    }

    function isParent(row) {
        return row.getElementsByClassName('nav-list-item__drillicon').length > 0 ||
            hasChildRegion(row.parentElement);
    }

    function hasChildRegion(host) {
        for (var child = host.firstElementChild; child; child = child.nextElementSibling) {
            if (child.classList.contains('branch-link__children')) return true;
        }
        return false;
    }

    function directRow(host) {
        for (var child = host.firstElementChild; child; child = child.nextElementSibling) {
            if (child.tagName === 'MAT-LIST-ITEM' &&
                (child.classList.contains('branch-link') || child.classList.contains('leaf-link'))) return child;
        }
        return null;
    }

    function label(row) {
        var text = row.querySelector('.leaf-link-text .matline, .complete-menu-align');
        return clean(text ? text.textContent :
            (row.getAttribute('aria-label') || '').replace(/\s+Navigation$/i, ''));
    }

    function getEntry(preferredRow) {
        var nav = document.querySelector('mat-sidenav.lms-sidenav app-nav-links > mat-nav-list');
        if (!nav) return null;
        var selected;
        if (preferredRow) {
            if (!nav.contains(preferredRow) || !preferredRow.matches(ROWS) || isParent(preferredRow)) return null;
            selected = preferredRow;
        } else {
            var active = Array.from(nav.querySelectorAll(
                'mat-list-item.leaf-link.nav-list-item__open, mat-list-item.branch-link.nav-list-item__open, ' +
                'mat-list-item[aria-current="page"], mat-list-item[aria-selected="true"]'
            )).filter(function (row) { return row.matches(ROWS) && !isParent(row); });
            if (active.length !== 1) return null;
            selected = active[0];
        }
        var targetHost = selected.parentElement;
        while (targetHost && targetHost.parentElement !== nav) targetHost = targetHost.parentElement;
        if (!targetHost) return null;
        var group = -1;
        var standalone = false;
        var standaloneIndex = 0;
        var hosts = Array.from(nav.children);

        // Read top-level boundaries only. Children of earlier groups are not
        // counted, inspected, expanded, or fetched.
        for (var i = 0; i < hosts.length; i++) {
            var host = hosts[i];
            if ((host.tagName !== 'APP-BRANCH-LINK' && host.tagName !== 'APP-LEAF-LINK') ||
                host.hidden || (host.hasAttribute('style') && host.style.display === 'none')) continue;
            var row = directRow(host);
            if (!row) continue;
            var courseIndex;
            if (isParent(row)) {
                group++;
                standalone = false;
                if (host !== targetHost) continue;
                var descendants = Array.from(host.querySelectorAll(ROWS)).filter(function (item) { return item !== row; });
                // Unexpected nesting stays in the outer group. If a nested
                // parent's children are absent, use the ordinary filename
                // rather than guess a position or trigger extra actions.
                if (descendants.some(function (item) {
                    return isParent(item) && !hasChildRegion(item.parentElement);
                })) return null;
                courseIndex = descendants.filter(function (item) { return !isParent(item); }).indexOf(selected);
            } else {
                if (!standalone) {
                    group++;
                    standalone = true;
                    standaloneIndex = 0;
                }
                courseIndex = standaloneIndex++;
                if (host !== targetHost) continue;
            }
            if (courseIndex < 0) return null;
            return { row: selected, code: letters(group) + String(courseIndex).padStart(2, '0') };
        }
        return null;
    }

    function refresh(preferredRow) {
        var module = document.querySelector('.blue-header .bheader-space > div[fxflex] > span[aria-label]') ||
            document.querySelector('.module-item.module-active');
        var product = document.querySelector('app-white-hearder .header-lbl-section .withoutbold');
        var moduleName = filenamePart(module && module.textContent);
        var productName = filenamePart(product && product.textContent);
        if (!moduleName || !productName) return;
        var base = moduleName + ' - ' + productName;
        var entry = getEntry(preferredRow);
        var course = entry ? filenamePart(label(entry.row)) : '';
        var title = course ? entry.code + ' - ' + course + ' - ' + base : base;
        // Without a valid course, only undo a filename this feature generated.
        // Do not overwrite another title supplied by ATI or by the user.
        if (!course && document.title !== lastGeneratedTitle) return;
        if (document.title !== title) document.title = title;
        lastGeneratedTitle = course ? title : '';
    }

    function onNavigation(event) {
        if (event.type === 'keyup' && event.key !== 'Enter' && event.key !== ' ') return;
        var target = event.target;
        if (!target || !target.closest || target.closest('button')) return;
        var row = target.closest('mat-list-item.leaf-link, mat-list-item.branch-link');
        if (!row || !row.closest('mat-sidenav.lms-sidenav app-nav-links') ||
            row.getAttribute('aria-disabled') === 'true' || isParent(row)) return;
        refresh(row);
    }

    // Passive reactions to the user's existing workflow. No synthetic clicks,
    // timers, message exchange, mutation listeners, or platform API calls.
    document.addEventListener('click', onNavigation);
    document.addEventListener('keyup', onNavigation);
    document.addEventListener('ati-focus-mode-on', function () { refresh(); });
    document.addEventListener('load', function (event) {
        if (event.target.matches && event.target.matches('iframe.childiframe')) refresh();
    }, true);
    document.addEventListener('keydown', function (event) {
        if ((event.metaKey || event.ctrlKey) && (event.code === 'KeyP' || event.code === 'KeyS')) refresh();
    });
    window.addEventListener('beforeprint', function () { refresh(); });
    window.addEventListener('pageshow', function () { refresh(); });
    refresh();
})();
