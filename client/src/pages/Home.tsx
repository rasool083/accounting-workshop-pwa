import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  Cloud,
  CloudDownload,
  CloudUpload,
  FileClock,
  FileDown,
  FileJson,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Pencil,
  Plus,
  Percent,
  RefreshCw,
  Tags,
  Search,
  Settings2,
  ShieldCheck,
  Upload,
  Trash2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  AppState,
  CheckStatus,
  PageId,
  TransactionType,
  appendAudit,
  calculateMetrics,
  createId,
  exportPayload,
  formatDate,
  formatMoney,
  formatNumber,
  importPayload,
  loadState,
  navItems,
  personName,
  saveState,
  todayJalali,
  transactionLabel,
  calculateLateProfit,
  allocateCheckFIFO,
  applyCheckFIFO,
  createEmptyState,
  PERSON_TYPES,
  UNIT_OPTIONS,
} from "@/lib/accounting";
import {
  createGoogleDriveAdapter,
  getDriveAccessToken,
  LAST_VERIFIED_BACKUP,
  PROJECT_BACKUPS_FOLDER_ID,
  PROJECT_BACKUPS_FOLDER_URL,
  PROJECT_DRIVE_FOLDER_URL,
  type DriveBackupFile,
} from "@/lib/googleDrive";

const iconMap = {
  "layout-dashboard": LayoutDashboard,
  "file-text": FileText,
  "arrow-left-right": ArrowLeftRight,
  users: Users,
  boxes: Boxes,
  "file-clock": FileClock,
  "chart-no-axes-combined": ChartNoAxesCombined,
  "cloud-cog": Cloud,
  settings: Settings2,
  tags: Tags,
  percent: Percent,
  "lock-keyhole": LockKeyhole,
} as const;

function Icon({
  name,
  size = 18,
}: {
  name: keyof typeof iconMap;
  size?: number;
}) {
  const Component = iconMap[name];
  return <Component size={size} strokeWidth={1.8} />;
}

function statusClass(status: string) {
  if (["وصول شده", "ثبت شده", "تودیع شده"].includes(status))
    return "status-success";
  if (["برگشتی", "باطل"].includes(status)) return "status-danger";
  return "status-warning";
}

function EmptyState({
  title,
  description,
  onAction,
  actionLabel,
}: {
  title: string;
  description: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <FileJson size={22} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
      {onAction && actionLabel && (
        <button
          className="button button-primary button-small"
          onClick={onAction}
        >
          <Plus size={16} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([LAST_VERIFIED_BACKUP]);
  const [driveLoading, setDriveLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem("accounting-workshop-pwa:v1", JSON.stringify(state));
  }, [state]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (activePage === "backup") void handleDriveRefresh();
  }, [activePage]);

  const metrics = useMemo(() => calculateMetrics(state), [state]);
  const activeNav =
    navItems.find(item => item.id === activePage) || navItems[0];

  function updateState(next: AppState, message: string) {
    setState(saveState(appendAudit(next, "UPDATE", message)));
    setNotice(message);
  }

  function handleExport() {
    const blob = new Blob([exportPayload(state)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup-accounting-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("فایل پشتیبان با موفقیت آماده شد");
  }

  function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = importPayload(String(reader.result));
        setState(
          saveState(appendAudit(next, "RESTORE", `بازیابی از ${file.name}`))
        );
        setNotice("بازیابی با موفقیت انجام شد");
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : "خواندن فایل ناموفق بود"
        );
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function handleClearAll() {
    handleExport();
    const cleared = createEmptyState(state);
    setState(saveState(cleared));
    setNotice("ابتدا بکاپ دانلود و سپس اطلاعات کسب‌وکار پاک شد");
  }

  async function handleDriveUpload() {
    const token = getDriveAccessToken();
    if (!token) {
      setNotice("مجوز موقت Drive در این مرورگر تزریق نشده است؛ بکاپ محلی آماده دانلود است");
      handleExport();
      return;
    }
    try {
      const filename = `accounting-workshop-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const uploaded = await createGoogleDriveAdapter(token, PROJECT_BACKUPS_FOLDER_ID).uploadBackup(filename, exportPayload(state));
      setDriveBackups(current => [uploaded, ...current.filter(file => file.id !== uploaded.id)]);
      setNotice("پشتیبان در پوشه اختصاصی Google Drive ذخیره شد");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "بارگذاری در Drive ناموفق بود");
    }
  }

  async function handleDriveRefresh() {
    const token = getDriveAccessToken();
    if (!token) return;
    setDriveLoading(true);
    try {
      const files = await createGoogleDriveAdapter(token, PROJECT_BACKUPS_FOLDER_ID).listBackups();
      setDriveBackups(files.length ? files : [LAST_VERIFIED_BACKUP]);
      setNotice(`${formatNumber(files.length)} نسخهٔ پشتیبان از Drive خوانده شد`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "خواندن فهرست Drive ناموفق بود");
    } finally {
      setDriveLoading(false);
    }
  }

  async function handleDriveRestore(fileId = LAST_VERIFIED_BACKUP.id) {
    if (!window.confirm("داده‌های محلی با آخرین نسخه Google Drive جایگزین شود؟ قبل از ادامه، از داده فعلی بکاپ بگیرید.")) return;
    const token = getDriveAccessToken();
    if (!token) {
      setNotice("مجوز موقت Drive در این مرورگر تزریق نشده است؛ از لینک پوشه استفاده کنید");
      return;
    }
    try {
      const file = driveBackups.find(item => item.id === fileId) || LAST_VERIFIED_BACKUP;
      const payload = await createGoogleDriveAdapter(token, PROJECT_BACKUPS_FOLDER_ID).downloadBackup(file.id);
      const next = importPayload(payload);
      setState(saveState(appendAudit(next, "RESTORE_DRIVE", `بازیابی از ${file.name}`)));
      setNotice("بازیابی از Google Drive با موفقیت انجام شد");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "بازیابی از Drive ناموفق بود");
    }
  }

  function addTransaction(input: {
    type: TransactionType;
    amount: number;
    partyId?: string;
    note: string;
    date: string;
  }) {
    const next = {
      ...state,
      transactions: [
        { id: createId("txn"), status: "ثبت شده" as const, ...input },
        ...state.transactions,
      ],
    };
    updateState(next, `ثبت ${transactionLabel(input.type)} جدید`);
    setQuickOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <span>ک</span>
          </div>
          <div>
            <strong>کارگاه</strong>
            <small>دفتر هوشمند</small>
          </div>
          <button className="mobile-close" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switch">
          <div className="workspace-avatar">ک</div>
          <div>
            <strong>{state.settings.businessName}</strong>
            <small>نسخه محلی فعال</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">منوی اصلی</div>
        <nav className="main-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? "active" : ""}`}
              onClick={() => {
                setActivePage(item.id);
                setMobileNav(false);
              }}
            >
              <span className="nav-icon">
                <Icon name={item.icon as keyof typeof iconMap} size={18} />
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.caption}</small>
              </span>
              {item.id === "checks" &&
                state.checks.filter(check => check.status === "برگشتی").length >
                  0 && (
                  <b className="nav-count">
                    {
                      state.checks.filter(check => check.status === "برگشتی")
                        .length
                    }
                  </b>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="offline-card">
            <div className="online-dot" />
            <div>
              <strong>ذخیره‌سازی محلی</strong>
              <small>اطلاعات روی همین دستگاه</small>
            </div>
          </div>
          <button
            className="settings-link"
            onClick={() => setActivePage("settings")}
          >
            <Settings2 size={17} />
            تنظیمات برنامه
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMobileNav(false)}
          aria-label="بستن منو"
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-title">
            <button className="mobile-menu" onClick={() => setMobileNav(true)}>
              <Menu size={21} />
            </button>
            <div>
              <div className="eyebrow">{todayJalali()}</div>
              <h1>{activeNav.label}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="save-indicator">
              <span />
              <span>ذخیره خودکار فعال</span>
            </div>
            <button
              className="icon-button"
              title="پشتیبان‌گیری"
              onClick={handleExport}
            >
              <FileDown size={18} />
            </button>
            <button className="user-chip">
              <span className="user-avatar">م</span>
              <span className="user-name">مدیر کارگاه</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <div className="content-wrap">
          {activePage === "invoices" && (
            <Invoices
              state={state}
              onSave={(next, msg) => updateState(next, msg)}
            />
          )}
          {activePage === "dashboard" && (
            <Dashboard
              state={state}
              metrics={metrics}
              onQuick={() => setQuickOpen(true)}
              onNavigate={setActivePage}
            />
          )}
          {activePage === "transactions" && (
            <Transactions
              state={state}
              onQuick={() => setQuickOpen(true)}
              onSave={(next, msg) => updateState(next, msg)}
            />
          )}
          {activePage === "people" && (
            <People
              state={state}
              onSave={(next, msg) => updateState(next, msg)}
            />
          )}
          {activePage === "inventory" && (
            <Inventory
              state={state}
              onSave={(next, msg) => updateState(next, msg)}
            />
          )}
          {activePage === "prices" && (
            <Prices
              state={state}
              onSave={(next, msg) => updateState(next, msg)}
            />
          )}
          {activePage === "paymentRules" && (
            <PaymentRules
              state={state}
              onSave={(next, msg) => updateState(next, msg)}
            />
          )}
          {activePage === "checks" && (
            <Checks
              state={state}
              onSave={(next, msg) => updateState(next, msg)}
            />
          )}
          {activePage === "monthClose" && (
            <MonthClose
              state={state}
              onSave={(next, msg) => updateState(next, msg)}
            />
          )}
          {activePage === "reports" && (
            <Reports state={state} metrics={metrics} />
          )}
          {activePage === "backup" && (
            <BackupPage
              state={state}
              onExport={handleExport}
              onImport={() => fileInput.current?.click()}
              onClearAll={handleClearAll}
              onDriveRestore={handleDriveRestore}
              onDriveUpload={handleDriveUpload}
              driveBackups={driveBackups}
              driveLoading={driveLoading}
              onDriveRefresh={handleDriveRefresh}
            />
          )}
          {activePage === "settings" && (
            <SettingsPage state={state} onSave={(next, msg) => updateState(next, msg)} />
          )}
        </div>
      </main>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleImport}
      />
      {quickOpen && (
        <QuickAdd
          onClose={() => setQuickOpen(false)}
          people={state.people}
          onSave={addTransaction}
        />
      )}
      {notice && (
        <div className="toast">
          <Check size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}

function Dashboard({
  state,
  metrics,
  onQuick,
  onNavigate,
}: {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
  onQuick: () => void;
  onNavigate: (page: PageId) => void;
}) {
  const recent = state.transactions.slice(0, 5);
  return (
    <div className="page-stack page-enter">
      <section className="welcome-row">
        <div>
          <div className="eyebrow accent-eyebrow">مرکز کنترل کارگاه</div>
          <h2>
            خلاصهٔ امروز، <em>روشن و ساده</em>
          </h2>
          <p>
            اطلاعات مالی و عملیاتی را یک‌جا ببینید و با خیال راحت جلو بروید.
          </p>
        </div>
        <button className="button button-primary" onClick={onQuick}>
          <Plus size={18} />
          ثبت عملیات جدید
        </button>
      </section>
      <section className="metric-grid">
        <MetricCard
          label="دریافت این دوره"
          value={formatMoney(metrics.receipts, state.settings.currency)}
          helper="نقدینگی واردشده"
          icon={<ArrowDownLeft size={20} />}
          tone="mint"
        />
        <MetricCard
          label="پرداخت و هزینه"
          value={formatMoney(metrics.payments, state.settings.currency)}
          helper="خروجی ثبت‌شده"
          icon={<ArrowUpRight size={20} />}
          tone="rose"
        />
        <MetricCard
          label="مانده خالص"
          value={formatMoney(metrics.balance, state.settings.currency)}
          helper="دریافت منهای پرداخت"
          icon={<WalletCards size={20} />}
          tone="indigo"
        />
        <MetricCard
          label="چک‌های در جریان"
          value={formatMoney(
            metrics.outstandingChecks,
            state.settings.currency
          )}
          helper={`${formatNumber(state.checks.length)} فقره ثبت‌شده`}
          icon={<FileClock size={20} />}
          tone="amber"
        />
      </section>
      <section className="dashboard-grid">
        <div className="panel large-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">گردش مالی</span>
              <h3>آخرین عملیات</h3>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("transactions")}
            >
              مشاهده همه <ArrowLeftRight size={15} />
            </button>
          </div>
          {recent.length ? (
            <div className="activity-list">
              {recent.map(item => (
                <ActivityRow key={item.id} item={item} state={state} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="هنوز عملیاتی ثبت نشده"
              description="اولین فروش، دریافت یا هزینهٔ کارگاه را ثبت کنید تا گردش مالی اینجا نمایش داده شود."
              onAction={onQuick}
              actionLabel="ثبت اولین عملیات"
            />
          )}
        </div>
        <div className="panel action-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">دسترسی سریع</span>
              <h3>کارهای روزانه</h3>
            </div>
            <span className="panel-dot" />
          </div>
          <div className="quick-actions">
            <QuickAction
              icon={<ArrowDownLeft />}
              label="ثبت دریافت"
              tone="mint"
              onClick={onQuick}
            />
            <QuickAction
              icon={<ArrowUpRight />}
              label="ثبت پرداخت"
              tone="rose"
              onClick={onQuick}
            />
            <QuickAction
              icon={<Users />}
              label="طرف حساب جدید"
              tone="violet"
              onClick={() => onNavigate("people")}
            />
            <QuickAction
              icon={<Boxes />}
              label="بررسی موجودی"
              tone="amber"
              onClick={() => onNavigate("inventory")}
            />
          </div>
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>
              <strong>داده‌ها در امان‌اند</strong>
              <small>ذخیره خودکار روی دستگاه شما فعال است.</small>
            </span>
          </div>
        </div>
      </section>
      <section className="bottom-grid">
        <div className="mini-panel">
          <div className="mini-panel-title">
            <span className="mini-icon mint">
              <Users size={17} />
            </span>
            <span>
              <strong>طرف حساب‌ها</strong>
              <small>دفتر ارتباطات مالی</small>
            </span>
          </div>
          <strong className="big-number">
            {formatNumber(state.people.length)}
          </strong>
          <button className="under-button" onClick={() => onNavigate("people")}>
            مدیریت طرف حساب‌ها <ArrowLeftRight size={14} />
          </button>
        </div>
        <div className="mini-panel">
          <div className="mini-panel-title">
            <span className="mini-icon amber">
              <Boxes size={17} />
            </span>
            <span>
              <strong>موجودی کالا</strong>
              <small>کالاهای قابل پیگیری</small>
            </span>
          </div>
          <strong className="big-number">
            {formatNumber(state.products.length)}
          </strong>
          <button
            className="under-button"
            onClick={() => onNavigate("inventory")}
          >
            مشاهده انبار <ArrowLeftRight size={14} />
          </button>
        </div>
        <div className="mini-panel">
          <div className="mini-panel-title">
            <span className="mini-icon violet">
              <Banknote size={17} />
            </span>
            <span>
              <strong>حساب‌های نقدی</strong>
              <small>بانک و صندوق</small>
            </span>
          </div>
          <strong className="big-number">
            {formatMoney(
              state.accounts.reduce((sum, account) => sum + account.balance, 0),
              state.settings.currency
            )}
          </strong>
          <button
            className="under-button"
            onClick={() => onNavigate("reports")}
          >
            گزارش نقدینگی <ArrowLeftRight size={14} />
          </button>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
      <div className="metric-spark">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
function QuickAction({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button className="quick-action" onClick={onClick}>
      <span className={`quick-icon ${tone}`}>{icon}</span>
      <span>{label}</span>
      <ArrowLeftRight size={14} />
    </button>
  );
}
function ActivityRow({
  item,
  state,
}: {
  item: AppState["transactions"][number];
  state: AppState;
}) {
  const incoming = ["دریافت", "درآمد"].includes(item.type);
  return (
    <div className="activity-row">
      <span className={`activity-icon ${incoming ? "mint" : "rose"}`}>
        {incoming ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
      </span>
      <span className="activity-main">
        <strong>{transactionLabel(item.type)}</strong>
        <small>
          {personName(state, item.partyId)} · {formatDate(item.date)}
        </small>
      </span>
      <strong className={incoming ? "amount-positive" : "amount-negative"}>
        {incoming ? "+" : "−"}
        {formatMoney(item.amount, state.settings.currency)}
      </strong>
      <span className={`status-pill ${statusClass(item.status)}`}>
        {item.status}
      </span>
    </div>
  );
}

function Invoices({
  state,
  onSave,
}: {
  state: AppState;
  onSave: (state: AppState, message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<
    AppState["invoices"][number] | null
  >(null);
  const [selectedInvoice, setSelectedInvoice] = useState<
    AppState["invoices"][number] | null
  >(null);
  const blankItem = { productId: "", quantity: "1", unit: "", unitPrice: "" };
  const [form, setForm] = useState({
    number: "",
    type: "فروش" as "فروش" | "خرید",
    date: todayJalali(),
    partyId: "",
    paymentRuleId: "",
    priceHistoryId: "",
    items: [blankItem],
    note: "",
  });
  const party = state.people.find(item => item.id === form.partyId);
  const calculatedAmount = form.items.reduce(
    (sum, item) =>
      sum +
      (Number(item.quantity) || 0) *
        (Number(item.unitPrice.replace(/[^0-9.-]/g, "")) || 0),
    0
  );
  function voidInvoice(invoice: AppState["invoices"][number]) {
    if (invoice.status === "باطل") return;
    const products = state.products.map(product => {
      const movement = invoice.items
        .filter(item => item.productId === product.id)
        .reduce((sum, item) => sum + (item.quantityBase ?? item.quantity), 0);
      if (!movement) return product;
      return {
        ...product,
        stock: product.stock + (invoice.type === "فروش" ? movement : -movement),
      };
    });
    onSave(
      {
        ...state,
        products,
        invoices: state.invoices.map(item =>
          item.id === invoice.id ? { ...item, status: "باطل" as const } : item
        ),
      },
      `فاکتور ${invoice.number} باطل شد و موجودی اصلاح گردید`
    );
    setSelectedInvoice(null);
  }
  function updateItem(index: number, patch: Partial<typeof blankItem>) {
    setForm({
      ...form,
      items: form.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    });
  }
  function openEdit(invoice: AppState["invoices"][number]) {
    if (invoice.status === "باطل" || invoice.paidAmount > 0) return;
    setEditingInvoice(invoice);
    setForm({
      number: invoice.number,
      type: invoice.type,
      date: invoice.date,
      partyId: invoice.partyId || "",
      paymentRuleId: invoice.paymentRuleId || "",
      priceHistoryId: invoice.priceHistoryId || "",
      items: invoice.items.map(item => ({
        productId: item.productId || "",
        quantity: String(item.quantity),
        unit: item.unit,
        unitPrice: String(item.unitPrice),
      })),
      note: invoice.note,
    });
    setSelectedInvoice(null);
    setOpen(true);
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!calculatedAmount) return;
    const items = form.items.map(row => {
      const product = state.products.find(item => item.id === row.productId);
      const quantity = Number(row.quantity) || 0;
      const unitPrice = Number(row.unitPrice.replace(/[^0-9.-]/g, "")) || 0;
      const unit = row.unit || product?.unit || "عدد";
      const conversionRate =
        product && unit === product.unit2 ? product.conversionRate || 1 : 1;
      return {
        id: createId("invoice-item"),
        productId: row.productId || undefined,
        description: product?.name || "خدمت/کالای آزاد",
        quantity,
        unit,
        conversionRate,
        quantityBase: quantity * conversionRate,
        unitPrice,
        total: quantity * unitPrice,
      };
    });
    const invoice = {
      id: editingInvoice?.id || createId("invoice"),
      number:
        form.number.trim() ||
        String(state.invoices.length + 1).padStart(4, "0"),
      type: form.type,
      date: form.date,
      partyId: form.partyId || undefined,
      paymentRuleId:
        form.paymentRuleId ||
        party?.defaultPaymentRuleId ||
        state.paymentRules.find(item => item.active)?.id,
      priceHistoryId: form.priceHistoryId || undefined,
      items,
      allocations: editingInvoice?.allocations || [],
      amount: calculatedAmount,
      paidAmount: editingInvoice?.paidAmount || 0,
      status: editingInvoice?.status || ("باز" as const),
      note: form.note,
    };
    const products = state.products.map(product => {
      const oldMovement =
        editingInvoice?.items
          .filter(item => item.productId === product.id)
          .reduce(
            (sum, item) => sum + (item.quantityBase ?? item.quantity),
            0
          ) || 0;
      const newMovement = items
        .filter(item => item.productId === product.id)
        .reduce((sum, item) => sum + (item.quantityBase ?? item.quantity), 0);
      const restored = editingInvoice
        ? editingInvoice.type === "خرید"
          ? -oldMovement
          : oldMovement
        : 0;
      const applied = form.type === "خرید" ? newMovement : -newMovement;
      return { ...product, stock: product.stock + restored + applied };
    });
    const invoices = editingInvoice
      ? state.invoices.map(item =>
          item.id === editingInvoice.id ? invoice : item
        )
      : [invoice, ...state.invoices];
    onSave(
      { ...state, products, invoices },
      editingInvoice
        ? `فاکتور ${invoice.number} ویرایش شد و موجودی اصلاح گردید`
        : form.type === "فروش"
          ? "فاکتور فروش ثبت شد و خروج کالا از انبار انجام شد"
          : "فاکتور خرید ثبت شد و ورود کالا به انبار انجام شد"
    );
    setOpen(false);
    setEditingInvoice(null);
    setForm({
      number: "",
      type: "فروش",
      date: todayJalali(),
      partyId: "",
      paymentRuleId: "",
      priceHistoryId: "",
      items: [blankItem],
      note: "",
    });
  }
  return (
    <div className="page-stack page-enter">
      <PageIntro
        kicker="مرکز اسناد"
        title="فاکتورها"
        description="چند ردیف کالا/خدمت را ثبت کنید؛ مبلغ کل و گردش موجودی خودکار محاسبه می‌شود."
        actionLabel="ثبت فاکتور"
        onAction={() => setOpen(true)}
      />
      <section className="metric-grid">
        <MetricCard
          label="فاکتورهای باز"
          value={formatNumber(
            state.invoices.filter(invoice => invoice.status !== "تسویه شده")
              .length
          )}
          helper="اسناد دارای مانده"
          icon={<FileText size={20} />}
          tone="amber"
        />
        <MetricCard
          label="مانده فاکتورها"
          value={formatMoney(
            state.invoices.reduce(
              (sum, invoice) =>
                sum + Math.max(0, invoice.amount - invoice.paidAmount),
              0
            ),
            state.settings.currency
          )}
          helper="مبلغ قابل وصول"
          icon={<WalletCards size={20} />}
          tone="rose"
        />
        <MetricCard
          label="فروش ثبت‌شده"
          value={formatMoney(
            state.invoices
              .filter(invoice => invoice.type === "فروش")
              .reduce((sum, invoice) => sum + invoice.amount, 0),
            state.settings.currency
          )}
          helper="قبل از تسویه"
          icon={<ArrowDownLeft size={20} />}
          tone="mint"
        />
        <MetricCard
          label="خرید ثبت‌شده"
          value={formatMoney(
            state.invoices
              .filter(invoice => invoice.type === "خرید")
              .reduce((sum, invoice) => sum + invoice.amount, 0),
            state.settings.currency
          )}
          helper="ورودی انبار"
          icon={<Boxes size={20} />}
          tone="indigo"
        />
      </section>
      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">دفتر فاکتور</span>
            <h3>{formatNumber(state.invoices.length)} فاکتور</h3>
          </div>
          <span className="soft-tag">FIFO چک‌ها و ماندهٔ واقعی</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>شماره</th>
                <th>تاریخ</th>
                <th>طرف حساب</th>
                <th>اقلام</th>
                <th>مبلغ</th>
                <th>تسویه</th>
                <th>مانده</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {state.invoices.length ? (
                state.invoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.number}</strong>
                    </td>
                    <td>{formatDate(invoice.date)}</td>
                    <td>{personName(state, invoice.partyId)}</td>
                    <td>{formatNumber(invoice.items.length)} قلم</td>
                    <td className="amount-cell">
                      {formatMoney(invoice.amount, state.settings.currency)}
                    </td>
                    <td>
                      {formatMoney(invoice.paidAmount, state.settings.currency)}
                    </td>
                    <td className="amount-cell">
                      {formatMoney(
                        Math.max(0, invoice.amount - invoice.paidAmount),
                        state.settings.currency
                      )}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        جزئیات
                      </button>{" "}
                      <span
                        className={`status-pill ${invoice.status === "تسویه شده" ? "status-success" : invoice.status === "باطل" ? "status-danger" : "status-warning"}`}
                      >
                        {invoice.status}
                      </span>
                      {invoice.paidAmount === 0 &&
                        invoice.status !== "باطل" && (
                          <button
                            className="icon-button row-action"
                            title="ویرایش فاکتور"
                            onClick={() => openEdit(invoice)}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      {invoice.paidAmount === 0 &&
                        invoice.status !== "باطل" && (
                          <button
                            className="icon-button row-action"
                            title="حذف فاکتور"
                            onClick={() =>
                              window.confirm("فاکتور حذف شود؟") &&
                              onSave(
                                {
                                  ...state,
                                  invoices: state.invoices.filter(
                                    item => item.id !== invoice.id
                                  ),
                                },
                                "فاکتور حذف شد"
                              )
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="فاکتوری ثبت نشده"
                      description="اولین فاکتور را با چند ردیف کالا ثبت کنید."
                      onAction={() => setOpen(true)}
                      actionLabel="ثبت فاکتور"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <Dialog
          title={
            editingInvoice
              ? `ویرایش فاکتور ${editingInvoice.number}`
              : "ثبت فاکتور چندردیفی"
          }
          onClose={() => setOpen(false)}
        >
          <form onSubmit={submit} className="form-grid">
            <label>
              شماره فاکتور
              <input
                value={form.number}
                onChange={e => setForm({ ...form, number: e.target.value })}
              />
            </label>
            <label>
              نوع فاکتور
              <select
                value={form.type}
                onChange={e =>
                  setForm({ ...form, type: e.target.value as "فروش" | "خرید" })
                }
              >
                <option>فروش</option>
                <option>خرید</option>
              </select>
            </label>
            <label>
              تاریخ فاکتور
              <input
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label>
              طرف حساب
              <select
                value={form.partyId}
                onChange={e =>
                  setForm({
                    ...form,
                    partyId: e.target.value,
                    paymentRuleId: "",
                  })
                }
              >
                <option value="">بدون طرف حساب</option>
                {state.people.map(person => (
                  <option value={person.id} key={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              شرایط پرداخت
              <select
                value={form.paymentRuleId || party?.defaultPaymentRuleId || ""}
                onChange={e =>
                  setForm({ ...form, paymentRuleId: e.target.value })
                }
              >
                <option value="">پیش‌فرض طرف حساب/فعال</option>
                {state.paymentRules.map(rule => (
                  <option value={rule.id} key={rule.id}>
                    {rule.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="full-field invoice-items-editor">
              <div className="tier-editor-head">
                <span>ریزاقلام فاکتور</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setForm({ ...form, items: [...form.items, blankItem] })
                  }
                >
                  <Plus size={14} />
                  افزودن ردیف
                </button>
              </div>
              {form.items.map((row, index) => (
                <div className="invoice-item-row" key={index}>
                  <select
                    value={row.productId}
                    onChange={e => {
                      const product = state.products.find(
                        item => item.id === e.target.value
                      );
                      updateItem(index, {
                        productId: e.target.value,
                        unitPrice: product
                          ? String(product.price)
                          : row.unitPrice,
                      });
                    }}
                  >
                    <option value="">کالا/خدمت آزاد</option>
                    {state.products.map(product => (
                      <option value={product.id} key={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <input
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={e =>
                      updateItem(index, { quantity: e.target.value })
                    }
                    placeholder="تعداد"
                  />
                  <select
                    value={row.unit}
                    onChange={e => updateItem(index, { unit: e.target.value })}
                  >
                    <option value="">واحد پایه</option>
                    {state.products.find(
                      product => product.id === row.productId
                    ) &&
                      [
                        state.products.find(
                          product => product.id === row.productId
                        )!.unit,
                        state.products.find(
                          product => product.id === row.productId
                        )!.unit2,
                      ]
                        .filter(Boolean)
                        .map(unit => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                  </select>
                  <input
                    inputMode="numeric"
                    value={row.unitPrice}
                    onChange={e =>
                      updateItem(index, { unitPrice: e.target.value })
                    }
                    placeholder="قیمت واحد"
                  />
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() =>
                        setForm({
                          ...form,
                          items: form.items.filter(
                            (_, itemIndex) => itemIndex !== index
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="panel invoice-total">
              <span>مبلغ کل فاکتور</span>
              <strong>
                {formatMoney(calculatedAmount, state.settings.currency)}
              </strong>
            </div>
            <label className="full-field">
              توضیحات
              <input
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setOpen(false)}
              >
                انصراف
              </button>
              <button className="button button-primary" type="submit">
                <Check size={17} />
                ذخیره فاکتور
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {selectedInvoice && (
        <Dialog
          title={`جزئیات فاکتور ${selectedInvoice.number}`}
          onClose={() => setSelectedInvoice(null)}
        >
          <div className="invoice-detail">
            <div className="detail-meta">
              <span>تاریخ {formatDate(selectedInvoice.date)}</span>
              <span>{personName(state, selectedInvoice.partyId)}</span>
              <span>{selectedInvoice.type}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>شرح</th>
                    <th>تعداد</th>
                    <th>واحد</th>
                    <th>قیمت واحد</th>
                    <th>جمع</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items.map(item => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td>{formatNumber(item.quantity)}</td>
                      <td>{item.unit}</td>
                      <td>
                        {formatMoney(item.unitPrice, state.settings.currency)}
                      </td>
                      <td>
                        {formatMoney(item.total, state.settings.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="invoice-detail-total">
              <span>مبلغ کل</span>
              <strong>
                {formatMoney(selectedInvoice.amount, state.settings.currency)}
              </strong>
            </div>
            {selectedInvoice.status !== "باطل" && (
              <div className="form-actions">
                <button
                  className="button button-ghost"
                  onClick={() => window.print()}
                >
                  چاپ فاکتور
                </button>
                {selectedInvoice.paidAmount === 0 && (
                  <button
                    className="button button-ghost"
                    onClick={() => openEdit(selectedInvoice)}
                  >
                    ویرایش فاکتور
                  </button>
                )}
                <button
                  className="button button-danger"
                  onClick={() => voidInvoice(selectedInvoice)}
                >
                  ابطال فاکتور و اصلاح موجودی
                </button>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
function Transactions({
  state,
  onQuick,
  onSave,
}: {
  state: AppState;
  onQuick: () => void;
  onSave: (state: AppState, message: string) => void;
}) {
  const [editingTransaction, setEditingTransaction] = useState<
    AppState["transactions"][number] | null
  >(null);
  const [editForm, setEditForm] = useState({
    type: "دریافت" as TransactionType,
    amount: "",
    partyId: "",
    note: "",
    date: todayJalali(),
  });
  function beginTransactionEdit(item: AppState["transactions"][number]) {
    setEditingTransaction(item);
    setEditForm({
      type: item.type,
      amount: String(item.amount),
      partyId: item.partyId || "",
      note: item.note || "",
      date: item.date,
    });
  }
  function saveTransactionEdit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(editForm.amount.replace(/[^0-9.-]/g, ""));
    if (!amount || !editingTransaction) return;
    onSave(
      {
        ...state,
        transactions: state.transactions.map(row =>
          row.id === editingTransaction.id
            ? {
                ...row,
                type: editForm.type,
                amount,
                partyId: editForm.partyId || undefined,
                note: editForm.note,
                date: editForm.date,
              }
            : row
        ),
      },
      "تمام اطلاعات عملیات ویرایش شد"
    );
    setEditingTransaction(null);
  }
  return (
    <div className="page-stack page-enter">
      <PageIntro
        kicker="دفتر عملیات"
        title="عملیات مالی"
        description="فروش، خرید، دریافت، پرداخت و هزینه‌ها را در یک دفتر شفاف مدیریت کنید."
        actionLabel="ثبت عملیات"
        onAction={onQuick}
      />
      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input placeholder="جست‌وجوی عملیات یا طرف حساب..." />
        </div>
        <button className="filter-button">
          همه عملیات <ChevronDown size={15} />
        </button>
        <button className="filter-button">
          این ماه <ChevronDown size={15} />
        </button>
      </div>
      <div className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>نوع عملیات</th>
                <th>تاریخ</th>
                <th>طرف حساب</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {state.transactions.length ? (
                state.transactions.map(item => (
                  <tr key={item.id}>
                    <td>
                      <span className="table-type">
                        <span
                          className={`table-dot ${["دریافت", "درآمد"].includes(item.type) ? "mint" : "rose"}`}
                        />
                        {transactionLabel(item.type)}
                      </span>
                    </td>
                    <td>{formatDate(item.date)}</td>
                    <td>{personName(state, item.partyId)}</td>
                    <td className="amount-cell">
                      {formatMoney(item.amount, state.settings.currency)}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${statusClass(item.status)}`}
                      >
                        {item.status}
                      </span>
                      <button
                        className="icon-button row-action"
                        title="ویرایش کامل عملیات"
                        onClick={() => beginTransactionEdit(item)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="icon-button row-action"
                        title="حذف عملیات"
                        onClick={() =>
                          window.confirm("عملیات حذف شود؟") &&
                          onSave(
                            {
                              ...state,
                              transactions: state.transactions.filter(
                                row => row.id !== item.id
                              ),
                            },
                            "عملیات حذف شد"
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title="دفتر عملیات خالی است"
                      description="هنوز رکوردی برای نمایش وجود ندارد."
                      onAction={onQuick}
                      actionLabel="ثبت عملیات"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {editingTransaction && (
        <Dialog
          title="ویرایش کامل عملیات مالی"
          onClose={() => setEditingTransaction(null)}
        >
          <form className="form-grid" onSubmit={saveTransactionEdit}>
            <label>
              نوع عملیات
              <select
                value={editForm.type}
                onChange={e =>
                  setEditForm({
                    ...editForm,
                    type: e.target.value as TransactionType,
                  })
                }
              >
                {(
                  [
                    "دریافت",
                    "پرداخت",
                    "فروش",
                    "خرید",
                    "هزینه",
                    "درآمد",
                    "اصلاحیه",
                  ] as TransactionType[]
                ).map(type => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              مبلغ
              <input
                inputMode="numeric"
                value={editForm.amount}
                onChange={e =>
                  setEditForm({ ...editForm, amount: e.target.value })
                }
              />
            </label>
            <label>
              تاریخ
              <input
                value={editForm.date}
                onChange={e =>
                  setEditForm({ ...editForm, date: e.target.value })
                }
              />
            </label>
            <label>
              طرف حساب
              <select
                value={editForm.partyId}
                onChange={e =>
                  setEditForm({ ...editForm, partyId: e.target.value })
                }
              >
                <option value="">بدون طرف حساب</option>
                {state.people.map(person => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="full-field">
              توضیحات
              <input
                value={editForm.note}
                onChange={e =>
                  setEditForm({ ...editForm, note: e.target.value })
                }
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setEditingTransaction(null)}
              >
                انصراف
              </button>
              <button className="button button-primary" type="submit">
                ذخیره ویرایش عملیات
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

function People({
  state,
  onSave,
}: {
  state: AppState;
  onSave: (state: AppState, message: string) => void;
}) {
  const blank = {
    name: "",
    roles: ["مشتری"] as AppState["people"][number]["roles"],
    phone: "",
    defaultPaymentRuleId: "",
  };
  const [open, setOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<
    AppState["people"][number] | null
  >(null);
  const [form, setForm] = useState(blank);
  function beginEdit(person: AppState["people"][number]) {
    setEditingPerson(person);
    setForm({
      name: person.name,
      roles: person.roles?.length ? person.roles : [person.type],
      phone: person.phone || "",
      defaultPaymentRuleId: person.defaultPaymentRuleId || "",
    });
    setOpen(true);
  }
  function toggleRole(role: AppState["people"][number]["roles"][number]) {
    setForm({
      ...form,
      roles: form.roles.includes(role)
        ? form.roles.filter(item => item !== role)
        : [...form.roles, role],
    });
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.roles.length) return;
    const person = {
      id: editingPerson?.id || createId("person"),
      code:
        editingPerson?.code || String(state.people.length + 1).padStart(3, "0"),
      name: form.name.trim(),
      type: form.roles[0],
      roles: form.roles,
      phone: form.phone,
      defaultPaymentRuleId: form.defaultPaymentRuleId || undefined,
      balance: editingPerson?.balance || 0,
    };
    const people = editingPerson
      ? state.people.map(item => (item.id === editingPerson.id ? person : item))
      : [person, ...state.people];
    onSave(
      { ...state, people },
      editingPerson
        ? "تمام اطلاعات طرف حساب ویرایش شد"
        : "طرف حساب با نقش‌های انتخاب‌شده ثبت شد"
    );
    setForm(blank);
    setEditingPerson(null);
    setOpen(false);
  }
  return (
    <div className="page-stack page-enter">
      <PageIntro
        kicker="دفتر اشخاص"
        title="طرف حساب‌ها"
        description="یک نفر می‌تواند هم‌زمان مشتری، تأمین‌کننده، شریک یا هر نقش دیگری داشته باشد."
        actionLabel="افزودن طرف حساب"
        onAction={() => {
          setEditingPerson(null);
          setForm(blank);
          setOpen(true);
        }}
      />
      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">دفتر اشخاص</span>
            <h3>{formatNumber(state.people.length)} رکورد</h3>
          </div>
          <div className="search-box compact">
            <Search size={16} />
            <input placeholder="جست‌وجو..." />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>کد</th>
                <th>نام</th>
                <th>نقش‌ها</th>
                <th>تلفن</th>
                <th>مانده</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {state.people.length ? (
                state.people.map(person => (
                  <tr key={person.id}>
                    <td className="muted-cell">{person.code}</td>
                    <td>
                      <strong>{person.name}</strong>
                    </td>
                    <td>
                      <div className="role-tags">
                        {(person.roles?.length
                          ? person.roles
                          : [person.type]
                        ).map(role => (
                          <span className="soft-tag" key={role}>
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{person.phone || "—"}</td>
                    <td
                      className={
                        person.balance > 0 ? "amount-negative" : "muted-cell"
                      }
                    >
                      {person.balance
                        ? formatMoney(person.balance, state.settings.currency)
                        : "بدون مانده"}
                    </td>
                    <td>
                      <button
                        className="icon-button row-action"
                        title="ویرایش کامل طرف حساب"
                        onClick={() => beginEdit(person)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="icon-button row-action"
                        title="حذف طرف حساب"
                        onClick={() =>
                          window.confirm("طرف حساب حذف شود؟") &&
                          onSave(
                            {
                              ...state,
                              people: state.people.filter(
                                item => item.id !== person.id
                              ),
                            },
                            "طرف حساب حذف شد"
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="هنوز طرف حسابی ندارید"
                      description="با ساختن اولین مخاطب، ثبت عملیات مالی سریع‌تر می‌شود."
                      onAction={() => setOpen(true)}
                      actionLabel="افزودن طرف حساب"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <Dialog
          title={editingPerson ? "ویرایش کامل طرف حساب" : "طرف حساب جدید"}
          onClose={() => {
            setOpen(false);
            setEditingPerson(null);
          }}
        >
          <form onSubmit={submit} className="form-grid">
            <label className="full-field">
              نام و نام خانوادگی
              <input
                autoFocus
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <fieldset className="role-fieldset">
              <legend>
                نقش‌های طرف حساب <small>(امکان انتخاب چند مورد)</small>
              </legend>
              <div className="checkbox-grid">
                {PERSON_TYPES.map(role => (
                  <label className="checkbox-option" key={role}>
                    <input
                      type="checkbox"
                      checked={form.roles.includes(role)}
                      onChange={() => toggleRole(role)}
                    />
                    <span>{role}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              شماره تماس
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label>
              شرایط پرداخت پیش‌فرض
              <select
                value={form.defaultPaymentRuleId}
                onChange={e =>
                  setForm({ ...form, defaultPaymentRuleId: e.target.value })
                }
              >
                <option value="">بدون پیش‌فرض</option>
                {state.paymentRules.map(rule => (
                  <option value={rule.id} key={rule.id}>
                    {rule.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setOpen(false)}
              >
                انصراف
              </button>
              <button className="button button-primary" type="submit">
                {editingPerson ? "ذخیره ویرایش" : "ذخیره طرف حساب"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
function Inventory({
  state,
  onSave,
}: {
  state: AppState;
  onSave: (state: AppState, message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseNote, setWarehouseNote] = useState("");
  const [editingWarehouse, setEditingWarehouse] = useState<
    AppState["warehouses"][number] | null
  >(null);
  const [editingProduct, setEditingProduct] = useState<
    AppState["products"][number] | null
  >(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [adjustForm, setAdjustForm] = useState({
    productId: "",
    amount: "",
    note: "",
  });
  const [form, setForm] = useState({
    code: "",
    name: "",
    unit: "عدد",
    unit2: "کارتن",
    conversionRate: "1",
    warehouseId: state.warehouses[0]?.id || "",
    stock: "0",
    minStock: "0",
    price: "0",
  });
  function adjustStock(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(adjustForm.amount.replace(/[^0-9.-]/g, "")) || 0;
    if (!adjustForm.productId || !amount) return;
    const product = state.products.find(
      item => item.id === adjustForm.productId
    );
    if (!product) return;
    onSave(
      {
        ...state,
        products: state.products.map(item =>
          item.id === product.id
            ? { ...item, stock: item.stock + amount }
            : item
        ),
        audit: [
          ...state.audit,
          {
            id: createId("stock-adjust"),
            at: new Date().toISOString(),
            action: "STOCK_ADJUSTMENT",
            note: `${product.name}: ${amount > 0 ? "افزایش" : "کاهش"} ${Math.abs(amount)}؛ ${adjustForm.note || "بدون توضیح"}`,
          },
        ],
      },
      "اصلاح دستی موجودی ثبت شد"
    );
    setAdjustOpen(false);
    setAdjustForm({ productId: "", amount: "", note: "" });
  }
  const selectedProduct = state.products.find(
    product => product.id === selectedProductId
  );
  const movements = selectedProduct
    ? state.invoices
        .filter(invoice => invoice.status !== "باطل")
        .flatMap(invoice =>
          invoice.items
            .filter(item => item.productId === selectedProduct.id)
            .map(item => ({
              invoice,
              item,
              direction: invoice.type === "خرید" ? "ورود" : "خروج",
            }))
        )
    : [];
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const conversionRate = Number(form.conversionRate) || 1;
    const enteredStock = Number(form.stock.replace(/[^0-9.-]/g, "")) || 0;
    const product = {
      id: editingProduct?.id || createId("product"),
      code:
        form.code.trim() || String(state.products.length + 1).padStart(3, "0"),
      name: form.name.trim(),
      unit: form.unit,
      unit2: form.unit2,
      conversionRate,
      warehouseId: form.warehouseId || undefined,
      stock: editingProduct ? enteredStock : enteredStock * conversionRate,
      minStock: Number(form.minStock.replace(/[^0-9.-]/g, "")) || 0,
      price: Number(form.price.replace(/[^0-9.-]/g, "")) || 0,
    };
    const products = editingProduct
      ? state.products.map(row =>
          row.id === editingProduct.id ? product : row
        )
      : [product, ...state.products];
    onSave(
      { ...state, products },
      editingProduct
        ? "تمام اطلاعات کالا ویرایش شد"
        : "کالای جدید با محل نگهداری ثبت شد"
    );
    setOpen(false);
    setEditingProduct(null);
  }
  return (
    <div className="page-stack page-enter">
      <PageIntro
        kicker="کنترل موجودی"
        title="انبار و کالا"
        description="کالا را با واحد اول، واحد دوم، نسبت تبدیل و محل نگهداری ثبت کنید."
        actionLabel="افزودن کالا"
        onAction={() => setOpen(true)}
      />
      <div className="toolbar">
        <button
          className="button button-ghost button-small"
          onClick={() => setWarehouseOpen(true)}
        >
          افزودن انبار
        </button>
        <button
          className="button button-ghost button-small"
          onClick={() => setAdjustOpen(true)}
        >
          اصلاح موجودی
        </button>
        <span className="soft-tag">
          {formatNumber(state.warehouses.length)} انبار فعال
        </span>
      </div>
      <div className="warehouse-strip">
        {state.warehouses.map(warehouse => (
          <span className="warehouse-chip" key={warehouse.id}>
            <Boxes size={14} />
            {warehouse.name}
            <button
              className="icon-button"
              title="ویرایش انبار"
              onClick={() => {
                setEditingWarehouse(warehouse);
                setWarehouseName(warehouse.name);
                setWarehouseNote(warehouse.note || "");
                setWarehouseOpen(true);
              }}
            >
              <Pencil size={12} />
            </button>
            <button
              className="icon-button"
              title="حذف انبار"
              onClick={() =>
                window.confirm("انبار حذف شود؟") &&
                onSave(
                  {
                    ...state,
                    warehouses: state.warehouses.filter(
                      item => item.id !== warehouse.id
                    ),
                  },
                  "انبار حذف شد"
                )
              }
            >
              <Trash2 size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="inventory-summary">
        <div>
          <Boxes size={19} />
          <span>تعداد کالا</span>
          <strong>{formatNumber(state.products.length)}</strong>
        </div>
        <div>
          <WalletCards size={19} />
          <span>ارزش تقریبی موجودی</span>
          <strong>
            {formatMoney(
              state.products.reduce(
                (sum, item) => sum + item.stock * item.price,
                0
              ),
              state.settings.currency
            )}
          </strong>
        </div>
        <div>
          <RefreshCw size={19} />
          <span>نیازمند بررسی</span>
          <strong>
            {formatNumber(
              state.products.filter(item => item.stock <= item.minStock).length
            )}
          </strong>
        </div>
      </div>
      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">دفتر کالا</span>
            <h3>وضعیت فعلی انبار</h3>
          </div>
          <span className="soft-tag">واحد اول / واحد دوم</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>کد کالا</th>
                <th>نام کالا</th>
                <th>واحدها</th>
                <th>انبار</th>
                <th>موجودی</th>
                <th>قیمت پایه</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {state.products.length ? (
                state.products.map(product => (
                  <tr key={product.id}>
                    <td className="muted-cell">{product.code}</td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setSelectedProductId(product.id)}
                      >
                        <strong>{product.name}</strong>
                      </button>
                    </td>
                    <td>
                      <span className="soft-tag">
                        {product.unit} / {product.unit2 || product.unit} ×{" "}
                        {formatNumber(product.conversionRate || 1)}
                      </span>
                    </td>
                    <td>
                      {state.warehouses.find(
                        warehouse => warehouse.id === product.warehouseId
                      )?.name || "بدون انبار"}
                    </td>
                    <td className="amount-cell">
                      {formatNumber(product.stock)}
                    </td>
                    <td>
                      {formatMoney(product.price, state.settings.currency)}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${product.stock <= product.minStock ? "status-warning" : "status-success"}`}
                      >
                        {product.stock <= product.minStock
                          ? "نیاز به تأمین"
                          : "مناسب"}
                      </span>
                      <button
                        className="icon-button row-action"
                        title="ویرایش کالا"
                        onClick={() => {
                          setEditingProduct(product);
                          setForm({
                            code: product.code,
                            name: product.name,
                            unit: product.unit,
                            unit2: product.unit2 || product.unit,
                            conversionRate: String(product.conversionRate || 1),
                            warehouseId: product.warehouseId || "",
                            stock: String(product.stock),
                            minStock: String(product.minStock),
                            price: String(product.price),
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="icon-button row-action"
                        title="حذف کالا"
                        onClick={() =>
                          window.confirm("کالا حذف شود؟") &&
                          onSave(
                            {
                              ...state,
                              products: state.products.filter(
                                item => item.id !== product.id
                              ),
                            },
                            "کالا حذف شد"
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="کالایی ثبت نشده"
                      description="پس از ثبت کالا، موجودی و محل نگهداری نمایش داده می‌شود."
                      onAction={() => setOpen(true)}
                      actionLabel="افزودن کالا"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selectedProduct && (
        <div className="panel table-panel cardex-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">کاردکس کالا</span>
              <h3>{selectedProduct.name}</h3>
            </div>
            <span className="soft-tag">گردش ثبت‌شده از فاکتورها</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>تاریخ</th>
                  <th>شماره فاکتور</th>
                  <th>نوع گردش</th>
                  <th>تعداد</th>
                  <th>قیمت واحد</th>
                  <th>جمع</th>
                </tr>
              </thead>
              <tbody>
                {movements.length ? (
                  movements.map(({ invoice, item, direction }) => (
                    <tr key={`${invoice.id}-${item.id}`}>
                      <td>{formatDate(invoice.date)}</td>
                      <td>{invoice.number}</td>
                      <td>
                        <span
                          className={`status-pill ${direction === "ورود" ? "status-success" : "status-warning"}`}
                        >
                          {direction}
                        </span>
                      </td>
                      <td>
                        {formatNumber(item.quantity)} {item.unit}
                      </td>
                      <td>
                        {formatMoney(item.unitPrice, state.settings.currency)}
                      </td>
                      <td>
                        {formatMoney(item.total, state.settings.currency)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      برای این کالا گردش فاکتوری ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {warehouseOpen && (
        <Dialog
          title={editingWarehouse ? "ویرایش کامل انبار" : "افزودن انبار جدید"}
          onClose={() => setWarehouseOpen(false)}
        >
          <form
            onSubmit={event => {
              event.preventDefault();
              if (!warehouseName.trim()) return;
              onSave(
                {
                  ...state,
                  warehouses: editingWarehouse
                    ? state.warehouses.map(row =>
                        row.id === editingWarehouse.id
                          ? {
                              ...row,
                              name: warehouseName.trim(),
                              note: warehouseNote,
                            }
                          : row
                      )
                    : [
                        {
                          id: createId("warehouse"),
                          name: warehouseName.trim(),
                          note: warehouseNote,
                        },
                        ...state.warehouses,
                      ],
                },
                editingWarehouse
                  ? "تمام اطلاعات انبار ویرایش شد"
                  : "انبار جدید ثبت شد"
              );
              setWarehouseName("");
              setWarehouseNote("");
              setEditingWarehouse(null);
              setWarehouseOpen(false);
            }}
            className="form-grid"
          >
            <label className="full-field">
              نام انبار
              <input
                autoFocus
                value={warehouseName}
                onChange={e => setWarehouseName(e.target.value)}
                placeholder="مثلاً انبار محصولات تولید"
              />
            </label>
            <label className="full-field">
              توضیحات انبار
              <textarea
                value={warehouseNote}
                onChange={e => setWarehouseNote(e.target.value)}
                placeholder="مثلاً محل نگهداری محصولات تولید"
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setWarehouseOpen(false)}
              >
                انصراف
              </button>
              <button className="button button-primary" type="submit">
                ذخیره انبار
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {adjustOpen && (
        <Dialog title="اصلاح دستی موجودی" onClose={() => setAdjustOpen(false)}>
          <form onSubmit={adjustStock} className="form-grid">
            <label className="full-field">
              کالا
              <select
                value={adjustForm.productId}
                onChange={e =>
                  setAdjustForm({ ...adjustForm, productId: e.target.value })
                }
              >
                <option value="">انتخاب کالا</option>
                {state.products.map(product => (
                  <option value={product.id} key={product.id}>
                    {product.name} · موجودی {formatNumber(product.stock)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              تغییر موجودی
              <input
                inputMode="numeric"
                value={adjustForm.amount}
                onChange={e =>
                  setAdjustForm({ ...adjustForm, amount: e.target.value })
                }
                placeholder="مثبت=افزایش، منفی=کاهش"
              />
            </label>
            <label>
              علت اصلاح
              <input
                value={adjustForm.note}
                onChange={e =>
                  setAdjustForm({ ...adjustForm, note: e.target.value })
                }
                placeholder="مثلاً شمارش پایان ماه"
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setAdjustOpen(false)}
              >
                انصراف
              </button>
              <button className="button button-primary" type="submit">
                <Check size={17} />
                ثبت اصلاح موجودی
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {open && (
        <Dialog
          title={
            editingProduct
              ? `ویرایش کامل کالا: ${editingProduct.name}`
              : "افزودن کالا به انبار"
          }
          onClose={() => {
            setOpen(false);
            setEditingProduct(null);
          }}
        >
          <form onSubmit={submit} className="form-grid">
            <label>
              کد کالا
              <input
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
              />
            </label>
            <label>
              نام کالا
              <input
                autoFocus
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              واحد اول
              <select
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
              >
                {UNIT_OPTIONS.map(unit => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
            </label>
            <label>
              واحد دوم
              <select
                value={form.unit2}
                onChange={e => setForm({ ...form, unit2: e.target.value })}
              >
                {UNIT_OPTIONS.map(unit => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
            </label>
            <label>
              نسبت تبدیل
              <input
                inputMode="numeric"
                value={form.conversionRate}
                onChange={e =>
                  setForm({ ...form, conversionRate: e.target.value })
                }
                placeholder="مثلاً ۳۶"
              />
            </label>
            <label>
              محل نگهداری
              <select
                value={form.warehouseId}
                onChange={e =>
                  setForm({ ...form, warehouseId: e.target.value })
                }
              >
                {state.warehouses.map(warehouse => (
                  <option value={warehouse.id} key={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              موجودی اولیه
              <input
                value={form.stock}
                onChange={e => setForm({ ...form, stock: e.target.value })}
              />
            </label>
            <label>
              حداقل موجودی
              <input
                value={form.minStock}
                onChange={e => setForm({ ...form, minStock: e.target.value })}
              />
            </label>
            <label>
              قیمت پایه
              <input
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setOpen(false)}
              >
                انصراف
              </button>
              <button className="button button-primary" type="submit">
                <Check size={17} />
                ذخیره کالا
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
function Prices({
  state,
  onSave,
}: {
  state: AppState;
  onSave: (state: AppState, message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<
    AppState["priceHistory"][number] | null
  >(null);
  const [form, setForm] = useState({
    productName: "",
    effectiveDate: todayJalali(),
    unit: "عدد",
    price: "",
    note: "",
    scope: "عمومی" as "عمومی" | "اختصاصی",
    partyIds: [] as string[],
  });
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const price = Number(form.price.replace(/[^0-9.]/g, ""));
    if (!form.productName.trim() || !price) return;
    onSave(
      {
        ...state,
        priceHistory: editingPrice
          ? state.priceHistory.map(item =>
              item.id === editingPrice.id
                ? {
                    ...item,
                    productName: form.productName.trim(),
                    scope: form.scope,
                    partyIds:
                      form.scope === "اختصاصی" ? form.partyIds : undefined,
                    effectiveDate: form.effectiveDate,
                    unit: form.unit,
                    price,
                    note: form.note,
                  }
                : item
            )
          : [
              {
                id: createId("price"),
                productName: form.productName.trim(),
                scope: form.scope,
                partyIds: form.scope === "اختصاصی" ? form.partyIds : undefined,
                effectiveDate: form.effectiveDate,
                unit: form.unit,
                price,
                note: form.note,
              },
              ...state.priceHistory,
            ],
      },
      editingPrice
        ? "تمام اطلاعات قیمت ویرایش شد"
        : "قیمت جدید با دامنه هدف ثبت شد"
    );
    setOpen(false);
    setEditingPrice(null);
  }
  const sorted = [...state.priceHistory].sort((a, b) =>
    b.effectiveDate.localeCompare(a.effectiveDate)
  );
  return (
    <div className="page-stack page-enter">
      <PageIntro
        kicker="کنترل قیمت"
        title="تاریخچه قیمت"
        description="قیمت می‌تواند عمومی یا برای طرف حساب‌های انتخاب‌شده باشد و در فاکتور قابل override است."
        actionLabel="ثبت قیمت جدید"
        onAction={() => setOpen(true)}
      />
      <div className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>کالا</th>
                <th>تاریخ اعتبار</th>
                <th>دامنه</th>
                <th>واحد</th>
                <th>قیمت</th>
                <th>توضیحات</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length ? (
                sorted.map(row => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.productName}</strong>
                    </td>
                    <td>{formatDate(row.effectiveDate)}</td>
                    <td>
                      <span className="soft-tag">
                        {row.scope}
                        {row.scope === "اختصاصی"
                          ? ` · ${formatNumber(row.partyIds?.length || 0)} طرف حساب`
                          : ""}
                      </span>
                    </td>
                    <td>{row.unit}</td>
                    <td className="amount-cell">
                      {formatMoney(row.price, state.settings.currency)}
                    </td>
                    <td>
                      {row.note || "—"}{" "}
                      <button
                        className="icon-button row-action"
                        title="ویرایش قیمت"
                        onClick={() => {
                          setEditingPrice(row);
                          setForm({
                            productName: row.productName,
                            effectiveDate: row.effectiveDate,
                            unit: row.unit,
                            price: String(row.price),
                            note: row.note || "",
                            scope: row.scope,
                            partyIds: row.partyIds || [],
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="icon-button row-action"
                        title="حذف قیمت"
                        onClick={() =>
                          window.confirm("رکورد قیمت حذف شود؟") &&
                          onSave(
                            {
                              ...state,
                              priceHistory: state.priceHistory.filter(
                                item => item.id !== row.id
                              ),
                            },
                            "رکورد قیمت حذف شد"
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="تاریخچه قیمتی وجود ندارد"
                      description="برای شروع، قیمت معتبر یک کالا را ثبت کنید."
                      onAction={() => setOpen(true)}
                      actionLabel="ثبت قیمت"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <Dialog
          title={editingPrice ? "ویرایش کامل قیمت" : "ثبت قیمت جدید"}
          onClose={() => {
            setOpen(false);
            setEditingPrice(null);
          }}
        >
          <form onSubmit={submit} className="form-grid">
            <label>
              کالا
              <select
                autoFocus
                value={form.productName}
                onChange={e => {
                  const product = state.products.find(
                    item => item.id === e.target.value
                  );
                  setForm({
                    ...form,
                    productName: e.target.value,
                    unit: product?.unit || form.unit,
                  });
                }}
              >
                <option value="">انتخاب کالا</option>
                {state.products.map(product => (
                  <option key={product.id} value={product.name}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              تاریخ اعتبار
              <input
                value={form.effectiveDate}
                onChange={e =>
                  setForm({ ...form, effectiveDate: e.target.value })
                }
              />
            </label>
            <label>
              واحد
              <select
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
              >
                {UNIT_OPTIONS.map(unit => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
            </label>
            <label>
              قیمت پایه
              <input
                inputMode="numeric"
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
              />
            </label>
            <label>
              دامنه قیمت
              <select
                value={form.scope}
                onChange={e =>
                  setForm({
                    ...form,
                    scope: e.target.value as "عمومی" | "اختصاصی",
                  })
                }
              >
                <option>عمومی</option>
                <option>اختصاصی</option>
              </select>
            </label>
            {form.scope === "اختصاصی" && (
              <label className="full-field">
                طرف حساب‌های مجاز
                <select
                  multiple
                  value={form.partyIds}
                  onChange={e =>
                    setForm({
                      ...form,
                      partyIds: Array.from(
                        e.target.selectedOptions,
                        option => option.value
                      ),
                    })
                  }
                >
                  {state.people.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="full-field">
              توضیحات
              <input
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setOpen(false)}
              >
                انصراف
              </button>
              <button className="button button-primary" type="submit">
                <Check size={17} />
                {editingPrice ? "ذخیره ویرایش قیمت" : "ذخیره قیمت"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
function PaymentRules({
  state,
  onSave,
}: {
  state: AppState;
  onSave: (state: AppState, message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<
    AppState["paymentRules"][number] | null
  >(null);
  const [form, setForm] = useState({
    name: "",
    dayBasis: "30",
    graceDays: "0",
    tiers: [{ maxDays: "30", rate: "0", note: "بدون سود" }],
  });
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const tiers = form.tiers
      .filter(tier => Number(tier.maxDays) >= 0)
      .map((tier, index) => ({
        id: createId(`tier${index}`),
        maxDays: Number(tier.maxDays),
        rate: Number(tier.rate) / 100,
        note: tier.note,
      }));
    const rule = {
      id: editingRule?.id || createId("rule"),
      name: form.name.trim(),
      active: true,
      dayBasis: Number(form.dayBasis) || 30,
      graceDays: Number(form.graceDays) || 0,
      tiers,
    };
    onSave(
      {
        ...state,
        paymentRules: editingRule
          ? state.paymentRules.map(item =>
              item.id === editingRule.id ? rule : item
            )
          : [rule, ...state.paymentRules],
      },
      editingRule
        ? "تمام اطلاعات شرایط پرداخت ویرایش شد"
        : "شرایط پرداخت و پله‌های سود ثبت شد"
    );
    setOpen(false);
    setEditingRule(null);
    setForm({
      name: "",
      dayBasis: "30",
      graceDays: "0",
      tiers: [{ maxDays: "30", rate: "0", note: "بدون سود" }],
    });
  }
  function addTier() {
    setForm({
      ...form,
      tiers: [...form.tiers, { maxDays: "90", rate: "10", note: "" }],
    });
  }
  return (
    <div className="page-stack page-enter">
      <PageIntro
        kicker="سیاست تسویه"
        title="شرایط پرداخت و پله‌های سود"
        description="قواعد تسویه را یک‌بار تعریف کنید تا محاسبهٔ سود روزشمار شفاف و قابل تغییر بماند."
        actionLabel="ساخت شرایط پرداخت"
        onAction={() => setOpen(true)}
      />
      <div className="rule-explainer">
        <div className="mini-icon violet">
          <Percent size={18} />
        </div>
        <div>
          <strong>محاسبه بر اساس اصل بدهی و روزهای واقعی</strong>
          <p>
            هر قاعده می‌تواند مبنای روزشمار و دورهٔ تنفس خودش را داشته باشد.
            پله‌ها از کمترین روز تا بیشترین روز مرتب می‌شوند.
          </p>
        </div>
      </div>
      <div className="rules-grid">
        {state.paymentRules.map(rule => (
          <div className="panel rule-card" key={rule.id}>
            <div className="rule-head">
              <div>
                <span className="section-kicker">شرایط تسویه</span>
                <h3>{rule.name}</h3>
              </div>
              <span
                className={`status-pill ${rule.active ? "status-success" : "status-danger"}`}
              >
                {rule.active ? "فعال" : "غیرفعال"}
              </span>
              {rule.id !== "cash-default" && (
                <button
                  className="icon-button row-action"
                  title="ویرایش نام شرایط"
                  onClick={() => {
                    setEditingRule(rule);
                    setForm({
                      name: rule.name,
                      dayBasis: String(rule.dayBasis),
                      graceDays: String(rule.graceDays),
                      tiers: rule.tiers.map(tier => ({
                        maxDays: String(tier.maxDays),
                        rate: String(tier.rate * 100),
                        note: tier.note || "",
                      })),
                    });
                    setOpen(true);
                  }}
                >
                  <Pencil size={14} />
                </button>
              )}
              {rule.id !== "cash-default" && (
                <button
                  className="icon-button row-action"
                  title="حذف شرایط"
                  onClick={() =>
                    window.confirm("شرایط پرداخت حذف شود؟") &&
                    onSave(
                      {
                        ...state,
                        paymentRules: state.paymentRules.filter(
                          item => item.id !== rule.id
                        ),
                      },
                      "شرایط پرداخت حذف شد"
                    )
                  }
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="rule-meta">
              <span>
                مبنای روزشمار <strong>{formatNumber(rule.dayBasis)} روز</strong>
              </span>
              <span>
                تنفس <strong>{formatNumber(rule.graceDays)} روز</strong>
              </span>
            </div>
            <div className="tier-list">
              {[...rule.tiers]
                .sort((a, b) => a.maxDays - b.maxDays)
                .map(tier => (
                  <div className="tier-row" key={tier.id}>
                    <span className="tier-badge">
                      {tier.maxDays === 9999 ? "∞" : formatNumber(tier.maxDays)}{" "}
                      روز
                    </span>
                    <strong>{formatNumber(tier.rate * 100)}٪</strong>
                    <small>{tier.note || "پلهٔ سود"}</small>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      {open && (
        <Dialog
          title={editingRule ? "ویرایش کامل شرایط پرداخت" : "ساخت شرایط پرداخت"}
          onClose={() => {
            setOpen(false);
            setEditingRule(null);
          }}
        >
          <form onSubmit={submit} className="form-grid">
            <label className="full-field">
              نام شرایط
              <input
                autoFocus
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="مثلاً فروش اعتباری مشتریان"
              />
            </label>
            <label>
              مبنای روزشمار
              <input
                inputMode="numeric"
                value={form.dayBasis}
                onChange={e => setForm({ ...form, dayBasis: e.target.value })}
              />
            </label>
            <label>
              روزهای تنفس
              <input
                inputMode="numeric"
                value={form.graceDays}
                onChange={e => setForm({ ...form, graceDays: e.target.value })}
              />
            </label>
            <div className="tier-editor">
              <div className="tier-editor-head">
                <span>پله‌های سود</span>
                <button type="button" className="text-button" onClick={addTier}>
                  <Plus size={14} />
                  افزودن پله
                </button>
              </div>
              {form.tiers.map((tier, index) => (
                <div className="tier-edit-row" key={index}>
                  <input
                    aria-label="حداکثر روز"
                    inputMode="numeric"
                    value={tier.maxDays}
                    onChange={e =>
                      setForm({
                        ...form,
                        tiers: form.tiers.map((item, i) =>
                          i === index
                            ? { ...item, maxDays: e.target.value }
                            : item
                        ),
                      })
                    }
                    placeholder="تا چند روز"
                  />
                  <input
                    aria-label="درصد سود"
                    inputMode="decimal"
                    value={tier.rate}
                    onChange={e =>
                      setForm({
                        ...form,
                        tiers: form.tiers.map((item, i) =>
                          i === index ? { ...item, rate: e.target.value } : item
                        ),
                      })
                    }
                    placeholder="درصد"
                  />
                  <input
                    aria-label="یادداشت پله"
                    value={tier.note}
                    onChange={e =>
                      setForm({
                        ...form,
                        tiers: form.tiers.map((item, i) =>
                          i === index ? { ...item, note: e.target.value } : item
                        ),
                      })
                    }
                    placeholder="توضیح پله"
                  />
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setOpen(false)}
              >
                انصراف
              </button>
              <button className="button button-primary" type="submit">
                <Check size={17} />
                {editingRule ? "ذخیره ویرایش شرایط" : "ذخیره شرایط"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

function Checks({
  state,
  onSave,
}: {
  state: AppState;
  onSave: (state: AppState, message: string) => void;
}) {
  const statuses: CheckStatus[] = [
    "نزد ما",
    "وصول شده",
    "برگشتی",
    "عودت داده شده",
    "جایگزین شده",
    "باطل",
    "خرج شده",
  ];
  const [open, setOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<
    AppState["checks"][number] | null
  >(null);
  const [replacementParent, setReplacementParent] = useState<
    AppState["checks"][number] | null
  >(null);
  const [replacementLines, setReplacementLines] = useState("");
  const [statusFilter, setStatusFilter] = useState<CheckStatus | "همه">("همه");
  const [bankFilter, setBankFilter] = useState("همه");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [receivedTo, setReceivedTo] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [historyCheckId, setHistoryCheckId] = useState<string | null>(null);
  const blank = {
    number: "",
    partyId: "",
    bank: "",
    bankAccountId: "",
    returnPartyId: "",
    status: "نزد ما" as CheckStatus,
    replacementOf: "",
    receivedDate: todayJalali(),
    dueDate: todayJalali(),
    amount: "",
    paymentRuleId: "",
    note: "",
  };
  const [form, setForm] = useState(blank);
  const visibleChecks = state.checks.filter(
    check =>
      (statusFilter === "همه" || check.status === statusFilter) &&
      (bankFilter === "همه" || check.bankAccountId === bankFilter) &&
      (!receivedFrom || check.receivedDate >= receivedFrom) &&
      (!receivedTo || check.receivedDate <= receivedTo) &&
      (!dueFrom || check.dueDate >= dueFrom) &&
      (!dueTo || check.dueDate <= dueTo)
  );
  function exportChecks() {
    const rows = [
      [
        "شماره چک",
        "طرف حساب",
        "تاریخ دریافت",
        "سررسید",
        "مبلغ",
        "وضعیت",
        "بانک/شخص",
        "توضیحات",
      ],
      ...visibleChecks.map(check => [
        check.number,
        personName(state, check.partyId),
        check.receivedDate,
        check.dueDate,
        check.amount,
        check.status,
        state.accounts.find(account => account.id === check.bankAccountId)
          ?.name || personName(state, check.returnPartyId),
        check.note || "",
      ]),
    ];
    const csv = rows.map(row => row.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "check-register.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  function beginEdit(check: AppState["checks"][number]) {
    setEditingCheck(check);
    setForm({
      number: check.number,
      partyId: check.partyId || "",
      bank: check.bank || "",
      bankAccountId: check.bankAccountId || "",
      returnPartyId: check.returnPartyId || "",
      status: check.status,
      replacementOf: check.replacementOf || "",
      receivedDate: check.receivedDate,
      dueDate: check.dueDate,
      amount: String(check.amount),
      paymentRuleId: check.paymentRuleId || "",
      note: check.note || "",
    });
    setReplacementLines("");
    setOpen(true);
  }
  function saveCheckStatus(
    check: AppState["checks"][number],
    status: CheckStatus,
    targetId: string
  ) {
    const accountId = ["نزد ما", "وصول شده", "برگشتی"].includes(status)
      ? targetId
      : check.bankAccountId;
    const returnPartyId = ["عودت داده شده", "خرج شده"].includes(status)
      ? targetId
      : check.returnPartyId;
    let accounts = state.accounts.map(account =>
      account.id === check.bankAccountId && check.status === "وصول شده"
        ? { ...account, balance: account.balance - check.amount }
        : account
    );
    if (status === "وصول شده" && accountId)
      accounts = accounts.map(account =>
        account.id === accountId
          ? { ...account, balance: account.balance + check.amount }
          : account
      );
    let checks = state.checks.map(item =>
      item.id === check.id
        ? {
            ...item,
            status,
            bankAccountId: accountId || undefined,
            bank:
              state.accounts.find(item => item.id === accountId)?.name ||
              item.bank,
            returnPartyId: returnPartyId || undefined,
          }
        : item
    );
    checks = checks.map(item => {
      if (item.status !== "جایگزین شده") return item;
      const ids = item.replacementIds?.length
        ? item.replacementIds
        : checks
            .filter(child => child.replacementOf === item.id)
            .map(child => child.id);
      const children = checks.filter(child => ids.includes(child.id));
      return ids.length > 0 &&
        children.length === ids.length &&
        children.every(child => child.status === "وصول شده")
        ? { ...item, status: "وصول شده" as CheckStatus }
        : item;
    });
    onSave(
      {
        ...state,
        checks,
        accounts,
        audit: [
          ...state.audit,
          {
            id: createId("check-status"),
            at: new Date().toISOString(),
            action: "CHECK_STATUS_CHANGED",
            note: `چک ${check.number}: ${check.status} ← ${status}`,
          },
        ],
      },
      "وضعیت چک و مرجع آن به‌روزرسانی شد"
    );
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount.replace(/[^0-9.-]/g, "")) || 0;
    if (!form.number.trim() || !amount) return;
    if (replacementParent && !editingCheck) {
      const replacement = {
        id: createId("check-replacement"),
        number: form.number.trim(),
        partyId: form.partyId || undefined,
        bank: form.bank,
        bankAccountId: form.bankAccountId || undefined,
        returnPartyId: form.returnPartyId || undefined,
        replacementOf: replacementParent.id,
        status: form.status,
        receivedDate: form.receivedDate,
        dueDate: form.dueDate,
        amount,
        paymentRuleId: form.paymentRuleId || undefined,
        replacementIds: [],
        note: form.note || "",
      };
      const checks = state.checks.map(item =>
        item.id === replacementParent.id
          ? {
              ...item,
              status: "جایگزین شده" as CheckStatus,
              replacementIds: [...(item.replacementIds || []), replacement.id],
            }
          : item
      );
      onSave(
        {
          ...state,
          checks: [replacement, ...checks],
          audit: [
            ...state.audit,
            {
              id: createId("check-replacement"),
              at: new Date().toISOString(),
              action: "CHECK_REPLACEMENT_CREATED",
              note: `چک ${replacement.number} جایگزین چک ${replacementParent.number} ثبت شد`,
            },
          ],
        },
        "چک جایگزین جدید ثبت شد"
      );
      setOpen(false);
      setEditingCheck(null);
      setReplacementParent(null);
      setForm(blank);
      return;
    }
    const id = editingCheck?.id || createId("check");
    const next = {
      id,
      number: form.number.trim(),
      partyId: form.partyId || undefined,
      bank: form.bank,
      bankAccountId: form.bankAccountId || undefined,
      returnPartyId: form.returnPartyId || undefined,
      replacementOf: form.replacementOf || undefined,
      status: form.status,
      receivedDate: form.receivedDate,
      dueDate: form.dueDate,
      amount,
      paymentRuleId: form.paymentRuleId || undefined,
      replacementIds: editingCheck?.replacementIds || [],
      note: editingCheck?.note || "",
    };
    let accounts = state.accounts.map(account =>
      account.id === editingCheck?.bankAccountId &&
      editingCheck?.status === "وصول شده"
        ? { ...account, balance: account.balance - (editingCheck?.amount || 0) }
        : account
    );
    if (next.status === "وصول شده" && next.bankAccountId)
      accounts = accounts.map(account =>
        account.id === next.bankAccountId
          ? { ...account, balance: account.balance + amount }
          : account
      );
    let checks = editingCheck
      ? state.checks.map(item => (item.id === id ? next : item))
      : [next, ...state.checks];
    if (form.status === "جایگزین شده" && replacementLines.trim()) {
      const replacements = replacementLines
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const [number, rawAmount] = line.split(":");
          return {
            id: createId("replacement"),
            number: number.trim(),
            partyId: next.partyId,
            bank: next.bank,
            bankAccountId: next.bankAccountId,
            status: "نزد ما" as CheckStatus,
            receivedDate: next.receivedDate,
            dueDate: next.dueDate,
            amount: Number((rawAmount || "0").replace(/[^0-9.-]/g, "")) || 0,
            replacementOf: next.id,
            replacementIds: [],
            note: "",
          };
        });
      checks = [
        { ...next, replacementIds: replacements.map(item => item.id) },
        ...checks.filter(item => item.id !== next.id),
        ...replacements,
      ];
    }
    const transactions = state.transactions.filter(
      item => !item.note?.includes(`__check:${id}`)
    );
    if (next.status === "وصول شده" && next.bankAccountId)
      transactions.unshift({
        id: createId("check-receipt"),
        type: "دریافت",
        date: next.receivedDate,
        partyId: next.partyId,
        amount,
        status: "ثبت شده",
        note: `وصول چک ${next.number} __check:${id}`,
      });
    onSave(
      {
        ...state,
        checks,
        accounts,
        transactions,
        audit: [
          ...state.audit,
          {
            id: createId("check-edit"),
            at: new Date().toISOString(),
            action: editingCheck ? "CHECK_EDITED" : "CHECK_CREATED",
            note: `چک ${next.number} ${editingCheck ? "ویرایش شد" : "ثبت شد"}`,
          },
        ],
      },
      editingCheck ? "تمام اطلاعات چک ویرایش شد" : "چک دریافتی ثبت شد"
    );
    setOpen(false);
    setEditingCheck(null);
    setForm(blank);
    setReplacementLines("");
  }
  function targetLabel(status: CheckStatus) {
    if (["نزد ما", "وصول شده", "برگشتی"].includes(status))
      return status === "برگشتی" ? "حساب امانت بانک" : "حساب بانکی مقصد";
    if (["عودت داده شده", "خرج شده"].includes(status))
      return status === "خرج شده"
        ? "شخص/تأمین‌کننده بابت هزینه"
        : "تحویل به شخص";
    return "مرجع";
  }
  return (
    <div className="page-stack page-enter">
      <PageIntro
        kicker="مدیریت تعهدات"
        title="چک‌ها"
        description="وضعیت، مرجع بانکی، شخص عودت‌گیرنده و چک‌های جایگزین را از همین دفتر مدیریت کنید."
        actionLabel="ثبت چک"
        onAction={() => {
          setEditingCheck(null);
          setForm({
            ...blank,
            paymentRuleId:
              state.paymentRules.find(item => item.active)?.id || "",
          });
          setOpen(true);
        }}
      />
      <div className="check-cards">
        {["نزد ما", "وصول شده", "برگشتی"].map(label => (
          <div className="check-card" key={label}>
            <span className="mini-icon amber">
              <FileClock size={17} />
            </span>
            <span>{label}</span>
            <strong>
              {formatMoney(
                state.checks
                  .filter(check => check.status === label)
                  .reduce((sum, check) => sum + check.amount, 0),
                state.settings.currency
              )}
            </strong>
            <small>
              {formatNumber(
                state.checks.filter(check => check.status === label).length
              )}{" "}
              فقره
            </small>
          </div>
        ))}
      </div>
      <div className="toolbar check-filters">
        <label>
          فیلتر وضعیت
          <select
            value={statusFilter}
            onChange={e =>
              setStatusFilter(e.target.value as CheckStatus | "همه")
            }
          >
            <option value="همه">همه وضعیت‌ها</option>
            {statuses.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          فیلتر بانک
          <select
            value={bankFilter}
            onChange={e => setBankFilter(e.target.value)}
          >
            <option value="همه">همه بانک‌ها</option>
            {state.accounts
              .filter(account => account.type === "بانک")
              .map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          دریافت از
          <input
            value={receivedFrom}
            onChange={e => setReceivedFrom(e.target.value)}
            placeholder="۱۴۰۵/۰۱/۰۱"
          />
        </label>
        <label>
          دریافت تا
          <input
            value={receivedTo}
            onChange={e => setReceivedTo(e.target.value)}
            placeholder="۱۴۰۵/۱۲/۲۹"
          />
        </label>
        <label>
          سررسید از
          <input
            value={dueFrom}
            onChange={e => setDueFrom(e.target.value)}
            placeholder="۱۴۰۵/۰۱/۰۱"
          />
        </label>
        <label>
          سررسید تا
          <input
            value={dueTo}
            onChange={e => setDueTo(e.target.value)}
            placeholder="۱۴۰۵/۱۲/۲۹"
          />
        </label>
        <span className="soft-tag">
          نمایش {formatNumber(visibleChecks.length)} از{" "}
          {formatNumber(state.checks.length)} چک
        </span>
        <button
          className="button button-ghost button-small"
          onClick={exportChecks}
        >
          خروجی CSV
        </button>
        <button
          className="button button-ghost button-small"
          onClick={() => window.print()}
        >
          چاپ گزارش
        </button>
      </div>
      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">دفتر چک</span>
            <h3>پیگیری و تغییر وضعیت چک‌ها</h3>
          </div>
          <span className="soft-tag">مرجع وابسته به وضعیت</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>شماره چک</th>
                <th>طرف حساب</th>
                <th>تاریخ دریافت</th>
                <th>سررسید</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
                <th>مرجع وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {visibleChecks.length ? (
                visibleChecks.map(check => (
                  <tr
                    key={check.id}
                    className={`check-row check-row-${check.status === "وصول شده" ? "cleared" : check.status === "خرج شده" ? "spent" : ["برگشتی", "عودت داده شده", "باطل"].includes(check.status) ? "bad" : check.status === "جایگزین شده" ? "replaced" : "open"}`}
                  >
                    <td>
                      <strong>{check.number}</strong>
                      {check.replacementOf && (
                        <small className="muted-cell">جایگزین چک اصلی</small>
                      )}
                    </td>
                    <td>{personName(state, check.partyId)}</td>
                    <td>{formatDate(check.receivedDate)}</td>
                    <td>{formatDate(check.dueDate)}</td>
                    <td>
                      {formatMoney(check.amount, state.settings.currency)}
                    </td>
                    <td>
                      <select
                        value={check.status}
                        onChange={e => {
                          const status = e.target.value as CheckStatus;
                          if (status === "جایگزین شده") {
                            beginEdit(check);
                            setForm({
                              number: check.number,
                              partyId: check.partyId || "",
                              bank: check.bank || "",
                              bankAccountId: check.bankAccountId || "",
                              returnPartyId: check.returnPartyId || "",
                              status,
                              replacementOf: check.replacementOf || "",
                              receivedDate: check.receivedDate,
                              dueDate: check.dueDate,
                              amount: String(check.amount),
                              paymentRuleId: check.paymentRuleId || "",
                              note: check.note || "",
                            });
                          } else
                            saveCheckStatus(
                              check,
                              status,
                              check.bankAccountId || check.returnPartyId || ""
                            );
                        }}
                      >
                        <option value="نزد ما">نزد ما</option>
                        <option value="وصول شده">وصول شده</option>
                        <option value="برگشتی">برگشتی</option>
                        <option value="عودت داده شده">عودت</option>
                        <option value="جایگزین شده">جایگزین</option>
                        <option value="باطل">باطل</option>
                        <option value="خرج شده">خرج شده</option>
                      </select>
                    </td>
                    <td>
                      {["نزد ما", "وصول شده", "برگشتی"].includes(
                        check.status
                      ) ? (
                        <select
                          value={check.bankAccountId || ""}
                          onChange={e =>
                            saveCheckStatus(check, check.status, e.target.value)
                          }
                        >
                          <option value="">انتخاب بانک</option>
                          {state.accounts
                            .filter(account => account.type === "بانک")
                            .map(account => (
                              <option key={account.id} value={account.id}>
                                {account.name}
                              </option>
                            ))}
                        </select>
                      ) : ["عودت داده شده", "خرج شده"].includes(
                          check.status
                        ) ? (
                        <select
                          value={check.returnPartyId || ""}
                          onChange={e =>
                            saveCheckStatus(check, check.status, e.target.value)
                          }
                        >
                          <option value="">انتخاب شخص</option>
                          {state.people.map(person => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="muted-cell">
                          {check.status === "جایگزین شده" ? (
                            <>
                              <span>
                                {check.replacementIds?.length || 0} جایگزین
                              </span>
                              <button
                                type="button"
                                className="button button-ghost button-small"
                                onClick={() => {
                                  setReplacementParent(check);
                                  setEditingCheck(null);
                                  setForm({
                                    ...blank,
                                    partyId: check.partyId || "",
                                    receivedDate: todayJalali(),
                                    dueDate: check.dueDate,
                                    paymentRuleId: check.paymentRuleId || "",
                                  });
                                  setOpen(true);
                                }}
                              >
                                افزودن چک
                              </button>
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="icon-button row-action"
                        title="تاریخچه چک"
                        onClick={() => setHistoryCheckId(check.id)}
                      >
                        <FileClock size={14} />
                      </button>
                      <button
                        className="icon-button row-action"
                        title="ویرایش کامل چک"
                        onClick={() => beginEdit(check)}
                      >
                        <Pencil size={14} />
                      </button>
                      {!check.replacementIds?.length && (
                        <button
                          className="icon-button row-action"
                          title="حذف چک"
                          onClick={() =>
                            window.confirm("چک حذف شود؟") &&
                            onSave(
                              {
                                ...state,
                                checks: state.checks.filter(
                                  item => item.id !== check.id
                                ),
                              },
                              "چک حذف شد"
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="چکی ثبت نشده"
                      description="چک دریافتی را ثبت کنید تا در بستن ماه قابل محاسبه باشد."
                      onAction={() => setOpen(true)}
                      actionLabel="ثبت چک"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <Dialog
          title={
            replacementParent
              ? "ثبت چک جایگزین جدید"
              : editingCheck
                ? "ویرایش کامل چک"
                : "ثبت چک دریافتی"
          }
          onClose={() => setOpen(false)}
        >
          <form onSubmit={submit} className="form-grid">
            <label>
              شماره چک
              <input
                autoFocus
                value={form.number}
                onChange={e => setForm({ ...form, number: e.target.value })}
              />
            </label>
            <label>
              طرف حساب
              <select
                value={form.partyId}
                onChange={e => setForm({ ...form, partyId: e.target.value })}
              >
                <option value="">بدون طرف حساب</option>
                {state.people.map(person => (
                  <option value={person.id} key={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              تاریخ دریافت چک
              <input
                value={form.receivedDate}
                onChange={e =>
                  setForm({ ...form, receivedDate: e.target.value })
                }
              />
            </label>
            <label>
              تاریخ سررسید
              <input
                value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
              />
            </label>
            <label>
              مبلغ چک
              <input
                inputMode="numeric"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
              />
            </label>
            <label>
              وضعیت چک
              <select
                value={form.status}
                onChange={e =>
                  setForm({ ...form, status: e.target.value as CheckStatus })
                }
              >
                {statuses.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {targetLabel(form.status)}
              {["نزد ما", "وصول شده", "برگشتی"].includes(form.status) ? (
                <select
                  value={form.bankAccountId}
                  onChange={e =>
                    setForm({
                      ...form,
                      bankAccountId: e.target.value,
                      bank:
                        state.accounts.find(
                          account => account.id === e.target.value
                        )?.name || "",
                    })
                  }
                >
                  <option value="">انتخاب حساب بانکی</option>
                  {state.accounts
                    .filter(account => account.type === "بانک")
                    .map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              ) : (
                <select
                  value={form.returnPartyId}
                  onChange={e =>
                    setForm({ ...form, returnPartyId: e.target.value })
                  }
                >
                  <option value="">انتخاب شخص</option>
                  {state.people.map(person => (
                    <option value={person.id} key={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label>
              شرایط پرداخت
              <select
                value={form.paymentRuleId}
                onChange={e =>
                  setForm({ ...form, paymentRuleId: e.target.value })
                }
              >
                <option value="">بدون تغییر</option>
                {state.paymentRules.map(rule => (
                  <option value={rule.id} key={rule.id}>
                    {rule.name}
                  </option>
                ))}
              </select>
            </label>
            {form.status === "خرج شده" && (
              <label className="full-field">
                توضیحات خرج شدن
                <input
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  placeholder="مثلاً بابت خرید مواد اولیه از تأمین‌کننده"
                />
              </label>
            )}
            {form.status === "جایگزین شده" && (
              <label className="full-field">
                چک‌های جایگزین (هر خط: شماره:مبلغ)
                <textarea
                  value={replacementLines}
                  onChange={e => setReplacementLines(e.target.value)}
                  placeholder="مثلاً ۹۸۷۶:۵۰۰۰۰۰۰"
                />
              </label>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setOpen(false)}
              >
                انصراف
              </button>
              <button className="button button-primary" type="submit">
                <Check size={17} />
                {editingCheck ? "ذخیره ویرایش چک" : "ثبت چک"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {historyCheckId && (
        <Dialog
          title={`تاریخچه چک ${state.checks.find(item => item.id === historyCheckId)?.number || ""}`}
          onClose={() => setHistoryCheckId(null)}
        >
          <div className="audit-history">
            {state.audit
              .filter(event => {
                const check = state.checks.find(
                  item => item.id === historyCheckId
                );
                return check
                  ? event.note.includes(`چک ${check.number}`)
                  : false;
              })
              .slice()
              .reverse()
              .map(event => (
                <div className="audit-history-row" key={event.id}>
                  <span>{new Date(event.at).toLocaleString("fa-IR")}</span>
                  <strong>{event.action}</strong>
                  <p>{event.note}</p>
                </div>
              ))}
            {!state.audit.some(event => {
              const check = state.checks.find(
                item => item.id === historyCheckId
              );
              return check ? event.note.includes(`چک ${check.number}`) : false;
            }) && <p>تاریخی برای این چک ثبت نشده است.</p>}
          </div>
        </Dialog>
      )}
    </div>
  );
}
function MonthClose({
  state,
  onSave,
}: {
  state: AppState;
  onSave: (state: AppState, message: string) => void;
}) {
  const [partyId, setPartyId] = useState("");
  const [closed, setClosed] = useState(false);
  const partyInvoices = state.invoices
    .filter(
      invoice =>
        invoice.type === "فروش" &&
        invoice.status !== "باطل" &&
        (!partyId || invoice.partyId === partyId)
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const partyChecks = state.checks
    .filter(
      check =>
        check.status !== "باطل" &&
        check.status !== "جایگزین شده" &&
        (!partyId || check.partyId === partyId)
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const settlement = new Map<
    string,
    {
      base: number;
      value: number;
      remainingBase: number;
      collected: number;
      profit: number;
    }
  >();
  const details: Array<{
    month: string;
    number: string;
    date: string;
    base: number;
    value: number;
    remainingBase: number;
    collected: number;
    profit: number;
  }> = [];
  partyInvoices.forEach(invoice => {
    let baseRemaining = invoice.amount;
    let collected = 0;
    let profit = 0;
    const rule =
      state.paymentRules.find(item => item.id === invoice.paymentRuleId) ||
      state.paymentRules.find(item => item.active);
    partyChecks.forEach(check => {
      if (baseRemaining <= 0 || check.dueDate < invoice.date) return;
      const used = Math.min(check.amount, baseRemaining);
      if (!used) return;
      const result = calculateLateProfit(
        { ...check, amount: used },
        rule,
        invoice.date,
        baseRemaining
      );
      collected += used;
      profit += result.profit;
      baseRemaining = result.remainingBase;
    });
    const todayCheck = {
      id: "today",
      number: "",
      partyId: invoice.partyId,
      dueDate: todayJalali(),
      receivedDate: invoice.date,
      amount: 0,
      status: "نزد ما" as const,
      bank: "",
    };
    const today = calculateLateProfit(
      todayCheck,
      rule,
      invoice.date,
      baseRemaining
    );
    const key = invoice.date.slice(0, 7);
    const previous = settlement.get(key) || {
      base: 0,
      value: 0,
      remainingBase: 0,
      collected: 0,
      profit: 0,
    };
    settlement.set(key, {
      base: previous.base + invoice.amount,
      value: previous.value + today.remainingBase + today.profit,
      remainingBase: previous.remainingBase + today.remainingBase,
      collected: previous.collected + collected,
      profit: previous.profit + profit + today.profit,
    });
    details.push({
      month: key,
      number: invoice.number,
      date: invoice.date,
      base: invoice.amount,
      value: today.remainingBase + today.profit,
      remainingBase: today.remainingBase,
      collected,
      profit: profit + today.profit,
    });
  });
  const months = Array.from({ length: 8 }, (_, index) => {
    const key =
      Object.keys(Object.fromEntries(settlement)).sort().reverse()[index] || "";
    return key
      ? {
          month: key,
          ...(settlement.get(key) as NonNullable<
            ReturnType<typeof settlement.get>
          >),
        }
      : null;
  }).filter(Boolean) as Array<{
    month: string;
    base: number;
    value: number;
    remainingBase: number;
    collected: number;
    profit: number;
  }>;
  const totalBase = months.reduce((sum, row) => sum + row.base, 0);
  const totalValue = months.reduce((sum, row) => sum + row.value, 0);
  const totalRemainingBase = months.reduce(
    (sum, row) => sum + row.remainingBase,
    0
  );
  const totalCollected = months.reduce((sum, row) => sum + row.collected, 0);
  function downloadDetails() {
    const header =
      "ماه,شماره فاکتور,تاریخ,مجموع فروش پایه,ارزش امروز,باقیمانده اصل امروز,مبلغ چک تخصیص‌یافته,سود دیرکرد";
    const csv = [
      header,
      ...details.map(row =>
        [
          row.month,
          row.number,
          row.date,
          row.base,
          row.value,
          row.remainingBase,
          row.collected,
          row.profit,
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `month-close-${partyId || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="page-stack page-enter">
      <PageIntro
        kicker="کنترل پایان دوره"
        title="بستن ماه"
        description="مشتری را انتخاب کنید؛ هشت ماه اخیر بدون وابستگی به یک فاکتور یا چک، با تخصیص FIFO و سود روزشمار محاسبه می‌شود."
        actionLabel={closed ? "ثبت شده" : "ثبت بستن ماه"}
        onAction={() => {
          if (closed || !partyId) return;
          onSave(
            {
              ...state,
              audit: [
                ...state.audit,
                {
                  id: createId("month-close"),
                  at: new Date().toISOString(),
                  action: "MONTH_CLOSE",
                  note: `بستن ماه مشتری ${personName(state, partyId)}؛ اصل ${totalBase}، ارزش امروز ${totalValue}`,
                },
              ],
            },
            `بستن ماه ${personName(state, partyId)} ثبت شد`
          );
          setClosed(true);
        }}
      />
      <div className="month-close-actions">
        <button className="button button-ghost" onClick={() => window.print()}>
          چاپ گزارش / ذخیره PDF
        </button>
        <button className="button button-ghost" onClick={downloadDetails}>
          خروجی جزئیات CSV
        </button>
      </div>
      <div className="close-controls panel">
        <div>
          <span className="section-kicker">طرف حساب</span>
          <strong>مشتری مورد بررسی</strong>
        </div>
        <select
          value={partyId}
          onChange={e => {
            setPartyId(e.target.value);
            setClosed(false);
          }}
        >
          <option value="">انتخاب مشتری</option>
          {state.people
            .filter(
              person =>
                person.roles?.includes("مشتری") || person.type === "مشتری"
            )
            .map(person => (
              <option key={person.id} value={person.id}>
                {person.code} · {person.name}
              </option>
            ))}
        </select>
        <span className="close-hint">
          نرخ دیرکرد از شرایط پرداخت فاکتور خوانده می‌شود؛ چک‌های بزرگ‌تر به
          فاکتورهای قدیمی‌تر شکسته می‌شوند.
        </span>
      </div>
      <section className="metric-grid">
        <MetricCard
          label="مجموع فروش پایه"
          value={formatMoney(totalBase, state.settings.currency)}
          helper="اصل فاکتورهای مشتری"
          icon={<FileText size={20} />}
          tone="indigo"
        />
        <MetricCard
          label="ارزش باقیمانده امروز"
          value={formatMoney(totalValue, state.settings.currency)}
          helper="اصل با سود روزشمار"
          icon={<Percent size={20} />}
          tone="violet"
        />
        <MetricCard
          label="باقیمانده اصل امروز"
          value={formatMoney(totalRemainingBase, state.settings.currency)}
          helper="پس از کسر چک‌ها"
          icon={<WalletCards size={20} />}
          tone="amber"
        />
        <MetricCard
          label="درصد وصول"
          value={`${formatNumber(totalBase ? ((totalBase - totalRemainingBase) / totalBase) * 100 : 0)}٪`}
          helper={`${formatMoney(totalCollected, state.settings.currency)} چک تخصیص‌یافته`}
          icon={<Check size={20} />}
          tone="mint"
        />
      </section>
      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">گزارش هشت ماه</span>
            <h3>
              {partyId
                ? personName(state, partyId)
                : "ابتدا مشتری را انتخاب کنید"}
            </h3>
          </div>
          <span
            className={`status-pill ${closed ? "status-success" : "status-warning"}`}
          >
            {closed ? "ثبت شده" : "پیش‌نویس"}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ماه</th>
                <th>مجموع فروش (پایه)</th>
                <th>ارزش امروز</th>
                <th>باقیمانده اصل امروز</th>
                <th>سود دیرکرد</th>
                <th>درصد وصول</th>
              </tr>
            </thead>
            <tbody>
              {months.length ? (
                months.map(row => (
                  <tr key={row.month}>
                    <td>
                      <strong>{row.month}</strong>
                    </td>
                    <td>{formatMoney(row.base, state.settings.currency)}</td>
                    <td>{formatMoney(row.value, state.settings.currency)}</td>
                    <td>
                      {formatMoney(row.remainingBase, state.settings.currency)}
                    </td>
                    <td>{formatMoney(row.profit, state.settings.currency)}</td>
                    <td>
                      <span className="status-pill status-success">
                        {formatNumber(
                          row.base
                            ? ((row.base - row.remainingBase) / row.base) * 100
                            : 0
                        )}
                        ٪
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="داده‌ای برای این مشتری وجود ندارد"
                      description="فاکتور و چک مشتری را ثبت کنید تا گزارش هشت‌ماهه ساخته شود."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel table-panel month-invoice-details">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">جزئیات محاسبات</span>
            <h3>محاسبه هر فاکتور</h3>
          </div>
          <span className="soft-tag">FIFO و سود روزشمار</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ماه</th>
                <th>شماره فاکتور</th>
                <th>تاریخ</th>
                <th>پایه</th>
                <th>ارزش امروز</th>
                <th>اصل باقیمانده</th>
                <th>چک تخصیص‌یافته</th>
                <th>سود دیرکرد</th>
              </tr>
            </thead>
            <tbody>
              {details.length ? (
                details
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map(row => (
                    <tr key={`${row.number}-${row.date}`}>
                      <td>{row.month}</td>
                      <td>
                        <strong>{row.number}</strong>
                      </td>
                      <td>{formatDate(row.date)}</td>
                      <td>{formatMoney(row.base, state.settings.currency)}</td>
                      <td>{formatMoney(row.value, state.settings.currency)}</td>
                      <td>
                        {formatMoney(
                          row.remainingBase,
                          state.settings.currency
                        )}
                      </td>
                      <td>
                        {formatMoney(row.collected, state.settings.currency)}
                      </td>
                      <td>
                        {formatMoney(row.profit, state.settings.currency)}
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    پس از انتخاب مشتری، جزئیات فاکتورها نمایش داده می‌شود.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function Reports({
  state,
  metrics,
}: {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
}) {
  return (
    <div className="page-stack page-enter">
      <PageIntro
        kicker="دید مدیریتی"
        title="گزارش‌ها"
        description="عددهای کلیدی کارگاه را برای تصمیم‌گیری سریع کنار هم ببینید."
        actionLabel="خروجی JSON"
        onAction={() => {
          const blob = new Blob([exportPayload(state)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "accounting-report.json";
          a.click();
          URL.revokeObjectURL(url);
        }}
      />
      <div className="report-grid">
        <div className="panel report-highlight">
          <span className="section-kicker">خالص گردش نقدی</span>
          <strong>
            {formatMoney(metrics.balance, state.settings.currency)}
          </strong>
          <p>بر مبنای دریافت‌ها و پرداخت‌های ثبت‌شده تا امروز.</p>
          <div className="report-line">
            <span
              style={{
                width: `${Math.min(100, metrics.receipts ? Math.max(10, (metrics.balance / metrics.receipts) * 100) : 10)}%`,
              }}
            />
          </div>
        </div>
        <div className="panel report-breakdown">
          <span className="section-kicker">خلاصهٔ دوره</span>
          <div className="break-row">
            <span>فروش</span>
            <strong>
              {formatMoney(metrics.sales, state.settings.currency)}
            </strong>
          </div>
          <div className="break-row">
            <span>خرید</span>
            <strong>
              {formatMoney(metrics.purchases, state.settings.currency)}
            </strong>
          </div>
          <div className="break-row">
            <span>دریافت</span>
            <strong className="amount-positive">
              {formatMoney(metrics.receipts, state.settings.currency)}
            </strong>
          </div>
          <div className="break-row">
            <span>پرداخت</span>
            <strong className="amount-negative">
              {formatMoney(metrics.payments, state.settings.currency)}
            </strong>
          </div>
        </div>
      </div>
      <div className="panel insight-panel">
        <div className="mini-icon violet">
          <ChartNoAxesCombined size={18} />
        </div>
        <div>
          <strong>گزارش‌های تفصیلی در حال آماده‌سازی هستند</strong>
          <p>
            ساختار گزارش‌ها از یک هستهٔ دادهٔ واحد تغذیه می‌شود تا ماندهٔ
            تاریخی، سود روزشمار و موجودی با فرمول‌های پراکنده تکرار نشوند.
          </p>
        </div>
      </div>
    </div>
  );
}

function SettingsPage({
  state,
  onSave,
}: {
  state: AppState;
  onSave: (next: AppState, message: string) => void;
}) {
  const [businessName, setBusinessName] = useState(state.settings.businessName);
  const [currency, setCurrency] = useState(state.settings.currency);
  const [dayBasis, setDayBasis] = useState(String(state.settings.dayBasis));
  return (
    <div className="page-stack page-enter">
      <PageIntro kicker="تنظیمات برنامه" title="مشخصات و تنظیمات کارگاه" description="تنظیمات عمومی برنامه مستقل از عملیات بکاپ و بازیابی مدیریت می‌شود." />
      <div className="panel settings-panel">
        <div className="backup-hero">
          <div className="backup-hero-icon"><Settings2 size={25} /></div>
          <div><span className="section-kicker">تنظیمات عمومی</span><h3>اطلاعات پایه کارگاه</h3><p>این بخش فقط مشخصات و تنظیمات محاسباتی را تغییر می‌دهد؛ برای ذخیره و بازیابی داده به صفحهٔ «پشتیبان و بازیابی» بروید.</p></div>
        </div>
        <div className="settings-form">
          <label>نام کارگاه<input value={businessName} onChange={event => setBusinessName(event.target.value)} /></label>
          <label>واحد پول<input value={currency} onChange={event => setCurrency(event.target.value)} /></label>
          <label>مبنای روزشمار سود<input type="number" min="1" value={dayBasis} onChange={event => setDayBasis(event.target.value)} /></label>
        </div>
        <div className="form-actions"><button className="button button-primary" onClick={() => onSave({ ...state, settings: { ...state.settings, businessName: businessName.trim() || "کارگاه من", currency: currency.trim() || "ریال", dayBasis: Math.max(1, Number(dayBasis) || 30) } }, "تنظیمات برنامه ذخیره شد")}>ذخیره تنظیمات</button></div>
      </div>
    </div>
  );
}

function BackupPage({
  state,
  onExport,
  onImport,
  onClearAll,
  onDriveRestore,
  onDriveUpload,
  driveBackups,
  driveLoading,
  onDriveRefresh,
}: {
  state: AppState;
  onExport: () => void;
  onImport: () => void;
  onClearAll: () => void;
  onDriveRestore: (fileId?: string) => void;
  onDriveUpload: () => void;
  driveBackups: DriveBackupFile[];
  driveLoading: boolean;
  onDriveRefresh: () => void;
}) {
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const recordCount = state.people.length + state.products.length + state.transactions.length + state.checks.length + state.invoices.length;
  return (
    <div className="page-stack page-enter">
      <PageIntro
        kicker="امنیت و تداوم داده"
        title="پشتیبان و تنظیمات"
        description="اطلاعات را روی دستگاه نگه دارید و هر زمان خواستید یک نسخهٔ قابل انتقال بسازید."
      />
      <div className="backup-grid">
        <div className="panel backup-main">
          <div className="backup-hero">
            <div className="backup-hero-icon">
              <ShieldCheck size={25} />
            </div>
            <div>
              <span className="section-kicker">وضعیت ذخیره‌سازی</span>
              <h3>اطلاعات شما محلی و آمادهٔ پشتیبان‌گیری است</h3>
              <p>
                آخرین تغییر در همین مرورگر ذخیره می‌شود. برای اطمینان، مرتب یک
                فایل JSON خروجی بگیرید.
              </p>
            </div>
          </div>
          <div className="backup-actions">
            <button className="backup-action" onClick={onExport}>
              <span className="backup-action-icon mint">
                <CloudUpload size={20} />
              </span>
              <span>
                <strong>ساخت پشتیبان جدید</strong>
                <small>دانلود فایل کامل اطلاعات</small>
              </span>
              <ArrowLeftRight size={16} />
            </button>
            <button className="backup-action" onClick={onImport}>
              <span className="backup-action-icon violet">
                <CloudDownload size={20} />
              </span>
              <span>
                <strong>بازیابی از فایل</strong>
                <small>اعتبارسنجی قبل از جایگزینی</small>
              </span>
              <ArrowLeftRight size={16} />
            </button>
          </div>
          <div className="danger-zone">
            <div>
              <strong>حذف همه اطلاعات کسب‌وکار</strong>
              <small>ابتدا یک فایل JSON دانلود می‌شود؛ سپس طرف حساب‌ها، کالاها، فاکتورها، عملیات و چک‌ها پاک می‌شوند.</small>
            </div>
            <button className="button button-danger" onClick={() => { setClearOpen(true); setConfirmation(""); }}>
              <Trash2 size={15} /> حذف همه اطلاعات
            </button>
          </div>
          {clearOpen && (
            <div className="clear-confirm-panel">
              <strong>این عملیات قابل بازگشت مستقیم نیست</strong>
              <p>برای ادامه عبارت <b>حذف کامل</b> را وارد کنید. قبل از پاک‌سازی، بکاپ JSON به‌صورت خودکار دانلود خواهد شد.</p>
              <input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="حذف کامل" aria-label="تأیید حذف کامل" />
              <div className="form-actions">
                <button className="button button-ghost" onClick={() => setClearOpen(false)}>انصراف</button>
                <button className="button button-danger" disabled={confirmation !== "حذف کامل"} onClick={() => { onClearAll(); setClearOpen(false); }}>
                  پاک‌سازی {formatNumber(recordCount)} رکورد
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="panel cloud-panel">
          <div className="cloud-illustration">
            <Cloud size={28} />
          </div>
          <span className="section-kicker">اتصال ابری فعال</span>
          <h3>پشتیبان روی Google Drive</h3>
          <p>
            مجوز Drive فعال است و مسیر اختصاصی پروژه برای نگهداری نسخه‌های JSON
            آماده شده است. پشتیبان محلی همچنان بدون وابستگی به اینترنت کار می‌کند.
          </p>
          <div className="drive-path-card">
            <strong>حسابداری کارگاه — پشتیبان‌های PWA</strong>
            <small>زیرپوشه: نسخه‌های پشتیبان JSON</small>
          </div>
          <div className="form-actions">
            <button className="button button-primary" onClick={onDriveUpload}>
              <CloudUpload size={15} /> ذخیره در Drive
            </button>
            <button className="button button-ghost" onClick={onDriveRefresh} disabled={driveLoading}>
              <RefreshCw size={15} className={driveLoading ? "spin" : ""} /> {driveLoading ? "در حال خواندن" : "تازه‌سازی فهرست"}
            </button>
            <a className="button button-primary" href={PROJECT_BACKUPS_FOLDER_URL} target="_blank" rel="noreferrer">
              مشاهده نسخه‌های پشتیبان
            </a>
            <a className="button button-ghost" href={PROJECT_DRIVE_FOLDER_URL} target="_blank" rel="noreferrer">
              پوشه اصلی پروژه
            </a>
          </div>
          <div className="drive-backup-list">
            {driveBackups.map(file => (
              <div className="drive-backup-row" key={file.id}>
                <div>
                  <strong>{file.name}</strong>
                  <small>{file.modifiedTime ? formatDate(file.modifiedTime.slice(0, 10)) : "نسخهٔ پشتیبان"} · {formatNumber(Number(file.size) || 0)} بایت</small>
                </div>
                <button className="button button-primary" onClick={() => onDriveRestore(file.id)}>بازیابی</button>
              </div>
            ))}
          </div>
          <span className="coming-tag">آخرین نسخه تأییدشده: ۱۴۰۵/۰۶/۲۶ · آماده برای همگام‌سازی</span>
        </div>
      </div>
      <div className="data-health">
        <div>
          <span className="health-dot" />
          <strong>داده سالم است</strong>
          <small>
            {formatNumber(
              state.people.length +
                state.products.length +
                state.transactions.length +
                state.checks.length
            )}{" "}
            رکورد قابل بازیابی
          </small>
        </div>
        <div>
          <FileJson size={18} />
          <span>نسخهٔ schema: ۱</span>
        </div>
        <div>
          <RefreshCw size={18} />
          <span>revision: {formatNumber(state.revision)}</span>
        </div>
      </div>
    </div>
  );
}

function PageIntro({
  kicker,
  title,
  description,
  actionLabel,
  onAction,
}: {
  kicker: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="page-intro">
      <div>
        <span className="eyebrow accent-eyebrow">{kicker}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel && onAction && (
        <button className="button button-primary" onClick={onAction}>
          <Plus size={18} />
          {actionLabel}
        </button>
      )}
    </section>
  );
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={e => e.stopPropagation()}>
        <div className="dialog-header">
          <div>
            <span className="section-kicker">فرم ثبت</span>
            <h3>{title}</h3>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function QuickAdd({
  onClose,
  people,
  onSave,
}: {
  onClose: () => void;
  people: AppState["people"];
  onSave: (input: {
    type: TransactionType;
    amount: number;
    partyId?: string;
    note: string;
    date: string;
  }) => void;
}) {
  const [form, setForm] = useState({
    type: "دریافت" as TransactionType,
    amount: "",
    partyId: "",
    note: "",
    date: todayJalali(),
  });
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount.replace(/[^0-9.]/g, ""));
    if (!amount) return;
    onSave({
      type: form.type,
      amount,
      partyId: form.partyId || undefined,
      note: form.note,
      date: form.date,
    });
  }
  return (
    <Dialog title="ثبت عملیات جدید" onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <div className="operation-type-grid">
          {(
            [
              "دریافت",
              "پرداخت",
              "فروش",
              "خرید",
              "هزینه",
              "درآمد",
            ] as TransactionType[]
          ).map(type => (
            <button
              type="button"
              key={type}
              className={`type-choice ${form.type === type ? "selected" : ""}`}
              onClick={() => setForm({ ...form, type })}
            >
              {type}
            </button>
          ))}
        </div>
        <label>
          مبلغ ({"ریال"})
          <input
            autoFocus
            inputMode="numeric"
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            placeholder="مثلاً ۵۰۰۰۰۰۰۰"
          />
        </label>
        <label>
          تاریخ جلالی
          <input
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
          />
        </label>
        <label>
          طرف حساب
          <select
            value={form.partyId}
            onChange={e => setForm({ ...form, partyId: e.target.value })}
          >
            <option value="">بدون طرف حساب</option>
            {people.map(person => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          توضیحات
          <input
            value={form.note}
            onChange={e => setForm({ ...form, note: e.target.value })}
            placeholder="اختیاری"
          />
        </label>
        <div className="form-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={onClose}
          >
            انصراف
          </button>
          <button className="button button-primary" type="submit">
            <Check size={17} />
            ذخیره عملیات
          </button>
        </div>
      </form>
    </Dialog>
  );
}
