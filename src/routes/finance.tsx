import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Fuel, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { buildBoiDossierPdf, buildRemittancePdf, deliverFile } from "@/lib/receipt";
import { money, useStore, type Settlement } from "@/lib/store";
import { checkFuelBarcodeFallback, computeBoiDossier, computeDieselFva, computeEscrowBreakdown } from "@/lib/psp-rules";
import { pageHead } from "@/lib/meta";
import { Chip, Empty, Kpi, PageHeader, Panel, Td, Th } from "@/components/partner/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/finance")({
  head: pageHead("Finance", "Automated Friday 5 PM 80/20 escrow payouts, 48h cure window, diesel FVA, 72h fuel barcodes, and BOI fleet loan dossiers."),
  component: Finance,
});

type FinTab = "escrow" | "cure" | "fva" | "boi";

function Finance() {
  const { model, triggerFridayEscrow, cureHold, issueEmergencyFuelBarcode } = useStore();
  const [tab, setTab] = useState<FinTab>("escrow");
  const [confirming, setConfirming] = useState(false);
  const [receipt, setReceipt] = useState<Settlement | null>(null);
  const [busy, setBusy] = useState("");
  const [dieselPrice, setDieselPrice] = useState(1350);
  const [weeklyKm, setWeeklyKm] = useState(640);
  const [nipLagMin, setNipLagMin] = useState(52);

  const openCure = model.cureCases.filter((c) => c.status === "Action required");
  const heldCureNgn = openCure.reduce((n, c) => n + c.amountHeldNgn, 0);
  const grossEscrow = model.wardProfile.weeklyEscrowGrossNgn + model.earningsUncaptured;
  const escrow = computeEscrowBreakdown(grossEscrow, model.wardProfile.circularTonnes, heldCureNgn);
  const fva = computeDieselFva(dieselPrice, weeklyKm, model.wardProfile.weeklyTonnesTls);
  const nipFallback = checkFuelBarcodeFallback(nipLagMin, escrow.netDisbursableFridayNgn || 4200000);
  const boi = computeBoiDossier(model.wardProfile.weeklyTonnesTls, (escrow.partnerShare80Ngn || 3856000));

  const downloadEscrowPdf = async (s: Settlement) => {
    setBusy(s.ref);
    try { await deliverFile(await buildRemittancePdf(s, model.profile), `LAWMA-escrow-${s.ref}.pdf`); }
    catch { toast.error("Couldn't create the escrow certificate. Please try again."); }
    finally { setBusy(""); }
  };

  const downloadBoiPdf = async () => {
    setBusy("BOI");
    try {
      await deliverFile(
        await buildBoiDossierPdf(boi, {
          name: model.profile.name,
          contact: model.profile.contact,
          areas: model.profile.areas,
          concessionId: model.wardProfile.concessionId,
          bankAccount: model.wardProfile.bankAccount,
        }),
        `LAWMA-BOI-Loan-Dossier-${model.wardProfile.concessionId}.pdf`,
      );
      toast.success("BOI Fleet Loan Dossier PDF downloaded");
    } catch {
      toast.error("Couldn't create the BOI loan dossier.");
    } finally {
      setBusy("");
    }
  };

  const dl = (s: Settlement, label = true) => (
    <Button variant="outline" size="sm" disabled={busy === s.ref} onClick={() => downloadEscrowPdf(s)} aria-label={`Download escrow certificate ${s.ref}`}>
      <Download className="size-4" />{label ? (busy === s.ref ? "Preparing…" : "Certificate") : null}
    </Button>
  );

  return (
    <>
      <PageHeader
        eyebrow={`Escrow Clearinghouse · ${model.wardProfile.bankAccount}`}
        title="Finance, Escrow & Fleet Credit"
        sub="Automated Friday 5:00 PM 80/20 NIBSS NIP payouts, 48-hour cure window, diesel FVA indexation, 72h fuel barcodes, and BOI loan dossiers."
        actions={
          <Button className="btn-heat" disabled={escrow.netDisbursableFridayNgn === 0} onClick={() => setConfirming(true)}>
            Execute Friday 5 PM Escrow Payout
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted p-1">
        {([
          ["escrow", "Escrow & Friday Payout (80/20)"],
          ["cure", `48h Cure Window (${openCure.length})`],
          ["fva", "Diesel FVA & 72h Fuel Barcodes"],
          ["boi", "BOI / Bank Fleet Loan Dossier"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn("rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors", tab === k && "bg-card font-medium text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "escrow" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Gross ward escrow" value={money(escrow.grossCollectedNgn)} sub="Ring-fenced commercial bank" />
            <Kpi label="PSP 80% Friday payout" value={money(escrow.netDisbursableFridayNgn)} sub={`Bucket A ${money(escrow.bucketA50AvailabilityNgn)} + Bucket B`} accent={escrow.netDisbursableFridayNgn > 0} />
            <Kpi label="Circular diversion bonus" value={money(escrow.circularSegregationBonusNgn)} sub={`${model.wardProfile.circularTonnes} t MRF & Biodigester`} />
            <Kpi label="LAWMA 20% subvention" value={money(escrow.authorityShare20Ngn)} sub="TLS & regulatory oversight" />
          </div>

          <Panel title="Bucket A / Bucket B escrow split breakdown" meta="Automated Friday 5:00 PM NIP" flush>
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="eyebrow text-muted-foreground">Bucket A · 50% of PSP Share</p>
                <p className="mt-1 font-mono text-xl font-semibold">{money(escrow.bucketA50AvailabilityNgn)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Ward Availability &amp; Shift Manifest (protected by 60-min hot-swap).</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="eyebrow text-muted-foreground">Bucket B · 50% of PSP Share</p>
                <p className="mt-1 font-mono text-xl font-semibold">{money(escrow.bucketB50PerformanceNgn - escrow.heldCureNgn)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Doorstep QR Scans &amp; TLS Weighbridge Tonnage ({money(escrow.heldCureNgn)} in 48h cure).</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="eyebrow text-muted-foreground">Circular Segregation Bonus</p>
                <p className="mt-1 font-mono text-xl font-semibold text-forest-text">+{money(escrow.circularSegregationBonusNgn)}</p>
                <p className="mt-1 text-xs text-muted-foreground">₦4,200/t incentive for clean Jospong MRF &amp; Ikosi Biodigester loads.</p>
              </div>
            </div>
          </Panel>

          <Panel title="Friday escrow settlement history" meta={String(model.settlements.length)} flush>
            {model.settlements.length === 0 ? <div className="p-5"><Empty>No settlements yet.</Empty></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50"><tr><Th>Batch Ref</Th><Th>Date</Th><Th className="text-right">Gross Escrow</Th><Th className="text-right">PSP 80% Payout</Th><Th className="text-right">LAWMA 20%</Th><Th className="text-right">Certificate</Th></tr></thead>
                  <tbody className="divide-y font-mono tabular-nums">
                    {model.settlements.map((s) => (
                      <tr key={s.ref}><Td className="font-medium">{s.ref}</Td><Td className="text-xs text-muted-foreground">{s.date}</Td><Td className="text-right">{money(s.amount)}</Td><Td className="text-right text-forest-text">{money(s.partnerShare)}</Td><Td className="text-right">{money(s.authorityShare)}</Td><Td className="text-right">{dl(s)}</Td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ) : null}

      {tab === "cure" ? (
        <Panel title="48-hour statutory cure window & calibration holds" meta={`${openCure.length} open`} flush>
          <ul className="divide-y">
            {model.cureCases.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className={cn("size-4 shrink-0", c.status === "Action required" ? "text-honey" : "text-forest")} />
                    <p className="font-medium">{c.pickupOrTicket} <span className="font-mono text-xs text-muted-foreground">{c.id}</span></p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{c.reason}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    Held in Bucket B: {money(c.amountHeldNgn)} · {c.status === "Action required" ? `${c.hoursRemaining}h remaining before cutoff` : `Cured via ${c.method}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Chip label={c.status} tone={c.status === "Action required" ? "honey" : "forest"} />
                  {c.status === "Action required" ? (
                    <Button size="sm" className="btn-heat" onClick={() => { cureHold(c.id, "GATE_LOCKED geo-photo + Keke recovery", "Verified in 48h window"); toast.success(`${money(c.amountHeldNgn)} unlocked for Friday payout`); }}>
                      Submit geo-proof &amp; cure
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {tab === "fva" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Dynamic Diesel FVA & Haulage Equalization (HEF)">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="diesel">Current pump diesel (₦/L)</Label>
                  <Input id="diesel" type="number" value={dieselPrice} onChange={(e) => setDieselPrice(Number(e.target.value) || 950)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="km">Weekly fleet distance (km)</Label>
                  <Input id="km" type="number" value={weeklyKm} onChange={(e) => setWeeklyKm(Number(e.target.value) || 0)} />
                </div>
              </div>
              <dl className="divide-y rounded-lg border text-sm">
                <div className="flex justify-between px-4 py-2.5"><dt className="text-muted-foreground">Tariff baseline diesel</dt><dd className="font-mono">{money(fva.baselinePriceNgn)}/L</dd></div>
                <div className="flex justify-between px-4 py-2.5"><dt className="text-muted-foreground">Variance above baseline</dt><dd className="font-mono">{fva.variancePct > 0 ? `+${fva.variancePct}%` : `${fva.variancePct}%`}</dd></div>
                <div className="flex justify-between px-4 py-2.5"><dt className="text-muted-foreground">Weekly fuel cost / tonne</dt><dd className="font-mono">{money(fva.costPerTonneNgn)}/t</dd></div>
                <div className="flex justify-between px-4 py-2.5"><dt className="text-muted-foreground">HEF equalization credit (&gt;15% trigger)</dt><dd className="font-mono font-semibold text-forest-text">{fva.hefTriggered ? `+${money(fva.hefEqualizationCreditNgn)}` : "Below 15% trigger"}</dd></div>
              </dl>
            </div>
          </Panel>

          <Panel title="Friday NIBSS 72h Emergency Fuel Barcode Wallet">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If Friday 12:00 PM NIBSS NIP bank settlement lags past 45 minutes, escrow auto-issues 72-hour digital fuel barcodes redeemable at NNPC Retail, TotalEnergies, and Ardova Plc so trucks never park on Saturday morning.
              </p>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="nipLag">NIBSS NIP switch latency (minutes)</Label>
                  <Input id="nipLag" type="number" value={nipLagMin} onChange={(e) => setNipLagMin(Number(e.target.value) || 0)} />
                </div>
                <Button
                  className="btn-heat"
                  disabled={!nipFallback.triggered}
                  onClick={() => {
                    const bc = issueEmergencyFuelBarcode(nipFallback.voucherAllocationNgn, "SET-2026-W47-NIP");
                    toast.success(`Issued 72h fuel barcode ${bc.id} (${money(bc.amountNgn)})`);
                  }}
                >
                  <Fuel className="size-4" /> Issue 72h fuel barcode
                </Button>
              </div>
              <ul className="divide-y rounded-lg border">
                {model.fuelBarcodes.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-mono font-medium">{b.id} · {money(b.amountNgn)}</p>
                      <p className="text-xs text-muted-foreground">{b.networks} · {b.validHours}h validity</p>
                    </div>
                    <Chip label={b.status} tone="forest" />
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>
      ) : null}

      {tab === "boi" ? (
        <Panel
          title="Bank of Industry (BOI) / Commercial Bank Compactor Loan Dossier"
          meta="Certified 12-month underwriting statement"
          action={
            <Button className="btn-heat" disabled={busy === "BOI"} onClick={downloadBoiPdf}>
              <FileSpreadsheet className="size-4" /> {busy === "BOI" ? "Generating…" : "Download BOI Loan Dossier PDF"}
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Pre-qualified lease limit" value={money(boi.eligibleFacilityNgn)} sub={`${boi.tenorMonths}m @ ${boi.interestRatePct}% p.a.`} accent />
            <Kpi label="12-month 80% escrow inflow" value={money(boi.annualEscrowInflowNgn)} sub="Verified NIBSS NIP ledger" />
            <Kpi label="12-month TLS tonnage" value={`${boi.annualVerifiedTonnes.toLocaleString("en-NG")} t`} sub={`${boi.collectionEfficiencyPct}% collection efficiency`} />
            <Kpi label="Debt Service Coverage (DSCR)" value={`${boi.dscr}x`} sub="Bankable threshold >= 1.50x" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Replaces informal paper billing books with LAWMA-certified digital weighbridge tonnage and ring-fenced Friday escrow cashflows for Sterling Bank and BOI CNG/Euro-IV compactor acquisition loans.
          </p>
        </Panel>
      ) : null}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader><DialogTitle>Execute Friday 5:00 PM Escrow Settlement</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Disburse <strong className="text-foreground">{money(escrow.netDisbursableFridayNgn)}</strong> (80% PSP share + circular bonus, net of {money(escrow.heldCureNgn)} in 48h cure) directly to <strong className="text-foreground">{model.wardProfile.bankAccount}</strong> via NIBSS NIP.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button className="btn-heat" onClick={() => { setReceipt(triggerFridayEscrow()); setConfirming(false); }}>Confirm NIP disbursement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-forest" /> Friday Escrow Disbursed</DialogTitle></DialogHeader>
          {receipt ? (
            <dl className="divide-y rounded-lg border font-mono text-sm">
              {[["Batch Ref", receipt.ref], ["Date", receipt.date], ["Gross Escrow", money(receipt.amount)], ["PSP 80% Payout", money(receipt.partnerShare)], ["LAWMA 20% Subvention", money(receipt.authorityShare)]].map(([k, v]) => (
                <div key={k} className="flex justify-between px-4 py-2.5"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          ) : null}
          <DialogFooter>{receipt ? <Button variant="outline" disabled={busy === receipt.ref} onClick={() => downloadEscrowPdf(receipt)}><Download className="size-4" />Download escrow certificate</Button> : null}<Button onClick={() => setReceipt(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
