/* Demo-data, så panelet kan prøves uden en Homey. Bruges kun i demo-tilstand. */
window.DemoHomey = (() => {
  const num = (title, value, units, extra = {}) => ({ type: 'number', title, value, units, setable: false, ...extra });
  const zones = {
    z1: { id: 'z1', name: 'Stue' }, z2: { id: 'z2', name: 'Køkken' }, z3: { id: 'z3', name: 'Soveværelse' },
    z4: { id: 'z4', name: 'Entré' }, z5: { id: 'z5', name: 'Børneværelse' }, z6: { id: 'z6', name: 'Teknikrum' },
  };
  const light = (id, name, zone, on, dim) => ({
    id, name, zone, class: 'light', available: true,
    capabilitiesObj: {
      onoff: { type: 'boolean', title: 'Tændt', value: on, setable: true },
      ...(dim != null ? { dim: { type: 'number', title: 'Lysstyrke', value: dim, min: 0, max: 1, step: 0.01, setable: true } } : {}),
    },
  });
  const sensor = (id, name, zone, t, h, co2) => ({
    id, name, zone, class: 'sensor', available: true,
    capabilitiesObj: {
      measure_temperature: num('Temperatur', t, '°C'),
      ...(h != null ? { measure_humidity: num('Luftfugtighed', h, '%') } : {}),
      ...(co2 != null ? { measure_co2: num('CO₂', co2, 'ppm') } : {}),
    },
  });
  const speaker = (id, name, zone, playing, track, artist, vol) => ({
    id, name, zone, class: 'speaker', available: true,
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
      id: 'vent', name: 'Komfovent C6', zone: 'z6', class: 'airtreatment', available: true,
      capabilitiesObj: {
        onoff: { type: 'boolean', title: 'Tændt', value: true, setable: true },
        measure_temperature: num('Indblæsning', 20.4, '°C'),
        measure_temperature_outdoor: num('Ude', 3.1, '°C'),
        measure_humidity: num('Fugt', 41, '%'),
        ventilation_mode: { type: 'enum', title: 'Tilstand', value: 'normal', setable: true,
          values: [{ id: 'away', title: 'Ude' }, { id: 'normal', title: 'Normal' }, { id: 'intensive', title: 'Intensiv' }, { id: 'boost', title: 'Boost' }] },
        target_temperature: { type: 'number', title: 'Ønsket temperatur', value: 21, min: 15, max: 25, step: 0.5, units: '°C', setable: true },
        alarm_filter: { type: 'boolean', title: 'Skift filter', value: false },
      },
    },
    sensor('s1', 'Stue', 'z1', 21.6, 44, 620),
    sensor('s2', 'Soveværelse', 'z3', 19.2, 48),
    sensor('s3', 'Børneværelse', 'z5', 20.5, 46),
    sensor('s4', 'Køkken', 'z2', 22.1, 51),
    light('l1', 'Loftlampe', 'z1', true, 0.7), light('l2', 'Gulvlampe', 'z1', true, 0.35), light('l3', 'Vindueslampe', 'z1', false, null),
    light('l4', 'Køkkenø', 'z2', true, 0.9), light('l5', 'Under skabe', 'z2', false, 0.5),
    light('l6', 'Sengelampe', 'z3', false, 0.3), light('l7', 'Loft', 'z3', false, 0.8),
    light('l8', 'Natlampe', 'z5', false, 0.15), light('l9', 'Entré', 'z4', true, null),
    speaker('sp1', 'Stue', 'z1', true, 'Kind of Blue — So What', 'Miles Davis', 0.28),
    speaker('sp2', 'Køkken', 'z2', false, '', '', 0.4),
  ];
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
