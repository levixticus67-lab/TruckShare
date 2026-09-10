import { createContext, type FormEvent, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeft, ArrowRight, BadgeCheck, Banknote, BarChart3, Bell, Box, CalendarDays,
  Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, ClipboardCheck, Clock3, FileCheck2,
  FilePlus2, FileText, Gauge, LayoutDashboard, LockKeyhole, MapPin, Menu, MessageSquare,
  PackageCheck, Phone, Plus, RefreshCw, Route as RouteIcon, Search, Send, ShieldCheck,
  Truck, UploadCloud, UserRound, UsersRound, X, Moon, Sun, Globe2, LogOut, KeyRound, Save,
} from "lucide-react";
import { Link, Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
import { LocationPicker } from "@/components/LocationPicker";
import { EacNetworkMap, RouteMap, type RouteStop } from "@/components/RouteMap";
import { EAC_LOCATIONS, findLocation, routeStopsFor, type LocationPoint } from "@/lib/locations";
import NotFound from "@/pages/not-found";
import "leaflet/dist/leaflet.css";

const API_ROOT = (() => {
  const value = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
  if (!value) return "";
  return value.endsWith("/api") ? value : `${value}/api`;
})();

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  if (!API_ROOT) {
    throw new Error("The API is not configured. Add VITE_API_URL in Vercel and redeploy.");
  }
  let response: Response;
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("truckshare_token") : null;
    response = await fetch(`${API_ROOT}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) },
    });
  } catch {
    throw new Error(`Cannot reach the TruckShare API at ${API_ROOT}. Check the Vercel API URL and Render service.`);
  }
  const rawBody = await response.text();
  let body: unknown = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    body = rawBody;
  }
  if (!response.ok) {
    const serverError = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : "";
    throw new Error(serverError || `TruckShare API returned ${response.status} ${response.statusText} for ${path}.`);
  }
  if (typeof body === "string") {
    throw new Error(`TruckShare API returned non-JSON content for ${path}. Check that VITE_API_URL points to Render, not the Vercel site.`);
  }
  return body as T;
}

function useApi<T>(path: string, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = () => {
    setLoading(true);
    api<T>(path).then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load data.")).finally(() => setLoading(false));
  };
  useEffect(reload, [path]);
  return { data, loading, error, reload, setData };
}

type Trip = { id: string; carrier: string; carrierRating: number; origin: string; originCountry?: string; originLocation?: LocationPoint; destination: string; destinationCountry?: string; destinationLocation?: LocationPoint; corridor: string; departureDate: string; departureTime?: string; vehicleType: string; capacityTons: number; capacityM3: number; price: number; currency?: string; priceType: string; status: string };
type Freight = { id: string; shipper: string; pickup: string; pickupCountry?: string; pickupLocation?: LocationPoint; dropoff: string; dropoffCountry?: string; dropoffLocation?: LocationPoint; corridor: string; description: string; cargoType?: string; weightTons: number; volumeM3?: number; dimensions: string; pickupDate: string; price: number; currency?: string; status: string };
type Booking = { id: string; tripId: string; freightId: string; corridor: string; originCountry?: string; destinationCountry?: string; amount: number; currency?: string; commissionAmount?: number; carrierPayout?: number; paymentStatus?: string; escrowStatus: string; status: string; bookedAt: string; podStatus?: string };
type Match = { id: string; type: "trip" | "freight"; title: string; corridor: string; date: string; capacity: string; price: number; compatibility: number; counterpart: string };
type Verification = { id: string; name: string; phone: string; nin: string; licenseNumber: string; logbookNumber: string; logbookPhotoName?: string; status: string; submittedAt: string };
type DashboardData = { activeTrips: number; availableLoads: number; inTransit: number; delivered: number; totalEscrow: number; matchRate: number; recentActivity: { id: string; label: string; detail: string; time: string; tone: string }[] };
type EacReference = { countries: { code: string; name: string; currency: string }[]; corridors: { origin: string; originCountry: string; destination: string; destinationCountry: string; border: string }[] };
type BorderMilestone = { id: string; bookingId: string; sequence: number; country: string; checkpoint: string; status: string; requiredDocuments: string[]; updatedAt: string };
type PaymentQuote = { quoteId: string; payerCountry: string; payeeCountry: string; amount: number; payerAmount?: number; currency: string; settlementAmount: number; settlementCurrency: string; exchangeRate: number; fee: number; commissionAmount: number; carrierPayout: number; indicative: boolean; expiresInSeconds: number };
type WorkspaceRole = "Carrier" | "Shipper" | "Admin";
type AuthUser = { id: string; name: string; phone?: string; email?: string; country: string; role: WorkspaceRole; roles?: Array<"Carrier" | "Shipper">; verified: boolean; hasPassword?: boolean };
type LegalDocument = "terms" | "privacy";
const RoleContext = createContext<WorkspaceRole>("Carrier");
const useRole = () => useContext(RoleContext);

const money = (value = 0, currency = "UGX") => `${currency} ${new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(value)}`;
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "TS";
const regionalReference: EacReference = {
  countries: [
    { code: "BI", name: "Burundi", currency: "BIF" }, { code: "CD", name: "DRC", currency: "CDF" },
    { code: "KE", name: "Kenya", currency: "KES" }, { code: "RW", name: "Rwanda", currency: "RWF" },
    { code: "SO", name: "Somalia", currency: "SOS" }, { code: "SS", name: "South Sudan", currency: "SSP" },
    { code: "TZ", name: "Tanzania", currency: "TZS" }, { code: "UG", name: "Uganda", currency: "UGX" },
  ],
  corridors: [
    { origin: "Kampala", originCountry: "UG", destination: "Nairobi", destinationCountry: "KE", border: "Malaba / Busia" },
    { origin: "Kampala", originCountry: "UG", destination: "Kigali", destinationCountry: "RW", border: "Katuna / Gatuna" },
    { origin: "Kampala", originCountry: "UG", destination: "Dar es Salaam", destinationCountry: "TZ", border: "Mutukula / Rusumo" },
    { origin: "Kampala", originCountry: "UG", destination: "Juba", destinationCountry: "SS", border: "Elegu / Nimule" },
  ],
};
const dialingCodes: Record<string, string> = {
  BI: "+257", CD: "+243", KE: "+254", RW: "+250",
  SO: "+252", SS: "+211", TZ: "+255", UG: "+256",
};
const dateFmt = (value: string) => new Intl.DateTimeFormat("en-UG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
const button = "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs font-bold transition hover:bg-muted disabled:opacity-50";
const input = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
const labelClass = "mb-1.5 block font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground";
const mobileLabels: Record<string, string> = {
  "Home": "Home",
  "Trips": "Trips",
  "Loads": "Loads",
  "My trips": "Trips",
  "My loads": "Loads",
  "Find loads": "Loads",
  "Find trucks": "Trucks",
  "Find a match": "Match",
  "My bookings": "Bookings",
  "Track delivery": "Track",
  "Documents": "Docs",
  "Verify account": "Verify",
  "Admin": "Admin",
  "Payments": "Pay",
  "Routes & countries": "Routes",
};

const nav = [
  ["/", "Home", LayoutDashboard], ["/trips", "Trips", RouteIcon], ["/freight", "Loads", PackageCheck],
  ["/matches", "Find a match", Gauge], ["/bookings", "My bookings", LockKeyhole], ["/tracking", "Track delivery", MapPin],
  ["/messages", "Messages", MessageSquare], ["/account", "My account", UserRound],
  ["/documents", "Documents", FileCheck2], ["/verification", "Verify account", ShieldCheck],
  ["/admin", "Admin", UsersRound], ["/payments", "Payments", Banknote], ["/regional", "Routes & countries", Globe2],
] as const;

function navLabel(href: string, role: WorkspaceRole) {
  if (href === "/trips") return role === "Shipper" ? "Find trucks" : role === "Carrier" ? "My trips" : "Trips";
  if (href === "/freight") return role === "Carrier" ? "Find loads" : role === "Shipper" ? "My loads" : "Loads";
  if (href === "/matches") return "Find a match";
  return nav.find(([itemHref]) => itemHref === href)?.[1] || "TruckShare";
}

function Logo() {
  return <Link href="/" className="app-logo-link"><span className="app-logo-surface"><img className="app-logo" src="/branding/truckshare-logo-transparent.png" alt="TruckShare EAC" /></span></Link>;
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => typeof window !== "undefined" && (localStorage.getItem("truckshare_theme") === "dark" || (!localStorage.getItem("truckshare_theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("truckshare_theme", dark ? "dark" : "light");
  }, [dark]);
  return <button type="button" onClick={() => setDark((current) => !current)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground/75 transition hover:text-sidebar-foreground" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>;
}

function MobileHeader({ notificationsOpen, onNotifications, onAuth }: { notificationsOpen: boolean; onNotifications: () => void; onAuth: () => void }) {
  return <header className="mobile-topbar">
    <div className="mobile-topbar-brand"><span className="mobile-topbar-logo-surface"><img className="mobile-topbar-logo" src="/branding/truckshare-logo-transparent.png" alt="TruckShare EAC" /></span></div>
    <div className="mobile-topbar-actions">
      <div className="relative"><button type="button" onClick={onNotifications} className="mobile-topbar-icon" aria-label="Notifications" aria-expanded={notificationsOpen}><Bell size={17} /><span /></button>{notificationsOpen && <div className="mobile-notifications"><div className="flex items-center justify-between"><p className="font-display text-base font-semibold">Notifications</p><span className="font-mono-ui text-[9px] uppercase tracking-wide text-muted-foreground">3 updates</span></div><div className="mt-3 space-y-3 text-xs"><div className="border-b border-border pb-3"><p className="font-semibold">New match found</p><p className="mt-1 text-muted-foreground">Kampala → Mbale is 92% compatible.</p></div><div className="border-b border-border pb-3"><p className="font-semibold">Payment held</p><p className="mt-1 text-muted-foreground">Eastline Hardware escrow is secured.</p></div><div><p className="font-semibold">Verification queue updated</p><p className="mt-1 text-muted-foreground">Thabo Transport is awaiting review.</p></div></div></div>}</div>
      <button type="button" onClick={onAuth} className="mobile-account-button" aria-label="Sign in or register"><UserRound size={16} /><span className="max-[380px]:hidden">Sign in / Register</span><span className="min-[381px]:hidden">Account</span></button>
    </div>
  </header>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState<WorkspaceRole>("Carrier");
  const [authOpen, setAuthOpen] = useState(false);
  const [authRefresh, setAuthRefresh] = useState(0);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  useEffect(() => {
    setAuthLoading(true);
    const params = new URLSearchParams(window.location.search);
    const googleCode = params.get("google_code");
    const googleError = params.get("google_error");
    if (googleCode) {
      api<{ token: string; user: AuthUser }>("/auth/google/exchange", {
        method: "POST",
        body: JSON.stringify({ code: googleCode }),
      }).then((result) => {
        localStorage.setItem("truckshare_token", result.token);
        setAuthUser(result.user);
      }).catch(() => {
        setAuthMessage("Google sign-in could not be completed. Please try again.");
        setAuthUser(null);
      }).finally(() => {
        window.history.replaceState({}, "", window.location.pathname);
        setAuthLoading(false);
      });
      return;
    }
    if (googleError) {
      setAuthMessage(googleError);
      window.history.replaceState({}, "", window.location.pathname);
    }
    api<{ user: AuthUser | null }>("/auth/me").then((result) => setAuthUser(result.user)).catch(() => setAuthUser(null)).finally(() => setAuthLoading(false));
  }, [authRefresh]);
  const current = nav.find(([href]) => href === location) || nav[0];
  const accountRoles = authUser?.roles?.length ? authUser.roles : authUser?.role && authUser.role !== "Admin" ? [authUser.role] : [];
  const availableRoles: WorkspaceRole[] = authUser?.role === "Admin" ? ["Admin"] : accountRoles;
  const changeRole = (nextRole: WorkspaceRole) => {
    if (!availableRoles.includes(nextRole)) return;
    setRole(nextRole);
    navigate(nextRole === "Carrier" ? "/trips" : nextRole === "Shipper" ? "/freight" : "/admin");
  };
  const visibleNav = nav.filter(([href]) => role === "Carrier"
    ? ["/", "/trips", "/freight", "/matches", "/bookings", "/tracking", "/messages", "/account", "/payments", "/regional"].includes(href)
    : role === "Shipper"
      ? ["/", "/freight", "/trips", "/matches", "/bookings", "/tracking", "/messages", "/account", "/payments", "/regional"].includes(href)
      : ["/", "/admin", "/account", "/messages", "/regional"].includes(href));
  const primaryHrefs = role === "Carrier"
    ? ["/", "/freight", "/matches", "/bookings"]
    : role === "Shipper"
      ? ["/", "/trips", "/matches", "/bookings"]
      : ["/", "/admin", "/messages", "/account"];
  const primaryNav = primaryHrefs.flatMap((href) => visibleNav.filter(([itemHref]) => itemHref === href));
  const moreNav = visibleNav.filter(([href]) => !primaryHrefs.includes(href));
  const mobileNavItems = primaryNav.filter(([href]) => href !== "/").slice(0, 3);
  const [moreOpen, setMoreOpen] = useState(false);
  const finishAuth = (user: AuthUser) => {
    setAuthUser(user);
    setAuthMessage("");
    setRole(user.role === "Admin" ? "Admin" : user.roles?.[0] || user.role);
    setAuthOpen(false);
  };
  const signOut = () => {
    localStorage.removeItem("truckshare_token");
    setAuthUser(null);
    setAuthMessage("");
    setMobileOpen(false);
    setMoreOpen(false);
    navigate("/");
  };
  if (authLoading) return <div className="flex min-h-[100dvh] items-center justify-center bg-background"><BrandLoader label="Loading your TruckShare account" /></div>;
  if (!authUser) return <AuthModal required initialMessage={authMessage} onComplete={finishAuth} />;
  return <RoleContext.Provider value={role}><div className="noise min-h-[100dvh] bg-background">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground shadow-2xl transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="mb-7 flex items-center justify-between px-2"><Logo /><div className="flex items-center gap-1"><ThemeToggle /><button className="rounded-lg p-2 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div></div>
      <div className="mb-6 px-2"><p className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-sidebar-foreground/40">I am using TruckShare as a</p><div className="mt-2 flex rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-1">{availableRoles.map((item) => <button type="button" key={item} onClick={() => changeRole(item)} className={`flex-1 rounded-md px-1.5 py-1.5 text-[11px] font-semibold ${role === item ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/55"}`}>{item}</button>)}</div></div>
      <nav className="space-y-1"><p className="mb-2 px-3 font-mono-ui text-[9px] uppercase tracking-[.16em] text-sidebar-foreground/35">Main</p>{primaryNav.map(([href, , Icon]) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium ${location === href ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}><Icon size={17} /><span>{navLabel(href, role)}</span></Link>)}<button type="button" onClick={() => setMoreOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"><span className="flex items-center gap-3"><Menu size={17} />More</span><ChevronDown size={15} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} /></button>{moreOpen && <div className="space-y-1 pl-3">{moreNav.map(([href, , Icon]) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[12px] font-medium ${location === href ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}><Icon size={15} /><span>{navLabel(href, role)}</span></Link>)}</div>}</nav>
      <div className="mt-auto space-y-3"><Link href="/account" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 border-t border-sidebar-border px-2 pt-4 text-left hover:text-sidebar-foreground"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d9a35c] text-xs font-bold text-primary">{initials(authUser.name)}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{authUser.name}</p><p className="truncate text-[10px] text-sidebar-foreground/45">{role} account</p></div><UserRound size={15} className="shrink-0 text-sidebar-foreground/45" /></Link><button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs font-semibold text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogOut size={15} /> Sign out</button></div>
    </aside>
     <nav className={`mobile-bottom-nav fixed inset-x-3 bottom-3 z-40 flex h-[70px] items-center gap-1 rounded-[22px] border border-border/80 px-2 shadow-xl lg:hidden ${mobileOpen ? "pointer-events-none opacity-0" : ""}`} aria-label="Mobile navigation">
        <Link href="/" onClick={() => setMobileOpen(false)} aria-label="TruckShare home" className={`mobile-nav-brand ${location === "/" ? "is-active" : ""}`}><img className="mobile-nav-brand-logo" src="/branding/truckshare-mark.png" alt="" /></Link>
        {mobileNavItems.map(([href, , Icon]) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} aria-current={location === href ? "page" : undefined} className={`mobile-nav-item ${location === href ? "is-active" : ""}`}><Icon size={18} /><span>{mobileLabels[navLabel(href, role)] || navLabel(href, role)}</span>{location === href && <i aria-hidden="true" />}</Link>)}
       <button type="button" onClick={() => setMobileOpen(true)} className={`mobile-nav-item ${!mobileNavItems.some(([href]) => href === location) && location !== "/" ? "is-active" : ""}`} aria-label="Open more navigation"><Menu size={18} /><span>More</span>{!mobileNavItems.some(([href]) => href === location) && location !== "/" && <i aria-hidden="true" />}</button>
     </nav>
    {mobileOpen && <button className="fixed inset-0 z-30 bg-primary/35 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <main className="min-h-[100dvh] lg:pl-[258px]"><header className="sticky top-0 z-20 flex h-[64px] items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur-xl sm:px-8"><div className="flex items-center gap-3"><button className="rounded-lg border border-border bg-card p-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={18} /></button><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">TruckShare EAC</p><h1 className="mt-0.5 font-display text-lg font-semibold tracking-[-.03em]">{navLabel(current[0], role)}</h1></div></div><div className="flex items-center gap-2"><div className="relative"><button type="button" onClick={() => setNotificationsOpen((open) => !open)} className="rounded-lg border border-border bg-card p-2 text-muted-foreground" aria-label="Notifications" aria-expanded={notificationsOpen}><Bell size={16} /></button>{notificationsOpen && <div className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-border bg-card p-4 text-left shadow-xl"><p className="font-display text-base font-semibold">Notifications</p><div className="mt-3 space-y-3 text-xs"><div className="border-b border-border pb-3"><p className="font-semibold">New match found</p><p className="mt-1 text-muted-foreground">Kampala → Mbale is 92% compatible.</p></div><div className="border-b border-border pb-3"><p className="font-semibold">Payment protected</p><p className="mt-1 text-muted-foreground">Eastline Hardware booking is secure.</p></div><div><p className="font-semibold">Verification needed</p><p className="mt-1 text-muted-foreground">Thabo Transport is waiting for review.</p></div></div></div>}</div><button onClick={() => setAuthOpen(true)} className={`${secondaryButton} inline-flex whitespace-nowrap`}>Account</button></div></header><div className="mx-auto max-w-[1180px] px-5 py-6 sm:px-8 sm:py-8">{children}</div></main>{authOpen && <AuthModal initialMessage={authMessage} onClose={() => { setAuthOpen(false); setAuthRefresh((value) => value + 1); }} onComplete={finishAuth} />}</div></RoleContext.Provider>;
}

function Header({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  const simpleEyebrow: Record<string, string> = { "Operations / Uganda": "Home", "Carrier portal": "For truck owners", "Shipper portal": "For people shipping goods", "Matching engine": "Find the right fit", "Financial control": "Your bookings", "Live operations": "Delivery progress", Coordination: "Messages", Compliance: "Your documents", "Driver trust": "Account verification", "Platform operations": "Admin", "Mobile money": "Payments", "Regional settlement": "Payments", "Regional operations": "Routes & countries" };
  const simpleTitle: Record<string, string> = { "Every trip pays. Every load moves.": "Move goods with confidence", "Return trips": "My trips", "Load board": "My loads", "Smart matching": "Find a match", "Bookings & payout": "My bookings", "Delivery tracker": "Track a delivery", "Document hub": "Documents", "Get your verified badge": "Verify your account", "Admin control": "Admin", "Checkout & payouts": "Pay for a booking", "Cross-border checkout": "Pay across borders", "EAC network control": "Routes across East Africa" };
  const simpleDetail = detail?.replace(/backhaul/gi, "available truck").replace(/counterpart/gi, "other person").replace(/handoff/gi, "delivery step").replace(/settlement currencies/gi, "payment currencies").replace(/customs handoffs/gi, "border steps").replace(/indicative FX quote and fees/gi, "the total cost before you pay").replace(/supported network/gi, "payment method").replace(/proof of delivery/gi, "delivery confirmation");
  return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-accent-foreground/65">{simpleEyebrow[eyebrow] || eyebrow}</p><h2 className="mt-1 font-display text-3xl font-semibold tracking-[-.045em]">{simpleTitle[title] || title}</h2>{simpleDetail && <p className="mobile-page-detail mt-2 max-w-2xl text-sm text-muted-foreground">{simpleDetail}</p>}</div>{action}</div>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <div className={`glass-surface rounded-xl border border-border bg-card p-5 sm:p-6 ${className}`}>{children}</div>; }
function Status({ value }: { value: string }) { const tone = /delivered|verified|paid|released|cleared|crossed/i.test(value) ? "bg-[#e4f1ea] text-[#28765a]" : /pending|held|transit|border|otp|planned|submitted/i.test(value) ? "bg-[#fff0d9] text-[#9a641c]" : /reject/i.test(value) ? "bg-[#fbe8e5] text-[#ad4339]" : "bg-muted text-muted-foreground"; const plain: Record<string, string> = { Held: "Payment protected", Released: "Paid out", Pending: "Waiting for payment", "En Route to Pickup": "Going to pickup", "In Transit": "On the way", "At Border": "At the border", "OTP sent": "Waiting for delivery code", Unpaid: "Not paid", Planned: "Not started", "Documents Pending": "Documents needed", Submitted: "Documents sent", Cleared: "Approved", Crossed: "Border crossed" }; return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono-ui text-[9px] font-bold uppercase tracking-wide ${tone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{plain[value] || value}</span>; }
function BrandLoader({ label = "Loading TruckShare" }: { label?: string }) {
  return <div className="brand-loader" role="status" aria-label={label}>
    <span className="brand-loader-wind" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
    <span className="brand-loader-road" aria-hidden="true" />
    <div className="brand-loader-vehicle" aria-hidden="true">
      <img className="brand-loader-image" src="/branding/truckshare-logo-transparent.png" alt="" />
    </div>
    <span className="sr-only">{label}</span>
  </div>;
}
function Loading({ error, retry }: { error: string; retry: () => void }) { if (error) return <div className="rounded-xl border border-[#e4b4a9] bg-[#fbefeb] p-6 text-center text-sm text-[#ad4339]"><CircleAlert className="mx-auto mb-2" size={20} />{error}<button onClick={retry} className={`${secondaryButton} mt-4`}>Retry</button></div>; return <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card/70"><BrandLoader label="Loading TruckShare data" /></div>; }
function Stat({ label, value, note, icon: Icon, accent = false }: { label: string; value: string | number; note: string; icon: typeof Activity; accent?: boolean }) { return <Card className={accent ? "border-accent/40 bg-[#fff5e3]" : ""}><div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0 flex-1 pr-1"><p className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-muted-foreground">{label}</p><p className="mt-3 break-words font-display text-3xl font-semibold leading-[1.05] tracking-[-.05em]">{value}</p><p className="mt-1 break-words text-[11px] text-muted-foreground">{note}</p></div><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"><Icon size={17} /></span></div></Card>; }
function Dashboard() {
  const query = useApi<DashboardData>("/dashboard", { activeTrips: 0, availableLoads: 0, inTransit: 0, delivered: 0, totalEscrow: 0, matchRate: 0, recentActivity: [] });
  const trips = useApi<Trip[]>("/trips", []);
  if (query.loading && !query.data.recentActivity.length) return <Loading error={query.error} retry={query.reload} />;
  return <div className="space-y-6"><Header eyebrow="Operations / Uganda" title="Every trip pays. Every load moves." detail="A live command center for backhaul capacity across Uganda’s busiest freight corridors." action={<Link href="/trips" className={button}><Plus size={14} /> Post a return trip</Link>} /><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Stat label="Active trips" value={query.data.activeTrips} note="Across 4 corridors" icon={RouteIcon} /><Stat label="Available loads" value={query.data.availableLoads} note="Ready to match" icon={PackageCheck} accent /><Stat label="In transit" value={query.data.inTransit} note="Live handoffs" icon={MapPin} /><Stat label="Escrow secured" value={money(query.data.totalEscrow)} note="Held until delivery" icon={LockKeyhole} /></div><div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><Card><div className="mb-5 flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground">Corridor pulse</p><h3 className="mt-1 font-display text-xl font-semibold">Uganda’s return network</h3></div><span className="rounded-md bg-[#e6f1eb] px-2 py-1 font-mono-ui text-[10px] font-bold text-[#24795b]">LIVE</span></div><div className="paper-grid relative h-[220px] overflow-hidden rounded-lg border border-border/70 bg-[#f4f0e7] p-5"><svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 220" preserveAspectRatio="none"><path d="M95 55 C180 85, 160 145, 260 130 S420 90, 520 74 S650 120, 715 160" fill="none" stroke="#d7984e" strokeDasharray="5 7" strokeWidth="2" /><path d="M260 130 C350 175, 430 170, 520 74" fill="none" stroke="#2d8066" strokeDasharray="4 6" strokeWidth="1.5" /></svg>{["Kampala", "Mbale", "Mbarara", "Gulu", "Malaba"].map((city, index) => <span key={city} className={`absolute ${["left-[10%] top-[24%]", "left-[31%] top-[55%]", "left-[48%] top-[67%]", "right-[10%] top-[70%]", "right-[26%] top-[27%]"][index]} h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/15`} title={city} />)}<div className="absolute bottom-4 left-5 rounded-md border border-border bg-card/90 px-2.5 py-1.5"><p className="font-mono-ui text-[9px] text-muted-foreground">KAMPALA → MBALE</p><p className="text-[11px] font-bold">92% match confidence</p></div><div className="absolute right-5 top-4 text-right"><p className="font-mono-ui text-[9px] text-muted-foreground">MATCH RATE</p><p className="font-display text-xl font-semibold">{query.data.matchRate}%</p></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><p className="font-display text-lg font-semibold">4</p><p className="font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">Open corridors</p></div><div className="border-x border-border"><p className="font-display text-lg font-semibold">2.8h</p><p className="font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">Avg. match time</p></div><div><p className="font-display text-lg font-semibold">12%</p><p className="font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">Platform fee</p></div></div></Card><Card><div className="mb-4 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground">Signal log</p><h3 className="mt-1 font-display text-xl font-semibold">Recent activity</h3></div><Activity size={18} className="text-accent-foreground" /></div><div className="divide-y divide-border">{query.data.recentActivity.map((item) => <div key={item.id} className="flex gap-3 py-3 first:pt-0"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{item.label}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.detail}</p></div><time className="shrink-0 font-mono-ui text-[9px] text-muted-foreground">{item.time}</time></div>)}</div></Card></div><Card><div className="mb-4 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground">Next departures</p><h3 className="mt-1 font-display text-xl font-semibold">Return trips on deck</h3></div><Link href="/trips" className="text-xs font-bold text-accent-foreground">View all <ArrowRight className="ml-1 inline" size={13} /></Link></div>{trips.loading ? <Loading error={trips.error} retry={trips.reload} /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{trips.data.slice(0, 4).map((trip) => <div key={trip.id} className="rounded-lg border border-border p-4"><div className="flex items-center justify-between"><Truck size={18} className="text-accent-foreground" /><Status value={trip.status} /></div><p className="mt-4 text-sm font-bold">{trip.origin} <ArrowRight className="mx-1 inline" size={12} /> {trip.destination}</p><p className="mt-1 text-[11px] text-muted-foreground">{trip.vehicleType} · {trip.capacityTons} tons · {dateFmt(trip.departureDate)}</p><p className="mt-3 font-display text-lg font-semibold">{money(trip.price)}</p></div>)}</div>}</Card></div>;
}

function Modal({ title, eyebrow, onClose, children, closable = true, heroImage, heroTitle }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode; closable?: boolean; heroImage?: string; heroTitle?: string }) {
  const heroStyle = heroImage ? { backgroundImage: `linear-gradient(180deg, rgba(13, 27, 38, .2) 0%, rgba(13, 27, 38, .48) 42%, rgba(13, 27, 38, .68) 100%), url("${heroImage}")` } : undefined;
  return <div className={`fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-5 ${heroImage ? "bg-cover bg-center" : "bg-primary/35 backdrop-blur-sm"}`} style={heroStyle}>
    {heroTitle && <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center px-5 sm:top-14"><div className="rounded-2xl border border-white/35 bg-white/15 px-7 py-4 text-center shadow-2xl backdrop-blur-xl"><h1 className="font-display text-4xl font-semibold tracking-[-.06em] text-white drop-shadow-lg sm:text-5xl">{heroTitle}</h1></div></div>}
    <div className={`relative max-h-[92dvh] w-full max-w-xl overflow-y-auto border border-border bg-card shadow-2xl ${heroImage ? "rounded-t-2xl sm:rounded-2xl" : "rounded-t-2xl sm:rounded-2xl"}`}>
      {!heroTitle && <div className="flex items-start justify-between border-b border-border p-5"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">{eyebrow}</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-.04em]">{title}</h2></div>{closable && <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Close"><X size={18} /></button>}</div>}
      <div className={heroTitle ? "p-5 pt-6" : "p-5"}>{children}</div>
    </div>
  </div>;
}
function Field({ label, value, onChange, type = "text", placeholder, required = true }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) { return <label className="block"><span className={labelClass}>{label}{required && <span className="text-accent-foreground"> *</span>}</span><input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={input} /></label>; }
function CountrySelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className={labelClass}>{label} *</span><select required className={input} value={value} onChange={(event) => onChange(event.target.value)}>{regionalReference.countries.map((country) => <option key={country.code} value={country.code}>{country.name} ({country.code})</option>)}</select></label>; }

function LegalDocumentModal({ document, onClose }: { document: LegalDocument | null; onClose: () => void }) {
  if (!document) return null;
  const isTerms = document === "terms";
  return <Modal title={isTerms ? "Terms and Conditions" : "Privacy Policy"} eyebrow="TruckShare EAC" onClose={onClose}>
    <div className="space-y-5 text-sm leading-6 text-muted-foreground">
      <p className="rounded-lg bg-muted p-3 text-xs leading-5">Last updated: September 2026. These terms apply to your use of TruckShare EAC, including its carrier, shipper, matching, booking, messaging, verification, payment, and delivery features.</p>
      {isTerms ? <>
        <section><h3 className="font-display text-base font-semibold text-foreground">1. Using TruckShare</h3><p>TruckShare helps shippers and carriers discover one another, compare transport details, communicate, and manage logistics workflows. TruckShare is not the carrier, shipper, driver, customs agent, insurer, or owner of goods unless the service expressly says otherwise.</p></section>
        <section><h3 className="font-display text-base font-semibold text-foreground">2. Your account</h3><p>Give us accurate information, keep your sign-in method secure, and use only your own account. You must be legally able to enter into agreements in your jurisdiction. You are responsible for activity performed through your account and for keeping listing, identity, vehicle, cargo, and contact information current.</p></section>
        <section><h3 className="font-display text-base font-semibold text-foreground">3. Listings and bookings</h3><p>Do not post false, unlawful, unsafe, misleading, or discriminatory listings. A match or quote is not a guarantee of capacity, price, transit time, border clearance, or delivery. The parties to a booking remain responsible for agreeing the cargo, route, documents, collection, delivery, and applicable legal requirements.</p></section>
        <section><h3 className="font-display text-base font-semibold text-foreground">4. Payments and delivery</h3><p>Where enabled, payment, escrow, payout, and proof-of-delivery tools reflect the status recorded in the service. Fees, settlement timing, and third-party payment-provider rules may apply. Do not use the service to move prohibited goods or to evade customs, tax, sanctions, licensing, or safety obligations.</p></section>
        <section><h3 className="font-display text-base font-semibold text-foreground">5. Verification and safety</h3><p>Verification badges and document reviews support trust but do not guarantee that a person, vehicle, cargo, document, or service is safe, lawful, or suitable. Check counterparties and cargo independently and report suspicious activity promptly.</p></section>
        <section><h3 className="font-display text-base font-semibold text-foreground">6. Acceptable use</h3><p>Do not interfere with the service, attempt unauthorized access, scrape or copy protected content, upload malicious code, impersonate another person, misuse personal information, or use TruckShare for fraud or harassment. We may suspend access to protect users, the service, or an investigation.</p></section>
        <section><h3 className="font-display text-base font-semibold text-foreground">7. Disclaimers and liability</h3><p>The service is provided on an availability basis and may change or contain errors. To the maximum extent permitted by law, TruckShare is not responsible for indirect loss, lost profits, cargo loss, delay, border events, or disputes between users. Nothing here excludes liability that cannot legally be excluded.</p></section>
        <section><h3 className="font-display text-base font-semibold text-foreground">8. Changes and termination</h3><p>We may update these terms as the service changes. We will show the updated version here and record the version accepted for new accounts. You may stop using the service at any time; provisions that should reasonably survive termination will continue to apply.</p></section>
      </> : <>
        <section><h3 className="font-display text-base font-semibold text-foreground">1. Information we collect</h3><p>We collect information you provide, such as your name or business name, email address, phone number, country, roles, listings, bookings, messages, verification documents, delivery details, and support requests. We also collect technical information needed to secure and operate the service, such as session, device, and basic usage data.</p></section>
        <section><h3 className="font-display text-base font-semibold text-foreground">2. How we use information</h3><p>We use information to create and secure accounts, authenticate users, match loads and capacity, coordinate bookings, verify people and vehicles, support payments and delivery workflows, prevent fraud, improve the service, communicate service updates, and meet legal obligations.</p></section>
        <section><h3 className="font-display text-base font-semibold text-foreground">3. Google sign-in</h3><p>If you choose Google sign-in, Google provides us with account information such as your verified email address, name, and Google account identifier. We use it to authenticate you and associate your TruckShare account. We do not receive your Google password.</p></section>
        <section><h3 className="font-display text-base font-semibold text-foreground">4. When information is shared</h3><p>We share only what is needed to operate the requested workflow: relevant profile and listing details with booking counterparts, information with service providers that help host, send messages, process payments, or provide maps, and information when required to protect users or comply with law. We do not sell personal information.</p></section>
        <section><h3 className="font-display text-base font-semibold text-foreground">5. Retention and security</h3><p>We keep information for as long as reasonably needed for the purposes above, dispute handling, safety, accounting, and legal obligations. We use access controls and security measures appropriate to the service, but no online service can guarantee absolute security.</p></section>
        <section><h3 className="font-display text-base font-semibold text-foreground">6. Your choices</h3><p>You may request access to, correction of, or deletion of information subject to applicable law and operational or legal retention needs. You can stop optional communications using the available unsubscribe or account controls. Some information is required to provide account, verification, booking, or safety features.</p></section>
        <section><h3 className="font-display text-base font-semibold text-foreground">7. Children and changes</h3><p>TruckShare is intended for people who can legally use a commercial logistics service. We may update this policy when our practices change. The current version and its update date will remain available from the account screen.</p></section>
      </>}
      <p className="border-t border-border pt-4 text-xs">For privacy, account, or policy questions, use the TruckShare support channel provided with the service.</p>
    </div>
  </Modal>;
}
function LocationSelect({ label, value, countryCode, onChange }: { label: string; value: string; countryCode?: string; onChange: (value: string) => void }) {
  const options = EAC_LOCATIONS.filter((location) => !countryCode || location.countryCode === countryCode);
  return <label className="block"><span className={labelClass}>{label} *</span><select required className={input} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((location) => <option key={`${location.countryCode}-${location.city}`} value={location.city}>{location.city} · {location.countryName}</option>)}</select></label>;
}
function RoutePreview({ origin, originCountry, originLocation, destination, destinationCountry, destinationLocation, height = "150px", className = "mt-5" }: { origin: string; originCountry: string; originLocation?: LocationPoint; destination: string; destinationCountry: string; destinationLocation?: LocationPoint; height?: string; className?: string }) {
  const stops: RouteStop[] = originLocation && destinationLocation
    ? [
        { label: "Origin", city: originLocation.city, country: originLocation.countryName, position: [originLocation.latitude, originLocation.longitude], status: "complete" },
        { label: "Destination", city: destinationLocation.city, country: destinationLocation.countryName, position: [destinationLocation.latitude, destinationLocation.longitude], status: "upcoming" },
      ]
    : routeStopsFor(origin, originCountry, destination, destinationCountry);
  if (!stops.length) return null;
  return <RouteMap stops={stops} height={height} className={className} />;
}

function RouteDetailsModal({ open, onClose, origin, originCountry, originLocation, destination, destinationCountry, destinationLocation }: { open: boolean; onClose: () => void; origin: string; originCountry: string; originLocation?: LocationPoint; destination: string; destinationCountry: string; destinationLocation?: LocationPoint }) {
  if (!open) return null;
  return <Modal title={`${origin} → ${destination}`} eyebrow="Route overview" onClose={onClose}>
    <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
      <RoutePreview origin={origin} originCountry={originCountry} originLocation={originLocation} destination={destination} destinationCountry={destinationCountry} destinationLocation={destinationLocation} height="320px" className="!mt-0" />
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-border bg-muted/30 p-3"><p className={labelClass}>Origin</p><p className="font-display text-base font-semibold">{origin}</p><p className="text-xs text-muted-foreground">{originCountry}</p></div>
      <div className="rounded-lg border border-border bg-muted/30 p-3"><p className={labelClass}>Destination</p><p className="font-display text-base font-semibold">{destination}</p><p className="text-xs text-muted-foreground">{destinationCountry}</p></div>
    </div>
  </Modal>;
}

function TripCard({ trip, role }: { trip: Trip; role: WorkspaceRole }) {
  const [routeOpen, setRouteOpen] = useState(false);
  return <>
    <Card className="logistics-card overflow-hidden p-0 transition-shadow hover:-translate-y-0.5 hover:shadow-xl">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-muted-foreground">Available capacity · {dateFmt(trip.departureDate)}</p>
          <Status value={trip.status} />
        </div>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <div className="min-w-0">
            <p className="font-mono-ui text-[9px] font-bold uppercase tracking-[.16em] text-accent-foreground">From</p>
            <p className="mt-1 break-words font-display text-[clamp(1.15rem,5vw,1.55rem)] font-semibold leading-[1.05] tracking-[-.045em]">{trip.origin}</p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{trip.originCountry || "—"}</p>
          </div>
          <span className="mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff0d9] text-accent-foreground"><ArrowRight size={15} /></span>
          <div className="min-w-0 text-right">
            <p className="font-mono-ui text-[9px] font-bold uppercase tracking-[.16em] text-accent-foreground">To</p>
            <p className="mt-1 break-words font-display text-[clamp(1.15rem,5vw,1.55rem)] font-semibold leading-[1.05] tracking-[-.045em]">{trip.destination}</p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{trip.destinationCountry || "—"}</p>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-1.5 border-t border-border/70 pt-3 text-xs text-muted-foreground"><Truck size={14} className="text-accent-foreground" />{trip.carrier} · {trip.vehicleType} · {trip.carrierRating} ★</p>
      </div>
      <div className="grid grid-cols-2 border-y border-border/80 bg-muted/35 sm:grid-cols-3">
        <div className="px-3 py-4 sm:px-5"><p className={labelClass}>Available</p><p className="mt-1 font-display text-xl font-semibold">{trip.capacityTons}<span className="ml-1 text-sm font-medium text-muted-foreground">t</span></p></div>
        <div className="border-l border-border/70 px-3 py-4 sm:px-5"><p className={labelClass}>Space</p><p className="mt-1 font-display text-xl font-semibold">{trip.capacityM3}<span className="ml-1 text-sm font-medium text-muted-foreground">m³</span></p></div>
        <div className="col-span-2 border-t border-border/70 px-3 py-4 sm:col-span-1 sm:border-l sm:border-t-0 sm:px-5"><p className={labelClass}>Rate</p><p className="mt-1 break-words font-display text-xl font-semibold leading-tight">{money(trip.price, trip.currency)}</p></div>
      </div>
      <div className="flex items-center gap-2 p-4 sm:p-5">
        <button type="button" onClick={() => setRouteOpen(true)} className={`${secondaryButton} flex-1`}><MapPin size={14} /> View route</button>
         <Link href="/matches" className={`${button} flex-1`}>{role === "Shipper" ? "Find a match" : "Find a load"} <ChevronRight size={14} /></Link>
        <a href="tel:+256700000000" aria-label="Call carrier" className={`${secondaryButton} h-10 w-10 shrink-0 p-0`}><Phone size={15} /></a>
      </div>
    </Card>
    <RouteDetailsModal open={routeOpen} onClose={() => setRouteOpen(false)} origin={trip.origin} originCountry={trip.originCountry || ""} originLocation={trip.originLocation} destination={trip.destination} destinationCountry={trip.destinationCountry || ""} destinationLocation={trip.destinationLocation} />
  </>;
}

function FreightCard({ load, role }: { load: Freight; role: WorkspaceRole }) {
  const [routeOpen, setRouteOpen] = useState(false);
  return <>
    <Card className="logistics-card overflow-hidden p-0 transition-shadow hover:-translate-y-0.5 hover:shadow-xl">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-muted-foreground">{load.cargoType || "General cargo"} · Pickup {dateFmt(load.pickupDate)}</p>
          <Status value={load.status} />
        </div>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <div className="min-w-0">
            <p className="font-mono-ui text-[9px] font-bold uppercase tracking-[.16em] text-accent-foreground">From</p>
            <p className="mt-1 break-words font-display text-[clamp(1.15rem,5vw,1.55rem)] font-semibold leading-[1.05] tracking-[-.045em]">{load.pickup}</p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{load.pickupCountry || "—"}</p>
          </div>
          <span className="mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff0d9] text-accent-foreground"><ArrowRight size={15} /></span>
          <div className="min-w-0 text-right">
            <p className="font-mono-ui text-[9px] font-bold uppercase tracking-[.16em] text-accent-foreground">To</p>
            <p className="mt-1 break-words font-display text-[clamp(1.15rem,5vw,1.55rem)] font-semibold leading-[1.05] tracking-[-.045em]">{load.dropoff}</p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{load.dropoffCountry || "—"}</p>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-1.5 border-t border-border/70 pt-3 text-xs text-muted-foreground"><PackageCheck size={14} className="text-accent-foreground" />{load.shipper} · {load.description || "General cargo"}</p>
      </div>
      <div className="grid grid-cols-2 border-y border-border/80 bg-muted/35 sm:grid-cols-3">
        <div className="px-3 py-4 sm:px-5"><p className={labelClass}>Weight</p><p className="mt-1 font-display text-xl font-semibold">{load.weightTons}<span className="ml-1 text-sm font-medium text-muted-foreground">t</span></p></div>
        <div className="border-l border-border/70 px-3 py-4 sm:px-5"><p className={labelClass}>Volume</p><p className="mt-1 font-display text-xl font-semibold">{load.volumeM3 || "—"}<span className="ml-1 text-sm font-medium text-muted-foreground">m³</span></p></div>
        <div className="col-span-2 border-t border-border/70 px-3 py-4 sm:col-span-1 sm:border-l sm:border-t-0 sm:px-5"><p className={labelClass}>Budget</p><p className="mt-1 break-words font-display text-xl font-semibold leading-tight">{money(load.price, load.currency)}</p></div>
      </div>
      <div className="flex items-center gap-2 p-4 sm:p-5">
        <button type="button" onClick={() => setRouteOpen(true)} className={`${secondaryButton} flex-1`}><MapPin size={14} /> View route</button>
         <Link href="/matches" className={`${button} flex-1`}>{role === "Carrier" ? "Find a match" : "Find a truck"} <Search size={14} /></Link>
      </div>
    </Card>
    <RouteDetailsModal open={routeOpen} onClose={() => setRouteOpen(false)} origin={load.pickup} originCountry={load.pickupCountry || ""} originLocation={load.pickupLocation} destination={load.dropoff} destinationCountry={load.dropoffCountry || ""} destinationLocation={load.dropoffLocation} />
  </>;
}

/* Legacy phone-only preview auth components retained for historical reference.
function LegacyAuthModal({ onClose }: { onClose: () => void }) {
  const [method, setMethod] = useState<"phone" | "google">("phone");
  const [phoneCountry, setPhoneCountry] = useState("UG");
  const [phone, setPhone] = useState("700 000 000");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitPhone = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const localDigits = phone.replace(/\D/g, "");
      const result = await api<{ challengeId: string; message: string; devOtp?: string }>("/auth/request-otp", { method: "POST", body: JSON.stringify({ phone: `${dialingCodes[phoneCountry]}${localDigits}` }) });
      setChallengeId(result.challengeId);
      setMessage(result.message);
      setStep("otp");
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "Could not send OTP.");
    } finally {
      setBusy(false);
    }
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ token: string }>("/auth/verify-otp", { method: "POST", body: JSON.stringify({ challengeId, otp }) });
      localStorage.setItem("truckshare_token", result.token);
      onClose();
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "Invalid OTP.");
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ token: string }>("/auth/google", { method: "POST", body: "{}" });
      localStorage.setItem("truckshare_token", result.token);
      onClose();
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "Google sign-in could not be completed.");
    } finally {
      setBusy(false);
    }
  };
  return <Modal title="Join TruckShare EAC" eyebrow="Secure access" onClose={onClose}><div className="mb-5 flex rounded-lg border border-border bg-muted/50 p-1"><button type="button" onClick={() => { setMethod("phone"); setStep("phone"); setMessage(""); }} className={`flex-1 rounded-md px-3 py-2 text-xs font-bold ${method === "phone" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Phone</button><button type="button" onClick={() => { setMethod("google"); setMessage(""); }} className={`flex-1 rounded-md px-3 py-2 text-xs font-bold ${method === "google" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Google</button></div>{message && <div className="mb-4 rounded-lg bg-[#fff0d9] p-3 text-xs text-[#8f5d1a]">{message}</div>}{method === "google" ? <div className="py-4 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-border font-display text-lg font-bold">G</div><p className="mt-4 text-sm font-semibold">Continue with Google</p><p className="mt-1 text-xs text-muted-foreground">OAuth onboarding is simulated for this preview.</p><button type="button" disabled={busy} onClick={google} className={`${button} mt-5 w-full`}>{busy ? "Connecting..." : "Continue with Google"} <ArrowRight size={14} /></button></div> : step === "phone" ? <form onSubmit={submitPhone} className="space-y-4"><div className="grid gap-4 sm:grid-cols-[.9fr_1.1fr]"><CountrySelect label="Country" value={phoneCountry} onChange={setPhoneCountry} /><Field label={`Phone number (${dialingCodes[phoneCountry]})`} value={phone} onChange={setPhone} placeholder="700 000 000" /></div><button type="submit" disabled={busy} className={`${button} w-full`}>{busy ? "Sending..." : "Send mock SMS OTP"} <ArrowRight size={14} /></button><p className="text-center font-mono-ui text-[10px] text-muted-foreground">EAC phone numbers supported · preview mode</p></form> : <form onSubmit={verify} className="space-y-4"><Field label="4-digit OTP" value={otp} onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 4))} placeholder="2468" /><button type="submit" disabled={busy} className={`${button} w-full`}>{busy ? "Verifying..." : "Verify phone"} <ShieldCheck size={14} /></button></form>}</Modal>;
}

function LegacyOnboardingAuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [method, setMethod] = useState<"phone" | "google">("phone");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"Carrier" | "Shipper">("Carrier");
  const [phoneCountry, setPhoneCountry] = useState("UG");
  const [phone, setPhone] = useState("700 000 000");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const switchMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setStep("phone");
    setMessage("");
  };
  const submitPhone = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const localDigits = phone.replace(/\D/g, "");
      const result = await api<{ challengeId: string; message: string }>("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({
          phone: `${dialingCodes[phoneCountry]}${localDigits}`,
          mode,
          ...(mode === "signup" ? { name, role } : {}),
        }),
      });
      setChallengeId(result.challengeId);
      setMessage(result.message);
      setStep("otp");
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "Could not send the verification code.");
    } finally {
      setBusy(false);
    }
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ token: string }>("/auth/verify-otp", { method: "POST", body: JSON.stringify({ challengeId, otp }) });
      localStorage.setItem("truckshare_token", result.token);
      onClose();
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "That verification code is not valid.");
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ token: string }>("/auth/google", { method: "POST", body: JSON.stringify({ mode }) });
      localStorage.setItem("truckshare_token", result.token);
      onClose();
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "Google sign-in could not be completed.");
    } finally {
      setBusy(false);
    }
  };
  return <Modal title={mode === "login" ? "Log in to TruckShare EAC" : "Create your TruckShare account"} eyebrow={mode === "login" ? "Returning user" : "New account"} onClose={onClose}>
    <div className="mb-3 grid grid-cols-2 rounded-lg border border-border bg-muted/50 p-1">
      <button type="button" onClick={() => switchMode("login")} aria-pressed={mode === "login"} className={`rounded-md px-3 py-2 text-xs font-bold ${mode === "login" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Log in</button>
      <button type="button" onClick={() => switchMode("signup")} aria-pressed={mode === "signup"} className={`rounded-md px-3 py-2 text-xs font-bold ${mode === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Create account</button>
    </div>
    <p className="mb-5 text-xs text-muted-foreground">{mode === "login" ? "Use your existing phone number or Google account to continue." : "Create an account to post trips, publish loads, and manage bookings across the EAC."}</p>
    <div className="mb-5 flex rounded-lg border border-border bg-muted/50 p-1">
      <button type="button" onClick={() => { setMethod("phone"); setStep("phone"); setMessage(""); }} className={`flex-1 rounded-md px-3 py-2 text-xs font-bold ${method === "phone" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Phone</button>
      <button type="button" onClick={() => { setMethod("google"); setMessage(""); }} className={`flex-1 rounded-md px-3 py-2 text-xs font-bold ${method === "google" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Google</button>
    </div>
    {message && <div className="mb-4 rounded-lg bg-[#fff0d9] p-3 text-xs text-[#8f5d1a]">{message}</div>}
    {method === "google" ? <div className="py-4 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-border font-display text-lg font-bold">G</div>
      <p className="mt-4 text-sm font-semibold">{mode === "login" ? "Log in with Google" : "Create account with Google"}</p>
      <p className="mt-1 text-xs text-muted-foreground">OAuth onboarding is simulated for this preview.</p>
      <button type="button" disabled={busy} onClick={google} className={`${button} mt-5 w-full`}>{busy ? "Connecting..." : mode === "login" ? "Log in with Google" : "Continue with Google"} <ArrowRight size={14} /></button>
    </div> : step === "phone" ? <form onSubmit={submitPhone} className="space-y-4">
      {mode === "signup" && <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name" value={name} onChange={setName} placeholder="Your name or business name" /><label className="block"><span className={labelClass}>I am a *</span><select className={input} value={role} onChange={(event) => setRole(event.target.value as "Carrier" | "Shipper")}><option value="Carrier">Carrier / truck owner</option><option value="Shipper">Shipper / cargo owner</option></select></label></div>}
      <div className="grid gap-4 sm:grid-cols-[.9fr_1.1fr]"><CountrySelect label="Country" value={phoneCountry} onChange={setPhoneCountry} /><Field label={`Phone number (${dialingCodes[phoneCountry]})`} value={phone} onChange={setPhone} placeholder="700 000 000" /></div>
      <button type="submit" disabled={busy} className={`${button} w-full`}>{busy ? "Sending..." : mode === "login" ? "Send login code" : "Send signup code"} <ArrowRight size={14} /></button>
      <p className="text-center font-mono-ui text-[10px] text-muted-foreground">EAC phone numbers supported · SMS charges may apply</p>
    </form> : <form onSubmit={verify} className="space-y-4">
      <div className="rounded-lg bg-[#e5f1e9] p-3 text-xs text-[#28765a]">{mode === "login" ? "Login code sent." : "Signup code sent."} Enter the code from your SMS. It expires in 10 minutes.</div>
      <Field label="Verification code" value={otp} onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 10))} placeholder="123456" />
      <button type="submit" disabled={busy} className={`${button} w-full`}>{busy ? "Verifying..." : mode === "login" ? "Log in" : "Create account"} <ShieldCheck size={14} /></button>
    </form>}
  </Modal>;
}

function LegacyEmailAuthModal({ onComplete, onClose = () => {}, required = false }: { onComplete: (user: AuthUser) => void; onClose?: () => void; required?: boolean }) {
  type AccountRole = "Carrier" | "Shipper";
  const [method, setMethod] = useState<"phone" | "google">();
  const [authMode, setAuthMode] = useState<"login" | "signup">();
  const [step, setStep] = useState<"method" | "phone" | "account" | "profile" | "roles" | "otp">("method");
  const [phoneCountry, setPhoneCountry] = useState("UG");
  const [phone, setPhone] = useState("700 000 000");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<AccountRole[]>([]);
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const continueWithPhone = () => { setMethod("phone"); setStep("phone"); setMessage(""); };
  const continueWithGoogle = () => { setMethod("google"); setStep("account"); setMessage(""); };
  const requestOtp = async (mode: "login" | "signup") => {
    setBusy(true);
    setMessage("");
    try {
      const localDigits = phone.replace(/\D/g, "");
      const result = await api<{ challengeId: string; message: string }>("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({
          phone: `${dialingCodes[phoneCountry]}${localDigits}`,
          mode,
          ...(mode === "signup" ? { name, roles } : {}),
        }),
      });
      setAuthMode(mode);
      setChallengeId(result.challengeId);
      setMessage(result.message);
      setStep("otp");
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "We could not send the verification code.");
    } finally {
      setBusy(false);
    }
  };
  const checkPhoneAccount = async () => {
    setBusy(true);
    setMessage("");
    try {
      const localDigits = phone.replace(/\D/g, "");
      const result = await api<{ exists: boolean }>("/auth/account-status", {
        method: "POST",
        body: JSON.stringify({ phone: `${dialingCodes[phoneCountry]}${localDigits}` }),
      });
      if (result.exists) {
        setAuthMode("login");
        await requestOtp("login");
      } else {
        setAuthMode("signup");
        setStep("profile");
      }
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "We could not check that phone number.");
    } finally {
      setBusy(false);
    }
  };
  const continueAccount = (mode: "login" | "signup") => {
    setAuthMode(mode);
    if (mode === "signup") {
      setStep("profile");
    } else if (method === "phone") {
      void requestOtp("login");
    } else {
      void finishGoogle("login");
    }
  };
  const finishGoogle = (mode: "login" | "signup") => {
    if (!API_ROOT) {
      setMessage("The API is not configured. Add VITE_API_URL before using Google sign-in.");
      return;
    }
    setBusy(true);
    const params = new URLSearchParams({ mode });
    if (mode === "signup") params.set("roles", roles.join(","));
    window.location.assign(`${API_ROOT}/auth/google/start?${params.toString()}`);
  };
  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setMessage("Tell us your name first.");
      return;
    }
    setMessage("");
    setStep("roles");
  };
  const toggleRole = (nextRole: AccountRole) => setRoles((current) => current.includes(nextRole) ? current.filter((item) => item !== nextRole) : [...current, nextRole]);
  const submitRoles = (event: FormEvent) => {
    event.preventDefault();
    if (!roles.length) {
      setMessage("Choose at least one role to continue.");
      return;
    }
    if (method === "phone") void requestOtp("signup");
    else void finishGoogle("signup");
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ token: string; user: AuthUser }>("/auth/verify-otp", { method: "POST", body: JSON.stringify({ challengeId, otp }) });
      localStorage.setItem("truckshare_token", result.token);
      onComplete(result.user);
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "That verification code is not valid.");
    } finally {
      setBusy(false);
    }
  };
  const goBack = () => {
    setMessage("");
    if (step === "phone") setStep("method");
    else if (step === "account") setStep(method === "phone" ? "phone" : "method");
    else if (step === "profile") setStep(method === "phone" ? "phone" : "account");
    else if (step === "roles") setStep("profile");
    else if (step === "otp") setStep(authMode === "signup" ? "roles" : method === "phone" ? "phone" : "account");
  };
  const question = step === "method" ? "How would you like to continue?" : step === "phone" ? "What phone number should we use?" : step === "account" ? "Have you used TruckShare before?" : step === "profile" ? "First, tell us your name." : step === "roles" ? "What will you use TruckShare for?" : "What is your verification code?";
  return <Modal title="Welcome to TruckShare EAC" eyebrow={required ? "Set up your account" : "Account access"} onClose={onClose} closable={!required}>
    <div className="mb-5 flex items-center gap-2">{(["method", "profile", "roles"] as const).map((item, index) => <span key={item} className={`h-1.5 flex-1 rounded-full ${step === item || (step === "phone" && index === 0) || (step === "account" && index === 0) || (step === "otp" && index === 2) || (step === "roles" && index <= 2) ? "bg-primary" : "bg-muted"}`} />)}</div>
    {step !== "method" && <button type="button" onClick={goBack} className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition hover:text-foreground"><ArrowLeft size={14} /> Back</button>}
    <p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground">Question {step === "method" || step === "phone" || step === "account" ? "1" : step === "profile" ? "2" : "3"} of 3</p>
    <h3 className="mt-2 font-display text-2xl font-semibold tracking-[-.04em]">{question}</h3>
    {message && <div className="mt-4 rounded-lg bg-[#fff0d9] p-3 text-xs text-[#8f5d1a]">{message}</div>}
    {step === "method" && <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={continueWithPhone} className={`${secondaryButton} min-h-24 flex-col`}><Phone size={22} /><span>Continue with phone</span><small className="font-normal text-muted-foreground">Use an EAC number</small></button>
      <button type="button" onClick={continueWithGoogle} className={`${secondaryButton} min-h-24 flex-col`}><span className="font-display text-2xl font-bold">G</span><span>Continue with Google</span><small className="font-normal text-muted-foreground">Use your Google account</small></button>
    </div>}
    {step === "phone" && <form onSubmit={(event) => { event.preventDefault(); void checkPhoneAccount(); }} className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-[.9fr_1.1fr]"><CountrySelect label="Country" value={phoneCountry} onChange={setPhoneCountry} /><Field label={`Phone number (${dialingCodes[phoneCountry]})`} value={phone} onChange={setPhone} placeholder="700 000 000" /></div>
      <button type="submit" disabled={busy} className={`${button} w-full`}>{busy ? "Checking account..." : "Continue"} <ArrowRight size={14} /></button>
      <p className="text-center text-xs text-muted-foreground">We’ll take you straight to login or account setup based on this number.</p>
    </form>}
    {step === "account" && <div className="mt-6 space-y-3">
      <button type="button" onClick={() => continueAccount("login")} disabled={busy} className={`${secondaryButton} w-full justify-between`}><span>I already have an account</span><ArrowRight size={14} /></button>
      <button type="button" onClick={() => continueAccount("signup")} disabled={busy} className={`${button} w-full justify-between`}><span>I am new to TruckShare</span><ArrowRight size={14} /></button>
    </div>}
    {step === "profile" && <form onSubmit={submitProfile} className="mt-6 space-y-4">
      <p className="text-sm text-muted-foreground">This is how other people will identify you on trips, loads, and bookings.</p>
      <Field label="Full name or business name" value={name} onChange={setName} placeholder="Your name or company" />
      <button type="submit" className={`${button} w-full`}>Continue <ArrowRight size={14} /></button>
    </form>}
    {step === "roles" && <form onSubmit={submitRoles} className="mt-6 space-y-4">
      <p className="text-sm text-muted-foreground">Select one or both. Choosing both gives you a role switcher.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {([["Carrier", "I have trucks or available space.", Truck], ["Shipper", "I need goods moved.", PackageCheck] ] as const).map(([value, detail, Icon]) => <button type="button" key={value} onClick={() => toggleRole(value)} className={`rounded-xl border p-4 text-left transition ${roles.includes(value) ? "border-primary bg-[#e5f1e9] text-primary" : "border-border bg-card"}`}><Icon size={20} /><p className="mt-3 text-sm font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p><span className="mt-3 block text-[10px] font-bold uppercase tracking-wider">{roles.includes(value) ? "Selected" : "Choose"}</span></button>)}
      </div>
      <button type="submit" disabled={busy} className={`${button} w-full`}>{busy ? "Continuing..." : method === "phone" ? "Send verification code" : "Create account with Google"} <ArrowRight size={14} /></button>
    </form>}
    {step === "otp" && <form onSubmit={verify} className="mt-6 space-y-4">
      <div className="rounded-lg bg-[#e5f1e9] p-3 text-xs text-[#28765a]">{authMode === "login" ? "Login code sent." : "Signup code sent."} Enter the code from your SMS. It expires in 10 minutes.</div>
      <Field label="Verification code" value={otp} onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 10))} placeholder="123456" />
      <button type="submit" disabled={busy} className={`${button} w-full`}>{busy ? "Verifying..." : authMode === "login" ? "Log in" : "Create account"} <ShieldCheck size={14} /></button>
      <button type="button" disabled={busy} onClick={() => authMode && void requestOtp(authMode)} className="w-full text-xs font-bold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Resend code</button>
    </form>}
  </Modal>;
}

*/

function AuthModal({ onComplete, onClose = () => {}, required = false, initialMessage = "" }: { onComplete: (user: AuthUser) => void; onClose?: () => void; required?: boolean; initialMessage?: string }) {
  type AccountRole = "Carrier" | "Shipper";
  type Step = "method" | "email" | "account" | "profile" | "roles" | "emailOtp" | "phoneVerify";
  const [method, setMethod] = useState<"email" | "google">();
  const [authMode, setAuthMode] = useState<"login" | "signup">();
  const [step, setStep] = useState<Step>("method");
  const [email, setEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("UG");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<AccountRole[]>([]);
  const [emailChallengeId, setEmailChallengeId] = useState("");
  const [phoneChallengeId, setPhoneChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);

  const continueWithEmail = () => { setMethod("email"); setStep("email"); setMessage(""); };
  const continueWithGoogle = () => { setMethod("google"); setStep("account"); setMessage(""); };

  const requestEmailOtp = async (mode: "login" | "signup") => {
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ challengeId: string; message: string }>("/auth/request-email-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), mode, ...(mode === "signup" ? { name, roles, termsAccepted: acceptedTerms } : {}) }),
      });
      setAuthMode(mode);
      setEmailChallengeId(result.challengeId);
      setMessage(result.message);
      setStep("emailOtp");
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "We could not send the verification email.");
    } finally {
      setBusy(false);
    }
  };

  const checkEmailAccount = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ exists: boolean }>("/auth/account-status", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      if (result.exists) {
        setAuthMode("login");
        await requestEmailOtp("login");
      } else {
        setAuthMode("signup");
        setStep("profile");
      }
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "We could not check that email address.");
    } finally {
      setBusy(false);
    }
  };

  const continueAccount = (mode: "login" | "signup") => {
    setAuthMode(mode);
    if (mode === "signup") setStep("profile");
    else if (method === "email") void requestEmailOtp("login");
    else void finishGoogle("login");
  };

  const finishGoogle = (mode: "login" | "signup") => {
    if (!API_ROOT) {
      setMessage("The API is not configured. Add VITE_API_URL before using Google sign-in.");
      return;
    }
    setBusy(true);
    const params = new URLSearchParams({ mode });
    if (mode === "signup") params.set("roles", roles.join(","));
    if (mode === "signup" && acceptedTerms) params.set("terms", "1");
    window.location.assign(`${API_ROOT}/auth/google/start?${params.toString()}`);
  };

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setMessage("Tell us your name first.");
      return;
    }
    setMessage("");
    setStep("roles");
  };

  const toggleRole = (nextRole: AccountRole) => setRoles((current) => current.includes(nextRole) ? current.filter((item) => item !== nextRole) : [...current, nextRole]);

  const submitRoles = (event: FormEvent) => {
    event.preventDefault();
    if (!roles.length) {
      setMessage("Choose at least one role to continue.");
      return;
    }
    if (!acceptedTerms) {
      setMessage("Accept the Terms and Conditions and Privacy Policy to create your account.");
      return;
    }
    if (method === "email") void requestEmailOtp("signup");
    else void finishGoogle("signup");
  };

  const verifyEmail = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ token: string; user: AuthUser; requiresPhoneVerification?: boolean }>("/auth/verify-email-otp", {
        method: "POST",
        body: JSON.stringify({ challengeId: emailChallengeId, otp }),
      });
      localStorage.setItem("truckshare_token", result.token);
      if (result.requiresPhoneVerification) {
        setStep("phoneVerify");
        setMessage("One last step: verify your phone number. You will not need to do this again unless you change it.");
      } else {
        onComplete(result.user);
      }
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "That verification code is not valid.");
    } finally {
      setBusy(false);
    }
  };

  const requestPhoneOtp = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const localDigits = phone.replace(/\D/g, "");
      const fullPhone = `${dialingCodes[phoneCountry]}${localDigits}`;
      const result = await api<{ challengeId: string; message: string; alreadyVerified?: boolean; user?: AuthUser }>("/auth/request-phone-otp", {
        method: "POST",
        body: JSON.stringify({ phone: fullPhone }),
      });
      if (result.alreadyVerified) {
        if (result.user) onComplete(result.user);
        return;
      }
      setPhoneChallengeId(result.challengeId);
      setMessage(result.message);
      setStep("phoneVerify");
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "We could not send the phone verification code.");
    } finally {
      setBusy(false);
    }
  };

  const verifyPhone = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ user: AuthUser }>("/auth/verify-phone-otp", {
        method: "POST",
        body: JSON.stringify({ challengeId: phoneChallengeId, otp: phoneOtp }),
      });
      onComplete(result.user);
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : "That phone verification code is not valid.");
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    setMessage("");
    if (step === "email") setStep("method");
    else if (step === "account") setStep(method === "email" ? "email" : "method");
    else if (step === "profile") setStep("email");
    else if (step === "roles") setStep("profile");
    else if (step === "emailOtp") setStep(authMode === "signup" ? "roles" : "email");
  };

  const question = step === "method" ? "Sign in or create your account"
    : step === "email" ? "What email should we use?"
      : step === "account" ? "Have you used TruckShare before?"
        : step === "profile" ? "First, tell us your name."
          : step === "roles" ? "What will you use TruckShare for?"
            : step === "phoneVerify" ? "Verify your phone number"
              : "What is your email verification code?";

  return <>
    <Modal title="TruckShare" eyebrow={required ? "Set up your account" : "Account access"} heroImage="/branding/truckshare-hero.jpg" heroTitle="TruckShare" onClose={onClose} closable={!required}>
    <div className="mb-5 flex items-center gap-2">{(["method", "profile", "roles"] as const).map((item, index) => <span key={item} className={`h-1.5 flex-1 rounded-full ${step === item || (step === "email" && index === 0) || (step === "account" && index === 0) || (step === "emailOtp" && index === 2) || (step === "phoneVerify" && index === 2) || (step === "roles" && index <= 2) ? "bg-primary" : "bg-muted"}`} />)}</div>
    {step !== "method" && step !== "phoneVerify" && <button type="button" onClick={goBack} className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition hover:text-foreground"><ArrowLeft size={14} /> Back</button>}
    <h3 className="mt-2 font-display text-2xl font-semibold tracking-[-.04em]">{question}</h3>
    {message && <div className="mt-4 rounded-lg bg-[#fff0d9] p-3 text-xs text-[#8f5d1a]">{message}</div>}
    {step === "method" && <div className="mt-6 space-y-4">
       <p className="text-sm text-muted-foreground">The system auto identifies new or registered users upon sign in/up.</p>
       <div className="grid gap-3 sm:grid-cols-2">
       <button type="button" onClick={continueWithEmail} className={`${secondaryButton} min-h-20 flex-col`}><Send size={22} /><span>Continue with email</span></button>
       <button type="button" onClick={continueWithGoogle} className={`${secondaryButton} min-h-20 flex-col`}><span className="font-display text-2xl font-bold">G</span><span>Continue with Google</span></button>
       </div>
    </div>}
    {step === "email" && <form onSubmit={(event) => { event.preventDefault(); void checkEmailAccount(); }} className="mt-6 space-y-4">
      <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
      <button type="submit" disabled={busy} className={`${button} w-full`}>{busy ? "Checking account..." : "Continue"} <ArrowRight size={14} /></button>
      <p className="text-center text-xs text-muted-foreground">We’ll send a free verification code by email.</p>
    </form>}
    {step === "account" && <div className="mt-6 space-y-3">
      <button type="button" onClick={() => continueAccount("login")} disabled={busy} className={`${secondaryButton} w-full justify-between`}><span>I already have an account</span><ArrowRight size={14} /></button>
      <button type="button" onClick={() => continueAccount("signup")} disabled={busy} className={`${button} w-full justify-between`}><span>I am new to TruckShare</span><ArrowRight size={14} /></button>
    </div>}
    {step === "profile" && <form onSubmit={submitProfile} className="mt-6 space-y-4">
      <p className="text-sm text-muted-foreground">This is how other people will identify you on trips, loads, and bookings.</p>
      <Field label="Full name or business name" value={name} onChange={setName} placeholder="Your name or company" />
      <button type="submit" className={`${button} w-full`}>Continue <ArrowRight size={14} /></button>
    </form>}
    {step === "roles" && <form onSubmit={submitRoles} className="mt-6 space-y-4">
      <p className="text-sm text-muted-foreground">Select one or both. Choosing both gives you a role switcher.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {([["Carrier", "I have trucks or available space.", Truck], ["Shipper", "I need goods moved.", PackageCheck] ] as const).map(([value, detail, Icon]) => <button type="button" key={value} onClick={() => toggleRole(value)} className={`rounded-xl border p-4 text-left transition ${roles.includes(value) ? "border-primary bg-[#e5f1e9] text-primary" : "border-border bg-card"}`}><Icon size={20} /><p className="mt-3 text-sm font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p><span className="mt-3 block text-[10px] font-bold uppercase tracking-wider">{roles.includes(value) ? "Selected" : "Choose"}</span></button>)}
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <input id="terms-consent" type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
        <label htmlFor="terms-consent" className="leading-5">I agree to the <button type="button" onClick={() => setLegalDocument("terms")} className="font-bold text-foreground underline underline-offset-2">Terms and Conditions</button> and acknowledge the <button type="button" onClick={() => setLegalDocument("privacy")} className="font-bold text-foreground underline underline-offset-2">Privacy Policy</button>.</label>
      </div>
      <button type="submit" disabled={busy || !acceptedTerms} className={`${button} w-full`}>{busy ? "Continuing..." : "Create account"} <ArrowRight size={14} /></button>
    </form>}
    {step === "emailOtp" && <form onSubmit={verifyEmail} className="mt-6 space-y-4">
      <div className="rounded-lg bg-[#e5f1e9] p-3 text-xs text-[#28765a]">{authMode === "login" ? "Login code sent." : "Signup code sent."} Enter the code from your email. It expires in 10 minutes.</div>
      <Field label="Email verification code" value={otp} onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" />
      <button type="submit" disabled={busy} className={`${button} w-full`}>{busy ? "Verifying..." : authMode === "login" ? "Log in" : "Create account"} <ShieldCheck size={14} /></button>
      <button type="button" disabled={busy} onClick={() => authMode && void requestEmailOtp(authMode)} className="w-full text-xs font-bold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Resend email code</button>
    </form>}
    {step === "phoneVerify" && <div className="mt-6 space-y-4">
      <p className="text-sm text-muted-foreground">We only ask for this once. You’ll only need to verify again if you change your phone number, and phone changes are limited to once per year.</p>
      {!phoneChallengeId ? <form onSubmit={requestPhoneOtp} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[.9fr_1.1fr]"><CountrySelect label="Country" value={phoneCountry} onChange={setPhoneCountry} /><Field label={`Phone number (${dialingCodes[phoneCountry]})`} value={phone} onChange={setPhone} placeholder="700 000 000" /></div>
        <button type="submit" disabled={busy} className={`${button} w-full`}>{busy ? "Sending code..." : "Verify phone number"} <Phone size={14} /></button>
      </form> : <form onSubmit={verifyPhone} className="space-y-4">
        <Field label="Phone verification code" value={phoneOtp} onChange={(value) => setPhoneOtp(value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" />
        <button type="submit" disabled={busy} className={`${button} w-full`}>{busy ? "Verifying..." : "Confirm phone"} <ShieldCheck size={14} /></button>
        <button type="button" disabled={busy} onClick={() => { setPhoneChallengeId(""); setMessage(""); }} className="w-full text-xs font-bold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Use a different number</button>
      </form>}
    </div>}
      <div className="mt-6 border-t border-border pt-4 text-center text-[11px] leading-5 text-muted-foreground">
        <button type="button" onClick={() => setLegalDocument("terms")} className="font-bold text-foreground underline underline-offset-2">Terms and Conditions</button><span className="mx-2">·</span><button type="button" onClick={() => setLegalDocument("privacy")} className="font-bold text-foreground underline underline-offset-2">Privacy Policy</button>
      </div>
    </Modal>
    <LegalDocumentModal document={legalDocument} onClose={() => setLegalDocument(null)} />
  </>;
}

function TripsPage() {
  const role = useRole();
  const query = useApi<Trip[]>("/trips", []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    origin: "Kampala",
    originCountry: "UG",
    originLocation: findLocation("Kampala", "UG"),
    destination: "Nairobi",
    destinationCountry: "KE",
    destinationLocation: findLocation("Nairobi", "KE"),
    departureDate: "2026-09-10",
    departureTime: "07:00",
    vehicleType: "Fuso",
    capacityTons: "8",
    capacityM3: "42",
    price: "680000",
    currency: "UGX",
    priceType: "Fixed",
  });
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const setOrigin = (location: LocationPoint) => setForm((current) => ({ ...current, origin: location.city, originCountry: location.countryCode, originLocation: location }));
  const setDestination = (location: LocationPoint) => setForm((current) => ({ ...current, destination: location.city, destinationCountry: location.countryCode, destinationLocation: location }));
   const setOriginLabel = (label: string) => setForm((current) => ({ ...current, origin: label, originLocation: undefined }));
   const setDestinationLabel = (label: string) => setForm((current) => ({ ...current, destination: label, destinationLocation: undefined }));
  const setOriginCountry = (value: string) => setForm((current) => ({ ...current, originCountry: value, originLocation: current.originLocation?.countryCode === value ? current.originLocation : undefined }));
  const setDestinationCountry = (value: string) => setForm((current) => ({ ...current, destinationCountry: value, destinationLocation: current.destinationLocation?.countryCode === value ? current.destinationLocation : undefined }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api("/trips", { method: "POST", body: JSON.stringify({ ...form, capacityTons: Number(form.capacityTons), capacityM3: Number(form.capacityM3), price: Number(form.price) }) });
    setOpen(false);
    query.reload();
  };
  return (
    <div className="space-y-6">
      <Header eyebrow={role === "Shipper" ? "Shipper portal" : "Carrier portal"} title={role === "Shipper" ? "Find trucks" : "My trips"} detail={role === "Shipper" ? "Browse available truck capacity by route, date, and vehicle." : "Publish your next route and let shippers find your available capacity."} action={role === "Carrier" ? <button onClick={() => setOpen(true)} className={button}><Plus size={14} /> Post a trip</button> : undefined} />
      {query.loading ? <Loading error={query.error} retry={query.reload} /> : <div className="grid gap-5 lg:grid-cols-2">{query.data.map((trip) => <TripCard key={trip.id} trip={trip} role={role} />)}</div>}
      {open && <Modal title="Post a return trip" eyebrow="Carrier portal" onClose={() => setOpen(false)}><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><LocationPicker label="Origin area or landmark" value={form.originLocation} countryCode={form.originCountry} onChange={setOrigin} onLabelChange={setOriginLabel} /><CountrySelect label="Origin country" value={form.originCountry} onChange={setOriginCountry} /><LocationPicker label="Destination area or landmark" value={form.destinationLocation} countryCode={form.destinationCountry} onChange={setDestination} onLabelChange={setDestinationLabel} /><CountrySelect label="Destination country" value={form.destinationCountry} onChange={setDestinationCountry} /><Field label="Departure date" type="date" value={form.departureDate} onChange={(value) => update("departureDate", value)} /><Field label="Departure time" type="time" value={form.departureTime} onChange={(value) => update("departureTime", value)} /><label><span className={labelClass}>Truck type</span><select className={input} value={form.vehicleType} onChange={(event) => update("vehicleType", event.target.value)}>{["Fuso", "Canter", "Trailer", "Flatbed"].map((item) => <option key={item}>{item}</option>)}</select></label><Field label="Available capacity (tons)" type="number" value={form.capacityTons} onChange={(value) => update("capacityTons", value)} /><Field label="Available space (m³)" type="number" value={form.capacityM3} onChange={(value) => update("capacityM3", value)} /><Field label="Trip price" type="number" value={form.price} onChange={(value) => update("price", value)} /><label><span className={labelClass}>Price currency</span><select className={input} value={form.currency} onChange={(event) => update("currency", event.target.value)}>{regionalReference.countries.map((country) => <option key={country.currency} value={country.currency}>{country.currency} · {country.name}</option>)}</select></label></div><p className="text-[11px] text-muted-foreground">Type any landmark, worksite, warehouse, or road area. Use the map only when you want to attach exact coordinates.</p><button className={`${button} w-full`}><Plus size={14} /> Publish trip</button></form></Modal>}
    </div>
  );
}

function LocationAwareTripsPage() {
  const query = useApi<Trip[]>("/trips", []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ origin: "Kampala", originCountry: "UG", originLocation: findLocation("Kampala", "UG"), destination: "Nairobi", destinationCountry: "KE", destinationLocation: findLocation("Nairobi", "KE"), departureDate: "2026-09-10", departureTime: "07:00", vehicleType: "Fuso", capacityTons: "8", capacityM3: "42", price: "680000", currency: "UGX", priceType: "Fixed" });
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); await api("/trips", { method: "POST", body: JSON.stringify({ ...form, capacityTons: Number(form.capacityTons), capacityM3: Number(form.capacityM3), price: Number(form.price) }) }); setOpen(false); query.reload(); };
  return <div className="space-y-6"><Header eyebrow="Carrier portal" title="Return trips" detail="Turn an empty leg into paid capacity anywhere across the EAC." action={<button onClick={() => setOpen(true)} className={button}><Plus size={14} /> Post return trip</button>} />{query.loading ? <Loading error={query.error} retry={query.reload} /> : <div className="grid gap-4 lg:grid-cols-2">{query.data.map((trip) => <Card key={trip.id}><div className="flex items-start justify-between gap-3"><div><p className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">Departure · {dateFmt(trip.departureDate)} {trip.departureTime}</p><h3 className="mt-2 font-display text-xl font-semibold">{trip.origin} <span className="text-xs font-semibold text-muted-foreground">({trip.originCountry})</span> <ArrowRight className="mx-1 inline text-accent-foreground" size={16} /> {trip.destination} <span className="text-xs font-semibold text-muted-foreground">({trip.destinationCountry})</span></h3><p className="mt-1 text-xs text-muted-foreground">{trip.carrier} · {trip.vehicleType} · {trip.carrierRating} ★</p></div><Status value={trip.status} /></div><RoutePreview origin={trip.origin} originCountry={trip.originCountry || ""} originLocation={trip.originLocation} destination={trip.destination} destinationCountry={trip.destinationCountry || ""} destinationLocation={trip.destinationLocation} /><div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4"><div><p className={labelClass}>Available</p><p className="font-display text-lg font-semibold">{trip.capacityTons} t</p></div><div><p className={labelClass}>Space</p><p className="font-display text-lg font-semibold">{trip.capacityM3} m³</p></div><div><p className={labelClass}>Rate</p><p className="font-display text-lg font-semibold">{money(trip.price, trip.currency)}</p></div></div><div className="mt-4 flex gap-2"><Link href="/matches" className={secondaryButton}>Find matching loads <ChevronRight size={14} /></Link><a href="tel:+256700000000" className={secondaryButton}><Phone size={14} /> Call</a></div></Card>)}</div>}{open && <Modal title="Post a return trip" eyebrow="Carrier portal" onClose={() => setOpen(false)}><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><LocationSelect label="Origin city or town" value={form.origin} onChange={(value) => update("origin", value)} /><CountrySelect label="Origin country" value={form.originCountry} onChange={(value) => update("originCountry", value)} /><LocationSelect label="Destination city or town" value={form.destination} onChange={(value) => update("destination", value)} /><CountrySelect label="Destination country" value={form.destinationCountry} onChange={(value) => update("destinationCountry", value)} /><Field label="Departure date" type="date" value={form.departureDate} onChange={(value) => update("departureDate", value)} /><Field label="Departure time" type="time" value={form.departureTime} onChange={(value) => update("departureTime", value)} /><label><span className={labelClass}>Truck type</span><select className={input} value={form.vehicleType} onChange={(event) => update("vehicleType", event.target.value)}>{["Fuso", "Canter", "Trailer", "Flatbed"].map((item) => <option key={item}>{item}</option>)}</select></label><Field label="Available capacity (tons)" type="number" value={form.capacityTons} onChange={(value) => update("capacityTons", value)} /><Field label="Available space (m³)" type="number" value={form.capacityM3} onChange={(value) => update("capacityM3", value)} /><Field label="Trip price" type="number" value={form.price} onChange={(value) => update("price", value)} /><label><span className={labelClass}>Price currency</span><select className={input} value={form.currency} onChange={(event) => update("currency", event.target.value)}>{regionalReference.countries.map((country) => <option key={country.currency} value={country.currency}>{country.currency} · {country.name}</option>)}</select></label></div><button className={`${button} w-full`}><Plus size={14} /> Publish trip</button></form></Modal>}</div>;
}

function FreightPage() {
  const role = useRole();
  const query = useApi<Freight[]>("/freight", []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    pickup: "Kampala",
    pickupCountry: "UG",
    pickupLocation: findLocation("Kampala", "UG"),
    dropoff: "Nairobi",
    dropoffCountry: "KE",
    dropoffLocation: findLocation("Nairobi", "KE"),
    description: "",
    cargoType: "General cargo",
    weightTons: "2",
    volumeM3: "8",
    dimensions: "2 pallets",
    pickupDate: "2026-09-10",
    price: "400000",
    currency: "UGX",
  });
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const setPickup = (location: LocationPoint) => setForm((current) => ({ ...current, pickup: location.city, pickupCountry: location.countryCode, pickupLocation: location }));
  const setDropoff = (location: LocationPoint) => setForm((current) => ({ ...current, dropoff: location.city, dropoffCountry: location.countryCode, dropoffLocation: location }));
   const setPickupLabel = (label: string) => setForm((current) => ({ ...current, pickup: label, pickupLocation: undefined }));
   const setDropoffLabel = (label: string) => setForm((current) => ({ ...current, dropoff: label, dropoffLocation: undefined }));
  const setPickupCountry = (value: string) => setForm((current) => ({ ...current, pickupCountry: value, pickupLocation: current.pickupLocation?.countryCode === value ? current.pickupLocation : undefined }));
  const setDropoffCountry = (value: string) => setForm((current) => ({ ...current, dropoffCountry: value, dropoffLocation: current.dropoffLocation?.countryCode === value ? current.dropoffLocation : undefined }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api("/freight", { method: "POST", body: JSON.stringify({ ...form, weightTons: Number(form.weightTons), volumeM3: Number(form.volumeM3), price: Number(form.price) }) });
    setOpen(false);
    query.reload();
  };
  return (
    <div className="space-y-6">
      <Header eyebrow={role === "Carrier" ? "Carrier portal" : "Shipper portal"} title={role === "Carrier" ? "Find loads" : "My loads"} detail={role === "Carrier" ? "Find cargo that fits your next route, date, and available capacity." : "Publish cargo once and let verified carriers find the right route and capacity."} action={role === "Shipper" ? <button onClick={() => setOpen(true)} className={button}><Plus size={14} /> Post a load</button> : undefined} />
      {query.loading ? <Loading error={query.error} retry={query.reload} /> : <div className="grid gap-5 lg:grid-cols-2">{query.data.map((load) => <FreightCard key={load.id} load={load} role={role} />)}</div>}
      {open && <Modal title="Post a load" eyebrow="Shipper portal" onClose={() => setOpen(false)}><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><LocationPicker label="Pickup area or landmark" value={form.pickupLocation} countryCode={form.pickupCountry} onChange={setPickup} onLabelChange={setPickupLabel} /><CountrySelect label="Pickup country" value={form.pickupCountry} onChange={setPickupCountry} /><LocationPicker label="Drop-off area or landmark" value={form.dropoffLocation} countryCode={form.dropoffCountry} onChange={setDropoff} onLabelChange={setDropoffLabel} /><CountrySelect label="Drop-off country" value={form.dropoffCountry} onChange={setDropoffCountry} /><Field label="Cargo description" value={form.description} onChange={(value) => update("description", value)} placeholder="Bagged maize, cartons..." /><Field label="Cargo type" value={form.cargoType} onChange={(value) => update("cargoType", value)} /><Field label="Weight (tons)" type="number" value={form.weightTons} onChange={(value) => update("weightTons", value)} /><Field label="Volume (m³)" type="number" value={form.volumeM3} onChange={(value) => update("volumeM3", value)} /><Field label="Pickup date" type="date" value={form.pickupDate} onChange={(value) => update("pickupDate", value)} /><Field label="Budget" type="number" value={form.price} onChange={(value) => update("price", value)} /><label><span className={labelClass}>Budget currency</span><select className={input} value={form.currency} onChange={(event) => update("currency", event.target.value)}>{regionalReference.countries.map((country) => <option key={country.currency} value={country.currency}>{country.currency} · {country.name}</option>)}</select></label></div><p className="text-[11px] text-muted-foreground">Type any landmark, worksite, warehouse, or road area. Use the map only when you want to attach exact coordinates.</p><button className={`${button} w-full`}><Plus size={14} /> Publish load</button></form></Modal>}
    </div>
  );
}

function LocationAwareFreightPage() {
  const query = useApi<Freight[]>("/freight", []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ pickup: "Kampala", pickupCountry: "UG", pickupLocation: findLocation("Kampala", "UG"), dropoff: "Nairobi", dropoffCountry: "KE", dropoffLocation: findLocation("Nairobi", "KE"), description: "", cargoType: "General cargo", weightTons: "2", volumeM3: "8", dimensions: "2 pallets", pickupDate: "2026-09-10", price: "400000", currency: "UGX" });
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); await api("/freight", { method: "POST", body: JSON.stringify({ ...form, weightTons: Number(form.weightTons), volumeM3: Number(form.volumeM3), price: Number(form.price) }) }); setOpen(false); query.reload(); };
  return <div className="space-y-6"><Header eyebrow="Shipper portal" title="Load board" detail="Post cargo once and let verified carriers find the right route, date, and capacity across the EAC." action={<button onClick={() => setOpen(true)} className={button}><Plus size={14} /> Post a load</button>} />{query.loading ? <Loading error={query.error} retry={query.reload} /> : <div className="grid gap-4 lg:grid-cols-2">{query.data.map((load) => <Card key={load.id}><div className="flex items-start justify-between gap-3"><div><p className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">{load.cargoType || "General cargo"} · Pickup {dateFmt(load.pickupDate)}</p><h3 className="mt-2 font-display text-xl font-semibold">{load.pickup} <span className="text-xs font-semibold text-muted-foreground">({load.pickupCountry})</span> <ArrowRight className="mx-1 inline text-accent-foreground" size={16} /> {load.dropoff} <span className="text-xs font-semibold text-muted-foreground">({load.dropoffCountry})</span></h3><p className="mt-1 text-xs text-muted-foreground">{load.shipper} · {load.description}</p></div><Status value={load.status} /></div><RoutePreview origin={load.pickup} originCountry={load.pickupCountry || ""} originLocation={load.pickupLocation} destination={load.dropoff} destinationCountry={load.dropoffCountry || ""} destinationLocation={load.dropoffLocation} /><div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4"><div><p className={labelClass}>Weight</p><p className="font-display text-lg font-semibold">{load.weightTons} t</p></div><div><p className={labelClass}>Volume</p><p className="font-display text-lg font-semibold">{load.volumeM3 || "—"} m³</p></div><div><p className={labelClass}>Budget</p><p className="font-display text-lg font-semibold">{money(load.price, load.currency)}</p></div></div><Link href="/matches" className={`${secondaryButton} mt-4`}>Search matching trucks <Search size={14} /></Link></Card>)}</div>}{open && <Modal title="Post a load" eyebrow="Shipper portal" onClose={() => setOpen(false)}><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><LocationSelect label="Pickup city or town" value={form.pickup} onChange={(value) => update("pickup", value)} /><CountrySelect label="Pickup country" value={form.pickupCountry} onChange={(value) => update("pickupCountry", value)} /><LocationSelect label="Drop-off city or town" value={form.dropoff} onChange={(value) => update("dropoff", value)} /><CountrySelect label="Drop-off country" value={form.dropoffCountry} onChange={(value) => update("dropoffCountry", value)} /><Field label="Cargo description" value={form.description} onChange={(value) => update("description", value)} placeholder="Bagged maize, cartons..." /><Field label="Cargo type" value={form.cargoType} onChange={(value) => update("cargoType", value)} /><Field label="Weight (tons)" type="number" value={form.weightTons} onChange={(value) => update("weightTons", value)} /><Field label="Volume (m³)" type="number" value={form.volumeM3} onChange={(value) => update("volumeM3", value)} /><Field label="Pickup date" type="date" value={form.pickupDate} onChange={(value) => update("pickupDate", value)} /><Field label="Budget" type="number" value={form.price} onChange={(value) => update("price", value)} /><label><span className={labelClass}>Budget currency</span><select className={input} value={form.currency} onChange={(event) => update("currency", event.target.value)}>{regionalReference.countries.map((country) => <option key={country.currency} value={country.currency}>{country.currency} · {country.name}</option>)}</select></label></div><button className={`${button} w-full`}><Plus size={14} /> Publish load</button></form></Modal>}</div>;
}

function MatchesPage() {
  const role = useRole();
  const query = useApi<Match[]>("/matches?mode=shipper", []);
  const freight = useApi<Freight[]>("/freight", []);
  const [message, setMessage] = useState("");
  const book = async (trip: Match) => { const load = freight.data[0]; if (!load) { setMessage("Post a load first so a carrier can be booked."); return; } try { await api("/bookings", { method: "POST", body: JSON.stringify({ tripId: trip.id, freightId: load.id, corridor: trip.corridor, amount: load.price }) }); setMessage("Booking created and funds are ready for Mobile Money checkout."); } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : "Booking failed."); } };
  return <div className="space-y-6"><Header eyebrow="Matching engine" title="Find a match" detail={role === "Carrier" ? "Find cargo that fits your route, date, and available capacity." : "Find truck capacity that fits your route, date, and cargo."} action={<div className="flex items-center gap-2 rounded-lg bg-[#e5f1e9] px-3 py-2 text-xs font-bold text-[#28765a]"><Gauge size={14} /> 87% network match rate</div>} />{message && <div className="rounded-lg border border-[#b8d8c6] bg-[#e5f1e9] p-3 text-sm text-[#28765a]">{message} <Link href="/payments" className="ml-2 font-bold underline">Open checkout</Link></div>}{query.loading ? <Loading error={query.error} retry={query.reload} /> : <div className="space-y-3">{query.data.map((match) => <Card key={match.id} className="p-4 sm:p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff0d9] text-[#9a641c]">{match.type === "trip" ? <Truck size={18} /> : <PackageCheck size={18} />}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{match.title}</h3><span className="rounded-full bg-[#e5f1e9] px-2 py-1 font-mono-ui text-[9px] font-bold text-[#28765a]">{match.compatibility}% compatible</span></div><p className="mt-1 text-xs text-muted-foreground">{match.corridor} · {dateFmt(match.date)} · {match.capacity}</p><p className="mt-1 text-[11px] text-muted-foreground">With {match.counterpart}</p></div></div><div className="flex items-center justify-between gap-4 md:justify-end"><strong className="font-display text-xl">{money(match.price)}</strong>{match.type === "trip" && <button onClick={() => book(match)} className={button}>{role === "Carrier" ? "Book load" : "Book truck"} <ArrowRight size={14} /></button>}</div></div></Card>)}</div>}</div>;
}

function BookingsPage() {
  const query = useApi<Booking[]>("/bookings", []);
  const advance = async (booking: Booking, status: string) => { await api(`/bookings/${booking.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); query.reload(); };
  const pod = async (booking: Booking) => { const response = await api<{ devOtp?: string }>(`/bookings/${booking.id}/request-pod`, { method: "POST", body: "{}" }); const otp = window.prompt(`Receiver OTP sent. In development use ${response.devOtp || "the receiver's code"}. Enter OTP:`); if (otp) { await api(`/bookings/${booking.id}/complete-delivery`, { method: "POST", body: JSON.stringify({ otp, photoName: "delivery-proof.jpg" }) }); query.reload(); } };
  return <div className="space-y-6"><Header eyebrow="Financial control" title="Bookings & payout" detail="Move each load through pickup, transit, border handoff, and verified delivery." action={<Link href="/payments" className={button}><Banknote size={14} /> Mobile Money checkout</Link>} /><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Bookings" value={query.data.length} note="All corridors" icon={ClipboardCheck} /><Stat label="Held in escrow" value={money(query.data.filter((item) => item.escrowStatus === "Held").reduce((sum, item) => sum + item.amount, 0))} note="Protected" icon={LockKeyhole} accent /><Stat label="In transit" value={query.data.filter((item) => /transit|border/i.test(item.status)).length} note="Live handoffs" icon={RouteIcon} /><Stat label="Released" value={money(query.data.filter((item) => item.escrowStatus === "Released").reduce((sum, item) => sum + item.amount, 0))} note="Verified delivery" icon={BadgeCheck} /></div>{query.loading ? <Loading error={query.error} retry={query.reload} /> : <div className="space-y-3">{query.data.map((booking) => <Card key={booking.id}><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><div className="flex items-center gap-2"><LockKeyhole size={16} className="text-accent-foreground" /><h3 className="text-sm font-bold">{booking.corridor}</h3><Status value={booking.status} /><Status value={booking.escrowStatus} /></div><p className="mt-2 font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">{booking.id} · booked {dateFmt(booking.bookedAt)} · {booking.paymentStatus || "Unpaid"}</p></div><div className="flex flex-wrap gap-2">{booking.status !== "Delivered" && <button onClick={() => advance(booking, /pickup/i.test(booking.status) ? "In Transit" : /transit/i.test(booking.status) ? "At Border" : "Delivered")} className={secondaryButton}><ArrowRight size={14} /> Advance status</button>}{booking.status !== "Delivered" && <button onClick={() => pod(booking)} className={button}><ShieldCheck size={14} /> Verify delivery</button>}{booking.status === "Delivered" && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#28765a]"><Check size={15} /> Payout unlocked</span>}</div></div><div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4"><div><p className={labelClass}>Load value</p><p className="font-display text-lg font-semibold">{money(booking.amount)}</p></div><div><p className={labelClass}>TruckShare 12%</p><p className="font-display text-lg font-semibold">{money(booking.commissionAmount || booking.amount * .12)}</p></div><div><p className={labelClass}>Carrier 88%</p><p className="font-display text-lg font-semibold text-[#28765a]">{money(booking.carrierPayout || booking.amount * .88)}</p></div></div></Card>)}</div>}</div>;
}

function TrackingPage() {
  const query = useApi<Booking[]>("/bookings", []);
  const active = query.data.find((booking) => booking.status !== "Delivered") || query.data[0];
  const routeStops: RouteStop[] = [
    { label: "Malaba pickup", city: "Malaba", country: "Uganda", position: [0.635, 34.255], status: "complete" },
    { label: "Current position", city: "Jinja", country: "Uganda", position: [0.4479, 33.2026], status: "active" },
    { label: "Kampala delivery", city: "Kampala", country: "Uganda", position: [0.3476, 32.5825], status: "upcoming" },
  ];
  return <div className="space-y-6"><Header eyebrow="Live operations" title="Delivery tracker" detail="Follow pickup, transit, border crossing, and destination handoff from one route view." action={<a href="tel:+256700000000" className={secondaryButton}><Phone size={14} /> Call driver</a>} /><div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]"><Card><div className="relative"><RouteMap stops={routeStops} height="360px" routing /><div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-lg border border-border bg-card/90 p-3 shadow-sm"><p className="font-mono-ui text-[9px] text-muted-foreground">ACTIVE ROUTE</p><p className="mt-1 font-display text-lg font-semibold">{active?.corridor || "Malaba → Kampala"}</p><p className="mt-1 text-[11px] text-muted-foreground">{active?.status || "Awaiting booking"}</p></div></div><div className="grid grid-cols-3 divide-x divide-border border-t border-border p-4 text-center"><div><MapPin className="mx-auto text-accent-foreground" size={17} /><p className="mt-2 text-[11px] font-bold">Pickup</p></div><div><Truck className="mx-auto text-[#28765a]" size={17} /><p className="mt-2 text-[11px] font-bold">In transit</p></div><div><BadgeCheck className="mx-auto text-primary" size={17} /><p className="mt-2 text-[11px] font-bold">Destination</p></div></div></Card><Card><p className={labelClass}>Handoff timeline</p><h3 className="mt-1 font-display text-xl font-semibold">Proof at every step</h3><div className="mt-6 space-y-5">{["En Route to Pickup", "Goods Loaded", "In Transit", "Arrived for Unloading"].map((step, index) => <div key={step} className="flex gap-3"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${index < 2 ? "bg-[#e4f1ea] text-[#28765a]" : "bg-muted text-muted-foreground"}`}>{index < 2 ? <Check size={14} /> : index + 1}</span><div><p className="text-xs font-bold">{step}</p><p className="mt-1 text-[11px] text-muted-foreground">{index < 2 ? "Recorded" : "Waiting for driver update"}</p></div></div>)}</div><Link href="/bookings" className={`${button} mt-7 w-full`}>Manage handoff <ArrowRight size={14} /></Link></Card></div></div>;
}

function MessagesPage() {
  const query = useApi<{ id: string; sender: string; body: string; sentAt: string; read: boolean }[]>("/messages", []);
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    setFeedback("");
    try {
      await api("/messages", { method: "POST", body: JSON.stringify({ body }) });
      setBody("");
      setFeedback("Message sent.");
      query.reload();
    } catch (reason: unknown) {
      setFeedback(reason instanceof Error ? reason.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  };
  return <div className="space-y-6"><Header eyebrow="Coordination" title="Messages" detail="Keep drivers, shippers, and dispatch teams aligned without leaving the booking." action={<a href="tel:+256700000000" className={secondaryButton}><Phone size={14} /> Call counterpart</a>} /><Card className="mx-auto max-w-3xl"><div className="mb-5 flex items-center gap-3 border-b border-border pb-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold">KF</div><div><h3 className="text-sm font-bold">Kivu Foods</h3><p className="text-[11px] text-muted-foreground">Kampala → Mbale · Online</p></div><span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-[#28765a]"><span className="h-1.5 w-1.5 rounded-full bg-[#28765a]" /> Active</span></div><div className="min-h-[280px] space-y-3">{query.data.map((message) => <div key={message.id} className={`flex ${message.sender === "You" ? "justify-end" : "justify-start"}`}><div className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs ${message.sender === "You" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted"}`}><p>{message.body}</p><p className={`mt-2 font-mono-ui text-[9px] ${message.sender === "You" ? "text-primary-foreground/55" : "text-muted-foreground"}`}>{message.sender} · {message.sentAt}</p></div></div>)}</div>{feedback && <p className="mt-3 text-xs text-muted-foreground">{feedback}</p>}<form onSubmit={send} className="mt-4 flex gap-2 border-t border-border pt-4"><input className={input} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message..." /><button type="submit" disabled={sending || !body.trim()} className={button} aria-label="Send message">{sending ? "Sending..." : <Send size={14} />}</button></form></Card></div>;
}

function DocumentsPage() {
  const query = useApi<{ id: string; name: string; type: string; uploadedBy: string; uploadedAt: string; size: string; status: string }[]>("/documents", []);
  const upload = async () => { await api("/documents", { method: "POST", body: JSON.stringify({ name: "Driver logbook — upload pending", type: "Logbook", size: "1.2 MB" }) }); query.reload(); };
  return <div className="space-y-6"><Header eyebrow="Compliance" title="Document hub" detail="Keep consignment notes, customs forms, permits, and proof of delivery attached to the move." action={<button onClick={upload} className={button}><FilePlus2 size={14} /> Add document</button>} />{query.loading ? <Loading error={query.error} retry={query.reload} /> : <Card><div className="space-y-1">{query.data.map((doc) => <div key={doc.id} className="flex flex-col gap-3 border-b border-border py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-primary"><FileText size={18} /></span><div><p className="text-xs font-bold">{doc.name}</p><p className="mt-1 font-mono-ui text-[9px] uppercase tracking-wide text-muted-foreground">{doc.type} · {doc.size} · {doc.uploadedBy}</p></div></div><div className="flex items-center gap-3"><span className="text-[10px] text-muted-foreground">{doc.uploadedAt}</span><Status value={doc.status} /><UploadCloud size={16} className="text-muted-foreground" /></div></div>)}</div></Card>}</div>;
}

function VerificationPage() {
  const query = useApi<Verification[]>("/verification", []);
  const [form, setForm] = useState({ name: "", phone: "+256 ", nin: "", licenseNumber: "", logbookNumber: "", logbookPhotoName: "" });
  const [sent, setSent] = useState(false);
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); await api("/verification", { method: "POST", body: JSON.stringify(form) }); setSent(true); query.reload(); };
  return <div className="mx-auto max-w-4xl space-y-6"><Header eyebrow="Driver trust" title="Get your verified badge" detail="Verified drivers are surfaced first when shippers search a route. Submit NIN, license, and vehicle logbook details for review." />{sent && <div className="rounded-xl border border-[#b8d8c6] bg-[#e5f1e9] p-4 text-sm font-semibold text-[#28765a]"><BadgeCheck className="mr-2 inline" size={17} />Documents submitted. An admin will review your badge request.</div>}<div className="grid gap-5 lg:grid-cols-[1fr_.75fr]"><Card><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Driver / company name" value={form.name} onChange={(value) => update("name", value)} /><Field label="Phone number" value={form.phone} onChange={(value) => update("phone", value)} /><Field label="NIN" value={form.nin} onChange={(value) => update("nin", value)} placeholder="CM..." /><Field label="Driving license number" value={form.licenseNumber} onChange={(value) => update("licenseNumber", value)} placeholder="DL-UG-..." /><Field label="Vehicle logbook number" value={form.logbookNumber} onChange={(value) => update("logbookNumber", value)} /><Field label="Logbook photo" value={form.logbookPhotoName} onChange={(value) => update("logbookPhotoName", value)} placeholder="Select image in production" required={false} /></div><button className={`${button} w-full`}><ShieldCheck size={14} /> Submit for verification</button></form></Card><Card className="bg-[#e5eee9] text-primary"><ShieldCheck size={24} className="text-[#28765a]" /><h3 className="mt-4 font-display text-xl font-semibold">What the badge unlocks</h3><ul className="mt-4 space-y-3 text-sm text-primary/70"><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#28765a]" /> Higher visibility in smart matching</li><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#28765a]" /> Trust signal for new shippers</li><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#28765a]" /> Faster booking acceptance</li></ul></Card></div><Card><div className="mb-4 flex items-center justify-between"><h3 className="font-display text-xl font-semibold">My submissions</h3><RefreshCw size={16} className="text-muted-foreground" /></div>{query.data.length ? <div className="space-y-3">{query.data.map((item) => <div key={item.id} className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">{item.name}</p><p className="text-[11px] text-muted-foreground">{item.licenseNumber} · logbook {item.logbookNumber} · submitted {dateFmt(item.submittedAt)}</p></div><Status value={item.status} /></div>)}</div> : <p className="text-sm text-muted-foreground">No verification submissions yet.</p>}</Card></div>;
}

function AdminPage() {
  const auth = useApi<{ user: AuthUser | null }>("/auth/me", { user: null });
  const query = useApi<{ users: { id: string; name: string; role: string; verified: boolean }[]; verifications: Verification[]; revenue: number; grossVolume: number; activeBookings: number }>("/admin/summary", { users: [], verifications: [], revenue: 0, grossVolume: 0, activeBookings: 0 });
  const review = async (item: Verification, status: string) => { await api(`/verification/${item.id}/review`, { method: "PATCH", body: JSON.stringify({ status }) }); query.reload(); };
  if (auth.loading) return <div className="mx-auto max-w-4xl"><Loading error="" retry={auth.reload} /></div>;
  if (auth.data.user?.role !== "Admin") return <div className="mx-auto max-w-xl py-12"><Card><ShieldCheck className="text-muted-foreground" size={24} /><h2 className="mt-4 font-display text-2xl font-semibold">Admin area</h2><p className="mt-2 text-sm text-muted-foreground">This area is only available to verified admin accounts.</p><Link href="/" className={`${secondaryButton} mt-5`}>Return home <ArrowRight size={14} /></Link></Card></div>;
  return <div className="space-y-6"><Header eyebrow="Platform operations" title="Admin control" detail="Review driver trust signals, manage users, and watch the 12% commission stream." /><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Gross booking volume" value={money(query.data.grossVolume)} note="All time in preview" icon={BarChart3} /><Stat label="Platform revenue" value={money(query.data.revenue)} note="12% commission" icon={Banknote} accent /><Stat label="Active users" value={query.data.users.length} note="Drivers + shippers" icon={UsersRound} /><Stat label="Active bookings" value={query.data.activeBookings} note="Needs attention" icon={ClipboardCheck} /></div><Card><div className="mb-4 flex items-center justify-between"><div><p className={labelClass}>Trust queue</p><h3 className="font-display text-xl font-semibold">Driver verification review</h3></div><ShieldCheck className="text-accent-foreground" /></div><div className="space-y-3">{query.data.verifications.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">{item.name} <span className="ml-2 text-[11px] font-normal text-muted-foreground">{item.phone}</span></p><p className="mt-1 text-[11px] text-muted-foreground">NIN {item.nin} · License {item.licenseNumber} · Logbook {item.logbookNumber}</p></div><div className="flex gap-2"><Status value={item.status} />{item.status === "Pending" && <><button onClick={() => review(item, "Verified")} className={button}><Check size={14} /> Verify</button><button onClick={() => review(item, "Rejected")} className={secondaryButton}>Reject</button></>}</div></div>)}</div></Card><Card><h3 className="font-display text-xl font-semibold">Registered users</h3><div className="mt-4 divide-y divide-border">{query.data.users.map((user) => <div key={user.id} className="flex items-center justify-between py-3"><div className="flex items-center gap-3"><UserRound size={16} className="text-muted-foreground" /><span className="text-xs font-bold">{user.name}</span><span className="text-[10px] text-muted-foreground">{user.role}</span></div>{user.verified && <Status value="Verified" />}</div>)}</div></Card></div>;
}

function PaymentsPage() {
  const query = useApi<Booking[]>("/bookings", []);
  const [network, setNetwork] = useState("MTN MoMo");
  const [phone, setPhone] = useState("+256 700 000 000");
  const [selected, setSelected] = useState("");
  const booking = query.data.find((item) => item.id === selected) || query.data[0];
  const gross = booking?.amount || 1320000;
  const commission = Math.round(gross * .12);
  const [message, setMessage] = useState("");
  const pay = async () => { if (!booking) return; try { await api("/payments/simulate", { method: "POST", body: JSON.stringify({ bookingId: booking.id, network, phone }) }); setMessage("Payment simulated successfully. Funds are held in escrow."); query.reload(); } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : "Payment failed."); } };
  return <div className="mx-auto max-w-4xl space-y-6"><Header eyebrow="Mobile money" title="Checkout & payouts" detail="MTN Mobile Money and Airtel Money simulation with a transparent 12% TruckShare UG commission." />{message && <div className="rounded-lg border border-[#b8d8c6] bg-[#e5f1e9] p-3 text-sm text-[#28765a]">{message}</div>}<div className="grid gap-5 md:grid-cols-[1fr_.8fr]"><Card><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fff0d9] text-[#9a641c]"><Banknote size={19} /></span><div><h3 className="font-display text-xl font-semibold">Fund a booking</h3><p className="text-xs text-muted-foreground">Payment is held until receiver proof of delivery.</p></div></div><div className="mt-6 space-y-4"><label><span className={labelClass}>Booking</span><select className={input} value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Select a booking</option>{query.data.map((item) => <option key={item.id} value={item.id}>{item.corridor} · {money(item.amount)}</option>)}</select></label><label><span className={labelClass}>Payment network</span><select className={input} value={network} onChange={(event) => setNetwork(event.target.value)}><option>MTN MoMo</option><option>Airtel Money</option></select></label><Field label="Ugandan phone number" value={phone} onChange={setPhone} /><button onClick={pay} className={`${button} mt-2 w-full`}><LockKeyhole size={14} /> Simulate payment</button></div></Card><Card className="border-primary/15 bg-[#e5eee9] text-primary"><p className={labelClass}>Transparent split</p><h3 className="font-display text-xl font-semibold">Where the money goes</h3><div className="mt-6 space-y-4 text-sm"><div className="flex justify-between"><span className="text-primary/65">Load price</span><strong>{money(gross)}</strong></div><div className="flex justify-between"><span className="text-primary/65">TruckShare UG · 12%</span><strong>{money(commission)}</strong></div><div className="flex justify-between border-t border-primary/15 pt-4"><span className="font-bold">Carrier payout · 88%</span><strong className="font-display text-2xl">{money(gross - commission)}</strong></div></div><p className="mt-6 text-xs leading-relaxed text-primary/60">Carrier payout unlocks after receiver OTP and delivery photo confirmation.</p></Card></div></div>;
}

function RegionalPaymentsPage() {
  const bookings = useApi<Booking[]>("/bookings", []);
  const reference = useApi<EacReference>("/reference/eac", regionalReference);
  const [selected, setSelected] = useState("");
  const [network, setNetwork] = useState("MTN MoMo");
  const [payerCountry, setPayerCountry] = useState("UG");
  const [payerCurrency, setPayerCurrency] = useState("UGX");
  const [phone, setPhone] = useState("+256 700 000 000");
  const [quote, setQuote] = useState<PaymentQuote>();
  const [message, setMessage] = useState("");
  const booking = bookings.data.find((item) => item.id === selected) || bookings.data[0];
  const getQuote = async () => {
    if (!booking) return;
    const params = new URLSearchParams({ amount: String(booking.amount), fromCurrency: payerCurrency, toCurrency: booking.currency || "UGX", payerCountry, payeeCountry: booking.destinationCountry || "UG" });
    try { setQuote(await api<PaymentQuote>(`/payments/quote?${params.toString()}`)); setMessage(""); } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : "Unable to create settlement quote."); }
  };
  const pay = async () => {
    if (!booking) return;
    try { await api("/payments/simulate", { method: "POST", body: JSON.stringify({ bookingId: booking.id, network, phone, payerCountry, currency: payerCurrency, settlementAmount: booking.amount }) }); setMessage("Payment simulated and held in escrow."); bookings.reload(); } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : "Payment failed."); }
  };
  return <div className="mx-auto max-w-5xl space-y-6"><Header eyebrow="Regional settlement" title="Cross-border checkout" detail="Choose the payer market, preview the indicative FX quote and fees, then fund the booking through a supported network." />{message && <div className="rounded-lg border border-[#b8d8c6] bg-[#e5f1e9] p-3 text-sm text-[#28765a]">{message}</div>}<div className="grid gap-5 lg:grid-cols-[1fr_.85fr]"><Card><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fff0d9] text-[#9a641c]"><Globe2 size={19} /></span><div><h3 className="font-display text-xl font-semibold">Fund a regional booking</h3><p className="text-xs text-muted-foreground">The booking value stays fixed in the carrier’s currency; only the payer amount changes with FX.</p></div></div><div className="mt-6 space-y-4"><label><span className={labelClass}>Booking</span><select className={input} value={selected} onChange={(event) => { setSelected(event.target.value); setQuote(undefined); }}><option value="">Select a booking</option>{bookings.data.map((item) => <option key={item.id} value={item.id}>{item.corridor} · {money(item.amount, item.currency)}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label><span className={labelClass}>Payer country</span><select className={input} value={payerCountry} onChange={(event) => { const country = reference.data.countries.find((item) => item.code === event.target.value); setPayerCountry(event.target.value); if (country) setPayerCurrency(country.currency); setQuote(undefined); }} >{reference.data.countries.map((country) => <option key={country.code} value={country.code}>{country.name} ({country.code})</option>)}</select></label><label><span className={labelClass}>Payer currency</span><select className={input} value={payerCurrency} onChange={(event) => { setPayerCurrency(event.target.value); setQuote(undefined); }}>{reference.data.countries.map((country) => <option key={country.currency} value={country.currency}>{country.currency}</option>)}</select></label></div><label><span className={labelClass}>Payment network</span><select className={input} value={network} onChange={(event) => setNetwork(event.target.value)}><option>MTN MoMo</option><option>Airtel Money</option><option>Bank Transfer</option></select></label><Field label="EAC phone number" value={phone} onChange={setPhone} /><div className="flex flex-col gap-2 sm:flex-row"><button onClick={getQuote} className={`${secondaryButton} flex-1`}><RefreshCw size={14} /> Preview FX quote</button><button onClick={pay} disabled={!booking} className={`${button} flex-1`}><LockKeyhole size={14} /> Simulate and hold</button></div></div></Card><Card className="border-primary/15 bg-[#e5eee9] text-primary"><p className={labelClass}>Settlement preview</p>{quote ? <div className="mt-4 space-y-4 text-sm"><div className="flex justify-between"><span className="text-primary/65">Payer pays</span><strong>{money(quote.payerAmount ?? quote.amount, quote.currency)}</strong></div><div className="flex justify-between"><span className="text-primary/65">FX rate</span><strong>1 {quote.currency} = {quote.exchangeRate} {quote.settlementCurrency}</strong></div><div className="flex justify-between"><span className="text-primary/65">Booking value (fixed)</span><strong>{money(quote.settlementAmount, quote.settlementCurrency)}</strong></div><div className="flex justify-between"><span className="text-primary/65">Fees + commission</span><strong>{money(quote.fee + quote.commissionAmount, quote.settlementCurrency)}</strong></div><div className="flex justify-between border-t border-primary/15 pt-4"><span className="font-bold">Carrier payout</span><strong className="font-display text-2xl">{money(quote.carrierPayout, quote.settlementCurrency)}</strong></div><p className="text-[11px] leading-5 text-primary/60">The UGX booking amount is not replaced by the foreign currency amount. This is an indicative quote · expires in {quote.expiresInSeconds}s.</p></div> : <div className="mt-5 space-y-3 text-sm text-primary/70"><p>Select a booking and payer market to calculate the payer amount before collecting payment.</p><p>Supported networks: MTN MoMo, Airtel Money, and bank transfer.</p></div>}</Card></div></div>;
}

function EacNetworkPage() {
  const reference = useApi<EacReference>("/reference/eac", regionalReference);
  const bookings = useApi<Booking[]>("/bookings", []);
  const bookingId = bookings.data[0]?.id || "booking-1";
  const milestones = useApi<BorderMilestone[]>(`/bookings/${bookingId}/border-milestones`, []);
  return <div className="space-y-6"><Header eyebrow="Regional operations" title="EAC network control" detail="See the supported settlement currencies, starter corridors, and customs handoffs that make cross-border bookings operational." /><Card><div className="mb-4 flex items-center justify-between"><div><p className={labelClass}>Network map</p><h3 className="mt-1 font-display text-xl font-semibold">Routes across East Africa</h3><p className="mt-1 text-xs text-muted-foreground">Starter corridors from the TruckShare network.</p></div><Globe2 className="text-accent-foreground" size={22} /></div><EacNetworkMap /></Card><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><Card><div className="flex items-center justify-between"><div><p className={labelClass}>Supported markets</p><h3 className="mt-1 font-display text-xl font-semibold">{reference.data.countries.length} countries · local currencies</h3></div><Globe2 className="text-accent-foreground" size={22} /></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{reference.data.countries.map((country) => <div key={country.code} className="rounded-lg border border-border bg-muted/40 p-3"><p className="font-mono-ui text-[10px] font-bold text-accent-foreground">{country.code}</p><p className="mt-1 text-xs font-semibold">{country.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{country.currency}</p></div>)}</div></Card><Card className="border-primary/15 bg-[#e5eee9] text-primary"><p className={labelClass}>Settlement foundation</p><h3 className="mt-1 font-display text-xl font-semibold">Quote before you collect</h3><p className="mt-3 text-sm leading-relaxed text-primary/70">Every payment can carry a payer country, payee country, source currency, settlement currency, indicative FX rate, and transparent fee split.</p><Link href="/payments" className={`${button} mt-5`}>Open regional checkout <ArrowRight size={14} /></Link></Card></div><Card><div className="mb-5 flex items-center justify-between"><div><p className={labelClass}>Starter corridors</p><h3 className="mt-1 font-display text-xl font-semibold">Border-aware routes</h3></div><RouteIcon className="text-accent-foreground" size={20} /></div><div className="grid gap-3 md:grid-cols-2">{reference.data.corridors.map((corridor) => <div key={`${corridor.originCountry}-${corridor.destinationCountry}`} className="rounded-lg border border-border p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">{corridor.origin} <span className="text-accent-foreground">→</span> {corridor.destination}</p><span className="font-mono-ui text-[9px] font-bold text-muted-foreground">{corridor.originCountry}/{corridor.destinationCountry}</span></div><p className="mt-2 text-xs text-muted-foreground">Border checkpoints: {corridor.border}</p></div>)}</div></Card><Card><div className="mb-5 flex items-center justify-between"><div><p className={labelClass}>Customs handoff</p><h3 className="mt-1 font-display text-xl font-semibold">Booking {bookingId} milestones</h3></div><Status value={milestones.data.length ? milestones.data[milestones.data.length - 1].status : "Planned"} /></div>{milestones.data.length ? <div className="grid gap-3 md:grid-cols-2">{milestones.data.map((milestone) => <div key={milestone.id} className="rounded-lg border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{milestone.checkpoint}</p><p className="mt-1 text-[11px] text-muted-foreground">{milestone.country} · {milestone.requiredDocuments.length} required documents</p></div><Status value={milestone.status} /></div></div>)}</div> : <p className="text-sm text-muted-foreground">No border milestones have been recorded for this booking yet.</p>}</Card></div>;
}

function HomePage() {
  const role = useRole();
  const bookings = useApi<Booking[]>("/bookings", []);
  const activeBooking = bookings.data.find((booking) => booking.status !== "Delivered");
  const firstAction = role === "Shipper" ? { href: "/freight", title: "Post a load", detail: "Tell carriers what needs moving.", icon: PackageCheck } : { href: "/trips", title: "Post a trip", detail: "Tell shippers where you are going.", icon: Truck };
  const discoveryAction = role === "Shipper" ? { title: "Find a truck", detail: "Find capacity for your shipment." } : { title: "Find a load", detail: "Use your available space." };
  return <div className="mx-auto max-w-4xl space-y-6"><div className="home-heading"><Header eyebrow="Home" title="What do you need today?" detail="Choose one thing to get started. You can always come back here." /></div><div className="home-action-grid grid gap-3 sm:grid-cols-3"><Link href={firstAction.href} className="rounded-xl border border-accent/40 bg-[#fff5e3] p-5 transition hover:-translate-y-0.5"><firstAction.icon size={20} className="text-[#9a641c]" /><p className="mt-5 text-base font-bold">{firstAction.title}</p><p className="mt-1 text-xs text-muted-foreground">{firstAction.detail}</p></Link><Link href="/matches" className="rounded-xl border border-border bg-card p-5 transition hover:-translate-y-0.5"><RouteIcon size={20} className="text-primary" /><p className="mt-5 text-base font-bold">{discoveryAction.title}</p><p className="mt-1 text-xs text-muted-foreground">{discoveryAction.detail}</p></Link><Link href="/bookings" className="rounded-xl border border-border bg-card p-5 transition hover:-translate-y-0.5"><LockKeyhole size={20} className="text-primary" /><p className="mt-5 text-base font-bold">My bookings</p><p className="mt-1 text-xs text-muted-foreground">See what needs your attention.</p></Link></div><Card><div className="flex items-center justify-between gap-4"><div><p className={labelClass}>Your next step</p><h3 className="mt-1 font-display text-xl font-semibold">{activeBooking ? activeBooking.corridor : "Nothing booked yet"}</h3>{activeBooking ? <p className="mt-1 text-sm text-muted-foreground">Your booking is {activeBooking.status.toLowerCase()}.</p> : <p className="mt-1 text-sm text-muted-foreground">Start by posting a trip or finding a truck.</p>}</div>{activeBooking ? <Link href="/tracking" className={secondaryButton}>Track delivery <ArrowRight size={14} /></Link> : <Link href={firstAction.href} className={button}>Get started <ArrowRight size={14} /></Link>}</div></Card></div>;
}

function AccountPage() {
  const auth = useApi<{ user: AuthUser | null }>("/auth/me", { user: null });
  const [name, setName] = useState("");
  const [country, setCountry] = useState("UG");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!auth.data.user) return;
    setName(auth.data.user.name);
    setCountry(auth.data.user.country);
  }, [auth.data.user?.id]);

  const user = auth.data.user;
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setFeedback("");
    try {
      const result = await api<{ user: AuthUser; message: string }>("/auth/profile", { method: "PATCH", body: JSON.stringify({ name, country }) });
      auth.setData({ user: result.user });
      setFeedback(result.message);
    } catch (reason: unknown) {
      setFeedback(reason instanceof Error ? reason.message : "Your profile could not be updated.");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setFeedback("The new passwords do not match.");
      return;
    }
    setSavingPassword(true);
    setFeedback("");
    try {
      const result = await api<{ user: AuthUser; message: string }>("/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      auth.setData({ user: result.user });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback(result.message);
    } catch (reason: unknown) {
      setFeedback(reason instanceof Error ? reason.message : "Your password could not be updated.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (auth.loading) return <div className="mx-auto max-w-4xl"><Loading error={auth.error} retry={auth.reload} /></div>;
  if (!user) return <div className="mx-auto max-w-4xl"><Loading error="Your account could not be loaded." retry={auth.reload} /></div>;
  return <div className="mx-auto max-w-4xl space-y-6">
    <Header eyebrow="Account" title="My account" detail="Keep your contact details, sign-in security, and account documents in one place." />
    {feedback && <div className="rounded-lg border border-[#b8d8c6] bg-[#e5f1e9] p-3 text-sm text-[#28765a]">{feedback}</div>}
    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <Card>
        <div className="mb-5 flex items-center gap-3 border-b border-border pb-5"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d9a35c] text-sm font-bold text-primary">{initials(user.name)}</div><div><h3 className="font-display text-xl font-semibold">{user.name}</h3><p className="text-xs text-muted-foreground">{user.role} account · {user.verified ? "Verified account" : "Verification pending"}</p></div></div>
        <form onSubmit={saveProfile} className="space-y-4">
          <Field label="Name or business name" value={name} onChange={setName} />
          <label><span className={labelClass}>Country</span><select className={input} value={country} onChange={(event) => setCountry(event.target.value)}>{regionalReference.countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-2"><div><span className={labelClass}>Email</span><p className="mt-2 text-sm">{user.email || "Not added"}</p></div><div><span className={labelClass}>Phone</span><p className="mt-2 text-sm">{user.phone || "Not verified"}</p></div></div>
          <div><span className={labelClass}>Roles</span><p className="mt-2 text-sm">{user.roles?.join(" · ") || user.role}</p></div>
          <button type="submit" disabled={savingProfile} className={button}><Save size={14} /> {savingProfile ? "Saving..." : "Save profile"}</button>
        </form>
      </Card>
      <Card>
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-primary"><KeyRound size={18} /></span><div><h3 className="font-display text-xl font-semibold">{user.hasPassword ? "Change password" : "Set a password"}</h3><p className="text-xs text-muted-foreground">{user.hasPassword ? "Use your current password to choose a new one." : "Add a password as another way to secure your account."}</p></div></div>
        <form onSubmit={changePassword} className="mt-5 space-y-4">
          {user.hasPassword && <Field label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} />}
          <Field label="New password" type="password" value={newPassword} onChange={setNewPassword} placeholder="At least 8 characters" />
          <Field label="Confirm new password" type="password" value={confirmPassword} onChange={setConfirmPassword} />
          <button type="submit" disabled={savingPassword} className={`${button} w-full`}>{savingPassword ? "Updating..." : user.hasPassword ? "Change password" : "Set password"} <KeyRound size={14} /></button>
        </form>
      </Card>
    </div>
    <Card>
      <div className="mb-4"><p className={labelClass}>Account checklist</p><h3 className="mt-1 font-display text-xl font-semibold">Documents and verification</h3><p className="mt-1 text-sm text-muted-foreground">These used to be separate menu items. They now live here with the rest of your account.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/documents" className="flex items-center justify-between rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-muted/40"><span className="flex items-center gap-3"><FileCheck2 size={19} className="text-primary" /><span><span className="block text-sm font-bold">Documents</span><span className="mt-1 block text-xs text-muted-foreground">Upload consignment, customs, and delivery records.</span></span></span><ChevronRight size={16} /></Link>
        <Link href="/verification" className="flex items-center justify-between rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-muted/40"><span className="flex items-center gap-3"><ShieldCheck size={19} className="text-primary" /><span><span className="block text-sm font-bold">Verify account</span><span className="mt-1 block text-xs text-muted-foreground">Submit identity, license, and vehicle details.</span></span></span><ChevronRight size={16} /></Link>
      </div>
    </Card>
  </div>;
}

function Router() { return <ErrorBoundary resetKey={useLocation()[0]}><Shell><Switch><Route path="/" component={HomePage} /><Route path="/trips" component={TripsPage} /><Route path="/freight" component={FreightPage} /><Route path="/matches" component={MatchesPage} /><Route path="/bookings" component={BookingsPage} /><Route path="/tracking" component={TrackingPage} /><Route path="/messages" component={MessagesPage} /><Route path="/account" component={AccountPage} /><Route path="/documents" component={DocumentsPage} /><Route path="/verification" component={VerificationPage} /><Route path="/admin" component={AdminPage} /><Route path="/payments" component={RegionalPaymentsPage} /><Route path="/regional" component={EacNetworkPage} /><Route component={NotFound} /></Switch></Shell></ErrorBoundary>; }
export default function App() { return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><Router /></WouterRouter>; }