/* Hjem — vægpanel til Homey Pro
 * Ren HTML/JS, ingen build. Taler direkte med Homey Pro's Web API med en API-nøgle.
 */
(() => {
  'use strict';

  // ---------- Konfiguration ----------
  const STORE_KEY = 'homey-panel-config-v1';
  const POLL_MS = 4000;            // enheder
  const SLOW_POLL_MS = 5 * 60000;  // zoner, moods, flows
  const NIGHT_FROM = 22, NIGHT_TO = 6, DIM_AFTER_MS = 60000;

  const defaults = {
    address: '', token: '', demo: false, night: true,
    pick: { climate: null, lights: null, speakers: null, moods: null, flows: null },
  };
  let cfg = load();

  function load() {
    try {
      const c = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return { ...defaults, ...c, pick: { ...defaults.pick, ...(c.pick || {}) } };
    } catch { return structuredClone(defaults); }
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch {} }

  // URL-parameter ?demo for hurtig forhåndsvisning
  if (new URLSearchParams(location.search).has('demo')) cfg.demo = true;

  // ---------- Hjælpere ----------
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v, d = 1) => (typeof v === 'number' ? v.toLocaleString('da-DK', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '–');

  function normalizeAddress(a) {
    a = (a || '').trim().replace(/\/+$/, '');
    const ip = a.match(/^(?:https?:\/\/)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ip) return `https://${ip.slice(1).join('-')}.homey.homeylocal.com`;
    if (a && !/^https?:\/\//.test(a)) a = 'https://' + a;
    return a;
  }

  let toastTimer;
  function toast(msg, err = false) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3500);
  }
  function setStatus(ok) { $('#status').className = 'status ' + (ok ? 'ok' : 'bad'); }

  // ---------- API ----------
  async function http(method, path, body, c = cfg) {
    const res = await fetch(normalizeAddress(c.address) + path, {
      method,
      headers: { Authorization: 'Bearer ' + c.token.trim(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (!res.ok) {
      let msg = res.status + ' ' + res.statusText;
      try { const j = await res.json(); msg = j.error_description || j.error || j.message || msg; } catch {}
      const e = new Error(msg); e.status = res.status; throw e;
    }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }

  const realApi = {
    devices: () => http('GET', '/api/manager/devices/device/'),
    zones: () => http('GET', '/api/manager/zones/zone/'),
    moods: () => http('GET', '/api/manager/moods/mood/').catch(() => ({})),
    flows: () => http('GET', '/api/manager/flow/flow/').catch(() => ({})),
    advFlows: () => http('GET', '/api/manager/flow/advancedflow/').catch(() => ({})),
    setCap: (id, cap, value) => http('PUT', `/api/manager/devices/device/${id}/capability/${cap}`, { value }),
    setMood: (id) => http('POST', `/api/manager/moods/mood/${id}/set`, {}),
    trigger: (kind, id) => http('POST', `/api/manager/flow/${kind === 'adv' ? 'advancedflow' : 'flow'}/${id}/trigger`, {}),
  };
  const api = () => (cfg.demo ? window.DemoHomey : realApi);

  // ---------- State ----------
  const S = { devices: {}, zones: {}, moods: {}, flows: [], speaker: null, lastSlow: 0 };
  const pending = new Map();   // "id:cap" -> { value, until } (optimistisk UI)
  let interactingUntil = 0;    // pause render mens man trækker i en slider

  function capVal(d, cap) {
    const p = pending.get(d.id + ':' + cap);
    if (p && p.until > Date.now()) return p.value;
    return d.capabilitiesObj?.[cap]?.value;
  }
  const has = (d, cap) => d.capabilitiesObj && cap in d.capabilitiesObj;
  const zoneName = (id) => S.zones[id]?.name || 'Andet';

  // ---------- Klassificering ----------
  const isSpeaker = (d) => d.class === 'speaker' || has(d, 'speaker_playing');
  const isLight = (d) => !isSpeaker(d) && (d.class === 'light' || d.virtualClass === 'light');
  const CLIMATE_CLASSES = ['fan', 'airtreatment', 'thermostat', 'heater', 'sensor', 'airconditioning', 'airpurifier', 'dehumidifier', 'humidifier'];
  const isVent = (d) => /komfovent|ventilat/i.test(d.name) || ['fan', 'airtreatment'].includes(d.class) || has(d, 'target_temperature') && !isLight(d);
  const isClimate = (d) => !isSpeaker(d) && !isLight(d) &&
    (isVent(d) || (CLIMATE_CLASSES.includes(d.class) && (has(d, 'measure_temperature') || has(d, 'measure_humidity') || has(d, 'measure_co2'))));

  function pickList(section, all, auto) {
    const p = cfg.pick[section];
    if (Array.isArray(p) && p.length) return p.map((id) => all.find((x) => x.id === id)).filter(Boolean);
    return all.filter(auto);
  }

  // ---------- Rendering ----------
  const last = {};
  function put(id, html) { if (last[id] !== html) { $('#' + id).innerHTML = html; last[id] = html; } }

  const ICON = {
    bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M16 5h2v14h-2zM4 5l11 7-11 7z"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    vol: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    note: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  };

  function unitOf(d, cap) { return d.capabilitiesObj?.[cap]?.units || ({ measure_temperature: '°', target_temperature: '°', measure_humidity: '%', measure_co2: 'ppm' }[cap] || ''); }
  function titleOf(d, cap) { return d.capabilitiesObj?.[cap]?.title || cap; }

  function rangeHTML(d, cap, cls = '') {
    const o = d.capabilitiesObj[cap];
    const isDim = cap === 'dim' || cap === 'volume_set' || (o.min === 0 && o.max === 1);
    const min = isDim ? 0 : (o.min ?? 0), max = isDim ? 100 : (o.max ?? 100);
    const step = isDim ? 1 : (o.step ?? 1);
    const raw = capVal(d, cap) ?? min;
    const v = isDim ? Math.round(raw * 100) : raw;
    const pct = ((v - min) / ((max - min) || 1)) * 100;
    return `<input type="range" class="${cls}" min="${min}" max="${max}" step="${step}" value="${v}"
      style="--pct:${pct}%" data-dev="${d.id}" data-cap="${cap}" data-scale="${isDim ? 100 : 1}">`;
  }

  function renderClimate(list) {
    if (!list.length) return '<div class="empty">Ingen klima-enheder fundet. Vælg dem under Indstillinger.</div>';
    const vents = list.filter(isVent), sensors = list.filter((d) => !isVent(d));
    let html = '';
    for (const d of vents) {
      const caps = d.capabilities || Object.keys(d.capabilitiesObj || {});
      const measures = caps.filter((c) => c.startsWith('measure_') && typeof capVal(d, c) === 'number');
      const alarms = caps.filter((c) => c.startsWith('alarm_') && capVal(d, c) === true);
      const controls = caps.filter((c) => d.capabilitiesObj[c]?.setable && c !== 'onoff' && !/^button/.test(c));
      html += `<div class="card ${d.available === false ? 'offline' : ''}">
        <div class="card-title"><span>${esc(d.name)}</span>
          ${has(d, 'onoff') ? `<button class="switch ${capVal(d, 'onoff') ? 'on' : ''}" data-action="toggle" data-dev="${d.id}" data-cap="onoff" aria-label="Tænd/sluk"></button>` : ''}
        </div>
        ${measures.length ? `<div class="measures">${measures.map((c) => `<div class="measure"><div class="v">${fmt(capVal(d, c))}${esc(unitOf(d, c))}</div><div class="l">${esc(titleOf(d, c))}</div></div>`).join('')}</div>` : ''}
        ${controls.map((c) => controlHTML(d, c)).join('')}
        ${alarms.map((c) => `<div class="alarm">⚠ ${esc(titleOf(d, c))}</div>`).join('')}
      </div>`;
    }
    if (sensors.length) {
      html += `<div class="sensors">${sensors.map((d) => {
        const t = capVal(d, 'measure_temperature'), h = capVal(d, 'measure_humidity'), co2 = capVal(d, 'measure_co2');
        const big = typeof t === 'number' ? fmt(t) + '°' : typeof h === 'number' ? fmt(h, 0) + '%' : typeof co2 === 'number' ? fmt(co2, 0) : '–';
        const small = [typeof t === 'number' && typeof h === 'number' ? fmt(h, 0) + '% fugt' : '', typeof co2 === 'number' && typeof t === 'number' ? fmt(co2, 0) + ' ppm' : ''].filter(Boolean).join(' · ');
        return `<div class="sensor ${d.available === false ? 'offline' : ''}"><div class="name">${esc(d.name)}</div><div class="big">${big}</div>${small ? `<div class="small">${small}</div>` : ''}</div>`;
      }).join('')}</div>`;
    }
    return html;
  }

  function controlHTML(d, cap) {
    const o = d.capabilitiesObj[cap];
    const label = esc(titleOf(d, cap));
    if (o.type === 'enum' && Array.isArray(o.values)) {
      const cur = capVal(d, cap);
      return `<div class="ctl"><div class="ctl-label">${label}</div><div class="seg">${o.values.map((v) =>
        `<button class="${String(cur) === String(v.id) ? 'on' : ''}" data-action="set" data-dev="${d.id}" data-cap="${cap}" data-value="${esc(v.id)}" data-type="enum">${esc(v.title?.da || v.title?.en || v.title || v.id)}</button>`).join('')}</div></div>`;
    }
    if (o.type === 'boolean') {
      return `<div class="ctl"><div class="ctl-label"><span>${label}</span><button class="switch ${capVal(d, cap) ? 'on' : ''}" data-action="toggle" data-dev="${d.id}" data-cap="${cap}"></button></div></div>`;
    }
    if (o.type === 'number' && cap.startsWith('target_temperature')) {
      const v = capVal(d, cap);
      return `<div class="ctl"><div class="ctl-label">${label}</div><div class="stepper">
        <button data-action="step" data-dev="${d.id}" data-cap="${cap}" data-delta="-${o.step || 0.5}">−</button>
        <div class="val">${fmt(v)}${esc(unitOf(d, cap))}</div>
        <button data-action="step" data-dev="${d.id}" data-cap="${cap}" data-delta="${o.step || 0.5}">+</button></div></div>`;
    }
    if (o.type === 'number') {
      const v = capVal(d, cap);
      const shown = (o.min === 0 && o.max === 1) ? Math.round((v ?? 0) * 100) + '%' : fmt(v) + esc(unitOf(d, cap));
      return `<div class="ctl"><div class="ctl-label"><span>${label}</span><span class="rv">${shown}</span></div>${rangeHTML(d, cap, 'climate-range')}</div>`;
    }
    return '';
  }

  function renderLights(list) {
    if (!list.length) return '<div class="empty">Ingen lys fundet.</div>';
    const byZone = {};
    for (const d of list) (byZone[d.zone] ||= []).push(d);
    const zones = Object.keys(byZone).sort((a, b) => zoneName(a).localeCompare(zoneName(b), 'da'));
    return zones.map((z) => {
      const ds = byZone[z].sort((a, b) => a.name.localeCompare(b.name, 'da'));
      const anyOn = ds.some((d) => capVal(d, 'onoff'));
      return `<div class="zone"><div class="zone-head"><span class="zname">${esc(zoneName(z))}</span>
        ${anyOn ? `<button data-action="zone-off" data-zone="${esc(z)}">Sluk alle</button>` : ''}</div>
        <div class="lights">${ds.map(lightHTML).join('')}</div></div>`;
    }).join('');
  }

  function lightHTML(d) {
    const on = !!capVal(d, 'onoff');
    const dim = has(d, 'dim') ? capVal(d, 'dim') : null;
    const state = d.available === false ? 'Offline' : on ? (dim != null ? Math.round(dim * 100) + '%' : 'Tændt') : 'Slukket';
    return `<div class="light ${on ? 'on' : ''} ${d.available === false ? 'offline' : ''}">
      <button class="tap" data-action="toggle" data-dev="${d.id}" data-cap="onoff">
        <span class="bulb">${ICON.bulb}</span>
        <span><div class="lname">${esc(d.name)}</div><div class="lstate">${state}</div></span>
      </button>
      ${has(d, 'dim') && d.capabilitiesObj.dim.setable !== false ? rangeHTML(d, 'dim') : ''}
    </div>`;
  }

  function imageUrl(d) {
    const img = (d.images || []).find((i) => i.imageObj?.url) || null;
    if (!img) return '';
    const u = img.imageObj.url;
    if (/^https?:/.test(u) || u.startsWith('data:')) return u;
    return normalizeAddress(cfg.address) + u + (img.imageObj.lastUpdated ? '?t=' + img.imageObj.lastUpdated : '');
  }

  function renderSpeakers(list) {
    if (!list.length) return '<div class="empty">Ingen højttalere fundet.</div>';
    if (!list.find((d) => d.id === S.speaker)) {
      S.speaker = (list.find((d) => capVal(d, 'speaker_playing')) || list[0]).id;
    }
    const d = list.find((x) => x.id === S.speaker);
    const playing = !!capVal(d, 'speaker_playing');
    const muted = !!capVal(d, 'volume_mute');
    const art = cfg.demo ? '' : imageUrl(d);
    return `<div class="card ${d.available === false ? 'offline' : ''}">
      ${list.length > 1 ? `<div class="tabs">${list.map((s) => `<button class="${s.id === d.id ? 'on' : ''}" data-action="speaker" data-id="${s.id}">${capVal(s, 'speaker_playing') ? '<span class="dot"></span>' : ''}${esc(s.name)}</button>`).join('')}</div>` : `<div class="card-title">${esc(d.name)}</div>`}
      <div class="np">
        <div class="art" ${art ? `style="background-image:url('${esc(art)}')"` : ''}>${art ? '' : ICON.note}</div>
        <div><div class="track">${esc(capVal(d, 'speaker_track') || (playing ? 'Afspiller' : 'Intet spiller'))}</div>
        <div class="artist">${esc(capVal(d, 'speaker_artist') || capVal(d, 'speaker_album') || '')}</div></div>
      </div>
      <div class="transport">
        ${has(d, 'speaker_prev') ? `<button data-action="press" data-dev="${d.id}" data-cap="speaker_prev" aria-label="Forrige">${ICON.prev}</button>` : ''}
        ${has(d, 'speaker_playing') ? `<button class="play" data-action="toggle" data-dev="${d.id}" data-cap="speaker_playing" aria-label="Afspil/pause">${playing ? ICON.pause : ICON.play}</button>` : ''}
        ${has(d, 'speaker_next') ? `<button data-action="press" data-dev="${d.id}" data-cap="speaker_next" aria-label="Næste">${ICON.next}</button>` : ''}
      </div>
      ${has(d, 'volume_set') ? `<div class="vol">
        ${has(d, 'volume_mute') ? `<button class="mute" data-action="toggle" data-dev="${d.id}" data-cap="volume_mute" aria-label="Lyd fra">${muted ? ICON.mute : ICON.vol}</button>` : ICON.vol}
        ${rangeHTML(d, 'volume_set')}</div>` : ''}
    </div>`;
  }

  function renderChips(items, action) {
    if (!items.length) return '<div class="empty">Ingen fundet.</div>';
    return items.map((m) => `<button class="chip" data-action="${action}" data-id="${esc(m.id)}" ${m.kind ? `data-kind="${m.kind}"` : ''}>${esc(m.name)}</button>`).join('');
  }

  function allDevices() { return Object.values(S.devices).map((d) => ({ ...d, id: d.id || d._id })); }
  function moodList() { return Object.entries(S.moods).map(([id, m]) => ({ id, name: m.name })).sort((a, b) => a.name.localeCompare(b.name, 'da')); }

  function render() {
    if (Date.now() < interactingUntil) return;
    const devs = allDevices();
    put('climate', renderClimate(pickList('climate', devs, isClimate)));
    put('lights', renderLights(pickList('lights', devs, isLight)));
    put('speakers', renderSpeakers(pickList('speakers', devs, isSpeaker)));
    put('moods', renderChips(pickList('moods', moodList(), () => true), 'mood'));
    put('flows', renderChips(pickList('flows', S.flows, () => true), 'flow'));
  }

  // ---------- Hentning ----------
  let pollTimer, failing = 0;
  async function refresh(force = false) {
    if (!cfg.demo && (!cfg.address || !cfg.token)) { setStatus(false); showFirstRun(); return; }
    try {
      const a = api();
      if (force || Date.now() - S.lastSlow > SLOW_POLL_MS) {
        const [zones, moods, flows, adv] = await Promise.all([a.zones(), a.moods(), a.flows(), a.advFlows()]);
        S.zones = zones || {}; S.moods = moods || {};
        S.flows = [
          ...Object.values(flows || {}).filter((f) => f.triggerable && f.enabled !== false).map((f) => ({ id: f.id, name: f.name, kind: 'flow' })),
          ...Object.values(adv || {}).filter((f) => f.triggerable && f.enabled !== false).map((f) => ({ id: f.id, name: f.name, kind: 'adv' })),
        ].sort((x, y) => x.name.localeCompare(y.name, 'da'));
        S.lastSlow = Date.now();
      }
      S.devices = (await a.devices()) || {};
      setStatus(true);
      if (failing > 1) toast('Forbundet igen');
      failing = 0;
      render();
    } catch (e) {
      failing++;
      setStatus(false);
      if (failing === 1 || failing % 15 === 0) toast(explain(e), true);
    }
  }
  function explain(e) {
    if (e.status === 401 || e.status === 403) return 'Homey afviste API-nøglen. Tjek nøglen og dens rettigheder.';
    if (e instanceof TypeError) return 'Kan ikke nå Homey. Tjek adressen, og at iPad’en er på samme netværk.';
    return 'Fejl: ' + e.message;
  }
  function startPolling() {
    clearInterval(pollTimer);
    refresh(true);
    pollTimer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  // ---------- Handlinger ----------
  async function setCap(id, cap, value, holdMs = 6000) {
    pending.set(id + ':' + cap, { value, until: Date.now() + holdMs });
    render();
    try { await api().setCap(id, cap, value); }
    catch (e) { pending.delete(id + ':' + cap); render(); toast(explain(e), true); }
  }
  const dev = (id) => allDevices().find((d) => d.id === id);

  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const { action, dev: id, cap } = el.dataset;
    switch (action) {
      case 'toggle': { const d = dev(id); if (d) setCap(id, cap, !capVal(d, cap)); break; }
      case 'press': setCap(id, cap, true, 800); break;
      case 'set': {
        const v = el.dataset.type === 'enum' ? el.dataset.value : JSON.parse(el.dataset.value);
        setCap(id, cap, v); break;
      }
      case 'step': {
        const d = dev(id); if (!d) break;
        const o = d.capabilitiesObj[cap];
        let v = (capVal(d, cap) ?? 20) + parseFloat(el.dataset.delta);
        if (o.min != null) v = Math.max(o.min, v);
        if (o.max != null) v = Math.min(o.max, v);
        setCap(id, cap, Math.round(v * 10) / 10); break;
      }
      case 'zone-off': {
        const z = el.dataset.zone;
        pickList('lights', allDevices(), isLight).filter((d) => d.zone === z && capVal(d, 'onoff')).forEach((d) => setCap(d.id, 'onoff', false));
        break;
      }
      case 'speaker': S.speaker = el.dataset.id; render(); break;
      case 'mood': fire(el, () => api().setMood(el.dataset.id)); break;
      case 'flow': fire(el, () => api().trigger(el.dataset.kind, el.dataset.id)); break;
      case 'open-settings': openSettings(); break;
      case 'test': testConnection(); break;
      case 'demo': cfg.demo = true; save(); $('#settings').close(); S.lastSlow = 0; startPolling(); toast('Demo-tilstand — ingen rigtige enheder styres'); break;
      case 'save': saveSettings(); break;
      case 'reset': if (confirmReset()) { localStorage.removeItem(STORE_KEY); location.reload(); } break;
    }
  });

  async function fire(el, fn) {
    el.classList.add('fired');
    try { await fn(); setTimeout(() => el.classList.remove('fired'), 900); }
    catch (e) { el.classList.remove('fired'); toast(explain(e), true); }
  }

  // Sliders: live label, send ved slip
  document.addEventListener('pointerdown', (ev) => { if (ev.target.matches('input[type=range]')) interactingUntil = Date.now() + 60000; });
  document.addEventListener('input', (ev) => {
    const r = ev.target;
    if (!r.matches('input[type=range]')) return;
    interactingUntil = Date.now() + 60000;
    const pct = ((r.value - r.min) / ((r.max - r.min) || 1)) * 100;
    r.style.setProperty('--pct', pct + '%');
    const rv = r.closest('.ctl')?.querySelector('.rv'); if (rv) rv.textContent = r.value + (r.dataset.scale === '100' ? '%' : '');
    const ls = r.closest('.light')?.querySelector('.lstate'); if (ls) ls.textContent = r.value + '%';
  });
  document.addEventListener('change', (ev) => {
    const r = ev.target;
    if (!r.matches('input[type=range]')) return;
    const scale = Number(r.dataset.scale) || 1;
    let value = Number(r.value) / scale;
    interactingUntil = 0;
    if (r.dataset.cap === 'dim') { const d = dev(r.dataset.dev); if (d && !capVal(d, 'onoff') && value > 0) pending.set(d.id + ':onoff', { value: true, until: Date.now() + 6000 }); }
    setCap(r.dataset.dev, r.dataset.cap, value);
  });

  // ---------- Indstillinger ----------
  function showFirstRun() {
    put('climate', '<div class="card">Velkommen! Tryk på ⚙ øverst til højre for at forbinde til din Homey Pro — eller prøv demoen.</div>');
  }

  function openSettings() {
    $('#cfg-address').value = cfg.demo && !cfg.address ? '' : cfg.address;
    $('#cfg-token').value = cfg.token;
    $('#cfg-night').checked = cfg.night;
    $('#test-result').textContent = '';
    buildPickers();
    $('#settings').showModal();
  }

  function buildPickers() {
    const devs = allDevices().sort((a, b) => a.name.localeCompare(b.name, 'da'));
    const sections = [
      ['climate', 'Klima & ventilation', devs, isClimate, (d) => zoneName(d.zone)],
      ['lights', 'Lys', devs, isLight, (d) => zoneName(d.zone)],
      ['speakers', 'Musik', devs, isSpeaker, (d) => zoneName(d.zone)],
      ['moods', 'Stemninger', moodList(), () => true, () => ''],
      ['flows', 'Flows', S.flows, () => true, (f) => (f.kind === 'adv' ? 'Avanceret' : '')],
    ];
    if (!devs.length) { $('#pickers').innerHTML = '<p class="muted">Forbind først — så kan du vælge enheder her.</p>'; return; }
    $('#pickers').innerHTML = sections.map(([key, title, items, auto, sub]) => {
      const chosen = cfg.pick[key];
      const shown = new Set(pickList(key, items, auto).map((x) => x.id));
      const candidates = key === 'moods' || key === 'flows' ? items : items.filter((d) => auto(d) || (chosen || []).includes(d.id) || key === 'climate' && (has(d, 'measure_temperature') || has(d, 'measure_humidity')) || key === 'lights' && has(d, 'onoff'));
      return `<details class="picker" data-key="${key}"><summary>${title} <span class="muted">— ${chosen?.length ? 'valgt manuelt' : 'automatisk'} (${shown.size})</span></summary>
        <div class="opts">${candidates.map((x) => `<label><input type="checkbox" value="${esc(x.id)}" ${chosen?.length && shown.has(x.id) ? 'checked' : ''}> ${esc(x.name)} <small>${sub(x) === x.name ? '' : esc(sub(x))}</small></label>`).join('') || '<span class="muted">Intet at vælge</span>'}</div></details>`;
    }).join('');
  }

  async function testConnection() {
    const c = { ...cfg, address: $('#cfg-address').value, token: $('#cfg-token').value };
    const out = $('#test-result');
    if (!c.address || !c.token) { out.textContent = 'Udfyld adresse og nøgle.'; return; }
    out.textContent = 'Tester…';
    try {
      const d = await http('GET', '/api/manager/devices/device/', undefined, c);
      out.textContent = `✓ Forbundet — ${Object.keys(d || {}).length} enheder fundet`;
    } catch (e) { out.textContent = '✕ ' + explain(e); }
  }

  function saveSettings() {
    const addr = $('#cfg-address').value.trim();
    const tok = $('#cfg-token').value.trim();
    const changedConn = addr !== cfg.address || tok !== cfg.token;
    cfg.address = addr; cfg.token = tok; cfg.night = $('#cfg-night').checked;
    if (changedConn && addr && tok) cfg.demo = false;
    document.querySelectorAll('details.picker').forEach((det) => {
      const ids = [...det.querySelectorAll('input:checked')].map((i) => i.value);
      cfg.pick[det.dataset.key] = ids.length ? ids : null;
    });
    if (changedConn) cfg.pick = { ...defaults.pick };
    save();
    $('#settings').close();
    Object.keys(last).forEach((k) => delete last[k]);
    if (changedConn) { S.devices = {}; S.lastSlow = 0; startPolling(); } else render();
    toast('Gemt');
  }

  function confirmReset() { return window.confirm('Slet adresse, nøgle og alle valg på denne iPad?'); }

  // ---------- Ur, nat-dæmpning ----------
  function tick() {
    const now = new Date();
    $('#time').textContent = now.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
    $('#date').textContent = now.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
    const h = now.getHours();
    const night = cfg.night && (h >= NIGHT_FROM || h < NIGHT_TO);
    $('#dimmer').hidden = !(night && Date.now() - lastTouch > DIM_AFTER_MS);
  }
  let lastTouch = Date.now();
  ['pointerdown', 'keydown'].forEach((t) => document.addEventListener(t, (e) => {
    const wasDim = !$('#dimmer').hidden;
    lastTouch = Date.now();
    if (wasDim) { $('#dimmer').hidden = true; e.preventDefault(); e.stopPropagation(); }
  }, true));
  setInterval(tick, 1000); tick();

  // ---------- Start ----------
  if (cfg.demo || (cfg.address && cfg.token)) startPolling(); else { setStatus(false); showFirstRun(); }
})();
