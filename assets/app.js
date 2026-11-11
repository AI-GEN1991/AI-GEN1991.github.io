/* 10-Minute Worksheets | Binary Star | (c) Ashwini Kumar Mathur
   Search, inline YouTube player, worksheet viewer, likes, and optional visit / click counts. */
(function () {
  'use strict';

  var GC = (window.SITE && window.SITE.goatcounter) || '';   // GoatCounter site code, '' = counting off
  var rows = Array.prototype.slice.call(document.querySelectorAll('.ws'));

  /* ---------- counting (only when a GoatCounter code is set) ---------- */
  function track(name, title) {
    if (!GC || !window.goatcounter || !window.goatcounter.count) return;
    try { window.goatcounter.count({ path: name, title: title, event: true }); } catch (e) {}
  }
  function fetchCount(path, done) {
    if (!GC || !window.fetch) return;
    fetch('https://' + GC + '.goatcounter.com/counter/' + encodeURIComponent(path) + '.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.count) done(parseInt(String(d.count).replace(/\D/g, ''), 10) || 0); })
      .catch(function () {});
  }

  /* ---------- search ---------- */
  var q = document.getElementById('q');
  var empty = document.getElementById('empty');
  function filter() {
    var terms = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    var shown = 0;
    rows.forEach(function (li) {
      var hay = li.getAttribute('data-search');
      var ok = terms.every(function (t) { return hay.indexOf(t) !== -1; });
      li.hidden = !ok;
      if (ok) shown++;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.module'), function (m) {
      m.hidden = !m.querySelector('.ws:not([hidden])');
    });
    empty.hidden = shown !== 0;
  }
  if (q) q.addEventListener('input', filter);

  /* ---------- inline video player ---------- */
  function closePlayer(li) {
    var p = li.querySelector('.player');
    if (p) p.remove();
    var b = li.querySelector('.watch');
    if (b) b.setAttribute('aria-expanded', 'false');
  }
  function show(li, vids, i) {
    var p = li.querySelector('.player');
    var v = vids[i];
    p.querySelector('.frame').innerHTML =
      '<iframe src="https://www.youtube-nocookie.com/embed/' + v.id + '?rel=0&autoplay=1" title="' +
      v.title.replace(/"/g, '&quot;') + '" loading="lazy" allowfullscreen ' +
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
      'referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    p.querySelector('.player-foot strong').textContent = v.title;
    p.querySelector('.player-foot a').href = 'https://youtu.be/' + v.id;
    Array.prototype.forEach.call(p.querySelectorAll('.player-tabs button'), function (t, k) {
      t.setAttribute('aria-selected', k === i ? 'true' : 'false');
    });
  }
  function openPlayer(li, btn) {
    rows.forEach(function (o) { if (o !== li) closePlayer(o); });
    var vids = btn.getAttribute('data-videos').split('|').map(function (s) {
      var k = s.indexOf('~');
      return { id: s.slice(0, k), title: s.slice(k + 1) };
    });
    var p = document.createElement('div');
    p.className = 'player';
    var tabs = '';
    if (vids.length > 1) {
      tabs = '<div class="player-tabs" role="tablist">' + vids.map(function (v, i) {
        return '<button type="button" role="tab" data-i="' + i + '">Lecture ' + (i + 1) + '</button>';
      }).join('') + '</div>';
    }
    p.innerHTML = tabs + '<div class="frame"></div>' +
      '<div class="player-foot"><strong></strong><a target="_blank" rel="noopener">Open on YouTube</a></div>';
    li.appendChild(p);
    p.addEventListener('click', function (e) {
      var t = e.target.closest('.player-tabs button');
      if (t) show(li, vids, +t.getAttribute('data-i'));
    });
    btn.setAttribute('aria-expanded', 'true');
    show(li, vids, 0);
    track('video-' + li.id, 'Video: ' + li.querySelector('h3').textContent);
  }

  /* ---------- likes ---------- */
  function liked(id) { try { return localStorage.getItem('like-' + id) === '1'; } catch (e) { return false; } }
  function setLiked(id, on) { try { on ? localStorage.setItem('like-' + id, '1') : localStorage.removeItem('like-' + id); } catch (e) {} }
  function paint(btn, n) { btn.querySelector('.n').textContent = n > 0 ? String(n) : ''; }
  rows.forEach(function (li) {
    var btn = li.querySelector('.like');
    if (!btn) return;
    var n = 0;
    if (liked(li.id)) btn.setAttribute('aria-pressed', 'true');
    fetchCount('like-' + li.id, function (c) {
      n = Math.max(c, liked(li.id) ? 1 : 0);
      paint(btn, n);
    });
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      setLiked(li.id, on);
      if (on) { n += 1; track('like-' + li.id, 'Like: ' + li.querySelector('h3').textContent); }
      else { n = Math.max(0, n - 1); }
      if (GC) paint(btn, n);
    });
  });

  /* ---------- clicks on the list ---------- */
  document.addEventListener('click', function (e) {
    var w = e.target.closest('.watch');
    if (w) {
      e.preventDefault();
      var li = w.closest('.ws');
      if (w.getAttribute('aria-expanded') === 'true') closePlayer(li); else openPlayer(li, w);
      return;
    }
    var pdf = e.target.closest('.ws .open');
    if (pdf && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      location.hash = 'view-' + pdf.closest('.ws').id;     // the hash opens the viewer (and Back closes it)
    }
  });

  /* ---------- worksheet viewer: shows the PDF pages inside the site ---------- */
  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var viewer = document.getElementById('viewer');
  var pages = document.getElementById('viewer-pages');
  var pdfjsReady = null, job = 0, lastFocus = null;

  function loadPdfjs() {
    if (!pdfjsReady) {
      pdfjsReady = new Promise(function (ok, fail) {
        var s = document.createElement('script');
        s.src = PDFJS + 'pdf.min.js';
        s.onload = function () {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
          ok(window.pdfjsLib);
        };
        s.onerror = function () { pdfjsReady = null; fail(new Error('viewer library did not load')); };
        document.head.appendChild(s);
      });
    }
    return pdfjsReady;
  }
  function note(html) { pages.innerHTML = '<p class="viewer-note">' + html + '</p>'; }

  function openViewer(li) {
    var link = li.querySelector('.open');
    var url = link.getAttribute('href');
    var mine = ++job;
    lastFocus = document.activeElement;
    document.getElementById('viewer-title').textContent =
      li.querySelector('.ws-no').textContent + '  ' + li.querySelector('h3').textContent;
    document.getElementById('viewer-dl').href = url;
    viewer.hidden = false;
    document.body.classList.add('viewing');
    note('Loading worksheet…');
    document.getElementById('viewer-close').focus();
    track('pdf-' + li.id, 'PDF: ' + li.querySelector('h3').textContent);

    loadPdfjs().then(function (lib) { return lib.getDocument(url).promise; }).then(function (doc) {
      if (mine !== job) return;
      pages.innerHTML = '';
      var width = Math.min(pages.clientWidth - 20, 900);
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var chain = Promise.resolve();
      for (var n = 1; n <= doc.numPages; n++) {
        (function (n) {
          chain = chain.then(function () { return doc.getPage(n); }).then(function (page) {
            if (mine !== job) return;
            var base = page.getViewport({ scale: 1 });
            var vp = page.getViewport({ scale: (width / base.width) * dpr });
            var c = document.createElement('canvas');
            c.width = Math.round(vp.width); c.height = Math.round(vp.height);
            c.setAttribute('role', 'img');
            c.setAttribute('aria-label', 'Worksheet page ' + n + ' of ' + doc.numPages);
            pages.appendChild(c);
            return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          });
        })(n);
      }
      return chain;
    }).catch(function () {
      if (mine !== job) return;
      note('The worksheet could not be shown here. <a href="' + url + '" target="_blank" rel="noopener">Open the PDF directly</a>.');
    });
  }
  function closeViewer() {
    job++;
    viewer.hidden = true;
    pages.innerHTML = '';
    document.body.classList.remove('viewing');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function route() {
    var m = /^#view-(a\d+)$/.exec(location.hash);
    var li = m && document.getElementById(m[1]);
    if (li) openViewer(li); else if (!viewer.hidden) closeViewer();
  }
  window.addEventListener('hashchange', route);
  document.getElementById('viewer-close').addEventListener('click', function () {
    history.replaceState(null, '', location.pathname + location.search);
    closeViewer();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !viewer.hidden) document.getElementById('viewer-close').click();
  });
  route();

  /* ---------- site visit total in the footer ---------- */
  var stats = document.getElementById('stats');
  if (stats) fetchCount('TOTAL', function (c) { if (c > 0) stats.textContent = c.toLocaleString() + ' visits'; });
})();
