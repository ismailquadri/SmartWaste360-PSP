import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/meta";
import { checkCompliance, RULES, seedFleet, tick } from "@/lib/fleet";
import { detectFleetSabotage } from "@/lib/psp-rules";
import { Chip, Kpi, PageHeader, Panel } from "@/components/partner/kit";
import { cn } from "@/lib/utils";

const FleetMap = lazy(() => import("@/components/partner/FleetMap"));

export const Route = createFileRoute("/fleet")({
  head: pageHead("Fleet", "Two-tier fleet telematics, anti-syphoning fuel monitor and ward geofence compliance."),
  component: Fleet,
});

function Fleet() {
  const { model } = useStore();
  const [fleet, setFleet] = useState(() => seedFleet(model.crews));
  const [selected, setSelected] = useState("");
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains("dark"));
    read();
    const o = new MutationObserver(read);
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => o.disconnect();
  }, []);
  useEffect(() => { const t = setInterval(() => setFleet(tick), 3000); return () => clearInterval(t); }, []);

  const rows = useMemo(() => fleet.map((v) => ({
    ...v,
    violations: checkCompliance(v),
    sabotage: detectFleetSabotage({ fuelDropStationaryL: v.fuelDropStationaryL ?? 0, compactionOutsideZone: v.compactionOutsideZone ?? false, inZone: v.inZone }),
  })), [fleet]);
  const pins = useMemo(() => rows.map((r) => ({ ...r, flagged: r.violations.length + r.sabotage.length > 0 })), [rows]);
  const compliant = rows.filter((r) => r.violations.length + r.sabotage.length === 0).length;
  const sabotageCount = rows.reduce((n, r) => n + r.sabotage.length, 0);
  const onSelect = useCallback((id: string) => setSelected(id), []);
  const stopsFor = (crewId: string) => model.routeStops.filter((s) => s.crewId === crewId && !s.done).length;

  return (
    <>
      <PageHeader eyebrow={`Fleet · ${model.wardProfile.concessionId} Geofence`} title="Fleet & anti-sabotage telemetry" sub="Live OBD-II tracking, CAN-bus fuel syphon detection, and unauthorized private-job lockouts across compactors and Keke feeders." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Active vehicles" value={String(rows.length)} sub="Compactors + Keke feeders" />
        <Kpi label="Compliant" value={`${compliant}/${rows.length}`} />
        <Kpi label="Fuel / geofence alerts" value={String(sabotageCount)} sub="Syphon & kabukabu guard" accent={sabotageCount > 0} />
        <Kpi label="Speed limit" value={`${RULES.speedLimitKmh} km/h`} sub="Urban collection routes" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="h-[360px] overflow-hidden rounded-xl border bg-card sm:h-[520px]">
          <ClientOnly fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading map…</div>}>
            <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading map…</div>}>
              <FleetMap fleet={pins} selected={selected} onSelect={onSelect} dark={dark} />
            </Suspense>
          </ClientOnly>
        </div>
        <Panel title="Vehicles & CAN-bus telemetry" meta="Live · every 3s" flush>
          <ul className="divide-y">
            {rows.map((v) => {
              const totalIssues = v.violations.length + v.sabotage.length;
              return (
                <li key={v.crewId}>
                  <button onClick={() => setSelected(v.crewId)} className={cn("w-full touch-manipulation px-4 py-3 text-left hover:bg-accent", selected === v.crewId && "bg-accent")}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{v.crewName}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {v.plate} · {Math.round(v.speedKmh)} km/h · load {Math.round(v.loadPct)}% · {v.fuelLitres ?? 180}L fuel · {stopsFor(v.crewId)} stops
                        </p>
                      </div>
                      <Chip label={totalIssues ? `${totalIssues} alert${totalIssues > 1 ? "s" : ""}` : "Compliant"} tone={totalIssues ? "crimson" : "forest"} />
                    </div>
                    {totalIssues > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {v.sabotage.map((s) => (
                          <li key={s.code} className="flex items-center gap-2 text-xs text-crimson-text">
                            <span className="size-1.5 shrink-0 rounded-full bg-crimson" />
                            {s.label}
                          </li>
                        ))}
                        {v.violations.map((x) => (
                          <li key={x.code} className="flex items-center gap-2 text-xs">
                            <span className={cn("size-1.5 shrink-0 rounded-full", x.severity === "high" ? "bg-crimson" : "bg-honey")} />
                            {x.label}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
      <Panel title="PSP fleet & anti-sabotage safeguards">
        <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li>CAN-bus fuel drop &gt; 8 L while stationary triggers immediate syphon alert</li>
          <li>Hydraulic compaction outside {model.wardProfile.concessionId} flags unauthorized private jobs</li>
          <li>Speed at or below {RULES.speedLimitKmh} km/h on urban collection routes</li>
          <li>Waste covered or sealed before TLS / MRF weighbridge intake</li>
          <li>Valid PSP operating permit &amp; roadworthiness within {RULES.inspectionDays} days</li>
          <li>OBD-II GPS reporting at least every {RULES.maxPingGapMin} minutes</li>
        </ul>
      </Panel>
    </>
  );
}
