import { describe, expect, it } from "vitest";
import {
  checkFuelBarcodeFallback,
  computeBoiDossier,
  computeDieselFva,
  computeEscrowBreakdown,
  detectFleetSabotage,
  evaluateCompoundSplit,
} from "@/lib/psp-rules";

describe("Partner PSP operational & escrow rules (Piece 2)", () => {
  it("computes 80/20 Friday escrow split with Bucket A/B and circular bonus", () => {
    const res = computeEscrowBreakdown(4_820_000, 48.5, 145_000);
    expect(res.partnerShare80Ngn).toBe(3_856_000);
    expect(res.authorityShare20Ngn).toBe(964_000);
    expect(res.bucketA50AvailabilityNgn).toBe(1_928_000);
    expect(res.bucketB50PerformanceNgn).toBe(1_928_000);
    expect(res.circularSegregationBonusNgn).toBe(203_700);
    expect(res.netDisbursableFridayNgn).toBe(3_856_000 + 203_700 - 145_000);
  });

  it("triggers Haulage Equalization (HEF) when diesel rises >15% above ₦950/L baseline", () => {
    const spike = computeDieselFva(1350, 640, 142.8);
    expect(spike.hefTriggered).toBe(true);
    expect(spike.variancePct).toBeCloseTo(42.1, 1);
    expect(spike.hefEqualizationCreditNgn).toBeGreaterThan(0);

    const flat = computeDieselFva(1000, 640, 142.8);
    expect(flat.hefTriggered).toBe(false);
    expect(flat.hefEqualizationCreditNgn).toBe(0);
  });

  it("issues 72h emergency fuel barcode when Friday NIBSS NIP lags >45 minutes", () => {
    const onTime = checkFuelBarcodeFallback(30, 4_000_000);
    expect(onTime.triggered).toBe(false);
    expect(onTime.voucherAllocationNgn).toBe(0);

    const delayed = checkFuelBarcodeFallback(52, 4_000_000);
    expect(delayed.triggered).toBe(true);
    expect(delayed.validHours).toBe(72);
    expect(delayed.voucherAllocationNgn).toBe(1_000_000);
  });

  it("detects stationary diesel syphoning (>8L) and out-of-ward private jobs", () => {
    const clean = detectFleetSabotage({ fuelDropStationaryL: 2, compactionOutsideZone: false, inZone: true });
    expect(clean).toEqual([]);

    const flagged = detectFleetSabotage({ fuelDropStationaryL: 11, compactionOutsideZone: true, inZone: false });
    expect(flagged.map((x) => x.code)).toEqual(["FUEL_SYPHON", "PRIVATE_JOB"]);
  });

  it("evaluates compound DUID split-billing without punishing compliant flats", () => {
    const split = evaluateCompoundSplit([
      { duid: "D1", unitLabel: "Flat 1A", occupant: "A", monthlyTariff: 1500, paid: true, arrears: 0 },
      { duid: "D2", unitLabel: "Flat 1B", occupant: "B", monthlyTariff: 1500, paid: false, arrears: 4500 },
    ]);
    expect(split.paidUnits).toBe(1);
    expect(split.defaultingCount).toBe(1);
    expect(split.totalArrearsNgn).toBe(4500);
    expect(split.preserveCompoundService).toBe(true);
  });

  it("computes bankable BOI compactor loan dossier metrics with DSCR >= 1.50x", () => {
    const boi = computeBoiDossier(142.8, 3_856_000);
    expect(boi.annualVerifiedTonnes).toBeCloseTo(7425.6, 1);
    expect(boi.annualEscrowInflowNgn).toBe(200_512_000);
    expect(boi.dscr).toBeGreaterThanOrEqual(1.5);
    expect(boi.eligibleFacilityNgn).toBeGreaterThan(0);
  });
});
