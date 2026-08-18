import {
  COVERAGE_AREAS,
  GEOJSON_BASE,
  isPostcodeCovered,
} from './coverage-data.js';
import { applyStoredAccent, initMapColourPreview } from './accent-preview.js';

const coverageRestylers = new Set();

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function getPolygonStyle() {
  return {
    color: cssVar('--map-stroke', '#e0b060'),
    weight: 0.65,
    opacity: 0.7,
    fillColor: cssVar('--map-fill', '#f5c04a'),
    fillOpacity: Number(cssVar('--map-fill-opacity', '0.46')) || 0.46,
  };
}

function getPolygonHover() {
  return {
    color: cssVar('--map-hover-stroke', '#d4921a'),
    weight: 1.1,
    opacity: 0.88,
    fillColor: cssVar('--map-hover-fill', '#e8a020'),
    fillOpacity: Number(cssVar('--map-hover-opacity', '0.54')) || 0.54,
  };
}

function getPolygonFocus() {
  return {
    color: cssVar('--map-focus-stroke', '#c88410'),
    weight: 1.25,
    opacity: 0.95,
    fillColor: cssVar('--map-focus-fill', '#e8a020'),
    fillOpacity: (Number(cssVar('--map-hover-opacity', '0.54')) || 0.54) + 0.04,
  };
}

function applyPolygonStyle(layer, style) {
  layer.setStyle({ ...style });
}

function resetPolygonStyle(layer) {
  applyPolygonStyle(layer, getPolygonStyle());
}

window.addEventListener('capital:accent-change', () => {
  coverageRestylers.forEach((fn) => fn());
});

function loadLeafletAssets() {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }

    const cssId = 'leaflet-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
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

async function fetchAreaGeoJSON(code) {
  const res = await fetch(`${GEOJSON_BASE}/${encodeURIComponent(code)}.geojson`);
  if (!res.ok) throw new Error(`GeoJSON ${code}: ${res.status}`);
  return res.json();
}

function renderChipList(container) {
  if (!container) return;
  container.innerHTML = COVERAGE_AREAS.map(
    (area) =>
      `<button type="button" class="coverage-chip" data-code="${area.code}" title="${area.name}">
        <strong>${area.code}</strong>
        <span>${area.name}</span>
      </button>`
  ).join('');
}

async function mountCoverageMap(mapEl, { zoomControl = true, statusEl = null } = {}) {
  let L;
  try {
    L = await loadLeafletAssets();
  } catch {
    if (statusEl) statusEl.textContent = 'Map library could not be loaded.';
    mapEl.classList.add('is-fallback');
    mapEl.textContent = 'Map unavailable';
    return null;
  }

  const map = L.map(mapEl, {
    scrollWheelZoom: false,
    zoomControl,
    attributionControl: false,
  }).setView([51.45, -0.9], 8);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 18,
  }).addTo(map);

  if (zoomControl) {
    L.control.attribution({ prefix: false }).addTo(map);
  }

  mapEl.addEventListener('mouseleave', () => {
    map.scrollWheelZoom.disable();
    resetAllFeatureStyles();
  });

  mapEl.addEventListener('mouseenter', () => map.scrollWheelZoom.enable());

  const layerGroup = L.featureGroup().addTo(map);
  const layersByCode = new Map();
  const featureLayers = [];
  let hoveredLayer = null;
  let focusTimer = null;

  function resetAllFeatureStyles() {
    featureLayers.forEach((lyr) => resetPolygonStyle(lyr));
    hoveredLayer = null;
  }

  if (statusEl) statusEl.textContent = 'Loading coverage areas…';

  const results = await Promise.allSettled(
    COVERAGE_AREAS.map(async (area) => {
      const geojson = await fetchAreaGeoJSON(area.code);
      const layer = L.geoJSON(geojson, {
        style: () => getPolygonStyle(),
        onEachFeature(feature, lyr) {
          featureLayers.push(lyr);

          const district =
            feature.properties?.name ||
            feature.properties?.Name ||
            feature.properties?.postcode ||
            area.code;
          lyr.bindPopup(
            `<div class="coverage-popup"><strong>${area.name}</strong><br><span>${area.code}${district && district !== area.code ? ` · ${district}` : ''}</span></div>`
          );

          lyr.on('mouseover', function () {
            if (focusTimer) return;
            if (hoveredLayer && hoveredLayer !== this) {
              resetPolygonStyle(hoveredLayer);
            }
            hoveredLayer = this;
            applyPolygonStyle(this, getPolygonHover());
          });

          lyr.on('mouseout', function () {
            if (focusTimer) return;
            if (hoveredLayer === this) hoveredLayer = null;
            resetPolygonStyle(this);
          });
        },
      });
      layer.addTo(layerGroup);
      layersByCode.set(area.code, layer);
      return area.code;
    })
  );

  const loaded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  if (layerGroup.getLayers().length) {
    map.fitBounds(layerGroup.getBounds(), { padding: [24, 24], maxZoom: 10 });
  }

  if (statusEl) {
    statusEl.textContent =
      failed === 0
        ? `${loaded} postcode areas covered`
        : `${loaded} areas loaded (${failed} unavailable)`;
  }

  const invalidate = () => map.invalidateSize();
  setTimeout(invalidate, 200);
  setTimeout(invalidate, 600);
  window.addEventListener('resize', invalidate);

  function focusArea(code) {
    const layer = layersByCode.get(code);
    if (!layer) return;

    if (focusTimer) {
      clearTimeout(focusTimer);
      focusTimer = null;
    }

    resetAllFeatureStyles();
    map.fitBounds(layer.getBounds(), { padding: [36, 36], maxZoom: 11 });

    layer.eachLayer((l) => applyPolygonStyle(l, getPolygonFocus()));

    focusTimer = setTimeout(() => {
      resetAllFeatureStyles();
      focusTimer = null;
    }, 1600);
  }

  coverageRestylers.add(resetAllFeatureStyles);

  return { map, layersByCode, focusArea, invalidate, resetAllFeatureStyles };
}

function wirePostcodeForm({ form, input, resultEl, focusArea }) {
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input?.value?.trim() || '';
    const check = isPostcodeCovered(value);

    resultEl?.classList.remove('is-yes', 'is-no', 'is-invalid');

    if (check.reason === 'invalid') {
      resultEl.textContent = 'Enter a UK postcode (e.g. WD18 8EW).';
      resultEl?.classList.add('is-invalid');
      return;
    }

    if (check.ok) {
      const place = check.meta?.name || 'your area';
      resultEl.innerHTML = `<strong>Yes — we cover ${place}</strong> (${check.area}).`;
      resultEl?.classList.add('is-yes');
      focusArea?.(check.area);
    } else {
      resultEl.innerHTML = `<strong>Outside current coverage</strong> — ${check.area} isn’t on our map. Contact us and we’ll advise.`;
      resultEl?.classList.add('is-no');
    }
  });
}

export async function initCoverageMap() {
  const mapEl = document.getElementById('coverage-map');
  if (!mapEl) return;

  const statusEl = document.getElementById('coverage-map-status');
  const chipsEl = document.getElementById('coverage-chips');
  const form = document.getElementById('coverage-check-form');
  const input = document.getElementById('coverage-postcode');
  const resultEl = document.getElementById('coverage-check-result');

  renderChipList(chipsEl);
  applyStoredAccent();
  initMapColourPreview(document.getElementById('map-colour-preview'));

  const ctx = await mountCoverageMap(mapEl, { zoomControl: true, statusEl });
  if (!ctx) return;

  chipsEl?.addEventListener('click', (e) => {
    const chip = e.target.closest('.coverage-chip');
    if (!chip) return;
    ctx.focusArea(chip.dataset.code);
    chipsEl.querySelectorAll('.coverage-chip').forEach((c) => {
      c.classList.toggle('is-active', c.dataset.code === chip.dataset.code);
    });
  });

  wirePostcodeForm({ form, input, resultEl, focusArea: ctx.focusArea });
}

/** Compact interactive coverage map for Contact sidebar */
export async function initContactCoverageMap() {
  const mapEl = document.getElementById('contact-coverage-map');
  if (!mapEl) return;

  const statusEl = document.getElementById('contact-coverage-status');
  const form = document.getElementById('contact-coverage-form');
  const input = document.getElementById('contact-coverage-postcode');
  const resultEl = document.getElementById('contact-coverage-result');

  applyStoredAccent();
  initMapColourPreview(document.getElementById('map-colour-preview'));

  const ctx = await mountCoverageMap(mapEl, { zoomControl: false, statusEl });
  if (!ctx) return;

  wirePostcodeForm({ form, input, resultEl, focusArea: ctx.focusArea });
}
