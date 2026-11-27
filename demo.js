/* Demo-data, så panelet kan prøves uden en Homey. Bruges kun i demo-tilstand. */
window.DemoHomey = (() => {
  const num = (title, value, units, extra = {}) => ({ type: 'number', title, value, units, setable: false, ...extra });
  const zones = {
    z1: { name: 'Opholdsstue' }, z2: { name: 'Køkken' }, z3: { name: 'Primært soveværelse' }, z4: { name: 'Gang' },
    z5: { name: 'Børneværelse' }, z6: { name: 'Kontor' }, z7: { name: 'Badeværelse' }, z8: { name: 'Toilet' }, z9: { name: 'Hjem' },
  };
  const light = (id, name, zone, on, dim, cls = 'light') => ({
    id, name, zone, class: cls, available: true,
    capabilitiesObj: {
      onoff: { type: 'boolean', title: 'Tændt', value: on, setable: true },
      ...(dim != null ? { dim: { type: 'number', title: 'Lysstyrke', value: dim, min: 0, max: 1, step: 0.01, setable: true } } : {}),
    },
  });
  const thermo = (id, name, zone, t, tg) => ({
    id, name, zone, class: 'thermostat', available: true, driverId: 'homey:app:com.uponor.smatrix:thermostat',
    capabilitiesObj: {
      measure_temperature: num('Temperatur', t, '°C'),
      target_temperature: { type: 'number', title: 'Ønsket temperatur', value: tg, min: 5, max: 35, step: 0.5, units: '°C', setable: true },
    },
  });
  const speaker = (id, name, zone, playing, track, artist, vol, driverId = 'homey:app:com.sonos:speaker') => ({
    id, name, zone, class: 'speaker', available: true, driverId,
    capabilitiesObj: {
      speaker_playing: { type: 'boolean', title: 'Afspiller', value: playing, setable: true },
      speaker_prev: { type: 'boolean', title: 'Forrige', value: false, setable: true },
      speaker_next: { type: 'boolean', title: 'Næste', value: false, setable: true },
      speaker_track: { type: 'string', title: 'Nummer', value: track },
      speaker_artist: { type: 'string', title: 'Kunstner', value: artist },
      volume_set: { type: 'number', title: 'Lydstyrke', value: vol, min: 0, max: 1, step: 0.01, setable: true },
      volume_mute: { type: 'boolean', title: 'Lyd fra', value: false, setable: true },
    },
  });
  const list = [
    {
      id: 'vent', name: 'Komfovent C6/C6M', zone: 'z9', class: 'fan', available: true, driverId: 'homey:app:com.trondole.komfovent-c6m:c6m',
      capabilitiesObj: {
        onoff: { type: 'boolean', title: 'Tændt', value: true, setable: true },
        measure_temperature: num('Indblæsning', 20.4, '°C'),
        measure_humidity: num('Fugt', 41, '%'),
        measure_power: num('Effekt', 232, 'W'),
        ventilation_mode: { type: 'enum', title: 'Tilstand', value: 'normal', setable: true,
          values: [{ id: 'away', title: 'Ude' }, { id: 'normal', title: 'Normal' }, { id: 'intensive', title: 'Intensiv' }, { id: 'boost', title: 'Boost' }] },
        alarm_filter: { type: 'boolean', title: 'Skift filter', value: false },
      },
    },
    { id: 'pur', name: 'STARKVIND Air Purifier', zone: 'z9', class: 'fan', available: true,
      capabilitiesObj: { onoff: { type: 'boolean', title: 'Tændt', value: false, setable: true }, measure_pm25: num('PM2.5', 4, 'µg/m³'),
        fan_mode: { type: 'enum', title: 'Hastighed', value: 'auto', setable: true, values: [{ id: 'auto', title: 'Auto' }, { id: '1', title: '1' }, { id: '3', title: '3' }, { id: '5', title: '5' }] } } },
    thermo('t1', 'Stue', 'z1', 21.8, 22), thermo('t2', 'Soveværelse', 'z3', 19.1, 19), thermo('t3', 'Værelse nummer to', 'z5', 20.6, 21),
    thermo('t4', 'Værelse nummer et', 'z9', 20.2, 20), thermo('t5', 'Forældrebadeværelse', 'z7', 22.4, 23), thermo('t6', 'Badeværelse', 'z8', 21.9, 22),
    thermo('t7', 'Kontor lille', 'z6', 20.8, 21), thermo('t8', 'Gang', 'z4', 20.1, 20),
    light('l1', 'TRÅDFRI Dimmable Transformer', 'z3', true, 0.6), light('l2', 'JETSTRÖM loftslampe', 'z3', false, 0.8),
    light('l3', 'Bedroom light', 'z3', false, null, 'socket'), light('l4', 'KAJPLATS GU10', 'z7', false, 0.7),
    light('l5', 'BoxDIMZ', 'z9', false, 0.5), light('l6', 'Shelly Outdoorlight', 'z4', true, null),
    speaker('sp1', 'Stue', 'z1', true, 'Kind of Blue — So What', 'Miles Davis', 0.28),
    speaker('sp2', 'Køkken', 'z2', false, '', '', 0.4), speaker('sp3', 'Kontor', 'z6', false, '', '', 0.2),
    speaker('cc', 'Stue', 'z1', false, '', '', 0.5, 'homey:app:com.google.chromecast:chromecast'),
    { id: 'vac', name: 'L50 Ultra', zone: 'z6', class: 'vacuumcleaner', available: true, driverId: 'homey:app:com.dreame:vacuum',
      capabilitiesObj: { onoff: { type: 'boolean', title: 'Gør rent', value: false, setable: true }, measure_battery: num('Batteri', 100, '%'),
        vacuum_status: { type: 'string', title: 'Status', value: 'Oplader' } } },
    { id: 'mow', name: 'Navimow i206 AWD', zone: 'z9', class: 'other', available: true, driverId: 'homey:app:com.navimow:mower',
      capabilitiesObj: { onoff: { type: 'boolean', title: 'Slå græs', value: false, setable: true }, measure_battery: num('Batteri', 84, '%'),
        mower_status: { type: 'string', title: 'Status', value: 'I ladestation' } } },
    { id: 'dw', name: 'Opvaskemaskine', zone: 'z2', class: 'other', available: true, driverId: 'homey:app:com.homeconnect:dishwasher',
      capabilitiesObj: { operation_state: { type: 'string', title: 'Status', value: 'Kører' }, remaining_time: { type: 'string', title: 'Tid tilbage', value: '0:42' } } },
    { id: 'dry', name: 'Tørretumbler', zone: 'z4', class: 'dryer', available: true, driverId: 'homey:app:com.lg.thinq:dryer',
      capabilitiesObj: { dryer_state: { type: 'string', title: 'Status', value: 'Færdig' } } },
  ];
  Object.keys(zones).forEach((k) => (zones[k].id = k));
  list.forEach((d) => (d.capabilities = Object.keys(d.capabilitiesObj)));
  const devices = Object.fromEntries(list.map((d) => [d.id, d]));
  const moods = { m1: { name: 'Morgen' }, m2: { name: 'Hygge' }, m3: { name: 'Film' }, m4: { name: 'Godnat' } };
  const flows = {
    f1: { id: 'f1', name: 'Godmorgen', triggerable: true, enabled: true },
    f2: { id: 'f2', name: 'Ud af huset', triggerable: true, enabled: true },
    f3: { id: 'f3', name: 'Kommer hjem', triggerable: true, enabled: true },
  };
  const adv = { a1: { id: 'a1', name: 'Natten', triggerable: true, enabled: true } };
  const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 60));
  return {
    devices: () => wait(devices), zones: () => wait(zones), moods: () => wait(moods),
    flows: () => wait(flows), advFlows: () => wait(adv),
    setCap: (id, cap, value) => {
      const o = devices[id]?.capabilitiesObj[cap];
      if (o && !/^speaker_(next|prev)$/.test(cap)) o.value = value;
      if (cap === 'dim' && value > 0 && devices[id].capabilitiesObj.onoff) devices[id].capabilitiesObj.onoff.value = true;
      return wait(null);
    },
    setMood: () => wait(null), trigger: () => wait(null),
  };
})();
