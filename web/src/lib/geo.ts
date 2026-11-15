import community from "../data/community.json";

export interface Contact { role: string; name: string; email: string; phone: string }
export interface Upcoming { name: string; date: string; kind: "course" | "event" | "seva"; url: string | null; past?: boolean }
export interface Centre {
  id: string; name: string; city: string; region: string; country: string; address: string;
  lat: number; lng: number; contacts: Contact[]; upcoming: Upcoming[]; seva: Upcoming[];
}
export interface Place { label: string; lat: number; lng: number }

export const CENTRES = community.centres as Centre[];

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Quick offline matches so common cities work instantly (and without sending anything anywhere).
const KNOWN: Record<string, [number, number]> = {
  toronto: [43.6532, -79.3832], mississauga: [43.589, -79.6441], brampton: [43.7315, -79.7624], ottawa: [45.4215, -75.6972],
  montreal: [45.5019, -73.5674], "montréal": [45.5019, -73.5674], vancouver: [49.2827, -123.1207], surrey: [49.1913, -122.849],
  calgary: [51.0447, -114.0719], edmonton: [53.5461, -113.4938], winnipeg: [49.8954, -97.1385], halifax: [44.6488, -63.5752],
  "quebec city": [46.8139, -71.208], hamilton: [43.2557, -79.8711], waterloo: [43.4643, -80.5204], london: [42.9849, -81.2453],
  victoria: [48.4284, -123.3656], regina: [50.4452, -104.6189], saskatoon: [52.1579, -106.6702], boone: [36.2168, -81.6746],
};

/** City/address → coordinates. Known cities resolve locally; anything else asks OpenStreetMap's public geocoder. */
export async function geocode(query: string): Promise<Place | null> {
  const q = query.trim();
  const key = q.toLowerCase().split(",")[0].trim();
  if (KNOWN[key]) return { label: q, lat: KNOWN[key][0], lng: KNOWN[key][1] };
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const [hit] = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return hit ? { label: hit.display_name.split(",").slice(0, 3).join(","), lat: +hit.lat, lng: +hit.lon } : null;
}

export function knownCity(city: string): Place | null {
  const c = KNOWN[city.toLowerCase()];
  return c ? { label: city, lat: c[0], lng: c[1] } : null;
}
