import { useEffect, useRef } from "react";
import { Map as MLMap, Marker, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
// Bundle MapLibre's worker (with its shared chunk) into one file Vite emits, and point MapLibre at it.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);
import "maplibre-gl/dist/maplibre-gl.css";
import type { Centre, Place } from "../lib/geo";

interface Props {
  centres: Centre[];
  me: Place | null;
  nearestIds: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Free, keyless sources: OpenFreeMap Liberty day style (crisp to street level), NASA GIBS Blue Marble
// imagery at globe zoom, and city/street lights drawn from the map's own place and road data.
const STYLE = "https://tiles.openfreemap.org/styles/liberty";
// Daytime Earth imagery: Sentinel-2 cloudless 2016 by EOX (CC BY 4.0), sharper than NASA Blue Marble at globe zoom.
// To switch back to NASA, use NASA_EARTH (and its attribution) in the "day" source below.
const DAY_EARTH = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg";
const DAY_ATTRIBUTION = '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless - s2maps.eu</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016)';
export const NASA_EARTH = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-08-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";

type Pin = { id: string; lng: number; lat: number; label: string; kind: "centre" | "me"; seva: boolean; near: boolean; active: boolean };

function pinElement(p: Pin, onSelect: (id: string) => void): HTMLElement {
  const wrap = document.createElement("div");
  const el = document.createElement("button");
  el.type = "button";
  el.className = `gpin gpin-${p.kind}${p.near ? " is-near" : ""}${p.active ? " is-active" : ""}`;
  el.setAttribute("aria-label", p.kind === "me" ? "Your location" : `${p.label} centre`);
  el.innerHTML = `<span class="gpin-dot"></span><span class="gpin-label">${p.label}${p.seva ? ' <em>· seva</em>' : ""}</span>`;
  if (p.kind === "centre") el.onclick = (e) => { e.stopPropagation(); onSelect(p.id); };
  wrap.appendChild(el);
  return wrap;
}

function boundsOf(points: { lng: number; lat: number }[]): [[number, number], [number, number]] {
  const lngs = points.map((p) => p.lng), lats = points.map((p) => p.lat);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

export default function Globe({ centres, me, nearestIds, selectedId, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const ready = useRef(false);
  const select = useRef(onSelect);
  select.current = onSelect;
  const all = centres.map((c) => ({ lng: c.lng, lat: c.lat }));

  // Overview: the whole round Earth, centred over the centres, sized to ~80% of the box.
  const globeView = () => {
    const el = host.current;
    const size = el ? Math.min(el.clientWidth, el.clientHeight) : 600;
    const zoom = Math.log2((size * 0.94 * Math.PI) / 512); // ~86% of the box on screen
    const lng = all.reduce((a, p) => a + p.lng, 0) / Math.max(1, all.length);
    const lat = all.reduce((a, p) => a + p.lat, 0) / Math.max(1, all.length);
    // Look a little south of the centres so the polar cap (no map data above ~85°) stays behind the horizon.
    return { center: [lng, lat - 14] as [number, number], zoom };
  };
  const fitAll = (animate = true) => {
    const v = globeView();
    if (animate) map.current?.flyTo({ ...v, speed: 1.2, essential: true });
    else map.current?.jumpTo(v);
  };

  // Create once
  useEffect(() => {
    const m = new MLMap({
      container: host.current!,
      style: STYLE,
      center: [-90, 45],
      zoom: 1.6,
      attributionControl: { compact: true },
      renderWorldCopies: false,
      maxPitch: 60,
    });
    map.current = m;

    m.on("style.load", () => {
      m.setProjection({ type: "globe" });
      const layers = m.getStyle().layers as { id: string; type: string; "source-layer"?: string }[];
      const firstLabel = layers.find((l) => l.type === "symbol")?.id;
      const firstRoad = layers.find((l) => l["source-layer"] === "transportation")?.id ?? firstLabel;

      // Daytime Earth from orbit: satellite imagery at every zoom, blending into the street map up close.
      // One layer whose tiles are drawn at about one image pixel per screen pixel (128px tiles on Retina, 256px
      // otherwise). Smaller tiles squeezed each 256px image into fewer pixels, which made the land look grainy and
      // distorted at whole-Earth zoom (the globe shrinks tiles without smoothing).
      const tileSize = window.devicePixelRatio >= 1.5 ? 128 : 256;
      m.addSource("day", { type: "raster", tiles: [DAY_EARTH], tileSize, maxzoom: 13, attribution: DAY_ATTRIBUTION });
      m.addLayer({
        id: "day", type: "raster", source: "day",
        paint: {
          "raster-fade-duration": 0, "raster-contrast": 0.12, "raster-saturation": 0.18, "raster-resampling": "linear",
          "raster-opacity": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7.5, 0],
        },
      }, firstRoad);

      // Street lights: a soft golden glow along major roads once you zoom in.
      m.addLayer({
        id: "street-glow", type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: 4,
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffc861",
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1, 8, 3, 12, 7, 16, 14],
          "line-blur": ["interpolate", ["linear"], ["zoom"], 4, 1, 12, 5, 16, 9],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.25, 8, 0.45, 14, 0.35],
        },
      }, firstLabel);

      // City lights: a warm glow from every city and town, brighter for bigger places.
      // World cities over 100k people (GeoNames, CC BY 4.0) so the glow shows even at whole-Earth zoom.
      m.addSource("cities", { type: "geojson", data: "/world-cities.geojson", attribution: "Cities: GeoNames" });
      m.addLayer({
        id: "city-lights", type: "heatmap", source: "cities", maxzoom: 13,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "p"], 100000, 0.25, 1000000, 0.7, 5000000, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.9, 4, 1.4, 9, 2.2],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 3.5, 2, 6, 5, 14, 9, 30, 12, 46],
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(255,190,80,0)", 0.15, "rgba(255,190,80,0.35)", 0.4, "rgba(255,205,110,0.7)",
            0.7, "rgba(255,226,150,0.9)", 1, "rgba(255,248,220,1)"],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 0.75, 12, 0.35, 13, 0],
        },
      }, firstLabel);

      // Hide place labels at whole-Earth zoom (globe mode draws edge labels off the sphere); fade in from zoom 2.5.
      for (const l of layers) {
        if (l.type !== "symbol") continue;
        m.setPaintProperty(l.id, "text-opacity", ["interpolate", ["linear"], ["zoom"], 2.4, 0, 3.2, 1]);
        m.setPaintProperty(l.id, "icon-opacity", ["interpolate", ["linear"], ["zoom"], 2.4, 0, 3.2, 1]);
      }
      m.setSky({
        "sky-color": "#3a7bd5", "horizon-color": "#a6dcff", "fog-color": "#d6ecff",
        "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
      });
      m.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "routes-glow", type: "line", source: "routes", paint: { "line-color": "#ffb547", "line-width": 7, "line-opacity": 0.18, "line-blur": 4 } });
      m.addLayer({ id: "routes", type: "line", source: "routes", paint: { "line-color": "#ffc15e", "line-width": 2, "line-dasharray": [2, 1.5] } });
      ready.current = true;
      fitAll(false);
      draw();
    });

    const box = host.current!.parentElement!;
    // The atmosphere ring follows the Earth's edge while you start zooming, then fades out quickly.
    const markGlobe = () => {
      const dz = m.getZoom() - globeView().zoom;
      box.style.setProperty("--rim-scale", String(Math.pow(2, Math.max(-1, dz))));
      box.classList.toggle("is-globe", dz <= 0.45);
    };
    m.on("zoom", markGlobe);
    m.on("zoomend", markGlobe);
    m.on("load", () => {
      markGlobe();
      // Credits stay available behind the (i) button instead of a long line across the map.
      host.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
    });

    const ro = new ResizeObserver(() => m.resize());
    ro.observe(host.current!);
    return () => { ro.disconnect(); markers.current.forEach((k) => k.remove()); m.remove(); map.current = null; ready.current = false; };
  }, []);

  // Markers + routes
  function draw() {
    const m = map.current;
    if (!m || !ready.current) return;
    markers.current.forEach((k) => k.remove());
    const pins: Pin[] = centres.map((c) => ({
      id: c.id, lng: c.lng, lat: c.lat, label: c.city, kind: "centre",
      seva: c.seva?.length > 0, near: nearestIds.includes(c.id), active: c.id === selectedId,
    }));
    if (me) pins.push({ id: "me", lng: me.lng, lat: me.lat, label: "You", kind: "me", seva: false, near: true, active: false });
    markers.current = pins.map((p) =>
      new Marker({ element: pinElement(p, (id) => select.current(id)), anchor: "left", offset: [-9, 0] }).setLngLat([p.lng, p.lat]).addTo(m));
    const routes = me ? nearestIds.map((id) => centres.find((c) => c.id === id)).filter(Boolean).map((c) => ({
      type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: [[me.lng, me.lat], [c!.lng, c!.lat]] },
    })) : [];
    (m.getSource("routes") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: routes });
  }
  useEffect(draw, [centres, me, nearestIds, selectedId]);

  // Fly to the selected centre (street level, crisp), or frame you + your nearest centres
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const c = centres.find((x) => x.id === selectedId);
    if (c) { m.flyTo({ center: [c.lng, c.lat], zoom: 11.5, speed: 1.1, curve: 1.5, essential: true }); return; }
    if (me) {
      const near = centres.filter((x) => nearestIds.includes(x.id)).map((x) => ({ lng: x.lng, lat: x.lat }));
      m.fitBounds(boundsOf([{ lng: me.lng, lat: me.lat }, ...near]), { padding: 80, maxZoom: 9, duration: 1600 });
    }
  }, [selectedId, me?.lat, me?.lng]);

  return (
    <div className="globe-box">
      <div ref={host} className="globe-host" aria-label="Map of Art of Living centres and seva locations" />
      <div className="globe-zoom">
        <button type="button" onClick={() => map.current?.zoomIn()} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => map.current?.zoomOut()} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => fitAll()} aria-label="Show all centres" title="Show all centres">⟲</button>
      </div>
    </div>
  );
}
