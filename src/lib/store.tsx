const AsyncStorage = { getItem: async (k: string) => localStorage.getItem(k), setItem: async (k: string, v: string) => localStorage.setItem(k, v), removeItem: async (k: string) => localStorage.removeItem(k) };
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { CompoundUnit } from "./psp-rules";

// Mirrors the vocabulary of customer-app/src/store.tsx so the Live Link
// protocol and demo data stay consistent across both apps.
export type Bin = { id: string; size: number; state: 'Requested' | 'Allocated' | 'Out for delivery' | 'Delivered' | 'Active' };
export type Pickup = { id: string; status: 'Requested' | 'Accepted' | 'Scheduled' | 'Collected' | 'Completed' | 'Declined' | 'Cancelled'; amount: number; created: string; window: string; partner: string; evidence?: string; customerId: string; crew?: string; history?: PickupEvent[]; gateLockedProof?: string };
export type PickupEvent = { status: string; time: string; note?: string | undefined };
export type Entry = { id: string; title: string; amount: number; time: string; kind: 'credit' | 'reserved' | 'paid' | 'released' };
export type Issue = { id: string; type: string; detail: string; status: 'Open' | 'In review' | 'Resolved'; time: string; reply?: string };
export type Attachment = { name: string; type: string; size: number; dataUrl: string };
export type SupportMessage = { id: string; role: 'assistant' | 'customer'; text: string; time?: string; attachment?: Attachment };
export type NewCustomer = { name: string; address: string; area: Customer['area']; phone: string; binSize?: number; propertyClass?: Customer['propertyClass'] };
export type BinRequest = { id: string; customerId: string; kind: 'new' | 'additional'; size: number; status: 'Pending' | 'Approved' | 'Declined'; time: string };
export type Customer = { id: string; name: string; address: string; area: 'Ajah' | 'Ikeja' | 'Lekki'; phone: string; status: 'Active' | 'Attention needed'; bins: Bin[]; balance: number; reserved: number; pickups: Pickup[]; entries: Entry[]; issues: Issue[]; notices: string[]; supportMessages: SupportMessage[]; propertyDuid?: string; propertyClass?: 'Multi-Tenant Compound' | 'Commercial Plaza' | 'Residential'; units?: CompoundUnit[] };
export type Crew = { id: string; name: string; plate: string; members: string[]; tier?: 'Compactor (20T)' | 'Feeder Tricycle (Keke)'; rendezvousPoint?: string; standbyPlate?: string };
export type RouteStop = { id: string; crewId: string; customerId: string; pickupId: string; address: string; window: string; done: boolean };
export type Settlement = { ref: string; date: string; amount: number; partnerShare: number; authorityShare: number };
export type TlsManifest = { id: string; facility: string; stream: 'Epe WTE (via TLS)' | 'Jospong MRF' | 'Ikosi Biodigester' | 'Solous Residual'; vehiclePlate: string; grossKg: number; tareKg: number; netTonnes: number; tailgateDwellOk: boolean; moisturePct: number; bonusNgn: number; status: 'Verified' | 'Held · Calibration' };
export type CureCase = { id: string; pickupOrTicket: string; reason: string; amountHeldNgn: number; hoursRemaining: number; status: 'Action required' | 'Cured · Released'; method?: string; note?: string };
export type HotSwapRequest = { id: string; crewId: string; brokenPlate: string; standbyPlate: string; reason: string; status: 'Approved · Active' | 'Pending LAWMA Ops'; requestedAt: string };
export type FuelBarcode = { id: string; batchRef: string; networks: string; amountNgn: number; validHours: number; issuedAt: string; status: 'Active · Redeemable' };
export type WardProfile = { concessionId: string; lga: string; statutoryClause: string; propertiesInWard: number; duidsInWard: number; monthlyBillingNgn: number; weeklyEscrowGrossNgn: number; weeklyTonnesTls: number; circularTonnes: number; bankAccount: string };
export type ActivityEvent = { id: string; time: string; text: string; customerId?: string };
export type PartnerProfile = { name: string; areas: string; contact: string; notifyRequests: boolean; notifyMessages: boolean; notifyRemittance: boolean };
export type Model = { customers: Customer[]; crews: Crew[]; routeStops: RouteStop[]; binRequests: BinRequest[]; settlements: Settlement[]; activity: ActivityEvent[]; lawmaThread: SupportMessage[]; earningsUncaptured: number; binDeliveryUntil: number; lawmaAckAt: number; profile: PartnerProfile; wardProfile: WardProfile; tlsManifests: TlsManifest[]; cureCases: CureCase[]; hotSwaps: HotSwapRequest[]; fuelBarcodes: FuelBarcode[] };

const seedStamp = (offsetMinutes = 0) => new Date(Date.now() - offsetMinutes * 60000).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
const baseSeed = (): Model => ({
  customers: [
    { id: 'CUS-071-ADA', name: 'Ada Okafor', address: '71 Ajah Gardens', area: 'Ajah', phone: '0803 555 0171', status: 'Active', bins: [{ id: 'BIN-710071', size: 240, state: 'Active' }], balance: 3200, reserved: 1500,
      pickups: [{ id: 'PU-710001', status: 'Requested', amount: 1500, created: seedStamp(40), window: 'Friday, 9 am–noon', partner: 'Mainland Clean Services', customerId: 'CUS-071-ADA' }],
      entries: [{ id: 'RSV-710001', title: 'Reserved for PU-710001', amount: -1500, time: seedStamp(40), kind: 'reserved' }, { id: 'TOP-710001', title: 'Wallet top-up · Card', amount: 5000, time: seedStamp(120), kind: 'credit' }],
      issues: [], notices: ['PU-710001 requested. ₦1,500 is reserved until partner acceptance or decline.'],
      supportMessages: [{ id: 'MSG-710001', role: 'customer', text: 'Hi, can my Friday pickup come before noon? I have an appointment.', time: seedStamp(35) }] },
    { id: 'CUS-018-TUNDE', name: 'Tunde Bakare', address: '18 Olowu Street', area: 'Ikeja', phone: '0805 221 9087', status: 'Active', bins: [{ id: 'BIN-180018', size: 120, state: 'Active' }], balance: 900, reserved: 1450,
      pickups: [{ id: 'PU-180002', status: 'Requested', amount: 1450, created: seedStamp(55), window: 'Tomorrow, 8–11 am', partner: 'Mainland Clean Services', customerId: 'CUS-018-TUNDE' }],
      entries: [{ id: 'RSV-180002', title: 'Reserved for PU-180002', amount: -1450, time: seedStamp(55), kind: 'reserved' }], issues: [], notices: [], supportMessages: [] },
    { id: 'CUS-042-CHIOMA', name: 'Mainland Court Tenement (Chioma Eze)', address: '4 Mainland Court', area: 'Ikeja', phone: '0701 334 7721', status: 'Active', bins: [{ id: 'BIN-1042', size: 240, state: 'Active' }, { id: 'BIN-1043', size: 240, state: 'Active' }], balance: 2100, reserved: 0,
      propertyDuid: 'PROP-IKJ-042', propertyClass: 'Multi-Tenant Compound',
      units: [
        { duid: 'DUID-IKJ-042-01', unitLabel: 'Flat 1A (Ground)', occupant: 'Chioma Eze', monthlyTariff: 1500, paid: true, arrears: 0 },
        { duid: 'DUID-IKJ-042-02', unitLabel: 'Flat 1B (Ground)', occupant: 'Femi Adeola', monthlyTariff: 1500, paid: true, arrears: 0 },
        { duid: 'DUID-IKJ-042-03', unitLabel: 'Flat 2A (Upper)', occupant: 'Sadiq Bello', monthlyTariff: 1500, paid: false, arrears: 4500 },
        { duid: 'DUID-IKJ-042-04', unitLabel: 'Flat 2B (Upper)', occupant: 'Nkechi Okafor', monthlyTariff: 1500, paid: false, arrears: 3000 },
      ],
      pickups: [{ id: 'PU-104201', status: 'Scheduled', amount: 1500, created: seedStamp(300), window: 'Thursday, 1–4 pm', partner: 'Mainland Clean Services', customerId: 'CUS-042-CHIOMA', crew: 'CREW-02' }],
      entries: [{ id: 'RSV-104201', title: 'Reserved for PU-104201', amount: -1500, time: seedStamp(300), kind: 'reserved' }], issues: [], notices: [], supportMessages: [] },
    { id: 'CUS-200-FOLA', name: 'Folasade Adigun', address: '12 Marwa Close', area: 'Lekki', phone: '0902 441 2290', status: 'Active', bins: [{ id: 'BIN-200201', size: 240, state: 'Active' }], balance: 4800, reserved: 0,
      pickups: [{ id: 'PU-200101', status: 'Completed', amount: 1500, created: seedStamp(2800), window: 'Monday, 9 am–noon', partner: 'Mainland Clean Services', customerId: 'CUS-200-FOLA', crew: 'CREW-01', evidence: 'CREW-EVIDENCE-01 · collection evidence recorded' }],
      entries: [{ id: 'PAY-200101', title: 'Partner credited ₦1,500 · PU-200101', amount: 0, time: seedStamp(2790), kind: 'paid' }], issues: [], notices: [], supportMessages: [] },
    { id: 'CUS-210-KUNLE', name: 'Kunle Oyelaran', address: '5B Chevron Drive', area: 'Lekki', phone: '0813 667 4420', status: 'Active', bins: [{ id: 'BIN-210301', size: 120, state: 'Active' }], balance: 1300, reserved: 0,
      pickups: [{ id: 'PU-210301', status: 'Completed', amount: 1450, created: seedStamp(4200), window: 'Tuesday, 2–5 pm', partner: 'Mainland Clean Services', customerId: 'CUS-210-KUNLE', crew: 'CREW-03', evidence: 'CREW-EVIDENCE-01 · collection evidence recorded' }],
      entries: [{ id: 'PAY-210301', title: 'Partner credited ₦1,450 · PU-210301', amount: 0, time: seedStamp(4190), kind: 'paid' }], issues: [], notices: [], supportMessages: [] },
    { id: 'CUS-088-IBRAHIM', name: 'Ibrahim Suleiman', address: '9 Freedom Way', area: 'Lekki', phone: '0906 220 3341', status: 'Attention needed', bins: [{ id: 'BIN-088401', size: 240, state: 'Active' }], balance: 600, reserved: 1500,
      pickups: [{ id: 'PU-088401', status: 'Scheduled', amount: 1500, created: seedStamp(600), window: 'Wednesday, 10 am–1 pm', partner: 'Mainland Clean Services', customerId: 'CUS-088-IBRAHIM', crew: 'CREW-01' }],
      entries: [{ id: 'RSV-088401', title: 'Reserved for PU-088401', amount: -1500, time: seedStamp(600), kind: 'reserved' }],
      issues: [{ id: 'CASE-088001', type: 'Missed collection', detail: 'Crew did not arrive during the scheduled window last week.', status: 'Open', time: seedStamp(800) }], notices: [],
      supportMessages: [{ id: 'MSG-088001', role: 'customer', text: 'This is the second time the crew has skipped my street. Please advise.', time: seedStamp(790) }] },
    { id: 'CUS-065-NGOZI', name: 'Ngozi Umeh', address: '23 Peace Estate', area: 'Ajah', phone: '0708 552 6610', status: 'Active', bins: [], balance: 1800, reserved: 0, pickups: [], entries: [], issues: [], notices: [], supportMessages: [] },
    { id: 'CUS-150-EMEKA', name: 'Emeka Nwosu', address: '31 Allen Avenue', area: 'Ikeja', phone: '0816 773 9902', status: 'Active', bins: [{ id: 'BIN-150501', size: 240, state: 'Active' }], balance: 2500, reserved: 0, pickups: [], entries: [], issues: [], notices: [], supportMessages: [] },
  ],
  crews: [
    { id: 'CREW-01', name: 'Crew Alpha (20T Compactor)', plate: 'LND 221 KJA', members: ['Bashir A.', 'Femi O.'], tier: 'Compactor (20T)', rendezvousPoint: 'Lekki Phase 1 Gate', standbyPlate: 'LND 905 KJA' },
    { id: 'CREW-02', name: 'Crew Beta (20T Compactor)', plate: 'LND 884 XQ', members: ['Rasheed T.', 'Chidi N.'], tier: 'Compactor (20T)', rendezvousPoint: 'Allen Junction Bay', standbyPlate: 'LND 902 KJA' },
    { id: 'CREW-03', name: 'Keke Feeder 03 (Inner Lanes)', plate: 'KEKE-ETI-03', members: ['Grace I.', 'Musa D.'], tier: 'Feeder Tricycle (Keke)', rendezvousPoint: 'Chevron -> CREW-01' },
    { id: 'CREW-04', name: 'Keke Feeder 04 (Inner Lanes)', plate: 'KEKE-IKJ-04', members: ['Sule M.', 'Tunde K.'], tier: 'Feeder Tricycle (Keke)', rendezvousPoint: 'Olowu -> CREW-02' },
  ],
  routeStops: [
    { id: 'STOP-01', crewId: 'CREW-02', customerId: 'CUS-042-CHIOMA', pickupId: 'PU-104201', address: '4 Mainland Court, Ikeja', window: 'Thursday, 1–4 pm', done: false },
    { id: 'STOP-02', crewId: 'CREW-01', customerId: 'CUS-088-IBRAHIM', pickupId: 'PU-088401', address: '9 Freedom Way, Lekki', window: 'Wednesday, 10 am–1 pm', done: false },
  ],
  binRequests: [{ id: 'BINREQ-01', customerId: 'CUS-065-NGOZI', kind: 'new', size: 240, status: 'Pending', time: seedStamp(90) }],
  settlements: [{ ref: 'SET-2026-W45-IKJ', date: seedStamp(5000), amount: 4620000, partnerShare: 3696000, authorityShare: 924000 }],
  activity: [
    { id: 'ACT-01', time: seedStamp(35), text: 'Ada Okafor sent a message about her Friday pickup window.', customerId: 'CUS-071-ADA' },
    { id: 'ACT-02', time: seedStamp(40), text: 'New pickup request PU-710001 from Ada Okafor · ₦1,500 reserved.', customerId: 'CUS-071-ADA' },
    { id: 'ACT-03', time: seedStamp(55), text: 'New pickup request PU-180002 from Tunde Bakare · ₦1,450 reserved.', customerId: 'CUS-018-TUNDE' },
    { id: 'ACT-04', time: seedStamp(90), text: 'Ngozi Umeh requested a new 240 L bin.', customerId: 'CUS-065-NGOZI' },
    { id: 'ACT-05', time: seedStamp(600), text: 'PU-088401 scheduled for Ibrahim Suleiman with Crew Alpha.', customerId: 'CUS-088-IBRAHIM' },
    { id: 'ACT-06', time: seedStamp(790), text: 'Ibrahim Suleiman reported a missed collection.', customerId: 'CUS-088-IBRAHIM' },
    { id: 'ACT-07', time: seedStamp(2790), text: 'Oshodi TLS Weighbridge Ticket WT-4402 verified (14.2 t · 240s dwell).', customerId: 'CUS-200-FOLA' },
    { id: 'ACT-08', time: seedStamp(4190), text: 'Jospong MRF dry recyclables verified (6.8 t · ₦28,560 circular bonus).', customerId: 'CUS-210-KUNLE' },
  ],
  lawmaThread: [{ id: 'LAWMA-01', role: 'assistant', text: 'Escrow Clearinghouse: Friday 5:00 PM NIBSS NIP batch is queued (80% PSP share · Bucket A + Bucket B).', time: seedStamp(1400) }],
  earningsUncaptured: 2950,
  binDeliveryUntil: 0,
  lawmaAckAt: 0,
  profile: { name: 'Mainland Clean Services', areas: 'Ikeja · Yaba · Ajah · Lekki', contact: 'ops@mainlandclean.ng · 0700 000 1500', notifyRequests: true, notifyMessages: true, notifyRemittance: true },
  wardProfile: {
    concessionId: 'PAR-IKJ-002',
    lga: 'Ikeja',
    statutoryClause: 'Section 71, Lagos EMPL 2017',
    propertiesInWard: 4820,
    duidsInWard: 38400,
    monthlyBillingNgn: 24600000,
    weeklyEscrowGrossNgn: 4820000,
    weeklyTonnesTls: 142.8,
    circularTonnes: 48.5,
    bankAccount: 'Sterling Bank · 0084921844',
  },
  tlsManifests: [
    { id: 'WT-4402', facility: 'Oshodi TLS (40T Transfer)', stream: 'Epe WTE (via TLS)', vehiclePlate: 'LND 884 XQ', grossKg: 24600, tareKg: 10400, netTonnes: 14.2, tailgateDwellOk: true, moisturePct: 28, bonusNgn: 0, status: 'Verified' },
    { id: 'WT-4405', facility: 'Jospong MRF · Oshodi', stream: 'Jospong MRF', vehiclePlate: 'LND 884 XQ', grossKg: 17200, tareKg: 10400, netTonnes: 6.8, tailgateDwellOk: true, moisturePct: 18, bonusNgn: 28560, status: 'Verified' },
    { id: 'WT-4409', facility: 'Ikosi Market Biodigester', stream: 'Ikosi Biodigester', vehiclePlate: 'KEKE-IKJ-04', grossKg: 3400, tareKg: 950, netTonnes: 2.45, tailgateDwellOk: true, moisturePct: 62, bonusNgn: 10290, status: 'Verified' },
  ],
  cureCases: [
    { id: 'CURE-01', pickupOrTicket: 'PU-088401 · 9 Freedom Way', reason: 'Resident reported missed pickup; 48h cure window open', amountHeldNgn: 85000, hoursRemaining: 31, status: 'Action required' },
    { id: 'CURE-02', pickupOrTicket: 'WT-4398 · Oshodi TLS', reason: 'Scale calibration drift >0.5% on Bay 2; 60% provisional advance eligible', amountHeldNgn: 60000, hoursRemaining: 19, status: 'Action required' },
  ],
  hotSwaps: [],
  fuelBarcodes: [
    { id: 'FUEL-BC-W45', batchRef: 'SET-2026-W45-IKJ', networks: 'NNPC Retail · TotalEnergies · Ardova Plc', amountNgn: 840000, validHours: 72, issuedAt: seedStamp(1800), status: 'Active · Redeemable' },
  ],
});

const key = 'smartwaste360-partner-v3';

export type PartnerAccount = { id: string; name: string; areas: Customer['area'][]; crews: string[]; contact: string; earnings: number; settlements: boolean; concessionId?: string; weeklyEscrowGrossNgn?: number; bankAccount?: string };
export const ACCOUNTS: PartnerAccount[] = [
  { id: 'mainland', name: 'Mainland Clean Services', areas: ['Ikeja'], crews: ['CREW-02', 'CREW-04'], contact: 'ops@mainlandclean.ng · 0700 000 1500', earnings: 2950, settlements: true, concessionId: 'PAR-IKJ-002', weeklyEscrowGrossNgn: 4820000, bankAccount: 'Sterling Bank · 0084921844' },
  { id: 'coastal', name: 'Coastal Green PSP', areas: ['Lekki', 'Ajah'], crews: ['CREW-01', 'CREW-03'], contact: 'desk@coastalgreen.ng · 0700 000 2600', earnings: 1450, settlements: false, concessionId: 'PAR-ETI-009', weeklyEscrowGrossNgn: 6150000, bankAccount: 'Access Bank · 0114829901' },
];

// Each partner account gets only the customers in its service areas, plus the
// requests, routes, crews and activity tied to those customers.
export const seedFor = (account: PartnerAccount): Model => {
  const s = baseSeed();
  const customers = s.customers.filter(c => account.areas.includes(c.area)).map(c => ({ ...c, pickups: c.pickups.map(p => ({ ...p, partner: account.name })) }));
  const ids = new Set(customers.map(c => c.id));
  const crews = s.crews.filter(c => account.crews.includes(c.id));
  const first = crews[0]?.id ?? '';
  return { ...s, customers, crews,
    routeStops: s.routeStops.filter(r => ids.has(r.customerId)).map(r => account.crews.includes(r.crewId) ? r : { ...r, crewId: first }),
    binRequests: s.binRequests.filter(b => ids.has(b.customerId)),
    activity: s.activity.filter(a => !a.customerId || ids.has(a.customerId)),
    settlements: account.settlements ? s.settlements : [],
    earningsUncaptured: account.earnings,
    wardProfile: account.id === "coastal"
      ? {
          concessionId: account.concessionId ?? "PAR-ETI-009",
          lga: "Eti-Osa (Lekki / Ajah)",
          statutoryClause: s.wardProfile.statutoryClause,
          propertiesInWard: 6140,
          duidsInWard: 49200,
          monthlyBillingNgn: 31200000,
          weeklyEscrowGrossNgn: account.weeklyEscrowGrossNgn ?? 6150000,
          weeklyTonnesTls: 184.5,
          circularTonnes: 62.0,
          bankAccount: account.bankAccount ?? "Access Bank · 0114829901",
        }
      : {
          ...s.wardProfile,
          concessionId: account.concessionId ?? s.wardProfile.concessionId,
          lga: account.areas.join(' / '),
          weeklyEscrowGrossNgn: account.weeklyEscrowGrossNgn ?? s.wardProfile.weeklyEscrowGrossNgn,
          bankAccount: account.bankAccount ?? s.wardProfile.bankAccount,
        },
    tlsManifests: account.id === "coastal"
      ? [
          { id: 'WT-5101', facility: 'Simpson TLS (Lagoon Barge)', stream: 'Epe WTE (via TLS)', vehiclePlate: 'LND 221 KJA', grossKg: 25800, tareKg: 10600, netTonnes: 15.2, tailgateDwellOk: true, moisturePct: 26, bonusNgn: 0, status: 'Verified' },
          { id: 'WT-5104', facility: 'Jospong MRF · Lekki Hub', stream: 'Jospong MRF', vehiclePlate: 'KEKE-ETI-03', grossKg: 3850, tareKg: 950, netTonnes: 2.9, tailgateDwellOk: true, moisturePct: 16, bonusNgn: 12180, status: 'Verified' },
        ]
      : s.tlsManifests,
    profile: { ...s.profile, name: account.name, areas: account.areas.join(' · '), contact: account.contact } };
};
const PARTNER_SHARE = 0.8;
const stamp = () => new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
const id = (prefix: string) => `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
const limit = <T,>(items: T[], item: T, max = 30) => [item, ...items].slice(0, max);

type Store = {
  model: Model; ready: boolean; customerById: (id: string) => Customer | undefined;
  acceptRequest: (pickupId: string, crewId: string, window: string) => void; declineRequest: (pickupId: string, reason: string) => void;
  approveBinRequest: (binRequestId: string) => void; declineBinRequest: (binRequestId: string, reason: string) => void;
  completeStop: (stopId: string) => void; setPickupStatus: (pickupId: string, status: 'Collected' | 'Completed' | 'Cancelled', note?: string) => void; assignCrew: (pickupId: string, crewId: string) => void; remitToLawma: () => Settlement;
  sendMessageToCustomer: (customerId: string, text: string, attachment?: Attachment) => void; sendMessageToLawma: (text: string, attachment?: Attachment) => void;
  addCustomer: (input: NewCustomer) => Customer;
  resolveIssue: (customerId: string, issueId: string, reply: string) => void; updateProfile: (patch: Partial<PartnerProfile>) => void; reset: () => void;
  escalateDefaultingDuids: (customerId: string) => number;
  cureHold: (cureId: string, method: string, note: string) => void;
  requestHotSwap: (crewId: string, standbyPlate: string, reason: string) => void;
  submitGateLockedProof: (pickupId: string, note: string) => void;
  triggerFridayEscrow: () => Settlement;
  issueEmergencyFuelBarcode: (amountNgn: number, batchRef: string) => FuelBarcode;
};

const StoreContext = createContext<Store | null>(null);
export function StoreProvider({ children, account }: { children: React.ReactNode; account: PartnerAccount }) {
  const seed = () => seedFor(account);
  const storageKey = `${key}-${account.id}`;
  const [model, setModel] = useState<Model>(seed);
  const [ready, setReady] = useState(false);
  useEffect(() => { AsyncStorage.getItem(storageKey).then(raw => { if (raw) { try { setModel({ ...seed(), ...(JSON.parse(raw) as Model) }); } catch { /* keep fresh demo */ } } }).catch(() => undefined).finally(() => setReady(true)); }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(storageKey, JSON.stringify(model)).catch(() => undefined); }, [model, ready]);
  useEffect(() => {
    if (!ready || !model.binDeliveryUntil) return;
    const deadline = model.binDeliveryUntil;
    const timer = setTimeout(() => setModel(s => s.binDeliveryUntil !== deadline ? s : ({ ...s, binDeliveryUntil: 0,
      customers: s.customers.map(c => c.bins.some(b => b.state === 'Out for delivery') ? { ...c, bins: c.bins.map(b => b.state === 'Out for delivery' ? { ...b, state: 'Active' as const } : b), notices: limit(c.notices, 'Your new smart bin was delivered and is now active.') } : c),
      activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: 'Approved bin delivery completed · device now active.' }) })), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [ready, model.binDeliveryUntil]);
  useEffect(() => {
    if (!ready || !model.lawmaAckAt) return;
    const deadline = model.lawmaAckAt;
    const timer = setTimeout(() => setModel(s => s.lawmaAckAt !== deadline ? s : ({ ...s, lawmaAckAt: 0, lawmaThread: [...s.lawmaThread, { id: id('LMSG'), role: 'assistant' as const, text: 'Received. The revenue team will confirm your settlement.', time: stamp() }].slice(-50) })), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [ready, model.lawmaAckAt]);
  const store = useMemo<Store>(() => ({
    model, ready,
    customerById(cid) { return model.customers.find(c => c.id === cid); },
    acceptRequest(pickupId, crewId, window) {
      setModel(s => {
        let customerId = ''; let amount = 0;
        const customers = s.customers.map(c => {
          const idx = c.pickups.findIndex(p => p.id === pickupId);
          if (idx === -1 || c.pickups[idx]!.status !== 'Requested') return c;
          customerId = c.id; amount = c.pickups[idx]!.amount;
          return { ...c, pickups: c.pickups.map((p, i) => i === idx ? { ...p, status: 'Scheduled' as const, window, crew: crewId, history: [...(p.history ?? []), { status: 'Scheduled', time: stamp(), note: `Accepted · ${s.crews.find(cr => cr.id === crewId)?.name ?? crewId} · ${window}` }] } : p), reserved: Math.max(0, c.reserved - amount),
            entries: limit(c.entries, { id: id('PAY'), title: `Partner credited ${money(amount)} · ${pickupId}`, amount: 0, time: stamp(), kind: 'paid' as const }),
            notices: limit(c.notices, `${pickupId} accepted and scheduled for ${window}. The reserved amount was marked paid to the partner.`) };
        });
        if (!customerId) return s;
        const crew = s.crews.find(c => c.id === crewId);
        const customer = customers.find(c => c.id === customerId);
        return { ...s, customers,
          routeStops: customer ? [...s.routeStops, { id: id('STOP'), crewId, customerId, pickupId, address: `${customer.address}, ${customer.area}`, window, done: false }] : s.routeStops,
          activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `${pickupId} accepted for ${customer?.name ?? 'customer'} · ${crew?.name ?? crewId} · ${window}.`, customerId }) };
      });
    },
    declineRequest(pickupId, reason) {
      setModel(s => {
        let customerId = '';
        const customers = s.customers.map(c => {
          const idx = c.pickups.findIndex(p => p.id === pickupId);
          if (idx === -1 || c.pickups[idx]!.status !== 'Requested') return c;
          customerId = c.id;
          const amount = c.pickups[idx]!.amount;
          return { ...c, pickups: c.pickups.map((p, i) => i === idx ? { ...p, status: 'Declined' as const, history: [...(p.history ?? []), { status: 'Declined', time: stamp(), note: reason }] } : p), reserved: Math.max(0, c.reserved - amount), balance: c.balance + amount,
            entries: limit(c.entries, { id: id('REL'), title: `Reservation released · ${pickupId}`, amount, time: stamp(), kind: 'released' as const }),
            notices: limit(c.notices, `Pickup ${pickupId} was declined: ${reason}. Your reservation was returned.`) };
        });
        if (!customerId) return s;
        const customer = customers.find(c => c.id === customerId);
        return { ...s, customers, activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `${pickupId} declined for ${customer?.name ?? 'customer'}: ${reason}.`, customerId }) };
      });
    },
    approveBinRequest(binRequestId) {
      setModel(s => {
        const req = s.binRequests.find(b => b.id === binRequestId);
        if (!req || req.status !== 'Pending') return s;
        const customers = s.customers.map(c => c.id === req.customerId ? { ...c, bins: [...c.bins, { id: id('BIN'), size: req.size, state: 'Out for delivery' as const }], notices: limit(c.notices, `Your ${req.kind === 'new' ? 'new' : 'additional'} ${req.size} L bin is approved and delivery is scheduled.`) } : c);
        const customer = customers.find(c => c.id === req.customerId);
        return { ...s, customers, binDeliveryUntil: Date.now() + 3000,
          binRequests: s.binRequests.map(b => b.id === binRequestId ? { ...b, status: 'Approved' as const } : b),
          activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `Bin request approved for ${customer?.name ?? 'customer'} · delivery scheduled.`, customerId: req.customerId }) };
      });
    },
    declineBinRequest(binRequestId, reason) {
      setModel(s => {
        const req = s.binRequests.find(b => b.id === binRequestId);
        if (!req || req.status !== 'Pending') return s;
        return { ...s,
          binRequests: s.binRequests.map(b => b.id === binRequestId ? { ...b, status: 'Declined' as const } : b),
          customers: s.customers.map(c => c.id === req.customerId ? { ...c, notices: limit(c.notices, `Bin request declined: ${reason}.`) } : c),
          activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `Bin request declined: ${reason}.`, customerId: req.customerId }) };
      });
    },
    completeStop(stopId) {
      setModel(s => {
        const stop = s.routeStops.find(r => r.id === stopId);
        if (!stop || stop.done) return s;
        let captured = 0;
        const customers = s.customers.map(c => {
          if (c.id !== stop.customerId) return c;
          const idx = c.pickups.findIndex(p => p.id === stop.pickupId);
          if (idx === -1) return c;
          captured = c.pickups[idx]!.amount;
          return { ...c, pickups: c.pickups.map((p, i) => i === idx ? { ...p, status: 'Completed' as const, evidence: 'CREW-EVIDENCE-01 · collection evidence recorded', history: [...(p.history ?? []), { status: 'Completed', time: stamp(), note: 'Stop completed · earnings captured' }] } : p),
            entries: limit(c.entries, { id: id('ENT'), title: `Pickup completed · ${stop.pickupId}`, amount: 0, time: stamp(), kind: 'paid' as const }),
            notices: limit(c.notices, `Pickup ${stop.pickupId} completed by ${s.crews.find(cr => cr.id === stop.crewId)?.name ?? 'crew'}.`) };
        });
        const customer = customers.find(c => c.id === stop.customerId);
        return { ...s, customers, routeStops: s.routeStops.map(r => r.id === stopId ? { ...r, done: true } : r), earningsUncaptured: s.earningsUncaptured + captured,
          activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `Stop completed for ${customer?.name ?? 'customer'} · ${money(captured)} captured to earnings.`, customerId: stop.customerId }) };
      });
    },
    setPickupStatus(pickupId, status, note) {
      const stop = model.routeStops.find(r => r.pickupId === pickupId && !r.done);
      if (status === 'Completed' && stop) { store.completeStop(stop.id); return; }
      setModel(s => {
        let customerId = ''; let captured = 0; let refund = 0;
        const customers = s.customers.map(c => {
          const idx = c.pickups.findIndex(p => p.id === pickupId);
          if (idx === -1) return c;
          const p = c.pickups[idx]!;
          const ok = (status === 'Collected' && p.status === 'Scheduled') || (status === 'Completed' && (p.status === 'Collected' || p.status === 'Scheduled')) || (status === 'Cancelled' && (p.status === 'Scheduled' || p.status === 'Collected'));
          if (!ok) return c;
          customerId = c.id;
          if (status === 'Completed') captured = p.amount;
          if (status === 'Cancelled') refund = p.amount;
          return { ...c, balance: c.balance + refund,
            pickups: c.pickups.map((x, i) => i === idx ? { ...x, status, history: [...(x.history ?? []), { status, time: stamp(), note }] } : x),
            notices: limit(c.notices, `Pickup ${pickupId} is now ${status.toLowerCase()}.`) };
        });
        if (!customerId) return s;
        const name = customers.find(c => c.id === customerId)?.name ?? 'customer';
        return { ...s, customers, earningsUncaptured: s.earningsUncaptured + captured,
          routeStops: status === 'Cancelled' ? s.routeStops.filter(r => r.pickupId !== pickupId || r.done) : s.routeStops.map(r => r.pickupId === pickupId && status === 'Completed' ? { ...r, done: true } : r),
          activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `${pickupId} for ${name} marked ${status.toLowerCase()}${note ? `: ${note}` : ''}.`, customerId }) };
      });
    },
    assignCrew(pickupId, crewId) {
      setModel(s => {
        const crew = s.crews.find(c => c.id === crewId);
        let customerId = '';
        const customers = s.customers.map(c => c.pickups.some(p => p.id === pickupId) ? (customerId = c.id, { ...c, pickups: c.pickups.map(p => p.id === pickupId ? { ...p, crew: crewId, history: [...(p.history ?? []), { status: p.status, time: stamp(), note: `Assigned to ${crew?.name ?? crewId}` }] } : p) }) : c);
        return { ...s, customers, routeStops: s.routeStops.map(r => r.pickupId === pickupId ? { ...r, crewId } : r),
          activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `${pickupId} reassigned to ${crew?.name ?? crewId}.`, customerId }) };
      });
    },
    remitToLawma() {
      const amount = model.earningsUncaptured;
      const authorityShare = Math.round(amount * (1 - PARTNER_SHARE));
      const settlement: Settlement = { ref: id('SET'), date: stamp(), amount, partnerShare: amount - authorityShare, authorityShare };
      setModel(s => ({ ...s, earningsUncaptured: 0, settlements: [settlement, ...s.settlements], activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `Remitted ${money(amount)} to LAWMA · ref ${settlement.ref}.` }) }));
      return settlement;
    },
    sendMessageToCustomer(customerId, text, attachment) { setModel(s => ({ ...s, customers: s.customers.map(c => c.id === customerId ? { ...c, supportMessages: [...c.supportMessages, { id: id('MSG'), role: 'assistant' as const, text, time: stamp(), ...(attachment ? { attachment } : {}) }].slice(-50) } : c) })); },
    addCustomer(input) {
      const slug = input.name.trim().split(/\s+/)[0]!.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'NEW';
      const cid = `CUS-${String(Math.floor(Math.random() * 900) + 100)}-${slug}`;
      const customer: Customer = { id: cid, name: input.name.trim(), address: input.address.trim(), area: input.area, phone: input.phone.trim(), status: 'Active', bins: [], balance: 0, reserved: 0, pickups: [], entries: [], issues: [], notices: ['Welcome to LAWMA 360. Your waste partner has registered your account.'], supportMessages: [], ...(input.propertyClass ? { propertyClass: input.propertyClass } : {}) };
      setModel(s => ({ ...s, customers: [customer, ...s.customers],
        binRequests: input.binSize ? [{ id: id('BINREQ'), customerId: cid, kind: 'new' as const, size: input.binSize, status: 'Pending' as const, time: stamp() }, ...s.binRequests] : s.binRequests,
        activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `Onboarded ${customer.name} · ${customer.area}${input.binSize ? ` · ${input.binSize}L bin requested` : ''}.`, customerId: cid }) }));
      return customer;
    },
    sendMessageToLawma(text, attachment) { setModel(s => ({ ...s, lawmaAckAt: Date.now() + 2000, lawmaThread: [...s.lawmaThread, { id: id('LMSG'), role: 'customer' as const, text, time: stamp(), ...(attachment ? { attachment } : {}) }].slice(-50) })); },
    resolveIssue(customerId, issueId, reply) { setModel(s => ({ ...s, customers: s.customers.map(c => c.id === customerId ? { ...c, status: 'Active' as const, issues: c.issues.map(i => i.id === issueId ? { ...i, status: 'Resolved' as const, reply } : i), notices: limit(c.notices, `${issueId} resolved: ${reply}`) } : c) })); },
    updateProfile(patch) { setModel(s => ({ ...s, profile: { ...s.profile, ...patch } })); },
    reset() { setModel(seed()); AsyncStorage.removeItem(storageKey).catch(() => undefined); },
    escalateDefaultingDuids(customerId) {
      let count = 0;
      setModel(s => ({
        ...s,
        customers: s.customers.map(c => {
          if (c.id !== customerId || !c.units) return c;
          const units = c.units.map(u => {
            if (!u.paid && !u.escalated) { count++; return { ...u, escalated: true }; }
            return u;
          });
          return { ...c, units };
        }),
        activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `Escalated defaulting DUIDs in ${customerId} to LAWMA Demand Bills; compliant flats retain service.`, customerId }),
      }));
      return count;
    },
    cureHold(cureId, method, note) {
      setModel(s => ({
        ...s,
        cureCases: s.cureCases.map(c => c.id === cureId ? { ...c, status: 'Cured · Released', method, note } : c),
        activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `48h cure evidence submitted for ${cureId} (${method}); held payout unlocked.` }),
      }));
    },
    requestHotSwap(crewId, standbyPlate, reason) {
      setModel(s => {
        const crew = s.crews.find(c => c.id === crewId);
        if (!crew) return s;
        const req: HotSwapRequest = { id: id('SWAP'), crewId, brokenPlate: crew.plate, standbyPlate, reason, status: 'Pending LAWMA Ops', requestedAt: stamp() };
        return {
          ...s,
          hotSwaps: [req, ...s.hotSwaps],
          activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `60-min breakdown hot-swap requested: ${crew.plate} -> ${standbyPlate} (${reason}).` }),
        };
      });
    },
    submitGateLockedProof(pickupId, note) {
      setModel(s => ({
        ...s,
        customers: s.customers.map(c => ({
          ...c,
          pickups: c.pickups.map(p => p.id === pickupId ? { ...p, gateLockedProof: note, history: [...(p.history ?? []), { status: 'Gate Locked Proof', time: stamp(), note }] } : p),
        })),
        activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `Geo-tagged GATE_LOCKED proof filed for ${pickupId} · Bucket B SLA protected.` }),
      }));
    },
    triggerFridayEscrow() {
      const heldNgn = model.cureCases.filter(c => c.status === 'Action required').reduce((n, c) => n + c.amountHeldNgn, 0);
      const amount = model.wardProfile.weeklyEscrowGrossNgn + model.earningsUncaptured;
      const authorityShare = Math.round(amount * (1 - PARTNER_SHARE));
      const partnerShare = Math.max(0, amount - authorityShare - heldNgn);
      const settlement: Settlement = { ref: id('SET-NIP'), date: stamp(), amount, partnerShare, authorityShare };
      setModel(s => ({
        ...s,
        earningsUncaptured: 0,
        wardProfile: { ...s.wardProfile, weeklyEscrowGrossNgn: 0 },
        settlements: [settlement, ...s.settlements],
        activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `Friday 5 PM Escrow disbursed ${money(partnerShare)} (80% PSP share) via NIBSS NIP · ref ${settlement.ref}.` }),
      }));
      return settlement;
    },
    issueEmergencyFuelBarcode(amountNgn, batchRef) {
      const bc: FuelBarcode = { id: id('FUEL-BC'), batchRef, networks: 'NNPC Retail · TotalEnergies · Ardova Plc', amountNgn, validHours: 72, issuedAt: stamp(), status: 'Active · Redeemable' };
      setModel(s => ({
        ...s,
        fuelBarcodes: [bc, ...s.fuelBarcodes],
        activity: limit(s.activity, { id: id('ACT'), time: stamp(), text: `72h emergency fuel barcode ${bc.id} (${money(amountNgn)}) issued for ${batchRef}.` }),
      }));
      return bc;
    },
  }), [model, ready]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() { const value = useContext(StoreContext); if (!value) throw new Error('StoreProvider missing'); return value; }
export const money = (amount: number) => `₦${amount.toLocaleString('en-NG')}`;
