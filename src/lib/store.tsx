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
export type Customer = { id: string; name: string; address: string; area: 'Ajah' | 'Ikeja' | 'Lekki'; phone: string; status: 'Active' | 'Attention needed'; bins: Bin[]; balance: number; reserved: number; pickups: Pickup[]; entries: Entry[]; issues: Issue[]; notices: string[]; supportMessages: SupportMessage[]; propertyDuid?: string; propertyClass?: 'Multi-Tenant Compound' | 'Commercial Plaza' | 'Residential' | 'Healthcare & Medical' | 'Hospitality & Retail' | 'Industrial & Estate'; units?: CompoundUnit[] };
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
    // --- IKEJA (Mainland Clean Services · PAR-IKJ-002) ---
    { id: 'CUS-018-TUNDE', name: 'Tunde Bakare', address: '18 Olowu Street, Ikeja', area: 'Ikeja', phone: '0805 221 9087', status: 'Active', propertyDuid: 'PROP-IKJ-018', propertyClass: 'Residential',
      bins: [{ id: 'BIN-180018', size: 120, state: 'Active' }], balance: 4200, reserved: 1450,
      pickups: [
        { id: 'PU-180002', status: 'Requested', amount: 1450, created: seedStamp(55), window: 'Tomorrow, 8–11 am', partner: 'Mainland Clean Services', customerId: 'CUS-018-TUNDE' },
        { id: 'PU-180001', status: 'Completed', amount: 1450, created: seedStamp(10080), window: 'Last Tuesday, 8–11 am', partner: 'Mainland Clean Services', customerId: 'CUS-018-TUNDE', crew: 'CREW-02', evidence: 'RFID-IKJ-018 · geo-verified 09:14 WAT' }
      ],
      entries: [{ id: 'RSV-180002', title: 'Reserved for PU-180002', amount: -1450, time: seedStamp(55), kind: 'reserved' }, { id: 'TOP-180011', title: 'Wallet top-up · NIBSS Instant', amount: 5000, time: seedStamp(320), kind: 'credit' }],
      issues: [], notices: ['PU-180002 requested. ₦1,450 reserved in escrow.'],
      supportMessages: [{ id: 'MSG-180001', role: 'customer', text: 'Good morning, please ensure the Keke feeder checks the side gate on Olowu Street.', time: seedStamp(50) }, { id: 'MSG-180002', role: 'assistant', text: 'Noted Mr. Bakare — Keke Feeder 04 (Sule M.) has Olowu Street on tomorrow’s 8:30 am inner-lane sweep.', time: seedStamp(42) }] },

    { id: 'CUS-042-CHIOMA', name: 'Mainland Court Tenement (Chioma Eze)', address: '4 Mainland Court, Off Toyin St', area: 'Ikeja', phone: '0701 334 7721', status: 'Attention needed', propertyDuid: 'PROP-IKJ-042', propertyClass: 'Multi-Tenant Compound',
      bins: [{ id: 'BIN-1042', size: 240, state: 'Active' }, { id: 'BIN-1043', size: 240, state: 'Active' }], balance: 6000, reserved: 1500,
      units: [
        { duid: 'DUID-IKJ-042-01', unitLabel: 'Flat 1A (Ground)', occupant: 'Chioma Eze', monthlyTariff: 1500, paid: true, arrears: 0 },
        { duid: 'DUID-IKJ-042-02', unitLabel: 'Flat 1B (Ground)', occupant: 'Femi Adeola', monthlyTariff: 1500, paid: true, arrears: 0 },
        { duid: 'DUID-IKJ-042-03', unitLabel: 'Flat 2A (Upper)', occupant: 'Sadiq Bello', monthlyTariff: 1500, paid: false, arrears: 4500 },
        { duid: 'DUID-IKJ-042-04', unitLabel: 'Flat 2B (Upper)', occupant: 'Nkechi Okafor', monthlyTariff: 1500, paid: false, arrears: 3000 },
      ],
      pickups: [{ id: 'PU-104201', status: 'Scheduled', amount: 1500, created: seedStamp(300), window: 'Thursday, 1–4 pm', partner: 'Mainland Clean Services', customerId: 'CUS-042-CHIOMA', crew: 'CREW-02' }],
      entries: [{ id: 'RSV-104201', title: 'Reserved for PU-104201 (Compliant Flats 1A & 1B)', amount: -1500, time: seedStamp(300), kind: 'reserved' }],
      issues: [{ id: 'CASE-042001', type: 'Compound split-billing inquiry', detail: 'Flats 1A and 1B paid on time; please do not suspend our bin pickup because Flats 2A and 2B are in arrears.', status: 'Open', time: seedStamp(240) }],
      notices: ['Compound split-billing active: Flats 1A & 1B remain scheduled while defaulting DUIDs are isolated.'],
      supportMessages: [{ id: 'MSG-042001', role: 'customer', text: 'Flats 1A & 1B have paid our ₦1,500 tariff. Please confirm the truck will still empty our compound bins on Thursday.', time: seedStamp(235) }] },

    { id: 'CUS-150-EMEKA', name: 'Computer Village Digital Plaza (Emeka Nwosu)', address: '31 Otigba Street, Computer Village', area: 'Ikeja', phone: '0816 773 9902', status: 'Active', propertyDuid: 'PROP-IKJ-150', propertyClass: 'Commercial Plaza',
      bins: [{ id: 'BIN-150501', size: 240, state: 'Active' }, { id: 'BIN-150502', size: 240, state: 'Active' }, { id: 'BIN-150503', size: 240, state: 'Active' }], balance: 45000, reserved: 12500,
      units: [
        { duid: 'DUID-IKJ-150-A1', unitLabel: 'Ground Floor · 12 Electronics Suites', occupant: 'Otigba Traders Union A', monthlyTariff: 18000, paid: true, arrears: 0 },
        { duid: 'DUID-IKJ-150-B1', unitLabel: 'First Floor · 10 GSM Repair Hub', occupant: 'Otigba Traders Union B', monthlyTariff: 15000, paid: true, arrears: 0 },
        { duid: 'DUID-IKJ-150-C1', unitLabel: 'Mezzanine · Packaging & Carton Stall', occupant: 'Chukwuma Packaging', monthlyTariff: 12000, paid: true, arrears: 0 },
      ],
      pickups: [
        { id: 'PU-150801', status: 'Collected', amount: 12500, created: seedStamp(410), window: 'Today, 10 am–1 pm', partner: 'Mainland Clean Services', customerId: 'CUS-150-EMEKA', crew: 'CREW-02', evidence: 'RFID-150501 + Jospong MRF Dry E-Waste / Carton segregation verified' },
        { id: 'PU-150790', status: 'Completed', amount: 12500, created: seedStamp(4800), window: 'Monday, 10 am–1 pm', partner: 'Mainland Clean Services', customerId: 'CUS-150-EMEKA', crew: 'CREW-05', evidence: 'WT-4405 · 6.8t Jospong MRF dry carton & e-packaging' }
      ],
      entries: [{ id: 'RSV-150801', title: 'Reserved for Commercial Sweep PU-150801', amount: -12500, time: seedStamp(410), kind: 'reserved' }, { id: 'PAY-150790', title: 'Partner credited ₦12,500 · PU-150790', amount: 0, time: seedStamp(4750), kind: 'paid' }],
      issues: [], notices: ['Eligible for Jospong MRF dry carton & e-packaging segregation rebate.'],
      supportMessages: [{ id: 'MSG-150001', role: 'customer', text: 'We have 18 bales of clean cardboard and styrofoam ready at the Otigba loading bay for the MRF truck.', time: seedStamp(180) }, { id: 'MSG-150002', role: 'assistant', text: 'Crew Beta (LND 884 XQ) has scanned all 3 plaza bins and logged the dry recyclables for Jospong MRF.', time: seedStamp(140) }] },

    { id: 'CUS-164-LASUTH', name: 'BlueCross Diagnostics & Specialist Annex', address: '14 Oba Akinjobi Way, Ikeja GRA', area: 'Ikeja', phone: '0809 440 1122', status: 'Active', propertyDuid: 'PROP-IKJ-164', propertyClass: 'Healthcare & Medical',
      bins: [{ id: 'BIN-164001', size: 240, state: 'Active' }, { id: 'BIN-164002', size: 120, state: 'Active' }], balance: 28500, reserved: 8500,
      pickups: [{ id: 'PU-164101', status: 'Scheduled', amount: 8500, created: seedStamp(520), window: 'Today, 2–4 pm', partner: 'Mainland Clean Services', customerId: 'CUS-164-LASUTH', crew: 'CREW-05', gateLockedProof: 'Verified non-infectious municipal stream only; sharps & red-bag biohazard routed to LAWMA Medical Autoclave.' }],
      entries: [{ id: 'RSV-164101', title: 'Reserved for PU-164101 (Municipal Canteen & Admin Stream)', amount: -8500, time: seedStamp(520), kind: 'reserved' }],
      issues: [], notices: ['Strict segregation enforced: Red-bag biohazard excluded from PSP compactor; municipal admin waste cleared.'],
      supportMessages: [{ id: 'MSG-164001', role: 'customer', text: 'Our facility manager signed the non-hazardous clearance manifest for the two grey 240L bins at Gate B.', time: seedStamp(310) }] },

    { id: 'CUS-172-ALLEN', name: 'Opebi – Allen Restaurant & Lounge Strip', address: '68 Allen Avenue, Ikeja', area: 'Ikeja', phone: '0802 998 3314', status: 'Attention needed', propertyDuid: 'PROP-IKJ-172', propertyClass: 'Hospitality & Retail',
      bins: [{ id: 'BIN-172001', size: 240, state: 'Active' }, { id: 'BIN-172002', size: 240, state: 'Active' }], balance: 19400, reserved: 6500,
      pickups: [
        { id: 'PU-172201', status: 'Requested', amount: 6500, created: seedStamp(25), window: 'Friday, 6–9 am (Night-soil & organic)', partner: 'Mainland Clean Services', customerId: 'CUS-172-ALLEN' },
        { id: 'PU-172199', status: 'Scheduled', amount: 6500, created: seedStamp(720), window: 'Today, 11 am–2 pm', partner: 'Mainland Clean Services', customerId: 'CUS-172-ALLEN', crew: 'CREW-04', gateLockedProof: 'GATE_LOCKED at 07:40 WAT (GPS 6.6018°N, 3.3515°E) · Security guard asleep; photo logged, Keke recovery scheduled.' }
      ],
      entries: [{ id: 'RSV-172201', title: 'Reserved for Organic Biodigester Pickup PU-172201', amount: -6500, time: seedStamp(25), kind: 'reserved' }],
      issues: [{ id: 'CASE-172001', type: 'Gate locked at 07:40 WAT', detail: 'Crew arrived at 07:40 WAT; roller shutter was padlocked. Timestamped GATE_LOCKED photo uploaded to protect PSP Bucket B SLA.', status: 'In review', time: seedStamp(190) }],
      notices: ['GATE_LOCKED proof verified: No SLA penalty deducted; afternoon Keke recovery dispatched.'],
      supportMessages: [{ id: 'MSG-172001', role: 'customer', text: 'Sorry our night guard locked the back alley before 8 am. The gate is open now for the organic food-waste bins.', time: seedStamp(175) }] },

    { id: 'CUS-188-ALAUSA', name: 'Harmony Enclave Tenement (10 Flats)', address: '19 Seriki Aro Avenue, Ikeja', area: 'Ikeja', phone: '0706 112 8840', status: 'Active', propertyDuid: 'PROP-IKJ-188', propertyClass: 'Multi-Tenant Compound',
      bins: [{ id: 'BIN-188001', size: 240, state: 'Active' }, { id: 'BIN-188002', size: 240, state: 'Active' }], balance: 14500, reserved: 0,
      units: [
        { duid: 'DUID-IKJ-188-01', unitLabel: 'Flat 1 (Ground Front)', occupant: 'Alhaji Lateef Sanni', monthlyTariff: 1500, paid: true, arrears: 0 },
        { duid: 'DUID-IKJ-188-02', unitLabel: 'Flat 2 (Ground Rear)', occupant: 'Mrs. Funke Akinde', monthlyTariff: 1500, paid: true, arrears: 0 },
        { duid: 'DUID-IKJ-188-03', unitLabel: 'Flat 3 (1st Floor)', occupant: 'Segun Ojo', monthlyTariff: 1500, paid: true, arrears: 0 },
        { duid: 'DUID-IKJ-188-04', unitLabel: 'Flat 4 (1st Floor)', occupant: 'Blessing Nwachukwu', monthlyTariff: 1500, paid: true, arrears: 0 },
        { duid: 'DUID-IKJ-188-05', unitLabel: 'Flat 5 (2nd Floor)', occupant: 'Damilola Peters', monthlyTariff: 1500, paid: false, arrears: 6000, escalated: true },
        { duid: 'DUID-IKJ-188-06', unitLabel: 'Flat 6 (Boys Quarters)', occupant: 'Uche Eze', monthlyTariff: 1200, paid: true, arrears: 0 },
      ],
      pickups: [{ id: 'PU-188301', status: 'Completed', amount: 7200, created: seedStamp(2400), window: 'Tuesday, 9 am–noon', partner: 'Mainland Clean Services', customerId: 'CUS-188-ALAUSA', crew: 'CREW-06', evidence: 'RFID-188001 · 5/6 DUIDs compliant; Flat 5 isolated on LAWMA Demand Bill' }],
      entries: [{ id: 'PAY-188301', title: 'Partner credited ₦7,200 · PU-188301', amount: 0, time: seedStamp(2380), kind: 'paid' }],
      issues: [], notices: ['5 of 6 DUIDs paid (83%). Defaulting Flat 5 escalated to statutory Demand Bill.'],
      supportMessages: [] },

    { id: 'CUS-195-OGBA', name: 'Ogba Industrial Metal & Beverage Depot', address: 'Plot 8 Acme Road, Ogba Industrial, Ikeja', area: 'Ikeja', phone: '0803 774 5501', status: 'Active', propertyDuid: 'PROP-IKJ-195', propertyClass: 'Industrial & Estate',
      bins: [{ id: 'BIN-195001', size: 240, state: 'Active' }, { id: 'BIN-195002', size: 240, state: 'Active' }, { id: 'BIN-195003', size: 240, state: 'Out for delivery' }], balance: 68000, reserved: 18500,
      pickups: [
        { id: 'PU-195401', status: 'Requested', amount: 18500, created: seedStamp(18), window: 'Saturday, 7–10 am (Heavy Compactor)', partner: 'Mainland Clean Services', customerId: 'CUS-195-OGBA' },
        { id: 'PU-195390', status: 'Completed', amount: 18500, created: seedStamp(6400), window: 'Last Saturday, 7–10 am', partner: 'Mainland Clean Services', customerId: 'CUS-195-OGBA', crew: 'CREW-05', evidence: 'WT-4402 · Oshodi TLS 14.2t net' }
      ],
      entries: [{ id: 'RSV-195401', title: 'Reserved for Industrial Sweep PU-195401', amount: -18500, time: seedStamp(18), kind: 'reserved' }],
      issues: [], notices: ['Additional 240L smart bin allocated for PET & aluminum cullet stream.'],
      supportMessages: [{ id: 'MSG-195001', role: 'customer', text: 'We requested a third 240L RFID bin for our Shrink-Wrap & PET line on Acme Road.', time: seedStamp(85) }] },

    // --- LEKKI & AJAH (Coastal Green PSP · PAR-ETI-009) ---
    { id: 'CUS-071-ADA', name: 'Ada Okafor', address: '71 Ajah Gardens, Abraham Adesanya', area: 'Ajah', phone: '0803 555 0171', status: 'Active', propertyDuid: 'PROP-AJH-071', propertyClass: 'Residential',
      bins: [{ id: 'BIN-710071', size: 240, state: 'Active' }], balance: 5400, reserved: 1500,
      pickups: [
        { id: 'PU-710001', status: 'Requested', amount: 1500, created: seedStamp(40), window: 'Friday, 9 am–noon', partner: 'Coastal Green PSP', customerId: 'CUS-071-ADA' },
        { id: 'PU-710000', status: 'Completed', amount: 1500, created: seedStamp(9800), window: 'Last Friday, 9 am–noon', partner: 'Coastal Green PSP', customerId: 'CUS-071-ADA', crew: 'CREW-01', evidence: 'RFID-710071 · geo-verified' }
      ],
      entries: [{ id: 'RSV-710001', title: 'Reserved for PU-710001', amount: -1500, time: seedStamp(40), kind: 'reserved' }, { id: 'TOP-710001', title: 'Wallet top-up · Card', amount: 5000, time: seedStamp(120), kind: 'credit' }],
      issues: [], notices: ['PU-710001 requested. ₦1,500 is reserved until partner acceptance or decline.'],
      supportMessages: [{ id: 'MSG-710001', role: 'customer', text: 'Hi, can my Friday pickup come before noon? I have an appointment.', time: seedStamp(35) }, { id: 'MSG-710002', role: 'assistant', text: 'Hello Ada! Yes, Keke Feeder 03 will clear Ajah Gardens between 9:15 and 10:30 am.', time: seedStamp(22) }] },

    { id: 'CUS-200-FOLA', name: 'Admiralty Pearl Estate HOA (Folasade Adigun)', address: '12 Marwa Close, Lekki Phase 1', area: 'Lekki', phone: '0902 441 2290', status: 'Active', propertyDuid: 'PROP-LEK-200', propertyClass: 'Industrial & Estate',
      bins: [{ id: 'BIN-200201', size: 240, state: 'Active' }, { id: 'BIN-200202', size: 240, state: 'Active' }, { id: 'BIN-200203', size: 240, state: 'Active' }], balance: 84000, reserved: 15000,
      units: [
        { duid: 'DUID-LEK-200-01', unitLabel: 'Block A · 6 Terraces', occupant: 'Folasade Adigun (HOA Chair)', monthlyTariff: 18000, paid: true, arrears: 0 },
        { duid: 'DUID-LEK-200-02', unitLabel: 'Block B · 6 Terraces', occupant: 'Engr. Dapo Williams', monthlyTariff: 18000, paid: true, arrears: 0 },
        { duid: 'DUID-LEK-200-03', unitLabel: 'Block C · 4 Detached', occupant: 'Dr. Zainab Bello', monthlyTariff: 16000, paid: true, arrears: 0 },
      ],
      pickups: [
        { id: 'PU-200102', status: 'Collected', amount: 15000, created: seedStamp(340), window: 'Today, 8–11 am', partner: 'Coastal Green PSP', customerId: 'CUS-200-FOLA', crew: 'CREW-01', evidence: 'RFID-200201..203 scanned · En route to Simpson TLS' },
        { id: 'PU-200101', status: 'Completed', amount: 15000, created: seedStamp(2800), window: 'Monday, 9 am–noon', partner: 'Coastal Green PSP', customerId: 'CUS-200-FOLA', crew: 'CREW-01', evidence: 'WT-5101 · Simpson TLS 15.2t net' }
      ],
      entries: [{ id: 'RSV-200102', title: 'Reserved for Estate Sweep PU-200102', amount: -15000, time: seedStamp(340), kind: 'reserved' }, { id: 'PAY-200101', title: 'Partner credited ₦15,000 · PU-200101', amount: 0, time: seedStamp(2790), kind: 'paid' }],
      issues: [], notices: ['100% HOA DUID compliance · Green-Channel priority dispatch active.'],
      supportMessages: [{ id: 'MSG-200001', role: 'customer', text: 'All 16 households in Admiralty Pearl have separated our PET bottles and cans into the orange-lid bins.', time: seedStamp(290) }] },

    { id: 'CUS-210-KUNLE', name: 'Chevron Atlantic View Compound (Kunle Oyelaran)', address: '5B Chevron Drive, Lekki', area: 'Lekki', phone: '0813 667 4420', status: 'Attention needed', propertyDuid: 'PROP-LEK-210', propertyClass: 'Multi-Tenant Compound',
      bins: [{ id: 'BIN-210301', size: 240, state: 'Active' }, { id: 'BIN-210302', size: 120, state: 'Active' }], balance: 9600, reserved: 0,
      units: [
        { duid: 'DUID-LEK-210-01', unitLabel: 'Maisonette 1', occupant: 'Kunle Oyelaran', monthlyTariff: 2500, paid: true, arrears: 0 },
        { duid: 'DUID-LEK-210-02', unitLabel: 'Maisonette 2', occupant: 'Chidinma Okafor', monthlyTariff: 2500, paid: true, arrears: 0 },
        { duid: 'DUID-LEK-210-03', unitLabel: 'Maisonette 3', occupant: 'Osaze Ighodaro', monthlyTariff: 2500, paid: false, arrears: 7500 },
        { duid: 'DUID-LEK-210-04', unitLabel: 'Penthouse Suite', occupant: 'Tariq Danjuma', monthlyTariff: 3000, paid: false, arrears: 6000 },
      ],
      pickups: [{ id: 'PU-210301', status: 'Completed', amount: 5000, created: seedStamp(4200), window: 'Tuesday, 2–5 pm', partner: 'Coastal Green PSP', customerId: 'CUS-210-KUNLE', crew: 'CREW-03', evidence: 'CREW-EVIDENCE-01 · Keke Feeder 03 inner-lane handoff to CREW-01' }],
      entries: [{ id: 'PAY-210301', title: 'Partner credited ₦5,000 · PU-210301', amount: 0, time: seedStamp(4190), kind: 'paid' }],
      issues: [{ id: 'CASE-210001', type: 'Defaulting tenant isolation request', detail: 'Maisonettes 1 & 2 are fully paid up; please escalate Maisonette 3 and Penthouse directly to LAWMA Revenue.', status: 'Open', time: seedStamp(400) }],
      notices: [],
      supportMessages: [{ id: 'MSG-210001', role: 'customer', text: 'Please isolate Maisonette 3 and the Penthouse on their individual DUIDs so our ground-floor bins keep getting serviced.', time: seedStamp(395) }] },

    { id: 'CUS-088-IBRAHIM', name: 'Ibrahim Suleiman', address: '9 Freedom Way, Ikate Elegushi', area: 'Lekki', phone: '0906 220 3341', status: 'Attention needed', propertyDuid: 'PROP-LEK-088', propertyClass: 'Residential',
      bins: [{ id: 'BIN-088401', size: 240, state: 'Active' }], balance: 3600, reserved: 1500,
      pickups: [{ id: 'PU-088401', status: 'Scheduled', amount: 1500, created: seedStamp(600), window: 'Wednesday, 10 am–1 pm', partner: 'Coastal Green PSP', customerId: 'CUS-088-IBRAHIM', crew: 'CREW-01' }],
      entries: [{ id: 'RSV-088401', title: 'Reserved for PU-088401', amount: -1500, time: seedStamp(600), kind: 'reserved' }],
      issues: [{ id: 'CASE-088001', type: 'Missed collection (48h Cure Active)', detail: 'Road paving blocked Freedom Way on Wednesday morning; Keke Feeder 03 dispatched for 48-hour statutory cure sweep.', status: 'Open', time: seedStamp(800) }],
      notices: ['48-hour statutory cure window active: Keke Feeder 03 assigned to clear Freedom Way inner lane.'],
      supportMessages: [{ id: 'MSG-088001', role: 'customer', text: 'The main compactor couldn’t enter Freedom Way because of the drainage culvert work. Can the Keke tricycle come in?', time: seedStamp(790) }, { id: 'MSG-088002', role: 'assistant', text: 'Yes Alhaji Ibrahim — Keke Feeder 03 (KEKE-ETI-03) has been dispatched to clear 9 Freedom Way within the 48h cure window.', time: seedStamp(610) }] },

    { id: 'CUS-065-NGOZI', name: 'Peace Estate Shopping Arcade (Ngozi Umeh)', address: '23 Peace Estate, Sangotedo, Ajah', area: 'Ajah', phone: '0708 552 6610', status: 'Active', propertyDuid: 'PROP-AJH-065', propertyClass: 'Commercial Plaza',
      bins: [{ id: 'BIN-065001', size: 240, state: 'Active' }], balance: 22800, reserved: 6800,
      pickups: [{ id: 'PU-065101', status: 'Requested', amount: 6800, created: seedStamp(75), window: 'Tomorrow, 9 am–noon', partner: 'Coastal Green PSP', customerId: 'CUS-065-NGOZI' }],
      entries: [{ id: 'RSV-065101', title: 'Reserved for Plaza Pickup PU-065101', amount: -6800, time: seedStamp(75), kind: 'reserved' }],
      issues: [], notices: ['Additional 240L smart bin request pending allocation.'],
      supportMessages: [] },

    { id: 'CUS-240-IKOTA', name: 'Ikota Seafood & Fresh Produce Market Annex', address: 'KM 19 Lekki–Epe Expressway, Ajah', area: 'Ajah', phone: '0807 311 4900', status: 'Active', propertyDuid: 'PROP-AJH-240', propertyClass: 'Hospitality & Retail',
      bins: [{ id: 'BIN-240001', size: 240, state: 'Active' }, { id: 'BIN-240002', size: 240, state: 'Active' }], balance: 39000, reserved: 11000,
      pickups: [{ id: 'PU-240501', status: 'Scheduled', amount: 11000, created: seedStamp(480), window: 'Today, 4–6 pm (Evening Market Sweep)', partner: 'Coastal Green PSP', customerId: 'CUS-240-IKOTA', crew: 'CREW-07' }],
      entries: [{ id: 'RSV-240501', title: 'Reserved for Wet Organic Biodigester Sweep PU-240501', amount: -11000, time: seedStamp(480), kind: 'reserved' }],
      issues: [], notices: ['Dedicated wet-organic stream routed to Epe / Ikosi Biodigester (+₦4,200/t circular bonus).'],
      supportMessages: [{ id: 'MSG-240001', role: 'customer', text: 'Market closes at 4:30 pm today; 3.4 tonnes of sorted vegetable and fish offal ready for the biodigester compactor.', time: seedStamp(260) }] },
  ],
  crews: [
    // Coastal Green PSP (Lekki / Ajah)
    { id: 'CREW-01', name: 'Crew Alpha (20T Mother Compactor)', plate: 'LND 221 KJA', members: ['Bashir A.', 'Femi O.', 'Lukman S.'], tier: 'Compactor (20T)', rendezvousPoint: 'Lekki Phase 1 Gate Bay', standbyPlate: 'LND 905 KJA' },
    { id: 'CREW-03', name: 'Keke Feeder 03 (Ikate / Chevron Inner)', plate: 'KEKE-ETI-03', members: ['Grace I.', 'Musa D.'], tier: 'Feeder Tricycle (Keke)', rendezvousPoint: 'Chevron Node -> CREW-01' },
    { id: 'CREW-07', name: 'Crew Delta (20T Mother Compactor)', plate: 'EPE 419 XW', members: ['Yusuf K.', 'Dayo M.', 'Kelechi P.'], tier: 'Compactor (20T)', rendezvousPoint: 'Ajah Jubilee Bridge Bay', standbyPlate: 'LND 911 KJA' },
    { id: 'CREW-08', name: 'Keke Feeder 08 (Sangotedo / Badore Lanes)', plate: 'KEKE-AJH-08', members: ['Sadiq A.', 'Bolanle T.'], tier: 'Feeder Tricycle (Keke)', rendezvousPoint: 'Abraham Adesanya -> CREW-07' },
    // Mainland Clean Services (Ikeja)
    { id: 'CREW-02', name: 'Crew Beta (20T Mother Compactor)', plate: 'LND 884 XQ', members: ['Rasheed T.', 'Chidi N.', 'Biodun K.'], tier: 'Compactor (20T)', rendezvousPoint: 'Allen Junction Transfer Node', standbyPlate: 'LND 902 KJA' },
    { id: 'CREW-04', name: 'Keke Feeder 04 (Olowu / Toyin Inner Lanes)', plate: 'KEKE-IKJ-04', members: ['Sule M.', 'Tunde K.'], tier: 'Feeder Tricycle (Keke)', rendezvousPoint: 'Olowu Node -> CREW-02' },
    { id: 'CREW-05', name: 'Crew Gamma (20T Mother Compactor)', plate: 'IKJ 509 ZB', members: ['Babatunde A.', 'Emeka O.', 'Hassan I.'], tier: 'Compactor (20T)', rendezvousPoint: 'Ogba / Oba Akran Bay', standbyPlate: 'LND 908 KJA' },
    { id: 'CREW-06', name: 'Keke Feeder 06 (Computer Village Alleys)', plate: 'KEKE-IKJ-06', members: ['Adaeze N.', 'Taiwo O.'], tier: 'Feeder Tricycle (Keke)', rendezvousPoint: 'Otigba Node -> CREW-05' },
  ],
  routeStops: [
    // Ikeja stops
    { id: 'STOP-01', crewId: 'CREW-02', customerId: 'CUS-042-CHIOMA', pickupId: 'PU-104201', address: '4 Mainland Court, Off Toyin St, Ikeja', window: 'Thursday, 1–4 pm', done: false },
    { id: 'STOP-02', crewId: 'CREW-02', customerId: 'CUS-150-EMEKA', pickupId: 'PU-150801', address: '31 Otigba Street, Computer Village, Ikeja', window: 'Today, 10 am–1 pm', done: true },
    { id: 'STOP-03', crewId: 'CREW-05', customerId: 'CUS-164-LASUTH', pickupId: 'PU-164101', address: '14 Oba Akinjobi Way, Ikeja GRA', window: 'Today, 2–4 pm', done: false },
    { id: 'STOP-04', crewId: 'CREW-04', customerId: 'CUS-172-ALLEN', pickupId: 'PU-172199', address: '68 Allen Avenue, Ikeja (Keke Recovery)', window: 'Today, 11 am–2 pm', done: false },
    { id: 'STOP-05', crewId: 'CREW-06', customerId: 'CUS-188-ALAUSA', pickupId: 'PU-188301', address: '19 Seriki Aro Avenue, Ikeja', window: 'Tuesday, 9 am–noon', done: true },
    // Lekki / Ajah stops
    { id: 'STOP-06', crewId: 'CREW-01', customerId: 'CUS-088-IBRAHIM', pickupId: 'PU-088401', address: '9 Freedom Way, Ikate Elegushi, Lekki', window: 'Wednesday, 10 am–1 pm', done: false },
    { id: 'STOP-07', crewId: 'CREW-01', customerId: 'CUS-200-FOLA', pickupId: 'PU-200102', address: '12 Marwa Close, Lekki Phase 1', window: 'Today, 8–11 am', done: true },
    { id: 'STOP-08', crewId: 'CREW-03', customerId: 'CUS-210-KUNLE', pickupId: 'PU-210301', address: '5B Chevron Drive, Lekki', window: 'Tuesday, 2–5 pm', done: true },
    { id: 'STOP-09', crewId: 'CREW-07', customerId: 'CUS-240-IKOTA', pickupId: 'PU-240501', address: 'KM 19 Lekki–Epe Expressway, Ajah', window: 'Today, 4–6 pm', done: false },
  ],
  binRequests: [
    { id: 'BINREQ-01', customerId: 'CUS-065-NGOZI', kind: 'additional', size: 240, status: 'Pending', time: seedStamp(90) },
    { id: 'BINREQ-02', customerId: 'CUS-210-KUNLE', kind: 'new', size: 120, status: 'Pending', time: seedStamp(180) },
    { id: 'BINREQ-03', customerId: 'CUS-150-EMEKA', kind: 'additional', size: 240, status: 'Pending', time: seedStamp(65) },
    { id: 'BINREQ-04', customerId: 'CUS-164-LASUTH', kind: 'additional', size: 120, status: 'Pending', time: seedStamp(210) },
  ],
  settlements: [
    { ref: 'SET-2026-W45-NIP', date: seedStamp(4800), amount: 4820000, partnerShare: 3856000, authorityShare: 964000 },
    { ref: 'SET-2026-W44-NIP', date: seedStamp(14880), amount: 4690000, partnerShare: 3752000, authorityShare: 938000 },
    { ref: 'SET-2026-W43-NIP', date: seedStamp(24960), amount: 4510000, partnerShare: 3608000, authorityShare: 902000 },
    { ref: 'SET-2026-W42-NIP', date: seedStamp(35040), amount: 4740000, partnerShare: 3792000, authorityShare: 948000 },
  ],
  activity: [
    { id: 'ACT-01', time: seedStamp(18), text: 'Ogba Industrial Depot requested Saturday heavy compactor sweep PU-195401 · ₦18,500 reserved.', customerId: 'CUS-195-OGBA' },
    { id: 'ACT-02', time: seedStamp(25), text: 'Opebi–Allen Restaurant Strip requested Friday organic pickup PU-172201 · ₦6,500 reserved.', customerId: 'CUS-172-ALLEN' },
    { id: 'ACT-03', time: seedStamp(35), text: 'Ada Okafor sent a message about her Friday pickup window.', customerId: 'CUS-071-ADA' },
    { id: 'ACT-04', time: seedStamp(40), text: 'New pickup request PU-710001 from Ada Okafor · ₦1,500 reserved.', customerId: 'CUS-071-ADA' },
    { id: 'ACT-05', time: seedStamp(55), text: 'New pickup request PU-180002 from Tunde Bakare · ₦1,450 reserved.', customerId: 'CUS-018-TUNDE' },
    { id: 'ACT-06', time: seedStamp(65), text: 'Computer Village Digital Plaza requested an additional 240 L bin for e-packaging.', customerId: 'CUS-150-EMEKA' },
    { id: 'ACT-07', time: seedStamp(75), text: 'Peace Estate Shopping Arcade requested pickup PU-065101 · ₦6,800 reserved.', customerId: 'CUS-065-NGOZI' },
    { id: 'ACT-08', time: seedStamp(190), text: 'GATE_LOCKED geo-proof logged at 68 Allen Avenue (07:40 WAT) · Bucket B SLA protected.', customerId: 'CUS-172-ALLEN' },
    { id: 'ACT-09', time: seedStamp(2790), text: 'Oshodi TLS Weighbridge Ticket WT-4402 verified (14.2 t · 240s dwell).', customerId: 'CUS-195-OGBA' },
    { id: 'ACT-10', time: seedStamp(4190), text: 'Jospong MRF dry recyclables verified (6.8 t · +₦28,560 circular bonus).', customerId: 'CUS-150-EMEKA' },
  ],
  lawmaThread: [
    { id: 'LAWMA-01', role: 'assistant', text: 'Escrow Clearinghouse (NIBSS NIP): Friday 5:00 PM automated 80/20 settlement batch is queued. Bucket A (50% Ward Availability) is 100% verified.', time: seedStamp(1400) },
    { id: 'LAWMA-02', role: 'customer', text: 'We uploaded timestamped GATE_LOCKED proof for 68 Allen Avenue and dispatched Keke Feeder 04 for afternoon recovery.', time: seedStamp(950) },
    { id: 'LAWMA-03', role: 'assistant', text: 'Verified by LAWMA Service Assurance: GATE_LOCKED proof accepted. Zero Bucket B deduction applied; ₦40,740 circular MRF/Biodigester bonus credited.', time: seedStamp(820) },
    { id: 'LAWMA-04', role: 'assistant', text: 'Diesel FVA Notice: AGO retail index at ₦1,350/L (+42.1% above ₦950/L base). Haulage Equalization Fund (HEF) credit of ₦384,000 is attached to this week’s batch.', time: seedStamp(310) },
  ],
  earningsUncaptured: 38950,
  binDeliveryUntil: 0,
  lawmaAckAt: 0,
  profile: { name: 'Mainland Clean Services', areas: 'Ikeja · Ogba · Alausa · Opebi', contact: 'ops@mainlandclean.ng · 0700 000 1500', notifyRequests: true, notifyMessages: true, notifyRemittance: true },
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
    { id: 'WT-4414', facility: 'Oshodi TLS (40T Transfer)', stream: 'Epe WTE (via TLS)', vehiclePlate: 'IKJ 509 ZB', grossKg: 26100, tareKg: 10500, netTonnes: 15.6, tailgateDwellOk: true, moisturePct: 31, bonusNgn: 0, status: 'Verified' },
    { id: 'WT-4418', facility: 'Jospong MRF · Ikeja Annex', stream: 'Jospong MRF', vehiclePlate: 'KEKE-IKJ-06', grossKg: 4150, tareKg: 950, netTonnes: 3.2, tailgateDwellOk: true, moisturePct: 14, bonusNgn: 13440, status: 'Verified' },
    { id: 'WT-4398', facility: 'Solous III Dumpsite · Bay 2', stream: 'Solous Residual', vehiclePlate: 'IKJ 509 ZB', grossKg: 22900, tareKg: 10500, netTonnes: 12.4, tailgateDwellOk: false, moisturePct: 44, bonusNgn: 0, status: 'Held · Calibration' },
  ],
  cureCases: [
    { id: 'CURE-01', pickupOrTicket: 'PU-088401 · 9 Freedom Way / Ward Lane', reason: 'Resident reported missed pickup due to road culvert work; 48h cure window open', amountHeldNgn: 85000, hoursRemaining: 31, status: 'Action required' },
    { id: 'CURE-02', pickupOrTicket: 'WT-4398 · Oshodi / Solous Bay 2', reason: 'Scale calibration drift >0.5% on Bay 2; 60% provisional advance eligible', amountHeldNgn: 60000, hoursRemaining: 19, status: 'Action required' },
    { id: 'CURE-03', pickupOrTicket: 'PU-172199 · 68 Allen Avenue', reason: 'Commercial roller-shutter locked at 07:40 WAT; GATE_LOCKED timestamped photo submitted', amountHeldNgn: 45000, hoursRemaining: 42, status: 'Cured · Released', method: 'Geo-tagged GATE_LOCKED Photo', note: 'Verified at 07:42 WAT · Keke recovery scheduled' },
  ],
  hotSwaps: [
    { id: 'SWAP-8801', crewId: 'CREW-05', brokenPlate: 'LND 410 KJA', standbyPlate: 'IKJ 509 ZB', reason: 'Hydraulic packing cylinder seal replacement at Ogba depot', status: 'Approved · Active', requestedAt: seedStamp(420) },
  ],
  fuelBarcodes: [
    { id: 'FUEL-BC-W45', batchRef: 'SET-2026-W45-NIP', networks: 'NNPC Retail · TotalEnergies · Ardova Plc', amountNgn: 840000, validHours: 72, issuedAt: seedStamp(1800), status: 'Active · Redeemable' },
    { id: 'FUEL-BC-W44', batchRef: 'SET-2026-W44-NIP', networks: 'NNPC Retail · TotalEnergies · Ardova Plc', amountNgn: 790000, validHours: 72, issuedAt: seedStamp(11800), status: 'Active · Redeemable' },
  ],
});

const key = 'smartwaste360-partner-v4';

export type PartnerAccount = { id: string; name: string; areas: Customer['area'][]; crews: string[]; contact: string; earnings: number; settlements: boolean; concessionId?: string; weeklyEscrowGrossNgn?: number; bankAccount?: string };
export const ACCOUNTS: PartnerAccount[] = [
  { id: 'mainland', name: 'Mainland Clean Services', areas: ['Ikeja'], crews: ['CREW-02', 'CREW-04', 'CREW-05', 'CREW-06'], contact: 'ops@mainlandclean.ng · 0700 000 1500', earnings: 38950, settlements: true, concessionId: 'PAR-IKJ-002', weeklyEscrowGrossNgn: 4820000, bankAccount: 'Sterling Bank · 0084921844' },
  { id: 'coastal', name: 'Coastal Green PSP', areas: ['Lekki', 'Ajah'], crews: ['CREW-01', 'CREW-03', 'CREW-07', 'CREW-08'], contact: 'desk@coastalgreen.ng · 0700 000 2600', earnings: 24300, settlements: true, concessionId: 'PAR-ETI-009', weeklyEscrowGrossNgn: 6150000, bankAccount: 'Access Bank · 0114829901' },
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
    settlements: account.id === "coastal"
      ? [
          { ref: 'SET-2026-W45-ETI', date: seedStamp(4800), amount: 6150000, partnerShare: 4920000, authorityShare: 1230000 },
          { ref: 'SET-2026-W44-ETI', date: seedStamp(14880), amount: 5980000, partnerShare: 4784000, authorityShare: 1196000 },
          { ref: 'SET-2026-W43-ETI', date: seedStamp(24960), amount: 5840000, partnerShare: 4672000, authorityShare: 1168000 },
        ]
      : s.settlements,
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
          { id: 'WT-5109', facility: 'Epe WTE & Engineered Landfill', stream: 'Epe WTE (via TLS)', vehiclePlate: 'EPE 419 XW', grossKg: 27400, tareKg: 10600, netTonnes: 16.8, tailgateDwellOk: true, moisturePct: 29, bonusNgn: 0, status: 'Verified' },
          { id: 'WT-5112', facility: 'Ikosi / Sangotedo Biodigester', stream: 'Ikosi Biodigester', vehiclePlate: 'KEKE-AJH-08', grossKg: 4350, tareKg: 950, netTonnes: 3.4, tailgateDwellOk: true, moisturePct: 64, bonusNgn: 14280, status: 'Verified' },
          { id: 'WT-5096', facility: 'Simpson TLS · Bay 1', stream: 'Epe WTE (via TLS)', vehiclePlate: 'LND 221 KJA', grossKg: 24100, tareKg: 10600, netTonnes: 13.5, tailgateDwellOk: false, moisturePct: 39, bonusNgn: 0, status: 'Held · Calibration' },
        ]
      : s.tlsManifests,
    hotSwaps: account.id === "coastal"
      ? [
          { id: 'SWAP-9104', crewId: 'CREW-01', brokenPlate: 'LND 118 ETI', standbyPlate: 'LND 221 KJA', reason: 'PTO pump pressure drop on Lekki–Epe corridor; hot-swapped in 38 mins', status: 'Approved · Active', requestedAt: seedStamp(510) },
        ]
      : s.hotSwaps,
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
