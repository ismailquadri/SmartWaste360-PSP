import type { Settlement } from "./store";

const naira = (n: number) => `NGN ${n.toLocaleString("en-NG")}`;

async function logoPng(): Promise<string | null> {
  try {
    const img = new Image();
    img.src = "/favicon.png";
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return c.toDataURL("image/png");
  } catch { return null; }
}

/** Builds a branded LAWMA 360 proof-of-remittance PDF. */
export async function buildRemittancePdf(s: Settlement, partner: { name: string; contact: string; areas: string }): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18;
  const heat: [number, number, number] = [232, 93, 32];
  const ink: [number, number, number] = [23, 23, 23];
  const grey: [number, number, number] = [115, 115, 115];
  const line: [number, number, number] = [229, 229, 229];

  doc.setFillColor(...heat); doc.rect(0, 0, W, 4, "F");
  const logo = await logoPng();
  if (logo) doc.addImage(logo, "PNG", M, 14, 14, 14);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...ink);
  doc.text("LAWMA 360", M + 18, 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...grey);
  doc.text("Lagos Waste Management Authority · Partner Escrow Clearinghouse", M + 18, 25.5);
  doc.setFont("courier", "normal"); doc.setFontSize(8);
  doc.text("ESCROW SETTLEMENT CERTIFICATE", W - M, 20, { align: "right" });
  doc.text(s.ref, W - M, 25.5, { align: "right" });

  doc.setDrawColor(...line); doc.line(M, 36, W - M, 36);

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...grey);
  doc.text("PSP 80% FRIDAY ESCROW PAYOUT", M, 48);
  doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.setTextColor(...ink);
  doc.text(naira(s.partnerShare), M, 60);
  doc.setFillColor(232, 245, 236); doc.roundedRect(W - M - 34, 52, 34, 9, 2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(34, 120, 70);
  doc.text("DISBURSED", W - M - 17, 57.8, { align: "center" });

  const bucketA = Math.round(s.partnerShare * 0.5);
  const bucketB = s.partnerShare - bucketA;
  const rows: [string, string][] = [
    ["Batch reference", s.ref],
    ["Settlement date", s.date],
    ["Accredited PSP (AWAMN)", partner.name],
    ["Statutory ward(s)", partner.areas],
    ["Partner contact", partner.contact],
    ["Gross ward collections in escrow", naira(s.amount)],
    ["PSP 80% share · Bucket A (50% Availability)", naira(bucketA)],
    ["PSP 80% share · Bucket B (50% Scans & TLS)", naira(bucketB)],
    ["LAWMA 20% regulatory & TLS subvention", naira(s.authorityShare)],
  ];
  let y = 78;
  doc.setFontSize(10);
  for (const [k, v] of rows) {
    doc.setDrawColor(...line); doc.line(M, y + 3.5, W - M, y + 3.5);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...grey); doc.text(k, M, y);
    doc.setFont("courier", "normal"); doc.setTextColor(...ink); doc.text(v, W - M, y, { align: "right" });
    y += 11;
  }

  y += 8;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...grey);
  doc.text(doc.splitTextToSize("This certificate confirms automated Friday 5:00 PM NIBSS Instant Payment (NIP) escrow disbursement to the accredited AWAMN PSP operator under the 80/20 Lagos State Waste Covenant (Section 71, EMPL 2017).", W - 2 * M), M, y);

  doc.setDrawColor(...line); doc.line(M, 280, W - M, 280);
  doc.setFont("courier", "normal"); doc.setFontSize(7.5);
  doc.text(`Generated ${new Date().toLocaleString("en-NG")}`, M, 286);
  doc.text("lawma.gov.ng", W - M, 286, { align: "right" });
  return doc.output("blob");
}

/** Builds a LAWMA-certified Bank of Industry (BOI) / Commercial Bank Compactor Loan Dossier PDF. */
export async function buildBoiDossierPdf(
  dossier: { annualVerifiedTonnes: number; annualEscrowInflowNgn: number; collectionEfficiencyPct: number; dscr: number; eligibleFacilityNgn: number; tenorMonths: number; interestRatePct: number },
  partner: { name: string; contact: string; areas: string; concessionId: string; bankAccount: string },
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18;
  const heat: [number, number, number] = [232, 93, 32];
  const ink: [number, number, number] = [23, 23, 23];
  const grey: [number, number, number] = [115, 115, 115];
  const line: [number, number, number] = [229, 229, 229];

  doc.setFillColor(...heat); doc.rect(0, 0, W, 4, "F");
  const logo = await logoPng();
  if (logo) doc.addImage(logo, "PNG", M, 14, 14, 14);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...ink);
  doc.text("LAWMA 360 · BANKABLE ASSET DOSSIER", M + 18, 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...grey);
  doc.text("Certified 12-Month Escrow & Tonnage Underwriting Statement (BOI / Sterling Bank)", M + 18, 25.5);

  doc.setDrawColor(...line); doc.line(M, 36, W - M, 36);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...grey);
  doc.text("PRE-QUALIFIED CNG / EURO-IV COMPACTOR LEASE LIMIT", M, 48);
  doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.setTextColor(...ink);
  doc.text(naira(dossier.eligibleFacilityNgn), M, 60);

  const rows: [string, string][] = [
    ["Accredited AWAMN Operator", partner.name],
    ["Statutory Concession ID", `${partner.concessionId} · ${partner.areas}`],
    ["Escrow Settlement Account", partner.bankAccount],
    ["12-Month Verified TLS Tonnage", `${dossier.annualVerifiedTonnes.toLocaleString("en-NG")} metric tonnes`],
    ["12-Month 80% Escrow Cash Inflow", naira(dossier.annualEscrowInflowNgn)],
    ["Verified Doorstep Collection Efficiency", `${dossier.collectionEfficiencyPct}%`],
    ["Debt Service Coverage Ratio (DSCR)", `${dossier.dscr}x (Bankable >= 1.50x)`],
    ["Recommended Facility Terms", `${dossier.tenorMonths} months @ ${dossier.interestRatePct}% p.a. (BOI Green Fleet)`],
  ];
  let y = 78;
  doc.setFontSize(10);
  for (const [k, v] of rows) {
    doc.setDrawColor(...line); doc.line(M, y + 3.5, W - M, y + 3.5);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...grey); doc.text(k, M, y);
    doc.setFont("courier", "normal"); doc.setTextColor(...ink); doc.text(v, W - M, y, { align: "right" });
    y += 11;
  }
  y += 8;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...grey);
  doc.text(doc.splitTextToSize("Certified from immutable LAWMA 360 TLS weighbridge tickets, OBD-II route telemetry, and NIBSS NIP Friday escrow clearinghouse ledgers. Valid for commercial bank and Bank of Industry equipment lease underwriting.", W - 2 * M), M, y);
  doc.setDrawColor(...line); doc.line(M, 280, W - M, 280);
  doc.setFont("courier", "normal"); doc.setFontSize(7.5);
  doc.text(`Generated ${new Date().toLocaleString("en-NG")}`, M, 286);
  doc.text("lawma.gov.ng · BOI-FIN-V1", W - M, 286, { align: "right" });
  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Generates the PDF first, then downloads (or opens the share sheet on phones). */
export async function deliverFile(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if ((e as DOMException).name === "AbortError") return; }
  }
  downloadBlob(blob, filename);
}
