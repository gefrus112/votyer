/* ============================================================
   votyer site utilities — nav, reveal animations, highlighting
   ============================================================ */
(function () {
  'use strict';

  // embed mode — votyer.html?embed renders just the game (for iframes)
  if (location.search.indexOf('embed') !== -1 && document.body) {
    document.body.classList.add('embed');
  }

  // mobile nav burger
  var burger = document.getElementById('nav-burger');
  var links = document.getElementById('nav-links');
  if (burger && links) {
    burger.addEventListener('click', function () {
      links.classList.toggle('open');
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') links.classList.remove('open');
    });
  }

  // syntax-highlight any element carrying data-highlight
  function highlightAll() {
    if (typeof window.VotyerHighlight !== 'function') return;
    var els = document.querySelectorAll('[data-highlight]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var raw = el.getAttribute('data-highlight-src') || el.textContent;
      el.innerHTML = window.VotyerHighlight(raw.replace(/^\n+/, ''));
    }
  }

  // scroll reveal
  function reveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < els.length; i++) els[i].classList.add('in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    for (var j = 0; j < els.length; j++) io.observe(els[j]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { highlightAll(); reveal(); });
  else { highlightAll(); reveal(); }
})();
