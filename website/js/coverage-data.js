/** Capital Services — serviceable UK postcode areas (from coverage map) */
export const COVERAGE_AREAS = [
  { code: 'AL', name: 'St Albans' },
  { code: 'BN', name: 'Brighton' },
  { code: 'CR', name: 'Croydon' },
  { code: 'EN', name: 'Enfield' },
  { code: 'GU', name: 'Guildford' },
  { code: 'HA', name: 'Harrow' },
  { code: 'HP', name: 'High Wycombe & Aylesbury' },
  { code: 'KT', name: 'Kingston upon Thames' },
  { code: 'LU', name: 'Luton' },
  { code: 'MK', name: 'Milton Keynes' },
  { code: 'N', name: 'North London' },
  { code: 'NW', name: 'North West London' },
  { code: 'OX', name: 'Oxford' },
  { code: 'PO', name: 'Portsmouth & Isle of Wight' },
  { code: 'RG', name: 'Reading & Newbury' },
  { code: 'RH', name: 'Redhill, Crawley & Horsham' },
  { code: 'SG', name: 'Stevenage' },
  { code: 'SL', name: 'Slough' },
  { code: 'SM', name: 'Sutton' },
  { code: 'SO', name: 'Southampton' },
  { code: 'SW', name: 'South West London' },
  { code: 'TW', name: 'Twickenham' },
  { code: 'UB', name: 'Uxbridge' },
  { code: 'W', name: 'West London' },
  { code: 'WD', name: 'Watford' },
];

export const COVERAGE_CODES = new Set(COVERAGE_AREAS.map((a) => a.code));

/** Extract UK postcode area (e.g. WD18 8EW → WD, SW1A → SW, N1 → N, or bare WD) */
export function extractPostcodeArea(input) {
  if (!input) return null;
  const cleaned = String(input).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const withDigit = cleaned.match(/^([A-Z]{1,2})\d/);
  if (withDigit) return withDigit[1];
  if (/^[A-Z]{1,2}$/.test(cleaned)) return cleaned;
  return null;
}

export function isPostcodeCovered(input) {
  const area = extractPostcodeArea(input);
  if (!area) return { ok: false, area: null, reason: 'invalid' };
  return {
    ok: COVERAGE_CODES.has(area),
    area,
    reason: COVERAGE_CODES.has(area) ? 'covered' : 'outside',
    meta: COVERAGE_AREAS.find((a) => a.code === area) || null,
  };
}

export const GEOJSON_BASE =
  'https://cdn.jsdelivr.net/gh/missinglink/uk-postcode-polygons@master/geojson';
