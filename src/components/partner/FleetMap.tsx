import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibreModule from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Vehicle } from "@/lib/fleet";

type MapLibreNamespace = typeof maplibreModule & { default?: typeof maplibreModule };
const maplibregl = (maplibreModule as MapLibreNamespace).default ?? maplibreModule;

type FleetPin = Vehicle & { flagged: boolean };
type Props = { fleet: FleetPin[]; selected: string; onSelect: (id: string) => void; dark: boolean };

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
        paint: dark ? { "raster-brightness-max": 0.45, "raster-saturation": -0.6 } : {},
      },
    ],
  };
}

function toGeoJson(fleet: FleetPin[], selected: string) {
  return {
    type: "FeatureCollection" as const,
    features: fleet.map((v) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [v.lng, v.lat] as [number, number] },
      properties: {
        crewId: v.crewId,
        plate: v.plate,
        crewName: v.crewName,
        heading: v.heading,
        speedKmh: Math.round(v.speedKmh),
        loadPct: Math.round(v.loadPct),
        flagged: v.flagged ? 1 : 0,
        selected: v.crewId === selected ? 1 : 0,
        tier: v.tier ?? "Compactor (20T)",
        fuelLitres: v.fuelLitres ?? 180,
      },
    })),
  };
}

export default function FleetMap({ fleet, selected, onSelect, dark }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibreModule.Map | null>(null);
  const popupRef = useRef<maplibreModule.Popup | null>(null);
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

  const fitFleet = useCallback((m: maplibreModule.Map, items: FleetPin[]) => {
    if (!items.length) return;
    if (items.length === 1) {
      m.easeTo({ center: [items[0]!.lng, items[0]!.lat], zoom: 13.2, duration: 500 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    for (const v of items) bounds.extend([v.lng, v.lat]);
    m.fitBounds(bounds, { padding: 72, maxZoom: 13.6, duration: 500 });
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
    }, 9000);

    m.on("load", () => {
      readyRef.current = true;
      window.clearTimeout(styleTimer);
      setStatus("ready");

      if (!m.hasImage("vehicle")) {
        m.addImage("vehicle", truckImage(), { pixelRatio: 2 });
      }
      m.addSource("fleet", {
        type: "geojson",
        data: toGeoJson(fleetRef.current, selectedRef.current),
      });

      m.addLayer({
        id: "selected-halo",
        type: "circle",
        source: "fleet",
        filter: ["==", ["get", "selected"], 1],
        paint: {
          "circle-radius": 20,
          "circle-color": "#f47707",
          "circle-opacity": 0.22,
          "circle-stroke-color": "#f47707",
          "circle-stroke-width": 2,
        },
      });
      m.addLayer({
        id: "vehicles",
        type: "circle",
        source: "fleet",
        paint: {
          "circle-color": ["case", ["==", ["get", "flagged"], 1], "#dc2626", "#16a34a"],
          "circle-radius": 9,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      m.addLayer({
        id: "vehicle-icons",
        type: "symbol",
        source: "fleet",
        layout: {
          "icon-image": "vehicle",
          "icon-size": 0.68,
          "icon-rotate": ["get", "heading"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
        },
      });
      m.addLayer({
        id: "vehicle-labels",
        type: "symbol",
        source: "fleet",
        layout: {
          "text-field": ["get", "plate"],
          "text-size": 11,
          "text-offset": [0, 1.9],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": dark ? "#f5f5f4" : "#1c1917",
          "text-halo-color": dark ? "#1c1917" : "#ffffff",
          "text-halo-width": 2,
        },
      });

      m.on("click", "vehicles", (e) => {
        const crewId = e.features?.[0]?.properties?.["crewId"] as string | undefined;
        if (crewId) onSelectRef.current(crewId);
      });
      m.on("click", "vehicle-icons", (e) => {
        const crewId = e.features?.[0]?.properties?.["crewId"] as string | undefined;
        if (crewId) onSelectRef.current(crewId);
      });
      for (const layer of ["vehicles", "vehicle-icons"]) {
        m.on("mouseenter", layer, () => {
          m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", layer, () => {
          m.getCanvas().style.cursor = "";
          popupRef.current?.remove();
        });
        m.on("mousemove", layer, (e) => {
          const props = e.features?.[0]?.properties;
          const geom = e.features?.[0]?.geometry;
          if (!props || geom?.type !== "Point") return;
          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14 })
            .setLngLat(geom.coordinates as [number, number])
            .setHTML(
              `<div style="font-size:12px;line-height:1.4"><b>${props["crewName"]}</b><br/><span>${props["plate"]} · ${props["speedKmh"]} km/h · ${props["fuelLitres"]}L</span></div>`,
            )
            .addTo(m);
        });
      }

      m.resize();
      fitFleet(m, fleetRef.current);
    });

    m.on("error", (ev) => {
      if (!readyRef.current) {
        const msg = String((ev as { error?: { message?: string } }).error?.message ?? "");
        if (msg.includes("WebGL")) {
          window.clearTimeout(styleTimer);
          setStatus("error");
        } else if (!useOsmFallback) {
          window.clearTimeout(styleTimer);
          setUseOsmFallback(true);
        }
      }
    });

    return () => {
      window.clearTimeout(styleTimer);
      ro.disconnect();
      popupRef.current?.remove();
      m.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, [dark, useOsmFallback, retryKey, fitFleet]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    const src = m.getSource("fleet") as maplibreModule.GeoJSONSource | undefined;
    if (src) src.setData(toGeoJson(fleet, selected));
  }, [fleet, selected]);

  const fleetIdsKey = fleet.map((f) => f.crewId).join(",");
  useEffect(() => {
    const m = mapRef.current;
    if (m && readyRef.current) fitFleet(m, fleetRef.current);
  }, [fleetIdsKey, fitFleet]);

  useEffect(() => {
    const v = fleet.find((f) => f.crewId === selected);
    if (v && mapRef.current && readyRef.current) {
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
