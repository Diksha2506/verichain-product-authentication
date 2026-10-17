import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Blocks, Box,
  ChevronDown, CircleAlert, ClipboardCheck, Clock3, Database, Download, ExternalLink, FileCheck2,
  FileText, Fingerprint, Gauge, History, LayoutDashboard, ListFilter, MapPin, Menu, PackageCheck,
  Plus, Search, Shield, ShieldAlert, ShieldCheck, Sparkles, Upload, WalletCards, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateRisk, describeRisk, riskFactorRows } from "@/lib/riskEngine";
import { getProduct, getProducts, getVerificationHistory, verifyProduct as verifyProductMock, getBlockchainTransactions } from "@/lib/mockApi";
import { verifyProduct, API_CONFIG } from "@/lib/api";
import type { Product } from "@/types/product";
import type { BlockchainEvidence, ProvenanceEvidence, RiskEvidence, VerificationState } from "@/types/verification";

// ─── Service-layer data (components must not import mockData directly) ────────
const products = getProducts();
const demoTransactions = getBlockchainTransactions();
const recentActivity = getVerificationHistory();

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VeriChain — Product Verification Console" },
      { name: "description", content: "Verify product authenticity, trace provenance, and review risk-adaptive clone detection with VeriChain." },
      { property: "og:title", content: "VeriChain — Product Verification Console" },
      { property: "og:description", content: "Trust what you scan. Verify product authenticity with provenance and risk intelligence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VeriChainApp,
});

type Page = "overview" | "verify" | "registry" | "supply" | "risk" | "history" | "alerts" | "analytics" | "admin";
type Result = {
  id: string;
  status: Product["status"] | "NOT FOUND" | "INDETERMINATE";
  score: number;
  decisionReason?: string;
  blockchainEvidence?: BlockchainEvidence;
  provenanceEvidence?: ProvenanceEvidence;
  riskEvidence?: RiskEvidence;
};

const navGroups: { label: string; items: { page: Page; label: string; icon: typeof LayoutDashboard; count?: string }[] }[] = [
  { label: "Console", items: [
    { page: "overview", label: "Overview", icon: LayoutDashboard },
    { page: "verify", label: "Verify product", icon: Fingerprint },
    { page: "registry", label: "Product registry", icon: Box, count: "24.8k" },
    { page: "supply", label: "Supply chain", icon: Blocks },
    { page: "risk", label: "Risk intelligence", icon: Gauge },
    { page: "history", label: "Verification history", icon: History },
  ] },
  { label: "Monitor", items: [
    { page: "alerts", label: "Alerts", icon: CircleAlert, count: "4" },
    { page: "analytics", label: "Analytics", icon: Activity },
    { page: "admin", label: "Admin", icon: WalletCards },
  ] },
];

const pageTitles: Record<Page, string> = {
  overview: "Verification overview", verify: "Verify a product", registry: "Product registry",
  supply: "Supply chain", risk: "Risk intelligence", history: "Verification history",
  alerts: "Alert center", analytics: "Analytics", admin: "Product registration",
};

function VeriChainApp() {
  const [page, setPage] = useState<Page>("overview");
  const [productId, setProductId] = useState("VC-NIKE-001");
  const [result, setResult] = useState<Result | null>(null);
  const [step, setStep] = useState(-1);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<"7 days" | "30 days">("7 days");
  const [filter, setFilter] = useState("All");
  const [historyFilter, setHistoryFilter] = useState("All outcomes");
  const [selectedNode, setSelectedNode] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [expandedWhy, setExpandedWhy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [notice, setNotice] = useState("");
  const [registrySearch, setRegistrySearch] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [registrationStep, setRegistrationStep] = useState(0);
  const [registered, setRegistered] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step < 0 || step >= 5) return;
    const timer = window.setTimeout(async () => {
      const nextStep = step + 1;
      if (nextStep >= 5) {
        const apiResult = await verifyProduct({ productId });
        if (apiResult.ok) {
          const d = apiResult.data;
          setResult({
            id: d.productId,
            status: (d.outcome === "NOT FOUND" ? "NOT FOUND" : d.outcome) as Result["status"],
            score: d.riskAssessment.totalScore,
            decisionReason: d.decisionReason,
            blockchainEvidence: d.blockchainEvidence,
            provenanceEvidence: d.provenanceEvidence,
            riskEvidence: d.riskEvidence,
          });
        } else {
          // If in mock mode, use the mock data. If in real API mode, display the explicit error notice without silently returning mock results.
          if (API_CONFIG.USE_MOCK) {
            const found = verifyProductMock(productId);
            setResult({ id: productId.toUpperCase().trim(), status: found.product?.status ?? "NOT FOUND", score: found.riskScore });
          } else {
            setResult(null);
            setNotice(`Backend verification failed: ${apiResult.error ?? "API unavailable"}`);
          }
        }
        setStep(5);
      } else setStep(nextStep);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [step, productId]);

  const runVerification = (id = productId) => {
    const normalized = id.trim().toUpperCase();
    if (!normalized) { setNotice("Enter a product ID to begin verification."); return; }
    setNotice("");
    setProductId(normalized);
    setResult(null);
    setStep(0);
    setPage("verify");
  };

  const startDemo = (id: string) => {
    setDemoOpen(false);
    runVerification(id);
  };

  const searchMatches = search.trim() ? products.filter((product) => `${product.name} ${product.id} ${product.manufacturer} ${product.batch}`.toLowerCase().includes(search.toLowerCase())) : [];

  return (
    <div className="instrument-grid min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_84%_0%,color-mix(in_oklab,var(--cyan)_10%,transparent),transparent_44%),radial-gradient(ellipse_at_0%_100%,color-mix(in_oklab,var(--cyan)_5%,transparent),transparent_40%)]" />
      <div className="relative flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[226px] shrink-0 flex-col border-r border-line bg-background/95 px-3 py-4 lg:flex">
          <Brand />
          <Sidebar page={page} onNavigate={setPage} />
          <div className="mt-auto rounded-md border border-line bg-panel p-3">
            <div className="flex items-center gap-2 text-[10px] font-mono text-green"><span className="instrument-pulse size-1.5 rounded-full bg-green" />NETWORK CONNECTED</div>
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">Block 18,429,703</div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">Finality · 2.4 sec</div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-[72px] lg:pb-0">
          <header className="sticky top-0 z-30 flex h-[58px] items-center gap-3 border-b border-line bg-background/95 px-4 backdrop-blur-md lg:px-6">
            <button onClick={() => setMobileOpen(!mobileOpen)} className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-panel-raised lg:hidden" aria-label="Open navigation">
              {mobileOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
            <div className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground">
              <span className="hidden sm:inline">Console /</span><span className="truncate text-foreground">{pageTitles[page]}</span>
            </div>
            <div className="relative ml-auto flex items-center gap-2">
              <div className="relative hidden w-[min(31vw,255px)] sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                <Input aria-label="Search products" placeholder="Search product, batch, hash…" value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 border-line bg-panel pl-9 font-mono text-xs" />
                {search && <div className="absolute left-0 right-0 top-[42px] z-50 overflow-hidden rounded-md border border-line bg-panel shadow-xl">
                  {searchMatches.length ? searchMatches.map((product) => <button key={product.id} onClick={() => { setSearch(""); runVerification(product.id); }} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-panel-raised"><span className="min-w-0 truncate text-xs">{product.name}</span><span className="shrink-0 font-mono text-[10px] text-cyan">{product.id}</span></button>) : <p className="p-3 text-xs text-muted-foreground">No matching product found.</p>}
                </div>}
              </div>
              <div className="hidden items-center gap-1.5 rounded-md border border-green/25 bg-green/5 px-2.5 py-2 font-mono text-[10px] text-green md:flex"><span className="instrument-pulse size-1.5 rounded-full bg-green" />LEDGER LIVE</div>
              <Button onClick={() => { setPage("alerts"); setMobileOpen(false); }} variant="outline" size="icon" aria-label="View alerts" className="h-9 w-9 border-line bg-panel text-muted-foreground"><AlertTriangle size={16} /></Button>
              <div className="grid size-9 place-items-center rounded-md border border-cyan/30 bg-cyan/10 text-xs font-semibold text-cyan">VC</div>
            </div>
          </header>

          {mobileOpen && <div className="fixed inset-x-0 top-[58px] z-40 max-h-[calc(100vh-132px)] overflow-auto border-b border-line bg-panel p-3 lg:hidden"><Sidebar page={page} onNavigate={(next) => { setPage(next); setMobileOpen(false); }} /></div>}

          <main className="mx-auto w-full max-w-[1440px] min-w-0 flex-1 p-4 sm:p-5 lg:p-6">
            {page === "overview" && <Overview onNavigate={setPage} onVerify={runVerification} onHistory={(id) => runVerification(id)} onDemo={() => setDemoOpen(!demoOpen)} demoOpen={demoOpen} onDemoPick={startDemo} period={period} setPeriod={setPeriod} />}
            {page === "verify" && <VerifyScreen productId={productId} setProductId={setProductId} result={result} step={step} runVerification={runVerification} onScanner={() => setScannerOpen(true)} fileInput={fileInput} fileName={fileName} setFileName={setFileName} notice={notice} setNotice={setNotice} onRisk={() => setPage("risk")} />}
            {page === "registry" && <Registry search={registrySearch} setSearch={setRegistrySearch} filter={filter} setFilter={setFilter} pageNumber={pageNumber} setPageNumber={setPageNumber} onOpen={runVerification} />}
            {page === "supply" && <SupplyChain selectedNode={selectedNode} setSelectedNode={setSelectedNode} onVerify={runVerification} />}
            {page === "risk" && <RiskIntelligence onOpen={runVerification} />}
            {page === "history" && <HistoryScreen filter={historyFilter} setFilter={setHistoryFilter} onOpen={runVerification} />}
            {page === "alerts" && <Alerts onOpen={runVerification} />}
            {page === "analytics" && <Analytics period={period} setPeriod={setPeriod} selectedTransaction={selectedTransaction} setSelectedTransaction={setSelectedTransaction} />}
            {page === "admin" && <Admin registrationStep={registrationStep} setRegistrationStep={setRegistrationStep} registered={registered} setRegistered={setRegistered} />}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 border-t border-line bg-background/95 px-1 backdrop-blur lg:hidden">
        {[{ page: "overview" as Page, label: "Overview", icon: LayoutDashboard }, { page: "verify" as Page, label: "Verify", icon: Fingerprint }, { page: "registry" as Page, label: "Registry", icon: Box }, { page: "alerts" as Page, label: "Alerts", icon: CircleAlert }, { page: "risk" as Page, label: "Risk", icon: Gauge }].map(({ page: target, label, icon: Icon }) => <button key={target} onClick={() => setPage(target)} className={`flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] ${page === target ? "text-cyan" : "text-muted-foreground"}`}><Icon size={17} /><span>{label}</span></button>)}
      </nav>

      {scannerOpen && <Modal title="QR scanner" onClose={() => setScannerOpen(false)}>
        <div className="mx-auto max-w-sm text-center">
          <div className="relative mx-auto my-5 grid size-52 place-items-center overflow-hidden rounded-lg border border-cyan/40 bg-background instrument-grid">
            <div className="absolute inset-5 border border-cyan/70"><span className="absolute inset-x-0 top-1/3 h-px bg-cyan shadow-[0_0_12px_var(--cyan)] instrument-scan" /></div>
            <div className="grid size-24 grid-cols-5 gap-1 p-2 opacity-75" aria-label="Sample QR code">{Array.from({ length: 25 }, (_, i) => <span key={i} className={`rounded-[1px] ${[0,1,2,4,6,8,10,11,12,14,15,17,18,20,22,23,24].includes(i) ? "bg-cyan" : "bg-muted/30"}`} />)}</div>
            <div className="absolute bottom-2 font-mono text-[9px] text-cyan">CAMERA SIMULATION</div>
          </div>
          <p className="text-sm text-muted-foreground">Camera access is not needed for this product demo.</p>
          <Button onClick={() => { setScannerOpen(false); startDemo("VC-NIKE-001"); }} className="mt-4 w-full"><Fingerprint size={16} /> Use demo product</Button>
        </div>
      </Modal>}
    </div>
  );
}

function Brand() {
  return <div className="mb-5 flex h-11 items-center gap-2.5 border-b border-line px-2 pb-4">
    <div className="grid size-8 place-items-center rounded-md border border-cyan/30 bg-cyan/10 text-cyan"><Shield size={17} /></div>
    <div className="leading-tight"><div className="text-[15px] font-semibold">VeriChain</div><div className="mt-1 font-mono text-[9px] uppercase text-muted-foreground">Trust layer</div></div>
  </div>;
}

function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  return <nav aria-label="Main navigation" className="space-y-4">{navGroups.map((group) => <div key={group.label}>
    <div className="mb-1 px-2 font-mono text-[9px] uppercase text-muted-foreground/80">{group.label}</div>
    <div className="space-y-0.5">{group.items.map(({ page: target, label, icon: Icon, count }) => <button key={target} onClick={() => onNavigate(target)} aria-current={page === target ? "page" : undefined} className={`flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[12px] transition-colors ${page === target ? "border border-cyan/20 bg-cyan/10 text-cyan" : "text-muted-foreground hover:bg-panel-raised hover:text-foreground"}`}><Icon size={15} /><span className="min-w-0 flex-1 truncate">{label}</span>{count && <span className={`font-mono text-[9px] ${count === "4" ? "text-red" : "text-muted-foreground"}`}>{count}</span>}</button>)}</div>
  </div>)}</nav>;
}

function SectionHead({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3 instrument-rise"><div><div className="font-mono text-[9px] uppercase text-cyan/80">{eyebrow}</div><h1 className="mt-1 font-display text-[23px] font-semibold">{title}</h1>{description && <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{description}</p>}</div>{action}</div>;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-md border border-line bg-panel p-4 ${className}`}>{children}</section>;
}

function PanelHeading({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="mb-3 flex items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">{title}</h2>{detail && <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>}</div>{action}</div>;
}

function Metric({ label, value, hint, color = "text-foreground", icon: Icon = Activity }: { label: string; value: string; hint: string; color?: string; icon?: typeof Activity }) {
  return <Panel className="relative overflow-hidden p-3.5"><div className="flex items-center justify-between"><span className="font-mono text-[9px] uppercase text-muted-foreground">{label}</span><Icon size={14} className={color} /></div><div className={`mt-2 font-display text-[25px] font-semibold tabular-nums ${color}`}>{value}</div><div className="mt-1 font-mono text-[9px] text-muted-foreground">{hint}</div></Panel>;
}

function StatusBadge({ status }: { status: Product["status"] | "NOT FOUND" }) {
  const color = status === "AUTHENTIC" ? "border-green/25 bg-green/10 text-green" : status === "SUSPICIOUS" ? "border-amber/25 bg-amber/10 text-amber" : "border-red/25 bg-red/10 text-red";
  const label = status === "AUTHENTIC" ? "AUTHENTIC" : status === "SUSPICIOUS" ? "REVIEW" : status === "NOT FOUND" ? "NOT FOUND" : "CLONE SUSPECTED";
  return <span className={`inline-flex items-center gap-1 rounded border px-2 py-1 font-mono text-[9px] ${color}`}><span aria-hidden="true">{status === "AUTHENTIC" ? "✓" : status === "SUSPICIOUS" ? "!" : "×"}</span>{label}</span>;
}

function PeriodToggle({ value, onChange }: { value: "7 days" | "30 days"; onChange: (value: "7 days" | "30 days") => void }) {
  return <div className="flex items-center gap-0.5 rounded border border-line bg-background p-0.5">{(["7 days", "30 days"] as const).map((period) => <Button key={period} variant={value === period ? "secondary" : "ghost"} onClick={() => onChange(period)} className={`h-6 px-2 font-mono text-[9px] ${value === period ? "text-cyan" : "text-muted-foreground"}`}>{period}</Button>)}</div>;
}

function Overview({ onNavigate, onVerify, onHistory, onDemo, demoOpen, onDemoPick, period, setPeriod }: { onNavigate: (page: Page) => void; onVerify: (id?: string) => void; onHistory: (id: string) => void; onDemo: () => void; demoOpen: boolean; onDemoPick: (id: string) => void; period: "7 days" | "30 days"; setPeriod: (period: "7 days" | "30 days") => void }) {
  return <>
    <SectionHead eyebrow="Console 01 · Trust layer" title="Verification overview" description="Product identity, recorded provenance, and risk signals — brought together in one view." action={<div className="flex gap-2"><Button variant="outline" onClick={onDemo} className="h-9 border-line bg-panel text-xs"><Sparkles size={14} /> Demo mode <ChevronDown size={13} /></Button><Button onClick={() => onVerify("VC-NIKE-001")} className="h-9 text-xs"><Plus size={14} /> New verification</Button></div>} />
    {demoOpen && <div className="mb-4 grid gap-2 rounded-md border border-cyan/25 bg-panel p-3 sm:grid-cols-3">{[
      { id: "VC-NIKE-001", label: "Authentic product", icon: ShieldCheck, color: "text-green" },
      { id: "VC-SONY-003", label: "Suspicious scan", icon: AlertTriangle, color: "text-amber" },
      { id: "VC-FAKE-999", label: "Clone detected", icon: ShieldAlert, color: "text-red" },
    ].map(({ id, label, icon: Icon, color }) => <button onClick={() => onDemoPick(id)} key={id} className="flex min-h-11 items-center gap-2.5 rounded border border-line bg-background px-3 text-left text-xs hover:border-cyan/50"><Icon size={16} className={color} /><span className="flex-1">{label}</span><ArrowRight size={13} className="text-muted-foreground" /></button>)}</div>}
    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
      <Metric label="Total products" value="24,820" hint="Across 186 manufacturers" icon={Box} />
      <Metric label="Verified products" value="23,916" hint="96.4% of product registry" color="text-green" icon={ShieldCheck} />
      <Metric label="High-risk products" value="127" hint="Require enhanced review" color="text-amber" icon={AlertTriangle} />
      <Metric label="Clones detected" value="84" hint="+12 in the last 7 days" color="text-red" icon={Fingerprint} />
    </div>
    <div className="mt-3 grid gap-3 xl:grid-cols-[1.6fr_1fr]">
      <Panel>
        <PanelHeading title="Verification activity" detail="Successful checks, suspicious scans, and clone detections" action={<PeriodToggle value={period} onChange={setPeriod} />} />
        <ActivityChart period={period} />
      </Panel>
      <Panel>
        <PanelHeading title="Risk distribution" detail="Scans assessed in the selected period" />
        <div className="flex items-center gap-4">
          <div className="relative size-[112px] shrink-0 rounded-full" style={{ background: "conic-gradient(var(--green) 0 76%, var(--amber) 76% 91%, var(--red) 91% 100%)" }}><div className="absolute inset-[11px] grid place-items-center rounded-full bg-panel text-center"><div><div className="font-display text-xl font-semibold">96.4%</div><div className="font-mono text-[8px] text-muted-foreground">VERIFIED</div></div></div></div>
          <div className="min-w-0 flex-1 space-y-2.5">{[{ label: "Low · genuine", value: "18,902", color: "bg-green" }, { label: "Medium · review", value: "3,741", color: "bg-amber" }, { label: "High · clone", value: "2,177", color: "bg-red" }].map((item) => <div key={item.label} className="flex items-center gap-2 text-[10px]"><span className={`size-2 shrink-0 rounded-full ${item.color}`} /><span className="min-w-0 flex-1 truncate text-muted-foreground">{item.label}</span><span className="font-mono text-foreground">{item.value}</span></div>)}</div>
        </div>
        <Button variant="outline" onClick={() => onNavigate("risk")} className="mt-4 h-8 w-full border-line bg-background text-[10px]">Open risk intelligence <ArrowRight size={13} /></Button>
      </Panel>
    </div>
    <div className="mt-3 grid gap-3 xl:grid-cols-[1.45fr_1fr]">
      <Panel className="p-0"><div className="flex items-center justify-between border-b border-line px-4 py-3"><div><h2 className="text-sm font-semibold">Recent verifications</h2><p className="mt-0.5 text-[10px] text-muted-foreground">Latest product identity checks</p></div><Button onClick={() => onNavigate("history")} variant="ghost" className="h-7 px-2 text-[10px] text-cyan">View history <ArrowRight size={12} /></Button></div><div className="divide-y divide-line/60">{recentActivity.map(({ productId: id, time, place }) => { const product = getProduct(id); return product ? <button key={id} onClick={() => onHistory(id)} className="flex min-h-[54px] w-full items-center gap-2.5 px-4 py-2 text-left hover:bg-panel-raised/60"><span className={`size-2 shrink-0 rounded-full ${product.status === "AUTHENTIC" ? "bg-green" : product.status === "SUSPICIOUS" ? "bg-amber" : "bg-red"}`} /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-medium">{product.name}</span><span className="mt-1 block truncate font-mono text-[9px] text-muted-foreground">{id} · {place}</span></span><span className="hidden shrink-0 font-mono text-[9px] text-muted-foreground sm:block">{time}</span><StatusBadge status={product.status} /></button> : null; })}</div></Panel>
      <Panel>
        <PanelHeading title="Quick verification" detail="Look up a product digital identity" />
        <QuickVerify onVerify={onVerify} />
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 font-mono text-[9px] text-green"><span className="instrument-pulse size-1.5 rounded-full bg-green" />Risk-adaptive verification active</div>
      </Panel>
    </div>
  </>;
}

function ActivityChart({ period }: { period: "7 days" | "30 days" }) {
  const values = period === "7 days" ? [48, 64, 52, 78, 67, 92, 73] : [58, 74, 64, 82, 70, 96, 80, 57, 72, 88, 62, 76, 92, 69, 57, 83, 67, 95, 75, 59, 86, 70, 92, 65, 79, 97, 62, 83, 72, 89];
  const labels = period === "7 days" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : values.map((_, i) => `${i + 1}`);
  return <div className="mt-2"><div className="flex h-[160px] items-end gap-1 border-b border-line px-1 pt-3">{values.map((value, index) => <div key={index} title={`${labels[index]} · ${value * 118} successful checks`} className="group relative flex h-full flex-1 items-end justify-center gap-0.5"><span className="absolute inset-x-0 bottom-0 rounded-t-sm bg-cyan/60 transition-all group-hover:bg-cyan" style={{ height: `${value}%` }} /><span className="absolute inset-x-0 bottom-0 rounded-t-sm bg-amber/90" style={{ height: `${Math.max(3, value / 7)}%` }} /><span className="absolute inset-x-0 bottom-0 rounded-t-sm bg-red" style={{ height: `${Math.max(2, value / 14)}%` }} /></div>)}</div><div className="mt-2 flex justify-between gap-1">{labels.filter((_, i) => period === "7 days" || i % 5 === 0 || i === 29).map((label, i) => <span key={`${label}-${i}`} className="font-mono text-[8px] text-muted-foreground">{label}</span>)}</div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">{[{ label: "Successful", color: "bg-cyan" }, { label: "Suspicious", color: "bg-amber" }, { label: "Clone", color: "bg-red" }].map(({ label, color }) => <span key={label} className="flex items-center gap-1.5 text-[9px] text-muted-foreground"><span className={`size-1.5 rounded-full ${color}`} />{label}</span>)}</div></div>;
}

function QuickVerify({ onVerify }: { onVerify: (id?: string) => void }) {
  const [id, setId] = useState("");
  return <form onSubmit={(event) => { event.preventDefault(); onVerify(id); }} className="space-y-2.5"><label htmlFor="quick-id" className="font-mono text-[9px] uppercase text-muted-foreground">Product identity ID</label><Input id="quick-id" placeholder="VC-NIKE-001" value={id} onChange={(event) => setId(event.target.value)} className="h-10 border-line bg-background font-mono text-xs" /><Button type="submit" className="h-9 w-full text-xs"><Fingerprint size={14} /> Run verification <ArrowRight size={13} /></Button><div className="flex flex-wrap gap-1.5">{products.map((product) => <button key={product.id} type="button" onClick={() => { setId(product.id); onVerify(product.id); }} className="rounded border border-line bg-background px-2 py-1 font-mono text-[8px] text-muted-foreground hover:border-cyan/40 hover:text-cyan">{product.id}</button>)}</div></form>;
}

function VerifyScreen({ productId, setProductId, result, step, runVerification, onScanner, fileInput, fileName, setFileName, notice, setNotice, onRisk }: { productId: string; setProductId: (id: string) => void; result: Result | null; step: number; runVerification: (id?: string) => void; onScanner: () => void; fileInput: React.RefObject<HTMLInputElement | null>; fileName: string; setFileName: (name: string) => void; notice: string; setNotice: (value: string) => void; onRisk: () => void }) {
  const product = result?.status !== "NOT FOUND" && result ? getProduct(result.id) : null;
  const status = result?.status ?? null;
  const resultColor = status === "AUTHENTIC" ? "text-green" : status === "SUSPICIOUS" ? "text-amber" : status ? "text-red" : "text-foreground";
  const checking = step >= 0 && step < 5;
  const steps = ["Reading product identity", "Checking blockchain record", "Validating product provenance", "Analyzing scan behavior", "Calculating risk score"];
  const explanation: Record<string, string[]> = {
    AUTHENTIC: ["Blockchain identity matched", "Metadata hash matches manufacturer record", "Supply-chain history is consistent", "No suspicious duplicate scans", "Recent scan location is expected"],
    SUSPICIOUS: ["Product identity exists on the ledger", "Blockchain record is valid", "Unusual location change detected", "Multiple recent scans detected", "Enhanced verification is recommended"],
    "CLONE SUSPECTED": ["Duplicate product identity detected", "Impossible geographic movement flagged", "Unusual scan frequency observed", "Supply-chain record does not match", "Treat this item as potentially counterfeit"],
  };
  const productFields = product ? [{ label: "Product ID", value: product.id }, { label: "Manufacturer", value: product.manufacturer }, { label: "Batch", value: product.batch }, { label: "Manufactured", value: product.manufactured }, { label: "Blockchain", value: "Identity confirmed" }, { label: "Last verified", value: "Just now" }] : [];

  return <>
    <SectionHead eyebrow="Console 02 · Product identity" title="Is your product genuine?" description="Check its signed digital identity, supply-chain record, and scan behavior." action={<div className="flex items-center gap-1.5 rounded border border-green/25 bg-green/5 px-2.5 py-2 font-mono text-[9px] text-green"><ShieldCheck size={13} /> Network connected</div>} />
    <div className="grid items-start gap-3 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel>
        <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Scan or enter product ID</h2><p className="mt-1 text-[10px] text-muted-foreground">Start from a QR seal, ID, or purchase evidence.</p></div><span className="rounded border border-cyan/25 bg-cyan/5 px-2 py-1 font-mono text-[8px] text-cyan">RISK-ADAPTIVE</span></div>
        <div className="relative mx-auto my-4 grid aspect-[1.4/1] w-full max-w-[330px] place-items-center overflow-hidden rounded-md border border-line bg-background instrument-grid">
          <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-cyan/5 to-transparent" />
          <div className="relative grid size-36 grid-cols-7 gap-1 p-2 opacity-70">{Array.from({ length: 49 }, (_, i) => <span key={i} className={`rounded-[1px] ${[0,1,2,5,7,9,10,12,14,17,18,20,21,24,25,27,28,31,32,34,36,38,40,41,42,45,47,48].includes(i) ? "bg-cyan/80" : "bg-muted/15"}`} />)}</div>
          <div className="absolute inset-x-0 top-1/2 h-px bg-cyan/60 shadow-[0_0_14px_var(--cyan)] instrument-scan" />
          <div className="absolute bottom-2 flex items-center gap-1.5 font-mono text-[8px] text-cyan"><span className="instrument-pulse size-1.5 rounded-full bg-cyan" />READY TO READ SEAL</div>
        </div>
        <Button variant="outline" onClick={onScanner} className="mb-4 h-9 w-full border-line bg-background text-xs"><Fingerprint size={15} /> Open QR scanner <span className="ml-auto text-[9px] text-muted-foreground">SIMULATED</span></Button>
        <div className="mb-2 flex items-center gap-2"><span className="h-px flex-1 bg-line" /><span className="font-mono text-[8px] uppercase text-muted-foreground">or enter identity</span><span className="h-px flex-1 bg-line" /></div>
        <label htmlFor="product-id" className="mb-1.5 block font-mono text-[9px] uppercase text-muted-foreground">Product ID</label>
        <form onSubmit={(event) => { event.preventDefault(); runVerification(productId); }} className="flex gap-2"><Input id="product-id" value={productId} onChange={(event) => { setProductId(event.target.value); setNotice(""); }} placeholder="VC-NIKE-001" className="h-10 border-line bg-background font-mono text-xs" /><Button className="h-10 shrink-0 px-3 text-xs"><Fingerprint size={14} /> Verify</Button></form>
        {notice && <p role="alert" className="mt-2 text-[10px] text-amber">{notice}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">{products.map((item) => <button key={item.id} type="button" onClick={() => { setProductId(item.id); setNotice(""); }} className="rounded border border-line px-2 py-1 font-mono text-[8px] text-muted-foreground hover:border-cyan/40 hover:text-cyan">{item.id}</button>)}</div>
        <div className="mt-4 border-t border-line pt-3"><input ref={fileInput} type="file" accept="image/*,.pdf" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) setFileName(file.name); }} /><Button variant="outline" onClick={() => fileInput.current?.click()} className="h-8 w-full border-line bg-background text-[10px]"><Upload size={14} /> {fileName ? "Evidence attached" : "Upload verification evidence"}</Button>{fileName && <div className="mt-2 flex items-center gap-1.5 truncate font-mono text-[9px] text-green"><FileCheck2 size={12} />{fileName}</div>}</div>
      </Panel>
      <div className="space-y-3">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-mono text-[9px] uppercase text-cyan">Verification sequence</div><h2 className="mt-1 text-sm font-semibold">{checking ? "Checking product identity" : result ? "Verification complete" : "Ready to verify"}</h2></div><span className="rounded border border-line bg-background px-2 py-1 font-mono text-[9px] text-muted-foreground">5-STEP CHECK</span></div>
          <div className="mt-4 space-y-2">{steps.map((label, index) => { const done = step > index || step === 5; const active = step === index; return <div key={label} className={`flex items-center gap-2.5 rounded border px-2.5 py-2 ${active ? "border-cyan/30 bg-cyan/5" : "border-line bg-background/60"}`}><div className={`grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[8px] ${done ? "border-green/30 bg-green/10 text-green" : active ? "instrument-pulse border-cyan/40 bg-cyan/10 text-cyan" : "border-line text-muted-foreground"}`}>{done ? "✓" : String(index + 1).padStart(2, "0")}</div><span className={`flex-1 text-[10px] ${active ? "text-cyan" : done ? "text-foreground" : "text-muted-foreground"}`}>{label}{active ? "…" : ""}</span>{done && <span className="font-mono text-[8px] text-green">COMPLETE</span>}</div>; })}</div>
        </Panel>
        {checking && <div className="rounded-md border border-cyan/25 bg-cyan/5 px-4 py-3"><div className="flex items-center gap-2 font-mono text-[10px] text-cyan"><span className="instrument-pulse size-1.5 rounded-full bg-cyan" />VERIFYING {productId || "PRODUCT"}</div><div className="mt-2 h-1 overflow-hidden rounded bg-background"><div className="h-full rounded bg-cyan transition-all duration-300" style={{ width: `${(step + 1) * 20}%` }} /></div></div>}
        {result && (() => {

          const bcEv = result.blockchainEvidence;
          const provEv = result.provenanceEvidence;
          const riskEv = result.riskEvidence;
          const bcColor = bcEv?.verified ? "text-green" : bcEv?.status === "BLOCKCHAIN_ERROR" ? "text-amber" : "text-red";
          const bcBorder = bcEv?.verified ? "border-green/25 bg-green/5" : bcEv?.status === "BLOCKCHAIN_ERROR" ? "border-amber/25 bg-amber/5" : "border-red/25 bg-red/5";
          return (
            <div className="space-y-3">
              {/* Panel 1: Final Decision Banner */}
              <div className={`rounded-md border p-4 ${status === "AUTHENTIC" ? "border-green/30 bg-green/5" : status === "SUSPICIOUS" ? "border-amber/35 bg-amber/5" : status === "INDETERMINATE" ? "border-amber/20 bg-amber/5" : "border-red/35 bg-red/5"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`grid size-9 shrink-0 place-items-center rounded border ${status === "AUTHENTIC" ? "border-green/30 bg-green/10 text-green" : status === "SUSPICIOUS" ? "border-amber/30 bg-amber/10 text-amber" : "border-red/30 bg-red/10 text-red"}`}>
                      {status === "AUTHENTIC" ? <ShieldCheck size={19} /> : status === "SUSPICIOUS" ? <AlertTriangle size={19} /> : <ShieldAlert size={19} />}
                    </div>
                    <div>
                      <div className={`font-display text-[15px] font-semibold ${resultColor}`}>
                        {status === "AUTHENTIC" ? "AUTHENTIC" : status === "SUSPICIOUS" ? "SUSPICIOUS" : status === "NOT FOUND" ? "NOT FOUND" : status === "INDETERMINATE" ? "INDETERMINATE" : "CLONE SUSPECTED"}
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{product?.name ?? result.id} · {product?.manufacturer ?? "No verified manufacturer record"}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-display text-[25px] font-semibold ${resultColor}`}>{result.score}<span className="text-[11px] text-muted-foreground"> / 100</span></div>
                    <div className="font-mono text-[8px] text-muted-foreground">{describeRisk(result.score)} RISK</div>
                  </div>
                </div>
                {result.decisionReason && (
                  <div className="mt-3 border-t border-line/60 pt-3">
                    <div className="font-mono text-[8px] uppercase text-muted-foreground mb-1">Decision reason</div>
                    <p className="text-[10px] leading-relaxed">{result.decisionReason}</p>
                  </div>
                )}
                <div className="mt-3 rounded border border-amber/20 bg-amber/5 px-3 py-2">
                  <p className="text-[9px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-amber">Note: </span>
                    Blockchain registration confirms digital identity, not physical product authenticity. A verified ledger entry does not guarantee the item in your possession is genuine.
                  </p>
                </div>
              </div>

              {/* Panel 2: Product Identity & Registry */}
              {product && (
                <div className="rounded-md border border-line bg-panel p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Database size={13} className="text-cyan" />
                    <span className="font-mono text-[9px] uppercase text-cyan">Identity &amp; Registry</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
                    {[
                      { label: "Product ID", value: product.id },
                      { label: "Manufacturer", value: product.manufacturer },
                      { label: "Batch", value: product.batch },
                      { label: "Manufactured", value: product.manufactured },
                      { label: "Serial", value: product.serial ?? "—" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div className="font-mono text-[8px] uppercase text-muted-foreground">{label}</div>
                        <div className="mt-1 break-all text-[10px]">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Panel 3: Blockchain Integrity */}
              {bcEv && (
                <div className={`rounded-md border p-4 ${bcBorder}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Blocks size={13} className={bcColor} />
                      <span className={`font-mono text-[9px] uppercase ${bcColor}`}>Blockchain Integrity</span>
                    </div>
                    <span className={`font-mono text-[8px] rounded border px-1.5 py-0.5 ${bcBorder} ${bcColor}`}>{bcEv.status}</span>
                  </div>
                  <p className="mb-2 text-[10px] text-muted-foreground">{bcEv.message}</p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {bcEv.expectedHash && (
                      <div>
                        <div className="font-mono text-[8px] uppercase text-muted-foreground">Expected hash (v1)</div>
                        <div className="mt-1 break-all font-mono text-[8px]">{bcEv.expectedHash.slice(0, 20)}…</div>
                      </div>
                    )}
                    {bcEv.contractAddress && (
                      <div>
                        <div className="font-mono text-[8px] uppercase text-muted-foreground">Contract</div>
                        <div className="mt-1 break-all font-mono text-[8px]">{bcEv.contractAddress.slice(0, 14)}…</div>
                      </div>
                    )}
                    {bcEv.latestTxHash && (
                      <div>
                        <div className="font-mono text-[8px] uppercase text-muted-foreground">Latest tx</div>
                        <div className="mt-1 break-all font-mono text-[8px]">{bcEv.latestTxHash.slice(0, 14)}…</div>
                      </div>
                    )}
                    <div>
                      <div className="font-mono text-[8px] uppercase text-muted-foreground">On-chain active</div>
                      <div className={`mt-1 text-[10px] ${bcEv.onChainActive ? "text-green" : "text-red"}`}>
                        {bcEv.onChainActive === null ? "Unknown" : bcEv.onChainActive ? "Yes" : "No"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Panel 4: Supply-chain Provenance */}
              {provEv && (
                <div className={`rounded-md border p-4 ${provEv.trailIntact ? "border-green/25 bg-green/5" : "border-amber/25 bg-amber/5"}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PackageCheck size={13} className={provEv.trailIntact ? "text-green" : "text-amber"} />
                      <span className={`font-mono text-[9px] uppercase ${provEv.trailIntact ? "text-green" : "text-amber"}`}>Supply-chain Provenance</span>
                    </div>
                    <span className={`font-mono text-[8px] ${provEv.trailIntact ? "text-green" : "text-amber"}`}>
                      {provEv.eventCount} event{provEv.eventCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3 text-[10px]">
                    <div>
                      <div className="font-mono text-[8px] uppercase text-muted-foreground">Trail intact</div>
                      <div className={`mt-1 ${provEv.trailIntact ? "text-green" : "text-amber"}`}>{provEv.trailIntact ? "Yes" : "No"}</div>
                    </div>
                    {provEv.lastEvent && (
                      <div>
                        <div className="font-mono text-[8px] uppercase text-muted-foreground">Last event</div>
                        <div className="mt-1">{provEv.lastEvent}</div>
                      </div>
                    )}
                    {provEv.lastLocation && (
                      <div>
                        <div className="font-mono text-[8px] uppercase text-muted-foreground">Last location</div>
                        <div className="mt-1">{provEv.lastLocation}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Panel 5: Behavioral Risk Breakdown */}
              {riskEv && (
                <div className="rounded-md border border-line bg-panel p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity size={13} className="text-cyan" />
                      <span className="font-mono text-[9px] uppercase text-cyan">Behavioral Risk</span>
                    </div>
                    <span className={`font-mono text-[8px] rounded border px-1.5 py-0.5 ${riskEv.riskLevel === "LOW" ? "border-green/25 bg-green/5 text-green" : riskEv.riskLevel === "MEDIUM" ? "border-amber/25 bg-amber/5 text-amber" : "border-red/25 bg-red/5 text-red"}`}>
                      {riskEv.riskLevel} · {riskEv.totalScore}/100
                    </span>
                  </div>
                  {Object.entries(riskEv.anomalies).length > 0 && (
                    <div className="mb-2 space-y-1.5">
                      {Object.entries(riskEv.anomalies).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="flex-1 text-[9px] text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                          <span className="font-mono text-[9px]">{val}</span>
                          <div className="h-1 w-20 rounded bg-background">
                            <div className="h-1 rounded bg-red" style={{ width: `${Math.min(100, (val as number) * 3)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {riskEv.reasons.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {riskEv.reasons.slice(0, 4).map((r) => (
                        <li key={r} className="flex gap-2 text-[9px] text-muted-foreground">
                          <span className="text-amber">!</span>{r}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2">
                    <div className="flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
                      <Zap size={12} className="text-cyan" />Adaptive verification · Level {riskEv.verificationLevel}
                    </div>
                    <Button variant="outline" onClick={onRisk} className="h-7 border-line bg-background px-2 text-[9px]">View risk breakdown <ArrowRight size={12} /></Button>
                  </div>
                </div>
              )}

              {/* Fallback for non-API results */}
              {!bcEv && !provEv && !riskEv && product && (
                <div className="rounded-md border border-line p-4">
                  <div className="mt-3 border-t border-line/70 pt-3">
                    <div className="text-[11px] font-semibold">Why this result?</div>
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {(({ AUTHENTIC: ["Blockchain identity matched", "Metadata hash matches manufacturer record", "Supply-chain history is consistent", "No suspicious duplicate scans", "Recent scan location is expected"], SUSPICIOUS: ["Product identity exists on the ledger", "Blockchain record is valid", "Unusual location change detected", "Multiple recent scans detected", "Enhanced verification is recommended"], "CLONE SUSPECTED": ["Duplicate product identity detected", "Impossible geographic movement flagged", "Unusual scan frequency observed", "Supply-chain record does not match", "Treat this item as potentially counterfeit"] } as Record<string, string[]>)[status ?? ""] ?? []).slice(0, 4).map((item) => (
                        <li key={item} className="flex gap-2 text-[9px] text-muted-foreground">
                          <span className={status === "AUTHENTIC" ? "text-green" : status === "SUSPICIOUS" ? "text-amber" : "text-red"}>{status === "AUTHENTIC" ? "✓" : status === "SUSPICIOUS" ? "!" : "×"}</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {status === "NOT FOUND" && <p className="border-t border-line pt-3 text-[10px] text-muted-foreground">This ID isn't in the demonstration registry. Try one of the sample identities above.</p>}
            </div>
          );
        })()}

      </div>
    </div>

    <div className="mt-3 grid gap-2 sm:grid-cols-3">{[{ title: "LEVEL 1 · Basic", desc: "Product ID · blockchain record · metadata hash", active: !result || result.score < 30 }, { title: "LEVEL 2 · Enhanced", desc: "Scan history · location signals · purchase evidence", active: !!result && result.score >= 30 && result.score < 70 }, { title: "LEVEL 3 · Advanced", desc: "Provenance · behavior · image and identity evidence", active: !!result && result.score >= 70 }].map((level) => <div key={level.title} className={`rounded-md border px-3 py-2.5 ${level.active ? "border-cyan/30 bg-cyan/5" : "border-line bg-panel/70"}`}><div className={`font-mono text-[9px] ${level.active ? "text-cyan" : "text-muted-foreground"}`}>{level.title}{level.active ? " · SELECTED" : ""}</div><p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">{level.desc}</p></div>)}</div>
  </>;
}

function Registry({ search, setSearch, filter, setFilter, pageNumber, setPageNumber, onOpen }: { search: string; setSearch: (value: string) => void; filter: string; setFilter: (value: string) => void; pageNumber: number; setPageNumber: (value: number) => void; onOpen: (id?: string) => void }) {
  const filtered = useMemo(() => getProducts().filter((product) => (filter === "All" || product.status === filter) && `${product.name} ${product.id} ${product.manufacturer} ${product.batch}`.toLowerCase().includes(search.toLowerCase())), [filter, search]);
  return <><SectionHead eyebrow="Console 03 · Registry" title="Product registry" description="Review registered product identities, manufacturer records, and their current verification status." action={<Button variant="outline" onClick={() => onOpen("VC-NIKE-001")} className="h-9 border-line bg-panel text-xs"><Fingerprint size={14} /> Verify product</Button>} />
    <Panel className="p-3"><div className="mb-3 flex flex-wrap items-center gap-2"><div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} /><Input aria-label="Search registry" placeholder="Search product, ID, maker or batch…" value={search} onChange={(event) => { setSearch(event.target.value); setPageNumber(1); }} className="h-9 border-line bg-background pl-9 text-xs" /></div><div className="flex items-center gap-1.5"><ListFilter size={14} className="text-muted-foreground" />{["All", "AUTHENTIC", "SUSPICIOUS", "CLONE SUSPECTED"].map((item) => <Button key={item} variant={filter === item ? "secondary" : "ghost"} onClick={() => { setFilter(item); setPageNumber(1); }} className={`h-8 px-2 text-[9px] ${filter === item ? "text-cyan" : "text-muted-foreground"}`}>{item === "CLONE SUSPECTED" ? "CLONE" : item === "AUTHENTIC" ? "VERIFIED" : item === "SUSPICIOUS" ? "REVIEW" : item}</Button>)}</div></div>
      <div className="hidden grid-cols-[1.5fr_1fr_0.75fr_0.75fr_0.5fr] gap-2 border-y border-line py-2 font-mono text-[8px] uppercase text-muted-foreground md:grid"><span>Product / ID</span><span>Manufacturer</span><span>Batch</span><span>Status / risk</span><span /></div>
      <div className="divide-y divide-line">{filtered.map((product) => { const score = calculateRisk(product); return <div key={product.id} className="grid gap-2 py-3 md:grid-cols-[1.5fr_1fr_0.75fr_0.75fr_0.5fr] md:items-center"><div className="min-w-0"><div className="truncate text-[11px] font-medium">{product.name}</div><div className="mt-1 font-mono text-[9px] text-muted-foreground">{product.id} · {product.serial}</div></div><div className="text-[10px] text-muted-foreground">{product.manufacturer}</div><div className="font-mono text-[9px] text-muted-foreground">{product.batch}</div><div className="flex items-center gap-1.5"><StatusBadge status={product.status} /><span className={`font-mono text-[9px] ${score >= 60 ? "text-red" : score >= 30 ? "text-amber" : "text-green"}`}>{score}</span></div><div className="flex justify-end"><Button onClick={() => onOpen(product.id)} variant="ghost" className="h-7 px-2 text-[9px] text-cyan">View <ArrowRight size={12} /></Button></div></div>; })}{filtered.length === 0 && <div className="py-10 text-center text-xs text-muted-foreground">No products match those filters.</div>}</div>
      <div className="flex items-center justify-between border-t border-line pt-3"><span className="text-[9px] text-muted-foreground">Showing {filtered.length} sample identities from the live demo registry</span><div className="flex gap-1"><Button variant="outline" disabled={pageNumber === 1} onClick={() => setPageNumber(Math.max(1, pageNumber - 1))} className="h-7 border-line bg-background px-2 text-[9px]">Previous</Button><span className="grid min-w-7 place-items-center font-mono text-[9px] text-cyan">{pageNumber}</span><Button variant="outline" onClick={() => setPageNumber(pageNumber + 1)} className="h-7 border-line bg-background px-2 text-[9px]">Next</Button></div></div>
    </Panel></>;
}

function SupplyChain({ selectedNode, setSelectedNode, onVerify }: { selectedNode: number; setSelectedNode: (index: number) => void; onVerify: (id?: string) => void }) {
  const product = products[0];
  const nodes = [
    { title: "Manufacturer", name: "Nike Manufacturing", place: "Beaverton, Oregon", date: "05 Sep 2026 · 08:14", tx: "0x7a91…e82c", detail: "Product identity sealed; origin and materials attested." },
    { title: "Distribution", name: "West Coast Distribution", place: "Oakland, California", date: "08 Sep 2026 · 16:32", tx: "0x23d8…901b", detail: "Custody transferred to the authorized regional hub." },
    { title: "Retail partner", name: "Union Street Sports", place: "San Francisco, California", date: "12 Sep 2026 · 10:06", tx: "0x99a2…10df", detail: "Authorized retailer received and checked the sealed batch." },
    { title: "Verified buyer", name: "Ownership handoff", place: "Portland, Oregon", date: "18 Sep 2026 · 13:42", tx: "0x61ce…13ae", detail: "Product identity checked at the time of purchase." },
  ];
  const current = nodes[selectedNode] ?? nodes[0];
  return <><SectionHead eyebrow="Console 04 · Provenance" title="Supply chain" description="A readable custody trail shows who handled a product and where each handoff happened." action={<Button onClick={() => onVerify(product.id)} className="h-9 text-xs"><Fingerprint size={14} /> Verify identity</Button>} />
    <Panel><PanelHeading title={product.name} detail={`${product.id} · Batch ${product.batch} · Manufacturer signed`} action={<StatusBadge status="AUTHENTIC" />} />
      <div className="mt-5 grid grid-cols-2 gap-y-5 sm:grid-cols-4">{nodes.map((node, index) => <button key={node.title} onClick={() => setSelectedNode(index)} className="group relative flex flex-col items-center px-2 text-center"><span className={`absolute left-1/2 top-4 hidden h-px w-full -translate-y-1/2 sm:block ${index < nodes.length - 1 ? "bg-line" : "bg-transparent"}`} /><span className={`relative z-10 grid size-9 place-items-center rounded-full border transition-colors ${selectedNode === index ? "border-cyan bg-cyan/15 text-cyan" : index < selectedNode ? "border-green/30 bg-green/10 text-green" : "border-line bg-background text-muted-foreground"}`}>{index === 0 ? <PackageCheck size={16} /> : index === 1 ? <Blocks size={16} /> : index === 2 ? <Box size={16} /> : <ShieldCheck size={16} />}</span><span className={`mt-2 text-[10px] font-semibold ${selectedNode === index ? "text-cyan" : "text-foreground"}`}>{node.title}</span><span className="mt-1 text-[9px] text-muted-foreground">{node.name}</span><span className="mt-1 font-mono text-[8px] text-muted-foreground">{node.date.split(" · ")[0]}</span></button>)}</div>
    </Panel>
    <div className="mt-3 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]"><Panel><PanelHeading title={current.title} detail={current.name} /><div className="space-y-3">{[{ label: "Location", value: current.place, icon: MapPin }, { label: "Timestamp", value: current.date, icon: Clock3 }, { label: "Blockchain transaction", value: current.tx, icon: Blocks }, { label: "Confirmation", value: "Confirmed · Block 18,429,703", icon: BadgeCheck }].map(({ label, value, icon: Icon }) => <div key={label} className="flex items-start gap-2.5 border-b border-line/60 pb-2.5 last:border-0"><Icon size={14} className="mt-0.5 text-cyan" /><div><div className="font-mono text-[8px] uppercase text-muted-foreground">{label}</div><div className="mt-1 text-[10px]">{value}</div></div></div>)}</div><p className="mt-2 border-l border-cyan/40 pl-3 text-[10px] leading-relaxed text-muted-foreground">{current.detail}</p><Button variant="outline" onClick={() => navigator.clipboard?.writeText(current.tx)} className="mt-3 h-8 border-line bg-background text-[9px]"><ExternalLink size={13} /> Copy transaction reference</Button></Panel>
      <Panel><PanelHeading title="Adaptive verification" detail="Verification depth follows observed risk." /><div className="space-y-2">{[{ title: "LEVEL 1 · Basic", body: "Product ID · blockchain · metadata hash", active: true }, { title: "LEVEL 2 · Enhanced", body: "Location · scan history · purchase evidence", active: false }, { title: "LEVEL 3 · Advanced", body: "Supply chain · behavior · identity evidence", active: false }].map(({ title, body, active }) => <div key={title} className={`rounded border px-3 py-2.5 ${active ? "border-cyan/30 bg-cyan/5" : "border-line bg-background"}`}><div className={`font-mono text-[9px] ${active ? "text-cyan" : "text-muted-foreground"}`}>{title}{active ? " · IN USE" : ""}</div><p className="mt-1 text-[9px] text-muted-foreground">{body}</p></div>)}</div><div className="mt-3 font-mono text-[9px] text-green">✓ Chain of custody consistent</div></Panel></div>
  </>;
}

function RiskIntelligence({ onOpen }: { onOpen: (id?: string) => void }) {
  return <><SectionHead eyebrow="Console 05 · Threat signals" title="Risk intelligence" description="Spot suspicious scans, geographic anomalies, and identity reuse across the product network." />
    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4"><Metric label="Potential clones" value="84" hint="Across 31 product identities" color="text-red" icon={Fingerprint} /><Metric label="High-risk products" value="127" hint="Score ≥ 60" color="text-amber" icon={AlertTriangle} /><Metric label="Suspicious scans" value="1,284" hint="Last 30 days" color="text-cyan" icon={Activity} /><Metric label="Verification success" value="98.7%" hint="+0.6% vs previous period" color="text-green" icon={ShieldCheck} /></div>
    <div className="mt-3 grid gap-3 xl:grid-cols-2"><Panel><PanelHeading title="Risk signal overview" detail="Relative volume by observed category" />{[{ label: "Unexpected location", width: "82%", amount: "438", color: "bg-red" }, { label: "Duplicate identity scans", width: "66%", amount: "352", color: "bg-amber" }, { label: "Scan frequency", width: "48%", amount: "257", color: "bg-cyan" }, { label: "Supply-chain mismatch", width: "31%", amount: "166", color: "bg-green" }].map((item) => <div key={item.label} className="mb-3 last:mb-0"><div className="mb-1.5 flex justify-between text-[10px]"><span className="text-muted-foreground">{item.label}</span><span className="font-mono">{item.amount}</span></div><div className="h-1.5 overflow-hidden rounded bg-background"><div className={`h-full rounded ${item.color}`} style={{ width: item.width }} /></div></div>)}</Panel>
      <Panel><PanelHeading title="Top suspicious identities" detail="Products with elevated scan anomaly scores" />{products.filter((product) => product.status !== "AUTHENTIC").map((product) => <button key={product.id} onClick={() => onOpen(product.id)} className="flex w-full items-center gap-3 border-b border-line py-3 text-left last:border-0 hover:bg-panel-raised/40"><span className={`grid size-8 place-items-center rounded border ${product.status === "SUSPICIOUS" ? "border-amber/25 bg-amber/10 text-amber" : "border-red/25 bg-red/10 text-red"}`}><ShieldAlert size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-medium">{product.name}</span><span className="mt-1 block font-mono text-[9px] text-muted-foreground">{product.id} · {product.recentScans.length} scan anomalies</span></span><span className={`font-mono text-sm ${calculateRisk(product) >= 80 ? "text-red" : "text-amber"}`}>{calculateRisk(product)}</span><ArrowRight size={13} className="text-muted-foreground" /></button>)}</Panel>
    </div>
    <div className="mt-3 grid gap-3 xl:grid-cols-2"><RiskFactorsPanel product={products[3]} /><AdaptiveLevels selected={2} /></div>
  </>;
}

function RiskFactorsPanel({ product }: { product: Product }) {
  const score = calculateRisk(product);
  return <Panel><PanelHeading title="Risk score breakdown" detail={`${product.name} · ${product.id}`} action={<span className="font-mono text-sm text-red">{score} / 100</span>} /><div className="mb-3 h-2 rounded bg-background"><div className="h-2 rounded bg-gradient-to-r from-green via-amber to-red" style={{ width: `${score}%` }} /></div><div className="space-y-2">{riskFactorRows(product.riskFactors).map(({ label, value, max }) => <div key={label} className="flex items-center gap-2"><span className="flex-1 text-[9px] text-muted-foreground">{label}</span><span className="w-12 text-right font-mono text-[9px]">{value}/{max}</span><div className="h-1 w-16 rounded bg-background"><div className="h-1 rounded bg-red" style={{ width: `${value / max * 100}%` }} /></div></div>)}</div><p className="mt-3 border-t border-line pt-3 text-[9px] text-muted-foreground">Higher scores indicate stronger fraud signals. Multiple scan locations and custody mismatches are weighted more heavily.</p></Panel>;
}

function AdaptiveLevels({ selected }: { selected: number }) {
  return <Panel><PanelHeading title="Adaptive verification" detail="The system asks for stronger evidence as risk rises." />{[{ title: "LEVEL 1", name: "Basic verification", detail: "Product ID · ledger record · metadata hash" }, { title: "LEVEL 2", name: "Enhanced verification", detail: "Location · scan history · purchase evidence" }, { title: "LEVEL 3", name: "Advanced verification", detail: "Supply chain · device behavior · identity evidence" }].map((item, index) => <div key={item.title} className={`mb-2 flex gap-3 rounded border p-3 last:mb-0 ${selected === index ? "border-cyan/35 bg-cyan/5" : "border-line bg-background"}`}><div className={`grid size-7 shrink-0 place-items-center rounded border font-mono text-[9px] ${selected === index ? "border-cyan/30 text-cyan" : "border-line text-muted-foreground"}`}>{index + 1}</div><div><div className={`font-mono text-[8px] ${selected === index ? "text-cyan" : "text-muted-foreground"}`}>{item.title}{selected === index ? " · SELECTED" : ""}</div><div className="mt-0.5 text-[10px] font-medium">{item.name}</div><div className="mt-1 text-[9px] text-muted-foreground">{item.detail}</div></div></div>)}</Panel>;
}

function HistoryScreen({ filter, setFilter, onOpen }: { filter: string; setFilter: (value: string) => void; onOpen: (id?: string) => void }) {
  const [query, setQuery] = useState("");
  const rows = getVerificationHistory().filter(({ productId }) => { const product = getProduct(productId); const matchesOutcome = filter === "All outcomes" || product?.status === filter; return matchesOutcome && `${product?.name ?? ""} ${productId}`.toLowerCase().includes(query.toLowerCase()); });
  return <><SectionHead eyebrow="Console 06 · Activity log" title="Verification history" description="See when identities were checked, where scans happened, and which products need another look." action={<Button variant="outline" onClick={() => navigator.clipboard?.writeText("Verification history · VeriChain demo")} className="h-9 border-line bg-panel text-xs"><Download size={14} /> Export sample</Button>} />
    <Panel className="p-3"><div className="mb-3 flex flex-wrap gap-2"><Input aria-label="Search verification history" placeholder="Search IDs or product names…" value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 min-w-[200px] flex-1 border-line bg-background text-xs" /><select aria-label="Filter history by outcome" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-9 rounded border border-line bg-background px-3 text-[10px] text-foreground"><option>All outcomes</option><option>AUTHENTIC</option><option>SUSPICIOUS</option><option>CLONE SUSPECTED</option></select></div><div className="divide-y divide-line">{rows.map(({ productId, time, place }) => { const product = getProduct(productId); if (!product) return null; return <button key={productId} onClick={() => onOpen(productId)} className="flex w-full items-center gap-2.5 py-3 text-left hover:bg-panel-raised/40"><span className="grid size-8 shrink-0 place-items-center rounded border border-line bg-background"><Clock3 size={14} className="text-cyan" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-medium">{product.name}</span><span className="mt-1 block truncate font-mono text-[9px] text-muted-foreground">{product.id} · {place}</span></span><span className="hidden font-mono text-[9px] text-muted-foreground sm:block">{time}</span><StatusBadge status={product.status} /><ArrowRight size={13} className="text-muted-foreground" /></button>; })}{rows.length === 0 && <div className="py-10 text-center text-xs text-muted-foreground">No verification records match your search.</div>}</div></Panel>
  </>;
}

function Alerts({ onOpen }: { onOpen: (id?: string) => void }) {
  return <><SectionHead eyebrow="Monitor · Signal queue" title="Alert center" description="Review signals that may require enhanced checks or a manual product inspection." action={<span className="rounded border border-red/25 bg-red/5 px-2.5 py-2 font-mono text-[9px] text-red">4 OPEN ALERTS</span>} /><div className="space-y-2">{[
    { level: "CRITICAL", title: "Possible cloned product detected", text: "Same product identity scanned across impossible locations within 22 minutes.", id: "VC-FAKE-999", time: "3 min ago", color: "border-red/30 bg-red/5 text-red", icon: ShieldAlert },
    { level: "HIGH", title: "Impossible location movement", text: "An identity associated with scans across Singapore and London in a short period.", id: "VC-SONY-003", time: "15 min ago", color: "border-red/20 bg-red/5 text-red", icon: MapPin },
    { level: "MEDIUM", title: "Unusual scan frequency detected", text: "Repeated requests for the same product identity need an enhanced check.", id: "VC-SONY-003", time: "28 min ago", color: "border-amber/25 bg-amber/5 text-amber", icon: Activity },
    { level: "LOW", title: "Product verification completed", text: "Manufacturer record and supply-chain trail matched at retail.", id: "VC-NIKE-001", time: "42 min ago", color: "border-green/25 bg-green/5 text-green", icon: ClipboardCheck },
  ].map(({ level, title, text, id, time, color, icon: Icon }) => <Panel key={title} className="p-3"><div className="flex flex-wrap items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded border ${color}`}><Icon size={16} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-semibold">{title}</span><span className={`rounded border px-1.5 py-0.5 font-mono text-[8px] ${color}`}>{level}</span></div><p className="mt-1 text-[9px] text-muted-foreground">{text}</p><div className="mt-1.5 font-mono text-[8px] text-muted-foreground">{id} · {time}</div></div><Button onClick={() => onOpen(id)} variant="outline" className="h-8 border-line bg-background px-2 text-[9px]">Review <ArrowRight size={12} /></Button></div></Panel>)}</div>
  </>;
}

function Analytics({ period, setPeriod, selectedTransaction, setSelectedTransaction }: { period: "7 days" | "30 days"; setPeriod: (period: "7 days" | "30 days") => void; selectedTransaction: string | null; setSelectedTransaction: (hash: string | null) => void }) {
  const transaction = demoTransactions.find((item) => item.hash === selectedTransaction);
  return <><SectionHead eyebrow="Monitor · Network records" title="Analytics & blockchain" description="Track identity checks and inspect sample on-chain product registration events." action={<PeriodToggle value={period} onChange={setPeriod} />} />
    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4"><Metric label="Verified checks" value="18,420" hint="This reporting period" color="text-green" icon={ShieldCheck} /><Metric label="Scan anomalies" value="1,284" hint="Flagged for added review" color="text-amber" icon={Activity} /><Metric label="Clone detections" value="84" hint="Across 31 identities" color="text-red" icon={Fingerprint} /><Metric label="Network records" value="18,429,703" hint="Latest confirmed block" color="text-cyan" icon={Blocks} /></div>
    <div className="mt-3 grid gap-3 xl:grid-cols-[1.2fr_0.8fr]"><Panel><PanelHeading title="Verification trend" detail={`Daily authentic and flagged checks · ${period}`} /><ActivityChart period={period} /></Panel><Panel><PanelHeading title="Identity outcomes" detail="Share of product scans assessed" />{[{ label: "Authentic", amount: "82%", width: "82%", color: "bg-green" }, { label: "Needs review", amount: "12%", width: "12%", color: "bg-amber" }, { label: "Clone suspected", amount: "6%", width: "6%", color: "bg-red" }].map(({ label, amount, width, color }) => <div key={label} className="mb-4 last:mb-0"><div className="mb-1.5 flex justify-between text-[10px]"><span>{label}</span><span className="font-mono text-muted-foreground">{amount}</span></div><div className="h-2 overflow-hidden rounded bg-background"><div className={`h-full rounded ${color}`} style={{ width }} /></div></div>)}</Panel></div>
    <Panel className="mt-3 p-0"><div className="flex items-center justify-between border-b border-line px-4 py-3"><div><h2 className="text-sm font-semibold">Recent ledger events</h2><p className="mt-1 text-[9px] text-muted-foreground">Select any record to inspect details</p></div><span className="flex items-center gap-1.5 font-mono text-[9px] text-green"><span className="instrument-pulse size-1.5 rounded-full bg-green" />SYNCED</span></div><div className="divide-y divide-line">{demoTransactions.map((item) => <button key={item.hash} onClick={() => setSelectedTransaction(item.hash)} className="grid w-full grid-cols-[0.65fr_1fr_1fr_0.6fr] items-center gap-2 px-4 py-3 text-left hover:bg-panel-raised/50"><span className="font-mono text-[9px] text-muted-foreground">#{item.block}</span><span className="truncate font-mono text-[9px] text-cyan">{item.hash}</span><span className="truncate text-[9px]">{item.event}</span><span className="font-mono text-[8px] text-green">{item.status}</span></button>)}</div></Panel>
    {transaction && <Modal title="Ledger transaction" onClose={() => setSelectedTransaction(null)}><div className="space-y-3">{[{ label: "Transaction hash", value: transaction.hash }, { label: "Block number", value: transaction.block }, { label: "Timestamp", value: transaction.timestamp }, { label: "Event", value: transaction.event }, { label: "Product ID", value: transaction.productId }, { label: "Status", value: transaction.status }, { label: "Metadata", value: "SHA-256 identity signature confirmed" }].map(({ label, value }) => <div key={label} className="flex items-start justify-between gap-3 border-b border-line pb-2"><span className="font-mono text-[9px] text-muted-foreground">{label}</span><span className="break-all text-right text-[10px]">{value}</span></div>)}</div></Modal>}
  </>;
}

function Admin({ registrationStep, setRegistrationStep, registered, setRegistered }: { registrationStep: number; setRegistrationStep: (value: number) => void; registered: boolean; setRegistered: (value: boolean) => void }) {
  const steps = ["Product information", "Manufacturer", "Metadata", "Identity", "Blockchain", "QR code"];
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [batch, setBatch] = useState("");
  const [error, setError] = useState("");
  const advance = () => {
    if (registrationStep === 0 && !name.trim()) { setError("Enter a product name to continue."); return; }
    if (registrationStep === 1 && !manufacturer.trim()) { setError("Enter a manufacturer to continue."); return; }
    setError("");
    if (registrationStep === 5) { setRegistered(true); return; }
    setRegistrationStep(registrationStep + 1);
  };
  return <><SectionHead eyebrow="System · Identity enrollment" title="Register a product" description="Create a demonstration product identity and walk through its provenance enrollment steps." />
    <Panel className="mx-auto max-w-3xl"><div className="mb-5 flex items-center justify-between gap-1 overflow-x-auto">{steps.map((label, index) => <div key={label} className="flex min-w-[60px] flex-1 flex-col items-center gap-1.5"><div className={`grid size-7 place-items-center rounded-full border font-mono text-[9px] ${registrationStep === index ? "border-cyan bg-cyan/10 text-cyan" : registrationStep > index || registered ? "border-green/30 bg-green/10 text-green" : "border-line text-muted-foreground"}`}>{registrationStep > index || registered ? "✓" : index + 1}</div><span className={`text-center text-[8px] ${registrationStep === index ? "text-cyan" : "text-muted-foreground"}`}>{label}</span></div>)}</div>
      {registered ? <div className="py-6 text-center"><div className="mx-auto grid size-12 place-items-center rounded-full border border-green/30 bg-green/10 text-green"><ShieldCheck size={24} /></div><h2 className="mt-3 font-display text-lg font-semibold text-green">Product registered successfully</h2><p className="mt-2 text-xs text-muted-foreground">{name} · {manufacturer} · {batch || "New batch"}</p><div className="mx-auto mt-4 max-w-sm rounded border border-line bg-background p-3 text-left"><div className="font-mono text-[8px] uppercase text-muted-foreground">Generated product ID</div><div className="mt-1 font-mono text-xs text-cyan">VC-DEMO-005</div><div className="mt-3 font-mono text-[8px] uppercase text-muted-foreground">Blockchain transaction</div><div className="mt-1 font-mono text-[10px]">0x82ab…f912</div></div><Button onClick={() => { setRegistered(false); setRegistrationStep(0); setName(""); setManufacturer(""); setBatch(""); }} className="mt-4"><Plus size={14} /> Register another</Button></div> : <>
        {registrationStep === 0 && <FormField label="Product name" value={name} onChange={setName} placeholder="e.g. Air Max 2026" />}
        {registrationStep === 1 && <FormField label="Manufacturer" value={manufacturer} onChange={setManufacturer} placeholder="e.g. Nike" />}
        {registrationStep === 2 && <><FormField label="Batch number" value={batch} onChange={setBatch} placeholder="e.g. B2026-091" /><div className="mt-3 rounded border border-line bg-background p-3 text-[10px] text-muted-foreground">A verification-ready metadata record will be prepared from the details provided.</div></>}
        {registrationStep === 3 && <div className="rounded border border-cyan/25 bg-cyan/5 p-4"><div className="flex items-center gap-2 text-xs text-cyan"><Fingerprint size={15} />Identity generated</div><div className="mt-2 font-mono text-sm">VC-DEMO-005</div><div className="mt-1 text-[9px] text-muted-foreground">A unique product ID is ready for the demo ledger.</div></div>}
        {registrationStep === 4 && <div className="rounded border border-green/25 bg-green/5 p-4"><div className="flex items-center gap-2 text-xs text-green"><Blocks size={15} />Registration transaction confirmed</div><div className="mt-2 font-mono text-[10px]">0x82ab…f912 · Block 18,429,703</div></div>}
        {registrationStep === 5 && <div className="mx-auto grid max-w-sm justify-items-center rounded border border-line bg-background p-5"><div className="grid size-28 grid-cols-7 gap-1" aria-label="Product QR code">{Array.from({ length: 49 }, (_, i) => <span key={i} className={`rounded-[1px] ${[0,1,2,5,7,9,10,12,14,17,18,20,21,24,25,27,28,31,32,34,36,38,40,41,42,45,47,48].includes(i) ? "bg-cyan" : "bg-panel-raised"}`} />)}</div><span className="mt-3 font-mono text-[10px]">VC-DEMO-005</span></div>}
        {error && <p role="alert" className="mt-3 text-[10px] text-amber">{error}</p>}
        <div className="mt-5 flex justify-between border-t border-line pt-4">{registrationStep > 0 ? <Button variant="outline" onClick={() => { setError(""); setRegistrationStep(registrationStep - 1); }} className="border-line bg-background text-xs">Back</Button> : <span />}<Button onClick={advance} className="text-xs">{registrationStep === 5 ? "Generate QR code" : registrationStep === 4 ? "Continue to QR code" : "Continue"} <ArrowRight size={13} /></Button></div>
      </>}
    </Panel>
  </>;
}

function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block"><span className="mb-1.5 block font-mono text-[9px] uppercase text-muted-foreground">{label}</span><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 border-line bg-background text-xs" /></label>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [onClose]);
  return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-[60] flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-md border border-line bg-panel p-4 shadow-2xl"><div className="mb-4 flex items-center justify-between border-b border-line pb-3"><h2 className="text-sm font-semibold">{title}</h2><Button variant="ghost" onClick={onClose} aria-label="Close dialog" size="icon" className="h-8 w-8 text-muted-foreground"><X size={15} /></Button></div>{children}</section></div>;
}