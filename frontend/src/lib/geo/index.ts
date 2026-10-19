// Geocoding for the location picker: OpenStreetMap Nominatim (free, no key; fair use is
// ≤ 1 request/second, so callers debounce). Swap the two fetchers for Google Places or our
// own API later; the Place shape stays.

export interface LatLng {
  lat: number;
  lng: number;
}

/** A point plus what we could read from it: street line and one of our districts. */
export interface Place extends LatLng {
  /** "#12, St. 516" style line, or '' when the map has no street there. */
  line: string;
  /** One of DISTRICTS[].name, or null when the point is outside them. */
  district: string | null;
  /** Full display name (search results). */
  label: string;
}

/** Phnom Penh: default centre and the search box. */
export const PHNOM_PENH: LatLng = { lat: 11.5564, lng: 104.9282 };
const VIEWBOX = '104.75,11.70,105.05,11.45';

/** Rough centre of each district, to move the map when a district is picked by hand. */
export const DISTRICT_CENTER: Record<string, LatLng> = {
  'Toul Kork': { lat: 11.5833, lng: 104.899 },
  BKK1: { lat: 11.552, lng: 104.924 },
  'Daun Penh': { lat: 11.57, lng: 104.92 },
  'Chamkar Mon': { lat: 11.537, lng: 104.922 },
  'Sen Sok': { lat: 11.596, lng: 104.865 },
  'Russey Keo': { lat: 11.625, lng: 104.905 },
  'Chbar Ampov': { lat: 11.532, lng: 104.955 },
  'Mean Chey': { lat: 11.516, lng: 104.925 },
  'Por Senchey': { lat: 11.545, lng: 104.815 },
  'Prampi Makara': { lat: 11.564, lng: 104.911 },
};

/** Khmer names of our districts (OSM often returns the khan in Khmer script). */
const DISTRICT_KM: [string, string[]][] = [
  ['Toul Kork', ['ទួលគោក']],
  ['BKK1', ['បឹងកេងកង']],
  ['Daun Penh', ['ដូនពេញ']],
  ['Chamkar Mon', ['ចំការមន']],
  ['Sen Sok', ['សែនសុខ']],
  ['Russey Keo', ['ឫស្សីកែវ', 'ឬស្សីកែវ']],
  ['Chbar Ampov', ['ច្បារអំពៅ']],
  ['Mean Chey', ['មានជ័យ']],
  ['Por Senchey', ['ពោធិ៍សែនជ័យ', 'ពោធិសែនជ័យ']],
  ['Prampi Makara', ['៧មករា', 'ប្រាំពីរមករា']],
];

/** OSM spellings of our districts (khan / sangkat names vary in romanisation). */
const DISTRICT_ALIASES: [string, string[]][] = [
  ['Toul Kork', ['tuol kouk', 'toul kork', 'tuol kok', 'toul kok', 'tuol kork']],
  ['BKK1', ['boeng keng kang', 'boeung keng kang', 'beung keng kang', 'bkk']],
  ['Daun Penh', ['daun penh', 'doun penh']],
  ['Chamkar Mon', ['chamkar mon', 'chamkarmon', 'chamkar morn']],
  ['Sen Sok', ['sen sok', 'saensokh', 'sen sokh', 'sensok']],
  ['Russey Keo', ['russey keo', 'russei keo', 'ruessei kaev', 'reussey keo', 'ruessei keo']],
  ['Chbar Ampov', ['chbar ampov', 'chbar ampeou', 'chbar ampeov']],
  ['Mean Chey', ['mean chey', 'meanchey']],
  ['Por Senchey', ['por senchey', 'pou senchey', 'posenchey', 'pur senchey']],
  ['Prampi Makara', ['prampi makara', '7 makara', '7 meakkakra', 'prampir meakkakra']],
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(khan|sangkat|district|commune)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Which of our districts an OSM address belongs to (null when none matches). */
export function matchDistrict(address: Record<string, string | undefined>): string | null {
  // Khan first (OSM puts it in town / city_district), then sangkat-level fields.
  const raw = [
    'town',
    'city_district',
    'county',
    'district',
    'suburb',
    'village',
    'quarter',
    'neighbourhood',
  ]
    .map((k) => address[k])
    .filter((v): v is string => !!v);
  for (const r of raw) {
    for (const [name, km] of DISTRICT_KM) {
      if (km.some((k) => r.includes(k))) return name;
    }
  }
  for (const p of raw.map(norm)) {
    for (const [name, aliases] of DISTRICT_ALIASES) {
      if (aliases.some((a) => p.includes(a))) return name;
    }
  }
  return null;
}

/** Street line from an OSM address: "#12, St. 516", else the road or the neighbourhood. */
export function streetLine(address: Record<string, string | undefined>): string {
  const road = address.road ?? address.pedestrian ?? address.footway ?? '';
  const house = address.house_number;
  if (road) return house ? `#${house}, ${road}` : road;
  return address.neighbourhood ?? address.quarter ?? address.suburb ?? '';
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

const toPlace = (r: NominatimResult): Place => {
  const address = r.address ?? {};
  return {
    lat: Number(r.lat),
    lng: Number(r.lon),
    line: streetLine(address),
    district: matchDistrict(address),
    label: r.display_name,
  };
};

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const lang = (locale: string) => (locale === 'kh' ? 'km,en' : 'en');

/** What's at this point (reverse geocode). */
export async function reverseGeocode(
  p: LatLng,
  locale: string,
  signal?: AbortSignal,
): Promise<Place> {
  const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${p.lat}&lon=${p.lng}&accept-language=${lang(locale)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`reverse ${res.status}`);
  const place = toPlace((await res.json()) as NominatimResult);
  return { ...place, lat: p.lat, lng: p.lng };
}

/** Places matching a search, inside Phnom Penh. */
export async function searchPlaces(
  q: string,
  locale: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=kh&bounded=1&viewbox=${VIEWBOX}&accept-language=${lang(locale)}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`search ${res.status}`);
  return ((await res.json()) as NominatimResult[]).map(toPlace);
}

/** The device's position (browser permission prompt). */
export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('UNAVAILABLE'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'DENIED' : 'UNAVAILABLE')),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

/** Straight-line distance in km (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
