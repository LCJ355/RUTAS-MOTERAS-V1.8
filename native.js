/* Native-style shell for WEB-V1.8. Reuses the mobile web engine. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const norm = s => ('' + s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const toast = (m, t) => { try { window.toast ? window.toast(m, t) : nvToast(m); } catch { nvToast(m); } };
  let activeTab = 'fuentes';
  let routeBarHidden = false;
  let nearRadius = Number(localStorage.getItem('nv:nearRadius') || 30);
  if (![30, 50, 100, 150].includes(nearRadius)) nearRadius = 30;
  let nearPos = null;
  let routeInfoOpen = false;
  let searchReturn = 'route';
  let searchTarget = 'lookup';
  let compassOn = false;
  let heading = 0;
  let orientHandler = null;
  let geoWatch = null;
  let compassPos = null;
  

  function nvToast(msg) {
    const el = document.createElement('div');
    el.className = 'nv-toast'; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function buildShell() {
    if ($('#nv-top')) return;
    const html = `
      <header id="nv-top">
        <button id="nv-poi" class="nv-ring nv-50" aria-label="Fuentes y puntos de interés"><img src="assets/hd_logo.png" alt=""></button>
        <button id="nv-search" aria-label="Buscar fuente, pueblo o código postal"><span class="nv-mag">🔍</span><span class="nv-ph">¿A dónde?</span></button>
        <div id="nv-right">
          <button id="nv-layers" class="nv-ring nv-50" aria-label="Capas del mapa">🗺️</button>
          <button id="nv-weather" class="nv-ring nv-38" aria-label="Clima">🌦️</button>
        </div>
      </header>
      <div id="nv-left"><button id="nv-mode" class="nv-ring nv-38" aria-label="Modo brújula"><svg class="nv-compass-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 3.8 15.2 12H8.8L12 3.8Z" fill="#ff6a00"/><path d="M12 20.2 L8.8 12 L15.2 12 Z" fill="#d8dee6"/><circle cx="12" cy="12" r="1.3" fill="#fff"/></svg></button></div>
      <div id="nv-rose" aria-hidden="true"><div id="nv-rose-deg">0°N</div><canvas id="nv-rose-canvas"></canvas></div>
      <div id="nv-zoom"><button id="nv-zoom-in" aria-label="Acercar">+</button><button id="nv-zoom-out" aria-label="Alejar">−</button></div>
      <button id="nv-locate" aria-label="Centrar en mi ubicación"><svg class="nv-target-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.4" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="2.1" fill="currentColor"/><path d="M12 1.6v5.2M12 17.2v5.2M1.6 12h5.2M17.2 12h5.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button>
      <div id="nv-routebar">
        <button class="nv-nav" id="nv-nav" aria-label="Seguir ruta">▲</button>
        <div class="nv-route-main" id="nv-route-main"><strong id="nv-route-title">Ruta</strong><small id="nv-route-sub">Pulsa para ver detalles</small></div>
        <button class="nv-profile" id="nv-profile" aria-label="Perfil de altura">▥</button>
      </div>
      <nav id="nv-bottom" aria-label="Navegación principal">
        <button class="nv-tab" data-nv-action="map" aria-label="Mapa y ruta">🏍️</button>
        <button class="nv-tab" data-nv-action="settings" aria-label="Ruta">⚙️</button>
        <button class="nv-tab" data-nv-action="near" aria-label="Fuentes cerca de ti">⛲</button>
        <button class="nv-tab" data-nv-action="tools" aria-label="Datos y rutas guardadas">☰</button>
        <button class="nv-tab info" data-nv-action="credits" aria-label="Créditos"><svg class="nv-info-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="7.4" r="1.25" fill="currentColor"/><path d="M12 10.5v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </nav>
      <div id="nv-page-near" class="nv-page">
        <div class="nv-page-head"><button class="nv-back" data-nv-page-close aria-label="Volver al mapa">←</button><h2>⛲ Fuentes cerca de ti</h2><button class="nv-mini" id="nv-near-refresh" aria-label="Actualizar ubicación">🎯</button></div>
        <div class="nv-page-body">
          <div class="nv-radius" id="nv-near-radius"><button data-nv-radius="30">30 km</button><button data-nv-radius="50">50 km</button><button data-nv-radius="100">100 km</button><button data-nv-radius="150">150 km</button><button id="nv-near-search" class="nv-radius-search" aria-label="Buscar">🔍</button></div>
          <div id="nv-near-count">Obteniendo ubicación…</div>
          <div id="nv-near-list"></div>
        </div>
      </div>
      <div id="nv-page-route" class="nv-page">
        <div class="nv-page-head"><button class="nv-back" data-nv-page-close aria-label="Volver al mapa">←</button><h2>🛵 Ruta</h2><button class="nv-mini" id="nv-route-reset-page" aria-label="Restablecer ruta">↺</button></div>
        <div class="nv-page-body">
          <button class="nv-point-card" id="nv-start-card"><span>SALIDA</span><strong id="nv-start-name">Elegir salida</strong><small id="nv-start-cp"></small></button>
          <button class="nv-point-card dest" id="nv-end-card"><span>DESTINO</span><strong id="nv-end-name">Elegir destino</strong><small id="nv-end-cp"></small></button>
          <div class="nv-wp-head"><strong>Paradas</strong><button id="nv-add-wp">+ Añadir</button></div>
          <div id="nv-route-wps"></div>
          <div id="nv-route-page-summary">Define salida y destino para calcular la ruta.</div>
          <button class="nv-primary" id="nv-calc-page">Calcular ruta</button>
          <div class="nv-secondary-row"><button id="nv-gps-route">🎯 GPS</button><button id="nv-manual-route">✋ Manual</button><button id="nv-weather-route-page">🌦️ Clima</button></div>
          <div class="nv-secondary-row"><button id="nv-poi-route">📍 POIs</button><button id="nv-gpx-route">🧭 GPX</button><button id="nv-traffic-route">🚦 Tráfico</button></div>
          <div class="nv-secondary-row"><button id="nv-share-maps-page">🗺️ Google Maps</button><button id="nv-share-wa-page">💬 WhatsApp</button></div>
          <div class="nv-secondary-row"><button id="nv-save-page">Guardar</button><button id="nv-share-page">Compartir</button><button id="nv-routes-page">Mis rutas</button></div>
          <button id="nv-reset-page" style="width:100%;margin-top:8px;padding:9px;border-radius:12px;border:1px solid #ffd3cf;background:#fff0ef;color:#b42318;font-weight:700">Reset completo</button>
          <button class="nv-secondary-row" id="nv-view-map" style="width:100%;margin-top:8px;padding:10px;border-radius:12px;border:1px solid var(--border);background:#fff;color:#333;font-weight:700">Ver mapa</button>
        </div>
      </div>
      <div id="nv-routeinfo">
        <div class="nv-ri-row">
          <button class="nv-ri-main" id="nv-ri-start"><strong id="nv-ri-start-name">🏁 Salida 🔍</strong></button>
          <button class="nv-ri-mini" id="nv-ri-gps">📍 GPS</button>
          <button class="nv-ri-mini" id="nv-ri-start-manual">✋ Manual</button>
        </div>
        <div class="nv-ri-row">
          <button class="nv-ri-main" id="nv-ri-wps"><strong id="nv-ri-wps-name">➕ Paradas: 0/10 🔍</strong></button>
          <button class="nv-ri-mini" id="nv-ri-wp-manual">✋ Manual</button>
        </div>
        <div class="nv-ri-row">
          <button class="nv-ri-main" id="nv-ri-end"><strong id="nv-ri-end-name">🎯 Destino 🔍</strong></button>
          <button class="nv-ri-mini" id="nv-ri-end-manual">✋ Manual</button>
        </div>
        <div class="nv-ri-actions">
          <button id="nv-ri-undo">↩️ Atrás</button>
          <button id="nv-ri-calc">Calcular</button>
          <button id="nv-ri-reset">🗑️ Reset</button>
        </div>
      </div>
      <button id="nv-close" aria-label="Volver al mapa">←</button>
      <div id="nv-manual-pick" aria-hidden="true">
        <div id="nv-manual-target" aria-hidden="true"></div>
        <div id="nv-manual-tag"><span id="nv-manual-label">SALIDA</span><button id="nv-manual-cancel" aria-label="Cancelar selección manual">✕</button></div>
        <button id="nv-manual-add" aria-label="Fijar punto">＋</button>
      </div>
      <div id="nv-sheet-layers" class="nv-sheet">
        <div class="nv-sheet-head"><h3>Capas del mapa</h3><button class="nv-sheet-close" data-nv-close-sheet>✕</button></div>
        <div class="nv-choice">
          <button data-nv-layer="osm">OSM</button><button data-nv-layer="topo">Topo</button>
          <button data-nv-layer="cyclo">CyclOSM</button><button data-nv-layer="sat">Satélite</button>
          <button id="nv-traffic-layer">🚦 Tráfico DGT</button>
        </div>
      </div>
      <div id="nv-sheet-poi" class="nv-sheet">
        <div class="nv-sheet-head"><h3>POIs cerca de ti</h3><button class="nv-sheet-close" data-nv-close-sheet>✕</button></div>
        <div class="nv-choice">
          <button data-nv-poi-kind="dealer">🏍️ Concesionarios H-D</button><button data-nv-poi-kind="fuel">⛽ Gasolina</button>
          <button data-nv-poi-kind="restaurant">🍴 Restaurantes</button><button data-nv-poi-kind="hotel">🛏️ Alojamiento</button>
          <button data-nv-poi-kind="parking">🅿️ Aparcamiento</button><button data-nv-poi-kind="drinking_water">💧 Fuentes de agua</button>
          <button data-nv-poi-kind="hospital">🏥 Hospitales</button><button data-nv-poi-kind="car_repair">🔧 Talleres</button>
          <button data-nv-poi-kind="supermarket">🛒 Supermercados</button>
        </div>
        <button class="nv-sheet-close" id="nv-poi-clear" style="width:100%;margin-top:10px;border-radius:12px">Quitar POIs</button>
      </div>
      <div id="nv-sheet-poi-card" class="nv-sheet">
        <div class="nv-sheet-head"><h3 id="nv-pc-kind">POI</h3><button class="nv-sheet-close" data-nv-close-sheet>✕</button></div>
        <div id="nv-pc-body"></div>
      </div>
      <div id="nv-sheet-profile" class="nv-sheet">
        <div class="nv-sheet-head"><h3>📈 Perfil de altura</h3><button class="nv-sheet-close" data-nv-close-sheet>✕</button></div>
        <div id="nv-profile-chart" class="nv-profile-chart"></div>
      </div>
      <div id="nv-sheet-credits" class="nv-sheet">
        <div class="nv-sheet-head"><h3>Créditos · Nativa V-1.8</h3><button class="nv-sheet-close" data-nv-close-sheet>✕</button></div>
        <div class="nv-credits">
          <img class="nv-credits-photo" src="assets/hd_logo.png" alt="Harley-Davidson">
          <div class="nv-credits-kicker">IDEA ORIGINAL DE</div>
          <div class="nv-credits-name">LUCIANO CJ</div>
          <div class="nv-credits-rule"></div>
          <div class="nv-credits-quote">“No me copies sino es para mejorarme”</div>
          <div class="nv-credits-meta">Rutas Moteras -Fuentes de Andalucía- · 13.719 fuentes</div>
          <div class="nv-credits-meta">Versión nativa V-1.8 · Android Kotlin + osmdroid</div>
        </div>
        <button class="nv-primary" id="nv-credits-close">ACEPTAR</button>
      </div>
      <div id="nv-sheet-settings" class="nv-sheet">
        <div class="nv-sheet-head"><h3>⚙️ Ruta</h3><button class="nv-sheet-close" data-nv-close-sheet>✕</button></div>
        <div class="nv-choice">
          <button data-nv-settings="share">🔗 Compartir</button>
          <button data-nv-settings="save">💾 Guardar</button>
          <button data-nv-settings="record">⏺️ Grabar recorrido</button>
          <button data-nv-settings="routes">📁 Mis rutas guardadas</button>
        </div>
      </div>
      <div id="nv-sheet-share" class="nv-sheet">
        <div class="nv-sheet-head"><h3>Compartir ruta</h3><button class="nv-sheet-close" data-nv-close-sheet>✕</button></div>
        <div class="nv-choice">
          <button id="nv-share-app">📤 Compartir (elegir app)</button>
          <button id="nv-share-wa">🟢 WhatsApp</button>
          <button id="nv-share-maps">🗺️ Abrir en Google Maps</button>
        </div>
      </div>
      <div id="nv-sheet-record" class="nv-sheet">
        <div class="nv-sheet-head"><h3>⏺️ Grabar ruta</h3><button class="nv-sheet-close" data-nv-close-sheet>✕</button></div>
        <div id="nv-record-text" style="font-size:14px;color:#333;margin:6px 0 14px">Pulsa INICIAR para grabar tu recorrido.</div>
        <button class="nv-primary" id="nv-record-btn">INICIAR GRABACIÓN</button>
      </div>
      <div id="nv-sheet-weather" class="nv-sheet">
        <div class="nv-sheet-head"><h3>Nubes, radar y clima</h3><button class="nv-sheet-close" data-nv-close-sheet>✕</button></div>
        <div class="nv-choice">
          <button id="nv-nasa-toggle">🛰️ NASA (nubes)</button>
          <button id="nv-radar-toggle">🌧️ Radar de lluvia</button>
          <button id="nv-weather-here-menu">☀️ Clima aquí</button>
          <button id="nv-weather-route-menu">🌦️ Clima en ruta</button>
        </div>
        <div id="nv-weather-route-controls" style="display:none;margin-top:10px">
          <div class="nv-search-row"><input type="date" id="nv-weather-date" aria-label="Fecha del pronóstico"><button class="nv-primary" id="nv-weather-go" style="width:auto;padding:9px 12px;margin:0">Ver</button></div>
        </div>
        <div id="nv-weather-view" style="margin-top:10px;font-size:13px"></div>
      </div>
      <div id="nv-search-sheet" class="nv-sheet">
        <div class="nv-sheet-head"><h3 id="nv-search-title">Buscar</h3><button class="nv-sheet-close" data-nv-close-sheet>✕</button></div>
        <div class="nv-search-row"><input id="nv-search-input" type="search" enterkeyhint="search" placeholder="Fuente, pueblo o CP…" autocomplete="off"><button id="nv-search-clear" class="nv-sheet-close" aria-label="Limpiar">✕</button></div>
        <div id="nv-search-results"></div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    if (window.map && typeof window.map.on === 'function' && !window.__nvRoseMapBound) {
      window.__nvRoseMapBound = true;
      window.map.on('move zoom resize', placeRoseOnMap);
    }
    const tools = document.getElementById('tools-panel');
    bindShell();
    observePanel();
    initGpsTriangle();
    syncRouteBar();
  }

  function openSheet(id) {
    cancelNvManual(true);
    $$('.nv-sheet').forEach(s => s.classList.remove('open'));
    const s = document.getElementById(id); if (s) s.classList.add('open');
    document.body.classList.add('nv-sheet-open');
    syncMenuTriggers();
  }
  function closeSheets() {
    $$('.nv-sheet').forEach(s => s.classList.remove('open'));
    document.body.classList.remove('nv-sheet-open');
    syncMenuTriggers();
  }
  function syncMenuTriggers() {
    const pairs = [['nv-sheet-poi', '#nv-poi'], ['nv-sheet-poi-card', '#nv-poi'], ['nv-sheet-layers', '#nv-layers'], ['nv-sheet-weather', '#nv-weather'], ['nv-search-sheet', '#nv-search'], ['nv-sheet-profile', '#nv-profile']];
    pairs.forEach(([id, sel]) => {
      const a = document.getElementById(id)?.classList.contains('open');
      const b = id === 'nv-sheet-poi-card' && document.getElementById('nv-sheet-poi')?.classList.contains('open');
      $(sel)?.classList.toggle('green', !!(a || b));
    });
    const rootOpen = ['nv-sheet-settings', 'nv-sheet-share', 'nv-sheet-record'].some(id => document.getElementById(id)?.classList.contains('open'));
    if (rootOpen) markActive('settings');
    else if (document.querySelector('[data-nv-action="settings"].active')) markActive('map');
    const creditsOpen = document.getElementById('nv-sheet-credits')?.classList.contains('open');
    if (creditsOpen) markActive('credits');
    else if (document.querySelector('[data-nv-action="credits"].active')) markActive('map');
  }
  function toggleSheet(id) {
    const s = document.getElementById(id);
    if (s && s.classList.contains('open')) { closeSheets(); return false; }
    openSheet(id); return true;
  }
  function anySheetOpen() { return !!document.querySelector('.nv-sheet.open'); }
  function closeToolsPanel() { const p = document.getElementById('tools-panel'); if (p) p.hidden = true; }
  function closeInfoModal() {
    const m = document.getElementById('mobile-help-modal');
    if (m && !m.hidden && m.style.display !== 'none') m.querySelector('.modal-close')?.click();
  }
  function closeQuickRoute() { if (routeInfoOpen) { routeInfoOpen = false; syncRouteInfo(); } }
  function closeOtherBottomMenus(except) {
    cancelNvManual(true);
    if (except !== 'sheets') closeSheets();
    if (except !== 'pages') closeNativePages();
    if (except !== 'tools') closeToolsPanel();
    if (except !== 'info') closeInfoModal();
    if (except !== 'quick') closeQuickRoute();
  }

  function closeNativePages() {
    $$('.nv-page').forEach(p => p.classList.remove('open'));
    document.body.classList.remove('nv-subpage');
  }
  function openNativePage(id) {
    closeSheets(); closePanel();
    $$('.nv-page').forEach(p => p.classList.toggle('open', p.id === id));
    document.body.classList.add('nv-subpage');
  }
  function distKm(aLat, aLon, bLat, bLon) {
    const R = 6371, dLat = (bLat - aLat) * Math.PI / 180, dLon = (bLon - aLon) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function openNearPage() {
    openNativePage('nv-page-near'); markActive('near');
    $$('#nv-near-radius button').forEach(b => b.classList.toggle('on', Number(b.dataset.nvRadius) === nearRadius));
    loadNear();
  }
  function loadNear() {
    const count = $('#nv-near-count'); const list = $('#nv-near-list'); if (!count || !list) return;
    count.textContent = 'Obteniendo ubicación…'; list.innerHTML = '';
    const fallback = () => {
      const c = window.map ? window.map.getCenter() : { lat: 37.3, lng: -4.5 };
      nearPos = { lat: c.lat, lon: c.lng, label: 'centro del mapa' };
      renderNear();
    };
    if (!navigator.geolocation) { fallback(); return; }
    navigator.geolocation.getCurrentPosition(p => {
      nearPos = { lat: p.coords.latitude, lon: p.coords.longitude, label: 'tu ubicación' };
      startGpsWatch();
      renderNear();
    }, fallback, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }
  function renderNear() {
    const count = $('#nv-near-count'), list = $('#nv-near-list');
    const arr = window.FD || [];
    if (!nearPos || !count || !list) return;
    const near = arr.map(f => ({ f, d: distKm(nearPos.lat, nearPos.lon, f.la, f.lo) }))
      .filter(x => x.d <= nearRadius).sort((a, b) => a.d - b.d).slice(0, 300);
    count.textContent = `${near.length}${near.length >= 300 ? '+' : ''} fuentes · ${nearRadius} km · ${nearPos.label}`;
    list.innerHTML = '';
    if (!near.length) { list.innerHTML = '<div class="nv-result"><div class="s">Sin fuentes en este radio.</div></div>'; return; }
    near.forEach(({ f, d }) => {
      const acc = window.getAccType ? window.getAccType(f) : 'u';
      const color = acc === 'r' ? '#2ecc71' : acc === 'o' ? '#ff6a00' : '#9aa6b4';
      const row = document.createElement('div'); row.className = 'nv-near-item';
      row.innerHTML = `<span class="nv-near-dot" style="background:${color}"></span><div class="nv-near-main"><strong>${escapeHtml(f.n)}</strong><small>${escapeHtml(f.p || '')} · ${acc === 'r' ? 'Asfaltada' : acc === 'o' ? 'Sin asfaltar' : 'Sin información'}</small></div><span class="nv-near-dist">${d.toFixed(1)} km</span>`;
      row.addEventListener('click', () => { closeNativePages(); if (window.showFountainOnMap) window.showFountainOnMap(f.id); });
      list.appendChild(row);
    });
  }
  function syncRouteInfo() {
    const box = $('#nv-routeinfo'); if (!box) return;
    $('#nv-ri-start-name').textContent = `🏁 ${window.startTown?.n || 'Salida'} 🔍`;
    $('#nv-ri-end-name').textContent = `🎯 ${window.endTown?.n || 'Destino'} 🔍`;
    $('#nv-ri-wps-name').textContent = `➕ Paradas: ${(window.waypoints || []).length}/10 🔍`;
    $('#nv-ri-gps')?.classList.toggle('on', window.startTown?.kind === 'gps');
    syncManualBtns();
    box.classList.toggle('show', routeInfoOpen);
    if (document.querySelector('#nv-page-route.open')) renderRoutePage();
  }
  function openRoutePage() {
    closeNativePages(); routeInfoOpen = false; syncRouteInfo();
    openNativePage('nv-page-route'); markActive('route'); renderRoutePage();
  }
  function renderRoutePage() {
    const st = window.startTown, en = window.endTown;
    const sn = $('#nv-start-name'), enm = $('#nv-end-name'), sum = $('#nv-route-page-summary');
    if (sn) sn.textContent = st && st.n ? st.n : 'Elegir salida';
    if (enm) enm.textContent = en && en.n ? en.n : 'Elegir destino';
    const wps = $('#nv-route-wps');
    if (wps) {
      const list = (window.waypoints || []).slice();
      wps.innerHTML = list.length ? '' : '<div class="nv-wp-empty">Sin paradas. Usa + Añadir.</div>';
      list.forEach((w, i) => {
        const row = document.createElement('div'); row.className = 'nv-wp-row';
        row.innerHTML = `<span class="nv-wp-num">${i + 1}</span><span class="nv-wp-name">${escapeHtml(w.n || 'Parada')}</span><button data-wp-up="${i}" aria-label="Subir">↑</button><button data-wp-down="${i}" aria-label="Bajar">↓</button><button data-wp-del="${i}" aria-label="Quitar">✕</button>`;
        row.querySelector('[data-wp-up]')?.addEventListener('click', () => moveWp(i, -1));
        row.querySelector('[data-wp-down]')?.addEventListener('click', () => moveWp(i, 1));
        row.querySelector('[data-wp-del]')?.addEventListener('click', () => { if (window.toggleWp) window.toggleWp(w); if (window.syncMm) window.syncMm(); if (window.updSum) window.updSum(); if (window.invalidateRoute) window.invalidateRoute({ clearStatus: true }); renderRoutePage(); });
        wps.appendChild(row);
      });
    }
    const cp = f => (f && f.p && window.POSTAL_DATA && window.POSTAL_DATA[f.p] && window.POSTAL_DATA[f.p].length) ? 'CP ' + window.POSTAL_DATA[f.p].join(', ') : '';
    const scp = $('#nv-start-cp'), ecp = $('#nv-end-cp');
    if (scp) scp.textContent = cp(st); if (ecp) ecp.textContent = cp(en);
    if (!sum) return;
    const dv = (document.getElementById('r-dist')?.textContent || '').trim();
    const tv = (document.getElementById('r-time')?.textContent || '').trim();
    if (dv && !/^0\s*km$/i.test(dv)) sum.innerHTML = `<strong>${escapeHtml(dv)}</strong> · ${escapeHtml(tv)}<br><small>${escapeHtml(st?.n || '-')} → ${escapeHtml(en?.n || '-')}</small>`;
    else sum.textContent = (st && st.la ? 'Salida lista. ' : 'Define salida. ') + (en && en.la ? 'Destino listo.' : 'Define destino.');
  }
  function moveWp(i, dir) {
    const a = window.waypoints; if (!a || !a.length) return;
    const j = i + dir; if (j < 0 || j >= a.length) return;
    const t = a[i]; a[i] = a[j]; a[j] = t;
    if (window.syncMm) window.syncMm(); if (window.updSum) window.updSum(); if (window.invalidateRoute) window.invalidateRoute({ clearStatus: true });
    renderRoutePage();
  }
  function openNativeSearch(target, returnTo) {
    searchTarget = target || 'lookup'; searchReturn = returnTo || 'route';
    const t = $('#nv-search-title');
    if (t) t.textContent = searchTarget === 'start' ? 'Elegir salida' : searchTarget === 'dest' ? 'Elegir destino' : searchTarget === 'wp' ? 'Añadir parada' : 'Buscar';
    openSheet('nv-search-sheet');
    const i = $('#nv-search-input'); if (i) { i.value = ''; renderNativeSearch(''); setTimeout(() => i.focus(), 80); }
  }

  let nvPoiLayer = null, nvPoiKind = null;
  const NV_POI = {
    dealer: { term: 'concesionario Harley Davidson', q: 'shop=motorcycle', km: 50, label: 'Concesionario H-D', icon: '🏍️' },
    fuel: { term: 'gasolinera', q: 'amenity=fuel', km: 15, label: 'Gasolinera', icon: '⛽' },
    restaurant: { term: 'restaurante', q: 'amenity=restaurant', km: 15, label: 'Restaurante', icon: '🍴' },
    hotel: { term: 'hotel', q: 'tourism=hotel', km: 15, label: 'Alojamiento', icon: '🛏️' },
    parking: { term: 'aparcamiento', q: 'amenity=parking', km: 15, label: 'Aparcamiento', icon: 'P' },
    drinking_water: { term: 'fuente', q: 'amenity=drinking_water', km: 15, label: 'Fuente de agua', icon: '💧' },
    hospital: { term: 'hospital', q: 'amenity=hospital', km: 20, label: 'Hospital', icon: '🏥' },
    car_repair: { term: 'taller', q: 'shop=car_repair', km: 20, label: 'Taller', icon: '🔧' },
    supermarket: { term: 'supermercado', q: 'shop=supermarket', km: 15, label: 'Supermercado', icon: '🛒' }
  };
  const NV_POI_COLORS = { dealer: '#ff6a00', fuel: '#2e9e5b', restaurant: '#141414', hotel: '#2f80ed', parking: '#1565c0', drinking_water: '#00acc1', hospital: '#c62828', car_repair: '#ef6c00', supermarket: '#8e44ad' };
  function nvOsmAddress(ad) {
    if (!ad) return '';
    const road = ad.road || ad.pedestrian || ad.footway || '';
    const num = ad.house_number || '';
    const city = ad.city || ad.town || ad.village || ad.municipality || '';
    const cp = ad.postcode || '';
    return [(road + (num ? ' ' + num : '')).trim(), city, cp].filter(Boolean).join(', ');
  }
  function nvTradHours(h) {
    return String(h || '').replace(/\bMo\b/g, 'Lun').replace(/\bTu\b/g, 'Mar').replace(/\bWe\b/g, 'Mié')
      .replace(/\bTh\b/g, 'Jue').replace(/\bFr\b/g, 'Vie').replace(/\bSa\b/g, 'Sáb').replace(/\bSu\b/g, 'Dom')
      .replace(/\bPH\b/g, 'Fest').replace(/\boff\b/g, 'cerrado');
  }
  function nvOpenNow(hours) {
    if (!hours) return null;
    if (hours.includes('24/7')) return true;
    const m = String(hours).trim().match(/^([A-Z][a-z])(?:-([A-Z][a-z]))?\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const day = c => ({ Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 7 }[c] || 0);
    const sd = day(m[1]); if (!sd) return null;
    const ed = m[2] ? day(m[2]) : sd;
    const st = Number(m[3]) * 60 + Number(m[4]);
    const en = Number(m[5]) * 60 + Number(m[6]);
    const now = new Date();
    const today = now.getDay() === 0 ? 7 : now.getDay();
    const mins = now.getHours() * 60 + now.getMinutes();
    const inDays = sd <= ed ? (today >= sd && today <= ed) : (today >= sd || today <= ed);
    return inDays && mins >= st && mins < en;
  }
  function nvPoiDistance(p) {
    if (!window.map) return 0;
    const r = compassPos ? { lat: compassPos.lat, lon: compassPos.lon } : { lat: window.map.getCenter().lat, lon: window.map.getCenter().lng };
    return nvKmBetween(r, { lat: p.lat, lon: p.lon });
  }
  function nvPoiFromNominatim(x, kind, cfg) {
    const ex = x.extratags || {}, ad = x.address || {}, nd = x.namedetails || {};
    const display = x.display_name || '';
    const name = x.name || nd.name || display.split(',')[0] || cfg.label;
    const hours = ex.opening_hours || '';
    return {
      id: 'osm-' + (x.osm_type || 'n') + '-' + (x.osm_id || (x.lat + x.lon)),
      kind, name: name.trim() || cfg.label,
      lat: Number(x.lat), lon: Number(x.lon),
      address: nvOsmAddress(ad) || display,
      phone: ex.phone || ex['contact:phone'] || '',
      website: ex.website || ex['contact:website'] || ex.url || '',
      hours, openNow: nvOpenNow(hours)
    };
  }
  function nvPoiFromOverpass(el, kind, cfg) {
    const t = el.tags || {};
    const street = (t['addr:street'] || '') + (t['addr:housenumber'] ? ' ' + t['addr:housenumber'] : '');
    const city = t['addr:city'] || t['addr:town'] || t['addr:village'] || t['addr:municipality'] || '';
    const addr = [street.trim(), city, t['addr:postcode'] || ''].filter(Boolean).join(', ');
    const hours = t.opening_hours || '';
    return {
      id: 'osm-' + (el.type || 'n') + '-' + (el.id || ((el.lat ?? el.center?.lat) + '' + (el.lon ?? el.center?.lon))),
      kind, name: t.name || t.brand || t.operator || cfg.label,
      lat: el.lat ?? el.center?.lat, lon: el.lon ?? el.center?.lon,
      address: addr, phone: t.phone || t['contact:phone'] || '',
      website: t.website || t['contact:website'] || '', hours, openNow: nvOpenNow(hours)
    };
  }
  function showNativePoiCard(p) {
    const cfg = NV_POI[p.kind] || { label: 'POI' };
    const color = NV_POI_COLORS[p.kind] || '#ff6a00';
    const kind = $('#nv-pc-kind'), body = $('#nv-pc-body');
    if (!kind || !body) return;
    kind.textContent = cfg.label.toUpperCase();
    kind.style.color = color;
    const dist = nvPoiDistance(p);
    const web = p.website ? (p.website.startsWith('http') ? p.website : 'https://' + p.website) : '';
    const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.lat + ',' + p.lon)}`;
    body.innerHTML = `
      <div class="nv-poi-name">${escapeHtml(p.name)}</div>
      ${p.address ? `<div class="nv-poi-line">${escapeHtml(p.address)}</div>` : ''}
      ${p.openNow != null ? `<div class="nv-poi-open ${p.openNow ? 'open' : 'closed'}">● ${p.openNow ? 'Abierto ahora' : 'Cerrado ahora'}</div>` : ''}
      ${p.hours ? `<div class="nv-poi-meta">Horario: ${escapeHtml(nvTradHours(p.hours))}</div>` : ''}
      ${dist > 0 ? `<div class="nv-poi-meta">A ${dist.toFixed(1)} km en línea recta</div>` : ''}
      ${p.phone ? `<a class="nv-poi-link" href="tel:${encodeURI(String(p.phone).replace(/[^0-9+]/g, ''))}">☎ ${escapeHtml(p.phone)} (llamar)</a>` : ''}
      ${web ? `<a class="nv-poi-link" href="${escapeHtml(web)}" target="_blank" rel="noopener">🌐 ${escapeHtml(p.website)}</a>` : ''}
      <a class="nv-poi-link" href="${maps}" target="_blank" rel="noopener">🧭 Abrir en la app de mapas</a>
      <div class="nv-poi-actions">
        <button id="nv-pc-dest">🎯 Destino</button>
        <button id="nv-pc-wp">+ Parada</button>
        <button id="nv-pc-close">Cerrar</button>
      </div>`;
    $('#nv-pc-dest').addEventListener('click', () => {
      if (window.setEnd) window.setEnd(p);
      closeSheets(); routeInfoOpen = true; syncRouteInfo(); markActive('map');
      toast('Destino: ' + p.name);
    });
    $('#nv-pc-wp').addEventListener('click', () => {
      const wps = window.waypoints || [];
      if (wps.length >= 10) { toast('Máximo 10 paradas', 'warn'); return; }
      window.waypoints = wps.concat([{ ...p, id: p.id || ('poi-' + Date.now()) }]);
      if (window.updSum) window.updSum();
      if (window.invalidateRoute) window.invalidateRoute({ clearStatus: true });
      closeSheets(); routeInfoOpen = true; syncRouteInfo(); markActive('map');
      toast(`Parada ${window.waypoints.length}/10: ${p.name}`);
    });
    $('#nv-pc-close').addEventListener('click', closeSheets);
    openSheet('nv-sheet-poi-card');
  }
  function clearNativePois() {
    if (nvPoiLayer && window.map) { try { window.map.removeLayer(nvPoiLayer); } catch {} }
    nvPoiLayer = null; nvPoiKind = null;
    $$('[data-nv-poi-kind]').forEach(b => b.classList.remove('on'));
  }
  async function loadNativePois(kind) {
    const cfg = NV_POI[kind]; if (!cfg || !window.map || !window.L) return;
    if (nvPoiKind === kind && nvPoiLayer) { clearNativePois(); return; }
    clearNativePois(); nvPoiKind = kind;
    const btn = document.querySelector(`[data-nv-poi-kind="${kind}"]`); if (btn) btn.classList.add('on');
    const c = window.map.getCenter();
    const q = `[out:json][timeout:25];(nwr[${cfg.q}](around:${cfg.km * 1000},${c.lat},${c.lng}););out center 40;`;
    toast(`Buscando ${cfg.label.toLowerCase()}.`);
    try {
      let pois = [], lastErr = '';
      try {
        const dLat = cfg.km / 111, dLon = cfg.km / (111 * Math.max(0.2, Math.cos(c.lat * Math.PI / 180)));
        const nUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=40&bounded=1&viewbox=${c.lng - dLon},${c.lat + dLat},${c.lng + dLon},${c.lat - dLat}&q=${encodeURIComponent(cfg.term)}&accept-language=es&extratags=1&addressdetails=1&namedetails=1`;
        const nr = await fetch(nUrl, { signal: AbortSignal.timeout(12000) });
        if (!nr.ok) throw new Error('HTTP ' + nr.status);
        const arr = await nr.json();
        pois = (arr || []).map(x => nvPoiFromNominatim(x, kind, cfg)).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
      } catch (e) { lastErr = e.message; }
      if (!pois.length) {
        for (const mirror of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
          try {
            const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 14000);
            const res = await fetch(mirror + '?data=' + encodeURIComponent(q), { signal: ac.signal });
            clearTimeout(timer);
            if (!res.ok) { lastErr = 'HTTP ' + res.status; continue; }
            const data = await res.json();
            pois = (data.elements || []).map(el => nvPoiFromOverpass(el, kind, cfg)).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
            if (pois.length) break;
          } catch (e) { lastErr = e.message; }
        }
      }
      if (!pois.length) throw new Error(lastErr || 'sin respuesta');
      pois = pois.filter((p, i, a) => a.findIndex(x => x.id === p.id) === i)
        .sort((a, b) => nvPoiDistance(a) - nvPoiDistance(b));
      nvPoiLayer = window.L.layerGroup().addTo(window.map);
      let n = 0;
      pois.forEach(p => {
        const icon = window.L.divIcon({ className: '', html: `<div class="nv-poi-marker" style="--poi:${NV_POI_COLORS[kind] || '#ff6a00'}"><span>${cfg.icon}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 28] });
        const mk = window.L.marker([p.lat, p.lon], { icon }).addTo(nvPoiLayer);
        mk.on('click', () => showNativePoiCard(p));
        n++;
      });
      if (!n) { toast('Sin resultados en este radio', 'warn'); clearNativePois(); return; }
      toast(`${n} ${cfg.label.toLowerCase()}${n === 1 ? '' : 's'} · ${cfg.km} km`);
    } catch (e) {
      toast('POIs: ' + e.message, 'warn'); clearNativePois();
    }
  }

  let nvManualTarget = null, nvManualMarks = [];
  function syncManualBtns() {
    const ids = { start: '#nv-ri-start-manual', parada: '#nv-ri-wp-manual', dest: '#nv-ri-end-manual' };
    Object.keys(ids).forEach(k => $(ids[k])?.classList.toggle('on', nvManualTarget === k));
  }
  function startNvManual(target) {
    const tag = $('#nv-manual-label'), ov = $('#nv-manual-pick');
    if (!tag || !ov) return;
    nvManualTarget = nvManualTarget === target ? null : target;
    if (!nvManualTarget) { ov.classList.remove('show'); ov.setAttribute('aria-hidden', 'true'); syncManualBtns(); toast('Manual desactivado'); return; }
    tag.textContent = nvManualTarget === 'start' ? 'SALIDA' : nvManualTarget === 'dest' ? 'DESTINO' : 'PARADA';
    routeInfoOpen = false; syncRouteInfo(); markActive('map');
    ov.classList.add('show'); ov.setAttribute('aria-hidden', 'false'); syncManualBtns();
    toast('Mueve el mapa y pulsa + para fijar la ' + tag.textContent);
  }
  function nvConfirmManual() {
    if (!nvManualTarget || !window.map) return;
    const c = window.map.getCenter();
    const pt = { kind: 'manual', la: c.lat, lo: c.lng, n: '📍 Punto en el mapa', p: '📍 Punto en el mapa' };
    if (nvManualTarget === 'start') {
      if (window.setStart) window.setStart(pt);
      toast('Salida fijada en el mapa');
    } else if (nvManualTarget === 'dest') {
      if (window.setEnd) window.setEnd(pt);
      toast('Destino fijado en el mapa');
    } else {
      const wps = window.waypoints || [];
      if (wps.length >= 10) { toast('Máximo 10 paradas', 'warn'); return; }
      const id = 'nv-manual-' + Date.now();
      const wp = { ...pt, id };
      window.waypoints = wps.concat([wp]);
      if (window.updSum) window.updSum();
      if (window.invalidateRoute) window.invalidateRoute({ clearStatus: true });
      try {
        const mk = window.L.marker([c.lat, c.lng], { icon: window.L.divIcon({ className: 'nv-manual-marker', html: '📍', iconSize: [28, 28], iconAnchor: [14, 26] }) }).addTo(window.map);
        nvManualMarks.push({ id, mk });
      } catch (_) {}
      toast(`Parada ${window.waypoints.length}/10`);
    }
    nvManualTarget = null; syncManualBtns();
    $('#nv-manual-pick')?.classList.remove('show');
    $('#nv-manual-pick')?.setAttribute('aria-hidden', 'true');
    routeInfoOpen = true; syncRouteInfo(); markActive('map');
  }
  function cancelNvManual(silent) {
    if (!nvManualTarget) return;
    nvManualTarget = null; syncManualBtns();
    $('#nv-manual-pick')?.classList.remove('show');
    $('#nv-manual-pick')?.setAttribute('aria-hidden', 'true');
    if (!silent) toast('Selección manual cancelada');
  }
  function clearNvManualMarks() {
    nvManualMarks.forEach(x => { try { window.map.removeLayer(x.mk); } catch (_) {} });
    nvManualMarks = [];
  }
  function nvUndoRouteStep() {
    const wps = window.waypoints || [];
    if (wps.length) {
      const last = wps[wps.length - 1];
      const manual = nvManualMarks.find(x => x.id === last.id);
      if (manual) { try { window.map.removeLayer(manual.mk); } catch (_) {} nvManualMarks = nvManualMarks.filter(x => x !== manual); }
      if (window.toggleWp) window.toggleWp(last);
      toast(`Parada quitada (${Math.max(0, wps.length - 1)}/10)`);
    } else if (window.endTown) {
      if (window.setEnd) window.setEnd(null);
      toast('Destino quitado');
    } else if (window.startTown) {
      if (window.setStart) window.setStart(null);
      toast('Salida quitada');
    } else { toast('No hay nada que quitar', 'warn'); return; }
    routeInfoOpen = true; syncRouteInfo();
  }
  let nvRecording = false, nvRecordWatch = null, nvRecordDist = 0, nvRecordLast = null;
  function nvKmBetween(a, b) {
    const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function toggleNativeRecord() {
    const txt = $('#nv-record-text'), btn = $('#nv-record-btn');
    if (nvRecording) {
      nvRecording = false;
      if (nvRecordWatch != null) { try { navigator.geolocation.clearWatch(nvRecordWatch); } catch (_) {} nvRecordWatch = null; }
      txt.textContent = `Grabación finalizada · ${nvRecordDist.toFixed(2)} km`;
      btn.textContent = 'INICIAR GRABACIÓN';
      btn.classList.remove('on');
      return;
    }
    if (!navigator.geolocation) { toast('GPS no disponible', 'warn'); return; }
    nvRecording = true; nvRecordDist = 0; nvRecordLast = null;
    txt.textContent = 'Grabando… 0.00 km';
    btn.textContent = 'DETENER GRABACIÓN';
    btn.classList.add('on');
    nvRecordWatch = navigator.geolocation.watchPosition(p => {
      if (!nvRecording) return;
      const cur = { lat: p.coords.latitude, lon: p.coords.longitude };
      if (nvRecordLast) nvRecordDist += nvKmBetween(nvRecordLast, cur);
      nvRecordLast = cur;
      txt.textContent = `Grabando… ${nvRecordDist.toFixed(2)} km`;
    }, e => { toast('GPS: ' + e.message, 'warn'); }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
  }

  function syncLayerChoices() {
    if (!window.map || !window.tileLayers) return;
    const active = Object.keys(window.tileLayers).find(k => window.map.hasLayer(window.tileLayers[k]));
    $$('[data-nv-layer]').forEach(b => b.classList.toggle('on', b.dataset.nvLayer === active));
  }

  function motoAction() {
    const sb = $('#sidebar');
    const wasOpen = !!(sb && sb.classList.contains('open')) || !!document.querySelector('.nv-page.open');
    closeOtherBottomMenus('quick');
    if (wasOpen) { closePanel(); routeBarHidden = false; routeInfoOpen = false; }
    else routeInfoOpen = !routeInfoOpen;
    syncRouteInfo();
    syncRouteBar();
    markActive('map');
  }
  function markActive(key) {
    $$('.nv-tab').forEach(b => {
      const match = b.dataset.nvTab === key || b.dataset.nvAction === key;
      b.classList.toggle('active', match && (key !== 'map' || routeInfoOpen));
    });
  }
  function openTab(tab) {
    if (tab === 'info') { closeSheets(); markActive('info'); const v = $('#mobile-version'); if (v) v.click(); else openSheetInfoFallback(); return; }
    closeSheets();
    activeTab = tab;
    const tabBtn = document.getElementById('tab-' + tab);
    if (tabBtn && window.selectTab) window.selectTab(tabBtn, false);
    else if (tabBtn) tabBtn.click();
    const sb = $('#sidebar');
    if (sb && !sb.classList.contains('open') && window.togglePanel) window.togglePanel();
    if (sb) { sb.dataset.nvLabel = tab === 'ruta' ? 'RUTA' : 'FUENTES'; setTimeout(() => { sb.scrollTop = 0; }, 30); }
    markActive(tab);
  }
  function openSheetInfoFallback() {
    const h = document.getElementById('mobile-help-modal'); if (h) h.removeAttribute('hidden');
  }
  function closePanel() {
    const sb = $('#sidebar');
    if (sb && sb.classList.contains('open') && window.togglePanel) window.togglePanel();
  }
  function observePanel() {
    const sb = $('#sidebar'); if (!sb) return;
    const apply = () => {
      const open = sb.classList.contains('open');
      document.documentElement.classList.toggle('nv-panel-open', open);
      if (!open) closeSheets();
    };
    new MutationObserver(apply).observe(sb, { attributes: true, attributeFilter: ['class'] });
    apply();
  }

  function bindShell() {
    $('#nv-poi').addEventListener('click', () => toggleSheet('nv-sheet-poi'));
    $('#nv-search').addEventListener('click', () => { if (document.getElementById('nv-search-sheet')?.classList.contains('open')) { closeSheets(); return; } openNativeSearch('lookup'); });
    $('#nv-layers').addEventListener('click', () => { if (document.getElementById('nv-sheet-layers')?.classList.contains('open')) { closeSheets(); return; } syncLayerChoices(); openSheet('nv-sheet-layers'); });
    $('#nv-weather').addEventListener('click', () => { if (document.getElementById('nv-sheet-weather')?.classList.contains('open')) { closeSheets(); return; } openSheet('nv-sheet-weather'); const v=$('#nv-weather-view'); if(v && !v.textContent.trim()) v.textContent='Elige una opción.'; });
    $('#nv-close').addEventListener('click', closePanel);
    $$('[data-nv-close-sheet]').forEach(b => b.addEventListener('click', closeSheets));

    $$('.nv-tab').forEach(b => b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const action = b.dataset.nvAction;
      if (action === 'map') { motoAction(); return; }
      if (action === 'route') { if (document.querySelector('#nv-page-route.open')) { closeNativePages(); syncRouteBar(); markActive('map'); } else openRoutePage(); return; }
      if (action === 'near') { if (document.querySelector('#nv-page-near.open')) { closeNativePages(); syncRouteBar(); markActive('map'); } else { closeOtherBottomMenus('pages'); openNearPage(); } return; }
      if (action === 'credits') { if (document.getElementById('nv-sheet-credits')?.classList.contains('open')) { closeSheets(); markActive('map'); } else { closeOtherBottomMenus('sheets'); markActive('credits'); openSheet('nv-sheet-credits'); } return; }
      if (action === 'settings') { if (document.getElementById('nv-sheet-settings')?.classList.contains('open')) { closeSheets(); markActive('map'); } else { closeOtherBottomMenus('sheets'); markActive('settings'); openSheet('nv-sheet-settings'); } return; }
      if (action === 'tools') { const p = document.getElementById('tools-panel'); if (p && !p.hidden) { p.hidden = true; closeSheets(); markActive('map'); return; } closeOtherBottomMenus('tools'); markActive('tools'); setTimeout(() => document.getElementById('btn-tools')?.click(), 0); return; }
      const tab = b.dataset.nvTab;
      if (tab === 'info') { const m = document.getElementById('mobile-help-modal'); if (m && !m.hidden && m.style.display !== 'none') { m.querySelector('.modal-close')?.click(); markActive('map'); return; } closeOtherBottomMenus('info'); openTab('info'); return; }
      const sb = $('#sidebar');
      if (sb && sb.classList.contains('open') && activeTab === tab) { closePanel(); return; }
      openTab(tab);
    }));
    $$('[data-nv-settings]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.nvSettings;
      if (a === 'share') { closeSheets(); openSheet('nv-sheet-share'); return; }
      closeSheets();
      if (a === 'save') { document.getElementById('btn-save')?.click(); }
      else if (a === 'record') { openSheet('nv-sheet-record'); }
      else if (a === 'routes') { closeNativePages(); markActive('tools'); setTimeout(() => { document.getElementById('btn-tools')?.click(); setTimeout(() => document.getElementById('btn-routes-toggle')?.click(), 120); }, 0); }
    }));
    $$('[data-nv-poi-kind]').forEach(b => b.addEventListener('click', () => {
      const kind = b.dataset.nvPoiKind; closeSheets(); loadNativePois(kind);
    }));
    $('#nv-poi-clear')?.addEventListener('click', () => { closeSheets(); clearNativePois(); });

    $('#nv-ri-start')?.addEventListener('click', () => openNativeSearch('start', 'map'));
    $('#nv-ri-end')?.addEventListener('click', () => openNativeSearch('dest', 'map'));
    $('#nv-ri-end-manual')?.addEventListener('click', () => startNvManual('dest'));
    $('#nv-ri-gps')?.addEventListener('click', () => { document.getElementById('btn-gps')?.click(); setTimeout(syncRouteInfo, 1500); });
    $('#nv-ri-start-manual')?.addEventListener('click', () => startNvManual('start'));
    $('#nv-ri-wps')?.addEventListener('click', () => openNativeSearch('wp', 'map'));
    $('#nv-ri-wp-manual')?.addEventListener('click', () => startNvManual('parada'));
    $('#nv-ri-undo')?.addEventListener('click', nvUndoRouteStep);
    $('#nv-ri-calc')?.addEventListener('click', () => { document.getElementById('btn-calc')?.click(); });
    $('#nv-ri-reset')?.addEventListener('click', () => { document.getElementById('btn-reset-route')?.click(); nvManualTarget = null; $('#nv-manual-pick')?.classList.remove('show'); syncManualBtns(); clearNvManualMarks(); routeInfoOpen = false; syncRouteInfo(); markActive('map'); closeSheets(); });
    $('#nv-manual-add')?.addEventListener('click', nvConfirmManual);
    $('#nv-manual-cancel')?.addEventListener('click', () => { cancelNvManual(false); markActive('map'); });
    $('#nv-record-btn')?.addEventListener('click', toggleNativeRecord);
    $('#nv-credits-close')?.addEventListener('click', closeSheets);
    $('#nv-share-app')?.addEventListener('click', () => { closeSheets(); document.getElementById('btn-share')?.click(); });
    $('#nv-share-wa')?.addEventListener('click', () => { closeSheets(); document.getElementById('btn-share-wa')?.click(); });
    $('#nv-share-maps')?.addEventListener('click', () => { closeSheets(); document.getElementById('btn-share-maps')?.click(); });
    $$('[data-nv-page-close]').forEach(b => b.addEventListener('click', () => { closeNativePages(); syncRouteBar(); markActive('map'); }));
    $$('[data-nv-radius]').forEach(b => b.addEventListener('click', () => {
      nearRadius = Number(b.dataset.nvRadius) || 25; localStorage.setItem('nv:nearRadius', String(nearRadius));
      $$('[data-nv-radius]').forEach(x => x.classList.toggle('on', x === b)); renderNear();
    }));
    $('#nv-near-refresh')?.addEventListener('click', loadNear);
    $('#nv-near-search')?.addEventListener('click', () => { closeNativePages(); openNativeSearch('lookup', 'map'); });
    $('#nv-start-card')?.addEventListener('click', () => openNativeSearch('start', 'route'));
    $('#nv-end-card')?.addEventListener('click', () => openNativeSearch('dest', 'route'));
    $('#nv-add-wp')?.addEventListener('click', () => openNativeSearch('wp', 'route'));
    $('#nv-calc-page')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-calc'); const sum = $('#nv-route-page-summary');
      if (!window.startTown || !window.startTown.la) { toast('Elige la salida', 'warn'); return; }
      if (sum) sum.textContent = 'Calculando ruta…';
      if (btn) btn.click();
      setTimeout(() => { closeNativePages(); syncRouteBar(); markActive('map'); renderRoutePage(); }, 1600);
    });
    $('#nv-route-reset-page')?.addEventListener('click', () => { const b = document.getElementById('btn-reset-route'); if (b) b.click(); renderRoutePage(); });
    $('#nv-gps-route')?.addEventListener('click', () => { const b = document.getElementById('btn-gps'); if (b) b.click(); const sum = $('#nv-route-page-summary'); if (sum) sum.textContent = 'Obteniendo GPS…'; setTimeout(renderRoutePage, 1600); });
    $('#nv-manual-route')?.addEventListener('click', () => { closeNativePages(); const b = document.getElementById('btn-manual-map'); if (b) b.click(); markActive('map'); });
    $('#nv-weather-route-page')?.addEventListener('click', () => { openSheet('nv-sheet-weather'); });
    $('#nv-nasa-toggle')?.addEventListener('click', toggleNasaLayer);
    $('#nv-radar-toggle')?.addEventListener('click', toggleRadar);
    $('#nv-weather-here-menu')?.addEventListener('click', loadNativeWeather);
    $('#nv-weather-route-menu')?.addEventListener('click', showRouteWeatherControls);
    $('#nv-weather-go')?.addEventListener('click', loadRouteWeather);
    $('#nv-poi-route')?.addEventListener('click', () => openSheet('nv-sheet-poi'));
    $('#nv-gpx-route')?.addEventListener('click', () => { closeNativePages(); const t = document.getElementById('btn-tools'); if (t) t.click(); const r = document.getElementById('btn-routes-toggle'); if (r) setTimeout(() => r.click(), 80); });
    $('#nv-traffic-route')?.addEventListener('click', () => { if (window.openModal) window.openModal('traffic-modal'); });
    $('#nv-traffic-layer')?.addEventListener('click', () => { closeSheets(); if (window.openModal) window.openModal('traffic-modal'); });
    $('#nv-share-maps-page')?.addEventListener('click', () => { const b = document.getElementById('btn-share-maps'); if (b) b.click(); });
    $('#nv-share-wa-page')?.addEventListener('click', () => { const b = document.getElementById('btn-share-wa'); if (b) b.click(); });
    $('#nv-save-page')?.addEventListener('click', () => { const b = document.getElementById('btn-save'); if (b) b.click(); });
    $('#nv-share-page')?.addEventListener('click', () => { const b = document.getElementById('btn-share'); if (b) b.click(); });
    $('#nv-routes-page')?.addEventListener('click', () => { closeNativePages(); const t = document.getElementById('btn-tools'); if (t) t.click(); });
    $('#nv-reset-page')?.addEventListener('click', () => { if (window.resetAllConfirm) window.resetAllConfirm(); });
    $('#nv-view-map')?.addEventListener('click', () => { closeNativePages(); syncRouteBar(); markActive('map'); });
    $('#nv-zoom-in').addEventListener('click', () => { if (window.map) window.map.zoomIn(); });
    $('#nv-zoom-out').addEventListener('click', () => { if (window.map) window.map.zoomOut(); });
    $('#nv-locate').addEventListener('click', centerOnMe);
    $('#nv-mode').addEventListener('click', toggleCompass);
    $('#nv-nav').addEventListener('click', () => { const b = document.getElementById('btn-follow-map'); if (b) b.click(); else toast('GPS no disponible'); });
    $('#nv-profile').addEventListener('click', openProfile);
    const toolsPanel = document.getElementById('tools-panel');
    if (toolsPanel && !toolsPanel.__nvObserved) {
      toolsPanel.__nvObserved = true;
      new MutationObserver(() => {
        if (toolsPanel.hidden && document.querySelector('[data-nv-action="tools"].active')) markActive('map');
      }).observe(toolsPanel, { attributes: true, attributeFilter: ['hidden'] });
    }
    $('#nv-route-main').addEventListener('click', () => { routeInfoOpen = !routeInfoOpen; syncRouteInfo(); });

    $$('[data-nv-layer]').forEach(b => b.addEventListener('click', () => {
      if (window.setLayer) window.setLayer(b.dataset.nvLayer);
      $$('[data-nv-layer]').forEach(x => x.classList.toggle('on', x === b));
      closeSheets();
    }));

    const si = $('#nv-search-input');
    si.addEventListener('input', () => renderNativeSearch(si.value));
    si.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const first = $('#nv-search-results .nv-result'); if (first) first.click(); } });
    $('#nv-search-clear').addEventListener('click', () => { si.value = ''; renderNativeSearch(''); si.focus(); });

    document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (nvManualTarget) { nvManualTarget = null; $('#nv-manual-pick')?.classList.remove('show'); syncManualBtns(); } closeSheets(); closePanel(); closeNativePages(); } });
  }

  function renderNativeSearch(q) {
    const box = $('#nv-search-results'); if (!box) return;
    box.innerHTML = '';
    const query = norm((q || '').trim());
    if (!query) { box.innerHTML = '<div class="nv-result"><div class="s">Escribe para buscar fuentes, pueblos o códigos postales.</div></div>'; return; }
    const towns = window.searchTowns ? window.searchTowns(query) : [];
    const fountains = window.searchFountains ? window.searchFountains(query) : [];
    towns.slice(0, 8).forEach(name => {
      const d = document.createElement('div'); d.className = 'nv-result';
      d.innerHTML = `<div class="t">🏘️ ${escapeHtml(name)}</div><div class="s">Pueblo / pedanía</div>`;
      d.addEventListener('click', () => {
        closeSheets();
        if (searchTarget === 'start' || searchTarget === 'dest') {
          let pos = window.getPos ? window.getPos(name) : null;
          if (!pos && window.getPos) pos = window.getPos(norm(name));
          if (!pos) return;
          const obj = { ...pos, n: name };
          if (searchTarget === 'start' && window.setStart) window.setStart(obj);
          else if (searchTarget === 'dest' && window.setEnd) window.setEnd(obj);
          if (searchReturn === 'map') { routeInfoOpen = true; syncRouteInfo(); markActive('map'); }
          else openRoutePage();
        } else if (window.setDestino) window.setDestino(name);
      });
      box.appendChild(d);
    });
    fountains.slice(0, 20).forEach(f => {
      const d = document.createElement('div'); d.className = 'nv-result';
      d.innerHTML = `<div class="t">⛲ ${escapeHtml(f.n)}</div><div class="s">${escapeHtml(f.p || '')}</div>`;
      d.addEventListener('click', () => {
        closeSheets();
        if (searchTarget === 'start' && window.setStart) { window.setStart(f); if (searchReturn === 'map') { routeInfoOpen = true; syncRouteInfo(); } else openRoutePage(); }
        else if (searchTarget === 'dest' && window.setEnd) { window.setEnd(f); if (searchReturn === 'map') { routeInfoOpen = true; syncRouteInfo(); } else openRoutePage(); }
        else if (searchTarget === 'wp' && window.toggleWp) { window.toggleWp(f); if (searchReturn === 'map') { routeInfoOpen = true; syncRouteInfo(); } else openRoutePage(); }
        else if (window.showFountainOnMap) window.showFountainOnMap(f.id);
      });
      box.appendChild(d);
    });
    if (!box.children.length) box.innerHTML = '<div class="nv-result"><div class="s">Sin coincidencias</div></div>';
  }
  function escapeHtml(s) { return ('' + s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  let nvGpsWatch = null, nvGpsMarker = null, nvGpsPos = null, nvGpsHeading = null;
  function nvGpsIcon(rot) {
    const r = Number.isFinite(rot) ? rot : 0;
    return window.L.divIcon({
      className: 'nv-gps-triangle',
      html: `<svg width="36" height="36" viewBox="0 0 36 36" style="transform:rotate(${r}deg);filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))"><path d="M18 3 L29 30 L18 24 L7 30 Z" fill="#2ecc71" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="18" cy="18" r="2.2" fill="#fff"/></svg>`,
      iconSize: [36, 36], iconAnchor: [18, 18]
    });
  }
  function updateGpsTriangle() {
    if (!window.map || !nvGpsPos) return;
    const rot = Number.isFinite(nvGpsHeading) ? nvGpsHeading : heading;
    if (!nvGpsMarker) {
      nvGpsMarker = window.L.marker([nvGpsPos.lat, nvGpsPos.lon], { icon: nvGpsIcon(rot), interactive: false, keyboard: false, zIndexOffset: 900 }).addTo(window.map);
    } else {
      nvGpsMarker.setLatLng([nvGpsPos.lat, nvGpsPos.lon]);
      nvGpsMarker.setIcon(nvGpsIcon(rot));
    }
  }
  function startGpsWatch() {
    if (!navigator.geolocation || nvGpsWatch != null) return;
    nvGpsWatch = navigator.geolocation.watchPosition(p => {
      nvGpsPos = { lat: p.coords.latitude, lon: p.coords.longitude };
      if (typeof p.coords.heading === 'number' && !isNaN(p.coords.heading) && p.coords.speed > 0.5) nvGpsHeading = p.coords.heading;
      updateGpsTriangle();
    }, () => {}, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
  }
  function initGpsTriangle() {
    if (!navigator.geolocation) return;
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(s => { if (s.state === 'granted') startGpsWatch(); }).catch(() => {});
    }
  }

  function centerOnMe() {
    if (!navigator.geolocation || !window.map) { toast('GPS no disponible'); return; }
    navigator.geolocation.getCurrentPosition(p => {
      nvGpsPos = { lat: p.coords.latitude, lon: p.coords.longitude }; updateGpsTriangle(); startGpsWatch();
      window.map.setView([p.coords.latitude, p.coords.longitude], Math.max(window.map.getZoom(), 16), { animate: true });
      $('#nv-locate').classList.add('green');
    }, e => toast('GPS: ' + (e.code === 1 ? 'permiso denegado' : 'no disponible'), 'warn'), { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 });
  }

  function openProfile() {
    if (document.getElementById('nv-sheet-profile')?.classList.contains('open')) { closeSheets(); return; }
    const src = document.getElementById('elevation-chart');
    const line = src && src.querySelector('svg polyline');
    if (!line) { toast('Calcula la ruta para ver el perfil de altura', 'warn'); return; }
    const box = $('#nv-profile-chart');
    if (!box) return;
    box.innerHTML = src.innerHTML;
    box.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    box.querySelectorAll('svg').forEach(el => { el.removeAttribute('width'); el.removeAttribute('height'); });
    openSheet('nv-sheet-profile');
  }

  function syncRouteBar() {
    const dist = document.getElementById('r-dist');
    const time = document.getElementById('r-time');
    const start = document.getElementById('r-start');
    const end = document.getElementById('r-end');
    const bar = $('#nv-routebar');
    if (!bar) return;
    const dv = (dist?.textContent || '').trim();
    const tv = (time?.textContent || '').trim();
    const valid = dv && !/^0\s*km$/i.test(dv) && !/^-$/.test(dv);
    bar.classList.toggle('show', !!valid && !routeBarHidden);
    document.body.classList.toggle('nv-routebar-open', !!valid && !routeBarHidden);
    if (valid && !routeBarHidden) {
      $('#nv-route-title').textContent = `${dv} · ${tv || ''}`.trim();
      $('#nv-route-sub').textContent = `${start?.textContent || ''} → ${end?.textContent || ''}`;
    }
    if (document.querySelector('#nv-page-route.open')) renderRoutePage();
    syncRouteInfo();
  }

  function loadNativeWeather() {
    const box = $('#nv-weather-view');
    if (!box || !window.map) return;
    const run = (lat, lon, label) => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto`;
      box.textContent = 'Consultando.';
      fetch(url, { cache: 'no-store' }).then(r => r.json()).then(d => {
        if (!d.current) throw new Error('sin datos');
        const w = d.current;
        box.innerHTML = `<div style="font-size:34px;text-align:center;margin:6px 0">${wmo(w.weather_code)}</div>
          <div style="text-align:center"><strong>${Math.round(w.temperature_2m)} °C</strong> · ${wmoText(w.weather_code)}</div>
          <div style="text-align:center;color:#77808b;margin-top:6px">Viento ${Math.round(w.wind_speed_10m)} km/h</div>
          <div style="text-align:center;color:#9aa3ad;font-size:12px;margin-top:8px">${escapeHtml(label)} · ${lat.toFixed(4)}, ${lon.toFixed(4)}</div>`;
      }).catch(e => { box.textContent = 'No se pudo obtener el clima: ' + e.message; });
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(p => run(p.coords.latitude, p.coords.longitude, 'tu ubicación'), () => { const c = window.map.getCenter(); run(c.lat, c.lng, 'centro del mapa'); }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
    } else { const c = window.map.getCenter(); run(c.lat, c.lng, 'centro del mapa'); }
  }
  function wmo(c) { if (c === 0) return '☀️'; if (c <= 3) return '⛅'; if (c <= 48) return '🌫️'; if (c <= 57) return '🌦️'; if (c <= 67) return '🌧️'; if (c <= 77) return '❄️'; if (c <= 82) return '🌧️'; if (c <= 86) return '🌨️'; return '⛈️'; }
  function wmoText(c) { if (c === 0) return 'Despejado'; if (c <= 3) return 'Poco nuboso'; if (c <= 48) return 'Niebla'; if (c <= 57) return 'Llovizna'; if (c <= 67) return 'Lluvia'; if (c <= 77) return 'Nieve'; if (c <= 82) return 'Chubascos'; if (c <= 86) return 'Nieve'; return 'Tormenta'; }
  let nvNasaLayer = null, nvRadarLayer = null, nvRadarPath = null;
  function gibsDate() {
    const utc = new Date();
    const offset = utc.getUTCHours() >= 12 ? 0 : 86400000;
    return new Date(Date.now() - offset).toISOString().slice(0, 10);
  }
  function toggleNasaLayer() {
    if (!window.map || !window.L) return;
    if (nvNasaLayer) { window.map.removeLayer(nvNasaLayer); nvNasaLayer = null; $('#nv-nasa-toggle')?.classList.remove('on'); toast('NASA (nubes) desactivado'); return; }
    const date = gibsDate();
    const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
    nvNasaLayer = window.L.tileLayer(url, { maxZoom: 9, maxNativeZoom: 9, attribution: '© NASA GIBS' }).addTo(window.map);
    if (window.map.getZoom() > 7) window.map.setZoom(7);
    $('#nv-nasa-toggle')?.classList.add('on');
    toast(`NASA (nubes) · ${date} · zoom 7`);
  }
  async function toggleRadar() {
    if (!window.map || !window.L) return;
    if (nvRadarLayer) { window.map.removeLayer(nvRadarLayer); nvRadarLayer = null; $('#nv-radar-toggle')?.classList.remove('on'); toast('Radar de lluvia desactivado'); return; }
    try {
      if (!nvRadarPath) {
        const r = await fetch('https://api.rainviewer.com/public/weather-maps.json', { cache: 'no-store' });
        const j = await r.json();
        const past = j.radar?.past || [];
        if (!past.length) throw new Error('sin radar');
        nvRadarPath = past[past.length - 1].path;
      }
      const url = `https://tilecache.rainviewer.com${nvRadarPath}/256/{z}/{x}/{y}/2/1_1.png`;
      nvRadarLayer = window.L.tileLayer(url, { maxZoom: 7, maxNativeZoom: 7, opacity: 0.7, attribution: '© RainViewer' }).addTo(window.map);
      if (window.map.getZoom() > 7) window.map.setZoom(7);
      $('#nv-radar-toggle')?.classList.add('on');
      toast('Radar de lluvia activado · zoom 7');
    } catch (e) { toast('Radar: ' + e.message, 'warn'); }
  }
  function routeWeatherPoints() {
    const pts = [];
    if (window.startTown?.la) pts.push({ lat: window.startTown.la, lon: window.startTown.lo, n: window.startTown.n || 'Salida' });
    (window.waypoints || []).forEach(w => { if (w.la != null) pts.push({ lat: w.la, lon: w.lo, n: w.n || 'Parada' }); });
    if (window.endTown?.la) pts.push({ lat: window.endTown.la, lon: window.endTown.lo, n: window.endTown.n || 'Destino' });
    return pts;
  }
  function showRouteWeatherControls() {
    const box = $('#nv-weather-route-controls'), date = $('#nv-weather-date');
    if (!box || !date) return;
    const d = new Date(); d.setDate(d.getDate() + 1);
    const iso = x => x.toISOString().slice(0, 10);
    date.value = iso(d); date.min = iso(new Date()); const max = new Date(); max.setDate(max.getDate() + 16); date.max = iso(max);
    box.style.display = 'block';
    const view = $('#nv-weather-view'); if (view) view.textContent = 'Elige el día y pulsa Ver.';
  }
  async function loadRouteWeather() {
    const pts = routeWeatherPoints();
    if (!pts.length) { toast('Añade salida, paradas o destino', 'warn'); return; }
    const date = $('#nv-weather-date')?.value;
    const view = $('#nv-weather-view'); if (!date || !view) return;
    view.innerHTML = 'Consultando clima…';
    const results = await Promise.allSettled(pts.map(p => fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(4)}&longitude=${p.lon.toFixed(4)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto&start_date=${date}&end_date=${date}`, { cache: 'no-store' }).then(r => r.json())));
    let html = `<div style="font-weight:800;color:#c2410c;margin-bottom:6px">Clima · ${escapeHtml(date)}</div>`;
    let n = 0;
    results.forEach((r, i) => {
      if (r.status !== 'fulfilled' || !r.value?.daily) return;
      const d = r.value.daily;
      const tmin = d.temperature_2m_min?.[0], tmax = d.temperature_2m_max?.[0], prc = d.precipitation_sum?.[0] ?? 0, cod = d.weather_code?.[0] ?? 0;
      if (n++) html += '<div style="height:1px;background:#e6e9ee"></div>';
      html += `<div style="display:flex;align-items:center;gap:9px;padding:9px 0"><div style="font-size:24px;width:32px;text-align:center">${wmo(cod)}</div><div style="flex:1;min-width:0"><strong style="display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(pts[i].n)}</strong><small style="color:#697381">${wmoText(cod)} · ${prc} mm</small></div><strong style="color:#c2410c;font-size:13px">${Math.round(tmax)}° / ${Math.round(tmin)}°</strong></div>`;
    });
    view.innerHTML = n ? html : 'No se pudo obtener el clima.';
  }


  function toggleCompass() {
    compassOn = !compassOn;
    const rose = $('#nv-rose'); const btn = $('#nv-mode');
    rose.classList.toggle('show', compassOn);
    btn.classList.toggle('green', compassOn);
    if (compassOn) { startHeading(); requestAnimationFrame(placeRoseOnMap); } else { stopHeading(); rose.style.visibility = 'hidden'; }
  }
  function startHeading() {
    const go = () => {
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(r => { if (r !== 'granted') { toast('Permiso de brújula denegado'); compassOn = false; $('#nv-rose').classList.remove('show'); return; } attachOrientation(); }).catch(() => toast('Brújula no disponible'));
      } else attachOrientation();
    };
    go();
  }
  let sensorSeen = false;
  let absoluteSeen = false;
  let lastRawHeading = -1;
  function attachOrientation() {
    if (orientHandler) return;
    sensorSeen = false; absoluteSeen = false; lastRawHeading = -1;
    const apply = (e, absolute) => {
      let h = null;
      if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) h = e.webkitCompassHeading;
      else if (typeof e.alpha === 'number' && (!absolute || absoluteSeen || !sensorSeen)) h = 360 - e.alpha;
      if (h == null) return;
      sensorSeen = true;
      const screenAngle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      h = ((h + screenAngle) % 360 + 360) % 360;
      if (lastRawHeading >= 0) {
        let d = ((h - lastRawHeading + 540) % 360) - 180;
        if (Math.abs(d) < 0.6) d = 0;
        h = (lastRawHeading + d * 0.45 + 360) % 360;
      }
      lastRawHeading = h;
      heading = h;
      drawRose();
    };
    const absHandler = e => { if (typeof e.alpha === 'number') absoluteSeen = true; apply(e, true); };
    const relHandler = e => { if (!absoluteSeen) apply(e, false); };
    startGpsWatch();
    orientHandler = { absHandler, relHandler };
    window.addEventListener('deviceorientationabsolute', absHandler, true);
    window.addEventListener('deviceorientation', relHandler, true);
    if (navigator.geolocation) geoWatch = navigator.geolocation.watchPosition(p => {
      compassPos = { lat: p.coords.latitude, lon: p.coords.longitude };
      if (!sensorSeen && typeof p.coords.heading === 'number' && !isNaN(p.coords.heading)) { heading = p.coords.heading; drawRose(); }
      placeRoseOnMap();
    }, () => {}, { enableHighAccuracy: true, maximumAge: 3000 });
    drawRose();
  }
  function stopHeading() {
    if (orientHandler) {
      window.removeEventListener('deviceorientationabsolute', orientHandler.absHandler, true);
      window.removeEventListener('deviceorientation', orientHandler.relHandler, true);
      orientHandler = null;
    }
    if (geoWatch != null) { try { navigator.geolocation.clearWatch(geoWatch); } catch {} geoWatch = null; }
    sensorSeen = false; absoluteSeen = false; lastRawHeading = -1;
  }
  function placeRoseOnMap() {
    const rose = $('#nv-rose'); if (!rose) return;
    if (!compassOn || !compassPos || !window.map) { rose.style.visibility = 'hidden'; return; }
    const p = window.map.latLngToContainerPoint([compassPos.lat, compassPos.lon]);
    const w = rose.offsetWidth || 253;
    rose.style.left = (p.x - w / 2) + 'px';
    rose.style.top = (p.y - w / 2) + 'px';
    rose.style.visibility = 'visible';
  }
  function drawRose() {
    const cv = $('#nv-rose-canvas'); if (!cv) return;
    const css = cv.clientWidth || 253; const dpr = Math.min(window.devicePixelRatio || 1, 2); const size = Math.round(css * dpr);
    if (cv.width !== size) { cv.width = size; cv.height = size; }
    const ctx = cv.getContext('2d'); const c = size / 2; const R = c - 3 * dpr;
    ctx.clearRect(0, 0, size, size); ctx.save(); ctx.translate(c, c);
    ctx.strokeStyle = 'rgba(154,166,180,.7)'; ctx.lineWidth = 1.4 * dpr; ctx.beginPath(); ctx.arc(0, 0, R + 1 * dpr, 0, Math.PI * 2); ctx.stroke();
    const sweep = (((heading + 540) % 360) - 180) * Math.PI / 180;
    if (Math.abs(sweep) > 0.03) { ctx.strokeStyle = '#ff6a00'; ctx.lineWidth = 5 * dpr; ctx.beginPath(); ctx.arc(0, 0, R - 5 * dpr, -Math.PI / 2, -Math.PI / 2 + sweep, sweep < 0); ctx.stroke(); }
    for (let a = 0; a < 360; a += 5) {
      const major = a % 30 === 0; const rad = (a - 90) * Math.PI / 180; const r1 = R - 9 * dpr; const r2 = R - (major ? 19 : 14) * dpr;
      ctx.strokeStyle = Math.abs(((a - heading + 540) % 360) - 180) <= 15 ? '#ff6a00' : 'rgba(154,166,180,.85)';
      ctx.lineWidth = (major ? 2 : 1) * dpr; ctx.beginPath(); ctx.moveTo(Math.cos(rad) * r1, Math.sin(rad) * r1); ctx.lineTo(Math.cos(rad) * r2, Math.sin(rad) * r2); ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.72)'; ctx.shadowBlur = 4 * dpr;
    [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SO', 225], ['O', 270], ['NO', 315]].forEach(([txt, a]) => {
      const rad = (a - 90) * Math.PI / 180; const rr = R * 0.77;
      ctx.font = `800 ${(a % 90 === 0 ? 18 : 13) * dpr}px system-ui,sans-serif`;
      ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.78)'; ctx.strokeText(txt, Math.cos(rad) * rr, Math.sin(rad) * rr);
      ctx.fillStyle = a === 0 ? '#ff6a00' : '#e3e9ef'; ctx.fillText(txt, Math.cos(rad) * rr, Math.sin(rad) * rr);
    });
    ctx.shadowBlur = 0;
    // Aguja clasica: gira con el rumbo real de la brujula.
    ctx.save(); ctx.rotate(heading * Math.PI / 180);
    ctx.beginPath(); ctx.moveTo(0, -R * .46); ctx.lineTo(8 * dpr, 4 * dpr); ctx.lineTo(0, 0); ctx.lineTo(-8 * dpr, 4 * dpr); ctx.closePath();
    ctx.fillStyle = '#e53935'; ctx.fill(); ctx.beginPath(); ctx.moveTo(0, R * .46); ctx.lineTo(8 * dpr, -4 * dpr); ctx.lineTo(0, 0); ctx.lineTo(-8 * dpr, -4 * dpr); ctx.closePath(); ctx.fillStyle = '#1976d2'; ctx.fill(); ctx.restore();
    const hrad = (heading - 90) * Math.PI / 180;
    ctx.beginPath(); ctx.moveTo(Math.cos(hrad) * (R - 2 * dpr), Math.sin(hrad) * (R - 2 * dpr));
    ctx.lineTo(Math.cos(hrad - .035) * (R - 15 * dpr), Math.sin(hrad - .035) * (R - 15 * dpr));
    ctx.lineTo(Math.cos(hrad + .035) * (R - 15 * dpr), Math.sin(hrad + .035) * (R - 15 * dpr)); ctx.closePath();
    ctx.fillStyle = '#ff6a00'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 3 * dpr, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#555'; ctx.lineWidth = 1 * dpr; ctx.stroke();
    ctx.restore();
    const card = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(heading / 45) % 8];
    $('#nv-rose-deg').textContent = `${Math.round(heading)}°${card}`;
    if (nvGpsMarker) updateGpsTriangle();
  }

  function boot() {
    if (window.__rutasMoterasReady) { buildShell(); installRouteObserver(); return; }
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (window.__rutasMoterasReady) { clearInterval(t); buildShell(); installRouteObserver(); }
      else if (tries > 120) clearInterval(t);
    }, 100);
  }
  function installRouteObserver() {
    const a = document.getElementById('r-dist'), b = document.getElementById('r-time');
    if (a) new MutationObserver(syncRouteBar).observe(a, { childList: true, characterData: true, subtree: true });
    if (b) new MutationObserver(syncRouteBar).observe(b, { childList: true, characterData: true, subtree: true });
    syncRouteBar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
