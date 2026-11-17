import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { money, useStore } from "@/lib/store";
import { computeEscrowBreakdown } from "@/lib/psp-rules";
import { pageHead } from "@/lib/meta";
import { Chip, Empty, Kpi, PageHeader, Panel } from "@/components/partner/kit";

export const Route = createFileRoute("/")({
  head: pageHead("Overview", "Statutory ward franchise, Friday 80/20 escrow, two-tier fleet and TLS circular tonnage."),
  component: Overview,
});

function Overview() {
  const { model } = useStore();
  const pendingRequests = model.customers.flatMap((c) => c.pickups.filter((p) => p.status === "Requested")).length;
  const pendingBins = model.binRequests.filter((b) => b.status === "Pending").length;
  const openCure = model.cureCases.filter((c) => c.status === "Action required");
  const heldCureNgn = openCure.reduce((n, c) => n + c.amountHeldNgn, 0);
  const escrow = computeEscrowBreakdown(
    model.wardProfile.weeklyEscrowGrossNgn + model.earningsUncaptured,
    model.wardProfile.circularTonnes,
    heldCureNgn,
  );
  const openIssue = model.customers.some((c) => c.status === "Attention needed");
  const attention = [
    ...(openCure.length ? [{ title: `${openCure.length} stops in 48h cure window (${money(heldCureNgn)})`, sub: "Submit geo-proof or recovery sweep before Friday 5 PM cutoff", action: "Cure holds", to: "/finance" as const }] : []),
    ...(pendingRequests ? [{ title: `${pendingRequests} pickup request${pendingRequests > 1 ? "s" : ""}`, sub: "Awaiting crew & time-slot assignment", action: "Review", to: "/requests" as const }] : []),
    ...(pendingBins ? [{ title: `${pendingBins} smart bin & QR tag request${pendingBins > 1 ? "s" : ""}`, sub: "Awaiting allocation & dispatch", action: "Allocate", to: "/requests" as const }] : []),
    ...(openIssue ? [{ title: "Missed collection dispute open", sub: "Submit GATE_LOCKED proof or dispatch Keke recovery", action: "Inspect", to: "/customers" as const }] : []),
    ...(model.fuelBarcodes.length ? [{ title: "72h Emergency Fuel Barcode active", sub: `${money(model.fuelBarcodes[0]!.amountNgn)} redeemable at NNPC / TotalEnergies / Ardova`, action: "Fuel wallet", to: "/finance" as const }] : []),
  ];

  return (
    <>
      <PageHeader
        eyebrow={`${model.wardProfile.concessionId} · ${model.wardProfile.statutoryClause}`}
        title={`Good day, ${model.profile.name}`}
        sub={`${model.wardProfile.propertiesInWard.toLocaleString("en-NG")} ward properties (${model.wardProfile.duidsInWard.toLocaleString("en-NG")} billed DUIDs) · Settlement bank: ${model.wardProfile.bankAccount}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/operations" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent">
              Two-tier dispatch
            </Link>
            <Link to="/finance" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-heat px-3 text-sm font-medium text-primary-foreground hover:opacity-90">
              Friday 80/20 escrow
            </Link>
          </div>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-forest/25 bg-forest-bg/40 px-4 py-3 text-sm">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-4 shrink-0 text-forest" />
          <span>
            <strong>Statutory Ward Exclusivity Active:</strong> Only {model.profile.name} compactors and feeder tricycles may manifest loads from {model.wardProfile.lga} ({model.wardProfile.concessionId}).
          </span>
        </div>
        <Chip label="Sec. 71 EMPL Protected" tone="forest" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Friday 80% escrow payout" value={money(escrow.netDisbursableFridayNgn)} sub={`Gross ${money(escrow.grossCollectedNgn)} · +${money(escrow.circularSegregationBonusNgn)} circular`} accent={escrow.netDisbursableFridayNgn > 0} />
        <Kpi label="Doorstep & compound SLA" value="91.4%" sub="1,682 / 1,840 DUIDs verified" />
        <Kpi label="TLS & circular tonnage" value={`${model.wardProfile.weeklyTonnesTls} t`} sub={`${model.wardProfile.circularTonnes} t MRF / Biodigester`} />
        <Kpi label="48h cure window holds" value={money(heldCureNgn)} sub={openCure.length ? `${openCure.length} recoverable before cutoff` : "Zero holds"} />
        <Kpi label="Diesel FVA index" value="₦1,350/L" sub="+42.1% vs ₦950 base · HEF active" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Panel title="TLS & circular weighbridge ledger" meta={`${model.tlsManifests.length} verified trips`} flush>
          <ul className="divide-y">
            {model.tlsManifests.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{m.facility} <span className="font-mono text-[11px] font-normal text-muted-foreground">{m.id}</span></p>
                  <p className="text-xs text-muted-foreground">{m.vehiclePlate} · {m.netTonnes} t net · {m.moisturePct}% moisture · {m.tailgateDwellOk ? "Tailgate + 240s dwell verified" : "Pending dwell"}</p>
                </div>
                <div className="text-right">
                  <Chip label={m.stream} tone={m.bonusNgn > 0 ? "forest" : "neutral"} />
                  {m.bonusNgn > 0 ? <p className="mt-1 font-mono text-[11px] text-forest-text">+{money(m.bonusNgn)} bonus</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="PSP morning action queue" meta={String(attention.length)} flush>
          {attention.length === 0 ? (
            <div className="p-5"><Empty>Nothing urgent right now.</Empty></div>
          ) : (
            <ul className="divide-y">
              {attention.map((item) => (
                <li key={item.title} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                  <Link to={item.to} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent">
                    {item.action} <ArrowRight className="size-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="Ward activity feed" meta={`${model.activity.length} events`} flush>
        {model.activity.length === 0 ? (
          <div className="p-5"><Empty>No recent activity.</Empty></div>
        ) : (
          <ol className="divide-y">
            {model.activity.slice(0, 8).map((a) => (
              <li key={a.id} className="flex gap-3 px-5 py-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-heat" />
                <div className="min-w-0">
                  <p className="text-sm">{a.text}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{a.time}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
