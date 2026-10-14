(function () {
  'use strict';

  const C = window.APP_CONFIG;
  const R = C.rules;
  const $ = (id) => document.getElementById(id);

  /* ---------------------------------------------------------- */
  /*  Translations (English + French, auto-detected)             */
  /* ---------------------------------------------------------- */
  const I18N = {
    en: {
      start: 'Start run', cancel: 'Cancel run',
      distance: 'Distance', time: 'Time', toStart: 'To start',
      hintIdle: 'Press Start, run a loop and come back to your start point to claim the area inside.',
      hintRun: 'Come back within {0} m of your start point (after at least {1} m) to claim your loop.',
      weakGps: 'Waiting for a better GPS signal…',
      tooFast: 'Too fast! Runs above {0} km/h are not counted. Run cancelled.',
      tooSmall: 'Loop too small ({0}). Minimum is {1}.',
      tooBig: 'Loop too big ({0}). Maximum is {1}.',
      badShape: "Couldn't make a valid shape from this run.",
      claimed: 'Claimed {0}!',
      stole: ' You took {0} from other players.',
      saveErr: "Couldn't save. Check your connection and the Firestore rules.",
      chooseName: 'Choose your name and color',
      save: 'Save', name: 'Name', color: 'Color',
      leaderboard: 'Leaderboard', close: 'Close', you: 'you',
      noData: 'No territory yet — be the first!',
      gpsDenied: 'Location permission denied. Allow location for this site in your browser settings.',
      gpsUnavailable: 'Position unavailable.',
      notConfigured: "Firebase isn't configured yet. Open config.js and paste your Firebase settings (see README).",
      sim: 'Simulation (test without moving)',
      signInErr: 'Sign-in failed. Enable Anonymous sign-in in Firebase Authentication.',
      dbErr: 'Database error. Check your Firestore rules.',
      confirmCancel: 'Cancel this run?',
      owner: 'Owner', area: 'Area',
      mapStreet: 'Street', mapSat: 'Satellite',
      nameShort: 'Name must be 2 to 20 characters.',
      noGps: 'This browser has no GPS support.'
    },
    fr: {
      start: 'Démarrer la course', cancel: 'Annuler la course',
      distance: 'Distance', time: 'Temps', toStart: 'Du départ',
      hintIdle: 'Appuie sur Démarrer, cours une boucle et reviens à ton point de départ pour conquérir la zone.',
      hintRun: 'Reviens à moins de {0} m de ton départ (après au moins {1} m de course) pour valider ta boucle.',
      weakGps: "En attente d'un meilleur signal GPS…",
      tooFast: "Trop rapide ! Au-delà de {0} km/h, ce n'est pas compté. Course annulée.",
      tooSmall: 'Boucle trop petite ({0}). Minimum : {1}.',
      tooBig: 'Boucle trop grande ({0}). Maximum : {1}.',
      badShape: "Impossible de créer une zone valide avec ce parcours.",
      claimed: 'Zone conquise : {0} !',
      stole: ' Tu as pris {0} aux autres joueurs.',
      saveErr: "Enregistrement impossible. Vérifie ta connexion et les règles Firestore.",
      chooseName: 'Choisis ton nom et ta couleur',
      save: 'Enregistrer', name: 'Nom', color: 'Couleur',
      leaderboard: 'Classement', close: 'Fermer', you: 'toi',
      noData: "Aucun territoire pour l'instant — sois le premier !",
      gpsDenied: "Localisation refusée. Autorise-la pour ce site dans les réglages du navigateur.",
      gpsUnavailable: 'Position indisponible.',
      notConfigured: "Firebase n'est pas configuré. Ouvre config.js et colle tes paramètres Firebase (voir README).",
      sim: 'Simulation (tester sans bouger)',
      signInErr: "Connexion impossible. Active la connexion anonyme dans Firebase Authentication.",
      dbErr: 'Erreur de base de données. Vérifie les règles Firestore.',
      confirmCancel: 'Annuler cette course ?',
      owner: 'Propriétaire', area: 'Surface',
      mapStreet: 'Plan', mapSat: 'Satellite',
      nameShort: 'Le nom doit faire 2 à 20 caractères.',
      noGps: "Ce navigateur ne gère pas le GPS."
    }
  };
  const lang = (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  function t(key, ...args) {
    let s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    args.forEach((v, i) => { s = s.split('{' + i + '}').join(v); });
    return s;
  }
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });

  /* ---------------------------------------------------------- */
  /*  Small helpers                                              */
  /* ---------------------------------------------------------- */
  const rnd = (n) => Math.round(n * 1e6) / 1e6;
  function roundCoords(c) { return typeof c[0] === 'number' ? [rnd(c[0]), rnd(c[1])] : c.map(roundCoords); }
  const dist = (a, b) => turf.distance([a.lng, a.lat], [b.lng, b.lat], { units: 'meters' });
  const feat = (geometry) => ({ type: 'Feature', properties: {}, geometry });

  function fmtArea(m2) {
    if (m2 >= 1e6) return (m2 / 1e6).toFixed(2) + ' km²';
    return Math.round(m2).toLocaleString() + ' m²';
  }
  function fmtDist(m) {
    return m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m) + ' m';
  }
  function fmtTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  let toastTimer = null;
  function toast(msg, ms) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    if (ms !== 0) toastTimer = setTimeout(() => { el.hidden = true; }, ms || 5000);
  }
  $('toast').addEventListener('click', () => { $('toast').hidden = true; });

  /* ---------------------------------------------------------- */
  /*  Map                                                        */
  /* ---------------------------------------------------------- */
  const map = L.map('map', { zoomControl: false }).setView(C.defaultCenter, 15);
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap contributors'
  });
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Tiles © Esri'
  });
  osm.addTo(map);
  const baseLayers = {};
  baseLayers[t('mapStreet')] = osm;
  baseLayers[t('mapSat')] = sat;
  L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

  const territoryGroup = L.layerGroup().addTo(map);
  const liveGroup = L.layerGroup().addTo(map);
  let meMarker = null;
  let trailLine = null;

  function updateMeMarker(p) {
    if (!meMarker) {
      meMarker = L.circleMarker([p.lat, p.lng], {
        radius: 8, color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1
      }).addTo(map);
    } else {
      meMarker.setLatLng([p.lat, p.lng]);
    }
  }

  function onGeoErr(e) {
    if (e.code === 1) {
      toast(t('gpsDenied'), 0);
      if (run.active) { stopTracking(); clearLive(); resetRun(); }
    } else if (e.code === 2) {
      toast(t('gpsUnavailable'));
    }
    // code 3 (timeout): just keep waiting
  }

  function locateMe(zoom, silent) {
    if (!navigator.geolocation) { if (!silent) toast(t('noGps')); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      updateMeMarker(p);
      map.setView([p.lat, p.lng], zoom);
    }, silent ? () => {} : onGeoErr, { enableHighAccuracy: true, timeout: 15000 });
  }
  $('btnLocate').addEventListener('click', () => locateMe(17, false));
  locateMe(16, true);

  /* ---------------------------------------------------------- */
  /*  Firebase                                                   */
  /* ---------------------------------------------------------- */
  const configured = C.firebase && C.firebase.apiKey && !/^PASTE/.test(C.firebase.apiKey);
  let db = null, auth = null;
  let uid = null;
  const players = {};      // uid -> {name, color}
  const territories = {};  // id  -> {id, uid, area, geom, bbox}
  const layers = {};       // id  -> leaflet layer
  let askedProfile = false;

  const colorOf = (u) => (players[u] && players[u].color) || '#888888';
  const nameOf = (u) => (players[u] && players[u].name) || '???';

  function removeLayer(id) {
    if (layers[id]) { territoryGroup.removeLayer(layers[id]); delete layers[id]; }
  }
  function drawTerritory(tr) {
    removeLayer(tr.id);
    const col = colorOf(tr.uid);
    const l = L.geoJSON(feat(tr.geom), {
      style: () => ({ color: col, weight: tr.uid === uid ? 3 : 1.5, fillColor: col, fillOpacity: 0.4 })
    });
    l.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      const box = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = nameOf(tr.uid);
      const info = document.createElement('div');
      info.textContent = t('area') + ': ' + fmtArea(tr.area);
      box.appendChild(strong);
      box.appendChild(info);
      L.popup().setLatLng(e.latlng).setContent(box).openOn(map);
    });
    l.addTo(territoryGroup);
    layers[tr.id] = l;
  }
  function redrawAll() { Object.values(territories).forEach(drawTerritory); }

  function totals() {
    const m = {};
    Object.values(territories).forEach((tr) => { m[tr.uid] = (m[tr.uid] || 0) + tr.area; });
    return Object.keys(m).map((u) => ({ uid: u, area: m[u] })).sort((a, b) => b.area - a.area);
  }

  function renderChip() {
    const me = players[uid];
    if (!me) return;
    $('chipDot').style.background = me.color;
    const mine = totals().find((r) => r.uid === uid);
    $('chipName').textContent = me.name + (mine ? ' · ' + fmtArea(mine.area) : '');
  }

  function renderBoard() {
    renderChip();
    const list = $('boardList');
    list.textContent = '';
    const rows = totals();
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = t('noData');
      list.appendChild(li);
      return;
    }
    const addRow = (r, i) => {
      const li = document.createElement('li');
      if (r.uid === uid) li.className = 'me';
      const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = String(i + 1);
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = colorOf(r.uid);
      const nm = document.createElement('span'); nm.className = 'nm';
      nm.textContent = nameOf(r.uid) + (r.uid === uid ? ' (' + t('you') + ')' : '');
      const ar = document.createElement('span'); ar.className = 'ar'; ar.textContent = fmtArea(r.area);
      li.append(rank, dot, nm, ar);
      list.appendChild(li);
    };
    rows.slice(0, 20).forEach(addRow);
    const myIdx = rows.findIndex((r) => r.uid === uid);
    if (myIdx >= 20) addRow(rows[myIdx], myIdx);
  }

  function startListeners() {
    db.collection('players').onSnapshot((snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') delete players[ch.doc.id];
        else players[ch.doc.id] = ch.doc.data();
      });
      redrawAll();
      renderBoard();
      if (!players[uid] && !askedProfile) { askedProfile = true; openProfile(true); }
    }, (err) => { console.error(err); toast(t('dbErr'), 0); });

    db.collection('territories').onSnapshot((snap) => {
      snap.docChanges().forEach((ch) => {
        const id = ch.doc.id;
        if (ch.type === 'removed') { removeLayer(id); delete territories[id]; return; }
        const d = ch.doc.data();
        let geom;
        try { geom = JSON.parse(d.geometry); } catch (e) { return; }
        territories[id] = { id, uid: d.uid, area: d.area || 0, geom, bbox: turf.bbox(feat(geom)) };
        drawTerritory(territories[id]);
      });
      renderBoard();
    }, (err) => { console.error(err); toast(t('dbErr'), 0); });
  }

  if (!configured) {
    toast(t('notConfigured'), 0);
  } else {
    firebase.initializeApp(C.firebase);
    auth = firebase.auth();
    db = firebase.firestore();
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        try { await auth.signInAnonymously(); }
        catch (e) { console.error(e); toast(t('signInErr'), 0); }
        return;
      }
      uid = user.uid;
      startListeners();
    });
  }

  /* ---------------------------------------------------------- */
  /*  Profile (name + color)                                     */
  /* ---------------------------------------------------------- */
  const COLORS = ['#e63946', '#f77f00', '#fcbf49', '#2a9d8f', '#06d6a0', '#3a86ff', '#8338ec', '#ff006e'];
  let pickedColor = COLORS[0];
  let profileMandatory = false;

  function buildSwatches() {
    const box = $('pfColors');
    box.textContent = '';
    COLORS.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = c;
      if (c === pickedColor) b.className = 'sel';
      b.addEventListener('click', () => { pickedColor = c; buildSwatches(); });
      box.appendChild(b);
    });
  }
  function openProfile(first) {
    profileMandatory = !!first;
    const me = players[uid];
    $('pfName').value = me ? me.name : 'Runner' + Math.floor(1000 + Math.random() * 9000);
    pickedColor = me ? me.color : COLORS[Math.floor(Math.random() * COLORS.length)];
    buildSwatches();
    $('pfCancel').hidden = profileMandatory;
    $('mdProfile').hidden = false;
  }
  $('pfCancel').addEventListener('click', () => { $('mdProfile').hidden = true; });
  $('pfSave').addEventListener('click', async () => {
    const name = $('pfName').value.trim();
    if (name.length < 2 || name.length > 20) { toast(t('nameShort')); return; }
    try {
      await db.collection('players').doc(uid).set({
        name, color: pickedColor, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      $('mdProfile').hidden = true;
    } catch (e) { console.error(e); toast(t('saveErr')); }
  });
  $('btnPlayer').addEventListener('click', () => { if (uid && configured) openProfile(false); });
  $('btnBoard').addEventListener('click', () => { renderBoard(); $('mdBoard').hidden = false; });
  $('bdClose').addEventListener('click', () => { $('mdBoard').hidden = true; });

  /* ---------------------------------------------------------- */
  /*  Run tracking                                               */
  /* ---------------------------------------------------------- */
  const run = {};
  function resetRun() {
    run.active = false;
    run.isSim = false;
    run.pts = [];
    run.dist = 0;
    run.fast = 0;
    run.startTs = 0;
    run.watchId = null;
    run.simTimer = null;
    run.clock = null;
    run.wake = null;
    run.finishing = false;
  }
  resetRun();

  function setHint(msg) { $('hint').textContent = msg; }
  function setUI() {
    const b = $('btnMain');
    b.textContent = run.active ? t('cancel') : t('start');
    b.classList.toggle('danger', run.active);
    $('simBox').disabled = run.active;
  }
  function clearLive() {
    liveGroup.clearLayers();
    trailLine = null;
    $('stDist').textContent = '0 m';
    $('stTime').textContent = '0:00';
    $('stStart').textContent = '—';
  }
  function elapsedMs() {
    if (!run.pts.length) return 0;
    if (run.isSim) return run.pts[run.pts.length - 1].ts - run.pts[0].ts;
    return Date.now() - run.startTs;
  }
  function updateStats() {
    $('stDist').textContent = fmtDist(run.dist);
    $('stTime').textContent = fmtTime(elapsedMs());
    if (run.pts.length) {
      $('stStart').textContent = fmtDist(dist(run.pts[run.pts.length - 1], run.pts[0]));
    }
  }

  async function lockScreen() {
    try {
      if ('wakeLock' in navigator) run.wake = await navigator.wakeLock.request('screen');
    } catch (e) { /* not supported or refused: ignore */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && run.active && !run.isSim) lockScreen();
  });

  function stopTracking() {
    run.active = false;
    if (run.watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(run.watchId);
    run.watchId = null;
    if (run.simTimer) clearInterval(run.simTimer);
    run.simTimer = null;
    if (run.clock) clearInterval(run.clock);
    run.clock = null;
    if (run.wake) { run.wake.release().catch(() => {}); run.wake = null; }
    setUI();
  }

  function startRun() {
    if (!configured) { toast(t('notConfigured'), 0); return; }
    if (!uid) return;
    if (!players[uid]) { openProfile(true); return; }
    resetRun();
    clearLive();
    run.active = true;
    run.isSim = !!(C.allowSimulation && $('simBox').checked);
    run.startTs = Date.now();
    trailLine = L.polyline([], { color: players[uid].color, weight: 5, opacity: 0.95 }).addTo(liveGroup);
    setUI();
    setHint(t('hintRun', R.closeDistanceM, R.minLoopLengthM));
    run.clock = setInterval(updateStats, 1000);

    if (run.isSim) {
      startSim();
    } else {
      if (!navigator.geolocation) { toast(t('noGps')); stopTracking(); return; }
      lockScreen();
      run.watchId = navigator.geolocation.watchPosition((pos) => {
        handlePoint({
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          acc: pos.coords.accuracy || 0, ts: pos.timestamp || Date.now()
        });
      }, onGeoErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    }
  }

  function cancelRun() {
    if (!confirm(t('confirmCancel'))) return;
    stopTracking();
    clearLive();
    resetRun();
    setHint(t('hintIdle'));
  }

  function handlePoint(p) {
    updateMeMarker(p);
    if (!run.active || run.finishing) return;

    if (p.acc > R.maxAccuracyM) { setHint(t('weakGps')); return; }
    setHint(t('hintRun', R.closeDistanceM, R.minLoopLengthM));

    const last = run.pts[run.pts.length - 1];
    if (!last) {
      run.pts.push(p);
      L.circle([p.lat, p.lng], {
        radius: R.closeDistanceM, color: players[uid].color, weight: 2,
        dashArray: '4 4', fillOpacity: 0.15
      }).addTo(liveGroup);
      trailLine.addLatLng([p.lat, p.lng]);
      map.setView([p.lat, p.lng], Math.max(map.getZoom(), 17));
      updateStats();
      return;
    }

    const step = dist(last, p);
    if (step < R.minStepM) { checkClose(p); return; }

    const dt = Math.max((p.ts - last.ts) / 1000, 0.5);
    const kmh = (step / dt) * 3.6;
    if (kmh > R.maxSpeedKmh) {
      run.fast += 1;
      if (run.fast >= 3) {
        stopTracking(); clearLive(); resetRun();
        toast(t('tooFast', R.maxSpeedKmh));
        setHint(t('hintIdle'));
      }
      return; // ignore this jumpy point
    }
    run.fast = 0;

    run.pts.push(p);
    run.dist += step;
    trailLine.addLatLng([p.lat, p.lng]);
    map.panTo([p.lat, p.lng], { animate: true });
    updateStats();
    checkClose(p);
  }

  function checkClose(p) {
    if (run.pts.length < 8 || run.dist < R.minLoopLengthM) return;
    if (dist(p, run.pts[0]) <= R.closeDistanceM) finishRun();
  }

  /* ---------------------------------------------------------- */
  /*  Simulation (test at your desk)                             */
  /* ---------------------------------------------------------- */
  function startSim() {
    const c = map.getCenter();
    const side = 250, step = 12;
    const mLat = 1 / 111320;
    const mLng = 1 / (111320 * Math.cos(c.lat * Math.PI / 180));
    const corners = [[0, 0], [side, 0], [side, side], [0, side], [0, 0]];
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[i + 1];
      const n = Math.round(side / step);
      for (let k = 0; k < n; k++) {
        pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
      }
    }
    pts.push([0, 0]);
    let i = 0, ts = Date.now();
    run.simTimer = setInterval(() => {
      if (!run.active) return;
      if (i >= pts.length) { stopTracking(); clearLive(); resetRun(); return; }
      const xy = pts[i++];
      ts += 4000; // pretend 4 s pass between points (~10 km/h)
      handlePoint({ lat: c.lat + xy[1] * mLat, lng: c.lng + xy[0] * mLng, acc: 5, ts });
    }, 150);
  }

  /* ---------------------------------------------------------- */
  /*  Claiming territory                                         */
  /* ---------------------------------------------------------- */
  async function finishRun() {
    if (run.finishing) return;
    run.finishing = true;
    const ring = run.pts.map((p) => [rnd(p.lng), rnd(p.lat)]);
    ring.push(ring[0]);
    stopTracking();
    clearLive();
    try {
      await claim(ring);
    } finally {
      resetRun();
      setUI();
      setHint(t('hintIdle'));
    }
  }

  async function claim(ring) {
    let poly;
    try {
      poly = turf.polygon([ring]);
      if (turf.kinks(poly).features.length) {
        // The route crossed itself (e.g. a figure 8): keep every part.
        const parts = turf.unkinkPolygon(poly).features;
        poly = parts.reduce((acc, f) => turf.union(acc, f));
      }
    } catch (e) {
      console.error(e);
      toast(t('badShape'));
      return;
    }
    if (!poly) { toast(t('badShape')); return; }

    const area = turf.area(poly);
    if (area < R.minAreaM2) { toast(t('tooSmall', fmtArea(area), fmtArea(R.minAreaM2))); return; }
    if (area > R.maxAreaM2) { toast(t('tooBig', fmtArea(area), fmtArea(R.maxAreaM2))); return; }

    const newBbox = turf.bbox(poly);
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    let ops = 0;
    let stolen = 0;

    Object.values(territories).forEach((tr) => {
      const b = tr.bbox;
      if (b[0] > newBbox[2] || b[2] < newBbox[0] || b[1] > newBbox[3] || b[3] < newBbox[1]) return;
      const g = feat(tr.geom);
      let hit = false;
      try { hit = turf.booleanIntersects(g, poly); } catch (e) { return; }
      if (!hit) return;
      let diff = null;
      try { diff = turf.difference(g, poly); } catch (e) { return; }
      const ref = db.collection('territories').doc(tr.id);
      const left = diff ? turf.area(diff) : 0;
      if (!diff || left < 1) {
        batch.delete(ref);
        if (tr.uid !== uid) stolen += tr.area;
      } else {
        batch.update(ref, {
          geometry: JSON.stringify(roundCoordsGeom(diff.geometry)),
          area: left, updatedAt: now
        });
        if (tr.uid !== uid) stolen += Math.max(0, tr.area - left);
      }
      ops += 1;
    });

    if (ops > 450) { toast(t('tooBig', fmtArea(area), fmtArea(R.maxAreaM2))); return; }

    const newRef = db.collection('territories').doc();
    batch.set(newRef, {
      uid,
      geometry: JSON.stringify(roundCoordsGeom(poly.geometry)),
      area, createdAt: now, updatedAt: now
    });

    try {
      await batch.commit();
      let msg = t('claimed', fmtArea(area));
      if (stolen >= 1) msg += t('stole', fmtArea(stolen));
      toast(msg, 8000);
    } catch (e) {
      console.error(e);
      toast(t('saveErr'));
    }
  }
  function roundCoordsGeom(g) { return { type: g.type, coordinates: roundCoords(g.coordinates) }; }

  /* ---------------------------------------------------------- */
  /*  Start-up                                                   */
  /* ---------------------------------------------------------- */
  $('btnMain').addEventListener('click', () => { if (run.active) cancelRun(); else startRun(); });
  if (C.allowSimulation) $('simRow').hidden = false;
  setUI();
  setHint(t('hintIdle'));
})();
