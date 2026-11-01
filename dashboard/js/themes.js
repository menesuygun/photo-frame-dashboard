// Screen-adapted pairs inspired by Sanzo Wada's A Dictionary of Color Combinations.
// Theme selection belongs to this display; family identity colours stay unchanged.
(function () {
  'use strict';
  var A = window.App, key = 'frame-colour-theme';
  var themes = [
    { id: 'classic', name: 'Classic', note: 'The original paper & ink', paper: '#F2EEE6', soft: '#E8E2D5', card: '#FBF9F4', ink: '#111111', secondary: '#3B3934', mute: '#7A756B', line: '#D6CFC0', accent: '#111111' },
    { id: 'indigo', name: 'Indigo & Apricot', note: 'Warm apricot · deep indigo', paper: '#F4D9BC', soft: '#E8C6A2', card: '#FFF0DF', ink: '#243B5A', secondary: '#344966', mute: '#655D59', line: '#CFB79F', accent: '#243B5A' },
    { id: 'pine', name: 'Pine & Cream', note: 'Soft cream · bottle green', paper: '#E8E8D2', soft: '#D8DCC0', card: '#F7F5E7', ink: '#234B3E', secondary: '#3D5747', mute: '#626850', line: '#C1C9AC', accent: '#234B3E' },
    { id: 'rose', name: 'Rose & Olive', note: 'Dusty rose · dark olive', paper: '#EEDAD8', soft: '#DFC5C3', card: '#FAEEEA', ink: '#454B2C', secondary: '#555840', mute: '#71645D', line: '#CEB7B2', accent: '#656D3F' },
    { id: 'ochre', name: 'Ochre & Aubergine', note: 'Golden ochre · deep plum', paper: '#EAD59D', soft: '#DDC184', card: '#FFF1CD', ink: '#4B3148', secondary: '#604C55', mute: '#74604C', line: '#C9B17D', accent: '#4B3148' },
    { id: 'blue', name: 'Powder Blue & Vermilion', note: 'Pale blue · warm vermilion', paper: '#D9E7EA', soft: '#C3D8DE', card: '#EDF5F5', ink: '#293F4B', secondary: '#3D535D', mute: '#5D6D72', line: '#ADC6CD', accent: '#A33D2A' }
  ];
  var selected = 'classic';
  function rgb(hex) { return [1, 3, 5].map(function (n) { return parseInt(hex.slice(n, n + 2), 16); }).join(' '); }
  function apply(id) {
    var theme = themes.find(function (t) { return t.id === id; }) || themes[0];
    selected = theme.id;
    var style = document.documentElement.style;
    var values = { paper: theme.paper, 'paper-2': theme.soft, card: theme.card, ink: theme.ink, 'ink-rgb': rgb(theme.ink), 'ink-2': theme.secondary, mute: theme.mute, line: theme.line, 'theme-accent': theme.accent, 'theme-accent-rgb': rgb(theme.accent) };
    Object.keys(values).forEach(function (name) { style.setProperty('--' + name, values[name]); });
    document.documentElement.dataset.colourTheme = theme.id;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme.paper;
  }
  try { apply(localStorage.getItem(key)); } catch (_) { apply('classic'); }
  A.colourThemeSheet = function () {
    A.sheet('<div class="sheet-pad colour-theme-settings"><div class="label">Appearance</div><h2 class="serif sheet-h">Colour themes</h2><p class="sheet-p">Choose a look for this device. Classic keeps the original colours.</p><div class="colour-theme-grid" role="group" aria-label="Colour theme">' + themes.map(function (t) {
      return '<button class="colour-theme-option" type="button" data-colour-theme="' + t.id + '" aria-pressed="' + (selected === t.id) + '" style="--preview-paper:' + t.paper + ';--preview-card:' + t.card + ';--preview-ink:' + t.ink + ';--preview-accent:' + t.accent + '"><span class="colour-theme-sample" aria-hidden="true"><span class="colour-theme-demo-title">Aa</span><span class="colour-theme-demo-card"></span><span class="colour-theme-dot"></span></span><span class="colour-theme-name">' + t.name + '<span class="colour-theme-selected">Selected</span></span><span class="colour-theme-note">' + t.note + '</span></button>';
    }).join('') + '</div><p class="colour-theme-credit">Five screen-adapted pairs inspired by Sanzo Wada’s <i>A Dictionary of Color Combinations</i>. Family colours stay the same.</p><p class="colour-theme-status" role="status" aria-live="polite"></p><button class="btn btn--solid colour-theme-done" data-close>Done</button></div>', { onMount: function (sheet) {
      sheet.addEventListener('click', function (event) {
        var button = event.target.closest('[data-colour-theme]');
        if (!button) return;
        apply(button.dataset.colourTheme);
        var saved = true;
        try { localStorage.setItem(key, selected); } catch (_) { saved = false; }
        sheet.querySelectorAll('[data-colour-theme]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
        sheet.querySelector('.colour-theme-status').textContent = saved ? 'Theme saved for this device.' : 'Theme applied. This browser could not save it for next time.';
      });
    } });
  };
  window.addEventListener('storage', function (event) { if (event.key === key) apply(event.newValue); });
}());
