(function () {
    'use strict';

    const DEFAULTS = { hideVideos: true, hideVisualizations: true, hidePracticeQuestions: true };
    var preferences = Object.assign({}, DEFAULTS);
    var buttons = Array.from(document.querySelectorAll('button[data-key]'));
    var initialReadFinished = false;
    var earlyChanges = {};

    function render(button) {
        var hidden = preferences[button.dataset.key];
        button.querySelector('.state').textContent = hidden ? '[HIDDEN]' : '[VISIBLE]';
        button.setAttribute('aria-pressed', String(hidden));
    }

    chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'local') return;
        buttons.forEach(function (button) {
            var key = button.dataset.key;
            if (!Object.prototype.hasOwnProperty.call(changes, key)) return;
            var value = changes[key].newValue;
            preferences[key] = typeof value === 'boolean' ? value : true;
            if (!initialReadFinished) earlyChanges[key] = preferences[key];
            render(button);
        });
    });

    buttons.forEach(function (button) {
        button.addEventListener('click', async function () {
            var key = button.dataset.key;
            button.disabled = true;
            try {
                var hidden = !preferences[key];
                await chrome.storage.local.set({ [key]: hidden });
                preferences[key] = hidden;
                render(button);
                button.removeAttribute('title');
            } catch (error) {
                // Keep the last confirmed value; do not claim a failed save worked.
                button.title = 'Could not save this setting. Click to retry.';
                console.warn('[ATI Focus Mode] Could not save target preference.', error);
            } finally {
                button.disabled = false;
            }
        });
    });

    chrome.storage.local.get(DEFAULTS).then(function (saved) {
        buttons.forEach(function (button) {
            var key = button.dataset.key;
            preferences[key] = Object.prototype.hasOwnProperty.call(earlyChanges, key) ?
                earlyChanges[key] : (typeof saved[key] === 'boolean' ? saved[key] : true);
            render(button);
            button.disabled = false;
        });
    }).catch(function (error) {
        buttons.forEach(function (button) { button.title = 'Could not load settings. Reopen the popup to retry.'; });
        console.warn('[ATI Focus Mode] Could not load target preferences.', error);
    }).finally(function () { initialReadFinished = true; });
})();
