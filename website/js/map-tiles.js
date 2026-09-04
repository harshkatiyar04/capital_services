/**
 * Shared Leaflet basemap providers (no API key required).
 * Switch via localStorage or the map style preview panel.
 */

export const MAP_STYLE_KEY = 'capital-map-basemap';

export const MAP_PROVIDERS = [
  {
    id: 'osm',
    name: 'OpenStreetMap',
    note: 'Classic street map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: 'abc',
      maxZoom: 19,
    },
  },
  {
    id: 'osm-hot',
    name: 'Humanitarian',
    note: 'Cleaner OSM HOT style',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    options: {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, Tiles courtesy of Humanitarian OpenStreetMap Team',
      subdomains: 'abc',
      maxZoom: 19,
    },
  },
  {
    id: 'opentopo',
    name: 'OpenTopoMap',
    note: 'Terrain / contour look',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: {
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      subdomains: 'abc',
      maxZoom: 17,
    },
  },
  {
    id: 'esri-street',
    name: 'Esri Streets',
    note: 'Polished street layout',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
    },
  },
  {
    id: 'esri-light',
    name: 'Esri Light Gray',
    note: 'Minimal light canvas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 16,
    },
  },
  {
    id: 'esri-topo',
    name: 'Esri Topo',
    note: 'Topographic / hills',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
    },
  },
  {
    id: 'esri-imagery',
    name: 'Esri Satellite',
    note: 'Aerial imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
    },
  },
  {
    id: 'cyclosm',
    name: 'CyclOSM',
    note: 'Detailed urban OSM',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    options: {
      attribution:
        '<a href="https://github.com/cyclosm/cyclosm-cartocss-style">CyclOSM</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: 'abc',
      maxZoom: 20,
    },
  },
];

const listeners = new Set();
const liveLayers = new Set();

export function getMapProvider(id) {
  return MAP_PROVIDERS.find((p) => p.id === id) || MAP_PROVIDERS[0];
}

export function getStoredMapProviderId() {
  return 'esri-imagery';
}

export function getStoredMapProvider() {
  return getMapProvider(getStoredMapProviderId());
}

export function createTileLayer(L, provider = getStoredMapProvider()) {
  const p = typeof provider === 'string' ? getMapProvider(provider) : provider;
  return L.tileLayer(p.url, { ...p.options });
}

/** Track a tile layer so the preview picker can swap it live */
export function registerTileLayer(layer) {
  liveLayers.add(layer);
  return () => liveLayers.delete(layer);
}

export function setMapProvider(id, { persist = true } = {}) {
  const provider = getMapProvider(id);
  if (persist) {
    try {
      localStorage.setItem(MAP_STYLE_KEY, provider.id);
    } catch {
      /* ignore */
    }
  }

  liveLayers.forEach((layer) => {
    try {
      layer.setUrl(provider.url);
      Object.assign(layer.options, provider.options);
    } catch {
      /* layer may be disposed */
    }
  });

  listeners.forEach((fn) => fn(provider));
  return provider;
}

export function onMapProviderChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initMapStylePreview(mountEl) {
  if (!mountEl || mountEl.dataset.mapStyleReady === 'true') return;
  mountEl.dataset.mapStyleReady = 'true';
  mountEl.classList.add('map-style-preview');

  const current = getStoredMapProvider();

  mountEl.innerHTML = `
    <p class="map-colour-label">Map style</p>
    <div class="map-style-options" role="listbox" aria-label="Basemap styles">
      ${MAP_PROVIDERS.map(
        (p) => `
        <button type="button" class="map-style-option${p.id === current.id ? ' is-active' : ''}" data-map-style="${p.id}" role="option" title="${p.note}">
          <span class="map-style-name">${p.name}</span>
          <span class="map-style-note">${p.note}</span>
        </button>`
      ).join('')}
    </div>
    <p class="map-colour-current">Basemap: <strong data-map-style-name>${current.name}</strong></p>
  `;

  const sync = (provider) => {
    mountEl.querySelectorAll('[data-map-style]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.mapStyle === provider.id);
    });
    const nameEl = mountEl.querySelector('[data-map-style-name]');
    if (nameEl) nameEl.textContent = provider.name;
  };

  mountEl.querySelectorAll('[data-map-style]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setMapProvider(btn.dataset.mapStyle);
    });
  });

  onMapProviderChange(sync);
}
