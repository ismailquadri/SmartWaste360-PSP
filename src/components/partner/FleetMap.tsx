import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibreModule from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import rawRoutes from "@/lib/routes.json";
import { useStore } from "@/lib/store";

type MapLibreNamespace = typeof maplibreModule & { default?: typeof maplibreModule };
const maplibregl = (maplibreModule as MapLibreNamespace).default ?? maplibreModule;

type RawRoute = { name: string; coordinates: [number, number][] };
type EnrichedRoute = RawRoute & { cumulative: number[]; total: number };
type GeoFeature = {
  type: "Feature";
  id?: number;
  geometry:
    | { type: "Point"; coordinates: [number, number] }
    | { type: "LineString"; coordinates: [number, number][] }
    | { type: "Polygon"; coordinates: [number, number][][] };
  properties: Record<string, unknown>;
};

const ROUTES: EnrichedRoute[] = (rawRoutes as unknown as RawRoute[]).map((r) => {
  const cumulative = [0];
  for (let i = 1; i < r.coordinates.length; i++) {
    const a = r.coordinates[i - 1]!;
    const b = r.coordinates[i]!;
    cumulative.push(cumulative[i - 1]! + Math.hypot((b[0] - a[0]) * 0.993, b[1] - a[1]));
  }
  return { ...r, cumulative, total: cumulative[cumulative.length - 1] ?? 1 };
});

function atRoute(r: EnrichedRoute, f: number): { coord: [number, number]; index: number; heading: number } {
  const d = r.total * f;
  let i = 1;
  while (i < r.cumulative.length - 1 && (r.cumulative[i] ?? 0) < d) i++;
  const a = r.coordinates[i - 1]!;
  const b = r.coordinates[i]!;
  const denom = (r.cumulative[i] ?? 0) - (r.cumulative[i - 1] ?? 0) || 1;
  const t = (d - (r.cumulative[i - 1] ?? 0)) / denom;
  return {
    coord: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    index: i,
    heading: (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI,
  };
}

export type FleetStatus = "On route" | "Collecting" | "At facility" | "No signal";
export type PositionState = "Recent position" | "Stale position" | "Missing update";
export type ExceptionItem = { kind: string; note: string };

export type WorkspaceVehicle = {
  id: number;
  code: string;
  plate: string;
  status: FleetStatus;
  ri: number;
  district: string;
  coord: [number, number];
  heading: number;
  fraction: number;
  index: number;
  planned: number;
  reported: number;
  verified: number;
  pending: number;
  review: boolean;
  reason: string;
  age: number;
  speed: number;
  crew: string;
  partnerId: string;
  psp: string;
  tier: string;
  fuelPct: number;
  loadPct: number;
  positionState: PositionState;
  exceptions: ExceptionItem[];
  lastTicket?: { ticket: string; net: number; site: string; slot: string } | undefined;
};

const COLORS: Record<FleetStatus, string> = {
  "On route": "#268368",
  Collecting: "#d47b19",
  "At facility": "#557e98",
  "No signal": "#949da2",
};

const FM_STALE_SECONDS = 300;
const FM_MISSING_SECONDS = 900;
const PAGE_SIZE = 25;

const SITES: { id: string; name: string; kind: string; coord: [number, number]; waitMin: number; waitingCount: number }[] = [
  { id: "DS-OLU", name: "Olusosun Dumpsite · Ojota", kind: "dumpsite", coord: [3.376, 6.598], waitMin: 38, waitingCount: 4 },
  { id: "DS-SOL", name: "Solous III Dumpsite · Igando", kind: "dumpsite", coord: [3.257, 6.559], waitMin: 24, waitingCount: 2 },
  { id: "DS-EPE", name: "Epe WTE & Engineered Landfill", kind: "facility", coord: [3.975, 6.596], waitMin: 12, waitingCount: 1 },
  { id: "TLS-OSH", name: "Oshodi Transfer Loading Station (TLS)", kind: "TLS", coord: [3.342, 6.556], waitMin: 18, waitingCount: 3 },
  { id: "TLS-SIM", name: "Simpson Transfer Loading Station (TLS)", kind: "TLS", coord: [3.401, 6.452], waitMin: 14, waitingCount: 2 },
  { id: "MRF-JOS", name: "Jospong Material Recovery Facility", kind: "MRF", coord: [3.352, 6.564], waitMin: 9, waitingCount: 1 },
  { id: "BIO-IKO", name: "Ikosi Market Anaerobic Biodigester", kind: "biodigester", coord: [3.382, 6.612], waitMin: 0, waitingCount: 0 },
];

const CLOSURES: { id: string; name: string; coord: [number, number]; note: string }[] = [
  { id: "ROAD-01", name: "Road closure · Oshodi corridor", coord: [3.33, 6.555], note: "Active rehabilitation lane narrowing; divert heavy compactors via Agege Motor Rd" },
  { id: "ROAD-02", name: "Drainage desilting · Lekki–Epe KM 14", coord: [3.518, 6.442], note: "KAI & Drainage Services desilting truck bay" },
];

const DRAINAGE_CHANNELS: { id: string; lga: string; ring: [number, number][] }[] = [
  {
    id: "CHN-SYS-01 · System 1 Odo-Iya Alaro",
    lga: "Ikeja / Kosofe",
    ring: [
      [3.345, 6.585],
      [3.375, 6.585],
      [3.375, 6.608],
      [3.345, 6.608],
      [3.345, 6.585],
    ],
  },
  {
    id: "CHN-SYS-04 · Ikoyi–Lekki Primary Collector",
    lga: "Eti-Osa",
    ring: [
      [3.445, 6.432],
      [3.488, 6.432],
      [3.488, 6.456],
      [3.445, 6.456],
      [3.445, 6.432],
    ],
  },
];

function osmRasterStyle(dark: boolean): maplibreModule.StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors · CARTO",
      },
    },
    layers: [
      {
        id: "osm-tiles",
        type: "raster",
        source: "osm",
        paint: dark
          ? { "raster-brightness-max": 0.42, "raster-saturation": -0.65, "raster-contrast": 0.15 }
          : { "raster-saturation": -0.15 },
      },
    ],
  };
}

function fleetPositionState(status: FleetStatus, ageSec: number): PositionState {
  if (status === "No signal" || ageSec >= FM_MISSING_SECONDS) return "Missing update";
  if (ageSec >= FM_STALE_SECONDS) return "Stale position";
  return "Recent position";
}

function fleetExceptionRank(v: WorkspaceVehicle): number {
  return v.exceptions.reduce(
    (n, e) =>
      Math.min(
        n,
        (
          {
            Breakdown: 0,
            "Route departure": 1,
            "Long queue": 2,
            "Missed collection": 3,
            "Missing update": 4,
            "Stale position": 5,
            "Evidence review": 6,
          } as Record<string, number>
        )[e.kind] ?? 7,
      ),
    8,
  );
}

function ageText(s: number): string {
  return s < 60 ? `${s} sec ago` : `${Math.floor(s / 60)} min ago`;
}

function fmStamp(at: Date): string {
  return (
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lagos",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(at) + " WAT"
  );
}

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

function createPinMarkerEl(
  v: WorkspaceVehicle,
  isSelected: boolean,
  showLabel: boolean,
  onSelect: (v: WorkspaceVehicle) => void,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fm-marker-pin";
  btn.setAttribute("aria-label", `${v.code} · ${v.plate} (${v.status})`);
  btn.onclick = (e) => {
    e.stopPropagation();
    onSelect(v);
  };
  const bg =
    v.exceptions.length > 0
      ? "#eb3424"
      : v.positionState === "Stale position"
        ? "#ecb730"
        : COLORS[v.status];
  btn.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "gap:4px",
    showLabel ? "padding:3px 7px" : "padding:4px",
    "border-radius:9999px",
    "font-family:var(--sc-mono,monospace)",
    "font-size:10px",
    "font-weight:600",
    "line-height:1",
    "white-space:nowrap",
    "cursor:pointer",
    `background:${bg}`,
    "color:#ffffff",
    "border:2px solid #ffffff",
    "box-shadow:0 2px 6px rgba(0,0,0,0.28)",
    isSelected ? "outline:3px solid #f47707;outline-offset:2px;transform:scale(1.12);z-index:20" : "",
  ]
    .filter(Boolean)
    .join(";");

  const isKeke = v.tier.includes("Tricycle");
  const iconSvg = isKeke
    ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 18H15V9h4l2 4v5h-1"/></svg>`
    : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M3 6h11v11H3zM14 10h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>`;

  btn.innerHTML = showLabel ? `${iconSvg}<span>${v.code}</span>` : iconSvg;
  return btn;
}

function buildFleetDataset(
  partnerName: string,
  concessionId: string,
  primaryAreas: string[],
  crews: { id: string; name: string; plate: string; members: string[]; tier?: string }[],
): WorkspaceVehicle[] {
  let seed = 6404;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const reasons = [
    "Collection proof incomplete",
    "Missed scheduled stop",
    "GPS gap during service",
    "Duplicate tag needs review",
  ];
  const exceptionIDs = new Set([42, 18, 63, 99, 140, 181, 222, ...Array.from({ length: 18 }, (_, i) => 263 + i * 41)]);
  const crewLeads = ["Babatunde A.", "Musa K.", "Adaeze N.", "Tunde O.", "Bisi A.", "Chinedu E.", "Rasheed T.", "Grace I."];

  const isCoastal = primaryAreas.some((a) => a.includes("Lekki") || a.includes("Ajah"));
  const preferredRouteIndices = isCoastal
    ? ROUTES.map((r, idx) => (["Eti-Osa", "Lagos Island", "Ibeju-Lekki", "Ikoyi", "Apapa"].includes(r.name) ? idx : -1)).filter((x) => x >= 0)
    : ROUTES.map((r, idx) => (["Ikeja", "Kosofe", "Agege", "Oshodi-Isolo", "Mushin", "Alimosho"].includes(r.name) ? idx : -1)).filter((x) => x >= 0);

  const list = Array.from({ length: 1000 }, (_, i): WorkspaceVehicle => {
    const n = i + 1;
    const isPspFleet = n === 42 || n === 18 || n === 63 || n === 99 || n === 140 || n === 181 || i % 18 === 0;
    const status: FleetStatus =
      n === 140
        ? "No signal"
        : n === 181
          ? "At facility"
          : n === 63
            ? "Collecting"
            : i < 684
              ? "On route"
              : i < 860
                ? "Collecting"
                : i < 954
                  ? "At facility"
                  : "No signal";

    const ri =
      n === 42
        ? preferredRouteIndices[0] ?? 0
        : isPspFleet && preferredRouteIndices.length > 0
          ? preferredRouteIndices[n % preferredRouteIndices.length]!
          : i % ROUTES.length;
    const r = ROUTES[ri]!;
    const fraction = status === "At facility" ? 0.96 : 0.06 + rand() * 0.88;
    const p = atRoute(r, fraction);
    const planned = 36 + Math.floor(rand() * 45);
    const reported = Math.min(planned, Math.floor(planned * (0.45 + rand() * 0.48)));
    const pending = exceptionIDs.has(n) ? 1 + Math.floor(rand() * 3) : 0;
    const age =
      status === "No signal"
        ? 960 + Math.floor(rand() * 1200)
        : n === 99
          ? 410
          : 5 + Math.floor(rand() * 53);
    const positionState = fleetPositionState(status, age);
    const code = "FLT-" + String(n).padStart(4, "0");

    const exceptions: ExceptionItem[] = [];
    if (n === 18) {
      exceptions.push({
        kind: "Breakdown",
        note: "Hydraulic tailgate pressure drop on corridor; standby hot-swap unit LND 902 KJA dispatched (38m elapsed)",
      });
    }
    if (n === 63) {
      exceptions.push({
        kind: "Route departure",
        note: "CAN-bus stationary fuel drop (-11L) & departure from assigned ward corridor",
      });
    }
    if (n === 42) {
      exceptions.push({
        kind: "Missed collection",
        note: "Resident missed-pickup hold on 9 Freedom Way / Ward Lane; 48h statutory cure window active",
      });
    }
    if (n === 181) {
      exceptions.push({
        kind: "Long queue",
        note: "Oshodi / Simpson TLS Weighbridge Bay 2 · 38 min queue wait (>30m threshold)",
      });
    }
    if (positionState !== "Recent position") {
      exceptions.push({
        kind: positionState,
        note: `Last received ${ageText(age)} · current position unconfirmed`,
      });
    }
    if (pending > 0) {
      exceptions.push({
        kind: "Evidence review",
        note: `${pending} collection records awaiting RFID / photo evidence review`,
      });
    }

    const assignedCrew = isPspFleet && crews.length > 0 ? crews[n % crews.length] : undefined;

    return {
      id: n,
      code,
      plate: assignedCrew?.plate ?? `LND ${String(100 + (n % 899))} KJA`,
      status,
      ri,
      district: r.name,
      coord: p.coord,
      heading: p.heading,
      fraction,
      index: p.index,
      planned: n === 42 ? 48 : planned,
      reported: n === 42 ? 32 : reported,
      verified: n === 42 ? 29 : Math.max(0, reported - pending),
      pending: n === 42 ? 3 : pending,
      review: exceptions.length > 0,
      reason: reasons[n % 4]!,
      age: n === 42 ? 12 : age,
      speed: status === "On route" ? 18 + Math.floor(rand() * 24) : status === "Collecting" ? 6 : 0,
      crew: n === 42 ? crews[0]?.members[0] ?? "Babatunde A." : assignedCrew?.members[0] ?? crewLeads[i % crewLeads.length]!,
      partnerId: isPspFleet ? concessionId : "PAR-" + String(1 + (i % 18)).padStart(3, "0"),
      psp: isPspFleet ? partnerName : "PSP partner " + String(1 + (i % 18)).padStart(2, "0"),
      tier: assignedCrew?.tier ?? (n % 4 === 0 ? "Feeder Tricycle (Keke)" : "Compactor (20T)"),
      fuelPct: 42 + (n % 52),
      loadPct: status === "At facility" ? 96 : 35 + (n % 60),
      positionState,
      exceptions,
      lastTicket:
        n === 42
          ? { ticket: "WT-4402", net: 14200, site: "Oshodi TLS (40T Transfer)", slot: "13:30 WAT" }
          : n === 18
            ? { ticket: "WT-4405", net: 6800, site: "Jospong MRF · Oshodi", slot: "14:15 WAT" }
            : n === 181
              ? { ticket: "WT-4414", net: 15600, site: "Simpson / Oshodi TLS Bay 2", slot: "15:00 WAT" }
              : undefined,
    };
  });

  return list;
}

type FollowupItem = { id: string; vehicle: string; owner: string; note: string; by: string; at: string };

export default function FleetMap({ dark = false }: { dark?: boolean }) {
  const { model, requestHotSwap, cureHold } = useStore();
  const snapshotDate = useMemo(() => new Date(), []);

  const fleet = useMemo(
    () =>
      buildFleetDataset(
        model.profile.name,
        model.wardProfile.concessionId,
        model.profile.areas.split("·").map((s) => s.trim()),
        model.crews,
      ),
    [model.profile.name, model.wardProfile.concessionId, model.profile.areas, model.crews],
  );

  const [query, setQuery] = useState("");
  const [districtSearch, setDistrictSearch] = useState("");
  const [district, setDistrict] = useState("all");
  const [status, setStatus] = useState("all");
  const [pspFilter, setPspFilter] = useState<string>(model.wardProfile.concessionId);
  const [freshness, setFreshness] = useState<string>("all");
  const [exceptionKind, setExceptionKind] = useState<string>("all");
  const [onlyExceptions, setOnlyExceptions] = useState<boolean>(false);
  const [viewportOnly, setViewportOnly] = useState<boolean>(false);
  const [boundsVersion, setBoundsVersion] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(42);
  const [detailTab, setDetailTab] = useState<"overview" | "service" | "activity">("overview");
  const [fleetMode, setFleetMode] = useState<"map" | "list">("map");

  const [layersOpen, setLayersOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [overlayLayers, setOverlayLayers] = useState<{
    routes: boolean;
    sites: boolean;
    queues: boolean;
    closures: boolean;
    drainage: boolean;
  }>({
    routes: true,
    sites: true,
    queues: true,
    closures: true,
    drainage: false,
  });

  const [followups, setFollowups] = useState<FollowupItem[]>([
    {
      id: "FF-01",
      vehicle: "FLT-0042",
      owner: "PSP service liaison",
      note: "Verified RFID bin scan & gate-locked timestamped photo uploaded for 9 Freedom Way.",
      by: model.profile.name,
      at: fmStamp(snapshotDate),
    },
    {
      id: "FF-02",
      vehicle: "FLT-0018",
      owner: "Standby compactor hot-swap desk",
      note: "Dispatched standby compactor LND 902 KJA under 60-minute breakdown SLA.",
      by: model.profile.name,
      at: fmStamp(snapshotDate),
    },
  ]);
  const [followupModalFor, setFollowupModalFor] = useState<WorkspaceVehicle | null>(null);
  const [followupOwner, setFollowupOwner] = useState("PSP service liaison");
  const [followupNote, setFollowupNote] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const mapRegionRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibreModule.Map | null>(null);
  const markersRef = useRef<Map<number, maplibreModule.Marker>>(new Map());
  const readyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  useEffect(() => {
    setPspFilter(model.wardProfile.concessionId);
    setPage(0);
  }, [model.wardProfile.concessionId]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  }, []);

  const metricScope = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fleet.filter(
      (v) =>
        (district === "all" || v.district === district) &&
        (pspFilter === "all" || v.partnerId === pspFilter) &&
        (!q || `${v.code} ${v.plate} ${v.district} ${v.crew} ${v.psp}`.toLowerCase().includes(q)),
    );
  }, [fleet, district, pspFilter, query]);

  const allFiltered = useMemo(() => {
    return metricScope.filter(
      (v) =>
        (status === "all" || v.status === status) &&
        (freshness === "all" ||
          (freshness === "Stale / missing"
            ? v.positionState !== "Recent position"
            : v.positionState === freshness)) &&
        (exceptionKind === "all" || v.exceptions.some((e) => e.kind === exceptionKind)) &&
        (!onlyExceptions || v.exceptions.length > 0),
    );
  }, [metricScope, status, freshness, exceptionKind, onlyExceptions]);

  const filtered = useMemo(() => {
    let data = [...allFiltered];
    if (viewportOnly && readyRef.current && mapRef.current) {
      const b = mapRef.current.getBounds();
      data = data.filter((v) => b.contains(v.coord));
    }
    return data.sort((a, b) => {
      const rankDiff = fleetExceptionRank(a) - fleetExceptionRank(b);
      if (rankDiff !== 0) return rankDiff;
      if (a.id === 42) return -1;
      if (b.id === 42) return 1;
      return a.id - b.id;
    });
  }, [allFiltered, viewportOnly, boundsVersion]);

  const maxPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const safePage = Math.min(page, maxPage);
  const pageItems = useMemo(
    () => filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filtered, safePage],
  );

  const selectedVehicle = useMemo(
    () => (selectedId ? fleet.find((v) => v.id === selectedId) ?? null : null),
    [fleet, selectedId],
  );

  const districts = useMemo(() => {
    const q = districtSearch.trim().toLowerCase();
    return ROUTES.map((r) => r.name).filter(
      (name) => !q || name === district || name.toLowerCase().includes(q),
    );
  }, [districtSearch, district]);

  const fitFleet = useCallback(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !allFiltered.length) return;
    const b = new maplibregl.LngLatBounds();
    allFiltered.forEach((v) => b.extend(v.coord));
    try {
      map.fitBounds(b, { padding: 75, maxZoom: 13.8, duration: 450 });
    } catch {
      // ignore
    }
  }, [allFiltered]);

  const fitSelectedRoute = useCallback((v: WorkspaceVehicle | null) => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !v) return;
    const r = ROUTES[v.ri];
    if (!r) return;
    const b = new maplibregl.LngLatBounds();
    r.coordinates.forEach((c) => b.extend(c));
    const wide = (mapContainerRef.current?.clientWidth ?? 800) > 600;
    try {
      map.fitBounds(b, {
        padding: { top: 78, bottom: 80, left: 35, right: wide ? 350 : 35 },
        maxZoom: 15.2,
        duration: 500,
      });
    } catch {
      // ignore
    }
  }, []);

  const handleSelectVehicle = useCallback(
    (v: WorkspaceVehicle) => {
      setSelectedId(v.id);
      setDetailTab("overview");
      setFleetMode("map");
      if (readyRef.current) {
        fitSelectedRoute(v);
      }
    },
    [fitSelectedRoute],
  );

  const syncMapData = useCallback(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const toFeature = (v: WorkspaceVehicle) => ({
      type: "Feature" as const,
      id: v.id,
      geometry: { type: "Point" as const, coordinates: v.coord },
      properties: {
        id: v.id,
        code: v.code,
        plate: v.plate,
        status: v.status,
        heading: v.heading,
        positionState: v.positionState,
      },
    });

    const fleetSource = map.getSource("fleet") as maplibreModule.GeoJSONSource | undefined;
    if (fleetSource) {
      fleetSource.setData({
        type: "FeatureCollection",
        features: allFiltered.filter((v) => v.id !== selectedId).map(toFeature),
      });
    }

    const selectedSource = map.getSource("selected") as maplibreModule.GeoJSONSource | undefined;
    if (selectedSource) {
      selectedSource.setData({
        type: "FeatureCollection",
        features: selectedVehicle ? [toFeature(selectedVehicle)] : [],
      });
    }

    let routeFeatures: GeoFeature[] = [];
    let completedFeatures: GeoFeature[] = [];
    if (selectedVehicle) {
      const r = ROUTES[selectedVehicle.ri];
      if (r) {
        routeFeatures = [
          {
            type: "Feature",
            geometry: { type: "LineString", coordinates: r.coordinates },
            properties: {},
          },
        ];
        completedFeatures = [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [...r.coordinates.slice(0, selectedVehicle.index), selectedVehicle.coord],
            },
            properties: {},
          },
        ];
      }
    }

    const routeSource = map.getSource("route") as maplibreModule.GeoJSONSource | undefined;
    if (routeSource) routeSource.setData({ type: "FeatureCollection", features: routeFeatures });

    const completedSource = map.getSource("completed") as maplibreModule.GeoJSONSource | undefined;
    if (completedSource) completedSource.setData({ type: "FeatureCollection", features: completedFeatures });

    ["route-white", "route-line", "completed-line"].forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", showRoute ? "visible" : "none");
      }
    });
    if (map.getLayer("vehicle-labels")) {
      map.setLayoutProperty("vehicle-labels", "visibility", showLabels ? "visible" : "none");
    }

    const overlayData: Record<keyof typeof overlayLayers, GeoFeature[]> = {
      routes: ROUTES.filter((r) => allFiltered.some((v) => v.district === r.name)).map((r) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: r.coordinates },
        properties: { name: `${r.name} · collection route` },
      })),
      sites: SITES.map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: s.coord },
        properties: { name: `${s.name} · ${s.kind}`, ref: s.id },
      })),
      queues: SITES.filter((s) => s.waitMin > 0).map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: s.coord },
        properties: { name: `${s.name} · ${s.waitingCount} waiting (${s.waitMin} min)`, ref: s.id, wait: s.waitMin },
      })),
      closures: CLOSURES.map((c) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: c.coord },
        properties: { name: c.name, ref: c.id },
      })),
      drainage: DRAINAGE_CHANNELS.map((c) => ({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [c.ring] },
        properties: { name: `${c.id} · ${c.lga}`, ref: c.id },
      })),
    };

    const overlayColors: Record<keyof typeof overlayLayers, string> = {
      routes: "#42c366",
      sites: dark ? "#ededed" : "#262626",
      queues: "#ecb730",
      closures: "#eb3424",
      drainage: "#2a6dfb",
    };

    (Object.keys(overlayData) as (keyof typeof overlayLayers)[]).forEach((key) => {
      const id = `fm-${key}`;
      if (!map.getSource(id)) {
        map.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        const type = key === "routes" ? "line" : key === "drainage" ? "fill" : "circle";
        const beforeLayer = map.getLayer("clusters") ? "clusters" : undefined;
        if (type === "line") {
          map.addLayer(
            {
              id,
              type: "line",
              source: id,
              paint: { "line-color": overlayColors[key], "line-width": 2.2, "line-opacity": 0.7 },
              layout: { visibility: "none" },
            },
            beforeLayer,
          );
        } else if (type === "fill") {
          map.addLayer(
            {
              id,
              type: "fill",
              source: id,
              paint: {
                "fill-color": overlayColors[key],
                "fill-opacity": 0.14,
                "fill-outline-color": overlayColors[key],
              },
              layout: { visibility: "none" },
            },
            beforeLayer,
          );
        } else {
          map.addLayer(
            {
              id,
              type: "circle",
              source: id,
              paint: {
                "circle-color": overlayColors[key],
                "circle-radius": key === "queues" ? 13 : 8,
                "circle-stroke-color": dark ? "#171717" : "#ffffff",
                "circle-stroke-width": 2,
              },
              layout: { visibility: "none" },
            },
            beforeLayer,
          );
        }
      }
      const src = map.getSource(id) as maplibreModule.GeoJSONSource | undefined;
      if (src) src.setData({ type: "FeatureCollection", features: overlayData[key] });
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", overlayLayers[key] ? "visible" : "none");
      }
    });

    // Also render crisp HTML markers for the top 30 filtered vehicles so trucks are always 100% visible even while WebGL vector tiles stream
    const markerVehicles = allFiltered.slice(0, 30);
    const keepIds = new Set(markerVehicles.map((v) => v.id));
    for (const [id, marker] of markersRef.current.entries()) {
      if (!keepIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
    for (const v of markerVehicles) {
      const existing = markersRef.current.get(v.id);
      if (existing) {
        existing.remove();
        markersRef.current.delete(v.id);
      }
      const el = createPinMarkerEl(v, v.id === selectedId, showLabels, handleSelectVehicle);
      const m = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(v.coord).addTo(map);
      markersRef.current.set(v.id, m);
    }
  }, [allFiltered, selectedId, selectedVehicle, showRoute, showLabels, overlayLayers, dark, handleSelectVehicle]);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current) return;
    for (const m of markersRef.current.values()) m.remove();
    markersRef.current.clear();
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    readyRef.current = false;
    setMapReady(false);
    setMapError(false);

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: osmRasterStyle(dark),
        center: [3.375, 6.555],
        zoom: 11.2,
        maxZoom: 19,
        minZoom: 8,
        dragRotate: false,
        pitchWithRotate: false,
        renderWorldCopies: false,
      });
      mapRef.current = map;

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 90 }), "bottom-left");

      const setupLayers = () => {
        if (readyRef.current) return;
        readyRef.current = true;
        setMapReady(true);
        setMapError(false);

        if (!map.hasImage("vehicle")) {
          map.addImage("vehicle", truckImage(), { pixelRatio: 2 });
        }

        if (!map.getSource("fleet")) {
          map.addSource("fleet", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            cluster: true,
            clusterMaxZoom: 16,
            clusterRadius: 42,
          });
        }
        if (!map.getSource("selected")) {
          map.addSource("selected", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        }
        ["route", "completed"].forEach((id) => {
          if (!map.getSource(id)) {
            map.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          }
        });

        map.addLayer({
          id: "route-white",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.92 },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#263e46", "line-width": 4.2 },
        });
        map.addLayer({
          id: "completed-line",
          type: "line",
          source: "completed",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#f47707", "line-width": 4.5 },
        });

        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "fleet",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#292723",
            "circle-radius": ["step", ["get", "point_count"], 16, 20, 20, 100, 24],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.95,
          },
        });

        const positionColor: maplibreModule.ExpressionSpecification = [
          "match",
          ["get", "positionState"],
          "Missing update",
          "#a3a3a3",
          "Stale position",
          "#ecb730",
          [
            "match",
            ["get", "status"],
            "On route",
            COLORS["On route"],
            "Collecting",
            COLORS.Collecting,
            "At facility",
            COLORS["At facility"],
            "No signal",
            COLORS["No signal"],
            "#949da2",
          ],
        ];

        map.addLayer({
          id: "vehicles",
          type: "circle",
          source: "fleet",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": positionColor,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 14, 7],
            "circle-stroke-width": 1.8,
            "circle-stroke-color": "#ffffff",
          },
        });
        map.addLayer({
          id: "selected-halo",
          type: "circle",
          source: "selected",
          paint: {
            "circle-radius": 20,
            "circle-color": "#f47707",
            "circle-opacity": 0.16,
            "circle-stroke-color": "#f47707",
            "circle-stroke-width": 3,
          },
        });

        map.on("click", "clusters", async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          try {
            const src = map.getSource("fleet") as maplibreModule.GeoJSONSource;
            const z = await src.getClusterExpansionZoom(f.properties?.["cluster_id"] as number);
            const coords = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
            map.easeTo({ center: coords, zoom: Math.min(z + 0.3, 18), duration: 450 });
          } catch {
            showToast("Zoom in to inspect this group");
          }
        });

        map.on("click", "vehicles", (e) => {
          const id = Number(e.features?.[0]?.properties?.["id"]);
          if (id) {
            setSelectedId(id);
            setDetailTab("overview");
          }
        });

        map.on("moveend", () => {
          setBoundsVersion((v) => v + 1);
        });
      };

      map.on("load", setupLayers);
      map.on("style.load", setupLayers);
      setTimeout(() => {
        if (!readyRef.current) setupLayers();
      }, 1200);
    } catch {
      setMapError(true);
    }
  }, [dark, showToast]);

  useEffect(() => {
    initMap();
    return () => {
      for (const m of markersRef.current.values()) m.remove();
      markersRef.current.clear();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initMap]);

  useEffect(() => {
    if (!mapReady) return;
    syncMapData();
  }, [mapReady, syncMapData]);

  useEffect(() => {
    if (!mapReady) return;
    if (selectedVehicle) {
      fitSelectedRoute(selectedVehicle);
    } else {
      fitFleet();
    }
  }, [mapReady, selectedVehicle, fitSelectedRoute, fitFleet]);

  const resetAllFilters = () => {
    setQuery("");
    setDistrictSearch("");
    setDistrict("all");
    setStatus("all");
    setPspFilter(model.wardProfile.concessionId);
    setFreshness("all");
    setExceptionKind("all");
    setOnlyExceptions(false);
    setViewportOnly(false);
    setPage(0);
    setTimeout(() => fitFleet(), 50);
  };

  const exportCSV = () => {
    const headers = [
      "Vehicle",
      "Plate",
      "Status",
      "District",
      "Operator",
      "Crew",
      "Planned stops",
      "Reported stops",
      "Verified stops",
      "Pending evidence review",
      "Last received seconds ago",
      "Longitude",
      "Latitude",
    ];
    const rows = [
      headers,
      ...filtered.map((v) => [
        v.code,
        v.plate,
        v.status,
        v.district,
        v.psp,
        v.crew,
        v.planned,
        v.reported,
        v.verified,
        v.pending,
        v.age,
        v.coord[0],
        v.coord[1],
      ]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `LAWMA-fleet-snapshot-${model.wardProfile.concessionId}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast(`${filtered.length.toLocaleString("en-NG")} records exported`);
  };

  const toggleExpandMap = async () => {
    const region = mapRegionRef.current;
    if (!region) return;
    if (document.fullscreenElement === region) {
      await document.exitFullscreen();
      setMapExpanded(false);
      requestAnimationFrame(() => mapRef.current?.resize());
      return;
    }
    if (mapExpanded) {
      setMapExpanded(false);
      requestAnimationFrame(() => mapRef.current?.resize());
      return;
    }
    try {
      if (!document.fullscreenElement && region.requestFullscreen) {
        await region.requestFullscreen();
      }
      setMapExpanded(true);
    } catch {
      setMapExpanded(true);
    }
    requestAnimationFrame(() => mapRef.current?.resize());
  };

  const saveFollowup = () => {
    if (!followupModalFor || !followupNote.trim()) return;
    const item: FollowupItem = {
      id: `FF-0${followups.length + 1}`,
      vehicle: followupModalFor.code,
      owner: followupOwner,
      note: followupNote.trim(),
      by: model.profile.name,
      at: fmStamp(new Date()),
    };
    setFollowups((prev) => [item, ...prev]);
    if (followupModalFor.id === 42 && model.cureCases[0]?.status === "Action required") {
      cureHold(model.cureCases[0].id, "Supervisor follow-up & RFID verification", followupNote.trim());
    }
    if (followupModalFor.id === 18) {
      requestHotSwap(model.crews[0]?.id ?? "CREW-01", "LND 902 KJA", followupNote.trim());
    }
    setFollowupModalFor(null);
    setFollowupNote("");
    showToast(`Follow-up saved for ${item.vehicle}`);
  };

  const activeMetric =
    onlyExceptions
      ? "attention"
      : freshness === "Recent position"
        ? "recent"
        : freshness === "Stale / missing"
          ? "missing"
          : "all";

  return (
    <div id="fleetMain">
      <svg className="symbols" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <symbol id="i-truck" viewBox="0 0 24 24">
            <path d="M3 6h11v11H3zM14 10h4l3 4v3h-7M3 13h11" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="18" cy="18" r="2" />
          </symbol>
          <symbol id="i-map" viewBox="0 0 24 24">
            <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16" />
          </symbol>
          <symbol id="i-search" viewBox="0 0 24 24">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 5 5" />
          </symbol>
          <symbol id="i-alert" viewBox="0 0 24 24">
            <path d="m12 3 10 18H2zM12 9v5M12 17v1" />
          </symbol>
          <symbol id="i-download" viewBox="0 0 24 24">
            <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
          </symbol>
          <symbol id="i-filter" viewBox="0 0 24 24">
            <path d="M3 6h18M3 12h18M3 18h18" />
            <circle cx="8" cy="6" r="2" />
            <circle cx="16" cy="12" r="2" />
            <circle cx="9" cy="18" r="2" />
          </symbol>
          <symbol id="i-pin" viewBox="0 0 24 24">
            <path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 1 1 14 0Z" />
            <circle cx="12" cy="10" r="2" />
          </symbol>
          <symbol id="i-fit" viewBox="0 0 24 24">
            <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
          </symbol>
          <symbol id="i-layers" viewBox="0 0 24 24">
            <path d="m12 3 10 6-10 6L2 9zM2 13l10 6 10-6M2 17l10 6 10-6" />
          </symbol>
          <symbol id="i-close" viewBox="0 0 24 24">
            <path d="m6 6 12 12M6 18 18 6" />
          </symbol>
          <symbol id="i-arrow" viewBox="0 0 24 24">
            <path d="M4 12h16m-6-6 6 6-6 6" />
          </symbol>
          <symbol id="i-clock" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 6v6l4 2" />
          </symbol>
        </defs>
      </svg>

      <section className="page-head">
        <div>
          <div className="eyebrow">
            LAGOS STATE · OPERATIONS CONTROL · {model.wardProfile.concessionId}
          </div>
          <h1 id="pageTitle">Fleet oversight</h1>
          <p id="pageDescription">
            Locate vehicles, review service delivery and respond to operational exceptions across {model.profile.name}.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn"
            aria-pressed={onlyExceptions}
            onClick={() => {
              setOnlyExceptions((v) => !v);
              setPage(0);
            }}
          >
            <svg className="icon" aria-hidden="true">
              <use href="#i-alert" />
            </svg>
            {onlyExceptions ? "Show all vehicles" : "Review exceptions"}
          </button>
          <button type="button" className="btn" id="exportBtn" onClick={exportCSV}>
            <svg className="icon" aria-hidden="true">
              <use href="#i-download" />
            </svg>
            Export snapshot
          </button>
        </div>
      </section>

      <section className="metrics" aria-label="Fleet status filters" id="metrics">
        <button
          type="button"
          className={`metric ${activeMetric === "all" ? "active" : ""}`}
          onClick={() => {
            setFreshness("all");
            setExceptionKind("all");
            setOnlyExceptions(false);
            setStatus("all");
            setPage(0);
          }}
        >
          <label>Vehicles in district</label>
          <b>
            {metricScope.length.toLocaleString("en-NG")}
            <small>vehicles</small>
          </b>
        </button>
        <button
          type="button"
          className={`metric ${activeMetric === "attention" ? "active" : ""}`}
          onClick={() => {
            setFreshness("all");
            setExceptionKind("all");
            setOnlyExceptions(true);
            setStatus("all");
            setPage(0);
          }}
        >
          <label>
            <i className="dot" style={{ background: "#eb3424" }} />
            Need attention
          </label>
          <b>
            {metricScope.filter((v) => v.exceptions.length > 0).length.toLocaleString("en-NG")}
            <small>exceptions</small>
          </b>
        </button>
        <button
          type="button"
          className={`metric ${activeMetric === "recent" ? "active" : ""}`}
          onClick={() => {
            setFreshness("Recent position");
            setExceptionKind("all");
            setOnlyExceptions(false);
            setStatus("all");
            setPage(0);
          }}
        >
          <label>
            <i className="dot" style={{ background: "#268368" }} />
            Recent positions
          </label>
          <b>
            {metricScope.filter((v) => v.positionState === "Recent position").length.toLocaleString("en-NG")}
            <small>active GPS</small>
          </b>
        </button>
        <button
          type="button"
          className={`metric ${activeMetric === "missing" ? "active" : ""}`}
          onClick={() => {
            setFreshness("Stale / missing");
            setExceptionKind("all");
            setOnlyExceptions(false);
            setStatus("all");
            setPage(0);
          }}
        >
          <label>
            <i className="dot" style={{ background: "#949da2" }} />
            Stale / missing
          </label>
          <b>
            {metricScope.filter((v) => v.positionState !== "Recent position").length.toLocaleString("en-NG")}
            <small>&gt;5m gap</small>
          </b>
        </button>
      </section>

      <div className="fm-modes" role="group" aria-label="Fleet view">
        <button
          type="button"
          className="btn"
          aria-pressed={fleetMode === "map"}
          onClick={() => {
            setFleetMode("map");
            requestAnimationFrame(() => mapRef.current?.resize());
          }}
        >
          <svg className="icon" aria-hidden="true">
            <use href="#i-map" />
          </svg>
          Map
        </button>
        <button
          type="button"
          className="btn"
          aria-pressed={fleetMode === "list"}
          onClick={() => setFleetMode("list")}
        >
          <svg className="icon" aria-hidden="true">
            <use href="#i-truck" />
          </svg>
          List
        </button>
      </div>

      <section className="workspace" data-fleet-mode={fleetMode}>
        <aside className="fleet-list">
          <div className="list-heading">
            <h2 id="listTitle">
              {onlyExceptions ? "Exceptions " : "Vehicles "}
              <span id="listCount">{filtered.length.toLocaleString("en-NG")}</span>
            </h2>
            <button
              type="button"
              className="iconbtn"
              id="resetFilters"
              title="Clear filters"
              aria-label="Clear filters"
              onClick={resetAllFilters}
            >
              <svg className="icon" aria-hidden="true">
                <use href="#i-filter" />
              </svg>
            </button>
          </div>

          <div className="list-tools">
            <label className="search">
              <svg aria-hidden="true">
                <use href="#i-search" />
              </svg>
              <input
                id="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Vehicle, plate, PSP or district"
                aria-label="Search vehicle, PSP or district"
              />
              {query ? (
                <button
                  type="button"
                  id="clearSearch"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    setPage(0);
                  }}
                >
                  ×
                </button>
              ) : null}
            </label>

            <input
              type="search"
              id="fmDistrictSearch"
              value={districtSearch}
              onChange={(e) => setDistrictSearch(e.target.value)}
              placeholder="Find LGA / district"
              aria-label="Find LGA or district"
            />

            <div className="select-row">
              <label>
                <span className="sr">District</span>
                <select
                  id="district"
                  aria-label="LGA or district"
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    setPage(0);
                    setTimeout(() => fitFleet(), 50);
                  }}
                >
                  <option value="all">All districts</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr">Vehicle status</span>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">All statuses</option>
                  <option value="On route">On route</option>
                  <option value="Collecting">Collecting</option>
                  <option value="At facility">At facility</option>
                  <option value="No signal">No signal</option>
                </select>
              </label>
            </div>

            <div className="list-scope">
              <label>
                <input
                  type="checkbox"
                  id="viewportOnly"
                  checked={viewportOnly}
                  onChange={(e) => {
                    setViewportOnly(e.target.checked);
                    setPage(0);
                  }}
                />
                In this map area
              </label>
              <span id="scopeCount">{viewportOnly ? "Map area" : "Matching"} · live link</span>
            </div>

            <div className="fm-controls">
              <label htmlFor="fmPsp">PSP operator</label>
              <select
                id="fmPsp"
                value={pspFilter}
                onChange={(e) => {
                  setPspFilter(e.target.value);
                  setPage(0);
                  setTimeout(() => fitFleet(), 50);
                }}
              >
                <option value={model.wardProfile.concessionId}>
                  {model.profile.name} ({model.wardProfile.concessionId})
                </option>
                <option value="all">All Lagos PSP operators (1,000 vehicles)</option>
              </select>

              <label htmlFor="fmFreshness">Position update</label>
              <select
                id="fmFreshness"
                value={freshness}
                onChange={(e) => {
                  setFreshness(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All update states</option>
                <option value="Recent position">Recent position</option>
                <option value="Stale position">Stale position</option>
                <option value="Missing update">Missing update</option>
                <option value="Stale / missing">Stale / missing</option>
              </select>

              <label htmlFor="fmException">Needs attention</label>
              <select
                id="fmException"
                value={exceptionKind}
                onChange={(e) => {
                  setExceptionKind(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All exception types</option>
                <option value="Breakdown">Breakdown</option>
                <option value="Missed collection">Missed collection</option>
                <option value="Route departure">Route departure</option>
                <option value="Long queue">Long queue</option>
                <option value="Missing update">Missing update</option>
                <option value="Stale position">Stale position</option>
                <option value="Evidence review">Evidence review</option>
              </select>

              <label className="fm-check">
                <input
                  id="fmOnlyExceptions"
                  type="checkbox"
                  checked={onlyExceptions}
                  onChange={(e) => {
                    setOnlyExceptions(e.target.checked);
                    setPage(0);
                  }}
                />
                Exceptions only
              </label>
            </div>
          </div>

          <div className="record-list" id="records" aria-label="Fleet vehicles">
            {pageItems.length > 0 ? (
              pageItems.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`vehicle-row ${v.id === selectedId ? "selected" : ""}`}
                  aria-pressed={v.id === selectedId}
                  onClick={() => handleSelectVehicle(v)}
                >
                  <span className="vehicle-symbol">
                    <svg className="icon" aria-hidden="true">
                      <use href={v.exceptions.length ? "#i-alert" : "#i-truck"} />
                    </svg>
                  </span>
                  <span>
                    <span className="row-top">
                      <strong>
                        {v.code} · {v.plate}
                      </strong>
                      <span className="status-label" style={{ color: COLORS[v.status] }}>
                        <i className="dot" style={{ background: COLORS[v.status] }} />
                        {v.status}
                      </span>
                    </span>
                    <span className="row-sub">
                      <span>
                        {v.district} · {v.psp}
                      </span>
                    </span>
                    <span className="row-bottom">
                      <b className={v.exceptions.length ? "flag-text" : ""}>
                        {v.exceptions[0]?.kind ?? "No flagged exception"}
                      </b>
                      <span>{ageText(v.age)}</span>
                    </span>
                    <small
                      className={`fm-position ${v.positionState === "Recent position" ? "" : "fm-warning"}`}
                    >
                      {v.positionState} · {v.verified}/{v.planned} stops verified
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <div className="empty">
                <b>No matching vehicles</b>
                <p>No vehicles meet these filters.</p>
                <button type="button" className="btn" onClick={resetAllFilters}>
                  Clear filters
                </button>
              </div>
            )}
          </div>

          <footer className="list-footer">
            <span id="paginationText">
              {filtered.length
                ? `${(safePage * PAGE_SIZE + 1).toLocaleString("en-NG")}–${Math.min(
                    (safePage + 1) * PAGE_SIZE,
                    filtered.length,
                  ).toLocaleString("en-NG")} of ${filtered.length.toLocaleString("en-NG")}`
                : "0 vehicles"}
            </span>
            <div>
              <button
                type="button"
                className="iconbtn"
                id="prevPage"
                aria-label="Previous page"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ‹
              </button>
              <button
                type="button"
                className="iconbtn"
                id="nextPage"
                aria-label="Next page"
                disabled={(safePage + 1) * PAGE_SIZE >= filtered.length}
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </button>
            </div>
          </footer>
        </aside>

        <div
          ref={mapRegionRef}
          className={`map-region ${selectedVehicle ? "fm-has-detail" : ""} ${mapExpanded ? "map-expanded" : ""}`}
        >
          <div ref={mapContainerRef} id="map" role="region" aria-label="Interactive Lagos fleet map" />

          <div className="map-top">
            <div className="map-caption">
              <svg aria-hidden="true">
                <use href="#i-pin" />
              </svg>
              <div>
                <b id="mapTitle">
                  {selectedVehicle
                    ? `${selectedVehicle.district} · ${selectedVehicle.code}`
                    : "Lagos metropolitan area"}
                </b>
                <small id="mapSubtitle">
                  {selectedVehicle
                    ? `${selectedVehicle.plate} · ${selectedVehicle.positionState} · road-aligned route`
                    : "Click a cluster to explore · select a vehicle for its route"}
                </small>
              </div>
            </div>

            <div className="map-actions">
              <button
                type="button"
                className="mapbtn"
                id="fitAll"
                aria-label="Fit all filtered vehicles"
                title="Fit all filtered vehicles"
                onClick={() => {
                  setSelectedId(null);
                  fitFleet();
                }}
              >
                <svg className="icon" aria-hidden="true">
                  <use href="#i-fit" />
                </svg>
              </button>
              <button
                type="button"
                className="mapbtn"
                id="layersBtn"
                aria-expanded={layersOpen}
                aria-label="Map layers"
                title="Map display"
                onClick={() => setLayersOpen((o) => !o)}
              >
                <svg className="icon" aria-hidden="true">
                  <use href="#i-layers" />
                </svg>
              </button>
              <button
                type="button"
                className="mapbtn map-expand"
                id="mapExpand"
                aria-pressed={mapExpanded}
                onClick={toggleExpandMap}
              >
                {mapExpanded ? "Exit full screen" : "Expand map"}
              </button>
            </div>
          </div>

          {layersOpen ? (
            <div className="layers-pop" id="layersPop">
              <b>Map display</b>
              <label>
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                />
                Vehicle IDs at street level
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showRoute}
                  onChange={(e) => setShowRoute(e.target.checked)}
                />
                Selected vehicle route
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={overlayLayers.routes}
                  onChange={(e) =>
                    setOverlayLayers((s) => ({ ...s, routes: e.target.checked }))
                  }
                />
                Collection routes
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={overlayLayers.sites}
                  onChange={(e) =>
                    setOverlayLayers((s) => ({ ...s, sites: e.target.checked }))
                  }
                />
                Dumpsites &amp; TLS
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={overlayLayers.queues}
                  onChange={(e) =>
                    setOverlayLayers((s) => ({ ...s, queues: e.target.checked }))
                  }
                />
                Gate queues
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={overlayLayers.closures}
                  onChange={(e) =>
                    setOverlayLayers((s) => ({ ...s, closures: e.target.checked }))
                  }
                />
                Road closures
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={overlayLayers.drainage}
                  onChange={(e) =>
                    setOverlayLayers((s) => ({ ...s, drainage: e.target.checked }))
                  }
                />
                Drainage warnings
              </label>
              <small>Nearby vehicles cluster automatically.</small>
            </div>
          ) : null}

          {mapError ? (
            <div className="map-error" id="mapError">
              <svg aria-hidden="true">
                <use href="#i-map" />
              </svg>
              <b>The map couldn’t load</b>
              <p>
                Check your internet connection and browser graphics support. Fleet records remain available.
              </p>
              <button type="button" className="btn" onClick={initMap}>
                Retry map
              </button>
            </div>
          ) : null}

          {!mapReady && !mapError ? (
            <div className="map-loading" id="mapLoading">
              <span />
              Loading Lagos street map…
            </div>
          ) : null}

          <div className="map-bottom">
            <div className="legend">
              <span>
                <i className="on" />
                On route
              </span>
              <span>
                <i className="collect" />
                Collecting
              </span>
              <span>
                <i className="facility" />
                At facility
              </span>
              <span>
                <i className="stale" />
                No signal
              </span>
            </div>
            <span className="snapshot">
              <svg aria-hidden="true">
                <use href="#i-clock" />
              </svg>
              Snapshot · {fmStamp(snapshotDate)}
            </span>
          </div>

          {selectedVehicle ? (
            <aside className="detail" id="detail" aria-label="Selected vehicle details">
              <div className="detail-head">
                <div className="detail-heading">
                  <div>
                    <div className="detail-kicker">VEHICLE DETAILS</div>
                    <h2>{selectedVehicle.code}</h2>
                    <span
                      className="status-label"
                      style={{ color: COLORS[selectedVehicle.status] }}
                    >
                      <i
                        className="dot"
                        style={{ background: COLORS[selectedVehicle.status] }}
                      />
                      {selectedVehicle.status}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="iconbtn"
                    id="closeDetail"
                    aria-label="Close vehicle details"
                    onClick={() => setSelectedId(null)}
                  >
                    <svg className="icon" aria-hidden="true">
                      <use href="#i-close" />
                    </svg>
                  </button>
                </div>
                <p>
                  {selectedVehicle.district} · {selectedVehicle.psp} ({selectedVehicle.plate}) · Snapshot{" "}
                  {fmStamp(snapshotDate)}
                </p>
              </div>

              <div className="detail-tabs" role="tablist">
                {(
                  [
                    ["overview", "Overview"],
                    ["service", "Service & dispatch"],
                    ["activity", "Reviews"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={detailTab === k}
                    className={detailTab === k ? "active" : ""}
                    onClick={() => setDetailTab(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="detail-content">
                {detailTab === "overview" ? (
                  <>
                    <section className="detail-section">
                      <h3>Truck summary</h3>
                      <div className="kv">
                        <span>PSP operator</span>
                        <b>{selectedVehicle.psp}</b>
                      </div>
                      <div className="kv">
                        <span>Plate &amp; tier</span>
                        <b>
                          {selectedVehicle.plate} · {selectedVehicle.tier}
                        </b>
                      </div>
                      <div className="kv">
                        <span>Crew lead</span>
                        <b>{selectedVehicle.crew}</b>
                      </div>
                      <div className="kv">
                        <span>Last reported position</span>
                        <b>
                          {selectedVehicle.coord[1].toFixed(5)}° N,{" "}
                          {selectedVehicle.coord[0].toFixed(5)}° E
                          <br />
                          {selectedVehicle.positionState}
                        </b>
                      </div>
                      <div className="kv">
                        <span>Collection progress</span>
                        <b>
                          {selectedVehicle.verified} / {selectedVehicle.planned} stops verified
                          <br />
                          {selectedVehicle.reported} reported · {selectedVehicle.pending} awaiting review
                        </b>
                      </div>
                      <progress
                        className="fm-progress"
                        value={selectedVehicle.verified}
                        max={selectedVehicle.planned}
                        aria-label="Verified stops"
                      />
                      <div className="kv">
                        <span>Dumpsite / TLS booking</span>
                        <b>
                          {selectedVehicle.lastTicket
                            ? `${selectedVehicle.lastTicket.site} · ${selectedVehicle.lastTicket.slot}`
                            : "Oshodi TLS · 14:30 WAT slot"}
                        </b>
                      </div>
                    </section>

                    <section className="detail-section">
                      <h3>Needs attention</h3>
                      {selectedVehicle.exceptions.length > 0 ? (
                        selectedVehicle.exceptions.map((e, idx) => (
                          <div key={idx} className="fm-exception">
                            <b>{e.kind}</b>
                            <p>{e.note}</p>
                          </div>
                        ))
                      ) : (
                        <p className="note">No flagged exception in this snapshot.</p>
                      )}
                      <div className="detail-actions">
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => setFollowupModalFor(selectedVehicle)}
                        >
                          Record supervisor follow-up
                          <svg className="icon" aria-hidden="true">
                            <use href="#i-arrow" />
                          </svg>
                        </button>
                      </div>
                    </section>

                    <section className="detail-section">
                      <h3>Position reliability &amp; CAN-bus readings</h3>
                      <div className="kv">
                        <span>Update state</span>
                        <b>{selectedVehicle.positionState}</b>
                      </div>
                      <div className="kv">
                        <span>Last received</span>
                        <b>{ageText(selectedVehicle.age)}</b>
                      </div>
                      <div className="kv">
                        <span>Reported speed</span>
                        <b>
                          {selectedVehicle.positionState === "Recent position"
                            ? `${selectedVehicle.speed} km/h`
                            : "Not current"}
                        </b>
                      </div>
                      <div className="kv">
                        <span>Fuel remaining (CAN-bus)</span>
                        <b>{selectedVehicle.fuelPct}%</b>
                      </div>
                      <div className="kv">
                        <span>Compactor load estimate</span>
                        <b>{selectedVehicle.loadPct}%</b>
                      </div>
                      {selectedVehicle.lastTicket ? (
                        <div className="kv">
                          <span>Latest linked TLS ticket</span>
                          <b>
                            {selectedVehicle.lastTicket.ticket} ·{" "}
                            {selectedVehicle.lastTicket.net.toLocaleString("en-NG")} kg
                          </b>
                        </div>
                      ) : null}
                      <div className="detail-actions">
                        <button
                          type="button"
                          className="btn"
                          onClick={() => fitSelectedRoute(selectedVehicle)}
                        >
                          <svg className="icon" aria-hidden="true">
                            <use href="#i-fit" />
                          </svg>
                          Show route
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setDetailTab("service")}
                        >
                          Service &amp; dispatch
                        </button>
                      </div>
                    </section>
                  </>
                ) : null}

                {detailTab === "service" ? (
                  <>
                    <section className="detail-section">
                      <h3>Collection progress</h3>
                      <div className="kv">
                        <span>Assigned stops</span>
                        <b>{selectedVehicle.planned}</b>
                      </div>
                      <div className="kv">
                        <span>Reported collections</span>
                        <b>{selectedVehicle.reported}</b>
                      </div>
                      <div className="kv">
                        <span>Verified collections</span>
                        <b>{selectedVehicle.verified}</b>
                      </div>
                      <div className="kv">
                        <span>Evidence awaiting review</span>
                        <b>{selectedVehicle.pending}</b>
                      </div>
                      <p className="note">
                        RFID bin tag scan + geofenced timestamped photo are required alongside GPS proximity.
                      </p>
                    </section>
                    <section className="detail-section">
                      <h3>Route assignments &amp; manifests</h3>
                      <div className="kv">
                        <span>Assigned corridor</span>
                        <b>
                          {selectedVehicle.district} · {selectedVehicle.plate}
                        </b>
                      </div>
                      <div className="kv">
                        <span>Franchise ward</span>
                        <b>{selectedVehicle.partnerId}</b>
                      </div>
                      <div className="kv">
                        <span>Weighbridge manifest</span>
                        <b>
                          {selectedVehicle.lastTicket
                            ? `${selectedVehicle.lastTicket.ticket} · ${selectedVehicle.lastTicket.site}`
                            : "Awaiting TLS weighbridge intake"}
                        </b>
                      </div>
                    </section>
                  </>
                ) : null}

                {detailTab === "activity" ? (
                  <>
                    <section className="detail-section">
                      <h3>Supervisor reviews &amp; follow-ups</h3>
                      {followups.filter((f) => f.vehicle === selectedVehicle.code).length > 0 ? (
                        followups
                          .filter((f) => f.vehicle === selectedVehicle.code)
                          .map((f) => (
                            <div key={f.id} className="fm-followup">
                              <b>{f.owner}</b>
                              <p className="note">{f.note}</p>
                              <small>
                                {f.by} · {f.at}
                              </small>
                            </div>
                          ))
                      ) : (
                        <p className="note">No supervisor follow-up recorded for {selectedVehicle.code} yet.</p>
                      )}
                      <div className="detail-actions">
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => setFollowupModalFor(selectedVehicle)}
                        >
                          Add follow-up note
                        </button>
                      </div>
                    </section>
                  </>
                ) : null}
              </div>
            </aside>
          ) : null}
        </div>
      </section>

      <footer className="page-foot">
        <span>
          LAWMA 360 unified fleet map · {model.profile.name} ({model.wardProfile.concessionId}) · road-aligned OSRM corridors
        </span>
        <span>Freshness thresholds: stale at 5 minutes, missing at 15 minutes.</span>
      </footer>

      {followupModalFor ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFollowupModalFor(null);
          }}
        >
          <section
            className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="followupModalTitle"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow text-muted-foreground">SUPERVISOR FOLLOW-UP</p>
                <h2 id="followupModalTitle" className="mt-1 text-lg font-semibold">
                  {followupModalFor.code} · {followupModalFor.plate}
                </h2>
              </div>
              <button
                type="button"
                className="iconbtn"
                aria-label="Close dialog"
                onClick={() => setFollowupModalFor(null)}
              >
                ×
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Record a dispatch follow-up, hot-swap authorization, or 48-hour statutory cure evidence note for{" "}
              {followupModalFor.district}.
            </p>
            <label className="mt-4 block text-xs font-medium">
              Responsible team
              <select
                value={followupOwner}
                onChange={(e) => setFollowupOwner(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border bg-background px-2.5 text-xs"
              >
                <option>PSP service liaison</option>
                <option>District operations supervisor</option>
                <option>Field evidence &amp; cure team</option>
                <option>Standby compactor hot-swap desk</option>
              </select>
            </label>
            <label className="mt-3 block text-xs font-medium">
              Action and evidence recorded
              <textarea
                value={followupNote}
                onChange={(e) => setFollowupNote(e.target.value)}
                placeholder="Describe the field verification, hot-swap plate, or RFID cure evidence…"
                className="mt-1 h-24 w-full rounded-md border bg-background p-2.5 text-xs"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setFollowupModalFor(null)}>
                Cancel
              </button>
              <button type="button" className="btn primary" onClick={saveFollowup}>
                Save follow-up
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {toastMsg ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-inverse px-4 py-2.5 text-xs text-inverse-foreground shadow-lg"
        >
          {toastMsg}
        </div>
      ) : null}
    </div>
  );
}
