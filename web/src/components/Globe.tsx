import { useEffect, useRef } from "react";
import GlobeGL, { type GlobeInstance } from "globe.gl";
import { Vector2 } from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Centre, Place } from "../lib/geo";

interface Props {
  centres: Centre[];
  me: Place | null;
  nearestIds: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

type Pin = { id: string; lat: number; lng: number; label: string; kind: "centre" | "me"; seva: boolean; near: boolean; active: boolean };

function pinElement(p: Pin, onSelect: (id: string) => void): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `gpin gpin-${p.kind}${p.near ? " is-near" : ""}${p.active ? " is-active" : ""}`;
  el.setAttribute("aria-label", p.kind === "me" ? "Your location" : `${p.label} centre`);
  el.innerHTML = `<span class="gpin-dot"></span><span class="gpin-label">${p.label}${p.seva ? ' <em>· seva</em>' : ""}</span>`;
  el.style.pointerEvents = "auto";
  if (p.kind === "centre") el.onclick = () => onSelect(p.id);
  return el;
}

export default function Globe({ centres, me, nearestIds, selectedId, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeInstance | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;

  // Create once
  useEffect(() => {
    const el = host.current!;
    const g = new GlobeGL(el, { rendererConfig: { antialias: true, alpha: true } })
      .globeImageUrl("/globe/earth-lights.jpg") // NASA Black Marble "City Lights 2012", public domain
      .backgroundColor("#030209") // = section purple #1a1632 after the bloom pass converts linear → sRGB
      .atmosphereColor("#4f8dff")
      .atmosphereAltitude(0.14)
      .width(el.clientWidth)
      .height(el.clientHeight)
      .htmlElement((d: object) => pinElement(d as Pin, (id) => select.current(id)))
      .htmlAltitude(0.01)
      .ringColor(() => (t: number) => `rgba(255,170,60,${1 - t})`)
      .ringMaxRadius(3.2)
      .ringPropagationSpeed(1.6)
      .ringRepeatPeriod(1400)
      .arcColor(() => ["rgba(139,140,255,0.95)", "rgba(255,170,60,0.95)"])
      .arcDashLength(0.45)
      .arcDashGap(0.25)
      .arcDashAnimateTime(2200)
      .arcStroke(0.55)
      .arcAltitudeAutoScale(0.35);
    // Make city lights emit their own warm glow (night-from-space look) instead of only being lit.
    g.onGlobeReady(() => {
      const m = g.globeMaterial() as unknown as {
        map: unknown; emissiveMap: unknown; emissive: { set: (c: string) => void };
        emissiveIntensity: number; shininess: number; needsUpdate: boolean;
      };
      m.emissiveMap = m.map;
      // Warm emissive tint: white city lights become gold, the faint blue land tint is muted.
      (m as unknown as { color: { set: (c: string) => void } }).color.set("#7a6a5c");
      m.emissive.set("#ffc27a");
      m.emissiveIntensity = 1.05;
      m.shininess = 4;
      m.needsUpdate = true;
    });
    // Bloom: a soft halo around every bright city, like photos taken from the space station.
    const bloom = new UnrealBloomPass(new Vector2(el.clientWidth, el.clientHeight), 0.7, 0.3, 0.78);
    g.postProcessingComposer().addPass(bloom);
    g.pointOfView({ lat: 45, lng: -92, altitude: 2.3 });
    const c = g.controls();
    c.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    c.autoRotateSpeed = 0.35;
    c.enableZoom = true;
    c.minDistance = 112; // globe radius is 100: allow a close look at a region
    c.maxDistance = 520;
    globe.current = g;

    // Stop spinning the moment the visitor touches the globe, so they can explore.
    const stop = () => { c.autoRotate = false; };
    c.addEventListener("start", stop);
    el.addEventListener("pointerdown", stop);
    el.addEventListener("wheel", stop, { passive: true });

    const ro = new ResizeObserver(() => g.width(el.clientWidth).height(el.clientHeight));
    ro.observe(el);
    return () => {
      c.removeEventListener("start", stop);
      el.removeEventListener("pointerdown", stop);
      el.removeEventListener("wheel", stop);
      ro.disconnect(); g._destructor(); el.innerHTML = "";
    };
  }, []);

  // Data layers
  useEffect(() => {
    const g = globe.current;
    if (!g) return;
    const pins: Pin[] = centres.map((c) => ({
      id: c.id, lat: c.lat, lng: c.lng, label: c.city, kind: "centre",
      seva: (c as Centre & { seva?: unknown[] }).seva?.length ? true : false,
      near: nearestIds.includes(c.id), active: c.id === selectedId,
    }));
    if (me) pins.push({ id: "me", lat: me.lat, lng: me.lng, label: "You", kind: "me", seva: false, near: true, active: false });
    g.htmlElementsData(pins);
    g.ringsData(me ? [{ lat: me.lat, lng: me.lng }] : []);
    g.arcsData(me ? nearestIds.map((id) => centres.find((c) => c.id === id)!).filter(Boolean)
      .map((c) => ({ startLat: me.lat, startLng: me.lng, endLat: c.lat, endLng: c.lng })) : []);
  }, [centres, me, nearestIds, selectedId]);

  // Fly to the selected centre, or to the visitor's location
  useEffect(() => {
    const g = globe.current;
    if (!g) return;
    const target = centres.find((c) => c.id === selectedId) ?? me;
    if (!target) return;
    g.controls().autoRotate = false;
    g.pointOfView({ lat: target.lat, lng: target.lng, altitude: 0.75 }, 1600);
  }, [selectedId, me?.lat, me?.lng]);

  const zoom = (f: number) => {
    const g = globe.current;
    if (!g) return;
    const p = g.pointOfView();
    g.controls().autoRotate = false;
    g.pointOfView({ ...p, altitude: Math.min(4, Math.max(0.15, p.altitude * f)) }, 500);
  };

  return (
    <div className="globe-box">
      <div ref={host} className="globe-host" aria-label="3D globe of Art of Living centres and seva locations" />
      <div className="globe-zoom">
        <button type="button" onClick={() => zoom(0.65)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoom(1.5)} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => { const g = globe.current; if (g) { g.pointOfView({ lat: 45, lng: -92, altitude: 2.3 }, 900); g.controls().autoRotate = true; } }} aria-label="Reset view" title="Reset view">⟲</button>
      </div>
    </div>
  );
}
