import type { MapPinPayload } from '../types';

type MapHtmlOpts = {
  center: { lat: number; lng: number };
  pins: MapPinPayload[];
};

export function buildMapHtml({ center, pins }: MapHtmlOpts) {
  const payload = JSON.stringify({
    center,
    pins,
    draft: null,
    places: [],
  }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; background: #E6EDD8; }
    .leaflet-control-attribution { font-size: 10px; }
    .leaflet-container { background: #E6EDD8; }
    .bubble {
      display: flex; align-items: center; gap: 8px;
      background: #FFFCF7; color: #1F1A17; border-radius: 22px;
      padding: 6px 12px 6px 6px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      font-size: 12.5px; line-height: 1.25; max-width: 210px;
      box-shadow: 0 10px 28px rgba(31,26,23,0.16); border: 1px solid #E8DCCE;
    }
    .bubble.mine { border-color: #E35D4A; }
    .bubble.activity { border-color: #2A9D8F; }
    .bubble.chat { border-color: #6B5B95; }
    .bubble.featured {
      border: 2px solid #C084FC;
      box-shadow: 0 0 0 2px #FF8A4C, 0 10px 28px rgba(192,132,252,0.5);
    }
    .crown { font-size: 11px; margin-right: 2px; }
    .bubble .ava {
      width: 34px; height: 34px; border-radius: 17px; flex: 0 0 34px;
      background: #FBE4DF; color: #E35D4A; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden; font-size: 14px;
    }
    .bubble .ava img { width: 34px; height: 34px; object-fit: cover; display: block; }
    .bubble .copy { min-width: 0; }
    .bubble .txt { font-weight: 700; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .bubble .meta { color: #7A7168; font-size: 10.5px; font-weight: 700; margin-top: 2px; }
    .you {
      width: 16px; height: 16px; border-radius: 50%; background: #2A9D8F;
      border: 3px solid #fff; box-shadow: 0 0 0 8px rgba(42,157,143,0.22);
    }
    .draft {
      width: 22px; height: 22px; border-radius: 50% 50% 50% 0;
      background: #E35D4A; transform: rotate(-45deg);
      border: 3px solid #fff; box-shadow: 0 6px 16px rgba(227,93,74,0.35);
    }
    .spot-divicon { background: transparent; border: none; }
    .spotPinBody {
      width: 30px; height: 30px; border-radius: 50% 50% 50% 4px;
      transform: rotate(-45deg);
      background: linear-gradient(135deg, #FF7AB8, #E35D4A);
      border: 2.5px solid #fff; box-shadow: 0 8px 16px rgba(227,93,74,0.38);
      display: flex; align-items: center; justify-content: center;
    }
    .spotPinBody span { transform: rotate(45deg); font-size: 13px; line-height: 1; }
    .poiWrap { display: flex; flex-direction: column; align-items: center; gap: 3px; }
    .poiName {
      max-width: 92px; font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 10px; font-weight: 800; color: #1F1A17;
      background: rgba(255,252,247,0.92); border: 1px solid #E8DCCE;
      border-radius: 8px; padding: 1px 5px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .dot {
      width: 14px; height: 14px; border-radius: 50%;
      background: #E35D4A; border: 2px solid #fff;
      box-shadow: 0 2px 8px rgba(227,93,74,0.35);
    }
    .dot.activity { background: #2A9D8F; }
    .dot.chat { background: #6B5B95; }
    .dot.featured {
      background: #C084FC;
      box-shadow: 0 0 10px #FF8A4C, 0 0 4px #C084FC;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const initial = ${payload};
    function bootMap() {
    if (!window.L) return;
    const map = L.map('map', { zoomControl: false, attributionControl: true }).setView([initial.center.lat, initial.center.lng], 16);
    window.__spotMap = map;
    (function addBaseTiles() {
      var layers = [
        { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', opts: { attribution: '&copy; OpenStreetMap', maxZoom: 19, subdomains: 'abc' } },
        { url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png', opts: { attribution: '&copy; OpenStreetMap', maxZoom: 19 } }
      ];
      var current = null;
      var idx = 0;
      function use(i) {
        idx = i;
        if (current) map.removeLayer(current);
        current = L.tileLayer(layers[i].url, layers[i].opts).addTo(map);
        var failed = 0;
        var firstFail = 0;
        current.on('tileerror', function () {
          if (!firstFail) firstFail = Date.now();
          failed++;
          if (failed >= 6 && Date.now() - firstFail < 4000 && idx < layers.length - 1) use(idx + 1);
        });
      }
      use(0);
    })();

    let pinLayer = L.layerGroup().addTo(map);
    let placeLayer = L.layerGroup().addTo(map);
    let youMarker = null;
    let draftMarker = null;
    let lastFollow = 0;
    let viewTimer = null;
    let lastPins = initial.pins || [];
    let lastPlaces = initial.places || [];
    const BUBBLE_ZOOM = 14;
    const DOT_ZOOM = 12;
    const PLACE_ZOOM = 11;

    function post(msg) {
      const data = JSON.stringify(msg);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(data);
      else if (window.parent) window.parent.postMessage(data, '*');
    }

    function esc(s) {
      return String(s || '').replace(/</g, '').replace(/"/g, '');
    }

    function setPins(pins) {
      lastPins = pins || lastPins;
      pinLayer.clearLayers();
      const z = map.getZoom();
      if (z < DOT_ZOOM) return;
      lastPins.forEach((pin) => {
        const cls = pin.featured
          ? 'bubble featured'
          : pin.mine
            ? 'bubble mine'
            : pin.kind === 'activity'
            ? 'bubble activity'
            : pin.kind === 'chat'
              ? 'bubble chat'
              : 'bubble';
        let html;
        let iconSize;
        let iconAnchor;
        if (z >= BUBBLE_ZOOM) {
          const meta = [pin.meetLabel, pin.quotaLabel || (pin.coming ? (pin.coming + ' geliyor') : '')]
            .filter(Boolean).join(' · ');
          const letter = esc((pin.authorName || '?').slice(0, 1).toUpperCase());
          const ava = pin.photoUrl
            ? '<img src="' + esc(pin.photoUrl) + '" alt="" />'
            : letter;
          html = '<div class="' + cls + '"><div class="ava">' + ava +
            '</div><div class="copy"><div class="txt">' +
            (pin.socialLeader ? '<span class="crown">👑</span>' : '') +
            esc(pin.text) + '</div>' +
            (meta ? '<div class="meta">' + meta + '</div>' : '') + '</div></div>';
          iconSize = [210, 52];
          iconAnchor = [24, 52];
        } else {
          const dotCls = pin.featured
            ? 'dot featured'
            : pin.kind === 'activity'
              ? 'dot activity'
              : pin.kind === 'chat'
                ? 'dot chat'
                : 'dot';
          html = '<div class="' + dotCls + '"></div>';
          iconSize = [14, 14];
          iconAnchor = [7, 7];
        }
        const icon = L.divIcon({ className: '', html, iconSize, iconAnchor });
        const m = L.marker([pin.lat, pin.lng], { icon, zIndexOffset: 400 }).addTo(pinLayer);
        m.on('click', (ev) => {
          L.DomEvent.stop(ev);
          post({ type: 'PIN_PRESS', id: pin.id });
        });
      });
    }

    function setPlaces(places) {
      lastPlaces = places || lastPlaces;
      placeLayer.clearLayers();
      const z = map.getZoom();
      if (z < PLACE_ZOOM) return;
      lastPlaces.forEach((p) => {
        const showName = z >= 14;
        const html = '<div class="poiWrap"><div class="spotPin"><div class="spotPinBody"><span>' +
          esc(p.emoji || '📍') + '</span></div></div>' +
          (showName ? '<div class="poiName">' + esc(p.name || '') + '</div>' : '') +
          '</div>';
        const icon = L.divIcon({
          className: 'spot-divicon',
          html,
          iconSize: showName ? [96, 56] : [36, 36],
          iconAnchor: showName ? [48, 34] : [18, 32],
        });
        const m = L.marker([Number(p.lat), Number(p.lng)], {
          icon,
          zIndexOffset: 180,
          bubblingMouseEvents: false,
          keyboard: false,
        }).addTo(placeLayer);
        m.on('click', (ev) => {
          L.DomEvent.stop(ev);
          post({
            type: 'PLACE_PRESS',
            id: p.id,
            lat: Number(p.lat),
            lng: Number(p.lng),
            name: p.name,
            kind: p.kind,
            emoji: p.emoji,
            category: p.category,
            area: p.area,
          });
        });
      });
    }

    function setYou(center) {
      if (youMarker) map.removeLayer(youMarker);
      youMarker = L.marker([center.lat, center.lng], {
        icon: L.divIcon({ className: '', html: '<div class="you"></div>', iconSize: [16,16], iconAnchor: [8,8] }),
        zIndexOffset: 800,
        interactive: false,
      }).addTo(map);
    }

    function setDraft(draft) {
      if (draftMarker) {
        map.removeLayer(draftMarker);
        draftMarker = null;
      }
      if (!draft) return;
      draftMarker = L.marker([draft.lat, draft.lng], {
        icon: L.divIcon({ className: '', html: '<div class="draft"></div>', iconSize: [22,22], iconAnchor: [11, 20] }),
        zIndexOffset: 1200,
        draggable: true,
        bubblingMouseEvents: false,
      }).addTo(map);
      draftMarker.on('dragend', () => {
        const ll = draftMarker.getLatLng();
        post({ type: 'MAP_DRAFT', lat: ll.lat, lng: ll.lng });
      });
    }

    function emitView() {
      const c = map.getCenter();
      post({ type: 'MAP_VIEW', lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    }

    function refreshOverlays() {
      setPins(lastPins);
      setPlaces(lastPlaces);
    }

    setYou(initial.center);
    setPins(initial.pins);
    setPlaces(initial.places || []);
    setTimeout(function () { map.invalidateSize(); emitView(); }, 240);

    map.on('click', (e) => {
      post({ type: 'MAP_CLICK', lat: e.latlng.lat, lng: e.latlng.lng });
    });
    map.on('zoomend', refreshOverlays);
    map.on('moveend', () => {
      clearTimeout(viewTimer);
      viewTimer = setTimeout(emitView, 450);
    });

    function apply(data) {
      if (!data) return;
      if (data.center) setYou(data.center);
      if (data.pins) setPins(data.pins);
      if (data.places) setPlaces(data.places);
      if (data.draft !== undefined) setDraft(data.draft);
      if (data.followToken && data.followToken !== lastFollow && data.center) {
        lastFollow = data.followToken;
        map.flyTo([data.center.lat, data.center.lng], Math.max(map.getZoom(), 17), {
          duration: 0.85,
          easeLinearity: 0.22,
        });
      }
    }

    window.setMapData = apply;
    window.addEventListener('message', (e) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        apply(data);
      } catch (err) {}
    });
    }
    (function loadLeaflet() {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
      s.onload = bootMap;
      s.onerror = function () {
        var s2 = document.createElement('script');
        s2.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        s2.onload = bootMap;
        document.head.appendChild(s2);
      };
      document.head.appendChild(s);
    })();
  </script>
</body>
</html>`;
}
