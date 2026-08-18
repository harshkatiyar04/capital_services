/* ================================================================
   CAPITAL SERVICES — Coverage map colour preview
   Changes the map overlay only. Site buttons stay brand amber.
   ================================================================ */

const STORAGE_KEY = 'capital-accent-preview';
const EVENT_NAME = 'capital:accent-change';

const BRAND_VARS = [
  '--brand-amber',
  '--brand-amber-light',
  '--brand-amber-deep',
  '--accent-ink',
  '--accent-rgb',
  '--accent-light-rgb',
];

const PALETTES = [
  {
    id: 'amber',
    name: 'Amber',
    note: 'Current',
    swatch: '#f5c04a',
    mapFill: '#f5c04a',
    mapStroke: '#e0b060',
    mapHover: '#e8a020',
    mapHoverStroke: '#d4921a',
    fillOpacity: '0.46',
    hoverOpacity: '0.54',
  },
  {
    id: 'honey',
    name: 'Honey gold',
    note: 'Less yellow',
    swatch: '#e0b030',
    mapFill: '#e0b030',
    mapStroke: '#c9a040',
    mapHover: '#c99212',
    mapHoverStroke: '#a6780c',
    fillOpacity: '0.44',
    hoverOpacity: '0.54',
  },
  {
    id: 'brass',
    name: 'Antique brass',
    note: 'Muted metal',
    swatch: '#c9a04a',
    mapFill: '#c9a04a',
    mapStroke: '#b8892a',
    mapHover: '#b8892a',
    mapHoverStroke: '#8f6a1c',
    fillOpacity: '0.44',
    hoverOpacity: '0.54',
  },
  {
    id: 'muted',
    name: 'Muted gold',
    note: 'Quiet luxury',
    swatch: '#d4bb7a',
    mapFill: '#d4bb7a',
    mapStroke: '#c4a35a',
    mapHover: '#c4a35a',
    mapHoverStroke: '#9a7c3a',
    fillOpacity: '0.46',
    hoverOpacity: '0.56',
  },
  {
    id: 'sand',
    name: 'Sandstone',
    note: 'Stone & render',
    swatch: '#d4bb94',
    mapFill: '#d4bb94',
    mapStroke: '#c4a574',
    mapHover: '#c4a574',
    mapHoverStroke: '#9a7e52',
    fillOpacity: '0.48',
    hoverOpacity: '0.58',
  },
  {
    id: 'bronze',
    name: 'Deep bronze',
    note: 'Warm dark gold',
    swatch: '#a67c2a',
    mapFill: '#a67c2a',
    mapStroke: '#8b6914',
    mapHover: '#8b6914',
    mapHoverStroke: '#6e5210',
    fillOpacity: '0.40',
    hoverOpacity: '0.50',
  },
  {
    id: 'copper',
    name: 'Copper',
    note: 'Pipework warmth',
    swatch: '#c98a4a',
    mapFill: '#c98a4a',
    mapStroke: '#b87333',
    mapHover: '#b87333',
    mapHoverStroke: '#8f5520',
    fillOpacity: '0.42',
    hoverOpacity: '0.52',
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    note: 'Brick & clay',
    swatch: '#d4784a',
    mapFill: '#d4784a',
    mapStroke: '#c45c32',
    mapHover: '#c45c32',
    mapHoverStroke: '#9a3e1c',
    fillOpacity: '0.40',
    hoverOpacity: '0.50',
  },
  {
    id: 'house-red',
    name: 'House red',
    note: 'From the logo',
    swatch: '#c8102e',
    mapFill: '#e03a4e',
    mapStroke: '#c8102e',
    mapHover: '#c8102e',
    mapHoverStroke: '#a50d25',
    fillOpacity: '0.36',
    hoverOpacity: '0.46',
  },
  {
    id: 'oxblood',
    name: 'Oxblood',
    note: 'Deeper red',
    swatch: '#8e1a2a',
    mapFill: '#a8283a',
    mapStroke: '#8e1a2a',
    mapHover: '#8e1a2a',
    mapHoverStroke: '#6a121c',
    fillOpacity: '0.34',
    hoverOpacity: '0.44',
  },
  {
    id: 'claret',
    name: 'Claret',
    note: 'Heritage',
    swatch: '#6b1d2a',
    mapFill: '#8a2a3a',
    mapStroke: '#6b1d2a',
    mapHover: '#6b1d2a',
    mapHoverStroke: '#4a121c',
    fillOpacity: '0.34',
    hoverOpacity: '0.44',
  },
  {
    id: 'charcoal',
    name: 'Charcoal',
    note: 'Logo black',
    swatch: '#2c2c2c',
    mapFill: '#5c5c5c',
    mapStroke: '#3d3d3d',
    mapHover: '#2c2c2c',
    mapHoverStroke: '#1a1a1a',
    fillOpacity: '0.32',
    hoverOpacity: '0.42',
  },
];

function hexToRgbArr(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(a, b, t) {
  const A = hexToRgbArr(a);
  const B = hexToRgbArr(b);
  return rgbToHex(
    Math.round(A[0] + (B[0] - A[0]) * t),
    Math.round(A[1] + (B[1] - A[1]) * t),
    Math.round(A[2] + (B[2] - A[2]) * t)
  );
}

function luminance(hex) {
  const [r, g, b] = hexToRgbArr(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function paletteFromHex(hex) {
  const lum = luminance(hex);
  const light = mixHex(hex, '#ffffff', 0.28);
  const deep = mixHex(hex, '#000000', 0.22);
  return {
    id: 'custom',
    name: 'Custom',
    note: hex.toUpperCase(),
    swatch: hex,
    mapFill: light,
    mapStroke: mixHex(hex, '#ffffff', 0.12),
    mapHover: hex,
    mapHoverStroke: deep,
    fillOpacity: lum > 0.4 ? '0.44' : '0.34',
    hoverOpacity: lum > 0.4 ? '0.54' : '0.44',
  };
}

function clearBrandOverrides() {
  const root = document.documentElement;
  BRAND_VARS.forEach((name) => root.style.removeProperty(name));
}

function applyPalette(palette, { persist = true } = {}) {
  clearBrandOverrides();

  const root = document.documentElement;
  root.style.setProperty('--map-fill', palette.mapFill);
  root.style.setProperty('--map-stroke', palette.mapStroke);
  root.style.setProperty('--map-hover-fill', palette.mapHover);
  root.style.setProperty('--map-hover-stroke', palette.mapHoverStroke);
  root.style.setProperty('--map-fill-opacity', palette.fillOpacity);
  root.style.setProperty('--map-hover-opacity', palette.hoverOpacity);
  root.style.setProperty('--map-focus-fill', palette.mapHover);
  root.style.setProperty('--map-focus-stroke', palette.mapHoverStroke);

  if (persist) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ id: palette.id, hex: palette.swatch })
      );
    } catch {
      /* private mode */
    }
  }

  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: palette }));
  syncPickers(palette);
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.id && data.id !== 'custom') {
      return PALETTES.find((p) => p.id === data.id) || null;
    }
    if (data.hex) return paletteFromHex(data.hex);
  } catch {
    /* ignore */
  }
  return null;
}

function currentPalette() {
  return readStored() || PALETTES[0];
}

function syncPickers(palette) {
  document.querySelectorAll('[data-map-colour-picker]').forEach((root) => {
    root.querySelectorAll('[data-accent-id]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.accentId === palette.id);
    });
    const nameEl = root.querySelector('[data-accent-name]');
    if (nameEl) nameEl.textContent = palette.name;
    const picker = root.querySelector('[data-accent-picker]');
    if (picker && palette.swatch) picker.value = palette.swatch;
  });
}

export function applyStoredAccent() {
  clearBrandOverrides();
  const stored = readStored();
  if (stored) applyPalette(stored, { persist: false });
}

export function initMapColourPreview(mountEl) {
  if (!mountEl || mountEl.dataset.ready === 'true') return;
  mountEl.dataset.ready = 'true';
  mountEl.dataset.mapColourPicker = '';
  mountEl.classList.add('map-colour-preview');
  mountEl.innerHTML = `
    <p class="map-colour-label">Map colour</p>
    <div class="map-colour-swatches" role="listbox" aria-label="Coverage map colours">
      ${PALETTES.map(
        (p) => `
        <button type="button" class="map-colour-swatch" data-accent-id="${p.id}" role="option" title="${p.name} — ${p.note}" aria-label="${p.name}">
          <span style="background:${p.swatch}"></span>
        </button>`
      ).join('')}
      <label class="map-colour-custom" title="Pick any colour">
        <input type="color" data-accent-picker value="#e8a020" aria-label="Custom map colour">
      </label>
    </div>
    <p class="map-colour-current">Showing: <strong data-accent-name>Amber</strong> <span>— map only</span></p>
  `;

  mountEl.querySelectorAll('[data-accent-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const palette = PALETTES.find((p) => p.id === btn.dataset.accentId);
      if (palette) applyPalette(palette);
    });
  });

  mountEl.querySelector('[data-accent-picker]')?.addEventListener('input', (e) => {
    applyPalette(paletteFromHex(e.target.value));
  });

  syncPickers(currentPalette());
}
