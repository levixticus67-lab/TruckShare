import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  getGetDashboardQueryKey,
  getListBookingsQueryKey,
  getListDocumentsQueryKey,
  getListFreightQueryKey,
  getListMatchesQueryKey,
  getListMessagesQueryKey,
  getListTripsQueryKey,
  useCreateBooking,
  useCreateDocument,
  useCreateFreight,
  useCreateMessage,
  useCreateTrip,
  useGetDashboard,
  useListBookings,
  useListDocuments,
  useListFreight,
  useListMatches,
  useListMessages,
  useListTrips,
  useUpdateBookingStatus,
} from '@workspace/api-client-react';
import { setBaseUrl } from '@workspace/api-client-react';
import { AdminPage, AuthModal, EditCenterPage, FreightEditButton, PaymentsPage, TrackingPage, TripEditButton, VerificationPage } from '@/features/TruckSharePanels';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Banknote,
  BadgeCheck,
  BarChart3,
  Bell,
  Box,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FilePlus2,
  FileText,
  Filter,
  Fuel,
  Gauge,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Menu,
  MessageSquare,
  MoreHorizontal,
  PackageCheck,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  UploadCloud,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
setBaseUrl(import.meta.env.VITE_API_URL || null);

const nav = [
  { href: '/', label: 'Command center', icon: LayoutDashboard },
  { href: '/trips', label: 'Return trips', icon: RouteIcon },
  { href: '/freight', label: 'Load board', icon: PackageCheck },
  { href: '/matches', label: 'Smart matching', icon: Gauge },
  { href: '/bookings', label: 'Bookings & payout', icon: LockKeyhole },
  { href: '/tracking', label: 'Live tracker', icon: MapPin },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/documents', label: 'Document hub', icon: FileCheck2 },
  { href: '/verification', label: 'Driver verification', icon: ShieldCheck },
  { href: '/admin', label: 'Admin control', icon: UsersRound },
  { href: '/payments', label: 'Mobile money', icon: Banknote },
  { href: '/edit', label: 'Edit records', icon: SlidersHorizontal },
];

const dateFmt = (value?: string) =>
  value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';
const timeFmt = (value?: string) =>
  value ? new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const money = (value?: number) =>
  typeof value === 'number' ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) : '—';

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3" data-testid="link-logo">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-[11px] bg-accent text-primary">
        <span className="absolute left-[9px] top-[9px] h-[7px] w-[20px] rounded-full border-[2px] border-current border-l-0" />
        <span className="absolute left-[9px] top-[20px] h-[7px] w-[20px] rounded-full border-[2px] border-current border-l-0" />
        <span className="absolute left-[8px] top-[7px] h-[23px] w-[4px] rounded-full bg-current" />
      </span>
      <span>
        <span className="block font-display text-[18px] font-bold tracking-[-.04em] text-sidebar-foreground">truckshare ug</span>
        <span className="font-mono-ui text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/50">every trip pays</span>
      </span>
    </Link>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState<'Carrier' | 'Shipper'>('Carrier');
  const [authOpen, setAuthOpen] = useState(false);
  const current = nav.find((item) => item.href === location) ?? nav[0];
  return (
    <div className="noise min-h-[100dvh] bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground shadow-2xl transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-8 flex items-center justify-between px-2">
          <Logo />
          <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent lg:hidden" data-testid="button-close-menu">
            <X size={18} />
          </button>
        </div>
        <div className="mb-6 px-2">
          <p className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-sidebar-foreground/40">Operating as</p>
          <div className="mt-2 flex rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-1">
            {(['Carrier', 'Shipper'] as const).map((item) => (
              <button type="button" key={item} onClick={() => setRole(item)} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${role === item ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/55 hover:text-sidebar-foreground'}`} data-testid={`button-role-${item.toLowerCase()}`}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <nav className="space-y-1">
          <p className="mb-2 px-3 font-mono-ui text-[9px] uppercase tracking-[.16em] text-sidebar-foreground/35">Operations</p>
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.href === location;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`group flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${active ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}>
                <span className="flex items-center gap-3"><Icon size={17} strokeWidth={active ? 2.4 : 1.8} /><span>{item.label}</span></span>
                {item.href === '/messages' && <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-primary' : 'bg-accent'}`} />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold"><span className="live-dot h-2 w-2 rounded-full bg-[#65c7a1]" /> Border network live</div>
            <p className="mt-2 text-[11px] leading-relaxed text-sidebar-foreground/45">17 corridors syncing · next refresh in 42s</p>
          </div>
          <div className="flex items-center gap-3 border-t border-sidebar-border px-2 pt-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4a7181] text-xs font-bold text-sidebar-foreground">NS</div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">Northstar Haulage</p><p className="truncate text-[10px] text-sidebar-foreground/45">Dispatch team · Toronto</p></div>
            <button type="button" onClick={() => setMobileOpen(false)} className="text-sidebar-foreground/40 hover:text-sidebar-foreground" data-testid="button-profile-menu"><MoreHorizontal size={17} /></button>
          </div>
        </div>
      </aside>
      {mobileOpen && <button aria-label="Close navigation" type="button" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-primary/35 lg:hidden" data-testid="button-overlay-close" />}
      <main className="min-h-[100dvh] lg:pl-[258px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg border border-border bg-card p-2 lg:hidden" data-testid="button-open-menu"><Menu size={18} /></button>
            <div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">TruckShare UG / {current.label}</p><h1 className="mt-0.5 font-display text-xl font-semibold tracking-[-.03em]">{current.label}</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground sm:flex"><span className="live-dot h-1.5 w-1.5 rounded-full bg-[#329477]" /> API synced</span>
            <button type="button" onClick={() => setMobileOpen(false)} className="relative rounded-lg border border-border bg-card p-2.5 text-muted-foreground hover:text-foreground" data-testid="button-notifications"><Bell size={17} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" /></button>
             <button type="button" onClick={() => setAuthOpen(true)} className="hidden rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-bold hover:bg-muted sm:block" data-testid="button-open-auth">Sign in / Register</button>
             <div className="hidden h-8 w-px bg-border sm:block" />
            <span className="hidden text-right sm:block"><span className="block text-xs font-semibold">Nadia Singh</span><span className="block text-[10px] text-muted-foreground">Fleet coordinator</span></span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d9a35c] text-xs font-bold text-primary" data-testid="avatar-current-user">NS</div>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}

function QueryState({ loading, error, empty, retry, children }: { loading: boolean; error: boolean; empty?: boolean; retry?: () => void; children: ReactNode }) {
  if (loading) return <div className="space-y-3" data-testid="state-loading">{[1, 2, 3].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl border border-border bg-card/70" />)}</div>;
  if (error) return <div className="rounded-xl border border-[#e4b4a9] bg-[#fbefeb] p-8 text-center" data-testid="state-error"><CircleAlert className="mx-auto text-destructive" size={25} /><h3 className="mt-3 font-display text-lg font-semibold">The signal dropped</h3><p className="mt-1 text-sm text-muted-foreground">We could not reach the operations feed.</p>{retry && <button type="button" onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground" data-testid="button-retry"><RefreshCw size={14} /> Try again</button>}</div>;
  if (empty) return <div className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-14 text-center" data-testid="state-empty"><Inbox className="mx-auto text-muted-foreground/50" size={30} /><h3 className="mt-3 font-display text-lg font-semibold">Nothing on the board yet</h3><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Post a move or adjust your corridor filters to bring the next opportunity into view.</p></div>;
  return <>{children}</>;
}

function Button({ children, onClick, type = 'button', variant = 'primary', disabled, testId }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; testId: string }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold transition-all duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${variant === 'primary' ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90' : variant === 'secondary' ? 'border border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} data-testid={testId}>{children}</button>;
}

function SectionHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-accent-foreground/60">{eyebrow}</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-.04em] text-foreground">{title}</h2>{detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}</div>{action}</div>;
}

function StatCard({ label, value, note, icon: Icon, accent = false }: { label: string; value: string | number; note: string; icon: typeof Activity; accent?: boolean }) {
  return <div className={`animate-rise rounded-xl border p-4 ${accent ? 'border-primary/20 bg-primary text-primary-foreground' : 'border-border bg-card'}`} data-testid={`card-stat-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="flex items-start justify-between"><p className={`font-mono-ui text-[10px] uppercase tracking-[.13em] ${accent ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{label}</p><span className={`rounded-md p-1.5 ${accent ? 'bg-primary-foreground/10' : 'bg-muted'}`}><Icon size={15} /></span></div><p className="mt-5 font-display text-3xl font-semibold tracking-[-.05em]">{value}</p><p className={`mt-1 text-[11px] ${accent ? 'text-primary-foreground/65' : 'text-muted-foreground'}`}>{note}</p></div>;
}

function Dashboard() {
  const dashboard = useGetDashboard();
  const trips = useListTrips();
  const freight = useListFreight();
  const bookings = useListBookings();
  const data = dashboard.data;
  const tripRows = (trips.data ?? []).slice(0, 4);
  return <div className="space-y-7">
    <div className="animate-rise flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground"><span className="live-dot h-1.5 w-1.5 rounded-full bg-[#329477]" /> Tuesday, October 08 · 06:42 EDT</div><h2 className="max-w-xl font-display text-[clamp(2.2rem,5vw,4.2rem)] font-semibold leading-[.93] tracking-[-.065em]">Turn the road<br /><span className="text-accent-foreground">into revenue.</span></h2><p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">A clear view of every empty mile, active load, and border handoff across your network.</p></div><div className="flex items-center gap-2"><Link href="/matches" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs font-bold hover:bg-muted" data-testid="link-dashboard-matches">Open matching desk <ArrowRight size={14} /></Link><Link href="/trips" className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2.5 text-xs font-bold text-accent-foreground shadow-sm hover:bg-accent/90" data-testid="link-dashboard-post-trip"><Plus size={15} /> Post a trip</Link></div></div>
    <QueryState loading={dashboard.isLoading} error={dashboard.isError} retry={() => dashboard.refetch()}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active trips" value={data?.activeTrips ?? 0} note="Across 8 corridors" icon={Truck} />
        <StatCard label="Available loads" value={data?.availableLoads ?? freight.data?.length ?? 0} note="Ready to match" icon={PackageCheck} accent />
        <StatCard label="In transit" value={data?.inTransit ?? 0} note="2 at border today" icon={RouteIcon} />
        <StatCard label="Delivered" value={data?.delivered ?? 0} note="This operating month" icon={CircleCheck} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground">Network pulse</p><h3 className="mt-1 font-display text-xl font-semibold tracking-[-.035em]">Where the margin is moving</h3></div><span className="rounded-md bg-[#e6f1eb] px-2 py-1 font-mono-ui text-[10px] font-bold text-[#24795b]">LIVE</span></div>
          <div className="paper-grid relative h-[220px] overflow-hidden rounded-lg border border-border/70 bg-[#f4f0e7] p-5">
            <div className="absolute left-[9%] top-[28%] h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/15" /><div className="absolute left-[27%] top-[50%] h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/15" /><div className="absolute left-[62%] top-[28%] h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/15" /><div className="absolute right-[10%] top-[64%] h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/15" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 220" preserveAspectRatio="none"><path d="M75 65 C145 110, 155 120, 220 110 S370 75, 500 65 S610 100, 710 145" fill="none" stroke="#d7984e" strokeDasharray="5 7" strokeWidth="2" /><path d="M220 110 C320 165, 360 172, 430 140 S560 95, 610 65" fill="none" stroke="#2d8066" strokeDasharray="4 6" strokeWidth="1.5" /></svg>
            <div className="absolute bottom-4 left-5 rounded-md border border-border bg-card/90 px-2.5 py-1.5 shadow-sm"><p className="font-mono-ui text-[9px] text-muted-foreground">WINDSOR → TORONTO</p><p className="text-[11px] font-bold">6 active moves</p></div>
            <div className="absolute right-5 top-4 text-right"><p className="font-mono-ui text-[9px] text-muted-foreground">NETWORK COVERAGE</p><p className="font-display text-xl font-semibold">81.4%</p></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><p className="font-display text-lg font-semibold">14</p><p className="font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">Open corridors</p></div><div className="border-x border-border"><p className="font-display text-lg font-semibold">2.8h</p><p className="font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">Avg. match time</p></div><div><p className="font-display text-lg font-semibold">+$4.2k</p><p className="font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">Margin recovered</p></div></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground">Signal log</p><h3 className="mt-1 font-display text-xl font-semibold tracking-[-.035em]">Recent activity</h3></div><Link href="/messages" className="text-[11px] font-bold text-accent-foreground hover:underline" data-testid="link-dashboard-activity">View all</Link></div><QueryState loading={dashboard.isLoading} error={dashboard.isError} empty={!data?.recentActivity?.length} retry={() => dashboard.refetch()}><div className="divide-y divide-border">{(data?.recentActivity ?? []).slice(0, 5).map((item) => <div key={item.id} className="flex gap-3 py-3 first:pt-0" data-testid={`activity-${item.id}`}><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{item.label}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.detail}</p></div><time className="shrink-0 font-mono-ui text-[9px] text-muted-foreground">{item.time}</time></div>)}</div></QueryState></div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6"><SectionHeader eyebrow="Next departures" title="Return trips on deck" detail="The next capacity leaving your network" action={<Link href="/trips" className="text-xs font-bold text-accent-foreground hover:underline" data-testid="link-dashboard-trips">All trips <ArrowRight className="ml-1 inline" size={13} /></Link>} /><QueryState loading={trips.isLoading} error={trips.isError} empty={!tripRows.length} retry={() => trips.refetch()}><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead><tr className="border-b border-border font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground"><th className="pb-3 font-normal">Route</th><th className="pb-3 font-normal">Departure</th><th className="pb-3 font-normal">Equipment</th><th className="pb-3 text-right font-normal">Capacity</th><th className="pb-3 text-right font-normal">Status</th></tr></thead><tbody>{tripRows.map((trip) => <tr key={trip.id} className="border-b border-border/70 last:border-0"><td className="py-3"><p className="text-xs font-bold">{trip.origin} <ArrowRight className="mx-1 inline text-muted-foreground" size={12} /> {trip.destination}</p><p className="mt-0.5 font-mono-ui text-[9px] text-muted-foreground">{trip.corridor}</p></td><td className="py-3 text-xs">{dateFmt(trip.departureDate)}</td><td className="py-3 text-xs text-muted-foreground">{trip.vehicleType}</td><td className="py-3 text-right font-mono-ui text-[10px]">{trip.capacityTons} t</td><td className="py-3 text-right"><StatusPill value={trip.status} /></td></tr>)}</tbody></table></div></QueryState></div>
        <div className="rounded-xl border border-primary/15 bg-[#e5eee9] p-5 sm:p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#32775f]">Escrow watch</p><h3 className="mt-1 font-display text-xl font-semibold tracking-[-.035em] text-primary">Money in motion</h3><p className="mt-3 text-sm leading-relaxed text-primary/65">Every booked move is held until the handoff is verified. No chasing invoices at the border.</p><p className="mt-7 font-display text-4xl font-semibold tracking-[-.06em] text-primary">{money(data?.totalEscrow ?? bookings.data?.reduce((sum, b) => sum + b.amount, 0))}</p><p className="mt-1 font-mono-ui text-[9px] uppercase tracking-wider text-primary/50">currently secured</p><div className="mt-6 flex items-center justify-between border-t border-primary/15 pt-4"><span className="text-xs text-primary/65">Network match rate</span><span className="font-mono-ui text-sm font-bold text-primary">{data?.matchRate ?? 0}%</span></div><Link href="/bookings" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline" data-testid="link-dashboard-escrow">Review escrow <ArrowRight size={13} /></Link></div>
      </div>
    </QueryState>
  </div>;
}

function StatusPill({ value }: { value?: string }) {
  const tone = value?.toLowerCase().includes('deliver') || value?.toLowerCase().includes('release') || value?.toLowerCase().includes('verif') ? 'green' : value?.toLowerCase().includes('border') || value?.toLowerCase().includes('transit') || value?.toLowerCase().includes('held') ? 'amber' : value?.toLowerCase().includes('reject') ? 'red' : 'slate';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono-ui text-[9px] font-bold uppercase tracking-wide ${tone === 'green' ? 'bg-[#e4f1ea] text-[#28765a]' : tone === 'amber' ? 'bg-[#fff0d9] text-[#9a641c]' : tone === 'red' ? 'bg-[#fbe8e5] text-[#ad4339]' : 'bg-muted text-muted-foreground'}`} data-testid={`status-${value?.toLowerCase().replaceAll(' ', '-')}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{value || 'Unknown'}</span>;
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/35 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true"><div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl"><div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card/95 p-5 backdrop-blur sm:p-6"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">{eyebrow}</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-.04em]">{title}</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" data-testid="button-close-dialog"><X size={18} /></button></div><div className="p-5 sm:p-6">{children}</div></div></div>;
}

function Field({ label, value, onChange, placeholder, type = 'text', required = true }: { label: string; value: string | number; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return <label className="block"><span className="mb-1.5 block font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground">{label}{required && <span className="text-accent-foreground"> *</span>}</span><input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-accent focus:ring-2 focus:ring-accent/15" data-testid={`input-${label.toLowerCase().replaceAll(' ', '-')}`} /></label>;
}

function TripForm({ onClose }: { onClose: () => void }) {
  const mutation = useCreateTrip();
  const [form, setForm] = useState({ origin: 'Kampala', destination: 'Mbale', departureDate: '', vehicleType: 'Fuso', capacityTons: '8', capacityM3: '42', price: '680', priceType: 'Fixed' });
  const qc = useQueryClient();
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate({ data: { ...form, capacityTons: Number(form.capacityTons), capacityM3: Number(form.capacityM3), price: Number(form.price) } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListTripsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); onClose(); } }); };
  return <form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Origin" value={form.origin} onChange={(v) => setForm({ ...form, origin: v })} placeholder="Kampala" /><Field label="Destination" value={form.destination} onChange={(v) => setForm({ ...form, destination: v })} placeholder="Mbale, Gulu, Mbarara or Malaba" /><Field label="Departure date" type="date" value={form.departureDate} onChange={(v) => setForm({ ...form, departureDate: v })} /><label className="block"><span className="mb-1.5 block font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground">Truck type *</span><select required value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" data-testid="select-vehicle-type"><option>Fuso</option><option>Canter</option><option>Trailer</option><option>Flatbed</option></select></label><Field label="Capacity (tons)" type="number" value={form.capacityTons} onChange={(v) => setForm({ ...form, capacityTons: v })} /><Field label="Space (m³)" type="number" value={form.capacityM3} onChange={(v) => setForm({ ...form, capacityM3: v })} /><Field label="Trip price (UGX)" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} /><label className="block"><span className="mb-1.5 block font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground">Price type *</span><select value={form.priceType} onChange={(e) => setForm({ ...form, priceType: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" data-testid="select-price-type"><option>Fixed</option><option>Per Ton</option></select></label></div><div className="flex items-center justify-end gap-2 border-t border-border pt-5"><Button variant="secondary" onClick={onClose} testId="button-cancel-trip">Cancel</Button><Button type="submit" disabled={mutation.isPending} testId="button-submit-trip">{mutation.isPending ? <LoaderCircle className="animate-spin" size={14} /> : <Plus size={14} />} Post return trip</Button></div>{mutation.isError && <p className="text-right text-xs text-destructive">Could not post this trip. Check the route and try again.</p>}</form>;
}

function FreightForm({ onClose }: { onClose: () => void }) {
  const mutation = useCreateFreight();
  const [form, setForm] = useState({ pickup: '', dropoff: '', description: '', weightTons: '12', dimensions: '4 pallets · 8 m³', pickupDate: '', price: '680' });
  const qc = useQueryClient();
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate({ data: { ...form, weightTons: Number(form.weightTons), price: Number(form.price) } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListFreightQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); onClose(); } }); };
  return <form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Pickup" value={form.pickup} onChange={(v) => setForm({ ...form, pickup: v })} placeholder="Montréal, QC" /><Field label="Dropoff" value={form.dropoff} onChange={(v) => setForm({ ...form, dropoff: v })} placeholder="Detroit, MI" /><Field label="Pickup date" type="date" value={form.pickupDate} onChange={(v) => setForm({ ...form, pickupDate: v })} /><Field label="Weight (tons)" type="number" value={form.weightTons} onChange={(v) => setForm({ ...form, weightTons: v })} /><Field label="Dimensions" value={form.dimensions} onChange={(v) => setForm({ ...form, dimensions: v })} /><Field label="Budget" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} /></div><label className="block"><span className="mb-1.5 block font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground">Load description *</span><textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What needs to move, and what should the driver know?" className="min-h-24 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15" data-testid="input-load-description" /></label><div className="flex items-center justify-end gap-2 border-t border-border pt-5"><Button variant="secondary" onClick={onClose} testId="button-cancel-freight">Cancel</Button><Button type="submit" disabled={mutation.isPending} testId="button-submit-freight">{mutation.isPending ? <LoaderCircle className="animate-spin" size={14} /> : <Plus size={14} />} Post freight request</Button></div>{mutation.isError && <p className="text-right text-xs text-destructive">Could not post this load. Try again.</p>}</form>;
}

function TripsPage() {
  const [open, setOpen] = useState(false);
  const [corridor, setCorridor] = useState('');
  const [search, setSearch] = useState('');
  const params = useMemo(() => ({ corridor: corridor || undefined }), [corridor]);
  const query = useListTrips(params);
  const rows = (query.data ?? []).filter((trip) => `${trip.origin} ${trip.destination} ${trip.corridor} ${trip.carrier}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6"><SectionHeader eyebrow="Carrier network" title="Return trips" detail="Turn scheduled backhaul capacity into booked miles." action={<Button onClick={() => setOpen(true)} testId="button-open-trip-form"><Plus size={15} /> Post a return trip</Button>} /><div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search route, carrier, corridor" className="h-9 w-full rounded-md bg-muted/60 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-accent/20" data-testid="input-search-trips" /></div><div className="flex items-center gap-2"><Filter size={14} className="text-muted-foreground" /><select value={corridor} onChange={(e) => setCorridor(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs" data-testid="select-trip-corridor"><option value="">All corridors</option><option value="Windsor–Toronto">Windsor–Toronto</option><option value="Montréal–Detroit">Montréal–Detroit</option><option value="Buffalo–Hamilton">Buffalo–Hamilton</option></select><button type="button" onClick={() => { setCorridor(''); setSearch(''); }} className="rounded-md p-2 text-muted-foreground hover:bg-muted" data-testid="button-reset-trip-filters"><RefreshCw size={14} /></button></div></div><div className="rounded-xl border border-border bg-card p-4 sm:p-6"><QueryState loading={query.isLoading} error={query.isError} empty={!rows.length} retry={() => query.refetch()}><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead><tr className="border-b border-border font-mono-ui text-[9px] uppercase tracking-[.13em] text-muted-foreground"><th className="pb-3 font-normal">Carrier / route</th><th className="pb-3 font-normal">Corridor</th><th className="pb-3 font-normal">Departure</th><th className="pb-3 font-normal">Vehicle</th><th className="pb-3 text-right font-normal">Capacity</th><th className="pb-3 text-right font-normal">Price</th><th className="pb-3 text-right font-normal">Status</th></tr></thead><tbody>{rows.map((trip) => <tr key={trip.id} className="group border-b border-border/70 transition-colors last:border-0 hover:bg-muted/35" data-testid={`row-trip-${trip.id}`}><td className="py-4"><p className="text-xs font-bold">{trip.origin} <ArrowRight className="mx-1 inline text-accent-foreground" size={12} /> {trip.destination}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#d9a35c] text-[8px] font-bold text-primary">{trip.carrier?.slice(0, 1)}</span>{trip.carrier} · {trip.carrierRating ? `${trip.carrierRating.toFixed(1)} rating` : 'new carrier'}</p></td><td className="py-4 text-xs text-muted-foreground">{trip.corridor}</td><td className="py-4 text-xs font-medium">{dateFmt(trip.departureDate)}</td><td className="py-4 text-xs text-muted-foreground">{trip.vehicleType}</td><td className="py-4 text-right font-mono-ui text-[10px]">{trip.capacityTons} t <span className="text-muted-foreground">/ {trip.capacityM3} m³</span></td><td className="py-4 text-right text-xs font-bold">{money(trip.price)}<span className="block font-mono-ui text-[9px] font-normal text-muted-foreground">{trip.priceType}</span></td><td className="py-4 text-right"><StatusPill value={trip.status} /></td></tr>)}</tbody></table></div></QueryState></div>{open && <Modal eyebrow="Carrier desk" title="Post a return trip" onClose={() => setOpen(false)}><TripForm onClose={() => setOpen(false)} /></Modal>}</div>;
}

function FreightPage() {
  const [open, setOpen] = useState(false);
  const [corridor, setCorridor] = useState('');
  const [search, setSearch] = useState('');
  const params = useMemo(() => ({ corridor: corridor || undefined }), [corridor]);
  const query = useListFreight(params);
  const rows = (query.data ?? []).filter((load) => `${load.pickup} ${load.dropoff} ${load.corridor} ${load.shipper} ${load.description}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6"><SectionHeader eyebrow="Shipper network" title="Freight board" detail="Loads looking for a reliable return leg." action={<Button onClick={() => setOpen(true)} testId="button-open-freight-form"><Plus size={15} /> Post a freight request</Button>} /><div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shipper, route, load detail" className="h-9 w-full rounded-md bg-muted/60 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-accent/20" data-testid="input-search-freight" /></div><div className="flex items-center gap-2"><Filter size={14} className="text-muted-foreground" /><select value={corridor} onChange={(e) => setCorridor(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs" data-testid="select-freight-corridor"><option value="">All corridors</option><option value="Windsor–Toronto">Windsor–Toronto</option><option value="Montréal–Detroit">Montréal–Detroit</option><option value="Buffalo–Hamilton">Buffalo–Hamilton</option></select></div></div><div className="rounded-xl border border-border bg-card p-4 sm:p-6"><QueryState loading={query.isLoading} error={query.isError} empty={!rows.length} retry={() => query.refetch()}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((load) => <div key={load.id} className="group rounded-xl border border-border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md" data-testid={`card-freight-${load.id}`}><div className="flex items-start justify-between"><span className="rounded-md bg-[#e6f1eb] px-2 py-1 font-mono-ui text-[9px] font-bold uppercase tracking-wide text-[#28765a]">{load.status}</span><button type="button" onClick={() => setSearch(load.shipper)} className="rounded p-1 text-muted-foreground hover:bg-muted" data-testid={`button-freight-menu-${load.id}`}><MoreHorizontal size={16} /></button></div><p className="mt-4 text-sm font-bold">{load.pickup} <ArrowRight className="mx-1 inline text-accent-foreground" size={13} /> {load.dropoff}</p><p className="mt-1 font-mono-ui text-[9px] uppercase tracking-wide text-muted-foreground">{load.corridor}</p><p className="mt-4 min-h-10 text-xs leading-relaxed text-muted-foreground">{load.description}</p><div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3"><div><p className="font-mono-ui text-[9px] uppercase text-muted-foreground">Pickup</p><p className="mt-1 text-xs font-semibold">{dateFmt(load.pickupDate)}</p></div><div><p className="font-mono-ui text-[9px] uppercase text-muted-foreground">Weight</p><p className="mt-1 text-xs font-semibold">{load.weightTons} t · {load.dimensions}</p></div></div><div className="mt-4 flex items-center justify-between"><span className="text-[11px] text-muted-foreground">{load.shipper}</span><span className="font-display text-lg font-semibold">{money(load.price)}</span></div></div>)}</div></QueryState></div>{open && <Modal eyebrow="Shipper desk" title="Post a freight request" onClose={() => setOpen(false)}><FreightForm onClose={() => setOpen(false)} /></Modal>}</div>;
}

function MatchesPage() {
  const [mode, setMode] = useState<'carrier' | 'shipper'>('carrier');
  const [corridor, setCorridor] = useState('');
  const [bookMatch, setBookMatch] = useState<any>(null);
  const params = useMemo(() => ({ mode, corridor: corridor || undefined }), [mode, corridor]);
  const query = useListMatches(params);
  const trips = useListTrips();
  const freight = useListFreight();
  const matches = query.data ?? [];
  return <div className="space-y-6"><SectionHeader eyebrow="Matching desk" title="Corridor matches" detail="Compatibility scored on lane, timing, and usable capacity." action={<div className="flex items-center gap-2"><button type="button" onClick={() => setMode('carrier')} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'carrier' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground'}`} data-testid="button-mode-carrier">I have capacity</button><button type="button" onClick={() => setMode('shipper')} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'shipper' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground'}`} data-testid="button-mode-shipper">I have freight</button></div>} /><div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center"><div className="flex items-center gap-2 text-xs font-semibold"><SlidersHorizontal size={15} className="text-accent-foreground" /> Tune the desk</div><select value={corridor} onChange={(e) => setCorridor(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs sm:ml-auto" data-testid="select-match-corridor"><option value="">All corridors</option><option value="Windsor–Toronto">Windsor–Toronto</option><option value="Montréal–Detroit">Montréal–Detroit</option><option value="Buffalo–Hamilton">Buffalo–Hamilton</option></select><Button variant="secondary" onClick={() => { setCorridor(''); setMode('carrier'); }} testId="button-reset-match-filters">Reset</Button></div><QueryState loading={query.isLoading} error={query.isError} empty={!matches.length} retry={() => query.refetch()}><div className="space-y-3">{matches.map((match) => <div key={match.id} className="grid gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-accent/50 hover:shadow-sm md:grid-cols-[1.4fr_1fr_.6fr_auto] md:items-center" data-testid={`card-match-${match.id}`}><div><div className="flex items-center gap-2"><span className={`rounded-md px-2 py-1 font-mono-ui text-[9px] font-bold uppercase ${match.type === 'trip' ? 'bg-[#e8edf4] text-[#3b5875]' : 'bg-[#fff0d9] text-[#9a641c]'}`}>{match.type === 'trip' ? 'Capacity' : 'Freight'}</span><span className="font-mono-ui text-[9px] text-muted-foreground">{match.id}</span></div><p className="mt-2 text-sm font-bold">{match.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{match.corridor} · {dateFmt(match.date)} · {match.capacity}</p></div><div><div className="mb-1 flex justify-between text-[10px]"><span className="text-muted-foreground">Compatibility</span><strong>{match.compatibility}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#32866b]" style={{ width: `${match.compatibility}%` }} /></div><p className="mt-1 text-[10px] text-muted-foreground">{match.counterpart || 'Verified network counterpart'}</p></div><p className="font-display text-xl font-semibold">{money(match.price)}</p><Button onClick={() => setBookMatch(match)} testId={`button-book-match-${match.id}`}>Review match <ArrowRight size={14} /></Button></div>)}</div></QueryState>{bookMatch && <BookingForm match={bookMatch} trips={trips.data ?? []} freight={freight.data ?? []} onClose={() => setBookMatch(null)} />}</div>;
}

function BookingForm({ match, trips, freight, onClose }: { match: any; trips: any[]; freight: any[]; onClose: () => void }) {
  const mutation = useCreateBooking();
  const qc = useQueryClient();
  const [form, setForm] = useState({ tripId: trips[0]?.id ?? '', freightId: freight[0]?.id ?? '', amount: String(match.price ?? ''), corridor: match.corridor ?? '' });
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate({ data: { ...form, amount: Number(form.amount) } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBookingsQueryKey() }); qc.invalidateQueries({ queryKey: getListMatchesQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); onClose(); } }); };
  return <Modal eyebrow="Booking & escrow" title="Secure this match" onClose={onClose}><form onSubmit={submit} className="space-y-5"><div className="rounded-xl bg-[#e5eee9] p-4 text-primary"><p className="font-mono-ui text-[10px] uppercase tracking-wider text-primary/55">Selected match</p><p className="mt-2 text-sm font-bold">{match.title}</p><p className="mt-1 text-xs text-primary/65">{match.corridor} · {match.capacity}</p></div><label className="block"><span className="mb-1.5 block font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground">Return trip *</span><select required value={form.tripId} onChange={(e) => setForm({ ...form, tripId: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" data-testid="select-booking-trip"><option value="">Choose a trip</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.origin} → {trip.destination} · {dateFmt(trip.departureDate)}</option>)}</select></label><label className="block"><span className="mb-1.5 block font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground">Freight request *</span><select required value={form.freightId} onChange={(e) => setForm({ ...form, freightId: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" data-testid="select-booking-freight"><option value="">Choose freight</option>{freight.map((load) => <option key={load.id} value={load.id}>{load.pickup} → {load.dropoff} · {load.weightTons} t</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><Field label="Agreed amount" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} /><Field label="Corridor" value={form.corridor} onChange={(v) => setForm({ ...form, corridor: v })} /></div><div className="flex items-start gap-2 rounded-lg border border-border p-3 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 shrink-0 text-[#28765a]" size={16} /><span>Funds will be held in escrow and released when the delivery handoff is confirmed.</span></div><div className="flex justify-end gap-2 border-t border-border pt-5"><Button variant="secondary" onClick={onClose} testId="button-cancel-booking">Cancel</Button><Button type="submit" disabled={mutation.isPending || !form.tripId || !form.freightId} testId="button-submit-booking">{mutation.isPending ? <LoaderCircle className="animate-spin" size={14} /> : <LockKeyhole size={14} />} Hold in escrow</Button></div>{mutation.isError && <p className="text-right text-xs text-destructive">Booking could not be secured. Verify both records.</p>}</form></Modal>;
}

function BookingsPage() {
  const query = useListBookings();
  const update = useUpdateBookingStatus();
  const qc = useQueryClient();
  const advance = (id: string, status: string) => update.mutate({ id, data: { status } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBookingsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); } });
  const nextStatus = (status: string) => status.toLowerCase().includes('book') ? 'In Transit' : status.toLowerCase().includes('transit') ? 'At Border' : status.toLowerCase().includes('border') ? 'Delivered' : null;
  return <div className="space-y-6"><SectionHeader eyebrow="Financial control" title="Bookings & escrow" detail="Track every commitment from held funds to delivered freight." action={<Link href="/matches" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs font-bold hover:bg-muted" data-testid="link-bookings-matches">Find a match <ArrowRight size={14} /></Link>} /><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label="Total bookings" value={query.data?.length ?? 0} note="Across active corridors" icon={ClipboardCheck} /><StatCard label="Held in escrow" value={money(query.data?.filter((b) => b.escrowStatus === 'Held').reduce((sum, b) => sum + b.amount, 0))} note="Protected until delivery" icon={LockKeyhole} accent /><StatCard label="In transit" value={query.data?.filter((b) => b.status.toLowerCase().includes('transit')).length ?? 0} note="Handoffs in progress" icon={RouteIcon} /><StatCard label="Released" value={money(query.data?.filter((b) => b.escrowStatus === 'Released').reduce((sum, b) => sum + b.amount, 0))} note="Cleared this month" icon={BadgeCheck} /></div><div className="rounded-xl border border-border bg-card p-4 sm:p-6"><QueryState loading={query.isLoading} error={query.isError} empty={!query.data?.length} retry={() => query.refetch()}><div className="space-y-3">{(query.data ?? []).map((booking) => { const next = nextStatus(booking.status); return <div key={booking.id} className="rounded-xl border border-border p-4" data-testid={`card-booking-${booking.id}`}><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div className="flex min-w-0 items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"><LockKeyhole size={17} /></div><div className="min-w-0"><p className="truncate text-sm font-bold">{booking.corridor}</p><p className="mt-1 font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">Booking {booking.id} · {dateFmt(booking.bookedAt)}</p></div></div><div className="flex items-center gap-2"><StatusPill value={booking.status} /><StatusPill value={booking.escrowStatus} /></div></div><div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4"><div><p className="font-mono-ui text-[9px] uppercase text-muted-foreground">Trip</p><p className="mt-1 truncate text-xs font-semibold">{booking.tripId}</p></div><div><p className="font-mono-ui text-[9px] uppercase text-muted-foreground">Freight</p><p className="mt-1 truncate text-xs font-semibold">{booking.freightId}</p></div><div><p className="font-mono-ui text-[9px] uppercase text-muted-foreground">Value</p><p className="mt-1 font-display text-lg font-semibold">{money(booking.amount)}</p></div><div className="flex items-end justify-end">{next && <Button disabled={update.isPending} onClick={() => advance(booking.id, next)} testId={`button-advance-booking-${booking.id}`}>{next === 'Delivered' ? <CircleCheck size={14} /> : <ArrowRight size={14} />} Mark {next}</Button>}{booking.status.toLowerCase().includes('deliver') && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#28765a]"><BadgeCheck size={15} /> Complete</span>}</div></div></div>; })}</div></QueryState></div></div>;
}

function MessagesPage() {
  const query = useListMessages();
  const mutation = useCreateMessage();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const send = (e: FormEvent) => { e.preventDefault(); if (!body.trim()) return; mutation.mutate({ data: { body: body.trim() } }, { onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: getListMessagesQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); } }); };
  return <div className="space-y-6"><SectionHeader eyebrow="Live negotiation" title="Messages" detail="Keep the handoff moving without leaving the operating desk." action={<span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground"><span className="live-dot h-1.5 w-1.5 rounded-full bg-[#329477]" /> Network online</span>} /><div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]"><div className="rounded-xl border border-border bg-card p-4"><p className="mb-3 font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground">Conversations</p><div className="rounded-lg border border-accent/40 bg-[#fff4e3] p-3"><div className="flex items-center justify-between"><p className="text-xs font-bold">Windsor–Toronto lane</p><span className="h-2 w-2 rounded-full bg-accent" /></div><p className="mt-1 truncate text-[11px] text-muted-foreground">Latest operations conversation</p><p className="mt-2 font-mono-ui text-[9px] text-muted-foreground">ACTIVE · 2 unread</p></div><div className="mt-2 rounded-lg p-3 text-muted-foreground hover:bg-muted"><p className="text-xs font-bold text-foreground">Montréal–Detroit lane</p><p className="mt-1 text-[11px]">No new activity</p></div><div className="mt-2 rounded-lg p-3 text-muted-foreground hover:bg-muted"><p className="text-xs font-bold text-foreground">Buffalo–Hamilton lane</p><p className="mt-1 text-[11px]">No new activity</p></div></div><div className="flex min-h-[520px] flex-col rounded-xl border border-border bg-card"><div className="flex items-center justify-between border-b border-border p-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4a7181] text-xs font-bold text-sidebar-foreground">RT</div><div><p className="text-sm font-bold">Riverside Transport</p><p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-[#329477]" /> Negotiating · Windsor–Toronto</p></div></div><button type="button" onClick={() => query.refetch()} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" data-testid="button-message-settings"><MoreHorizontal size={17} /></button></div><div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"><QueryState loading={query.isLoading} error={query.isError} empty={!query.data?.length} retry={() => query.refetch()}><div className="space-y-4">{(query.data ?? []).map((message) => <div key={message.id} className={`flex ${message.sender === 'Northstar Haulage' ? 'justify-end' : 'justify-start'}`} data-testid={`message-${message.id}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 ${message.sender === 'Northstar Haulage' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted'}`}><p className="text-xs leading-relaxed">{message.body}</p><p className={`mt-2 font-mono-ui text-[9px] ${message.sender === 'Northstar Haulage' ? 'text-primary-foreground/55' : 'text-muted-foreground'}`}>{message.sender} · {timeFmt(message.sentAt)}</p></div></div>)}</div></QueryState></div><form onSubmit={send} className="flex items-end gap-2 border-t border-border p-3"><textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write an operational note..." className="min-h-11 flex-1 resize-none rounded-lg bg-muted/60 px-3 py-3 text-xs outline-none focus:ring-2 focus:ring-accent/20" data-testid="input-message-body" /><Button type="submit" disabled={mutation.isPending || !body.trim()} testId="button-send-message">{mutation.isPending ? <LoaderCircle className="animate-spin" size={14} /> : <Send size={14} />} Send</Button></form></div></div></div>;
}

function DocumentsPage() {
  const query = useListDocuments();
  const mutation = useCreateDocument();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'Consignment', size: '—' });
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate({ data: form }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() }); setForm({ name: '', type: 'Consignment', size: '—' }); setOpen(false); } }); };
  const groups = ['All documents', 'Consignment', 'Customs', 'Permits', 'Proof of delivery'];
  const [group, setGroup] = useState('All documents');
  const rows = (query.data ?? []).filter((doc) => group === 'All documents' || doc.type === group || (group === 'Proof of delivery' && doc.type === 'PoD'));
  return <div className="space-y-6"><SectionHeader eyebrow="Compliance desk" title="Document hub" detail="Every paper trail for every crossing, in one calm place." action={<Button onClick={() => setOpen(true)} testId="button-open-document-form"><UploadCloud size={15} /> Add document</Button>} /><div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-2">{groups.map((item) => <button type="button" key={item} onClick={() => setGroup(item)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${group === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} data-testid={`button-document-filter-${item.toLowerCase().replaceAll(' ', '-')}`}>{item}</button>)}</div><div className="rounded-xl border border-border bg-card p-4 sm:p-6"><div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-lg bg-muted/60 p-3"><p className="font-mono-ui text-[9px] uppercase text-muted-foreground">Total files</p><p className="mt-2 font-display text-2xl font-semibold">{query.data?.length ?? 0}</p></div><div className="rounded-lg bg-[#e5eee9] p-3"><p className="font-mono-ui text-[9px] uppercase text-[#28765a]">Verified</p><p className="mt-2 font-display text-2xl font-semibold text-primary">{query.data?.filter((d) => d.status === 'Verified').length ?? 0}</p></div><div className="rounded-lg bg-[#fff0d9] p-3"><p className="font-mono-ui text-[9px] uppercase text-[#9a641c]">Pending</p><p className="mt-2 font-display text-2xl font-semibold">{query.data?.filter((d) => d.status === 'Pending').length ?? 0}</p></div><div className="rounded-lg bg-muted/60 p-3"><p className="font-mono-ui text-[9px] uppercase text-muted-foreground">Across moves</p><p className="mt-2 font-display text-2xl font-semibold">08</p></div></div><QueryState loading={query.isLoading} error={query.isError} empty={!rows.length} retry={() => query.refetch()}><div className="divide-y divide-border">{rows.map((doc) => <div key={doc.id} className="flex flex-col gap-3 py-4 first:pt-2 sm:flex-row sm:items-center sm:justify-between" data-testid={`row-document-${doc.id}`}><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-primary"><FileText size={18} /></div><div><p className="text-xs font-bold">{doc.name}</p><p className="mt-1 font-mono-ui text-[9px] uppercase tracking-wide text-muted-foreground">{doc.type} · {doc.size} · Uploaded by {doc.uploadedBy}</p></div></div><div className="flex items-center gap-3 sm:justify-end"><span className="text-[10px] text-muted-foreground">{dateFmt(doc.uploadedAt)}</span><StatusPill value={doc.status} /><button type="button" onClick={() => query.refetch()} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" data-testid={`button-document-menu-${doc.id}`}><MoreHorizontal size={16} /></button></div></div>)}</div></QueryState></div>{open && <Modal eyebrow="Compliance desk" title="Add a document" onClose={() => setOpen(false)}><form onSubmit={submit} className="space-y-5"><Field label="File name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Bill of lading · trip 8F2" /><label className="block"><span className="mb-1.5 block font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground">Document type *</span><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" data-testid="select-document-type"><option>Consignment</option><option>Customs</option><option>Permits</option><option>PoD</option></select></label><Field label="File size" value={form.size} onChange={(v) => setForm({ ...form, size: v })} placeholder="1.4 MB" required={false} /><div className="flex items-center justify-end gap-2 border-t border-border pt-5"><Button variant="secondary" onClick={() => setOpen(false)} testId="button-cancel-document">Cancel</Button><Button type="submit" disabled={mutation.isPending} testId="button-submit-document">{mutation.isPending ? <LoaderCircle className="animate-spin" size={14} /> : <FilePlus2 size={14} />} Add to hub</Button></div></form></Modal>}</div>;
}

function Router() {
  return <RoutedErrorBoundary><Shell><Switch><Route path="/" component={Dashboard} /><Route path="/trips" component={TripsPage} /><Route path="/freight" component={FreightPage} /><Route path="/matches" component={MatchesPage} /><Route path="/bookings" component={BookingsPage} /><Route path="/tracking" component={TrackingPage} /><Route path="/messages" component={MessagesPage} /><Route path="/documents" component={DocumentsPage} /><Route path="/verification" component={VerificationPage} /><Route path="/admin" component={AdminPage} /><Route path="/payments" component={PaymentsPage} /><Route path="/edit" component={EditCenterPage} /><Route component={NotFound} /></Switch></Shell></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
