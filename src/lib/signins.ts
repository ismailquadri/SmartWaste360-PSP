// Sign-in activity kept in the browser for the demo. Never stores passwords.
export type SignIn = {
  id: string;
  accountId: string;
  email: string;
  time: string; // ISO
  location: string;
  device: string;
  ip: string;
  result: "success" | "failed";
  source: "recorded" | "added";
};

const KEY = "lawma-signins-v2";
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();

const sample = (accountId: string, email: string): SignIn[] => [
  { id: `${accountId}-s1`, accountId, email, time: ago(60 * 32), location: "Alausa Secretariat, Ikeja, Lagos, NG", device: "Chrome · Windows (PSP Dispatch Desk)", ip: "102.89.34.12", result: "success", source: "recorded" },
  { id: `${accountId}-s2`, accountId, email, time: ago(60 * 18), location: "Oshodi TLS Weighbridge Terminal, Lagos, NG", device: "Edge · Rugged Tablet", ip: "102.89.38.44", result: "success", source: "recorded" },
  { id: `${accountId}-s3`, accountId, email, time: ago(60 * 9 + 14), location: "St. Petersburg, RU (TOR Exit Node)", device: "Headless Linux · Credential Stuffing Bot", ip: "185.220.101.7", result: "failed", source: "recorded" },
  { id: `${accountId}-s4`, accountId, email, time: ago(60 * 9 + 12), location: "St. Petersburg, RU (TOR Exit Node)", device: "Headless Linux · Credential Stuffing Bot", ip: "185.220.101.7", result: "failed", source: "recorded" },
  { id: `${accountId}-s5`, accountId, email, time: ago(60 * 9 + 10), location: "St. Petersburg, RU (TOR Exit Node)", device: "Headless Linux · Credential Stuffing Bot", ip: "185.220.101.7", result: "failed", source: "recorded" },
  { id: `${accountId}-s6`, accountId, email, time: ago(60 * 5 + 20), location: "Lekki Phase 1, Lagos, NG", device: "Safari · iPhone 15 Pro (MD Mobile)", ip: "102.89.40.3", result: "success", source: "recorded" },
  { id: `${accountId}-s7`, accountId, email, time: ago(60 * 2 + 35), location: "London, GB (Corporate Roaming VPN)", device: "Chrome · macOS", ip: "81.2.69.160", result: "success", source: "recorded" },
  { id: `${accountId}-s8`, accountId, email, time: ago(38), location: "Ikeja GRA, Lagos, NG", device: "Chrome · macOS (Finance Controller)", ip: "102.89.41.88", result: "success", source: "recorded" },
];

export function loadSignIns(accountId: string, email: string): SignIn[] {
  const all = readAll();
  if (!all.some((s) => s.accountId === accountId)) {
    const next = [...all, ...sample(accountId, email)];
    localStorage.setItem(KEY, JSON.stringify(next));
    return sortNewest(next.filter((s) => s.accountId === accountId));
  }
  return sortNewest(all.filter((s) => s.accountId === accountId));
}

export function addSignIn(entry: Omit<SignIn, "id">) {
  const all = readAll();
  const item = { ...entry, id: `si-${Math.random().toString(36).slice(2, 9)}` };
  localStorage.setItem(KEY, JSON.stringify([...all, item].slice(-200)));
  return item;
}

export function removeSignIn(id: string) {
  localStorage.setItem(KEY, JSON.stringify(readAll().filter((s) => s.id !== id)));
}

export function describeDevice() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} · ${os}`;
}

export function recordSignIn(accountId: string, email: string, result: SignIn["result"]) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  addSignIn({ accountId, email, time: new Date().toISOString(), location: `${tz} (this device)`, device: describeDevice(), ip: "not captured", result, source: "recorded" });
}

function readAll(): SignIn[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SignIn[];
  } catch {
    return [];
  }
}
const sortNewest = (l: SignIn[]) => [...l].sort((a, b) => (a.time < b.time ? 1 : -1));
