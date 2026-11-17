import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibreModule from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, Maximize2, Minimize2, ScanSearch } from "lucide-react";
import type { Vehicle } from "@/lib/fleet";

type MapLibreNamespace = typeof maplibreModule & { default?: typeof maplibreModule };
const maplibregl = (maplibreModule as MapLibreNamespace).default ?? maplibreModule;

type FleetPin = Vehicle & { flagged: boolean };
type Props = { fleet: FleetPin[]; selected: string; onSelect: (id: string) => void; dark: boolean };

const STATUS_COLORS = {
  compliant: "#268368",
  collecting: "#d47b19",
  facility: "#557e98",
  flagged: "#dc2626",
} as const;

function truckImage(): ImageData {
  const c = document.createElement("canvas");
  c.width = 48;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.strokeStyle = "#2b393b";
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(10, 5, 28, 52, 6);
  g.fill();
  g.stroke();
  g.fillStyle = "#344345";
  g.fillRect(13, 7, 22, 10);
  g.fillStyle = "#e1e6e3";
  g.fillRect(14, 24, 20, 27);
  g.strokeStyle = "#9caaa3";
  g.lineWidth = 1;
  for (let y = 30; y < 51; y += 7) {
    g.beginPath();
    g.moveTo(14, y);
    g.lineTo(34, y);
    g.stroke();
  }
  g.fillStyle = "#263333";
  g.fillRect(6, 13, 4, 9);
  g.fillRect(38, 13, 4, 9);
  g.fillRect(6, 42, 4, 10);
  g.fillRect(38, 42, 4, 10);
  return g.getImageData(0, 0, 48, 64);
}

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

function buildRouteCoordinates(v: FleetPin): [number, number][] {
  const r = (v.heading * Math.PI) / 180;
  const dLng = Math.sin(r) * 0.012;
  const dLat = Math.cos(r) * 0.012;
  return [
    [v.lng - dLng * 1.4, v.lat - dLat * 1.4],
    [v.lng - dLng * 0.5, v.lat - dLat * 0.3],
    [v.lng, v.lat],
    [v.lng + dLng * 0.7, v.lat + dLat * 0.9],
    [v.lng + dLng * 1.5, v.lat + dLat * 1.3],
  ];
}

function createPinElement(v: FleetPin, isSelected: boolean, showLabel: boolean, onSelect: (id: string) => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", `${v.crewName} · ${v.plate}`);
  btn.onclick = () => onSelect(v.crewId);
  const bg = v.flagged ? STATUS_COLORS.flagged : v.speedKmh === 0 ? STATUS_COLORS.facility : STATUS_COLORS.compliant;
  btn.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "gap:5px",
    showLabel ? "padding:4px 8px" : "padding:5px",
    "border-radius:9999px",
    "font-family:ui-monospace,SFMono-Regular,Menlo,monospace",
    "font-size:11px",
    "font-weight:600",
    "line-height:1",
    "white-space:nowrap",
    "cursor:pointer",
    `background:${bg}`,
    "color:#ffffff",
    "border:2px solid #ffffff",
    "box-shadow:0 2px 8px rgba(0,0,0,0.28)",
    "transition:transform 150ms ease",
    isSelected ? "outline:3px solid #f47707;outline-offset:2px;transform:scale(1.08);z-index:10" : "",
  ]
    .filter(Boolean)
    .join(";");

  const isKeke = v.tier?.includes("Tricycle");
  const svg = isKeke
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 18H15V9h4l2 4v5h-1"/><path d="M3 18h1V11l4-2h7"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;

  btn.innerHTML = showLabel ? `${svg}<span>${v.plate}</span>` : svg;
  return btn;
}

export default function FleetMap({ fleet, selected, onSelect, dark }: Props) {
  const regionRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibreModule.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibreModule.Marker>());
  const readyRef = useRef(false);
  const fleetRef = useRef(fleet);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  fleetRef.current = fleet;
  selectedRef.current = selected;
  onSelectRef.current = onSelect;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [useOsmFallback, setUseOsmFallback] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [showLabels, setShowLabels] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const selectedVehicle = fleet.find((f) => f.crewId === selected);

  const fitFleet = useCallback((m: maplibreModule.Map, items: FleetPin[]) => {
    if (!items.length) return;
    if (items.length === 1) {
      m.easeTo({ center: [items[0]!.lng, items[0]!.lat], zoom: 13.4, duration: 450 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    for (const v of items) bounds.extend([v.lng, v.lat]);
    m.fitBounds(bounds, { padding: 80, maxZoom: 13.8, duration: 450 });
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
        center: [3.375, 6.555],
        zoom: 10.9,
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

      if (!m.hasImage("vehicle")) {
        m.addImage("vehicle", truckImage(), { pixelRatio: 2 });
      }
      m.addSource("selected", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addSource("completed", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      m.addLayer({
        id: "route-white",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 },
      });
      m.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#263e46", "line-width": 4 },
      });
      m.addLayer({
        id: "completed-line",
        type: "line",
        source: "completed",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#e37c30", "line-width": 4 },
      });
      m.addLayer({
        id: "selected-halo",
        type: "circle",
        source: "selected",
        paint: {
          "circle-radius": 22,
          "circle-color": "#f47707",
          "circle-opacity": 0.18,
          "circle-stroke-color": "#f47707",
          "circle-stroke-width": 1.5,
        },
      });

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

  // Sync Workspace route & halo GeoJSON layers
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    const v = fleet.find((f) => f.crewId === selected);
    const selSrc = m.getSource("selected") as maplibreModule.GeoJSONSource | undefined;
    const routeSrc = m.getSource("route") as maplibreModule.GeoJSONSource | undefined;
    const compSrc = m.getSource("completed") as maplibreModule.GeoJSONSource | undefined;
    if (selSrc) {
      selSrc.setData({
        type: "FeatureCollection",
        features: v ? [{ type: "Feature", geometry: { type: "Point", coordinates: [v.lng, v.lat] }, properties: {} }] : [],
      });
    }
    if (v) {
      const coords = buildRouteCoordinates(v);
      routeSrc?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} }],
      });
      compSrc?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: { type: "LineString", coordinates: coords.slice(0, 3) }, properties: {} }],
      });
    } else {
      routeSrc?.setData({ type: "FeatureCollection", features: [] });
      compSrc?.setData({ type: "FeatureCollection", features: [] });
    }
    for (const id of ["route-white", "route-line", "completed-line"]) {
      if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", showRoute ? "visible" : "none");
    }
  }, [fleet, selected, showRoute, status]);

  // Sync Marker pins across live ticks, selection, labels, dark mode, and account switch
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
      const el = createPinElement(v, v.crewId === selected, showLabels, (id) => onSelectRef.current(id));
      const mk = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([v.lng, v.lat]).addTo(m);
      markersRef.current.set(v.crewId, mk);
    }
  }, [fleet, selected, showLabels, dark, useOsmFallback, retryKey]);

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

  const toggleExpand = () => {
    setExpanded((e) => !e);
    window.requestAnimationFrame(() => mapRef.current?.resize());
  };

  return (
    <div
      ref={regionRef}
      className={expanded ? "fixed inset-0 z-50 bg-background" : "relative h-full w-full"}
    >
      <div ref={containerRef} className="h-full w-full" />

      {/* Workspace-style top-left caption */}
      <div className="pointer-events-none absolute top-3 left-3 z-10 max-w-[260px] rounded-lg border bg-background/92 px-3 py-2 shadow-sm backdrop-blur">
        <p className="truncate text-xs font-semibold">
          {selectedVehicle ? `${selectedVehicle.wardCode ?? "PAR"} · ${selectedVehicle.plate}` : "Lagos metropolitan ward"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {selectedVehicle ? "Selected assignment · route corridor" : "Select a vehicle for its route & telemetry"}
        </p>
      </div>

      {/* Workspace-style top-right controls (Fit all, Layers, Expand) */}
      <div className="absolute top-3 right-12 z-10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => mapRef.current && fitFleet(mapRef.current, fleet)}
          className="inline-flex h-8 items-center gap-1 rounded-md border bg-background/92 px-2.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-accent"
        >
          <ScanSearch className="size-3.5" /> Fit all
        </button>
        <div className="relative">
          <button
            type="button"
            aria-expanded={layersOpen}
            onClick={() => setLayersOpen((o) => !o)}
            className="inline-flex h-8 items-center gap-1 rounded-md border bg-background/92 px-2.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-accent"
          >
            <Layers className="size-3.5" /> Layers
          </button>
          {layersOpen ? (
            <div className="absolute right-0 mt-1.5 w-44 rounded-lg border bg-card p-2.5 text-xs shadow-lg">
              <label className="flex cursor-pointer items-center gap-2 py-1">
                <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
                Vehicle labels
              </label>
              <label className="flex cursor-pointer items-center gap-2 py-1">
                <input type="checkbox" checked={showRoute} onChange={(e) => setShowRoute(e.target.checked)} />
                Selected route
              </label>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleExpand}
          aria-label={expanded ? "Exit full screen map" : "Expand map"}
          className="inline-flex h-8 items-center gap-1 rounded-md border bg-background/92 px-2.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-accent"
        >
          {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
      </div>

      {/* Workspace-style bottom legend */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 rounded-full border bg-background/92 px-3.5 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur sm:flex">
        <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: STATUS_COLORS.compliant }} />On route</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: STATUS_COLORS.facility }} />At facility</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: STATUS_COLORS.flagged }} />Alert / syphon</span>
      </div>

      {status === "loading" ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          Loading Lagos ward map…
        </div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-muted/85 p-6 text-center">
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
