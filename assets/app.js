/* 10-Minute Worksheets | Binary Star | (c) Ashwini Kumar Mathur
   Search, inline YouTube player, worksheet viewer and a personal "done" checklist.
   With Firebase configured (window.SITE.firebase), students sign in with Google and
   their checklist is saved to their account; without it, it stays in this browser. */
(function () {
  'use strict';

  var SITE = window.SITE || {};
  var CFG = SITE.firebase && SITE.firebase.apiKey ? SITE.firebase : null;
  var SDK = SITE.firebaseSdk || 'https://www.gstatic.com/firebasejs/10.12.2/';
  var CHANNEL = SITE.channel || 'https://www.youtube.com/';
  var GC = SITE.goatcounter || '';

  var rows = [].slice.call(document.querySelectorAll('.ws:not(.soon)'));   // worksheets that exist
  var topics = [].slice.call(document.querySelectorAll('.ws'));            // includes "coming soon"
  var TOTAL = rows.length;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var cloud = !!CFG;
  var fb = null;              // { a: auth module, f: firestore module, auth, db }
  var user = null;
  var ready = !cloud;         // false until we know who is signed in
  var done = cloud ? {} : lsGet('bs-done', {});   // worksheet id -> true
  var filter = 'all';
  var note = '';              // short message shown under the progress bar
  var authKey = null;         // what the sign-in area currently shows

  function track(name, title) {
    if (!GC || !window.goatcounter || !window.goatcounter.count) return;
    try { window.goatcounter.count({ path: name, title: title, event: true }); } catch (e) {}
  }

  /* ================= Google sign-in and saved progress ================= */
  function userRef() { return fb.f.doc(fb.db, 'users', user.uid); }

  function cloudInit() {
    Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')])
      .then(function (m) {
        var app = m[0].initializeApp(CFG);
        fb = { a: m[1], f: m[2], auth: m[1].getAuth(app), db: m[2].getFirestore(app) };
        fb.a.onAuthStateChanged(fb.auth, onUser);
      })
      .catch(function () {                         // sign-in service unreachable: work offline
        cloud = false; ready = true; done = lsGet('bs-done', {});
        note = 'Sign-in is unavailable right now, so your ticks are kept in this browser.';
        render();
      });
  }

  function onUser(u) {
    user = u; done = {}; note = '';
    if (!u) { reacts = {}; repaintPlayers(); ready = true; render(); return; }
    ready = false; render();
    fb.f.getDoc(userRef()).then(function (snap) {
      var data = snap.exists() ? snap.data() : {};
      Object.keys(data.done || {}).forEach(function (k) { done[k] = true; });
      reacts = {}; Object.keys(data.reacts || {}).forEach(function (k) { reacts[k] = true; });
      repaintPlayers();
      var p = { name: u.displayName || '', email: u.email || '', photo: u.photoURL || '', lastSeen: fb.f.serverTimestamp() };
      if (!snap.exists()) p.created = fb.f.serverTimestamp();
      fb.f.setDoc(userRef(), p, { merge: true }).catch(function () {});
      ready = true; render();
      setTimeout(greet, 600);
    }).catch(function () {
      ready = true; note = 'Could not load your progress. Check your connection and reload.'; render();
    });
  }

  function signIn() {
    if (!fb) return;
    var provider = new fb.a.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    fb.a.signInWithPopup(fb.auth, provider).catch(function (err) {
      var c = (err && err.code) || '';
      if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment') {
        fb.a.signInWithRedirect(fb.auth, provider);
      } else if (c !== 'auth/popup-closed-by-user' && c !== 'auth/cancelled-popup-request') {
        note = 'Sign-in did not complete. Please try again.'; render();
      }
    });
  }
  function signOut() { closeMenu(); if (fb) fb.a.signOut(fb.auth); }

  function setDone(id, on) {
    if (on) done[id] = true; else delete done[id];
    if (cloud && user && fb) {
      var d = { done: {} };
      d.done[id] = on ? fb.f.serverTimestamp() : fb.f.deleteField();
      fb.f.setDoc(userRef(), d, { merge: true }).catch(function () {
        note = 'Could not save just now. Check your connection and try again.'; render();
        buddy('Oh no, that did not save. Try again?', 'sad');
      });
    } else if (!cloud) {
      lsSet('bs-done', done);
    }
    if (on) track('done-' + id, 'Done: ' + id);
    render();
    if (on) cheerDone(id);
  }
  function toggleDone(id) {
    if (cloud && !user) { signIn(); return; }      // the checklist belongs to a Google account
    if (!ready) return;
    setDone(id, !done[id]);
  }

  /* ================= sign-in area (top right) ================= */
  var G_LOGO = '<svg class="g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>';

  function avatar(u, cls) {
    var initial = esc(((u.displayName || u.email || '?').trim()[0] || '?').toUpperCase());
    return u.photoURL
      ? '<img class="' + cls + '" src="' + esc(u.photoURL) + '" alt="" referrerpolicy="no-referrer">'
      : '<span class="' + cls + ' initial">' + initial + '</span>';
  }
  function renderAuth() {
    var key = !cloud ? 'off' : !fb ? 'wait' : user ? 'in:' + user.uid : 'out';
    if (key === authKey) return;
    authKey = key;
    var box = $('auth');
    if (key === 'off' || key === 'wait') { box.innerHTML = ''; return; }
    if (!user) {
      box.innerHTML = '<button type="button" class="signin" id="signin">' + G_LOGO + '<span>Sign in</span></button>';
      return;
    }
    box.innerHTML =
      '<button type="button" class="me" id="me" aria-haspopup="true" aria-expanded="false" aria-label="Account: ' + esc(user.displayName || user.email || '') + '">' +
        avatar(user, 'av') + '</button>' +
      '<div class="menu" id="menu" hidden>' +
        '<div class="menu-who">' + avatar(user, 'av av-lg') +
          '<div><strong>' + esc(user.displayName || 'Signed in') + '</strong><span>' + esc(user.email || '') + '</span></div></div>' +
        '<button type="button" class="menu-out" id="signout">Sign out</button>' +
      '</div>';
  }
  function closeMenu() {
    var m = $('menu'), b = $('me');
    if (m && !m.hidden) { m.hidden = true; if (b) b.setAttribute('aria-expanded', 'false'); }
  }
  function toggleMenu() {
    var m = $('menu'), b = $('me');
    if (!m) return;
    m.hidden = !m.hidden;
    b.setAttribute('aria-expanded', m.hidden ? 'false' : 'true');
  }

  /* ================= sign-in gate: students sign in before they start ================= */
  var gateShown = null, puffTimer = null;
  function renderGate() {
    var gate = $('gate');
    if (!gate) return;
    var show = cloud && !user;
    document.body.classList.toggle('gated', show);
    gate.hidden = !show;
    var b = $('gate-signin');
    b.disabled = !fb;
    b.querySelector('span').textContent = fb ? 'Sign in with Google' : 'Loading…';
    if (show && fb && gateShown !== true) { b.focus(); }
    if (show && !puffTimer && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      puffTimer = setInterval(function () {
        var d = gate.querySelector('.bit');
        if (gate.hidden || !d) return;
        d.classList.remove('mood-idle'); d.classList.add('mood-fire');
        setTimeout(function () { d.classList.remove('mood-fire'); d.classList.add('mood-idle'); }, 1500);
      }, 6500);
    }
    if (!show && puffTimer) { clearInterval(puffTimer); puffTimer = null; }
    gateShown = show;
  }

  /* ================= Bit, the pixel mascot: short pop-up reactions ================= */
  var buddyTimer = null;
  var MOODS = ['mood-idle', 'mood-happy', 'mood-fire', 'mood-wow', 'mood-sad'];
  function buddy(text, mood) {
    var box = $('buddy');
    if (!box) return;
    $('buddy-say').textContent = text;
    var bit = box.querySelector('.bit');
    MOODS.forEach(function (m) { bit.classList.remove(m); });
    void bit.getBoundingClientRect();
    bit.classList.add('mood-' + (mood || 'happy'));
    box.hidden = false;
    box.classList.remove('out'); void box.offsetWidth; box.classList.add('in');
    clearTimeout(buddyTimer);
    buddyTimer = setTimeout(function () {
      box.classList.remove('in'); box.classList.add('out');
      buddyTimer = setTimeout(function () { box.hidden = true; box.classList.remove('out'); }, 300);
    }, mood === 'fire' ? 3800 : 3200);
  }
  function firstName() { return user && user.displayName ? user.displayName.split(' ')[0] : ''; }
  function nextUp() {
    for (var i = 0; i < rows.length; i++) if (!done[rows[i].id]) return rows[i];
    return null;
  }
  function greet() {
    var n = Object.keys(done).filter(function (k) { return $(k); }).length, nx = nextUp(), who = firstName();
    if (!n) buddy('Welcome' + (who ? ', ' + who : '') + '! Start with ' + (nx ? num(nx) + ' ' + title(nx) : 'any worksheet') + '.', 'wow');
    else if (!nx) buddy('All ' + TOTAL + ' done' + (who ? ', ' + who : '') + '. Legend!', 'fire');
    else buddy('Welcome back' + (who ? ', ' + who : '') + '! ' + n + ' done, ' + (TOTAL - n) + ' to go.', 'happy');
  }
  function cheerDone(id) {
    var n = rows.filter(function (li) { return done[li.id]; }).length;
    var li = $(id), mod = li && li.closest('.module');
    var modDone = mod && [].every.call(mod.querySelectorAll('.ws:not(.soon)'), function (x) { return done[x.id]; });
    if (n === TOTAL) buddy('ALL ' + TOTAL + ' DONE! You are on fire!', 'fire');
    else if (modDone) buddy('Module complete! ' + mod.querySelector('h2').textContent + ' is yours.', 'fire');
    else buddy(['Fired up!', 'Boom! Nice work.', 'One more down!', 'Brain +10!'][n % 4] + ' ' + n + ' of ' + TOTAL + ' done.', 'fire');
  }

  /* ================= rendering ================= */
  var q = $('q');
  function title(li) { return li.querySelector('h3').textContent; }
  function num(li) { return li.querySelector('.ws-no').textContent; }

  function render() {
    var tracking = !cloud || (!!user && ready);
    var terms = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    var shown = 0, nDone = 0, next = null;

    rows.forEach(function (li) {
      var isDone = tracking && !!done[li.id];
      if (isDone) nDone++; else if (!next) next = li;
      li.classList.toggle('is-done', isDone);
      var b = li.querySelector('.done');
      b.setAttribute('aria-pressed', isDone ? 'true' : 'false');
      b.setAttribute('aria-label', (isDone ? 'Done: ' : 'Mark done: ') + title(li));
      b.querySelector('.t').textContent = isDone ? 'Done' : 'Mark done';
    });
    topics.forEach(function (li) {
      var soon = li.classList.contains('soon');
      var ok = terms.every(function (t) { return li.getAttribute('data-search').indexOf(t) !== -1; });
      if (tracking && filter !== 'all') ok = ok && !soon && (filter === 'done') === li.classList.contains('is-done');
      li.hidden = !ok;
      if (ok) shown++;
    });
    [].forEach.call(document.querySelectorAll('.module'), function (m) {
      var mine = m.querySelector('.module-mine');
      var d = m.querySelectorAll('.ws.is-done').length;
      if (mine) mine.textContent = tracking && d ? ' · ' + d + ' done by you' : '';
      m.hidden = !m.querySelector('.ws:not([hidden])');
    });
    $('empty').hidden = shown !== 0;
    $('empty').textContent = filter === 'done' && !terms.length ? 'Nothing ticked off yet. Mark a worksheet done when you finish it.'
      : filter === 'todo' && !terms.length ? 'All done. Well played!' : 'No worksheet matches that search.';

    // progress panel
    var text = $('progress-text');
    $('progress').classList.toggle('is-out', !tracking);
    $('bar-fill').style.width = (tracking ? Math.round(100 * nDone / TOTAL) : 0) + '%';
    if (!ready) {
      text.textContent = 'Loading your progress…';
    } else if (!tracking) {
      text.innerHTML = '<button type="button" class="link" id="signin2">Sign in with Google</button> to tick off worksheets as you finish them and plan what to do next.';
    } else {
      var who = user && user.displayName ? esc(user.displayName.split(' ')[0]) + ', you have' : 'You have';
      var html = who + ' finished <strong>' + nDone + '</strong> of ' + TOTAL + ' worksheets.';
      if (next) html += ' <span class="next">Next up: <a href="#' + next.id + '" data-next="' + next.id + '">' + esc(num(next)) + ' ' + esc(title(next)) + '</a></span>';
      text.innerHTML = html;
    }
    $('progress-note').textContent = note ? note
      : !cloud ? 'Your ticks are saved in this browser on this device.'
      : user ? 'Saved to your Google account (' + (user.email || '') + '), on every device you sign in.'
      : '';
    [].forEach.call(document.querySelectorAll('#seg button'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-f') === filter ? 'true' : 'false');
    });

    renderAuth();
    renderGate();

    var vd = $('viewer-done');
    if (vd && viewerId) {
      var on = tracking && !!done[viewerId];
      vd.setAttribute('aria-pressed', on ? 'true' : 'false');
      vd.querySelector('.t').textContent = on ? 'Done' : 'Mark done';
    }
  }
  q.addEventListener('input', render);

  /* ================= inline video player ================= */
  function closePlayer(li) {
    var p = li.querySelector('.player');
    if (p) p.remove();
    var b = li.querySelector('.watch');
    if (b) b.setAttribute('aria-expanded', 'false');
  }
  function show(li, vids, i) {
    var p = li.querySelector('.player'), v = vids[i];
    // No autoplay: YouTube counts a view when the viewer presses play themselves.
    p.querySelector('.frame').innerHTML =
      '<iframe src="https://www.youtube-nocookie.com/embed/' + v.id + '?rel=0" title="' + esc(v.title) + '" ' +
      'loading="lazy" allowfullscreen allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
      'referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    p.querySelector('.player-foot strong').textContent = v.title;
    p.querySelector('.yt-like').setAttribute('data-vid', v.id);
    loadTotals(['v_' + v.id, 'channel']);
    paintReactions(p);
    [].forEach.call(p.querySelectorAll('.player-tabs button'), function (t, k) {
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
    var tabs = vids.length < 2 ? '' : '<div class="player-tabs" role="tablist">' + vids.map(function (v, i) {
      return '<button type="button" role="tab" data-i="' + i + '">Lecture ' + (i + 1) + '</button>';
    }).join('') + '</div>';
    // Like and Subscribe stay on this page: they toggle and celebrate, nothing opens YouTube.
    p.innerHTML = tabs + '<div class="frame"></div>' +
      '<div class="player-foot"><strong></strong>' +
        '<span class="yt-links">' +
          '<button type="button" class="yt-like" aria-pressed="false">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21h4V9H2v12zm20-11a2 2 0 0 0-2-2h-6.3l1-4.6v-.3c0-.4-.2-.8-.4-1.1L13.2 1 6.6 7.6C6.2 8 6 8.5 6 9v10a2 2 0 0 0 2 2h9c.8 0 1.5-.5 1.8-1.2l3-7.1c.1-.2.2-.5.2-.7v-2z"/></svg>' +
            '<span class="t">Like</span><span class="n"></span></button>' +
          '<button type="button" class="yt-sub" aria-pressed="false"><span class="t">Subscribe</span><span class="n"></span></button>' +
        '</span></div>';
    li.appendChild(p);
    p.addEventListener('click', function (e) {
      var t = e.target.closest('.player-tabs button');
      if (t) show(li, vids, +t.getAttribute('data-i'));
    });
    btn.setAttribute('aria-expanded', 'true');
    show(li, vids, 0);
    track('video-' + li.id, 'Video: ' + title(li));
  }

  /* ================= Like / Subscribe: on-page reactions with a little celebration =================
     Signed-in students: each like / subscribe is saved on their account (users/{uid}.reacts) and
     added to a public total (stats/v_<videoId>.likes, stats/channel.subs) in one batch, so the
     Firestore rules can check nobody counts twice. Without Firebase they stay in this browser. */
  var reacts = cloud ? {} : lsGet('bs-reacts', {});   // 'v_<videoId>' or 'channel' -> true
  var totals = {};                                    // same keys -> public count
  var asked = {};                                     // stats docs already fetched
  function likeKey(btn) { return 'v_' + btn.getAttribute('data-vid'); }
  function paintReactions(p) {
    var lk = p.querySelector('.yt-like'), sb = p.querySelector('.yt-sub');
    var k = likeKey(lk), on = !!reacts[k], sub = !!reacts.channel;
    lk.setAttribute('aria-pressed', on ? 'true' : 'false');
    lk.querySelector('.t').textContent = on ? 'Liked' : 'Like';
    lk.querySelector('.n').textContent = totals[k] > 0 ? String(totals[k]) : '';
    sb.setAttribute('aria-pressed', sub ? 'true' : 'false');
    sb.querySelector('.t').textContent = sub ? 'Subscribed ✓' : 'Subscribe';
    sb.querySelector('.n').textContent = totals.channel > 0 ? String(totals.channel) : '';
  }
  function repaintPlayers() { [].forEach.call(document.querySelectorAll('.player'), paintReactions); }
  function loadTotals(keys) {
    if (!fb) return;
    keys.forEach(function (k) {
      if (asked[k]) return;
      asked[k] = true;
      fb.f.getDoc(fb.f.doc(fb.db, 'stats', k)).then(function (snap) {
        var v = snap.exists() ? snap.data() : {};
        totals[k] = Math.max(0, (k === 'channel' ? v.subs : v.likes) || 0);
        repaintPlayers();
      }).catch(function () { asked[k] = false; });
    });
  }
  function celebrate(btn, icons, message) {
    var r = btn.getBoundingClientRect();
    var layer = document.createElement('div');
    layer.className = 'burst';
    layer.style.left = (r.left + r.width / 2) + 'px';
    layer.style.top = r.top + 'px';
    var html = '<span class="bubble">' + esc(message) + '</span>';
    for (var i = 0; i < 16; i++) {
      var dx = Math.round((Math.random() - .5) * 180), dy = -Math.round(70 + Math.random() * 120);
      html += '<span class="pc" style="--dx:' + dx + 'px;--dy:' + dy + 'px;--rot:' + Math.round((Math.random() - .5) * 90) +
        'deg;--d:' + Math.round(Math.random() * 180) + 'ms;--s:' + (0.8 + Math.random() * 0.7).toFixed(2) + '">' +
        icons[i % icons.length] + '</span>';
    }
    layer.innerHTML = html;
    document.body.appendChild(layer);
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
    setTimeout(function () { layer.remove(); }, 1800);
  }
  function react(btn) {
    if (cloud && !user) { signIn(); return; }          // a like counts once per Google account
    if (!ready) return;
    var isLike = btn.classList.contains('yt-like');
    var k = isLike ? likeKey(btn) : 'channel', on = !reacts[k];
    if (on) reacts[k] = true; else delete reacts[k];
    totals[k] = Math.max(0, (totals[k] || 0) + (on ? 1 : -1));
    if (cloud && fb) {
      var batch = fb.f.writeBatch(fb.db), mine = { reacts: {} }, stat = {};
      mine.reacts[k] = on ? fb.f.serverTimestamp() : fb.f.deleteField();
      stat[isLike ? 'likes' : 'subs'] = fb.f.increment(on ? 1 : -1);
      batch.set(userRef(), mine, { merge: true });
      batch.set(fb.f.doc(fb.db, 'stats', k), stat, { merge: true });
      batch.commit().catch(function () {                // undo on screen if it was not saved
        if (on) delete reacts[k]; else reacts[k] = true;
        totals[k] = Math.max(0, (totals[k] || 0) + (on ? -1 : 1));
        note = 'Could not save that just now. Please try again.';
        render(); repaintPlayers();
      });
    } else {
      lsSet('bs-reacts', reacts);
    }
    if (on) buddy(isLike ? 'Thanks for the like!' : 'Welcome to the crew!', isLike ? 'happy' : 'fire');
    if (on && isLike) celebrate(btn, ['❤️', '👍', '✨', '🎈', '🎉'], 'Thanks for the like!');
    if (on && !isLike) celebrate(btn, ['🎈', '🎉', '✨', '🔔', '⭐'], 'Welcome aboard!');
    repaintPlayers();
  }

  /* ================= clicks ================= */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest('#auth')) closeMenu();
    var w = t.closest('.watch');
    if (w) {
      e.preventDefault();
      var li = w.closest('.ws');
      if (w.getAttribute('aria-expanded') === 'true') closePlayer(li); else openPlayer(li, w);
      return;
    }
    var o = t.closest('.ws .open');
    if (o && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      location.hash = 'view-' + o.closest('.ws').id;          // the hash opens the viewer (Back closes it)
      return;
    }
    var y = t.closest('.yt-like, .yt-sub');
    if (y) { react(y); return; }
    var d = t.closest('.ws .done');
    if (d) { toggleDone(d.closest('.ws').id); return; }
    var f = t.closest('#seg button');
    if (f) { filter = f.getAttribute('data-f'); render(); return; }
    var n = t.closest('[data-next]');
    if (n) {
      e.preventDefault();
      if (filter === 'done') { filter = 'all'; render(); }
      var target = $(n.getAttribute('data-next'));
      target.scrollIntoView({ block: 'center' });
      target.classList.add('flash');
      setTimeout(function () { target.classList.remove('flash'); }, 1600);
      return;
    }
    if (t.closest('#signin') || t.closest('#signin2') || t.closest('#gate-signin')) { signIn(); return; }
    if (t.closest('#me')) { toggleMenu(); return; }
    if (t.closest('#signout')) { signOut(); return; }
    if (t.closest('#viewer-done') && viewerId) { toggleDone(viewerId); return; }
    if (t.closest('#viewer-close')) {
      history.replaceState(null, '', location.pathname + location.search);
      closeViewer();
    }
  });

  /* ================= worksheet viewer: shows the PDF pages inside the site ================= */
  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var viewer = $('viewer'), pages = $('viewer-pages');
  var pdfjsReady = null, job = 0, lastFocus = null, viewerId = null;

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
  function viewerNote(html) { pages.innerHTML = '<p class="viewer-note">' + html + '</p>'; }

  function openViewer(li) {
    var url = li.querySelector('.open').getAttribute('href');
    var mine = ++job;
    viewerId = li.id;
    lastFocus = document.activeElement;
    $('viewer-title').textContent = num(li) + '  ' + title(li);
    $('viewer-dl').href = url;
    viewer.hidden = false;
    document.body.classList.add('viewing');
    viewerNote('Loading worksheet…');
    $('viewer-close').focus();
    track('pdf-' + li.id, 'PDF: ' + title(li));
    render();

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
      viewerNote('The worksheet could not be shown here. <a href="' + url + '" target="_blank" rel="noopener">Open the PDF directly</a>.');
    });
  }
  function closeViewer() {
    job++;
    viewerId = null;
    viewer.hidden = true;
    pages.innerHTML = '';
    document.body.classList.remove('viewing');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function route() {
    var m = /^#view-(a\d+)$/.exec(location.hash);
    var li = m && $(m[1]);
    if (li && li.querySelector('.open')) openViewer(li); else if (!viewer.hidden) closeViewer();
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('menu') && !$('menu').hidden) { closeMenu(); $('me').focus(); }
    else if (!viewer.hidden) $('viewer-close').click();
  });

  render();
  route();
  if (cloud) cloudInit();
})();
