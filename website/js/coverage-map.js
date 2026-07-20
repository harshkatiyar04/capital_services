import {
  COVERAGE_AREAS,
  GEOJSON_BASE,
  isPostcodeCovered,
} from './coverage-data.js';

const POLYGON_STYLE = {
  color: '#c88410',
  weight: 1.25,
  opacity: 0.95,
  fillColor: '#e8a020',
  fillOpacity: 0.38,
};

const POLYGON_HOVER = {
  weight: 2.25,
  fillOpacity: 0.55,
  color: '#1a1a1a',
};

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

export async function initCoverageMap() {
  const mapEl = document.getElementById('coverage-map');
  if (!mapEl) return;

  const statusEl = document.getElementById('coverage-map-status');
  const chipsEl = document.getElementById('coverage-chips');
  const form = document.getElementById('coverage-check-form');
  const input = document.getElementById('coverage-postcode');
  const resultEl = document.getElementById('coverage-check-result');

  renderChipList(chipsEl);

  let L;
  try {
    L = await loadLeafletAssets();
  } catch {
    if (statusEl) statusEl.textContent = 'Map library could not be loaded.';
    return;
  }

  const map = L.map(mapEl, {
    scrollWheelZoom: false,
    zoomControl: true,
  }).setView([51.45, -0.9], 8);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 18,
  }).addTo(map);

  mapEl.addEventListener('mouseenter', () => map.scrollWheelZoom.enable());
  mapEl.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

  const layerGroup = L.featureGroup().addTo(map);
  const layersByCode = new Map();

  if (statusEl) statusEl.textContent = 'Loading coverage areas…';

  const results = await Promise.allSettled(
    COVERAGE_AREAS.map(async (area) => {
      const geojson = await fetchAreaGeoJSON(area.code);
      const layer = L.geoJSON(geojson, {
        style: POLYGON_STYLE,
        onEachFeature(feature, lyr) {
          const district =
            feature.properties?.name ||
            feature.properties?.Name ||
            feature.properties?.postcode ||
            area.code;
          lyr.bindPopup(
            `<div class="coverage-popup"><strong>${area.name}</strong><br><span>${area.code}${district && district !== area.code ? ` · ${district}` : ''}</span></div>`
          );
          lyr.on('mouseover', function () {
            this.setStyle(POLYGON_HOVER);
            this.bringToFront();
          });
          lyr.on('mouseout', function () {
            this.setStyle(POLYGON_STYLE);
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
    map.fitBounds(layerGroup.getBounds(), { padding: [28, 28], maxZoom: 10 });
  }

  if (statusEl) {
    statusEl.textContent =
      failed === 0
        ? `${loaded} postcode areas covered`
        : `${loaded} areas loaded (${failed} unavailable)`;
  }

  function focusArea(code) {
    const layer = layersByCode.get(code);
    if (!layer) return;
    map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 11 });
    layer.eachLayer((l) => {
      l.setStyle(POLYGON_HOVER);
      setTimeout(() => l.setStyle(POLYGON_STYLE), 1600);
    });
    chipsEl?.querySelectorAll('.coverage-chip').forEach((chip) => {
      chip.classList.toggle('is-active', chip.dataset.code === code);
    });
  }

  chipsEl?.addEventListener('click', (e) => {
    const chip = e.target.closest('.coverage-chip');
    if (!chip) return;
    focusArea(chip.dataset.code);
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input?.value?.trim() || '';
    const check = isPostcodeCovered(value);

    resultEl?.classList.remove('is-yes', 'is-no', 'is-invalid');

    if (check.reason === 'invalid') {
      resultEl.textContent = 'Enter a full UK postcode (e.g. WD18 8EW or GU46 6GA).';
      resultEl?.classList.add('is-invalid');
      return;
    }

    if (check.ok) {
      const place = check.meta?.name || 'your area';
      resultEl.innerHTML = `<strong>Yes — we cover ${place}</strong> (${check.area}).`;
      resultEl?.classList.add('is-yes');
      focusArea(check.area);
    } else {
      resultEl.innerHTML = `<strong>Outside current coverage</strong> — postcode area ${check.area} is not on our serviceable map. Contact us and we’ll advise.`;
      resultEl?.classList.add('is-no');
    }
  });

  // Invalidate size after layout/fonts settle
  setTimeout(() => map.invalidateSize(), 200);
  window.addEventListener('resize', () => map.invalidateSize());
}
