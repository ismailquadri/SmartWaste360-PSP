import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibreModule from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Vehicle } from "@/lib/fleet";

type MapLibreNamespace = typeof maplibreModule & { default?: typeof maplibreModule };
const maplibregl = (maplibreModule as MapLibreNamespace).default ?? maplibreModule;

type FleetPin = Vehicle & { flagged: boolean };
type Props = { fleet: FleetPin[]; selected: string; onSelect: (id: string) => void; dark: boolean };

function osmFallbackStyle(dark: boolean): maplibreModule.StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "osm-tiles",
        type: "raster",
        source: "osm",
        paint: dark ? { "raster-brightness-max": 0.48, "raster-saturation": -0.55 } : {},
      },
    ],
  };
}

function createPinElement(v: FleetPin, isSelected: boolean, onSelect: (id: string) => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", `${v.crewName} · ${v.plate}`);
  btn.onclick = () => onSelect(v.crewId);
  btn.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "gap:5px",
    "padding:4px 8px",
    "border-radius:9999px",
    "font-family:ui-monospace,SFMono-Regular,Menlo,monospace",
    "font-size:11px",
    "font-weight:600",
    "line-height:1",
    "white-space:nowrap",
    "cursor:pointer",
    "box-shadow:0 2px 8px rgba(0,0,0,0.28)",
    "transition:transform 150ms ease",
    v.flagged
      ? "background:#dc2626;color:#ffffff;border:2px solid #ffffff"
      : "background:#15803d;color:#ffffff;border:2px solid #ffffff",
    isSelected ? "outline:3px solid #f47707;outline-offset:2px;transform:scale(1.08);z-index:10" : "",
  ]
    .filter(Boolean)
    .join(";");

  const isKeke = v.tier?.includes("Tricycle");
  const svg = isKeke
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 18H15V9h4l2 4v5h-1"/><path d="M3 18h1V11l4-2h7"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;

  btn.innerHTML = `${svg}<span>${v.plate}</span>`;
  return btn;
}

export default function FleetMap({ fleet, selected, onSelect, dark }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibreModule.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibreModule.Marker>());
  const readyRef = useRef(false);
  const fleetRef = useRef(fleet);
  const onSelectRef = useRef(onSelect);
  fleetRef.current = fleet;
  onSelectRef.current = onSelect;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [useOsmFallback, setUseOsmFallback] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const fitFleet = useCallback((m: maplibreModule.Map, items: FleetPin[]) => {
    if (!items.length) return;
    if (items.length === 1) {
      m.easeTo({ center: [items[0]!.lng, items[0]!.lat], zoom: 13.2, duration: 500 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    for (const v of items) bounds.extend([v.lng, v.lat]);
    m.fitBounds(bounds, { padding: 80, maxZoom: 13.6, duration: 500 });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    readyRef.current = false;
    setStatus("loading");

    let m: maplibreModule.Map;
    try {
      m = new maplibregl.Map({
        container: el,
        style: useOsmFallback
          ? osmFallbackStyle(dark)
          : `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`,
        center: [3.39, 6.53],
        zoom: 11.2,
        maxZoom: 20,
        minZoom: 8,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        renderWorldCopies: false,
      });
    } catch {
      setStatus("error");
      return;
    }

    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ maxWidth: 90 }), "bottom-left");
    mapRef.current = m;

    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el);

    const styleTimer = window.setTimeout(() => {
      if (!readyRef.current) {
        if (!useOsmFallback) setUseOsmFallback(true);
        else setStatus("error");
      }
    }, 8000);

    m.on("load", () => {
      readyRef.current = true;
      window.clearTimeout(styleTimer);
      setStatus("ready");
      m.resize();
      fitFleet(m, fleetRef.current);
    });

    m.on("error", (ev) => {
      if (!readyRef.current) {
        const msg = String((ev as { error?: { message?: string } }).error?.message ?? "");
        if (msg.includes("WebGL")) {
          window.clearTimeout(styleTimer);
          setStatus("error");
        }
      }
    });

    return () => {
      window.clearTimeout(styleTimer);
      ro.disconnect();
      markersRef.current.forEach((mk) => mk.remove());
      markersRef.current.clear();
      m.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, [dark, useOsmFallback, retryKey, fitFleet]);

  // Sync HTML Marker pins cleanly across live GPS ticks, selections, dark mode, and account switches.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const activeIds = new Set(fleet.map((v) => v.crewId));
    for (const [id, mk] of markersRef.current.entries()) {
      if (!activeIds.has(id)) {
        mk.remove();
        markersRef.current.delete(id);
      }
    }
    for (const v of fleet) {
      const existing = markersRef.current.get(v.crewId);
      if (existing) existing.remove();
      const el = createPinElement(v, v.crewId === selected, (id) => onSelectRef.current(id));
      const mk = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([v.lng, v.lat]).addTo(m);
      markersRef.current.set(v.crewId, mk);
    }
  }, [fleet, selected, dark, useOsmFallback, retryKey]);

  const fleetIdsKey = fleet.map((f) => f.crewId).join(",");
  useEffect(() => {
    const m = mapRef.current;
    if (m && readyRef.current) fitFleet(m, fleetRef.current);
  }, [fleetIdsKey, fitFleet]);

  useEffect(() => {
    const v = fleet.find((f) => f.crewId === selected);
    if (v && mapRef.current) {
      mapRef.current.easeTo({
        center: [v.lng, v.lat],
        zoom: Math.max(mapRef.current.getZoom(), 13.4),
        duration: 500,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" ? (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          Loading Lagos ward map…
        </div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/80 p-6 text-center">
          <p className="text-sm font-medium">Map tiles unavailable</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Check internet connectivity or browser WebGL support. Live vehicle telemetry remains active on the right.
          </p>
          <button
            type="button"
            onClick={() => {
              setUseOsmFallback((prev) => !prev);
              setRetryKey((k) => k + 1);
            }}
            className="mt-1 rounded-md bg-heat px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Retry map
          </button>
        </div>
      ) : null}
    </div>
  );
}
