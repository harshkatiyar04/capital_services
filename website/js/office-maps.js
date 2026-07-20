/** Office location mini-maps (Leaflet) */

export const OFFICES = [
  {
    id: 'watford',
    name: 'Watford',
    region: 'Hertfordshire',
    lat: 51.6565,
    lng: -0.3903,
    zoom: 13,
    directionsUrl:
      'https://www.google.com/maps/dir/?api=1&destination=Watford%2C%20Hertfordshire%2C%20UK',
  },
  {
    id: 'yateley',
    name: 'Yateley',
    region: 'Hampshire',
    lat: 51.3402,
    lng: -0.8298,
    zoom: 13,
    directionsUrl:
      'https://www.google.com/maps/dir/?api=1&destination=Yateley%2C%20Hampshire%2C%20UK',
  },
];

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('Failed to load Leaflet'));
    document.head.appendChild(script);
  });
}

function createPinIcon(L) {
  return L.divIcon({
    className: 'office-map-pin',
    html: `<span class="office-map-pin-dot" aria-hidden="true"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export async function initOfficeMaps() {
  const mapEls = document.querySelectorAll('[data-office-map]');
  if (!mapEls.length) return;

  let L;
  try {
    L = await loadLeaflet();
  } catch {
    mapEls.forEach((el) => {
      el.classList.add('is-fallback');
      el.textContent = el.dataset.label || 'Map unavailable';
    });
    return;
  }

  const pin = createPinIcon(L);

  mapEls.forEach((el) => {
    const id = el.dataset.officeMap;
    const office = OFFICES.find((o) => o.id === id);
    if (!office) return;

    const map = L.map(el, {
      scrollWheelZoom: false,
      dragging: !window.matchMedia('(max-width: 768px)').matches,
      zoomControl: false,
      attributionControl: false,
    }).setView([office.lat, office.lng], office.zoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 18,
    }).addTo(map);

    L.marker([office.lat, office.lng], { icon: pin })
      .addTo(map)
      .bindPopup(`<strong>${office.name}</strong><br>${office.region}`);

    el.addEventListener('mouseenter', () => map.scrollWheelZoom.enable());
    el.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

    setTimeout(() => map.invalidateSize(), 150);
  });
}
