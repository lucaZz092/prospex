(() => {
  const el = document.getElementById('map');
  if (!el || !window.L) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const map = L.map(el, { scrollWheelZoom: false, zoomControl: false, minZoom: 3, maxZoom: 13 });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri, HERE, Garmin, © OpenStreetMap', maxZoom: 16
  }).addTo(map);

  // deterministic random so the dots stay put between visits
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;

  const scopes = {
    cidade: { place: 'Campinas, SP', count: 'até ~900 leads', view: [[-22.906, -47.061], 11],
      hubs: [[-22.906, -47.061, 0.06, 70]] },
    estado: { place: 'Estado de São Paulo', count: 'até ~12.000 leads', view: [[-22.3, -48.6], 6],
      hubs: [[-23.55, -46.63, .25, 45], [-22.906, -47.061, .15, 18], [-21.18, -47.81, .12, 12], [-23.5, -47.46, .1, 10],
             [-23.18, -45.89, .1, 10], [-23.96, -46.33, .08, 8], [-22.31, -49.06, .1, 8], [-20.82, -49.38, .1, 8],
             [-22.12, -51.39, .1, 6], [-22.73, -47.65, .08, 7]] },
    brasil: { place: 'Brasil inteiro', count: 'até ~150.000 leads', view: [[-14.5, -52], 4],
      hubs: [[-23.55, -46.63, .9, 40], [-22.91, -43.17, .6, 24], [-19.92, -43.94, .7, 18], [-15.79, -47.88, .5, 12],
             [-12.97, -38.5, .6, 12], [-3.73, -38.52, .5, 10], [-8.05, -34.9, .5, 10], [-25.43, -49.27, .6, 14],
             [-30.03, -51.23, .6, 12], [-3.12, -60.02, .4, 6], [-1.46, -48.5, .4, 6], [-16.68, -49.25, .5, 9],
             [-27.6, -48.55, .4, 8], [-20.32, -40.34, .4, 7]] }
  };

  const layer = L.layerGroup().addTo(map);
  function draw(key) {
    const s = scopes[key];
    seed = 7;
    layer.clearLayers();
    s.hubs.forEach(([lat, lng, spread, n]) => {
      for (let i = 0; i < n; i++) {
        L.circleMarker([lat + gauss() * spread, lng + gauss() * spread * 1.2], {
          radius: 2.6, stroke: false, fillColor: '#B9EE52', fillOpacity: .85, interactive: false
        }).addTo(layer);
      }
    });
    document.getElementById('mapPlace').textContent = s.place;
    document.getElementById('mapCount').textContent = s.count;
  }
  function go(key, first) {
    const [c, z] = scopes[key].view;
    if (first || still) map.setView(c, z, { animate: false });
    else map.flyTo(c, z, { duration: 1.1 });
    draw(key);
  }

  const tabs = document.querySelectorAll('.map-tabs button');
  tabs.forEach(b => b.addEventListener('click', () => {
    tabs.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    go(b.dataset.scope);
  }));
  go('cidade', true);
})();
