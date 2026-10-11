/*!
 * ███╗   ██╗ ██████╗ ████████╗██╗   ██╗███████╗██████╗╗
 * ████╗  ██║██╔═══██╗╚══██╔══╝╚██╗ ██╔╝██╔════╝██╔══██╗
 * ██╔██╗ ██║██║   ██║   ██║    ╚████╔╝ █████╗  ██████╔╝
 * ██║╚██╗██║██║   ██║   ██║     ╚██╔╝  ██╔══╝  ██╔══██╗
 * ██║ ╚████║╚██████╔╝   ██║      ██║   ███████╗██║  ██║
 * ╚═╝  ╚═══╝ ╚═════╝    ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝
 *
 *  VOTYER.js — The next-gen language for retro HTML5 games.
 *  One file. Zero dependencies. A whole tiny language + a
 *  retro 3D raycasting engine, sprite system, audio synth,
 *  physics, menus and HUD.
 *
 *  Quick start:
 *    <script src="votyer.js"></script>
 *    <script type="text/votyer">
 *      game "My Game" { size 640 400 }
 *      map {
 *        "########"
 *        "#P.....#"
 *        "########"
 *      }
 *    </script>
 *
 *  Docs & tutorial: https://github.com/gefrus112/votyer
 *  License: MIT — build cool things.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Votyer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  /* ================================================================
   *  ERRORS
   * ================================================================ */
  function VError(message, line, col) {
    var e = new Error(message);
    e.name = 'VotyerError';
    e.isVotyer = true;
    if (line != null) {
      e.message = 'line ' + line + (col != null ? ', col ' + col : '') + ': ' + message;
      e.line = line; e.col = col;
    } else {
      e.message = message;
    }
    return e;
  }

  /* ================================================================
   *  1. LEXER  — turns votyer source text into tokens
   * ================================================================ */
  var KEYWORDS = {
    'game': 1, 'map': 1, 'palette': 1, 'item': 1, 'enemy': 1, 'exit': 1,
    'rules': 1, 'on': 1, 'if': 1, 'else': 1, 'let': 1, 'repeat': 1, 'wait': 1,
    'true': 1, 'false': 1, 'and': 1, 'or': 1, 'not': 1,
    'items': 1, 'left': 1, 'count': 1, 'random': 1, 'enemies': 1,
    'take': 1, 'hit': 1, 'reach': 1, 'start': 1, 'tick': 1, 'win': 1, 'lose': 1,
    'touch': 1, 'all': 1, 'taken': 1, 'dead': 1, 'wall': 1, 'bump': 1
  };

  function isDigit(c) { return c >= '0' && c <= '9'; }
  function isIdentStart(c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_'; }
  function isIdentChar(c) { return isIdentStart(c) || isDigit(c); }
  function isHex(c) {
    return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
  }

  function lex(src) {
    var toks = [];
    var i = 0, line = 1, col = 1;
    var n = src.length;

    while (i < n) {
      var ch = src[i];

      if (ch === '\n') { i++; line++; col = 1; continue; }
      if (ch === ' ' || ch === '\t' || ch === '\r') { i++; col++; continue; }

      // comments
      if (ch === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (ch === '/' && src[i + 1] === '*') {
        i += 2; col += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') { line++; col = 1; } else col++;
          i++;
        }
        if (i >= n) throw VError('unterminated /* comment', line, col);
        i += 2; col += 2;
        continue;
      }

      var l = line, c = col;

      // strings
      if (ch === '"' || ch === "'") {
        var quote = ch;
        i++; col++;
        var s = '';
        while (i < n && src[i] !== quote) {
          if (src[i] === '\\' && i + 1 < n) {
            var esc = src[i + 1];
            s += (esc === 'n') ? '\n' : (esc === 't') ? '\t' : esc;
            i += 2; col += 2;
          } else {
            if (src[i] === '\n') { line++; col = 1; }
            s += src[i]; i++; col++;
          }
        }
        if (i >= n) throw VError('unterminated string', l, c);
        i++; col++;
        toks.push({ t: 'string', v: s, line: l, col: c });
        continue;
      }

      // colors  #rgb #rrggbb #rrggbbaa
      if (ch === '#') {
        var j = i + 1, hex = '';
        while (j < n && hex.length < 8 && isHex(src[j])) { hex += src[j]; j++; }
        if (hex.length === 3 || hex.length === 6 || hex.length === 8) {
          toks.push({ t: 'color', v: '#' + hex, line: l, col: c });
          col += 1 + hex.length; i = j;
          continue;
        }
        throw VError('bad color literal (use #rgb or #rrggbb)', l, c);
      }

      // numbers
      if (isDigit(ch) || (ch === '.' && isDigit(src[i + 1] || ''))) {
        var num = '';
        while (i < n && (isDigit(src[i]) || src[i] === '.')) { num += src[i]; i++; col++; }
        toks.push({ t: 'number', v: parseFloat(num), line: l, col: c });
        continue;
      }

      // identifiers / keywords
      if (isIdentStart(ch)) {
        var id = '';
        while (i < n && isIdentChar(src[i])) { id += src[i]; i++; col++; }
        toks.push({ t: KEYWORDS[id] ? 'kw' : 'ident', v: id, line: l, col: c });
        continue;
      }

      // operators
      var two = src[i] + (src[i + 1] || '');
      if (two === '+=' || two === '-=' || two === '==' || two === '!=' || two === '<=' || two === '>=') {
        toks.push({ t: 'op', v: two, line: l, col: c });
        i += 2; col += 2;
        continue;
      }
      if ('{}(),=<>+-*/'.indexOf(ch) !== -1) {
        toks.push({ t: 'op', v: ch, line: l, col: c });
        i++; col++;
        continue;
      }

      throw VError('unexpected character "' + ch + '"', l, c);
    }

    toks.push({ t: 'eof', v: null, line: line, col: col });
    return toks;
  }

  /* ================================================================
   *  2. PARSER  — turns tokens into an AST
   * ================================================================ */
  function Parser(toks) {
    this.toks = toks;
    this.pos = 0;
  }
  Parser.prototype = {
    peek: function (off) { return this.toks[this.pos + (off || 0)]; },
    next: function () { return this.toks[this.pos++]; },
    at: function (t, v) {
      var tok = this.peek();
      return tok.t === t && (v === undefined || tok.v === v);
    },
    atKw: function (w) { return this.at('kw', w); },
    atOp: function (o) { return this.at('op', o); },
    expectOp: function (o) {
      if (!this.atOp(o)) throw VError('expected "' + o + '" but found ' + this.show(this.peek()), this.peek().line, this.peek().col);
      return this.next();
    },
    expectKw: function (w) {
      if (!this.atKw(w)) throw VError('expected "' + w + '" but found ' + this.show(this.peek()), this.peek().line, this.peek().col);
      return this.next();
    },
    expectString: function (what) {
      if (!this.at('string')) throw VError('expected ' + (what || 'a string') + ' but found ' + this.show(this.peek()), this.peek().line, this.peek().col);
      return this.next().v;
    },
    expectNumber: function () {
      if (!this.at('number')) throw VError('expected a number but found ' + this.show(this.peek()), this.peek().line, this.peek().col);
      return this.next().v;
    },
    show: function (tok) {
      if (tok.t === 'eof') return 'end of file';
      return JSON.stringify(tok.v);
    },

    /* -------- program -------- */
    parseProgram: function () {
      var decls = [];
      while (!this.at('eof')) decls.push(this.parseDecl());
      if (!decls.length) throw VError('empty program — nothing to run', 1, 1);
      return { k: 'Program', decls: decls };
    },

    parseDecl: function () {
      var tok = this.peek();
      if (tok.t === 'kw') {
        switch (tok.v) {
          case 'game': return this.parseGame();
          case 'map': return this.parseMap();
          case 'palette': return this.parsePalette();
          case 'item': return this.parseEntity('item');
          case 'enemy': return this.parseEntity('enemy');
          case 'exit': return this.parseExit();
          case 'rules': return this.parseRules();
          case 'on': return this.parseEvent();
        }
      }
      throw VError('unknown declaration ' + this.show(tok) + ' — expected game / map / palette / item / enemy / exit / rules / on', tok.line, tok.col);
    },

    /* -------- game block -------- */
    parseGame: function () {
      this.expectKw('game');
      var name = this.expectString('a game title string');
      this.expectOp('{');
      var settings = {};
      while (!this.atOp('}')) {
        var tok = this.peek();
        if (tok.t !== 'ident' && tok.t !== 'kw') {
          throw VError('expected a setting name inside game block, found ' + this.show(tok), tok.line, tok.col);
        }
        var key = this.next().v;
        switch (key) {
          case 'size':
            settings.width = this.expectNumber();
            settings.height = this.expectNumber();
            break;
          case 'title':
            settings.title = this.expectString();
            break;
          case 'sky': case 'floor':
            settings[key] = this.parseColorish();
            break;
          case 'fog': case 'speed': case 'turn': case 'fov': case 'sensitivity':
            settings[key] = this.expectNumber();
            break;
          case 'minimap': case 'texture':
            settings[key] = this.parseOnOff();
            break;
          default:
            throw VError('unknown game setting "' + key + '"', tok.line, tok.col);
        }
      }
      this.expectOp('}');
      return { k: 'game', name: name, settings: settings };
    },

    parseColorish: function () {
      var tok = this.peek();
      if (tok.t === 'color') { this.next(); return tok.v; }
      if (tok.t === 'string') { this.next(); return tok.v; }
      throw VError('expected a color like #66ffcc', tok.line, tok.col);
    },
    parseOnOff: function () {
      var tok = this.peek();
      if ((tok.t === 'kw' || tok.t === 'ident') && (tok.v === 'on' || tok.v === 'true')) { this.next(); return true; }
      if ((tok.t === 'kw' || tok.t === 'ident') && (tok.v === 'off' || tok.v === 'false')) { this.next(); return false; }
      throw VError('expected on / off', tok.line, tok.col);
    },

    /* -------- map -------- */
    parseMap: function () {
      this.expectKw('map');
      this.expectOp('{');
      var rows = [];
      while (!this.atOp('}')) {
        if (!this.at('string')) {
          var tok = this.peek();
          throw VError('map rows must be quoted strings, found ' + this.show(tok), tok.line, tok.col);
        }
        rows.push(this.next().v);
      }
      this.expectOp('}');
      if (!rows.length) throw VError('map needs at least one row', 0, 0);
      return { k: 'map', rows: rows };
    },

    /* -------- palette -------- */
    parsePalette: function () {
      this.expectKw('palette');
      this.expectOp('{');
      var map = {};
      while (!this.atOp('}')) {
        var ch = this.expectString('a single wall character');
        var col = this.parseColorish();
        if (ch.length !== 1) throw VError('palette keys must be single characters like "1"', this.peek().line, this.peek().col);
        map[ch] = col;
      }
      this.expectOp('}');
      return { k: 'palette', map: map };
    },

    /* -------- items & enemies -------- */
    parseEntity: function (kind) {
      this.expectKw(kind);
      var name = this.expectString('a ' + kind + ' name string');
      this.expectOp('{');
      var e = {
        k: kind, name: name, char: null, shape: null, color: null,
        value: kind === 'item' ? 10 : undefined, glow: undefined,
        onTake: null, onHit: null,
        speed: undefined, sight: undefined, hp: undefined, damage: undefined
      };
      while (!this.atOp('}')) {
        if (this.atKw('on')) {
          this.next();
          if (kind === 'item' && this.atKw('take')) { this.next(); e.onTake = this.parseBlock(); }
          else if (kind === 'enemy' && this.atKw('hit')) { this.next(); e.onHit = this.parseBlock(); }
          else throw VError('items can have "on take", enemies can have "on hit"', this.peek().line, this.peek().col);
          continue;
        }
        var tok = this.peek();
        if (tok.t !== 'ident') throw VError('expected a property inside ' + kind + ' block, found ' + this.show(tok), tok.line, tok.col);
        var key = this.next().v;
        switch (key) {
          case 'char': e.char = this.expectString('a single map character'); break;
          case 'shape': e.shape = this.expectIdentName('a shape'); break;
          case 'color': e.color = this.parseColorish(); break;
          case 'value': e.value = this.expectNumber(); break;
          case 'glow': e.glow = this.parseOnOff(); break;
          case 'speed': e.speed = this.expectNumber(); break;
          case 'sight': e.sight = this.expectNumber(); break;
          case 'hp': e.hp = this.expectNumber(); break;
          case 'damage': e.damage = this.expectNumber(); break;
          default: throw VError('unknown ' + kind + ' property "' + key + '"', tok.line, tok.col);
        }
      }
      this.expectOp('}');
      return e;
    },

    expectIdentName: function (what) {
      var tok = this.peek();
      if (tok.t !== 'ident' && tok.t !== 'kw') throw VError('expected ' + what + ' name', tok.line, tok.col);
      return this.next().v;
    },

    /* -------- exit -------- */
    parseExit: function () {
      this.expectKw('exit');
      this.expectOp('{');
      var e = { k: 'exit', char: 'G', color: '#8b5cf6', locked: true, onReach: null };
      while (!this.atOp('}')) {
        if (this.atKw('on')) {
          this.next();
          this.expectKw('reach');
          e.onReach = this.parseBlock();
          continue;
        }
        var tok = this.peek();
        if (tok.t !== 'ident') throw VError('expected a property inside exit block, found ' + this.show(tok), tok.line, tok.col);
        var key = this.next().v;
        switch (key) {
          case 'char': e.char = this.expectString('a single map character'); break;
          case 'color': e.color = this.parseColorish(); break;
          case 'locked': e.locked = this.parseOnOff(); break;
          default: throw VError('unknown exit property "' + key + '"', tok.line, tok.col);
        }
      }
      this.expectOp('}');
      return e;
    },

    /* -------- rules -------- */
    parseRules: function () {
      this.expectKw('rules');
      this.expectOp('{');
      var r = { k: 'rules', touchEnemy: null, allItemsTaken: null, reachExit: null, bumpWall: null, enemyDead: null };
      while (!this.atOp('}')) {
        this.expectKw('on');
        var tok = this.peek();
        if (this.atKw('touch')) { this.next(); this.expectKw('enemy'); r.touchEnemy = this.parseBlock(); }
        else if (this.atKw('all')) { this.next(); this.expectKw('items'); this.expectKw('taken'); r.allItemsTaken = this.parseBlock(); }
        else if (this.atKw('reach')) { this.next(); this.expectKw('exit'); r.reachExit = this.parseBlock(); }
        else if (this.atKw('bump')) { this.next(); this.expectKw('wall'); r.bumpWall = this.parseBlock(); }
        else if (this.atKw('enemy')) { this.next(); this.expectKw('dead'); r.enemyDead = this.parseBlock(); }
        else throw VError('unknown rule trigger — use: on touch enemy / on all items taken / on reach exit / on bump wall / on enemy dead', tok.line, tok.col);
      }
      this.expectOp('}');
      return r;
    },

    /* -------- events -------- */
    parseEvent: function () {
      this.expectKw('on');
      var tok = this.peek();
      var name = null;
      if (this.atKw('start')) name = 'start';
      else if (this.atKw('tick')) name = 'tick';
      else if (this.atKw('win')) name = 'win';
      else if (this.atKw('lose')) name = 'lose';
      else throw VError('expected an event name: start / tick / win / lose', tok.line, tok.col);
      this.next();
      var body = this.parseBlock();
      return { k: 'event', name: name, body: body };
    },

    /* -------- blocks & statements -------- */
    parseBlock: function () {
      this.expectOp('{');
      var body = [];
      while (!this.atOp('}')) {
        if (this.at('eof')) throw VError('missing "}" — this block never closes', this.peek().line, this.peek().col);
        body.push(this.parseStmt());
      }
      this.expectOp('}');
      return { k: 'Block', body: body };
    },

    parseStmt: function () {
      var tok = this.peek();

      if (tok.t === 'kw') {
        switch (tok.v) {
          case 'if': return this.parseIf();
          case 'let': {
            this.next();
            var nameTok = this.peek();
            if (nameTok.t !== 'ident') throw VError('expected a variable name after "let"', nameTok.line, nameTok.col);
            this.next();
            this.expectOp('=');
            return { k: 'Let', name: nameTok.v, e: this.parseExpr() };
          }
          case 'repeat': {
            this.next();
            var times = this.parseExpr();
            var body = this.parseBlock();
            return { k: 'Repeat', times: times, body: body };
          }
          case 'wait': {
            this.next();
            var secs = this.parseExpr();
            var wbody = this.parseBlock();
            return { k: 'Wait', secs: secs, body: wbody };
          }
          case 'win': this.next(); return { k: 'Win' };
          case 'lose': this.next(); return { k: 'Lose' };
        }
      }

      if (tok.t === 'ident') {
        var nx = this.peek(1);
        if (nx.t === 'op' && (nx.v === '=' || nx.v === '+=' || nx.v === '-=')) {
          this.next(); this.next();
          return { k: 'Assign', name: tok.v, op: nx.v, e: this.parseExpr() };
        }
        switch (tok.v) {
          case 'say': this.next(); return { k: 'Say', e: this.parseExpr() };
          case 'sound': {
            this.next();
            var sTok = this.peek();
            if (sTok.t !== 'ident' && sTok.t !== 'kw') throw VError('expected a sound name after "sound"', sTok.line, sTok.col);
            this.next();
            return { k: 'Sound', name: sTok.v };
          }
          case 'shake': this.next(); return { k: 'Shake', e: this.parseExpr() };
          case 'unlock': {
            this.next();
            if (!this.atKw('exit')) throw VError('expected "exit" after "unlock"', this.peek().line, this.peek().col);
            this.next();
            return { k: 'UnlockExit' };
          }
          case 'heal': this.next(); return { k: 'Heal', e: this.parseExpr() };
          case 'hurt': this.next(); return { k: 'Hurt', e: this.parseExpr() };
          case 'spawn': {
            this.next();
            var en = this.expectString('an enemy name string');
            var x = this.parseExpr();
            var y = this.parseExpr();
            return { k: 'Spawn', name: en, x: x, y: y };
          }
          case 'log': this.next(); return { k: 'Log', e: this.parseExpr() };
        }
        throw VError('unknown command "' + tok.v + '"', tok.line, tok.col);
      }

      throw VError('expected a command or statement, found ' + this.show(tok), tok.line, tok.col);
    },

    parseIf: function () {
      this.expectKw('if');
      var cond = this.parseExpr();
      var then = this.parseBlock();
      var els = null;
      if (this.atKw('else')) {
        this.next();
        if (this.atKw('if')) els = this.parseIf();
        else els = this.parseBlock();
      }
      return { k: 'If', cond: cond, then: then, else: els };
    },

    /* -------- expressions -------- */
    parseExpr: function () { return this.parseOr(); },
    parseOr: function () {
      var a = this.parseAnd();
      while (this.atKw('or')) { this.next(); a = { k: 'Bin', op: 'or', a: a, b: this.parseAnd() }; }
      return a;
    },
    parseAnd: function () {
      var a = this.parseCmp();
      while (this.atKw('and')) { this.next(); a = { k: 'Bin', op: 'and', a: a, b: this.parseCmp() }; }
      return a;
    },
    parseCmp: function () {
      var a = this.parseAdd();
      var tok = this.peek();
      if (tok.t === 'op' && (tok.v === '==' || tok.v === '!=' || tok.v === '<' || tok.v === '>' || tok.v === '<=' || tok.v === '>=')) {
        this.next();
        return { k: 'Bin', op: tok.v, a: a, b: this.parseAdd() };
      }
      return a;
    },
    parseAdd: function () {
      var a = this.parseMul();
      while (this.atOp('+') || this.atOp('-')) {
        var op = this.next().v;
        a = { k: 'Bin', op: op, a: a, b: this.parseMul() };
      }
      return a;
    },
    parseMul: function () {
      var a = this.parseUnary();
      while (this.atOp('*') || this.atOp('/')) {
        var op = this.next().v;
        a = { k: 'Bin', op: op, a: a, b: this.parseUnary() };
      }
      return a;
    },
    parseUnary: function () {
      if (this.atKw('not')) { this.next(); return { k: 'Not', e: this.parseUnary() }; }
      if (this.atOp('-')) { this.next(); return { k: 'Neg', e: this.parseUnary() }; }
      return this.parsePrimary();
    },
    parsePrimary: function () {
      var tok = this.peek();
      if (tok.t === 'number') { this.next(); return { k: 'Num', v: tok.v }; }
      if (tok.t === 'string') { this.next(); return { k: 'Str', v: tok.v }; }
      if (tok.t === 'color') { this.next(); return { k: 'Color', v: tok.v }; }
      if (tok.t === 'kw') {
        if (tok.v === 'true') { this.next(); return { k: 'Bool', v: true }; }
        if (tok.v === 'false') { this.next(); return { k: 'Bool', v: false }; }
        if (tok.v === 'items') {
          this.next();
          if (this.atKw('left')) { this.next(); return { k: 'ItemsLeft' }; }
          if (this.atKw('count')) {
            this.next();
            var nm = this.expectString('an item name string');
            return { k: 'ItemsCount', name: nm };
          }
          throw VError('expected "left" or "count" after "items"', this.peek().line, this.peek().col);
        }
        if (tok.v === 'enemies') {
          this.next();
          this.expectKw('left');
          return { k: 'EnemiesLeft' };
        }
        if (tok.v === 'random') {
          this.next();
          var max = this.parseAdd();
          return { k: 'Random', e: max };
        }
      }
      if (tok.t === 'ident') { this.next(); return { k: 'Var', name: tok.v }; }
      if (tok.t === 'op' && tok.v === '(') {
        this.next();
        var e = this.parseExpr();
        this.expectOp(')');
        return e;
      }
      throw VError('expected a value, found ' + this.show(tok), tok.line, tok.col);
    }
  };

  /* ================================================================
   *  3. SPEC BUILDER — turns the AST into a game blueprint
   * ================================================================ */
  var DEFAULT_WALL_COLORS = ['#8a8f98', '#7d6a5a', '#6e7f6a', '#7a6f8f'];

  function defaultMapRows() {
    return [
      '#########',
      '#.......#',
      '#...P...#',
      '#.......#',
      '#########'
    ];
  }

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16) || 0;
    var g = parseInt(h.slice(2, 4), 16) || 0;
    var b = parseInt(h.slice(4, 6), 16) || 0;
    return [r, g, b];
  }

  function buildSpec(ast) {
    var spec = {
      title: 'votyer game',
      subtitle: '',
      width: 800, height: 500,
      sky: '#12122a', floor: '#4a3626',
      fog: 0.4, speed: 3.0, turn: 2.6, fov: 66, sens: 0.0022,
      minimap: true, texture: true,
      map: null, palette: {},
      items: {}, enemies: {}, exit: null,
      rules: {}, events: {}
    };

    var decl, i;
    for (i = 0; i < ast.decls.length; i++) {
      decl = ast.decls[i];
      switch (decl.k) {
        case 'game':
          spec.title = decl.settings.title || decl.name;
          spec.subtitle = decl.name;
          if (decl.settings.width) spec.width = decl.settings.width;
          if (decl.settings.height) spec.height = decl.settings.height;
          if (decl.settings.sky) spec.sky = decl.settings.sky;
          if (decl.settings.floor) spec.floor = decl.settings.floor;
          if (decl.settings.fog != null) spec.fog = decl.settings.fog;
          if (decl.settings.speed != null) spec.speed = decl.settings.speed;
          if (decl.settings.turn != null) spec.turn = decl.settings.turn;
          if (decl.settings.fov != null) spec.fov = decl.settings.fov;
          if (decl.settings.sensitivity != null) spec.sens = decl.settings.sensitivity;
          if (decl.settings.minimap != null) spec.minimap = decl.settings.minimap;
          if (decl.settings.texture != null) spec.texture = decl.settings.texture;
          break;
        case 'map': spec.map = decl.rows; break;
        case 'palette': spec.palette = decl.map; break;
        case 'item': spec.items[decl.name] = decl; break;
        case 'enemy': spec.enemies[decl.name] = decl; break;
        case 'exit': spec.exit = decl; break;
        case 'rules': spec.rules = decl; break;
        case 'event': spec.events[decl.name] = decl.body; break;
      }
    }

    if (!spec.map) spec.map = defaultMapRows();

    // Normalize rows to equal length (pad with '.'), validate chars
    var w = 0, r;
    for (i = 0; i < spec.map.length; i++) w = Math.max(w, spec.map[i].length);
    var walkable = { '.': 1, ' ': 1, 'P': 1 };
    var spawnChars = {};
    var itemName, en;
    for (itemName in spec.items) { if (spec.items[itemName].char) { spawnChars[spec.items[itemName].char] = { type: 'item', name: itemName }; walkable[spec.items[itemName].char] = 1; } }
    for (en in spec.enemies) { if (spec.enemies[en].char) { spawnChars[spec.enemies[en].char] = { type: 'enemy', name: en }; walkable[spec.enemies[en].char] = 1; } }
    if (spec.exit && spec.exit.char) { spawnChars[spec.exit.char] = { type: 'exit' }; walkable[spec.exit.char] = 1; }
    spawnChars['P'] = { type: 'player' };  // the spawn tile itself is walkable

    var grid = [];
    for (i = 0; i < spec.map.length; i++) {
      var rowSrc = spec.map[i], row = '';
      for (var x = 0; x < w; x++) {
        var ch = x < rowSrc.length ? rowSrc[x] : '.';
        if (ch === '"' ) ch = '.';
        if (!walkable[ch] && !spec.palette[ch] && ch !== '#') {
          // unknown char: treat as decorative wall — allowed on purpose
        }
        row += ch;
      }
      grid.push(row);
    }
    spec.grid = grid;
    spec.mapW = w;
    spec.mapH = grid.length;
    spec.spawnChars = spawnChars;

    // precompute wall colors per char
    spec.wallColors = {};
    for (var y = 0; y < spec.mapH; y++) {
      for (x = 0; x < spec.mapW; x++) {
        ch = grid[y][x];
        if (!walkable[ch]) {
          if (!spec.wallColors[ch]) {
            var base = spec.palette[ch];
            if (!base) {
              var hsh = 0;
              for (var q = 0; q < ch.length; q++) hsh = (hsh * 31 + ch.charCodeAt(q)) | 0;
              base = DEFAULT_WALL_COLORS[Math.abs(hsh) % DEFAULT_WALL_COLORS.length];
            }
            spec.wallColors[ch] = hexToRgb(base);
          }
        }
      }
    }

    // sanity warnings
    if (spec.exit && spec.exit.char === '#') throw VError('the exit char cannot be "#" — pick another character');
    return spec;
  }

  /* ================================================================
   *  4. RUNTIME — evaluates handler blocks against the engine
   * ================================================================ */
  function Runtime(engine) {
    this.engine = engine;
    this.vars = Object.create(null);
    this.vars.score = 0;
    this.vars.health = 100;
    this.errorCounts = Object.create(null);
  }

  Runtime.prototype.get = function (name, node) {
    if (name in this.vars) return this.vars[name];
    throw VError('unknown variable "' + name + '" — try score, health or time');
  };
  Runtime.prototype.set = function (name, v) { this.vars[name] = v; };

  Runtime.prototype.evalNum = function (node) {
    var v = this.eval(node);
    if (typeof v !== 'number') throw VError('expected a number, got "' + v + '"');
    return v;
  };

  Runtime.prototype.eval = function (node) {
    switch (node.k) {
      case 'Num': case 'Str': case 'Color': case 'Bool': return node.v;
      case 'Var': return this.get(node.name);
      case 'Neg': return -this.evalNum(node.e);
      case 'Not': return !this.eval(node.e);
      case 'ItemsLeft': return this.engine.itemsLeft();
      case 'ItemsCount': return this.engine.itemsCount(node.name);
      case 'EnemiesLeft': return this.engine.enemiesLeft();
      case 'Random': {
        var mx = this.evalNum(node.e);
        return Math.floor(Math.random() * Math.max(1, mx));
      }
      case 'Bin': {
        var op = node.op;
        if (op === 'and') return this.eval(node.a) && this.eval(node.b);
        if (op === 'or') return this.eval(node.a) || this.eval(node.b);
        var a = this.eval(node.a), b = this.eval(node.b);
        switch (op) {
          case '+':
            if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
            return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return b === 0 ? 0 : a / b;
          case '==': return a === b;
          case '!=': return a !== b;
          case '<': return a < b;
          case '>': return a > b;
          case '<=': return a <= b;
          case '>=': return a >= b;
        }
        throw VError('unknown operator "' + op + '"');
      }
    }
    throw VError('cannot evaluate expression "' + node.k + '"');
  };

  Runtime.prototype.execBlock = function (block, handlerId) {
    if (!block) return;
    try {
      this.stmts(block.body);
    } catch (err) {
      this.errorCounts[handlerId] = (this.errorCounts[handlerId] || 0) + 1;
      var msg = 'votyer runtime error (' + handlerId + '): ' + err.message;
      if (typeof console !== 'undefined') console.error('[votyer]', msg);
      this.engine.consoleMsg(msg, true);
      // after 30 repeated errors, disable the handler to protect framerate
      if (this.errorCounts[handlerId] >= 30) {
        this.engine.consoleMsg('handler "' + handlerId + '" disabled after too many errors', true);
        block.body = [];
      }
    }
  };

  Runtime.prototype.stmts = function (list) {
    for (var i = 0; i < list.length; i++) this.stmt(list[i]);
  };

  Runtime.prototype.stmt = function (s) {
    var engine = this.engine;
    switch (s.k) {
      case 'Block': this.stmts(s.body); return;
      case 'Let': this.set(s.name, this.eval(s.e)); return;
      case 'Assign': {
        var cur = this.get(s.name);
        var v = this.eval(s.e);
        if (s.op === '+=') {
          if (typeof cur === 'string' || typeof v === 'string') this.set(s.name, String(cur) + String(v));
          else this.set(s.name, cur + v);
        } else if (s.op === '-=') this.set(s.name, cur - v);
        else this.set(s.name, v);
        return;
      }
      case 'Say': engine.say(String(this.eval(s.e))); return;
      case 'Sound': engine.playSound(s.name); return;
      case 'Shake': engine.addShake(this.evalNum(s.e)); return;
      case 'Win': engine.triggerWin(); return;
      case 'Lose': engine.triggerLose(); return;
      case 'UnlockExit': engine.unlockExit(); return;
      case 'Heal': engine.heal(this.evalNum(s.e)); return;
      case 'Hurt': engine.hurt(this.evalNum(s.e)); return;
      case 'Spawn': engine.spawnEnemy(s.name, this.evalNum(s.x), this.evalNum(s.y)); return;
      case 'Log': if (typeof console !== 'undefined') console.log('[votyer]', this.eval(s.e)); return;
      case 'If':
        if (this.eval(s.cond)) this.stmts(s.then.body);
        else if (s.else) this.stmts(s.else.body);
        return;
      case 'Repeat': {
        var n = Math.max(0, Math.min(1000, Math.floor(this.evalNum(s.times))));
        for (var i = 0; i < n; i++) this.stmts(s.body.body);
        return;
      }
      case 'Wait': {
        engine.timers.push({
          t: Math.max(0, this.evalNum(s.e)),
          body: s.body,
          handlerId: 'wait'
        });
        return;
      }
    }
    throw VError('cannot execute statement "' + s.k + '"');
  };

  /* ================================================================
   *  5. ENGINE — retro raycaster, physics, AI, game states
   * ================================================================ */
  var PLAYER_RADIUS = 0.22;
  var ENEMY_RADIUS = 0.28;
  var SHOOT_DAMAGE = 10;
  var SHOOT_RANGE = 10;

  function Engine(spec, canvas, opts) {
    var self = this;
    opts = opts || {};
    this.spec = spec;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = spec.width;
    canvas.height = spec.height;
    this.W = spec.width;
    this.H = spec.height;

    this.zbuf = new Float32Array(this.W);
    this.state = 'menu';
    this.runtime = new Runtime(this);
    this.audio = new AudioSynth(this);
    this.keys = Object.create(null);
    this.messages = [];
    this.consoleLines = [];
    this.timers = [];
    this.time = 0;
    this.shake = 0;
    this.flash = 0;
    this.bobT = 0;
    this.shootCd = 0;
    this.invulnT = 0;
    this.bumpCd = 0;
    this.deniedCd = 0;
    this.exitRuleCd = 0;
    this.exitUnlocked = false;
    this.allTakenFired = false;
    this.showFps = false;
    this.showMinimap = !!spec.minimap;
    this.destroyed = false;
    this.viewDist = 16 - clamp01(spec.fog) * 10;

    // fog atmosphere overlay (vertical gradient, drawn once)
    this.atmo = document.createElement('canvas');
    this.atmo.width = 1; this.atmo.height = this.H;
    (function () {
      var g = self.atmo.getContext('2d');
      var grad = g.createLinearGradient(0, 0, 0, self.H);
      grad.addColorStop(0, 'rgba(0,0,0,0.25)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.45)');
      grad.addColorStop(1, 'rgba(0,0,0,0.3)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 1, self.H);
    })();

    // menu starfield
    this.stars = [];
    for (var si = 0; si < 110; si++) {
      this.stars.push({
        x: Math.random(), y: Math.random(),
        z: 0.3 + Math.random() * 1.4,
        r: 0.4 + Math.random() * 1.4,
        tw: Math.random() * Math.PI * 2
      });
    }

    this.spriteCache = {};
    this.buildSprites();

    this.resetEntities();

    this._shadeCache = Object.create(null);
    this._tick = this._tick.bind(this);
    this._onKeyDown = function (e) { self.keyDown(e); };
    this._onKeyUp = function (e) { self.keys[e.code] = false; if (self.state === 'play' && PREVENT.indexOf(e.code) !== -1) e.preventDefault(); };
    this._onClick = function () { self.click(); };
    this._onMouseMove = function (e) {
      if (document.pointerLockElement === self.canvas && self.state === 'play') {
        self.player.a += (e.movementX || 0) * self.spec.sens;
      }
    };
    this._onPLChange = function () {
      if (document.pointerLockElement !== self.canvas && self.state === 'play') self.pause();
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('click', this._onClick);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPLChange);

    this.lastT = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this._raf = requestAnimationFrame(this._tick);
  }

  var PREVENT = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

  function clamp01(v) { return Math.max(0, Math.min(1, v == null ? 0 : v)); }

  Engine.prototype.destroy = function () {
    this.destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('click', this._onClick);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPLChange);
    if (document.pointerLockElement === this.canvas && document.exitPointerLock) document.exitPointerLock();
    this.audio.close();
  };

  /* ---------------- map helpers ---------------- */
  Engine.prototype.cellAt = function (x, y) {
    if (x < 0 || y < 0 || x >= this.spec.mapW || y >= this.spec.mapH) return '#';
    return this.spec.grid[y][x];
  };
  Engine.prototype.isWall = function (mx, my) {
    var ch = this.cellAt(mx, my);
    return !this.spec.spawnChars[ch] && ch !== '.' && ch !== ' ';
  };
  Engine.prototype.isWallAt = function (fx, fy) {
    return this.isWall(Math.floor(fx), Math.floor(fy));
  };
  Engine.prototype.circleHitsWall = function (fx, fy, r) {
    var x0 = Math.floor(fx - r), x1 = Math.floor(fx + r);
    var y0 = Math.floor(fy - r), y1 = Math.floor(fy + r);
    for (var cy = y0; cy <= y1; cy++) {
      for (var cx = x0; cx <= x1; cx++) {
        if (!this.isWall(cx, cy)) continue;
        var nx = Math.max(cx, Math.min(fx, cx + 1));
        var ny = Math.max(cy, Math.min(fy, cy + 1));
        var dx = fx - nx, dy = fy - ny;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  };

  /* ---------------- entity reset / spawning ---------------- */
  Engine.prototype.resetEntities = function () {
    var spec = this.spec;
    var px = 1.5, py = 1.5, found = false;
    this.items = [];
    this.enemies = [];
    this.exitPos = null;

    for (var y = 0; y < spec.mapH; y++) {
      for (var x = 0; x < spec.mapW; x++) {
        var ch = spec.grid[y][x];
        if (ch === 'P') { px = x + 0.5; py = y + 0.5; found = true; }
        var sp = spec.spawnChars[ch];
        if (!sp) continue;
        if (sp.type === 'item') {
          var bp = spec.items[sp.name];
          this.items.push({
            name: sp.name, bp: bp, x: x + 0.5, y: y + 0.5, taken: false,
            bobPhase: Math.random() * Math.PI * 2,
            shape: bp.shape || 'crystal', color: bp.color || '#5eead4',
            value: bp.value != null ? bp.value : 10,
            glow: bp.glow != null ? bp.glow : true,
            onTake: bp.onTake
          });
        } else if (sp.type === 'enemy') {
          this.enemies.push(this.makeEnemy(sp.name, x + 0.5, y + 0.5));
        } else if (sp.type === 'exit') {
          this.exitPos = { x: x + 0.5, y: y + 0.5 };
        }
      }
    }

    var totalItems = this.items.length;
    // if the map has no P, fall back to the first walkable cell
    if (!found) {
      outer:
      for (var fy = 0; fy < spec.mapH; fy++) {
        for (var fx = 0; fx < spec.mapW; fx++) {
          if (!this.isWall(fx, fy)) { px = fx + 0.5; py = fy + 0.5; found = true; break outer; }
        }
      }
    }
    this.player = { x: px, y: py, a: 0 };
    this.runtime.vars.score = 0;
    this.runtime.vars.health = 100;
    this.timers = [];
    this.messages = [];
    this.consoleLines = [];
    this.shake = 0; this.flash = 0; this.invulnT = 0; this.shootCd = 0;
    this.allTakenFired = totalItems === 0;
    this.exitUnlocked = spec.exit ? (!spec.exit.locked || totalItems === 0) : true;
    this.exitRuleCd = 0;
  };

  Engine.prototype.makeEnemy = function (name, x, y) {
    var bp = this.spec.enemies[name] || {};
    return {
      name: name, bp: bp, x: x, y: y,
      dir: Math.random() * Math.PI * 2,
      speed: bp.speed != null ? bp.speed : 1.2,
      sight: bp.sight != null ? bp.sight : 6,
      hp: bp.hp != null ? bp.hp : 30,
      damage: bp.damage != null ? bp.damage : 15,
      shape: bp.shape || 'ghost', color: bp.color || '#e2445c',
      glow: bp.glow != null ? bp.glow : false,
      onHit: bp.onHit,
      state: 'patrol', patrolT: 0, hitFlash: 0,
      dying: false, deathT: 0, deadFired: false,
      bobPhase: Math.random() * Math.PI * 2
    };
  };

  Engine.prototype.spawnEnemy = function (name, x, y) {
    if (!this.spec.enemies[name]) {
      this.consoleMsg('spawn: unknown enemy "' + name + '"', true);
      return;
    }
    if (this.isWallAt(x, y)) {
      this.consoleMsg('spawn: cannot spawn inside a wall at ' + x + ',' + y, true);
      return;
    }
    this.enemies.push(this.makeEnemy(name, x, y));
  };

  /* ---------------- game state ---------------- */
  Engine.prototype.toMenu = function () { this.state = 'menu'; };
  Engine.prototype.start = function () {
    this.audio.ensure();
    this.resetEntities();
    this.state = 'play';
    this.runtime.execBlock(this.spec.events.start, 'on start');
  };
  Engine.prototype.pause = function () {
    if (this.state !== 'play') return;
    this.state = 'pause';
    if (document.pointerLockElement === this.canvas && document.exitPointerLock) document.exitPointerLock();
  };
  Engine.prototype.resume = function () {
    if (this.state !== 'pause') return;
    this.state = 'play';
    this.lastT = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  };
  Engine.prototype.triggerWin = function () {
    if (this.state !== 'play') return;
    this.state = 'win';
    this.playSound('win');
    if (document.pointerLockElement === this.canvas && document.exitPointerLock) document.exitPointerLock();
    this.runtime.execBlock(this.spec.events.win, 'on win');
  };
  Engine.prototype.triggerLose = function () {
    if (this.state !== 'play') return;
    this.state = 'lose';
    this.playSound('lose');
    if (document.pointerLockElement === this.canvas && document.exitPointerLock) document.exitPointerLock();
    this.runtime.execBlock(this.spec.events.lose, 'on lose');
  };
  Engine.prototype.unlockExit = function () {
    if (this.exitUnlocked) return;
    this.exitUnlocked = true;
    this.playSound('unlock');
    this.say('You hear something rumble open...');
  };

  Engine.prototype.itemsLeft = function () {
    var n = 0;
    for (var i = 0; i < this.items.length; i++) if (!this.items[i].taken) n++;
    return n;
  };
  Engine.prototype.itemsCount = function (name) {
    var n = 0;
    for (var i = 0; i < this.items.length; i++) if (!this.items[i].taken && this.items[i].name === name) n++;
    return n;
  };
  Engine.prototype.enemiesLeft = function () {
    var n = 0;
    for (var i = 0; i < this.enemies.length; i++) if (!this.enemies[i].dying) n++;
    return n;
  };

  Engine.prototype.say = function (text) {
    this.messages.push({ text: String(text).slice(0, 120), t: 3.4 });
    if (this.messages.length > 4) this.messages.shift();
  };
  Engine.prototype.consoleMsg = function (text, isErr) {
    this.consoleLines.push({ text: String(text).slice(0, 160), t: 9, isErr: !!isErr });
    if (this.consoleLines.length > 6) this.consoleLines.shift();
  };
  Engine.prototype.playSound = function (name) {
    if (!SOUNDS[name]) {
      this.consoleMsg('unknown sound "' + name + '" — playing blip instead');
      name = 'blip';
    }
    this.audio.play(name);
  };
  Engine.prototype.addShake = function (amount) {
    this.shake = Math.max(this.shake, Math.max(0, Math.min(1.5, amount)));
  };
  Engine.prototype.heal = function (n) {
    this.runtime.vars.health = Math.min(100, this.runtime.vars.health + n);
  };
  Engine.prototype.hurt = function (n) {
    this.runtime.vars.health -= n;
  };

  /* ---------------- input ---------------- */
  Engine.prototype.keyDown = function (e) {
    var code = e.code;
    this.keys[code] = true;

    if (this.state === 'menu') {
      if (code === 'Enter') { this.start(); e.preventDefault(); }
      return;
    }
    if (this.state === 'win' || this.state === 'lose') {
      if (code === 'Enter') { this.start(); e.preventDefault(); }
      return;
    }
    if (this.state === 'pause') {
      if (code === 'Escape' || code === 'Enter') this.resume();
      return;
    }
    if (this.state === 'play') {
      if (code === 'Escape') { this.pause(); return; }
      if (code === 'KeyM') { this.showMinimap = !this.showMinimap; return; }
      if (code === 'KeyF') { this.showFps = !this.showFps; return; }
      if (code === 'Space') { this.shoot(); e.preventDefault(); return; }
      if (PREVENT.indexOf(code) !== -1) e.preventDefault();
    }
  };

  Engine.prototype.click = function () {
    if (this.state === 'menu' || this.state === 'win' || this.state === 'lose') {
      this.start();
      this.requestLock();
      return;
    }
    if (this.state === 'pause') { this.resume(); this.requestLock(); return; }
    if (this.state === 'play') {
      if (document.pointerLockElement === this.canvas) this.shoot();
      else this.requestLock();
    }
  };
  Engine.prototype.requestLock = function () {
    if (this.canvas.requestPointerLock) {
      try { this.canvas.requestPointerLock(); } catch (err) { /* not fatal */ }
    }
  };
  Engine.prototype.shoot = function () {
    if (this.state !== 'play' || this.shootCd > 0) return;
    this.shootCd = 0.26;
    this.flash = 0.09;
    this.playSound('shoot');
    var p = this.player;
    var dx = Math.cos(p.a), dy = Math.sin(p.a);
    for (var t = 0.15; t < SHOOT_RANGE; t += 0.05) {
      var hx = p.x + dx * t, hy = p.y + dy * t;
      if (this.isWallAt(hx, hy)) break;
      for (var i = 0; i < this.enemies.length; i++) {
        var en = this.enemies[i];
        if (en.dying) continue;
        var ex = en.x - hx, ey = en.y - hy;
        if (ex * ex + ey * ey < 0.2) {
          en.hp -= SHOOT_DAMAGE;
          en.hitFlash = 0.18;
          en.state = 'chase';
          this.playSound('hit');
          // knockback
          var kx = en.x + dx * 0.18, ky = en.y + dy * 0.18;
          if (!this.isWallAt(kx, ky)) { en.x = kx; en.y = ky; }
          this.runtime.execBlock(en.onHit, 'on hit(' + en.name + ')');
          if (en.hp <= 0) {
            en.dying = true;
            en.deathT = 0.45;
            this.playSound('kill');
          }
          return;
        }
      }
    }
  };

  /* ---------------- update ---------------- */
  Engine.prototype.update = function (dt) {
    // timers run in every state (so wait works everywhere)
    if (this.timers.length) {
      var keep = [];
      for (var i = 0; i < this.timers.length; i++) {
        var tm = this.timers[i];
        tm.t -= dt;
        if (tm.t <= 0) this.runtime.execBlock(tm.body, 'wait');
        else keep.push(tm);
      }
      this.timers = keep;
    }

    if (this.state === 'play') this.updatePlay(dt);

    // decay effects
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.flash = Math.max(0, this.flash - dt);
    for (var m = this.messages.length - 1; m >= 0; m--) {
      this.messages[m].t -= dt;
      if (this.messages[m].t <= 0) this.messages.splice(m, 1);
    }
    for (var c = this.consoleLines.length - 1; c >= 0; c--) {
      this.consoleLines[c].t -= dt;
      if (this.consoleLines[c].t <= 0) this.consoleLines.splice(c, 1);
    }
  };

  Engine.prototype.updatePlay = function (dt) {
    var p = this.player, spec = this.spec;
    var k = this.keys;

    // turning
    var turnDir = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0);
    p.a += turnDir * spec.turn * dt;

    // movement
    var fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    var strafe = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    var moving = (fwd !== 0 || strafe !== 0);
    if (moving) {
      var ca = Math.cos(p.a), sa = Math.sin(p.a);
      var mx = ca * fwd + -sa * strafe;
      var my = sa * fwd + ca * strafe;
      var len = Math.sqrt(mx * mx + my * my) || 1;
      mx /= len; my /= len;
      var step = spec.speed * dt;
      var nx = p.x + mx * step, ny = p.y + my * step;
      var bumped = false;
      if (!this.circleHitsWall(nx, p.y, PLAYER_RADIUS)) p.x = nx; else bumped = true;
      if (!this.circleHitsWall(p.x, ny, PLAYER_RADIUS)) p.y = ny; else bumped = true;
      if (bumped && this.bumpCd <= 0) {
        this.bumpCd = 0.9;
        this.runtime.execBlock(this.spec.rules.bumpWall, 'on bump wall');
      }
      this.bobT += dt * 9.5;
    } else {
      this.bobT += dt * 1.6;
    }
    this.bumpCd -= dt;
    this.shootCd -= dt;
    this.invulnT -= dt;
    this.deniedCd -= dt;
    this.exitRuleCd -= dt;

    // held space auto-fires
    if (k.Space) this.shoot();

    this.updateItems(dt);
    this.updateEnemies(dt);
    this.updateExit(dt);

    if (this.runtime.vars.health <= 0) this.triggerLose();

    this.runtime.execBlock(this.spec.events.tick, 'on tick');
  };

  Engine.prototype.updateItems = function (dt) {
    var p = this.player;
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      if (it.taken) continue;
      var dx = it.x - p.x, dy = it.y - p.y;
      if (dx * dx + dy * dy < 0.3) {
        it.taken = true;
        if (it.onTake) {
          this.runtime.execBlock(it.onTake, 'on take(' + it.name + ')');
        } else {
          this.runtime.vars.score += it.value;
          this.playSound('pickup');
          this.say('+' + it.value + ' — ' + it.name);
        }
      }
    }
    // all items taken?
    if (!this.allTakenFired && this.items.length > 0 && this.itemsLeft() === 0) {
      this.allTakenFired = true;
      this.unlockExit();
      this.runtime.execBlock(this.spec.rules.allItemsTaken, 'on all items taken');
    }
  };

  Engine.prototype.updateEnemies = function (dt) {
    var p = this.player;
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var en = this.enemies[i];

      if (en.dying) {
        en.deathT -= dt;
        if (en.deathT <= 0) {
          this.enemies.splice(i, 1);
          if (!en.deadFired) {
            en.deadFired = true;
            this.runtime.execBlock(this.spec.rules.enemyDead, 'on enemy dead');
          }
        }
        continue;
      }

      en.hitFlash = Math.max(0, en.hitFlash - dt);
      var dx = p.x - en.x, dy = p.y - en.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      var seesYou = dist < en.sight && this.lineOfSight(en.x, en.y, p.x, p.y);
      if (seesYou) en.state = 'chase';
      else if (en.state === 'chase' && dist > en.sight * 1.4) en.state = 'patrol';

      var vx = 0, vy = 0;
      if (en.state === 'chase' && dist > 0.55) {
        vx = dx / (dist || 1); vy = dy / (dist || 1);
      } else if (en.state === 'patrol') {
        en.patrolT -= dt;
        vx = Math.cos(en.dir); vy = Math.sin(en.dir);
        var aheadX = en.x + vx * (ENEMY_RADIUS + 0.12);
        var aheadY = en.y + vy * (ENEMY_RADIUS + 0.12);
        if (this.circleHitsWall(aheadX, aheadY, ENEMY_RADIUS) || en.patrolT <= 0) {
          en.dir = Math.random() * Math.PI * 2;
          en.patrolT = 0.8 + Math.random() * 1.6;
          vx = Math.cos(en.dir); vy = Math.sin(en.dir);
        }
      }

      if (vx || vy) {
        var step = en.speed * dt;
        var nx = en.x + vx * step, ny = en.y + vy * step;
        if (!this.circleHitsWall(nx, en.y, ENEMY_RADIUS)) en.x = nx;
        if (!this.circleHitsWall(en.x, ny, ENEMY_RADIUS)) en.y = ny;
      }

      // separation between enemies
      for (var j = 0; j < this.enemies.length; j++) {
        if (j === i) continue;
        var o = this.enemies[j];
        if (o.dying) continue;
        var sx = en.x - o.x, sy = en.y - o.y;
        var sd = sx * sx + sy * sy;
        if (sd > 0.0001 && sd < 0.36) {
          var push = (0.6 - Math.sqrt(sd)) * 0.5;
          var sl = Math.sqrt(sd);
          en.x += (sx / sl) * push * dt * 4;
          en.y += (sy / sl) * push * dt * 4;
        }
      }

      // touching the player
      if (dist < 0.62 && this.invulnT <= 0) {
        this.invulnT = 1.0;
        this.runtime.vars.health -= en.damage;
        this.playSound('hurt');
        this.addShake(0.35);
        this.say('Ouch! -' + en.damage + ' HP');
        this.runtime.execBlock(this.spec.rules.touchEnemy, 'on touch enemy');
      }
    }
  };

  Engine.prototype.updateExit = function (dt) {
    if (!this.exitPos) return;
    var p = this.player;
    var dx = this.exitPos.x - p.x, dy = this.exitPos.y - p.y;
    var d2 = dx * dx + dy * dy;
    if (d2 < 0.5) {
      if (this.exitUnlocked) {
        if (this.exitRuleCd <= 0) {
          this.exitRuleCd = 3;
          if (this.spec.rules.reachExit) {
            this.runtime.execBlock(this.spec.rules.reachExit, 'on reach exit');
          } else {
            this.triggerWin();
          }
        }
      } else if (this.deniedCd <= 0) {
        this.deniedCd = 1.8;
        this.playSound('denied');
        this.say('The way out is sealed. Collect everything first!');
      }
    }
  };

  Engine.prototype.lineOfSight = function (x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.ceil(dist / 0.1);
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      if (this.isWallAt(x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  };

  /* ---------------- raycasting ---------------- */
  Engine.prototype.castRay = function (px, py, rdx, rdy) {
    var mapX = Math.floor(px), mapY = Math.floor(py);
    var ddx = Math.abs(1 / (rdx || 1e-9));
    var ddy = Math.abs(1 / (rdy || 1e-9));
    var stepX, stepY, sdx, sdy, side = 0;
    if (rdx < 0) { stepX = -1; sdx = (px - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - px) * ddx; }
    if (rdy < 0) { stepY = -1; sdy = (py - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - py) * ddy; }
    var hit = false, guard = 0, ch = '#';
    while (!hit && guard++ < 160) {
      if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; }
      else { sdy += ddy; mapY += stepY; side = 1; }
      ch = this.cellAt(mapX, mapY);
      if (this.isWall(mapX, mapY)) hit = true;
    }
    var dist = side === 0 ? sdx - ddx : sdy - ddy;
    return { dist: Math.max(0.02, dist), side: side, mapX: mapX, mapY: mapY, ch: ch };
  };

  Engine.prototype.shadeColor = function (ch, shade) {
    var bucket = Math.round(shade * 48);
    var key = ch + '|' + bucket;
    var cached = this._shadeCache[key];
    if (cached) return cached;
    var base = this.spec.wallColors[ch] || [140, 140, 140];
    var r = Math.round(base[0] * shade);
    var g = Math.round(base[1] * shade);
    var b = Math.round(base[2] * shade);
    cached = 'rgb(' + r + ',' + g + ',' + b + ')';
    this._shadeCache[key] = cached;
    return cached;
  };

  Engine.prototype.renderWalls = function () {
    var ctx = this.ctx, W = this.W, H = this.H;
    var p = this.player;
    var fovRad = (this.spec.fov || 66) * Math.PI / 180;
    var planeLen = Math.tan(fovRad / 2);
    var dirX = Math.cos(p.a), dirY = Math.sin(p.a);
    var planeX = -dirY * planeLen, planeY = dirX * planeLen;
    var horizon = H / 2 + this.viewBobPx() + this.shakePx();
    var viewDist = this.viewDist;
    var tex = this.spec.texture;

    // ceiling + floor
    ctx.fillStyle = this.spec.sky;
    ctx.fillRect(0, 0, W, Math.max(0, horizon));
    ctx.fillStyle = this.spec.floor;
    ctx.fillRect(0, horizon, W, H - horizon);
    ctx.drawImage(this.atmo, 0, 0, W, H);

    for (var x = 0; x < W; x++) {
      var cameraX = 2 * x / W - 1;
      var rdx = dirX + planeX * cameraX;
      var rdy = dirY + planeY * cameraX;
      var ray = this.castRay(p.x, p.y, rdx, rdy);
      var dist = ray.dist;
      this.zbuf[x] = dist;

      var h = H / dist;
      var top = horizon - h / 2;
      var shade = 1 - dist / viewDist;
      shade = Math.max(0.05, Math.min(1, shade));
      if (ray.side === 1) shade *= 0.78;

      if (tex) {
        var wallX = ray.side === 0 ? (p.y + dist * rdy) : (p.x + dist * rdx);
        wallX -= Math.floor(wallX);
        if (((Math.floor(wallX * 8)) % 2) === 0) shade *= 0.86;
      }
      if (shade > 1) shade = 1;

      ctx.fillStyle = this.shadeColor(ray.ch, shade);
      ctx.fillRect(x, top, 1, h);
    }
  };

  Engine.prototype.viewBobPx = function () {
    var moving = this.keys && (this.keys.KeyW || this.keys.ArrowUp || this.keys.KeyS || this.keys.ArrowDown || this.keys.KeyA || this.keys.KeyD);
    var amp = moving ? 3.2 : 1.1;
    return Math.sin(this.bobT) * amp;
  };
  Engine.prototype.shakePx = function () {
    if (this.shake <= 0) return 0;
    return (Math.random() - 0.5) * this.shake * 14;
  };

  /* ================================================================
   *  6. SPRITES — procedural pixel-art sprite factory
   * ================================================================ */
  var SPRITE_SIZE = 64;

  function makeSprite(shape, color, glow) {
    var cv = document.createElement('canvas');
    cv.width = SPRITE_SIZE; cv.height = SPRITE_SIZE;
    var g = cv.getContext('2d');
    if (glow) { g.shadowColor = color; g.shadowBlur = 10; }
    paintShape(g, shape, color);
    g.shadowBlur = 0;
    // white "flash" variant for hit feedback
    var flash = document.createElement('canvas');
    flash.width = SPRITE_SIZE; flash.height = SPRITE_SIZE;
    var fg = flash.getContext('2d');
    fg.drawImage(cv, 0, 0);
    fg.globalCompositeOperation = 'source-atop';
    fg.fillStyle = 'rgba(255,255,255,0.85)';
    fg.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    return { cv: cv, flash: flash };
  }

  function paintShape(g, shape, color) {
    switch (shape) {
      case 'orb': {
        var rg = g.createRadialGradient(32, 26, 4, 32, 32, 24);
        rg.addColorStop(0, '#ffffff');
        rg.addColorStop(0.35, color);
        rg.addColorStop(1, shade(color, 0.35));
        g.fillStyle = rg;
        g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'chest': {
        g.fillStyle = '#6b4423';
        g.fillRect(10, 28, 44, 26);
        g.fillStyle = '#8b5a2b';
        g.fillRect(10, 22, 44, 10);
        g.fillStyle = '#3a2410';
        g.fillRect(10, 34, 44, 3);
        g.fillStyle = '#f4c542';
        g.fillRect(28, 30, 8, 10);
        g.strokeStyle = 'rgba(0,0,0,0.4)';
        g.strokeRect(10, 22, 44, 32);
        break;
      }
      case 'star': {
        g.fillStyle = color;
        g.beginPath();
        for (var i = 0; i < 10; i++) {
          var ang = -Math.PI / 2 + i * Math.PI / 5;
          var rr = i % 2 === 0 ? 26 : 11;
          var x = 32 + Math.cos(ang) * rr, y = 34 + Math.sin(ang) * rr;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath(); g.arc(28, 30, 5, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'robot': {
        g.fillStyle = shade(color, 0.75);
        g.fillRect(14, 20, 36, 34);
        g.fillStyle = color;
        g.fillRect(18, 8, 28, 18);
        g.fillStyle = '#0b0d14';
        g.fillRect(22, 12, 20, 9);
        g.fillStyle = '#ff5566';
        g.fillRect(25, 14, 5, 5);
        g.fillStyle = '#66e0ff';
        g.fillRect(35, 14, 5, 5);
        g.strokeStyle = color;
        g.beginPath(); g.moveTo(32, 8); g.lineTo(32, 2); g.stroke();
        g.beginPath(); g.arc(32, 2, 2, 0, Math.PI * 2); g.fillStyle = '#ff5566'; g.fill();
        g.fillStyle = shade(color, 0.5);
        g.fillRect(20, 40, 24, 4);
        break;
      }
      case 'blob': {
        g.fillStyle = color;
        g.beginPath();
        g.ellipse(32, 38, 24, 19, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#0b0d14';
        g.beginPath(); g.arc(25, 34, 4, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(39, 34, 4, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath(); g.ellipse(26, 26, 9, 4, -0.4, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'skull': {
        g.fillStyle = '#e8e4d8';
        g.beginPath(); g.arc(32, 28, 20, 0, Math.PI * 2); g.fill();
        g.fillRect(22, 38, 20, 12);
        g.fillStyle = '#14141c';
        g.beginPath(); g.arc(25, 27, 5, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(39, 27, 5, 0, Math.PI * 2); g.fill();
        g.fillRect(29, 33, 6, 5);
        g.fillStyle = '#e8e4d8';
        for (var t = 0; t < 3; t++) g.fillRect(24 + t * 6, 44, 3, 6);
        break;
      }
      case 'ghost': {
        g.fillStyle = color;
        g.beginPath();
        g.arc(32, 28, 20, Math.PI, 0);
        g.lineTo(52, 46);
        g.lineTo(44, 42);
        g.lineTo(38, 48);
        g.lineTo(32, 42);
        g.lineTo(26, 48);
        g.lineTo(20, 42);
        g.lineTo(12, 46);
        g.closePath();
        g.fill();
        g.fillStyle = '#0b0d14';
        g.beginPath(); g.arc(25, 27, 4.5, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(39, 27, 4.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.beginPath(); g.ellipse(26, 18, 8, 4, -0.5, 0, Math.PI * 2); g.fill();
        break;
      }
      default: { // crystal (diamond)
        var grad = g.createLinearGradient(10, 8, 54, 58);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, color);
        grad.addColorStop(1, shade(color, 0.45));
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(32, 6); g.lineTo(54, 32); g.lineTo(32, 58); g.lineTo(10, 32);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.6)';
        g.beginPath(); g.moveTo(32, 6); g.lineTo(32, 58); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.beginPath(); g.moveTo(32, 12); g.lineTo(40, 32); g.lineTo(32, 30); g.closePath(); g.fill();
      }
    }
  }

  function shade(hex, factor) {
    var rgb = hexToRgb(hex);
    return 'rgb(' + Math.round(rgb[0] * factor) + ',' + Math.round(rgb[1] * factor) + ',' + Math.round(rgb[2] * factor) + ')';
  }

  Engine.prototype.buildSprites = function () {
    var i;
    var seen = Object.create(null);
    var blueprintLists = [];
    for (var name in this.spec.items) blueprintLists.push(this.spec.items[name]);
    for (var ename in this.spec.enemies) blueprintLists.push(this.spec.enemies[ename]);
    for (i = 0; i < blueprintLists.length; i++) {
      var bp = blueprintLists[i];
      var shape = bp.shape || (bp.k === 'item' ? 'crystal' : 'ghost');
      var color = bp.color || (bp.k === 'item' ? '#5eead4' : '#e2445c');
      var glow = bp.glow != null ? bp.glow : (bp.k === 'item');
      var key = shape + '|' + color + '|' + glow;
      if (!seen[key]) { seen[key] = makeSprite(shape, color, glow); }
      this.spriteCache[key] = seen[key];
    }
    this.defaultSprites = {
      item: makeSprite('crystal', '#5eead4', true),
      enemy: makeSprite('ghost', '#e2445c', false)
    };
    // animated exit portal canvas
    this.portal = document.createElement('canvas');
    this.portal.width = SPRITE_SIZE; this.portal.height = SPRITE_SIZE;
  };

  Engine.prototype.itemsListForSprites = function () { return []; };

  Engine.prototype.drawPortal = function () {
    var g = this.portal.getContext('2d');
    g.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    var color = (this.spec.exit && this.spec.exit.color) || '#8b5cf6';
    var t = this.time;
    g.save();
    g.shadowColor = color; g.shadowBlur = 12;
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.beginPath(); g.arc(32, 32, 24, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = this.exitUnlocked ? '#ffffff' : shade(color, 0.7);
    g.lineWidth = 3;
    for (var arm = 0; arm < 3; arm++) {
      g.beginPath();
      var a0 = t * 2.2 + arm * (Math.PI * 2 / 3);
      g.arc(32, 32, 15, a0, a0 + 1.4);
      g.stroke();
    }
    g.fillStyle = this.exitUnlocked ? 'rgba(255,255,255,0.85)' : 'rgba(120,120,160,0.5)';
    g.beginPath(); g.arc(32, 32, 5 + Math.sin(t * 4) * 1.5, 0, Math.PI * 2); g.fill();
    g.restore();
  };

  Engine.prototype.spriteFor = function (ent, kind) {
    var shape = ent.shape, color = ent.color, glow = ent.glow;
    var key = shape + '|' + color + '|' + glow;
    return this.spriteCache[key] || this.defaultSprites[kind] || this.defaultSprites.item;
  };

  Engine.prototype.renderSprites = function () {
    var p = this.player;
    var W = this.W, H = this.H;
    var horizon = this._horizon;
    var list = [];
    var i, ent;

    for (i = 0; i < this.items.length; i++) {
      ent = this.items[i];
      if (ent.taken) continue;
      list.push({
        x: ent.x, y: ent.y, alpha: 1,
        canvas: this.spriteFor(ent, 'item').cv,
        scale: 0.55,
        vOff: -0.1 + Math.sin(this.time * 2.6 + ent.bobPhase) * 0.06
      });
    }

    if (this.exitPos) {
      this.drawPortal();
      list.push({
        x: this.exitPos.x, y: this.exitPos.y, alpha: 1,
        canvas: this.portal,
        scale: 0.9,
        vOff: Math.sin(this.time * 1.8) * 0.04
      });
    }

    for (i = 0; i < this.enemies.length; i++) {
      ent = this.enemies[i];
      var life = ent.dying ? Math.max(0, ent.deathT / 0.45) : 1;
      var spr = ent.hitFlash > 0 ? this.spriteFor(ent, 'enemy').flash : this.spriteFor(ent, 'enemy').cv;
      list.push({
        x: ent.x, y: ent.y,
        alpha: ent.dying ? life : 1,
        canvas: spr,
        scale: 0.8 * (0.3 + 0.7 * life),
        vOff: Math.sin(this.time * 3 + ent.bobPhase) * 0.025
      });
    }

    // sort far -> near
    for (i = 0; i < list.length; i++) {
      var dx = list[i].x - p.x, dy = list[i].y - p.y;
      list[i].d2 = dx * dx + dy * dy;
    }
    list.sort(function (a, b) { return b.d2 - a.d2; });

    var ctx = this.ctx;
    var invDet = 1 / (this._planeX * this._dirY - this._dirX * this._planeY);
    for (var s = 0; s < list.length; s++) {
      var e = list[s];
      var rx = e.x - p.x, ry = e.y - p.y;
      var tx = invDet * (this._dirY * rx - this._dirX * ry);
      var ty = invDet * (-this._planeY * rx + this._planeX * ry);
      if (ty <= 0.08) continue;
      var screenX = (W / 2) * (1 + tx / ty);
      var size = (H / ty) * e.scale;
      var top = horizon - size / 2 + (H / ty) * e.vOff;
      var x0 = Math.floor(screenX - size / 2);
      var x1 = Math.ceil(screenX + size / 2);
      var shadeF = Math.max(0.25, Math.min(1, 1 - ty / this.viewDist + 0.25));
      ctx.globalAlpha = Math.max(0, Math.min(1, e.alpha * shadeF));
      var srcW = e.canvas.width;
      for (var x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        if (ty >= this.zbuf[x]) continue;
        var texX = Math.floor((x - x0) / (x1 - x0) * srcW);
        ctx.drawImage(e.canvas, texX, 0, 1, srcW, x, top, 1, size);
      }
    }
    ctx.globalAlpha = 1;
  };

  /* ================================================================
   *  7. WEAPON & HUD
   * ================================================================ */
  Engine.prototype.drawWeapon = function () {
    var ctx = this.ctx, W = this.W, H = this.H;
    var cx = W / 2 + Math.sin(this.bobT * 0.9) * 6;
    var sway = Math.abs(Math.cos(this.bobT * 0.9)) * 4;
    var recoil = this.flash > 0 ? 7 : 0;
    var bottom = H + sway + recoil;

    ctx.fillStyle = '#232833';
    ctx.fillRect(cx - 10, bottom - 86, 20, 46);
    ctx.fillStyle = '#313848';
    ctx.fillRect(cx - 6, bottom - 96, 12, 14);
    ctx.fillStyle = '#181c26';
    ctx.fillRect(cx - 18, bottom - 52, 36, 52);
    ctx.fillStyle = '#ec4899';
    ctx.fillRect(cx - 2, bottom - 82, 4, 30);
    ctx.fillStyle = '#4b5568';
    ctx.fillRect(cx - 14, bottom - 50, 28, 4);

    if (this.flash > 0) {
      var fx = cx, fy = bottom - 100;
      var grad = ctx.createRadialGradient(fx, fy, 1, fx, fy, 22);
      grad.addColorStop(0, 'rgba(255,255,235,0.95)');
      grad.addColorStop(0.4, 'rgba(255,214,120,0.55)');
      grad.addColorStop(1, 'rgba(255,180,80,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(fx, fy, 22, 0, Math.PI * 2); ctx.fill();
    }
  };

  Engine.prototype.drawHUD = function () {
    var ctx = this.ctx, W = this.W, H = this.H;
    var mono = '"Courier New", monospace';

    // health bar
    var hp = Math.max(0, Math.min(100, this.runtime.vars.health));
    ctx.fillStyle = 'rgba(6,8,16,0.55)';
    ctx.fillRect(12, 12, 164, 22);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(12.5, 12.5, 163, 21);
    ctx.fillStyle = hp > 30 ? '#41d98d' : '#ff5566';
    ctx.fillRect(16, 16, 120 * (hp / 100), 8);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 10px ' + mono;
    ctx.textAlign = 'left';
    ctx.fillText('HP ' + Math.round(hp), 142, 24);

    // crosshair
    if (this.state === 'play') {
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1;
      var cx = W / 2, cy = H / 2;
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy); ctx.lineTo(cx - 2, cy);
      ctx.moveTo(cx + 2, cy); ctx.lineTo(cx + 7, cy);
      ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy - 2);
      ctx.moveTo(cx, cy + 2); ctx.lineTo(cx, cy + 7);
      ctx.stroke();
    }

    // minimap + score
    var topRight = 12;
    if (this.showMinimap) topRight = this.drawMinimap(12) + 20;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 13px ' + mono;
    ctx.textAlign = 'right';
    ctx.fillText('SCORE ' + this.runtime.vars.score, W - 12, topRight + 10);

    // messages
    ctx.textAlign = 'center';
    ctx.font = '600 13px ' + mono;
    for (var m = 0; m < this.messages.length && m < 3; m++) {
      var msg = this.messages[this.messages.length - 1 - m];
      ctx.globalAlpha = Math.max(0, Math.min(1, msg.t / 0.6));
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
      ctx.fillStyle = '#eef2ff';
      ctx.fillText(msg.text, W / 2, H - 26 - m * 20);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // on-screen console (runtime errors / warnings)
    ctx.textAlign = 'left';
    ctx.font = '11px ' + mono;
    for (var c = 0; c < this.consoleLines.length; c++) {
      var line = this.consoleLines[c];
      ctx.globalAlpha = Math.max(0, Math.min(1, line.t / 1.5));
      ctx.fillStyle = line.isErr ? '#ff6b6b' : '#ffd166';
      ctx.fillText(line.text, 12, 46 + c * 14);
    }
    ctx.globalAlpha = 1;

    // fps
    if (this.showFps) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '10px ' + mono;
      ctx.fillText(this.fps + ' FPS', 12, H - 10);
    }
  };

  Engine.prototype.drawMinimap = function (pad) {
    var ctx = this.ctx;
    var cell = 5;
    var mw = this.spec.mapW * cell, mh = this.spec.mapH * cell;
    var ox = this.W - mw - pad, oy = pad;
    ctx.fillStyle = 'rgba(6,8,16,0.72)';
    ctx.fillRect(ox - 3, oy - 3, mw + 6, mh + 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(ox - 3.5, oy - 3.5, mw + 7, mh + 7);

    for (var y = 0; y < this.spec.mapH; y++) {
      for (var x = 0; x < this.spec.mapW; x++) {
        var ch = this.spec.grid[y][x];
        if (this.isWall(x, y)) {
          var base = this.spec.wallColors[ch] || [130, 130, 140];
          ctx.fillStyle = 'rgba(' + base[0] + ',' + base[1] + ',' + base[2] + ',0.9)';
          ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
        } else if (ch !== '.' && ch !== ' ') {
          ctx.fillStyle = 'rgba(90,90,110,0.55)';
          ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
        }
      }
    }
    // items
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      if (it.taken) continue;
      ctx.fillStyle = '#5eead4';
      ctx.fillRect(ox + it.x * cell - 1.5, oy + it.y * cell - 1.5, 3, 3);
    }
    // exit
    if (this.exitPos) {
      ctx.fillStyle = this.exitUnlocked ? (Math.sin(this.time * 6) > 0 ? '#ffffff' : '#8b5cf6') : '#5b4a8a';
      ctx.fillRect(ox + this.exitPos.x * cell - 2, oy + this.exitPos.y * cell - 2, 4.5, 4.5);
    }
    // enemies
    ctx.fillStyle = '#ff5566';
    for (var e = 0; e < this.enemies.length; e++) {
      var en = this.enemies[e];
      if (en.dying) continue;
      ctx.fillRect(ox + en.x * cell - 1.5, oy + en.y * cell - 1.5, 3.5, 3.5);
    }
    // player
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + this.player.x * cell - 2, oy + this.player.y * cell - 2, 4, 4);
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(ox + this.player.x * cell, oy + this.player.y * cell);
    ctx.lineTo(ox + this.player.x * cell + Math.cos(this.player.a) * 8, oy + this.player.y * cell + Math.sin(this.player.a) * 8);
    ctx.stroke();
    return mh;
  };

  /* ================================================================
   *  8. MENUS & OVERLAY SCREENS
   * ================================================================ */
  Engine.prototype.render = function (dt) {
    var ctx = this.ctx;
    var p = this.player;
    var fovRad = (this.spec.fov || 66) * Math.PI / 180;
    var planeLen = Math.tan(fovRad / 2);
    this._dirX = Math.cos(p.a); this._dirY = Math.sin(p.a);
    this._planeX = -this._dirY * planeLen;
    this._planeY = this._dirX * planeLen;
    this._horizon = this.H / 2 + this.viewBobPx() + this.shakePx();

    if (this.state === 'menu') { this.drawMenu(dt); return; }

    this.renderWalls();
    this.renderSprites();
    if (this.state === 'play' || this.state === 'pause') this.drawWeapon();
    this.drawHUD();

    if (this.state === 'pause') this.drawCenterScreen('PAUSED', '#a5b4fc', 'click or press ESC to resume', null);
    if (this.state === 'win') this.drawCenterScreen('YOU ESCAPED!', '#5eead4', 'final score: ' + this.runtime.vars.score, 'ENTER — play again');
    if (this.state === 'lose') this.drawCenterScreen('GAME OVER', '#ff5566', 'score: ' + this.runtime.vars.score, 'ENTER — try again');
  };

  Engine.prototype.updateStars = function (dt) {
    for (var i = 0; i < this.stars.length; i++) {
      var s = this.stars[i];
      s.x -= s.z * dt * 0.02;
      if (s.x < -0.02) s.x = 1.02;
    }
  };

  Engine.prototype.drawMenu = function (dt) {
    var ctx = this.ctx, W = this.W, H = this.H;
    this.updateStars(dt);

    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0b1e');
    bg.addColorStop(0.55, '#12122e');
    bg.addColorStop(1, '#1a1030');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < this.stars.length; i++) {
      var s = this.stars[i];
      var tw = 0.5 + 0.5 * Math.sin(this.time * 2 + s.tw);
      ctx.globalAlpha = 0.35 + tw * 0.65;
      ctx.fillStyle = s.z > 1.2 ? '#ffffff' : (s.z > 0.7 ? '#cdd6ff' : '#8f9bd4');
      ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // distant floor grid for retro depth
    ctx.strokeStyle = 'rgba(139,92,246,0.18)';
    ctx.lineWidth = 1;
    var hy = H * 0.72;
    for (var gy = 0; gy < 6; gy++) {
      var yy = hy + gy * gy * 7;
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
    }
    for (var gx = 0; gx < 14; gx++) {
      var xx = (gx / 13) * W;
      ctx.beginPath(); ctx.moveTo(xx, hy); ctx.lineTo((xx - W / 2) * 2.4 + W / 2, H); ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(165,180,252,0.75)';
    ctx.font = '600 12px "Courier New", monospace';
    ctx.fillText('V O T Y E R . J S   P R E S E N T S', W / 2, H * 0.26);

    var grad = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
    grad.addColorStop(0, '#22d3ee');
    grad.addColorStop(0.5, '#a78bfa');
    grad.addColorStop(1, '#ec4899');
    ctx.fillStyle = grad;
    ctx.font = 'bold 46px "Courier New", monospace';
    ctx.fillText(String(this.spec.title).toUpperCase(), W / 2, H * 0.26 + 56);

    if (this.spec.subtitle && this.spec.subtitle !== this.spec.title) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = 'italic 15px Georgia, serif';
      ctx.fillText(this.spec.subtitle, W / 2, H * 0.26 + 80);
    }

    var blink = 0.55 + 0.45 * Math.sin(this.time * 3.2);
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px "Courier New", monospace';
    ctx.fillText('CLICK OR PRESS ENTER TO START', W / 2, H * 0.62);
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(190,200,230,0.75)';
    ctx.font = '12px "Courier New", monospace';
    var ctrl = [
      'W A S D — move        ARROWS — move & turn',
      'MOUSE — look (click canvas to lock)',
      'SPACE / CLICK — fire      M — minimap',
      'F — fps        ESC — pause'
    ];
    for (var c = 0; c < ctrl.length; c++) {
      ctx.fillText(ctrl[c], W / 2, H * 0.62 + 30 + c * 18);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText('built with votyer.js v' + VERSION + ' — a language for retro html5 games', W / 2, H - 14);
  };

  Engine.prototype.drawCenterScreen = function (big, color, small, hint) {
    var ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(4,5,12,0.62)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    var grad = ctx.createLinearGradient(W * 0.25, 0, W * 0.75, 0);
    grad.addColorStop(0, color);
    grad.addColorStop(1, '#ffffff');
    ctx.fillStyle = grad;
    ctx.font = 'bold 44px "Courier New", monospace';
    ctx.fillText(big, W / 2, H * 0.44);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 15px "Courier New", monospace';
    ctx.fillText(small, W / 2, H * 0.44 + 34);
    if (hint) {
      var blink = 0.5 + 0.5 * Math.sin(this.time * 3.2);
      ctx.globalAlpha = blink;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.fillText(hint, W / 2, H * 0.44 + 66);
      ctx.globalAlpha = 1;
    }
  };

  /* ================================================================
   *  9. MAIN LOOP
   * ================================================================ */
  Engine.prototype._tick = function (now) {
    if (this.destroyed) return;
    this._raf = requestAnimationFrame(this._tick);
    var dt = Math.min(0.05, (now - this.lastT) / 1000);
    if (dt < 0) dt = 0;
    this.lastT = now;
    this.time += dt;

    this._fpsT = (this._fpsT || 0) + dt;
    this._fpsN = (this._fpsN || 0) + 1;
    if (this._fpsT >= 0.5) {
      this.fps = Math.round(this._fpsN / this._fpsT);
      this._fpsT = 0; this._fpsN = 0;
    }

    this.update(dt);
    this.render(dt);
  };

  /* ================================================================
   *  10. AUDIO — tiny procedural synth
   * ================================================================ */
  var SOUNDS = {
    blip: 1, pickup: 1, hurt: 1, hit: 1, shoot: 1, kill: 1,
    win: 1, lose: 1, unlock: 1, denied: 1
  };

  function AudioSynth(engine) {
    this.engine = engine;
    this.ctx = null;
    this.master = null;
  }
  AudioSynth.prototype.ensure = function () {
    if (!this.ctx) {
      var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.22;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  };
  AudioSynth.prototype.close = function () {
    if (this.ctx) { try { this.ctx.close(); } catch (e) {} this.ctx = null; }
  };
  AudioSynth.prototype.tone = function (f0, f1, dur, type, when, vol) {
    if (!this.ctx) return;
    var t0 = this.ctx.currentTime + (when || 0);
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(Math.max(1, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.25, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  };
  AudioSynth.prototype.play = function (name) {
    this.ensure();
    if (!this.ctx) return;
    switch (name) {
      case 'blip': this.tone(440, 660, 0.08, 'square', 0, 0.16); break;
      case 'pickup':
        this.tone(523, 784, 0.1, 'sine', 0, 0.25);
        this.tone(784, 1318, 0.16, 'sine', 0.07, 0.2);
        break;
      case 'hurt': this.tone(220, 70, 0.28, 'sawtooth', 0, 0.28); break;
      case 'hit': this.tone(160, 110, 0.09, 'square', 0, 0.2); break;
      case 'shoot': this.tone(880, 120, 0.13, 'square', 0, 0.18); break;
      case 'kill': this.tone(300, 45, 0.34, 'triangle', 0, 0.28); break;
      case 'denied':
        this.tone(110, 100, 0.12, 'square', 0, 0.22);
        this.tone(110, 95, 0.14, 'square', 0.16, 0.22);
        break;
      case 'unlock':
        this.tone(440, 440, 0.09, 'sine', 0, 0.2);
        this.tone(554, 554, 0.09, 'sine', 0.1, 0.2);
        this.tone(659, 659, 0.16, 'sine', 0.2, 0.2);
        break;
      case 'win':
        this.tone(523, 523, 0.12, 'triangle', 0, 0.22);
        this.tone(659, 659, 0.12, 'triangle', 0.13, 0.22);
        this.tone(784, 784, 0.12, 'triangle', 0.26, 0.22);
        this.tone(1046, 1046, 0.3, 'triangle', 0.39, 0.24);
        break;
      case 'lose':
        this.tone(392, 392, 0.18, 'sawtooth', 0, 0.16);
        this.tone(311, 311, 0.18, 'sawtooth', 0.2, 0.16);
        this.tone(262, 262, 0.18, 'sawtooth', 0.4, 0.16);
        this.tone(196, 150, 0.4, 'sawtooth', 0.6, 0.18);
        break;
      default: this.tone(440, 660, 0.08, 'square', 0, 0.16);
    }
  };

  /* ================================================================
   *  11. PUBLIC API
   * ================================================================ */
  function compile(source) {
    try {
      var toks = lex(source);
      var ast = new Parser(toks).parseProgram();
      var spec = buildSpec(ast);
      return { ok: true, ast: ast, spec: spec, errors: [] };
    } catch (err) {
      var msg = (err && err.isVotyer) ? err.message : (err && err.message ? err.message : String(err));
      if (!(err && err.isVotyer) && typeof console !== 'undefined') console.error('[votyer]', err);
      return { ok: false, ast: null, spec: null, errors: ['votyer error at ' + msg] };
    }
  }

  function drawCompileErrors(canvas, errors) {
    try {
      var ctx = canvas.getContext('2d');
      canvas.width = canvas.width || 640;
      var W = canvas.width, H = canvas.height || 400;
      canvas.height = H;
      ctx.fillStyle = '#0a0b18';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ff5566';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('VOTYER COMPILE ERROR', 24, 44);
      ctx.font = '13px "Courier New", monospace';
      ctx.fillStyle = '#ffd166';
      for (var i = 0; i < errors.length && i < 10; i++) {
        wrapText(ctx, errors[i], 24, 80 + i * 40, W - 48, 18);
      }
    } catch (e) { /* headless */ }
  }

  function wrapText(ctx, text, x, y, maxW, lh) {
    var words = String(text).split(' ');
    var line = '', yy = y;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i] + ' ';
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = words[i] + ' ';
        yy += lh;
      } else line = test;
    }
    ctx.fillText(line, x, yy);
  }

  function run(source, canvas, opts) {
    var result = compile(source);
    var cv = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
    if (!result.ok) {
      if (cv) drawCompileErrors(cv, result.errors);
      return { ok: false, errors: result.errors, destroy: function () {} };
    }
    var engine = new Engine(result.spec, cv, opts);
    if (cv) cv.votyerGame = engine; // inspect or destroy programmatically
    return engine;
  }

  function autoEmbed() {
    if (typeof document === 'undefined') return;
    var scripts = document.querySelectorAll('script[type="text/votyer"]');
    for (var i = 0; i < scripts.length; i++) {
      (function (script) {
        var source = script.textContent || script.innerHTML;
        var sel = script.getAttribute('data-canvas');
        var canvas = sel ? document.querySelector(sel) : null;
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.style.maxWidth = '100%';
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto';
          canvas.style.boxShadow = '0 18px 60px rgba(0,0,0,0.55)';
          script.parentNode.insertBefore(canvas, script.nextSibling);
        }
        var eng = Votyer.run(source, canvas);
        canvas.votyerGame = eng;
      })(scripts[i]);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoEmbed);
    else autoEmbed();
  }

  var Votyer = {
    version: VERSION,
    compile: compile,
    run: run,
    lex: lex,
    Parser: Parser,
    buildSpec: buildSpec,
    Engine: Engine,
    VError: VError,
    sounds: Object.keys(SOUNDS)
  };
  return Votyer;
});
