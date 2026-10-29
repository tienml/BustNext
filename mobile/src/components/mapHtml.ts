export type MapPoint = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  kind?: 'stop' | 'user';
};

export type MapOptions = {
  points: MapPoint[];
  /** Ordered coordinates drawn as a polyline (e.g. stops of one trip). */
  line?: Array<[number, number]>;
  dark?: boolean;
  primary: string;
};

const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Tile server is configurable because tile.openstreetmap.org forbids heavy production use. */
export const tileUrl = process.env.EXPO_PUBLIC_MAP_TILE_URL || DEFAULT_TILE_URL;

export function toMapPoint(id: string, lat: unknown, lon: unknown, label: string, kind: MapPoint['kind'] = 'stop'): MapPoint | null {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || (la === 0 && lo === 0)) return null;
  return { id, lat: la, lon: lo, label, kind };
}

/** JSON embedded in a <script> must not be able to close the tag. */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/**
 * Self-contained Leaflet page. Tapping a stop marker posts its id to the host:
 * React Native WebView via ReactNativeWebView.postMessage, Expo Web via parent.postMessage.
 */
export function buildMapHtml({ points, line, dark, primary }: MapOptions): string {
  const data = safeJson({ points, line: line ?? [], tileUrl, primary });
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; background: ${dark ? '#0E131D' : '#EEF1F6'}; }
  ${dark ? '.leaflet-tile-pane { filter: invert(0.92) hue-rotate(180deg) brightness(0.95) contrast(0.9); }' : ''}
  .leaflet-control-attribution { font-size: 10px; }
  .msg { font: 13px system-ui, sans-serif; color: #657080; display: flex; align-items: center; justify-content: center; height: 100%; }
</style>
</head><body><div id="map"></div>
<script>
(function () {
  var cfg = ${data};
  function send(id) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(id);
    else if (window.parent && window.parent !== window) window.parent.postMessage({ busnextStop: id }, '*');
  }
  if (typeof L === 'undefined') {
    document.getElementById('map').innerHTML = '<div class="msg">Không tải được bản đồ. Kiểm tra kết nối mạng.</div>';
    return;
  }
  var map = L.map('map', { zoomControl: true, attributionControl: true });
  L.tileLayer(cfg.tileUrl, {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  var bounds = [];
  if (cfg.line.length > 1) {
    L.polyline(cfg.line, { color: cfg.primary, weight: 4, opacity: 0.75, dashArray: '6 6' }).addTo(map);
    cfg.line.forEach(function (p) { bounds.push(p); });
  }
  cfg.points.forEach(function (p) {
    var isUser = p.kind === 'user';
    var marker = L.circleMarker([p.lat, p.lon], {
      radius: isUser ? 8 : 7,
      color: '#FFFFFF',
      weight: 2,
      fillColor: isUser ? '#0051D5' : cfg.primary,
      fillOpacity: 1
    }).addTo(map);
    var label = document.createElement('span');
    label.textContent = p.label;
    marker.bindTooltip(label, { direction: 'top', offset: [0, -6] });
    if (!isUser) marker.on('click', function () { send(p.id); });
    bounds.push([p.lat, p.lon]);
  });
  if (bounds.length === 1) map.setView(bounds[0], 16);
  else if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
  else map.setView([21.0285, 105.8542], 13);
})();
</script>
</body></html>`;
}
