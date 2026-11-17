// Pure operational, escrow, diesel FVA, anti-sabotage, and BOI credit-underwriting rules
// for the AWAMN Partner PSP Platform (Piece 2).

export const PSP_ESCROW_PARTNER_PCT = 80;
export const PSP_BUCKET_A_PCT = 50; // 50% of PSP share = Ward Availability & Shift Manifest
export const PSP_BUCKET_B_PCT = 50; // 50% of PSP share = Verified Doorstep Scans & TLS Tonnage
export const PSP_CIRCULAR_BONUS_PCT = 15; // 15% diversion incentive for MRF / Biodigester loads
export const PSP_DIESEL_BASELINE_NGN = 950;
export const PSP_FVA_TRIGGER_PCT = 15;
export const PSP_NIP_FAILOVER_MIN = 45;
export const PSP_CURE_WINDOW_HOURS = 48;
export const PSP_SYPHON_THRESHOLD_LITRES = 8;

export type EscrowBreakdown = {
  grossCollectedNgn: number;
  partnerShare80Ngn: number;
  bucketA50AvailabilityNgn: number;
  bucketB50PerformanceNgn: number;
  authorityShare20Ngn: number;
  circularSegregationBonusNgn: number;
  heldCureNgn: number;
  netDisbursableFridayNgn: number;
};

export function computeEscrowBreakdown(
  grossCollectedNgn: number,
  circularVerifiedTonnes: number,
  heldCureNgn = 0,
): EscrowBreakdown {
  const gross = Math.max(0, Math.round(grossCollectedNgn));
  const partnerShare80Ngn = Math.round(gross * (PSP_ESCROW_PARTNER_PCT / 100));
  const authorityShare20Ngn = gross - partnerShare80Ngn;
  const bucketA50AvailabilityNgn = Math.round(partnerShare80Ngn * (PSP_BUCKET_A_PCT / 100));
  const bucketB50PerformanceNgn = partnerShare80Ngn - bucketA50AvailabilityNgn;
  // ₦4,200/tonne circular sorting bonus on clean MRF & Biodigester deliveries
  const circularSegregationBonusNgn = Math.round(Math.max(0, circularVerifiedTonnes) * 4200);
  const held = Math.max(0, Math.min(bucketB50PerformanceNgn, Math.round(heldCureNgn)));
  const netDisbursableFridayNgn = Math.max(0, partnerShare80Ngn + circularSegregationBonusNgn - held);
  return {
    grossCollectedNgn: gross,
    partnerShare80Ngn,
    bucketA50AvailabilityNgn,
    bucketB50PerformanceNgn,
    authorityShare20Ngn,
    circularSegregationBonusNgn,
    heldCureNgn: held,
    netDisbursableFridayNgn,
  };
}

export type DieselFvaResult = {
  currentPriceNgn: number;
  baselinePriceNgn: number;
  variancePct: number;
  hefTriggered: boolean;
  weeklyFuelCostNgn: number;
  hefEqualizationCreditNgn: number;
  costPerTonneNgn: number;
};

export function computeDieselFva(
  currentPriceNgn: number,
  weeklyDistanceKm: number,
  weeklyTonnes: number,
  consumptionLPerKm = 0.42,
): DieselFvaResult {
  const price = Math.max(100, currentPriceNgn);
  const variancePct = Math.round(((price - PSP_DIESEL_BASELINE_NGN) / PSP_DIESEL_BASELINE_NGN) * 1000) / 10;
  const hefTriggered = variancePct > PSP_FVA_TRIGGER_PCT;
  const litresUsed = Math.max(0, weeklyDistanceKm) * consumptionLPerKm;
  const weeklyFuelCostNgn = Math.round(litresUsed * price);
  const baselineFuelCostNgn = Math.round(litresUsed * PSP_DIESEL_BASELINE_NGN);
  const hefEqualizationCreditNgn = hefTriggered ? Math.round((weeklyFuelCostNgn - baselineFuelCostNgn) * 0.65) : 0;
  const costPerTonneNgn = weeklyTonnes > 0 ? Math.round(weeklyFuelCostNgn / weeklyTonnes) : 0;
  return {
    currentPriceNgn: price,
    baselinePriceNgn: PSP_DIESEL_BASELINE_NGN,
    variancePct,
    hefTriggered,
    weeklyFuelCostNgn,
    hefEqualizationCreditNgn,
    costPerTonneNgn,
  };
}

export function checkFuelBarcodeFallback(elapsedMin: number, escrowAccruedNgn: number) {
  const triggered = elapsedMin > PSP_NIP_FAILOVER_MIN;
  const voucherAllocationNgn = triggered ? Math.round(escrowAccruedNgn * 0.25) : 0;
  return {
    triggered,
    elapsedMin,
    voucherAllocationNgn,
    validHours: 72,
    networks: ["NNPC Retail", "TotalEnergies", "Ardova Plc"] as const,
  };
}

export type SabotageAlert = {
  code: "FUEL_SYPHON" | "PRIVATE_JOB";
  severity: "high";
  label: string;
};

export function detectFleetSabotage(input: {
  fuelDropStationaryL?: number;
  compactionOutsideZone?: boolean;
  inZone?: boolean;
}): SabotageAlert[] {
  const alerts: SabotageAlert[] = [];
  if ((input.fuelDropStationaryL ?? 0) > PSP_SYPHON_THRESHOLD_LITRES) {
    alerts.push({
      code: "FUEL_SYPHON",
      severity: "high",
      label: `Stationary diesel drop of ${input.fuelDropStationaryL}L detected (syphon alert)`,
    });
  }
  if (input.compactionOutsideZone || input.inZone === false) {
    alerts.push({
      code: "PRIVATE_JOB",
      severity: "high",
      label: "Hydraulic compaction outside assigned PAR ward geofence (kabukabu alert)",
    });
  }
  return alerts;
}

export type CompoundUnit = {
  duid: string;
  unitLabel: string;
  occupant: string;
  monthlyTariff: number;
  paid: boolean;
  arrears: number;
  escalated?: boolean;
};

export function evaluateCompoundSplit(units: CompoundUnit[]) {
  const totalUnits = units.length;
  const paidUnits = units.filter((u) => u.paid).length;
  const defaultingUnits = units.filter((u) => !u.paid);
  const totalArrearsNgn = defaultingUnits.reduce((n, u) => n + u.arrears, 0);
  const compliantPct = totalUnits ? Math.round((paidUnits / totalUnits) * 100) : 100;
  return {
    totalUnits,
    paidUnits,
    defaultingCount: defaultingUnits.length,
    totalArrearsNgn,
    compliantPct,
    preserveCompoundService: paidUnits > 0,
  };
}

export type BoiDossierSummary = {
  annualVerifiedTonnes: number;
  annualEscrowInflowNgn: number;
  collectionEfficiencyPct: number;
  dscr: number;
  eligibleFacilityNgn: number;
  tenorMonths: number;
  interestRatePct: number;
};

export function computeBoiDossier(weeklyTonnes: number, weeklyEscrow80Ngn: number): BoiDossierSummary {
  const annualVerifiedTonnes = Math.round(weeklyTonnes * 52 * 10) / 10;
  const annualEscrowInflowNgn = Math.round(weeklyEscrow80Ngn * 52);
  const collectionEfficiencyPct = 92.4;
  // Pre-approved CNG / Euro-IV compactor facility capped at 45% of annual escrow inflow
  const eligibleFacilityNgn = Math.round((annualEscrowInflowNgn * 0.45) / 1000000) * 1000000;
  const annualDebtService = eligibleFacilityNgn > 0 ? eligibleFacilityNgn / 3.5 : 1;
  const netOperatingCashflow = annualEscrowInflowNgn * 0.38;
  const dscr = Math.round((netOperatingCashflow / annualDebtService) * 100) / 100;
  return {
    annualVerifiedTonnes,
    annualEscrowInflowNgn,
    collectionEfficiencyPct,
    dscr,
    eligibleFacilityNgn,
    tenorMonths: 48,
    interestRatePct: 9.0,
  };
}
