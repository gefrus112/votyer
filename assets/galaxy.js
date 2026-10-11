/* ============================================================
   votyer galaxy — an interactive spiral galaxy background.
   Particles live in spiral arms, slowly orbiting the core.
   Move your mouse: they get pulled into an orbital swirl
   around the cursor and spread around it like a bow wave.
   ============================================================ */
(function () {
  'use strict';

  var REDUCED = typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  function Galaxy(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.mouse = { x: -9999, y: -9999, active: false };
    this.parts = [];
    this.stars = [];
    this.nebula = null;
    this.t = 0;
    this.running = false;
    this._raf = null;
    this._bound = {};

    this.resize();
    this.buildNebula();
    this.buildStars();
    this.buildParticles();

    var self = this;
    this._bound.resize = function () { self.resize(); self.buildNebula(); self.buildStars(); self.buildParticles(); if (REDUCED) self.draw(0); };
    this._bound.move = function (e) {
      var r = canvas.getBoundingClientRect();
      self.mouse.x = e.clientX - r.left;
      self.mouse.y = e.clientY - r.top;
      self.mouse.active = true;
    };
    this._bound.leave = function () { self.mouse.active = false; };

    window.addEventListener('resize', this._bound.resize);
    var host = canvas.parentElement || canvas;
    host.addEventListener('mousemove', this._bound.move);
    host.addEventListener('mouseleave', this._bound.leave);

    if (REDUCED) {
      this.draw(0); // static single frame
    } else {
      this.start();
    }
  }

  Galaxy.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    var self = this;
    var last = performance.now();
    function frame(now) {
      if (!self.running) return;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      self.step(dt);
      self.draw(dt);
      self._raf = requestAnimationFrame(frame);
    }
    this._raf = requestAnimationFrame(frame);
  };

  Galaxy.prototype.stop = function () {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  };

  Galaxy.prototype.destroy = function () {
    this.stop();
    window.removeEventListener('resize', this._bound.resize);
    var host = this.canvas.parentElement || this.canvas;
    host.removeEventListener('mousemove', this._bound.move);
    host.removeEventListener('mouseleave', this._bound.leave);
  };

  Galaxy.prototype.resize = function () {
    var w = this.canvas.clientWidth || this.canvas.parentElement.clientWidth || 800;
    var h = this.canvas.clientHeight || this.canvas.parentElement.clientHeight || 600;
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cx = w / 2;
    this.cy = h * 0.46;
  };

  /* one-time rendered nebula clouds */
  Galaxy.prototype.buildNebula = function () {
    var cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    var g = cv.getContext('2d');
    var blobs = [
      { x: 0.5, y: 0.44, r: 0.42, c: 'rgba(139, 92, 246, 0.16)' },
      { x: 0.32, y: 0.3, r: 0.3, c: 'rgba(34, 211, 238, 0.09)' },
      { x: 0.68, y: 0.62, r: 0.34, c: 'rgba(236, 72, 153, 0.1)' },
      { x: 0.62, y: 0.25, r: 0.22, c: 'rgba(99, 102, 241, 0.1)' }
    ];
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      var grad = g.createRadialGradient(b.x * this.w, b.y * this.h, 0, b.x * this.w, b.y * this.h, b.r * Math.max(this.w, this.h));
      grad.addColorStop(0, b.c);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, this.w, this.h);
    }
    this.nebula = cv;
  };

  Galaxy.prototype.buildStars = function () {
    this.stars = [];
    var n = Math.floor((this.w * this.h) / 5200);
    for (var i = 0; i < n; i++) {
      this.stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: Math.random() < 0.85 ? 1 : 1.6,
        tw: Math.random() * Math.PI * 2,
        sp: 0.4 + Math.random() * 1.6
      });
    }
  };

  /* spiral-arm particles */
  Galaxy.prototype.buildParticles = function () {
    this.parts = [];
    var area = this.w * this.h;
    var n = Math.max(320, Math.min(1100, Math.floor(area / 1450)));
    var arms = 4;
    var maxR = Math.min(this.w, this.h) * 0.52;
    for (var i = 0; i < n; i++) {
      var arm = i % arms;
      var t = Math.pow(Math.random(), 0.72);           // denser core
      var r = 8 + t * maxR;
      var swirl = t * 2.6;
      var jitter = (Math.random() - 0.5) * (0.5 - t * 0.34);
      var base = (arm / arms) * Math.PI * 2 + swirl + jitter;
      // color by radius: hot core -> blue mid -> pink rim
      var col;
      var roll = Math.random();
      if (t < 0.22) col = roll < 0.6 ? '#fff6e8' : '#ffd9a8';
      else if (t < 0.55) col = roll < 0.5 ? '#9bb8ff' : '#c4b5fd';
      else col = roll < 0.45 ? '#f9a8d4' : (roll < 0.8 ? '#a5b4fc' : '#ffffff');
      this.parts.push({
        r: r, base: base,
        x: this.cx + Math.cos(base) * r,
        y: this.cy + Math.sin(base) * r * 0.62,
        vx: 0, vy: 0,
        size: t < 0.2 ? 1.9 : (Math.random() * 1.5 + 0.6),
        col: col,
        tw: Math.random() * Math.PI * 2,
        depth: 0.62 + t * 0.38
      });
    }
  };

  Galaxy.prototype.step = function (dt) {
    this.t += dt;
    var spin = 0.055;                                  // galaxy rotation rad/s
    var mx = this.mouse.x, my = this.mouse.y;
    var R = Math.max(150, this.w * 0.14);              // mouse influence radius
    var R2 = R * R;
    var flatten = 0.62;

    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];

      // home position orbits the core
      var a = p.base + this.t * spin;
      var hx = this.cx + Math.cos(a) * p.r;
      var hy = this.cy + Math.sin(a) * p.r * flatten * p.depth;

      // spring home
      p.vx += (hx - p.x) * 2.6 * dt;
      p.vy += (hy - p.y) * 2.6 * dt;

      // mouse swirl field
      if (this.mouse.active) {
        var dx = p.x - mx, dy = p.y - my;
        var d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) {
          var d = Math.sqrt(d2);
          var nx = dx / d, ny = dy / d;
          var falloff = 1 - d / R;
          if (d < 30) {
            // bow wave: push out so particles spread around the cursor
            var push = (30 - d) * 9 * dt;
            p.vx += nx * push;
            p.vy += ny * push;
          } else {
            // attraction + tangential kick = orbital swirl
            var pull = 150 * falloff * dt;
            p.vx += -nx * pull;
            p.vy += -ny * pull;
            p.vx += -ny * pull * 1.9;
            p.vy += nx * pull * 1.9;
          }
        }
      }

      // integrate + damping
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
    }
  };

  Galaxy.prototype.draw = function () {
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    // deep background
    var bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#080814');
    bg.addColorStop(0.6, '#0b0b1e');
    bg.addColorStop(1, '#10102a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    if (this.nebula) ctx.drawImage(this.nebula, 0, 0);

    // twinkling stars
    ctx.globalCompositeOperation = 'lighter';
    for (var s = 0; s < this.stars.length; s++) {
      var st = this.stars[s];
      var tw = 0.35 + 0.65 * Math.abs(Math.sin(this.t * st.sp + st.tw));
      ctx.globalAlpha = tw * 0.8;
      ctx.fillStyle = '#cdd6ff';
      ctx.fillRect(st.x, st.y, st.r, st.r);
    }

    // galaxy particles
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];
      var glow = 0.55 + 0.45 * Math.abs(Math.sin(this.t * 1.4 + p.tw));
      ctx.globalAlpha = glow * 0.9;
      ctx.fillStyle = p.col;
      var sz = p.size;
      if (sz > 1.4) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz, 0, 6.2832);
        ctx.fill();
      } else {
        ctx.fillRect(p.x, p.y, sz, sz);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // soft core glow
    var core = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, Math.min(this.w, this.h) * 0.16);
    core.addColorStop(0, 'rgba(255, 240, 214, 0.5)');
    core.addColorStop(0.35, 'rgba(244, 190, 170, 0.16)');
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = 'source-over';
  };

  /* auto-init every canvas.galaxy-bg on the page */
  var instances = [];
  function init() {
    var canvases = document.querySelectorAll('canvas.galaxy-bg');
    for (var i = 0; i < canvases.length; i++) {
      instances.push(new Galaxy(canvases[i]));
    }
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  window.VotyerGalaxy = { init: init, instances: instances };
})();
