/* ============================================================
   votyer highlight — tiny syntax highlighter for votyer code.
   Usage: element.innerHTML = VotyerHighlight(source)
   or add data-highlight to a <pre>/<script> and site.js does it.
   ============================================================ */
(function () {
  'use strict';

  var KEYWORDS = /^(game|map|palette|water|item|enemy|exit|rules|on|if|else|let|repeat|wait|true|false|and|or|not|take|hit|reach|start|tick|win|lose|touch|all|taken|dead|wall|bump|items|left|count|random|enter)$/;
  var PROPS = /^(say|sound|shake|unlock|heal|hurt|spawn|log|char|shape|color|value|glow|pickup|speed|sight|hp|damage|locked|sky|floor|fog|fogcolor|turn|fov|sensitivity|size|minimap|texture|ceiling|stars|detail|title|wave|reflect|water|enter)$/;

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function VotyerHighlight(src) {
    var out = '';
    var i = 0;
    var n = src.length;

    function isDigit(c) { return c >= '0' && c <= '9'; }
    function isIdent(c) { return /[A-Za-z0-9_]/.test(c); }

    while (i < n) {
      var ch = src[i];

      // comments
      if (ch === '/' && src[i + 1] === '/') {
        var end = src.indexOf('\n', i);
        if (end === -1) end = n;
        out += '<span class="tok-com">' + esc(src.slice(i, end)) + '</span>';
        i = end;
        continue;
      }
      if (ch === '/' && src[i + 1] === '*') {
        var end2 = src.indexOf('*/', i + 2);
        end2 = end2 === -1 ? n : end2 + 2;
        out += '<span class="tok-com">' + esc(src.slice(i, end2)) + '</span>';
        i = end2;
        continue;
      }

      // strings
      if (ch === '"' || ch === "'") {
        var j = i + 1;
        while (j < n && src[j] !== ch) { if (src[j] === '\\') j++; j++; }
        j = Math.min(j + 1, n);
        out += '<span class="tok-str">' + esc(src.slice(i, j)) + '</span>';
        i = j;
        continue;
      }

      // colors
      if (ch === '#' && /[0-9a-fA-F]/.test(src[i + 1] || '')) {
        var k = i + 1;
        while (k < n && /[0-9a-fA-F]/.test(src[k]) && k - i <= 9) k++;
        out += '<span class="tok-color">' + esc(src.slice(i, k)) + '</span>';
        i = k;
        continue;
      }

      // numbers
      if (isDigit(ch)) {
        var m = i;
        while (m < n && /[0-9.]/.test(src[m])) m++;
        out += '<span class="tok-num">' + esc(src.slice(i, m)) + '</span>';
        i = m;
        continue;
      }

      // identifiers / keywords
      if (/[A-Za-z_]/.test(ch)) {
        var w = i;
        while (w < n && isIdent(src[w])) w++;
        var word = src.slice(i, w);
        if (KEYWORDS.test(word)) out += '<span class="tok-kw">' + esc(word) + '</span>';
        else if (PROPS.test(word)) out += '<span class="tok-prop">' + esc(word) + '</span>';
        else out += esc(word);
        i = w;
        continue;
      }

      out += esc(ch);
      i++;
    }
    return out;
  }

  window.VotyerHighlight = VotyerHighlight;

  /* ---- E# highlighter (for .e# snippets on the site) ---- */
  var E_SECTIONS = /^(site|theme|nav|hero|features|work|stats|quote|game|code|contact|footer|section)$/;
  function ESharpHighlight(src) {
    var out = '';
    var i = 0;
    var n = src.length;
    while (i < n) {
      var ch = src[i];
      if (ch === '/' && src[i + 1] === '/') {
        var end = src.indexOf('\n', i); if (end === -1) end = n;
        out += '<span class="tok-com">' + esc(src.slice(i, end)) + '</span>';
        i = end; continue;
      }
      if (ch === '`' && src.slice(i, i + 3) === '```') {
        var fe = src.indexOf('\n', i); if (fe === -1) fe = n;
        out += '<span class="tok-kw">' + esc(src.slice(i, fe)) + '</span>';
        i = fe; continue;
      }
      if (ch === '"' || ch === "'") {
        var j = i + 1;
        while (j < n && src[j] !== ch) { if (src[j] === '\\') j++; j++; }
        j = Math.min(j + 1, n);
        out += '<span class="tok-str">' + esc(src.slice(i, j)) + '</span>';
        i = j; continue;
      }
      if (ch === '#' && /[0-9a-fA-F]/.test(src[i + 1] || '')) {
        var k = i + 1;
        while (k < n && /[0-9a-fA-F]/.test(src[k]) && k - i <= 7) k++;
        out += '<span class="tok-color">' + esc(src.slice(i, k)) + '</span>';
        i = k; continue;
      }
      if (/[0-9]/.test(ch)) {
        var m = i;
        while (m < n && /[0-9.]/.test(src[m])) m++;
        out += '<span class="tok-num">' + esc(src.slice(i, m)) + '</span>';
        i = m; continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        var w = i;
        while (w < n && /[A-Za-z0-9_-]/.test(src[w])) w++;
        var word = src.slice(i, w);
        if (E_SECTIONS.test(word)) out += '<span class="tok-kw">' + esc(word) + '</span>';
        else out += esc(word);
        i = w; continue;
      }
      out += esc(ch);
      i++;
    }
    return out;
  }
  window.ESharpHighlight = ESharpHighlight;
})();
