import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { money, useStore, type Crew } from "@/lib/store";
import { pageHead } from "@/lib/meta";
import { Chip, Empty, PageHeader, Panel, Td, Th } from "@/components/partner/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/operations")({
  head: pageHead("Operations", "Two-tier compactor & tricycle dispatch, 60-minute hot-swap and TLS weighbridge manifests."),
  component: Operations,
});

function Operations() {
  const { model, completeStop, customerById, requestHotSwap } = useStore();
  const [swapCrew, setSwapCrew] = useState<Crew | null>(null);
  const [standbyPlate, setStandbyPlate] = useState("LND 902 KJA");
  const [swapReason, setSwapReason] = useState("Hydraulic ram seal pressure drop");

  return (
    <>
      <PageHeader
        eyebrow="Operations · Two-Tier Fleet & TLS"
        title="Operations"
        sub="Mother compactors on primary avenues, Keke feeder tricycles on narrow inner lanes, 60-minute hot-swap, and TLS weighbridge manifests."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {model.crews.map((crew) => {
          const stops = model.routeStops.filter((s) => s.crewId === crew.id);
          const done = stops.filter((s) => s.done).length;
          const pct = stops.length ? (done / stops.length) * 100 : 0;
          return (
            <div key={crew.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{crew.name}</p>
                <span className="shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{crew.plate}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Chip label={crew.tier ?? "Compactor (20T)"} tone={crew.tier?.includes("Tricycle") ? "honey" : "neutral"} />
                {crew.rendezvousPoint ? <span className="font-mono text-[11px] text-muted-foreground">Handoff: {crew.rendezvousPoint}</span> : null}
              </div>
              <p className="mt-3 font-mono text-2xl tabular-nums">{done}/{stops.length} <span className="text-sm text-muted-foreground">stops</span></p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-heat" style={{ width: `${pct}%` }} /></div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{crew.members.join(" · ")}</p>
                <Button size="sm" variant="outline" onClick={() => { setSwapCrew(crew); setStandbyPlate(crew.standbyPlate ?? "LND 902 KJA"); }}>
                  <RefreshCw className="size-3.5" /> 60m Hot-swap
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {model.hotSwaps.length > 0 ? (
        <Panel title="Active 60-minute hot-swap requests" meta={String(model.hotSwaps.length)} flush>
          <ul className="divide-y">
            {model.hotSwaps.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{s.brokenPlate} → {s.standbyPlate} <span className="font-mono text-[11px] text-muted-foreground">{s.id}</span></p>
                  <p className="text-xs text-muted-foreground">{s.reason} · Requested {s.requestedAt}</p>
                </div>
                <Chip label={s.status} tone="honey" />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="TLS & circular weighbridge manifests" meta={`${model.tlsManifests.length} tickets`} flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <Th>Ticket</Th><Th>Facility / Stream</Th><Th>Vehicle</Th><Th className="text-right">Gross / Tare</Th><Th className="text-right">Net</Th><Th>Tailgate + 240s Dwell</Th><Th className="text-right">Circular Bonus</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {model.tlsManifests.map((m) => (
                <tr key={m.id}>
                  <Td className="font-mono font-medium">{m.id}</Td>
                  <Td><p className="font-medium">{m.facility}</p><p className="text-xs text-muted-foreground">{m.stream} · {m.moisturePct}% moisture</p></Td>
                  <Td className="font-mono">{m.vehiclePlate}</Td>
                  <Td className="text-right font-mono tabular-nums">{m.grossKg.toLocaleString()} / {m.tareKg.toLocaleString()} kg</Td>
                  <Td className="text-right font-mono font-medium tabular-nums">{m.netTonnes} t</Td>
                  <Td><Chip label={m.tailgateDwellOk ? "Verified" : "Held"} tone={m.tailgateDwellOk ? "forest" : "crimson"} /></Td>
                  <Td className="text-right font-mono tabular-nums">{m.bonusNgn > 0 ? `+${money(m.bonusNgn)}` : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Route list" meta={`${model.routeStops.length} stops`} flush>
        {model.routeStops.length === 0 ? (
          <div className="p-5"><Empty>No stops scheduled. Accept pickup requests to build today’s route.</Empty></div>
        ) : (
          <ol className="divide-y">
            {model.routeStops.map((stop, i) => {
              const crew = model.crews.find((c) => c.id === stop.crewId);
              const customer = customerById(stop.customerId);
              const pickup = customer?.pickups.find((p) => p.id === stop.pickupId);
              return (
                <li key={stop.id} className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 px-4 py-4 sm:items-center sm:px-5 md:grid-cols-[auto_minmax(0,1fr)_auto_auto]", stop.done && "opacity-60")}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border font-mono text-xs">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{customer?.name ?? stop.customerId}</p>
                    <p className="text-sm text-muted-foreground">{stop.address} · {stop.window}</p>
                    <p className="break-words font-mono text-xs text-muted-foreground">{crew?.name} ({crew?.plate}){pickup ? ` · ${pickup.id} · ${money(pickup.amount)}` : ""}</p>
                  </div>
                  <Chip label={stop.done ? "Completed" : "Scheduled"} />
                  <Button size="sm" variant="outline" className="col-span-3 w-full md:col-span-1 md:w-auto" disabled={stop.done} onClick={() => { completeStop(stop.id); toast.success(`${money(pickup?.amount ?? 0)} captured to escrow`); }}>
                    Mark complete
                  </Button>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      <Dialog open={!!swapCrew} onOpenChange={(o) => !o && setSwapCrew(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request 60-minute breakdown hot-swap</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Preserves your Bucket A ward availability score while swapping {swapCrew?.plate} for a registered standby compactor.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="standby">Standby vehicle plate</Label>
              <Input id="standby" value={standbyPlate} onChange={(e) => setStandbyPlate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="swapReason">Mechanical breakdown reason</Label>
              <Input id="swapReason" value={swapReason} onChange={(e) => setSwapReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapCrew(null)}>Cancel</Button>
            <Button className="btn-heat" onClick={() => {
              if (swapCrew) {
                requestHotSwap(swapCrew.id, standbyPlate.trim() || "LND 902 KJA", swapReason.trim() || "Mechanical fault");
                toast.success("Hot-swap dispatched to LAWMA Operations for dual-official sign-off");
              }
              setSwapCrew(null);
            }}>Submit hot-swap</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
