/*!
 *  ███████╗██╗  ██╗
 *  ██╔════╝██║  ██║   E#.js — the site-building language.
 *  █████╗  ███████║   Write a .e# file, get a complete, polished
 *  ██╔══╝  ██╔════║   HTML5 website — and embed votyer.js games
 *  ██║     ██║     ║   right inside it. All the languages, together.
 *  ╚═╝     ╚═╝     ╚═╝
 *
 *  E# compiles to pure HTML + CSS + JS. No build step, no framework:
 *
 *    <script src="esharp.js"></script>
 *    <script type="text/esharp" data-target="#preview">
 *      site "My Page" {
 *        theme { accent #7c6cff  bg #0b0d17 }
 *        hero  { title "Hello, web."  galaxy on }
 *      }
 *    </script>
 *
 *  API: ESharp.compile(source) -> { ok, html, errors }
 *  License: MIT — build beautiful things.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ESharp = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.2.0';
  var VOTYER_CDN = 'https://gefrus112.github.io/votyer/votyer.js';

  function EError(msg, line) {
    var e = new Error(line ? ('line ' + line + ': ' + msg) : msg);
    e.isESharp = true;
    return e;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ================================================================
   *  PARSER — .e# source -> site model
   *  site "Title" { section { key args... | repeated keys | ```fences``` } }
   * ================================================================ */
  function parse(src) {
    var lines = src.split('\n');
    var i = 0;
    var model = { title: 'E# site', sections: [] };

    function skipBlank() {
      while (i < lines.length) {
        var t = lines[i].trim();
        if (t === '' || t.slice(0, 2) === '//') i++;
        else break;
      }
    }
    function fail(expected) {
      var at = i < lines.length ? ('line ' + (i + 1) + ': "' + lines[i].trim() + '"') : 'end of file';
      throw EError('expected ' + expected + ' but found ' + at, i + 1);
    }
    // tokenize args on a line: "strings"  #colors  numbers  bare-words
    function args(rest, lineNo) {
      var out = [];
      var k = 0;
      rest = rest.trim();
      while (k < rest.length) {
        var c = rest[k];
        if (c === ' ' || c === '\t') { k++; continue; }
        if (c === '"' || c === "'") {
          var q = c, s = '';
          k++;
          while (k < rest.length && rest[k] !== q) {
            if (rest[k] === '\\' && k + 1 < rest.length) { s += rest[k + 1]; k += 2; }
            else s += rest[k++];
          }
          if (k >= rest.length) throw EError('unterminated string', lineNo);
          k++;
          out.push({ t: 'str', v: s });
        } else if (c === '#') {
          var h = '';
          k++;
          while (k < rest.length && /[0-9a-fA-F]/.test(rest[k]) && h.length < 8) { h += rest[k]; k++; }
          out.push({ t: 'color', v: '#' + h });
        } else {
          var w = '';
          while (k < rest.length && rest[k] !== ' ' && rest[k] !== '\t') { w += rest[k]; k++; }
          out.push({ t: 'word', v: w });
        }
      }
      return out;
    }

    skipBlank();
    // header: site "Title" {
    if (i >= lines.length) throw EError('empty .e# file — start with: site "Title" {', 1);
    var head = lines[i].trim();
    var hm = /^site\s+"([^"]*)"\s*\{/.exec(head);
    if (!hm) throw EError('a .e# file must start with  site "Your Title" {', i + 1);
    model.title = hm[1];
    // anything after the opening brace on the same line gets re-injected as a line
    var rest = head.slice(hm[0].length).trim();
    if (rest) lines.splice(i + 1, 0, rest);
    i++;
    var depth = 1;

    // a new pair starts at a word token when the current pair already has values
    function pushPair(section, key, vals, lineNo) {
      if (!key) throw EError('expected a key before value ' + JSON.stringify(vals), lineNo);
      if (section.kv[key]) section.kv[key].push(vals);
      else section.kv[key] = [vals];
    }
    function groupInline(tokens, section, lineNo) {
      var curKey = null, curVals = null;
      for (var q = 0; q < tokens.length; q++) {
        var tok = tokens[q];
        if (tok.t === 'word' && curKey !== null && curVals.length > 0) {
          pushPair(section, curKey, curVals, lineNo);
          curKey = tok.v; curVals = [];
        } else if (tok.t === 'word' && curKey === null) {
          curKey = tok.v; curVals = [];
        } else if (curKey === null) {
          throw EError('expected a key like  title  before values', lineNo);
        } else {
          curVals.push(tok);
        }
      }
      if (curKey) pushPair(section, curKey, curVals, lineNo);
    }

    while (i < lines.length && depth > 0) {
      skipBlank();
      if (i >= lines.length) fail('}');
      var raw = lines[i];
      var t = raw.trim();

      if (t === '}') { depth--; i++; continue; }

      // section header: name ["label"] {
      var mSec = /^([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+"([^"]*)")?\s*\{/.exec(t);
      if (!mSec) fail('a section like  hero {  or  }');

      // find the matching close brace (string-aware) to support one-line sections
      var scanFrom = mSec[0].length, d = 1, k = scanFrom, inStr = null, closed = false;
      while (k < t.length) {
        var cc = t[k];
        if (inStr) {
          if (cc === '\\') k++;
          else if (cc === inStr) inStr = null;
        } else if (cc === '"' || cc === "'") inStr = cc;
        else if (cc === '{') d++;
        else if (cc === '}') { d--; if (d === 0) { closed = true; break; } }
        k++;
      }
      if (inStr) throw EError('unterminated string in section header', i + 1);

      var section = { name: mSec[1], label: mSec[2] || null, line: i + 1, kv: {}, fences: [] };
      model.sections.push(section);

      if (closed) {
        // one-line section: parse the inline body now
        var bodyText = t.slice(scanFrom, k).trim();
        var restLine = t.slice(k + 1).trim();
        if (bodyText) groupInline(args(bodyText, i + 1), section, i + 1);
        if (restLine) lines.splice(i + 1, 0, restLine);
        i++;
        continue;
      }

      i++;
      // read the section body
      while (i < lines.length) {
        var braw = lines[i];
        var bt = braw.trim();
        if (bt === '}') { i++; break; }
        if (bt === '') { i++; continue; }
        if (bt.slice(0, 2) === '//') { i++; continue; }
        // fenced code block
        if (bt.slice(0, 3) === '```') {
          var lang = bt.slice(3).trim() || 'text';
          i++;
          var buf = [];
          while (i < lines.length && lines[i].trim().slice(0, 3) !== '```') { buf.push(lines[i]); i++; }
          if (i >= lines.length) throw EError('unterminated ``` fence', i + 1);
          i++;
          section.fences.push({ lang: lang, code: buf.join('\n') });
          continue;
        }
        var kv = /^([a-zA-Z_][a-zA-Z0-9_-]*)\s*(.*)$/.exec(bt);
        if (!kv) fail('a  key value  line, a ``` fence, or }');
        var key = kv[1];
        var vals = args(kv[2], i + 1);
        if (section.kv[key]) section.kv[key].push(vals);   // repeated keys -> list
        else section.kv[key] = [vals];
        i++;
      }
    }

    if (!model.sections.length) throw EError('no sections found — try hero { title "Hi" }', 1);
    return model;
  }

  /* ================================================================
   *  BUILT-IN VOTYER GAME PRESETS  (embedded by  game { preset ... })
   * ================================================================ */
  var GAME_PRESETS = {
    'water-temple': [
      'game "Water Temple" {',
      '    size 900 520',
      '    sky #0b1026',
      '    floor #3a3230',
      '    fog 0.5',
      '    fogcolor #0d1524',
      '    ceiling off',
      '}',
      'water { color #1a6f92  wave 0.55  reflect 0.7 }',
      'map {',
      '    "############"',
      '    "#P...~~....#"',
      '    "#.##.~~.##..#"',
      '    "#..c.~~..c..#"',
      '    "#.##.~~.##..#"',
      '    "#...C~.....G#"',
      '    "############"',
      '}',
      'item "coin" { char "c" shape coin color #fbbf24 value 10',
      '    on take { score += 10  sound blip } }',
      'item "gem" { char "C" shape crystal color #5eead4 value 50',
      '    on take { score += 50  sound pickup  say "The temple gem!" } }',
      'exit { char "G" color #8b5cf6 locked on }',
      'rules {',
      '    on enter water { sound splash }',
      '    on all items taken { unlock exit }',
      '    on reach exit { win }',
      '}',
      'on start { say "Swim the temple. Gather everything." }'
    ].join('\n'),
    'crystal-quest': [
      'game "Crystal Quest" {',
      '    size 900 520',
      '    sky #101426',
      '    floor #3d2b1f',
      '    fog 0.45',
      '}',
      'map {',
      '    "############"',
      '    "#P...#.....#"',
      '    "#.#C.#.###.#"',
      '    "#...#.G.#..#"',
      '    "############"',
      '}',
      'item "gem" { char "C" shape crystal color #5eead4 value 50',
      '    on take { score += 50  sound pickup  say "Gem secured!" } }',
      'exit { char "G" color #8b5cf6 locked on }',
      'rules {',
      '    on all items taken { unlock exit }',
      '    on reach exit { win }',
      '}',
      'on start { say "Find the gem. Reach the portal." }'
    ].join('\n')
  };

  /* ================================================================
   *  MINI HIGHLIGHTER  (for the code section)
   * ================================================================ */
  var HL_KW = /^(game|map|palette|water|item|enemy|exit|rules|on|if|else|let|repeat|wait|true|false|and|or|not|const|function|return|class|site|theme|nav|hero|features|work|stats|quote|code|contact|footer|import|from|export|def|print)$/;
  function hlBlock(code, lang) {
    var out = '';
    var i = 0, n = code.length;
    function escSeg(s) { return esc(s); }
    while (i < n) {
      var ch = code[i];
      if (ch === '/' && code[i + 1] === '/') {
        var e1 = code.indexOf('\n', i); if (e1 === -1) e1 = n;
        out += '<span class="eh-com">' + escSeg(code.slice(i, e1)) + '</span>';
        i = e1; continue;
      }
      if (ch === '<' && lang === 'html') {
        var e2 = code.indexOf('>', i); e2 = e2 === -1 ? n : e2 + 1;
        out += '<span class="eh-tag">' + escSeg(code.slice(i, e2)) + '</span>';
        i = e2; continue;
      }
      if (ch === '"' || ch === "'") {
        var j = i + 1;
        while (j < n && code[j] !== ch) { if (code[j] === '\\') j++; j++; }
        j = Math.min(j + 1, n);
        out += '<span class="eh-str">' + escSeg(code.slice(i, j)) + '</span>';
        i = j; continue;
      }
      if (ch === '#' && /[0-9a-fA-F]/.test(code[i + 1] || '')) {
        var k = i + 1;
        while (k < n && /[0-9a-fA-F]/.test(code[k]) && k - i <= 7) k++;
        out += '<span class="eh-col">' + escSeg(code.slice(i, k)) + '</span>';
        i = k; continue;
      }
      if (/[0-9]/.test(ch)) {
        var m = i;
        while (m < n && /[0-9.]/.test(code[m])) m++;
        out += '<span class="eh-num">' + escSeg(code.slice(i, m)) + '</span>';
        i = m; continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        var w = i;
        while (w < n && /[A-Za-z0-9_]/.test(code[w])) w++;
        var word = code.slice(i, w);
        if (HL_KW.test(word)) out += '<span class="eh-kw">' + esc(word) + '</span>';
        else out += esc(word);
        i = w; continue;
      }
      out += esc(ch);
      i++;
    }
    return out;
  }

  /* ================================================================
   *  RENDERER — site model -> complete standalone HTML
   * ================================================================ */
  function val(list, idx, fallback) {
    if (!list || !list.length) return fallback;
    var v = list[0][idx || 0];
    return v ? v.v : fallback;
  }
  function allVals(list, idx) {
    var out = [];
    (list || []).forEach(function (row) { if (row[idx]) out.push(row[idx].v); });
    return out;
  }
  function colorOf(tok, fallback) {
    return tok && /^#[0-9a-fA-F]{3,8}$/.test(tok) ? tok : (fallback || '#7c6cff');
  }

  function render(model) {
    var get = {};
    model.sections.forEach(function (s) { (get[s.name] = get[s.name] || []).push(s); });
    function one(name) { return (get[name] || [])[0]; }

    var theme = one('theme') || { kv: {} };
    var accent = colorOf(val(theme.kv.accent, 0), '#7c6cff');
    var accent2 = colorOf(val(theme.kv.accent2, 0), '#22d3ee');
    var bg = colorOf(val(theme.kv.bg, 0), '#0b0d17');
    var mode = val(theme.kv.mode, 0, 'dark') === 'light' ? 'light' : 'dark';
    var font = val(theme.kv.font, 0, 'Inter');

    var nav = one('nav');
    var hero = one('hero');
    var body = [];

    // ---------- nav ----------
    if (nav) {
      var links = allVals(nav.kv.link, 0);
      var hrefs = allVals(nav.kv.link, 1);
      var cta = nav.kv.cta && nav.kv.cta[0];
      var lh = '';
      links.forEach(function (L, ix) {
        lh += '<a href="' + esc(hrefs[ix] || '#') + '">' + esc(L) + '</a>';
      });
      body.push('<nav class="es-nav"><div class="es-nav-in">' +
        '<a class="es-brand" href="#top">' + esc(val(nav.kv.brand, 0, model.title)) + '</a>' +
        '<div class="es-links">' + lh + '</div>' +
        (cta ? '<a class="es-btn es-btn-sm" href="' + esc(cta[1] ? cta[1].v : '#') + '">' + esc(cta[0].v) + '</a>' : '') +
        '</div></nav>');
    }

    // ---------- hero ----------
    if (hero) {
      var galaxy = val(hero.kv.galaxy, 0, 'on') !== 'off';
      var btns = (hero.kv.button || []).map(function (b) {
        return '<a class="es-btn' + (b === (hero.kv.button || [])[0] ? ' es-btn-primary' : ' es-btn-ghost') + '" href="' + esc(b[1] ? b[1].v : '#') + '">' + esc(b[0].v) + '</a>';
      }).join('');
      body.push(
        '<header class="es-hero"' + (galaxy ? ' data-galaxy' : '') + ' id="top">' +
        (galaxy ? '<canvas class="es-galaxy" aria-hidden="true"></canvas>' : '') +
        '<div class="es-hero-in">' +
        (hero.kv.kicker ? '<div class="es-kicker">' + esc(val(hero.kv.kicker, 0)) + '</div>' : '') +
        '<h1 class="es-title">' + esc(val(hero.kv.title, 0, model.title)) + '</h1>' +
        (hero.kv.sub ? '<p class="es-sub">' + esc(val(hero.kv.sub, 0)) + '</p>' : '') +
        '<div class="es-ctas">' + btns + '</div>' +
        '</div></header>');
    }

    // ---------- sections ----------
    model.sections.forEach(function (s) {
      if (['theme', 'nav', 'hero'].indexOf(s.name) !== -1) return;

      if (s.name === 'features') {
        var cards = (s.kv.item || s.kv.feature || []).map(function (f) {
          return '<div class="es-card es-reveal"><div class="es-card-dot"></div><h3>' + esc(f[0].v) + '</h3><p>' + esc(f[1] ? f[1].v : '') + '</p></div>';
        }).join('');
        body.push(secShell(s, '<div class="es-grid3">' + cards + '</div>'));
        return;
      }

      if (s.name === 'work') {
        var cards2 = (s.kv.project || []).map(function (p2, ix) {
          var c1 = colorOf(p2[2] ? p2[2].v : null, accent);
          var c2 = colorOf(p2[3] ? p2[3].v : null, accent2);
          return '<a class="es-proj es-reveal" href="#" style="--pc1:' + c1 + ';--pc2:' + c2 + ';animation-delay:' + (ix * 60) + 'ms">' +
            '<div class="es-proj-art"></div><h3>' + esc(p2[0].v) + '</h3><p>' + esc(p2[1] ? p2[1].v : '') + '</p></a>';
        }).join('');
        body.push(secShell(s, '<div class="es-grid2">' + cards2 + '</div>'));
        return;
      }

      if (s.name === 'stats') {
        var st = (s.kv.stat || []).map(function (x) {
          return '<div class="es-stat es-reveal"><b>' + esc(x[0].v) + '</b><span>' + esc(x[1] ? x[1].v : '') + '</span></div>';
        }).join('');
        body.push('<div class="es-stats"><div class="es-stats-in">' + st + '</div></div>');
        return;
      }

      if (s.name === 'quote') {
        body.push('<section class="es-sec"><blockquote class="es-quote es-reveal"><p>&ldquo;' +
          esc(val(s.kv.text, 0, '')) + '</p><cite>' + esc(val(s.kv.by, 0, '')) + '</cite></blockquote></section>');
        return;
      }

      if (s.name === 'game') {
        var preset = val(s.kv.preset, 0, 'water-temple');
        var src = GAME_PRESETS[preset] || GAME_PRESETS['water-temple'];
        var fence = s.fences && s.fences[0];
        if (fence) src = fence.code;
        var gid = 'es-game-' + Math.floor(Math.random() * 1e6);
        // load a local votyer.js when available (playground / repo pages),
        // fall back to the CDN copy so exported .e# pages work anywhere
        var boot = '<script src="votyer.js" onerror="(function(){var s=document.createElement(\'script\');s.src=\'' + VOTYER_CDN + '\';document.head.appendChild(s);})();"><\/script>';
        body.push(secShell(s,
          '<div class="es-game-wrap es-reveal"><canvas id="' + gid + '" width="900" height="520" aria-label="votyer game"></canvas></div>' +
          boot +
          '<script type="text/votyer" data-canvas="#' + gid + '">' + src.replace(/<\/script/gi, '<\\/script') + '<\/script>'));
        return;
      }

      if (s.name === 'code') {
        var fence2 = s.fences && s.fences[0];
        var codeSrc = fence2 ? fence2.code : '';
        var lang = fence2 ? fence2.lang : 'text';
        var fname = val(s.kv.title, 0, 'snippet.' + lang);
        body.push(secShell(s,
          '<div class="es-code es-reveal"><div class="es-code-head"><span class="es-dot d1"></span><span class="es-dot d2"></span><span class="es-dot d3"></span>' +
          '<span class="es-code-name">' + esc(fname) + '</span></div>' +
          '<pre>' + hlBlock(codeSrc, lang) + '</pre></div>'));
        return;
      }

      if (s.name === 'contact') {
        var rows = [];
        ['email', 'github', 'linkedin', 'twitter', 'web'].forEach(function (k) {
          if (s.kv[k]) {
            var v = s.kv[k][0];
            var txt = v[0] ? v[0].v : '';
            var href = k === 'email' ? ('mailto:' + txt) : (/^https?:/.test(txt) ? txt : '#');
            rows.push('<a class="es-btn es-btn-ghost" href="' + esc(href) + '">' + esc(k) + '</a>');
          }
        });
        (s.kv.button || []).forEach(function (b) {
          rows.push('<a class="es-btn es-btn-primary" href="' + esc(b[1] ? b[1].v : '#') + '">' + esc(b[0].v) + '</a>');
        });
        body.push(secShell(s, '<div class="es-ctas">' + rows.join('') + '</div>'));
        return;
      }

      if (s.name === 'footer') {
        body.push('<footer class="es-footer">' + esc(val(s.kv.text, 0, '')) +
          (s.fences && s.fences[0] ? '' : '') + '</footer>');
        return;
      }

      // generic text section
      if (s.kv.text) {
        body.push(secShell(s, s.kv.text.map(function (t) {
          return '<p class="es-p es-reveal">' + esc(t[0].v) + '</p>';
        }).join('')));
      }
    });

    function secShell(s, inner) {
      var id = '';
      if (s.label) id = ' id="' + esc(s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')) + '"';
      var title = s.kv && s.kv.title ? '<h2 class="es-h2 es-reveal">' + esc(val(s.kv.title, 0, s.label || '')) + '</h2>' : (s.label ? '<h2 class="es-h2 es-reveal">' + esc(s.label) + '</h2>' : '');
      return '<section class="es-sec"' + id + '>' + title + inner + '</section>';
    }

    return fullDocument(model, { accent: accent, accent2: accent2, bg: bg, mode: mode, font: font }, body.join('\n'));
  }

  var GALAXY_JS = [
    '(function(){',
    ' var cv=document.querySelector(".es-galaxy"); if(!cv) return;',
    ' var g=cv.getContext("2d"),W,H,px=[],mx=-9e3,my=-9e3,mvx=0,mvy=0;',
    ' function rs(){W=cv.width=cv.offsetWidth*1;H=cv.height=cv.offsetHeight*1;}',
    ' rs(); addEventListener("resize",rs);',
    ' for(var i=0;i<520;i++){var arm=i%3,r=Math.pow(Math.random(),0.62)*Math.min(W,H)*0.52+14;',
    '  var a=arm*2.094+r*0.016+(Math.random()-0.5)*0.55;',
    '  px.push({r:r,a:a,sp:0.12+26/(r+30),ox:0,oy:0,vx:0,vy:0,s:0.6+Math.random()*1.7,tw:Math.random()*6.28,',
    '   c:r<Math.min(W,H)*0.16?"255,224,170":(r<Math.min(W,H)*0.34?"179,156,255":"110,231,255")});}',
    ' cv.addEventListener("mousemove",function(e){var b=cv.getBoundingClientRect();var nx=e.clientX-b.left,ny=e.clientY-b.top;',
    '  mvx=nx-mx;mvy=ny-my;mx=nx;my=ny;});',
    ' cv.addEventListener("mouseleave",function(){mx=-9e3;my=-9e3;});',
    ' var cx=0,cy=0,t=0;',
    ' function frame(){t+=0.016;cx=W/2;cy=H*0.5;g.clearRect(0,0,W,H);',
    '  for(var i=0;i<px.length;i++){var p=px[i];p.a+=p.sp*0.016;',
    '   var hx=cx+Math.cos(p.a)*p.r,hy=cy+Math.sin(p.a)*p.r*0.62;',
    '   var dx=hx+p.ox-mx,dy=hy+p.oy-my,d2=dx*dx+dy*dy;',
    '   if(d2<32400){var d=Math.sqrt(d2)+0.01,f=(1-d/180);p.vx+=dx/d*f*2.2+mvx*0.14*f;p.vy+=dy/d*f*2.2+mvy*0.14*f;}',
    '   p.vx+=-(p.ox)*0.028;p.vy+=-(p.oy)*0.028;p.vx*=0.9;p.vy*=0.9;p.ox+=p.vx;p.oy+=p.vy;',
    '   var tw=0.5+0.5*Math.sin(t*2+p.tw),al=0.25+0.75*tw;',
    '   g.fillStyle="rgba("+p.c+","+(al*0.9).toFixed(3)+")";',
    '   g.fillRect(hx+p.ox-p.s/2,hy+p.oy-p.s/2,p.s,p.s);}',
    '  mvx*=0.82;mvy*=0.82;requestAnimationFrame(frame);}',
    ' frame();',
    '})();'
  ].join('\n');

  function fullDocument(model, th, bodyHtml) {
    var light = th.mode === 'light';
    return '<!DOCTYPE html>\n<!-- generated by E# (esharp.js) v' + VERSION + ' — a site-building language -->\n' +
      '<html lang="en">\n<head>\n<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>' + esc(model.title) + '</title>\n' +
      '<meta name="description" content="' + esc(val((model.sections.filter(function (s) { return s.name === 'hero'; })[0] || { kv: {} }).kv.sub, 0, model.title)) + '">\n' +
      '<style>\n' + css(th) + '\n</style>\n</head>\n<body>\n' + bodyHtml +
      '\n<script>\n' +
      '/* reveal on scroll */\n' +
      '(function(){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});},{threshold:0.14});' +
      'document.querySelectorAll(".es-reveal").forEach(function(el){io.observe(el);});})();\n' +
      (hasGalaxy(bodyHtml) ? GALAXY_JS + '\n' : '') +
      '<\/script>\n</body>\n</html>';
  }

  function hasGalaxy(html) { return html.indexOf('es-galaxy') !== -1; }

  function css(th) {
    var light = th.mode === 'light';
    var fg = light ? '#161926' : '#f2f4ff';
    var dim = light ? 'rgba(22,25,38,0.62)' : 'rgba(226,232,255,0.62)';
    var card = light ? 'rgba(20,24,40,0.05)' : 'rgba(255,255,255,0.045)';
    var line = light ? 'rgba(20,24,40,0.12)' : 'rgba(255,255,255,0.09)';
    var bg = th.bg;
    return [
      '*{margin:0;padding:0;box-sizing:border-box}',
      'html{scroll-behavior:smooth}',
      'body{background:' + bg + ';color:' + fg + ';font-family:' + th.font + ',-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6;overflow-x:hidden}',
      'a{color:inherit;text-decoration:none}',
      '.es-nav{position:fixed;top:0;left:0;right:0;z-index:50;backdrop-filter:blur(14px);background:color-mix(in srgb,' + bg + ' 72%,transparent);border-bottom:1px solid ' + line + '}',
      '.es-nav-in{max-width:1120px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;gap:26px}',
      '.es-brand{font-weight:800;letter-spacing:0.06em;font-size:15px;background:linear-gradient(90deg,' + th.accent + ',' + th.accent2 + ');-webkit-background-clip:text;background-clip:text;color:transparent}',
      '.es-links{display:flex;gap:22px;margin-left:auto;font-size:14px;color:' + dim + '}',
      '.es-links a:hover{color:' + fg + '}',
      '.es-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 22px;border-radius:12px;font-weight:600;font-size:14.5px;border:1px solid ' + line + ';transition:transform .18s ease,box-shadow .18s ease,background .18s ease}',
      '.es-btn:hover{transform:translateY(-2px)}',
      '.es-btn-sm{padding:8px 16px;border-radius:10px}',
      '.es-btn-primary{background:linear-gradient(120deg,' + th.accent + ',' + th.accent2 + ');color:#fff;border:none;box-shadow:0 8px 26px color-mix(in srgb,' + th.accent + ' 38%,transparent)}',
      '.es-btn-ghost{color:' + fg + ';background:' + card + '}',
      '.es-hero{position:relative;min-height:92vh;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;border-bottom:1px solid ' + line + '}',
      '.es-galaxy{position:absolute;inset:0;width:100%;height:100%}',
      '.es-hero-in{position:relative;z-index:1;max-width:860px;padding:120px 24px 80px}',
      '.es-kicker{display:inline-block;font-size:12px;letter-spacing:0.22em;font-weight:700;color:' + dim + ';border:1px solid ' + line + ';border-radius:99px;padding:8px 16px;margin-bottom:26px;background:' + card + '}',
      '.es-title{font-size:clamp(40px,7vw,74px);line-height:1.05;font-weight:800;letter-spacing:-0.02em;background:linear-gradient(100deg,' + fg + ' 20%,' + th.accent2 + ' 60%,' + th.accent + ');-webkit-background-clip:text;background-clip:text;color:transparent}',
      '.es-sub{margin:22px auto 34px;max-width:560px;font-size:18px;color:' + dim + '}',
      '.es-ctas{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}',
      '.es-sec{max-width:1120px;margin:0 auto;padding:96px 24px}',
      '.es-h2{font-size:clamp(26px,4vw,38px);font-weight:800;letter-spacing:-0.01em;margin-bottom:40px;text-align:center}',
      '.es-p{max-width:640px;margin:0 auto 18px;color:' + dim + ';font-size:16.5px}',
      '.es-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}',
      '.es-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}',
      '.es-card{background:' + card + ';border:1px solid ' + line + ';border-radius:18px;padding:26px;transition:transform .2s ease,border-color .2s ease}',
      '.es-card:hover{transform:translateY(-4px);border-color:color-mix(in srgb,' + th.accent + ' 55%,transparent)}',
      '.es-card-dot{width:10px;height:10px;border-radius:50%;background:linear-gradient(120deg,' + th.accent + ',' + th.accent2 + ');margin-bottom:16px;box-shadow:0 0 14px color-mix(in srgb,' + th.accent + ' 70%,transparent)}',
      '.es-card h3{font-size:17px;margin-bottom:8px}',
      '.es-card p{font-size:14.5px;color:' + dim + '}',
      '.es-proj{position:relative;display:block;background:' + card + ';border:1px solid ' + line + ';border-radius:18px;overflow:hidden;transition:transform .2s ease}',
      '.es-proj:hover{transform:translateY(-5px)}',
      '.es-proj-art{height:150px;background:radial-gradient(120% 160% at 20% 0%,var(--pc1),var(--pc2) 70%,transparent);opacity:0.9}',
      '.es-proj h3{padding:18px 22px 0;font-size:17px}',
      '.es-proj p{padding:6px 22px 22px;font-size:14px;color:' + dim + '}',
      '.es-stats{border-top:1px solid ' + line + ';border-bottom:1px solid ' + line + ';background:' + card + '}',
      '.es-stats-in{max-width:900px;margin:0 auto;padding:44px 24px;display:flex;justify-content:space-around;flex-wrap:wrap;gap:26px}',
      '.es-stat{text-align:center}',
      '.es-stat b{display:block;font-size:34px;font-weight:800;background:linear-gradient(120deg,' + th.accent + ',' + th.accent2 + ');-webkit-background-clip:text;background-clip:text;color:transparent}',
      '.es-stat span{font-size:13px;color:' + dim + ';letter-spacing:0.06em;text-transform:uppercase}',
      '.es-quote{max-width:680px;margin:0 auto;text-align:center}',
      '.es-quote p{font-size:clamp(20px,3vw,27px);font-weight:600;line-height:1.45}',
      '.es-quote cite{display:block;margin-top:18px;font-style:normal;font-size:14px;color:' + dim + '}',
      '.es-game-wrap{border:1px solid ' + line + ';border-radius:20px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.5)}',
      '.es-game-wrap canvas{display:block;width:100%;height:auto;cursor:pointer}',
      '.es-code{background:#0a0c16;border:1px solid ' + line + ';border-radius:16px;overflow:hidden;font-family:"SFMono-Regular",Consolas,monospace;font-size:13.5px}',
      '.es-code-head{display:flex;align-items:center;gap:7px;padding:12px 16px;border-bottom:1px solid ' + line + '}',
      '.es-dot{width:10px;height:10px;border-radius:50%}.d1{background:#ff5f57}.d2{background:#febc2e}.d3{background:#28c840}',
      '.es-code-name{margin-left:10px;color:' + dim + ';font-size:12px}',
      '.es-code pre{padding:20px;overflow:auto;line-height:1.65;color:#dbe2ff;white-space:pre}',
      '.eh-kw{color:#c4b5fd}.eh-str{color:#86efac}.eh-num{color:#fca5a5}.eh-com{color:#64748b}.eh-col{color:#67e8f9}.eh-tag{color:#93c5fd}',
      '.es-footer{text-align:center;padding:40px 24px 60px;color:' + dim + ';font-size:13.5px;border-top:1px solid ' + line + '}',
      '.es-reveal{opacity:0;transform:translateY(22px);transition:opacity .7s ease,transform .7s ease}',
      '.es-reveal.in{opacity:1;transform:none}',
      '@media(max-width:720px){.es-links{display:none}}'
    ].join('\n');
  }

  /* ================================================================
   *  PUBLIC API
   * ================================================================ */
  function compile(source) {
    try {
      var model = parse(String(source));
      return { ok: true, html: render(model), errors: [] };
    } catch (err) {
      var msg = (err && err.isESharp) ? err.message : (err && err.message ? err.message : String(err));
      if (!(err && err.isESharp) && typeof console !== 'undefined') console.error('[esharp]', err);
      return { ok: false, html: null, errors: ['E# error — ' + msg] };
    }
  }

  function autoEmbed() {
    if (typeof document === 'undefined') return;
    var scripts = document.querySelectorAll('script[type="text/esharp"]');
    for (var i = 0; i < scripts.length; i++) {
      (function (script) {
        var source = script.textContent || script.innerHTML;
        var sel = script.getAttribute('data-target');
        var r = compile(source);
        if (!sel) return;
        var target = document.querySelector(sel);
        if (!target) return;
        if (r.ok) target.srcdoc = r.html;
        else target.srcdoc = '<pre style="color:#ff6b6b;background:#0a0c16;padding:20px;font-family:monospace">' + esc(r.errors.join('\n')) + '</pre>';
      })(scripts[i]);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoEmbed);
    else autoEmbed();
  }

  return {
    version: VERSION,
    compile: compile,
    parse: parse,
    presets: Object.keys(GAME_PRESETS)
  };
});
