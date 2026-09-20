import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  ChartNoAxesCombined,
  Check,
  Calendar,
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
  Undo2,
  Redo2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  AppState,
  CheckStatus,
  ProductionCost,
  ProductionMaterial,
  ProductionFormula,
  Product,
  PartnerSettlementDirection,
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
  jalaliDayDifference,
  jalaliDateKey,
  transactionLabel,
  calculateLateProfit,
  settleChecksFIFO,
  getSettlementBalances,
  allocateCheckFIFO,
  rebuildCheckAllocations,
  createEmptyState,
  PERSON_TYPES,
  suggestNextNumber,
  suggestNextPartyNumber,
  quantityInBase,
  unitConversionToBase,
  executeProduction,
} from "@/lib/accounting";
import {
  createGoogleDriveAdapter,
  getDriveAccessToken,
  LAST_VERIFIED_BACKUP,
  PROJECT_BACKUPS_FOLDER_ID,
  PROJECT_BACKUPS_FOLDER_URL,
  PROJECT_DRIVE_FOLDER_URL,
  getDriveClientId,
  requestDriveAccessToken,
  setDriveClientId,
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
  "wallet-cards": WalletCards,
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

function backupDateKey() {
  return todayJalali().replace(/\//g, "-");
}

function backupFilename(dateKey: string, sequence: number) {
  return `backup-${dateKey}-${String(sequence).padStart(3, "0")}.json`;
}

function nextLocalBackupSequence(dateKey: string) {
  const key = `accounting-workshop-pwa:backup-sequence:${dateKey}`;
  const next = (Number(localStorage.getItem(key)) || 0) + 1;
  localStorage.setItem(key, String(next));
  return next;
}

function nextDriveBackupSequence(files: DriveBackupFile[], dateKey: string) {
  const prefix = `backup-${dateKey}-`;
  return (
    (files.reduce((max, file) => {
      if (!file.name.startsWith(prefix) || !file.name.endsWith(".json"))
        return max;
      const sequence = Number(file.name.slice(prefix.length, -".json".length));
      return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
    }, 0) || 0) + 1
  );
}

function SortControl({
  direction,
  onChange,
  ascLabel = "از ابتدا",
  descLabel = "از انتها",
}: {
  direction: "asc" | "desc";
  onChange: (direction: "asc" | "desc") => void;
  ascLabel?: string;
  descLabel?: string;
}) {
  return (
    <div className="sort-control" role="group" aria-label="مرتب‌سازی">
      <button
        type="button"
        className={direction === "asc" ? "active" : ""}
        onClick={() => onChange("asc")}
      >
        {ascLabel}
      </button>
      <button
        type="button"
        className={direction === "desc" ? "active" : ""}
        onClick={() => onChange("desc")}
      >
        {descLabel}
      </button>
    </div>
  );
}

function JalaliDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const today = todayJalali().split("/").map(Number);
  const parsed = value
    ? value.replace(/-/g, "/").split("/").map(Number)
    : today;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({
    year: parsed[0] || today[0],
    month: parsed[1] || today[1],
  });
  const monthNames = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
  ];
  const weekdays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  const daysInMonth =
    view.month <= 6
      ? 31
      : view.month <= 11
        ? 30
        : view.year % 4 === 3
          ? 30
          : 29;
  const firstDay = (() => {
    const jy = view.year + 1595;
    let days =
      -355668 +
      365 * jy +
      Math.floor(jy / 33) * 8 +
      Math.floor(((jy % 33) + 3) / 4) +
      1 +
      (view.month < 7 ? (view.month - 1) * 31 : (view.month - 7) * 30 + 186);
    let gy = 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      gy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    return (new Date(Date.UTC(gy, 0, days + 1)).getUTCDay() + 1) % 7;
  })();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) =>
    index < firstDay ? null : index - firstDay + 1
  );
  function shiftMonth(delta: number) {
    setView(current =>
      current.month + delta > 12
        ? { year: current.year + 1, month: 1 }
        : current.month + delta < 1
          ? { year: current.year - 1, month: 12 }
          : { year: current.year, month: current.month + delta }
    );
  }
  return (
    <div className="jalali-picker">
      <button
        type="button"
        className="jalali-picker-trigger"
        onClick={() => {
          setView({
            year: parsed[0] || today[0],
            month: parsed[1] || today[1],
          });
          setOpen(current => !current);
        }}
      >
        <Calendar size={15} />
        <span>{value ? formatDate(value) : placeholder}</span>
      </button>
      {open && (
        <div className="jalali-calendar" role="dialog" aria-label="تقویم شمسی">
          <div className="jalali-calendar-head">
            <button type="button" onClick={() => shiftMonth(1)}>
              ›
            </button>
            <strong>
              {monthNames[view.month - 1]} {formatNumber(view.year)}
            </strong>
            <button type="button" onClick={() => shiftMonth(-1)}>
              ‹
            </button>
          </div>
          <div className="jalali-weekdays">
            {weekdays.map(day => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="jalali-days">
            {cells.map((day, index) =>
              day ? (
                <button
                  type="button"
                  key={day}
                  className={
                    value ===
                    `${view.year}/${String(view.month).padStart(2, "0")}/${String(day).padStart(2, "0")}`
                      ? "selected"
                      : ""
                  }
                  onClick={() => {
                    onChange(
                      `${view.year}/${String(view.month).padStart(2, "0")}/${String(day).padStart(2, "0")}`
                    );
                    setOpen(false);
                  }}
                >
                  {formatNumber(day)}
                </button>
              ) : (
                <span key={`empty-${index}`} />
              )
            )}
          </div>
          <button
            type="button"
            className="jalali-today"
            onClick={() => {
              onChange(todayJalali());
              setView({ year: today[0], month: today[1] });
              setOpen(false);
            }}
          >
            امروز
          </button>
        </div>
      )}
    </div>
  );
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
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([
    LAST_VERIFIED_BACKUP,
  ]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveClientId, setDriveClientIdState] = useState(() =>
    getDriveClientId()
  );
  const [pastStates, setPastStates] = useState<AppState[]>([]);
  const [futureStates, setFutureStates] = useState<AppState[]>([]);
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
  useEffect(() => {
    setMobileNav(false);
  }, [activePage]);
  useEffect(() => {
    function handleHistoryShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isTyping || !(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undoState();
      } else if (
        event.key.toLowerCase() === "y" ||
        (event.key.toLowerCase() === "z" && event.shiftKey)
      ) {
        event.preventDefault();
        redoState();
      }
    }
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  });

  const metrics = useMemo(() => calculateMetrics(state), [state]);
  const activeNav =
    navItems.find(item => item.id === activePage) || navItems[0];

  function commitState(
    next: AppState,
    message: string,
    action: string = "UPDATE"
  ) {
    setPastStates(items => [...items.slice(-49), state]);
    setFutureStates([]);
    setState(saveState(appendAudit(next, action, message)));
    setNotice(message);
  }

  function updateState(next: AppState, message: string) {
    commitState(next, message);
  }

  function undoState() {
    if (!pastStates.length) {
      setNotice("تغییری برای بازگشت وجود ندارد");
      return;
    }
    const previous = pastStates[pastStates.length - 1];
    setPastStates(items => items.slice(0, -1));
    setFutureStates(items => [state, ...items].slice(0, 50));
    setState(saveState(previous));
    setNotice("آخرین تغییر بازگردانده شد");
  }

  function redoState() {
    if (!futureStates.length) {
      setNotice("تغییری برای انجام دوباره وجود ندارد");
      return;
    }
    const next = futureStates[0];
    setFutureStates(items => items.slice(1));
    setPastStates(items => [...items.slice(-49), state]);
    setState(saveState(next));
    setNotice("تغییر دوباره اعمال شد");
  }

  function handleExport() {
    const dateKey = backupDateKey();
    const sequence = nextLocalBackupSequence(dateKey);
    const blob = new Blob([exportPayload(state)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFilename(dateKey, sequence);
    link.click();
    URL.revokeObjectURL(url);
    setNotice(
      `نسخهٔ پشتیبان ${dateKey} · ردیف ${formatNumber(sequence)} آماده شد`
    );
  }

  function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = importPayload(String(reader.result));
        commitState(next, `بازیابی از ${file.name}`, "RESTORE");
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : "خواندن فایل ناموفق بود"
        );
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function handleManualImport(payload: string) {
    try {
      const next = importPayload(payload.trim());
      if (!window.confirm("اطلاعات فعلی با این متن پشتیبان جایگزین شود؟"))
        return;
      commitState(next, "بازیابی با متن JSON", "RESTORE_MANUAL");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "متن پشتیبان معتبر نیست"
      );
    }
  }

  function handleClearAll() {
    handleExport();
    const cleared = createEmptyState(state);
    commitState(
      cleared,
      "ابتدا بکاپ دانلود و سپس اطلاعات کسب‌وکار پاک شد",
      "CLEAR_ALL"
    );
  }

  async function handleDriveUpload() {
    const token = getDriveAccessToken();
    if (!token) {
      setNotice(
        "Google Drive به این مرورگر متصل نیست؛ مجوز OAuth موقت دریافت نشده است. بکاپ محلی آماده دانلود است."
      );
      handleExport();
      return;
    }
    try {
      let adapter = createGoogleDriveAdapter(token, PROJECT_BACKUPS_FOLDER_ID);
      const dateKey = backupDateKey();
      let existing: DriveBackupFile[];
      try {
        existing = await adapter.listBackups();
      } catch {
        adapter = createGoogleDriveAdapter(token);
        existing = await adapter.listBackups();
        setNotice(
          "پوشه قدیمی Drive قابل دسترسی نبود؛ نسخه در فضای برنامه ذخیره می‌شود"
        );
      }
      const sequence = nextDriveBackupSequence(existing, dateKey);
      const filename = backupFilename(dateKey, sequence);
      const uploaded = await adapter.uploadBackup(
        filename,
        exportPayload(state)
      );
      setDriveBackups(current => [
        uploaded,
        ...current.filter(file => file.id !== uploaded.id),
      ]);
      setNotice(
        `پشتیبان ${dateKey} · ردیف ${formatNumber(sequence)} در Drive ذخیره شد`
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "بارگذاری در Drive ناموفق بود"
      );
    }
  }

  async function handleDriveConnect(clientId: string) {
    setNotice("در حال بازکردن پنجرهٔ مجوز Google Drive...");
    try {
      setDriveClientId(clientId);
      setDriveClientIdState(clientId.trim());
      const token = await requestDriveAccessToken(clientId);
      window.__ACCOUNTING_DRIVE_ACCESS_TOKEN__ = token;
      setNotice("Google Drive با موفقیت برای این مرورگر متصل شد");
      await handleDriveRefresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "اتصال Google Drive ناموفق بود";
      setNotice(
        message.toLowerCase().includes("invalid_client")
          ? "Google Client ID قدیمی یا نامعتبر است؛ صفحه را با بازکردن دوبارهٔ لینک به‌روز کنید و دوباره تلاش کنید."
          : message
      );
    }
  }

  async function handleDriveRefresh() {
    const token = getDriveAccessToken();
    if (!token) {
      setNotice(
        "Google Drive به این مرورگر متصل نیست؛ برای بازیابی، فایل JSON را از پوشه Drive دانلود و در بخش بازیابی دستی وارد کنید."
      );
      return;
    }
    setDriveLoading(true);
    try {
      let files: DriveBackupFile[];
      try {
        files = await createGoogleDriveAdapter(
          token,
          PROJECT_BACKUPS_FOLDER_ID
        ).listBackups();
      } catch {
        files = await createGoogleDriveAdapter(token).listBackups();
        setNotice(
          "پوشه قدیمی قابل خواندن نبود؛ فهرست فایل‌های برنامه خوانده شد"
        );
      }
      setDriveBackups(files.length ? files : [LAST_VERIFIED_BACKUP]);
      setNotice(
        `${formatNumber(files.length)} نسخهٔ پشتیبان از Drive خوانده شد`
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "خواندن فهرست Drive ناموفق بود"
      );
    } finally {
      setDriveLoading(false);
    }
  }

  async function handleDriveRestore(fileId = LAST_VERIFIED_BACKUP.id) {
    if (
      !window.confirm(
        "داده‌های محلی با آخرین نسخه Google Drive جایگزین شود؟ قبل از ادامه، از داده فعلی بکاپ بگیرید."
      )
    )
      return;
    const token = getDriveAccessToken();
    if (!token) {
      setNotice(
        "Google Drive به این مرورگر متصل نیست؛ از لینک پوشه فایل JSON را دانلود و در بخش بازیابی دستی وارد کنید."
      );
      return;
    }
    try {
      const file =
        driveBackups.find(item => item.id === fileId) || LAST_VERIFIED_BACKUP;
      const payload = await createGoogleDriveAdapter(
        token,
        PROJECT_BACKUPS_FOLDER_ID
      ).downloadBackup(file.id);
      const next = importPayload(payload);
      commitState(next, `بازیابی از ${file.name}`, "RESTORE_DRIVE");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "بازیابی از Drive ناموفق بود"
      );
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
              className="icon-button history-button"
              title="برگشت یک مرحله (Ctrl/Cmd+Z)"
              aria-label="برگشت یک مرحله"
              disabled={!pastStates.length}
              onClick={undoState}
            >
              <Undo2 size={18} />
              <span className="history-label">Undo</span>
            </button>
            <button
              className="icon-button history-button"
              title="انجام دوباره (Ctrl/Cmd+Y)"
              aria-label="انجام دوباره"
              disabled={!futureStates.length}
              onClick={redoState}
            >
              <Redo2 size={18} />
              <span className="history-label">Redo</span>
            </button>
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
          {activePage === "banks" && (
            <BankAccounts
              state={state}
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
          {activePage === "production" && (
            <Production
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
              onManualImport={handleManualImport}
              onClearAll={handleClearAll}
              onDriveRestore={handleDriveRestore}
              onDriveUpload={handleDriveUpload}
              driveBackups={driveBackups}
              driveLoading={driveLoading}
              onDriveRefresh={handleDriveRefresh}
              driveClientId={driveClientId}
              onDriveConnect={handleDriveConnect}
            />
          )}
          {activePage === "settings" && (
            <SettingsPage
              state={state}
              onSave={(next, msg) => updateState(next, msg)}
            />
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
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Set<string>>(
    new Set()
  );
  const [invoiceSortDirection, setInvoiceSortDirection] = useState<
    "asc" | "desc"
  >("asc");
  const blankItem = { productId: "", quantity: "1", unit: "", unitPrice: "" };
  const [form, setForm] = useState({
    number: "",
    type: "فروش" as "فروش" | "خرید",
    date: todayJalali(),
    partyId: "",
    paymentRuleId: "",
    priceHistoryId: "",
    items: [blankItem],
    discount: "",
    note: "",
  });
  const party = state.people.find(item => item.id === form.partyId);
  const invoiceProducts = useMemo(() => {
    const allowedWarehouses = state.warehouses.filter(warehouse =>
      form.type === "خرید"
        ? warehouse.name.includes("مواد")
        : warehouse.name.includes("محصول") ||
          warehouse.name.includes("بازرگانی")
    );
    const allowedIds = new Set(
      allowedWarehouses.map(warehouse => warehouse.id)
    );
    return state.products.filter(product => {
      if (product.category === "بسته تولید" && form.type === "فروش")
        return false;
      return product.warehouseId ? allowedIds.has(product.warehouseId) : true;
    });
  }, [state.products, state.warehouses, form.type]);
  const invoiceAllocations = useMemo(
    () =>
      settleChecksFIFO(
        state.checks,
        state.invoices,
        state.paymentRules,
        state.settings.dayBasis
      ),
    [state.checks, state.invoices, state.paymentRules, state.settings.dayBasis]
  );
  const allocationBalances = useMemo(
    () =>
      getSettlementBalances(
        invoiceAllocations,
        state.checks,
        state.invoices
      ),
    [invoiceAllocations, state.checks, state.invoices]
  );
  const validSales = useMemo(
    () =>
      state.invoices.filter(
        invoice => invoice.type === "فروش" && invoice.status !== "باطل"
      ),
    [state.invoices]
  );
  const paidByInvoice = useMemo(() => {
    const result = new Map<string, number>();
    invoiceAllocations.forEach(item => {
      result.set(
        item.invoiceId,
        (result.get(item.invoiceId) || 0) + item.principalAmount
      );
    });
    return result;
  }, [invoiceAllocations]);
  const registeredSales = validSales.reduce(
    (sum, invoice) => sum + invoice.amount,
    0
  );
  const outstandingSales = validSales.reduce(
    (sum, invoice) =>
      sum + Math.max(0, invoice.amount - (paidByInvoice.get(invoice.id) || 0)),
    0
  );
  const nextInvoiceNumber = useMemo(
    () =>
      suggestNextPartyNumber(
        state.invoices,
        form.partyId,
        party?.code,
        state.invoices.map(item => item.number)
      ),
    [state.invoices, form.partyId, party?.code]
  );
  function suggestedPrice(
    productId: string,
    unit: string,
    partyId = form.partyId
  ) {
    const product = state.products.find(item => item.id === productId);
    if (!product) return "";
    const matches = state.priceHistory
      .filter(
        price =>
          (price.productName === product.name ||
            price.productId === product.id) &&
          price.unit === product.unit &&
          price.effectiveDate <= form.date &&
          (price.scope === "عمومی" || price.partyIds?.includes(partyId))
      )
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
    return String(matches[0]?.price ?? product.price ?? "");
  }
  const subtotal = form.items.reduce((sum, item) => {
    const product = state.products.find(row => row.id === item.productId);
    const conversionRate = product
      ? unitConversionToBase(product, item.unit)
      : 1;
    return (
      sum +
      (Number(item.quantity) || 0) *
        (Number(item.unitPrice.replace(/[^0-9.-]/g, "")) || 0) *
        conversionRate
    );
  }, 0);
  const discount = Math.min(
    subtotal,
    Number(form.discount.replace(/[^0-9.-]/g, "")) || 0
  );
  const calculatedAmount = Math.max(0, subtotal - discount);
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
      rebuildCheckAllocations({
        ...state,
        products,
        invoices: state.invoices.map(item =>
          item.id === invoice.id ? { ...item, status: "باطل" as const } : item
        ),
      }),
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
    if (invoice.status === "باطل") return;
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
      discount: String(invoice.discountAmount || ""),
      note: invoice.note,
    });
    setSelectedInvoice(null);
    setOpen(true);
  }
  function deleteInvoice(invoice: AppState["invoices"][number]) {
    if (!window.confirm(`فاکتور ${invoice.number} حذف شود؟`)) return;
    const products =
      invoice.status === "باطل"
        ? state.products
        : state.products.map(product => {
            const movement = invoice.items
              .filter(item => item.productId === product.id)
              .reduce(
                (sum, item) => sum + (item.quantityBase ?? item.quantity),
                0
              );
            return {
              ...product,
              stock:
                product.stock +
                (invoice.type === "فروش" ? movement : -movement),
            };
          });
    onSave(
      rebuildCheckAllocations({
        ...state,
        products,
        invoices: state.invoices.filter(item => item.id !== invoice.id),
      }),
      invoice.status === "باطل"
        ? `فاکتور باطل ${invoice.number} حذف شد`
        : `فاکتور ${invoice.number} حذف شد و موجودی اصلاح گردید`
    );
    setSelectedInvoice(null);
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!calculatedAmount) return;
    const items = form.items.map(row => {
      const product = state.products.find(item => item.id === row.productId);
      const quantity = Number(row.quantity) || 0;
      const unitPrice = Number(row.unitPrice.replace(/[^0-9.-]/g, "")) || 0;
      const unit = row.unit || product?.unit || "عدد";
      const conversionRate = product ? unitConversionToBase(product, unit) : 1;
      return {
        id: createId("invoice-item"),
        productId: row.productId || undefined,
        description: product?.name || "خدمت/کالای آزاد",
        quantity,
        unit,
        conversionRate,
        quantityBase: quantity * conversionRate,
        unitPrice,
        total: quantity * unitPrice * conversionRate,
      };
    });
    const invoice = {
      id: editingInvoice?.id || createId("invoice"),
      number: form.number.trim() || nextInvoiceNumber,
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
      discountAmount: discount,
      amount: calculatedAmount,
      paidAmount: Math.min(editingInvoice?.paidAmount || 0, calculatedAmount),
      status:
        editingInvoice && editingInvoice.paidAmount >= calculatedAmount
          ? ("تسویه شده" as const)
          : editingInvoice && editingInvoice.paidAmount > 0
            ? ("تسویه جزئی" as const)
            : ("باز" as const),
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
      rebuildCheckAllocations({ ...state, products, invoices }),
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
      discount: "",
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
        onAction={() => {
          setEditingInvoice(null);
          setForm(current => ({
            ...current,
            number: nextInvoiceNumber,
            date: todayJalali(),
          }));
          setOpen(true);
        }}
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
          label="مانده فروش معتبر"
          value={formatMoney(outstandingSales, state.settings.currency)}
          helper="پس از تخصیص FIFO و حذف فاکتور باطل"
          icon={<WalletCards size={20} />}
          tone="rose"
        />
        <MetricCard
          label="فروش معتبر ثبت‌شده"
          value={formatMoney(registeredSales, state.settings.currency)}
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
          <div className="panel-heading-actions">
            <SortControl
              direction={invoiceSortDirection}
              onChange={setInvoiceSortDirection}
              ascLabel="قدیمی‌تر"
              descLabel="جدیدتر"
            />
            <span className="soft-tag">FIFO چک‌ها و ماندهٔ واقعی</span>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>شماره</th>
                <th>تاریخ</th>
                <th>طرف حساب</th>
                <th>نام کالا</th>
                <th>تعداد</th>
                <th>قیمت پایه</th>
                <th>مبلغ</th>
                <th>تسویه</th>
                <th>مانده</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {state.invoices.length ? (
                [...state.invoices]
                  .sort(
                    (a, b) =>
                      (invoiceSortDirection === "asc" ? 1 : -1) *
                      (jalaliDateKey(a.date).localeCompare(
                        jalaliDateKey(b.date)
                      ) || a.id.localeCompare(b.id))
                  )
                  .map(invoice => {
                    const expanded = expandedInvoiceIds.has(invoice.id);
                    const allocations = invoiceAllocations.filter(
                      item => item.invoiceId === invoice.id
                    );
                    return (
                      <Fragment key={invoice.id}>
                        <tr>
                          <td>
                            <button
                              type="button"
                              className={`allocation-toggle ${expanded ? "is-expanded" : ""}`}
                              onClick={() =>
                                setExpandedInvoiceIds(current => {
                                  const next = new Set(current);
                                  if (next.has(invoice.id))
                                    next.delete(invoice.id);
                                  else next.add(invoice.id);
                                  return next;
                                })
                              }
                              title="نمایش چک‌های تخصیص‌یافته"
                            >
                              <ChevronDown size={14} />
                              <strong>{invoice.number}</strong>
                            </button>
                          </td>
                          <td>{formatDate(invoice.date)}</td>
                          <td>{personName(state, invoice.partyId)}</td>
                          <td>
                            <div className="invoice-cell-list">
                              {invoice.items.map((item, index) => (
                                <span key={`${item.productId}-name-${index}`}>
                                  {state.products.find(
                                    product => product.id === item.productId
                                  )?.name || "کالا/خدمت آزاد"}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <div className="invoice-cell-list">
                              {invoice.items.map((item, index) => (
                                <span key={`${item.productId}-qty-${index}`}>
                                  {formatNumber(Number(item.quantity) || 0)}{" "}
                                  {item.unit}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <div className="invoice-cell-list">
                              {invoice.items.map((item, index) => (
                                <span key={`${item.productId}-price-${index}`}>
                                  {formatMoney(
                                    Number(item.unitPrice) || 0,
                                    state.settings.currency
                                  )} {state.products.find(
                                    product => product.id === item.productId
                                  )?.unit || "واحد پایه"}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="amount-cell">
                            {formatMoney(
                              invoice.amount,
                              state.settings.currency
                            )}
                          </td>
                          <td>
                            {formatMoney(
                              invoice.paidAmount,
                              state.settings.currency
                            )}
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
                            {invoice.status !== "باطل" && (
                              <button
                                className="icon-button row-action"
                                title="ویرایش فاکتور"
                                onClick={() => openEdit(invoice)}
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            <button
                              className="icon-button row-action"
                              title="حذف فاکتور"
                              onClick={() => deleteInvoice(invoice)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="allocation-detail-row">
                            <td colSpan={10}>
                              {allocations.length ? (
                                <div className="invoice-check-allocation-list">
                                  {allocations.map(item => {
                                    const check = state.checks.find(
                                      row => row.id === item.checkId
                                    );
                                    const checkAllocated = invoiceAllocations
                                      .filter(
                                        row => row.checkId === item.checkId
                                      )
                                      .reduce(
                                        (sum, row) => sum + row.amount,
                                        0
                                      );
                                    const invoiceAllocated = allocations.reduce(
                                      (sum, row) => sum + row.principalAmount,
                                      0
                                    );
                                    const allocationBalance =
                                      allocationBalances.get(
                                        `${item.checkId}:${item.invoiceId}`
                                      );
                                    const tone =
                                      check?.status === "وصول شده"
                                        ? "cleared"
                                        : check?.status === "خرج شده"
                                          ? "spent"
                                          : [
                                                "برگشتی",
                                                "عودت داده شده",
                                                "باطل",
                                              ].includes(check?.status || "")
                                            ? "bad"
                                            : check?.status === "جایگزین شده"
                                              ? "replaced"
                                              : "open";
                                    return (
                                      <div
                                        className={`allocation-detail-card check-allocation-card check-row-${tone}`}
                                        key={`${item.checkId}-${item.invoiceId}`}
                                      >
                                        <strong>
                                          چک {check?.number || "—"} ·{" "}
                                          {check
                                            ? formatMoney(
                                                check.amount,
                                                state.settings.currency
                                              )
                                            : "—"}
                                        </strong>
                                        <span>{check?.status || "—"}</span>
                                        <span>
                                          {check
                                            ? formatDate(check.dueDate)
                                            : "—"}
                                        </span>
                                        <span>
                                          {formatMoney(
                                            item.amount,
                                            state.settings.currency
                                          )}
                                        </span>
                                        <span>
                                          اختلاف: {formatNumber(item.days || 0)}{" "}
                                          روز
                                        </span>
                                        <span>
                                          سود:{" "}
                                          {formatMoney(
                                            item.profit || 0,
                                            state.settings.currency
                                          )}
                                        </span>
                                        <span>
                                          مانده چک پس از تخصیص:{" "}
                                          {check
                                            ? formatMoney(
                                                allocationBalance?.remainingCheck ??
                                                  Math.max(
                                                    0,
                                                    check.amount - checkAllocated
                                                  ),
                                                state.settings.currency
                                              )
                                            : "—"}
                                        </span>
                                        <span>
                                          مانده فاکتور پس از تخصیص:{" "}
                                          {formatMoney(
                                            Math.max(
                                              0,
                                              allocationBalance?.remainingInvoice ??
                                                Math.max(
                                                  0,
                                                  (invoice?.amount || 0) -
                                                    invoiceAllocated
                                                )
                                            ),
                                            state.settings.currency
                                          )}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="muted-cell">
                                  چکی برای این فاکتور تخصیص داده نشده است.
                                </span>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={10}>
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
                inputMode="text"
                placeholder={`پیشنهاد: ${nextInvoiceNumber}`}
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
              <JalaliDatePicker
                value={form.date}
                onChange={date => setForm({ ...form, date })}
              />
            </label>
            <label>
              طرف حساب
              <select
                value={form.partyId}
                onChange={e => {
                  const selected = state.people.find(
                    item => item.id === e.target.value
                  );
                  setForm(current => ({
                    ...current,
                    number: editingInvoice
                      ? current.number
                      : suggestNextPartyNumber(
                          state.invoices,
                          e.target.value,
                          selected?.code,
                          state.invoices.map(item => item.number)
                        ),
                    partyId: e.target.value,
                    paymentRuleId: "",
                    items: current.items.map(item =>
                      item.productId
                        ? {
                            ...item,
                            unitPrice: suggestedPrice(
                              item.productId,
                              item.unit,
                              e.target.value
                            ),
                          }
                        : item
                    ),
                  }));
                }}
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
                        unit: product?.unit || "",
                        unitPrice: product
                          ? suggestedPrice(product.id, product.unit)
                          : row.unitPrice,
                      });
                    }}
                  >
                    <option value="">کالا/خدمت آزاد</option>
                    {invoiceProducts.map(product => (
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
                  <input
                    value={formatNumber(
                      (Number(row.quantity) || 0) *
                        (state.products.find(
                          product => product.id === row.productId
                        )
                          ? unitConversionToBase(
                              state.products.find(
                                product => product.id === row.productId
                              )!,
                              row.unit
                            )
                          : 1)
                    )}
                    readOnly
                    aria-label="تعداد کل به واحد پایه"
                    placeholder="تعداد کل پایه"
                  />
                  <select
                    value={row.unit}
                    onChange={e =>
                      updateItem(index, {
                        unit: e.target.value,
                        unitPrice: suggestedPrice(
                          row.productId,
                          e.target.value
                        ),
                      })
                    }
                  >
                    <option value="">واحد پایه</option>
                    {!state.products.find(
                      product => product.id === row.productId
                    ) &&
                      state.settings.units.map(unit => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
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
                    placeholder="قیمت واحد پایه"
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
              <span>
                جمع اقلام: {formatMoney(subtotal, state.settings.currency)}
              </span>
              <label className="invoice-discount-field">
                تخفیف
                <input
                  inputMode="numeric"
                  value={form.discount}
                  onChange={e => setForm({ ...form, discount: e.target.value })}
                  placeholder="مبلغ تخفیف"
                />
              </label>
              <strong>
                مبلغ نهایی:{" "}
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
              <span>
                جمع اقلام:{" "}
                {formatMoney(
                  selectedInvoice.items.reduce(
                    (sum, item) => sum + item.total,
                    0
                  ),
                  state.settings.currency
                )}
                {selectedInvoice.discountAmount
                  ? ` · تخفیف: ${formatMoney(selectedInvoice.discountAmount, state.settings.currency)}`
                  : ""}
              </span>
              <strong>
                مبلغ نهایی:{" "}
                {formatMoney(selectedInvoice.amount, state.settings.currency)}
              </strong>
            </div>
            <div className="form-actions">
              {selectedInvoice.status !== "باطل" ? (
                <>
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
                </>
              ) : (
                <>
                  <span className="status-pill status-danger">
                    این فاکتور باطل است
                  </span>
                  <button
                    className="button button-danger"
                    onClick={() => deleteInvoice(selectedInvoice)}
                  >
                    حذف کامل فاکتور باطل
                  </button>
                </>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function BankAccounts({
  state,
  onSave,
}: {
  state: AppState;
  onSave: (next: AppState, message: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "بانک" as "بانک" | "صندوق" | "شریک",
    balance: "0",
  });
  const [sort, setSort] = useState<"asc" | "desc">("asc");

  const accounts = useMemo(
    () =>
      [...state.accounts].sort(
        (a, b) => (sort === "asc" ? 1 : -1) * a.name.localeCompare(b.name, "fa")
      ),
    [state.accounts, sort]
  );
  const totals = useMemo(
    () => ({
      all: state.accounts.reduce((sum, account) => sum + account.balance, 0),
      banks: state.accounts
        .filter(account => account.type === "بانک")
        .reduce((sum, account) => sum + account.balance, 0),
      cash: state.accounts
        .filter(account => account.type === "صندوق")
        .reduce((sum, account) => sum + account.balance, 0),
    }),
    [state.accounts]
  );

  function reset() {
    setEditingId(null);
    setForm({ name: "", type: "بانک", balance: "0" });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    const balance = Number(form.balance.replace(/,/g, "")) || 0;
    const nextAccounts = editingId
      ? state.accounts.map(account =>
          account.id === editingId
            ? { ...account, name, type: form.type, balance }
            : account
        )
      : [
          ...state.accounts,
          { id: createId("account"), name, type: form.type, balance },
        ];
    onSave(
      { ...state, accounts: nextAccounts },
      editingId ? "حساب بانکی اصلاح شد" : "حساب جدید اضافه شد"
    );
    reset();
  }

  function edit(account: AppState["accounts"][number]) {
    setEditingId(account.id);
    setForm({
      name: account.name,
      type: account.type,
      balance: String(account.balance),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function remove(account: AppState["accounts"][number]) {
    const referenced = state.checks.some(
      check => check.bankAccountId === account.id
    );
    if (referenced) {
      window.alert(
        "این حساب در چک‌ها استفاده شده و برای حفظ یکپارچگی قابل حذف نیست."
      );
      return;
    }
    if (!window.confirm(`حساب «${account.name}» حذف شود؟`)) return;
    onSave(
      {
        ...state,
        accounts: state.accounts.filter(item => item.id !== account.id),
      },
      "حساب حذف شد"
    );
  }

  return (
    <div className="page-stack page-enter bank-page">
      <PageIntro
        kicker="مدیریت نقدینگی"
        title="بانک‌ها و صندوق‌ها"
        description="حساب‌های بانکی، صندوق و شریک را جداگانه مدیریت کنید؛ موجودی وصول چک‌ها در همین صفحه قابل ردیابی است."
        actionLabel={editingId ? "انصراف از ویرایش" : "حساب جدید"}
        onAction={reset}
      />
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon mint">
            <WalletCards size={19} />
          </div>
          <div className="metric-copy">
            <span>مجموع نقدینگی</span>
            <strong>{formatMoney(totals.all, state.settings.currency)}</strong>
            <small>{formatNumber(state.accounts.length)} حساب</small>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon indigo">
            <Banknote size={19} />
          </div>
          <div className="metric-copy">
            <span>موجودی بانک‌ها</span>
            <strong>
              {formatMoney(totals.banks, state.settings.currency)}
            </strong>
            <small>پس از ثبت وصول چک به‌روزرسانی می‌شود</small>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon amber">
            <WalletCards size={19} />
          </div>
          <div className="metric-copy">
            <span>موجودی صندوق</span>
            <strong>{formatMoney(totals.cash, state.settings.currency)}</strong>
            <small>صندوق‌های فعال</small>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon violet">
            <FileClock size={19} />
          </div>
          <div className="metric-copy">
            <span>چک‌های متصل به بانک</span>
            <strong>
              {formatNumber(
                state.checks.filter(check => check.bankAccountId).length
              )}
            </strong>
            <small>مرجع حساب بانکی ثبت‌شده</small>
          </div>
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="panel table-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">دفتر حساب‌ها</span>
              <h3>حساب‌های ثبت‌شده</h3>
            </div>
            <SortControl direction={sort} onChange={setSort} />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>نام حساب</th>
                  <th>نوع</th>
                  <th>موجودی</th>
                  <th>چک‌های مرتبط</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(account => {
                  const linkedChecks = state.checks.filter(
                    check => check.bankAccountId === account.id
                  );
                  return (
                    <tr key={account.id}>
                      <td>
                        <strong>{account.name}</strong>
                      </td>
                      <td>
                        <span className="soft-tag">{account.type}</span>
                      </td>
                      <td className="amount-cell">
                        {formatMoney(account.balance, state.settings.currency)}
                      </td>
                      <td>{formatNumber(linkedChecks.length)}</td>
                      <td>
                        <button
                          className="icon-button row-action edit-action"
                          title="ویرایش حساب"
                          onClick={() => edit(account)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="icon-button row-action delete-action"
                          title="حذف حساب"
                          onClick={() => remove(account)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <form className="panel form-grid" onSubmit={submit}>
          <div className="panel-heading full-field">
            <div>
              <span className="section-kicker">ثبت و اصلاح</span>
              <h3>{editingId ? "ویرایش حساب" : "افزودن حساب جدید"}</h3>
            </div>
          </div>
          <label>
            نام حساب
            <input
              value={form.name}
              onChange={event => setForm({ ...form, name: event.target.value })}
              placeholder="مثلاً بانک ملت"
              required
            />
          </label>
          <label>
            نوع حساب
            <select
              value={form.type}
              onChange={event =>
                setForm({
                  ...form,
                  type: event.target.value as typeof form.type,
                })
              }
            >
              <option value="بانک">بانک</option>
              <option value="صندوق">صندوق</option>
              <option value="شریک">شریک</option>
            </select>
          </label>
          <label className="full-field">
            موجودی اولیه / اصلاحی
            <input
              inputMode="decimal"
              value={form.balance}
              onChange={event =>
                setForm({ ...form, balance: event.target.value })
              }
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="button button-ghost"
              onClick={reset}
            >
              پاک‌کردن فرم
            </button>
            <button type="submit" className="button button-primary">
              {editingId ? "ذخیره اصلاح" : "افزودن حساب"}
            </button>
          </div>
        </form>
      </div>
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
  const [accountOperation, setAccountOperation] = useState({
    type: "انتقال بین حساب‌ها" as TransactionType,
    amount: "",
    fromAccountId: "",
    toAccountId: "",
    accountId: "",
    partyId: "",
    productId: "",
    warehouseId: "",
    quantity: "",
    unit: "",
    checkId: "",
    settlementDirection:
      "پرداخت بدهی کارگاه به شریک" as PartnerSettlementDirection,
    referenceType: "سایر" as "فاکتور خرید" | "چک" | "هزینه" | "سایر",
    referenceId: "",
    date: todayJalali(),
    note: "",
    partnerEffect: "افزایش طلب شریک" as
      | "افزایش طلب شریک"
      | "کاهش طلب شریک"
      | "افزایش طلب کارگاه از شریک"
      | "کاهش طلب کارگاه از شریک",
  });
  const accounts = state.accounts;
  const partners = state.people.filter(person => person.roles.includes("شریک"));
  const operationProducts = state.products;
  const operationChecks = state.checks.filter(check => check.status !== "باطل");
  const isPartnerSettlementType = [
    "مساعده/پرداخت به شریک",
    "دریافت تسویه از شریک",
  ].includes(accountOperation.type);
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
  function applyAccountEffect(
    accounts: AppState["accounts"],
    transaction: AppState["transactions"][number],
    multiplier: 1 | -1
  ) {
    return accounts.map(account => {
      if (transaction.fromAccountId === account.id)
        return {
          ...account,
          balance: account.balance - transaction.amount * multiplier,
        };
      if (transaction.toAccountId === account.id)
        return {
          ...account,
          balance: account.balance + transaction.amount * multiplier,
        };
      if (transaction.accountId === account.id && transaction.partnerEffect) {
        const delta =
          transaction.partnerEffect === "افزایش طلب شریک" ||
          transaction.partnerEffect === "افزایش طلب کارگاه از شریک"
            ? transaction.amount
            : -transaction.amount;
        return { ...account, balance: account.balance + delta * multiplier };
      }
      return account;
    });
  }
  function applyProductEffect(
    products: AppState["products"],
    transaction: AppState["transactions"][number],
    multiplier: 1 | -1
  ) {
    if (!transaction.productId || !transaction.quantity) return products;
    const direction = transaction.type === "خرید کالا" ? 1 : -1;
    return products.map(product =>
      product.id === transaction.productId
        ? {
            ...product,
            stock:
              product.stock + direction * transaction.quantity! * multiplier,
          }
        : product
    );
  }
  function saveTransactionEdit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(editForm.amount.replace(/[^0-9.-]/g, ""));
    if (!amount || !editingTransaction) return;
    const updatedTransaction = {
      ...editingTransaction,
      type: editForm.type,
      amount,
      partyId: editForm.partyId || undefined,
      note: editForm.note,
      date: editForm.date,
    };
    let nextAccounts = state.accounts;
    let nextProducts = state.products;
    if (
      editingTransaction.accountId ||
      editingTransaction.fromAccountId ||
      editingTransaction.toAccountId
    ) {
      nextAccounts = applyAccountEffect(nextAccounts, editingTransaction, -1);
      nextAccounts = applyAccountEffect(nextAccounts, updatedTransaction, 1);
    }
    nextProducts = applyProductEffect(nextProducts, editingTransaction, -1);
    nextProducts = applyProductEffect(nextProducts, updatedTransaction, 1);
    onSave(
      {
        ...state,
        accounts: nextAccounts,
        products: nextProducts,
        transactions: state.transactions.map(row =>
          row.id === editingTransaction.id ? updatedTransaction : row
        ),
      },
      "تمام اطلاعات عملیات ویرایش شد"
    );
    setEditingTransaction(null);
  }
  function saveAccountOperation(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(accountOperation.amount.replace(/[^0-9.-]/g, ""));
    if (!amount || amount <= 0) return;
    const isTransfer = accountOperation.type === "انتقال بین حساب‌ها";
    const isStockOperation = ["خرید کالا", "فروش کالا"].includes(
      accountOperation.type
    );
    const isPartnerSettlement = [
      "مساعده/پرداخت به شریک",
      "دریافت تسویه از شریک",
    ].includes(accountOperation.type);
    const selectedProduct = state.products.find(
      product => product.id === accountOperation.productId
    );
    const quantity = Number(accountOperation.quantity.replace(/[^0-9.-]/g, ""));
    const quantityBase = selectedProduct
      ? quantityInBase(
          selectedProduct,
          quantity,
          accountOperation.unit || selectedProduct.unit
        )
      : quantity;
    if (
      isTransfer &&
      (!accountOperation.fromAccountId ||
        !accountOperation.toAccountId ||
        accountOperation.fromAccountId === accountOperation.toAccountId)
    ) {
      window.alert("حساب مبدأ و مقصد را متفاوت انتخاب کنید.");
      return;
    }
    if (
      !isTransfer &&
      !isStockOperation &&
      (!accountOperation.accountId || !accountOperation.partyId)
    ) {
      window.alert("حساب شریک و طرف حساب شریک را انتخاب کنید.");
      return;
    }
    if (
      isPartnerSettlement &&
      (!accountOperation.fromAccountId ||
        !accountOperation.toAccountId ||
        accountOperation.fromAccountId === accountOperation.toAccountId)
    ) {
      window.alert("حساب مبدأ و مقصد تسویه شریک را متفاوت انتخاب کنید.");
      return;
    }
    if (
      isStockOperation &&
      (!selectedProduct ||
        !accountOperation.warehouseId ||
        !accountOperation.partyId ||
        !accountOperation.accountId ||
        !quantity)
    ) {
      window.alert(
        "برای خرید یا فروش، کالا، انبار، طرف حساب و حساب مالی را انتخاب کنید."
      );
      return;
    }
    const nextAccounts = state.accounts.map(account => {
      if (isPartnerSettlement && account.id === accountOperation.fromAccountId)
        return { ...account, balance: account.balance - amount };
      if (isPartnerSettlement && account.id === accountOperation.toAccountId)
        return { ...account, balance: account.balance + amount };
      if (isTransfer && account.id === accountOperation.fromAccountId)
        return { ...account, balance: account.balance - amount };
      if (isTransfer && account.id === accountOperation.toAccountId)
        return { ...account, balance: account.balance + amount };
      if (isStockOperation && account.id === accountOperation.accountId) {
        return {
          ...account,
          balance:
            account.balance +
            (accountOperation.type === "خرید کالا" ? -amount : amount),
        };
      }
      if (
        !isTransfer &&
        !isStockOperation &&
        !isPartnerSettlement &&
        account.id === accountOperation.accountId
      ) {
        const delta =
          accountOperation.partnerEffect === "افزایش طلب شریک" ||
          accountOperation.partnerEffect === "افزایش طلب کارگاه از شریک"
            ? amount
            : -amount;
        return { ...account, balance: account.balance + delta };
      }
      return account;
    });
    const nextProducts =
      isStockOperation && selectedProduct
        ? state.products.map(product =>
            product.id === selectedProduct.id
              ? {
                  ...product,
                  warehouseId: accountOperation.warehouseId,
                  stock:
                    product.stock +
                    (accountOperation.type === "خرید کالا"
                      ? quantityBase
                      : -quantityBase),
                }
              : product
          )
        : state.products;
    const fromName = state.accounts.find(
      account => account.id === accountOperation.fromAccountId
    )?.name;
    const toName = state.accounts.find(
      account => account.id === accountOperation.toAccountId
    )?.name;
    const accountName = state.accounts.find(
      account => account.id === accountOperation.accountId
    )?.name;
    const warehouseName = state.warehouses.find(
      warehouse => warehouse.id === accountOperation.warehouseId
    )?.name;
    const productName = selectedProduct?.name;
    const referenceLabel =
      accountOperation.referenceType === "فاکتور خرید"
        ? state.invoices.find(
            invoice => invoice.id === accountOperation.referenceId
          )?.number
        : accountOperation.referenceType === "چک"
          ? state.checks.find(
              check => check.id === accountOperation.referenceId
            )?.number
          : undefined;
    const note = isTransfer
      ? `انتقال از ${fromName} به ${toName}${accountOperation.note ? ` · ${accountOperation.note}` : ""}`
      : isStockOperation
        ? `${accountOperation.type} · ${productName} · ${quantity} ${accountOperation.unit || selectedProduct?.unit} · انبار ${warehouseName} · حساب ${accountName}${accountOperation.checkId ? ` · چک ${state.checks.find(check => check.id === accountOperation.checkId)?.number || ""}` : ""}${accountOperation.note ? ` · ${accountOperation.note}` : ""}`
        : `${accountOperation.settlementDirection || accountOperation.partnerEffect} · ${accountName}${referenceLabel ? ` · مرجع ${accountOperation.referenceType}: ${referenceLabel}` : ""}${accountOperation.note ? ` · ${accountOperation.note}` : ""}`;
    const transaction: AppState["transactions"][number] = {
      id: createId("account-operation"),
      type: accountOperation.type,
      date: accountOperation.date,
      partyId: accountOperation.partyId || undefined,
      accountId: accountOperation.accountId || undefined,
      fromAccountId: accountOperation.fromAccountId || undefined,
      toAccountId: accountOperation.toAccountId || undefined,
      productId: accountOperation.productId || undefined,
      warehouseId: accountOperation.warehouseId || undefined,
      quantity: isStockOperation ? quantityBase : undefined,
      unit: accountOperation.unit || undefined,
      checkId: accountOperation.checkId || undefined,
      partnerEffect: isTransfer ? undefined : accountOperation.partnerEffect,
      settlementDirection: isPartnerSettlement
        ? accountOperation.settlementDirection
        : undefined,
      referenceType: isPartnerSettlement
        ? accountOperation.referenceType
        : undefined,
      referenceId: isPartnerSettlement
        ? accountOperation.referenceId || undefined
        : undefined,
      referenceLabel: isPartnerSettlement ? referenceLabel : undefined,
      amount,
      status: "ثبت شده",
      note,
    };
    onSave(
      {
        ...state,
        accounts: nextAccounts,
        products: nextProducts,
        transactions: [transaction, ...state.transactions],
      },
      isTransfer
        ? "انتقال بین حساب‌ها ثبت شد"
        : isStockOperation
          ? `${accountOperation.type} با لینک کالا، انبار و حساب ثبت شد`
          : "عملیات شریک و اثر آن در حساب ثبت شد"
    );
    setAccountOperation({
      type: "انتقال بین حساب‌ها",
      amount: "",
      fromAccountId: "",
      toAccountId: "",
      accountId: "",
      partyId: "",
      productId: "",
      warehouseId: "",
      quantity: "",
      unit: "",
      checkId: "",
      settlementDirection: "پرداخت بدهی کارگاه به شریک",
      referenceType: "سایر",
      referenceId: "",
      date: todayJalali(),
      note: "",
      partnerEffect: "افزایش طلب شریک",
    });
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
      <form
        className="panel form-grid account-operation-panel"
        onSubmit={saveAccountOperation}
      >
        <div className="panel-heading full-field">
          <div>
            <span className="section-kicker">گردش حساب و شریک</span>
            <h3>انتقال و تسویهٔ دوطرفه</h3>
          </div>
        </div>
        <label>
          نوع عملیات
          <select
            value={accountOperation.type}
            onChange={event =>
              setAccountOperation({
                ...accountOperation,
                type: event.target.value as TransactionType,
              })
            }
          >
            <option value="انتقال بین حساب‌ها">انتقال بین حساب‌ها</option>
            <option value="خرید کالا">خرید کالا / ورود به انبار</option>
            <option value="فروش کالا">فروش کالا / خروج از انبار</option>
            <option value="هزینه/خرید توسط شریک">هزینه/خرید توسط شریک</option>
            <option value="دریافت توسط شریک">دریافت وجه توسط شریک</option>
            <option value="مساعده/پرداخت به شریک">
              مساعده / پرداخت به شریک
            </option>
            <option value="دریافت تسویه از شریک">دریافت تسویه از شریک</option>
          </select>
          <div
            className="operation-type-grid"
            aria-label="انتخاب سریع نوع عملیات"
          >
            {(
              [
                ["انتقال بین حساب‌ها", "انتقال"],
                ["خرید کالا", "خرید کالا"],
                ["فروش کالا", "فروش کالا"],
                ["هزینه/خرید توسط شریک", "خرید شریک"],
                ["دریافت توسط شریک", "دریافت شریک"],
                ["مساعده/پرداخت به شریک", "مساعده"],
                ["دریافت تسویه از شریک", "تسویه شریک"],
              ] as Array<[TransactionType, string]>
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={accountOperation.type === value ? "active" : ""}
                onClick={() =>
                  setAccountOperation({ ...accountOperation, type: value })
                }
              >
                {label}
              </button>
            ))}
          </div>
        </label>
        <label>
          مبلغ
          <input
            inputMode="numeric"
            value={accountOperation.amount}
            onChange={event =>
              setAccountOperation({
                ...accountOperation,
                amount: event.target.value,
              })
            }
            placeholder="مبلغ"
            required
          />
        </label>
        {accountOperation.type === "انتقال بین حساب‌ها" ? (
          <>
            <label>
              حساب مبدأ
              <select
                value={accountOperation.fromAccountId}
                onChange={event =>
                  setAccountOperation({
                    ...accountOperation,
                    fromAccountId: event.target.value,
                  })
                }
              >
                <option value="">انتخاب مبدأ</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حساب مقصد
              <select
                value={accountOperation.toAccountId}
                onChange={event =>
                  setAccountOperation({
                    ...accountOperation,
                    toAccountId: event.target.value,
                  })
                }
              >
                <option value="">انتخاب مقصد</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.type}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : ["خرید کالا", "فروش کالا"].includes(accountOperation.type) ? (
          <>
            <label>
              کالا
              <select
                value={accountOperation.productId}
                onChange={event => {
                  const product = state.products.find(
                    item => item.id === event.target.value
                  );
                  setAccountOperation({
                    ...accountOperation,
                    productId: event.target.value,
                    unit: product?.unit || "",
                    warehouseId: product?.warehouseId || "",
                  });
                }}
              >
                <option value="">انتخاب کالا</option>
                {operationProducts.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              انبار نگهداری
              <select
                value={accountOperation.warehouseId}
                onChange={event =>
                  setAccountOperation({
                    ...accountOperation,
                    warehouseId: event.target.value,
                  })
                }
              >
                <option value="">انتخاب انبار</option>
                {state.warehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              طرف حساب
              <select
                value={accountOperation.partyId}
                onChange={event =>
                  setAccountOperation({
                    ...accountOperation,
                    partyId: event.target.value,
                  })
                }
              >
                <option value="">انتخاب مشتری / تأمین‌کننده</option>
                {state.people.map(person => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.roles.join("، ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حساب پرداخت / دریافت
              <select
                value={accountOperation.accountId}
                onChange={event =>
                  setAccountOperation({
                    ...accountOperation,
                    accountId: event.target.value,
                  })
                }
              >
                <option value="">انتخاب حساب</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              تعداد و واحد
              <div className="inline-form-fields">
                <input
                  inputMode="decimal"
                  value={accountOperation.quantity}
                  onChange={event =>
                    setAccountOperation({
                      ...accountOperation,
                      quantity: event.target.value,
                    })
                  }
                  placeholder="تعداد"
                />
                <select
                  value={accountOperation.unit}
                  onChange={event =>
                    setAccountOperation({
                      ...accountOperation,
                      unit: event.target.value,
                    })
                  }
                >
                  <option value="">واحد</option>
                  {[
                    accountOperation.productId &&
                      operationProducts.find(
                        product => product.id === accountOperation.productId
                      )?.unit,
                    accountOperation.productId &&
                      operationProducts.find(
                        product => product.id === accountOperation.productId
                      )?.unit2,
                  ]
                    .filter(Boolean)
                    .map(unit => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                </select>
              </div>
            </label>
            <label>
              چک پرداختی (اختیاری)
              <select
                value={accountOperation.checkId}
                onChange={event =>
                  setAccountOperation({
                    ...accountOperation,
                    checkId: event.target.value,
                  })
                }
              >
                <option value="">بدون چک</option>
                {operationChecks.map(check => (
                  <option key={check.id} value={check.id}>
                    {check.number} ·{" "}
                    {formatMoney(check.amount, state.settings.currency)}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label>
              حساب مالی شریک
              <select
                value={accountOperation.accountId}
                onChange={event =>
                  setAccountOperation({
                    ...accountOperation,
                    accountId: event.target.value,
                  })
                }
              >
                <option value="">انتخاب حساب شریک</option>
                {accounts
                  .filter(account => account.type === "شریک")
                  .map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              طرف حساب شریک / ذی‌نفع
              <select
                value={accountOperation.partyId}
                onChange={event =>
                  setAccountOperation({
                    ...accountOperation,
                    partyId: event.target.value,
                  })
                }
              >
                <option value="">انتخاب شریک</option>
                {partners.map(person => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              اثر بر مانده شریک
              <select
                value={accountOperation.partnerEffect}
                onChange={event =>
                  setAccountOperation({
                    ...accountOperation,
                    partnerEffect: event.target
                      .value as typeof accountOperation.partnerEffect,
                  })
                }
              >
                <option value="افزایش طلب شریک">
                  افزایش طلب شریک / بدهی کارگاه
                </option>
                <option value="کاهش طلب شریک">کاهش طلب شریک / تسویه</option>
                <option value="افزایش طلب کارگاه از شریک">
                  افزایش طلب کارگاه از شریک
                </option>
                <option value="کاهش طلب کارگاه از شریک">
                  کاهش طلب کارگاه از شریک / بازپرداخت
                </option>
              </select>
            </label>
            {isPartnerSettlementType && (
              <>
                <div className="partner-settlement-hint full-field">
                  پرداخت بدهی کارگاه به شریک یعنی پول از حساب کارگاه به حساب
                  شریک می‌رود؛ دریافت طلب کارگاه از شریک یعنی وجه فاکتور/چک از
                  حساب شریک به حساب کارگاه منتقل می‌شود.
                </div>
                <label>
                  جهت تسویه
                  <select
                    value={accountOperation.settlementDirection}
                    onChange={event =>
                      setAccountOperation({
                        ...accountOperation,
                        settlementDirection: event.target
                          .value as PartnerSettlementDirection,
                        partnerEffect:
                          event.target.value === "پرداخت بدهی کارگاه به شریک"
                            ? "کاهش طلب شریک"
                            : "کاهش طلب کارگاه از شریک",
                      })
                    }
                  >
                    <option value="پرداخت بدهی کارگاه به شریک">
                      پرداخت بدهی کارگاه به شریک
                    </option>
                    <option value="دریافت طلب کارگاه از شریک">
                      دریافت طلب کارگاه از شریک
                    </option>
                  </select>
                </label>
                <label>
                  حساب مبدأ تسویه
                  <select
                    value={accountOperation.fromAccountId}
                    onChange={event =>
                      setAccountOperation({
                        ...accountOperation,
                        fromAccountId: event.target.value,
                      })
                    }
                  >
                    <option value="">انتخاب حساب مبدأ</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  حساب مقصد تسویه
                  <select
                    value={accountOperation.toAccountId}
                    onChange={event =>
                      setAccountOperation({
                        ...accountOperation,
                        toAccountId: event.target.value,
                      })
                    }
                  >
                    <option value="">انتخاب حساب مقصد</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  نوع مرجع
                  <select
                    value={accountOperation.referenceType}
                    onChange={event =>
                      setAccountOperation({
                        ...accountOperation,
                        referenceType: event.target
                          .value as typeof accountOperation.referenceType,
                        referenceId: "",
                      })
                    }
                  >
                    <option value="فاکتور خرید">فاکتور خرید</option>
                    <option value="چک">چک</option>
                    <option value="هزینه">هزینه</option>
                    <option value="سایر">سایر</option>
                  </select>
                </label>
                {accountOperation.referenceType === "فاکتور خرید" && (
                  <label>
                    فاکتور مرجع
                    <select
                      value={accountOperation.referenceId}
                      onChange={event =>
                        setAccountOperation({
                          ...accountOperation,
                          referenceId: event.target.value,
                        })
                      }
                    >
                      <option value="">انتخاب فاکتور خرید</option>
                      {state.invoices
                        .filter(
                          invoice =>
                            invoice.type === "خرید" &&
                            invoice.status !== "باطل" &&
                            (!accountOperation.partyId ||
                              invoice.partyId === accountOperation.partyId)
                        )
                        .map(invoice => (
                          <option key={invoice.id} value={invoice.id}>
                            {invoice.number} ·{" "}
                            {formatMoney(
                              invoice.amount,
                              state.settings.currency
                            )}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {accountOperation.referenceType === "چک" && (
                  <label>
                    چک مرجع
                    <select
                      value={accountOperation.referenceId}
                      onChange={event =>
                        setAccountOperation({
                          ...accountOperation,
                          referenceId: event.target.value,
                        })
                      }
                    >
                      <option value="">انتخاب چک</option>
                      {operationChecks
                        .filter(
                          check =>
                            !accountOperation.partyId ||
                            check.partyId === accountOperation.partyId
                        )
                        .map(check => (
                          <option key={check.id} value={check.id}>
                            {check.number} ·{" "}
                            {formatMoney(check.amount, state.settings.currency)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </>
            )}
          </>
        )}
        <label>
          تاریخ
          <JalaliDatePicker
            value={accountOperation.date}
            onChange={date =>
              setAccountOperation({ ...accountOperation, date })
            }
          />
        </label>
        <label className="full-field">
          شرح عملیاتی
          <input
            value={accountOperation.note}
            onChange={event =>
              setAccountOperation({
                ...accountOperation,
                note: event.target.value,
              })
            }
            placeholder="مثلاً خرید مواد اولیه توسط شریک یا مساعده"
          />
        </label>
        <div className="form-actions full-field">
          <button className="button button-primary" type="submit">
            ثبت گردش حساب
          </button>
        </div>
      </form>
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
                <th>طرف حساب / شرح</th>
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
                    <td>
                      <div>{personName(state, item.partyId)}</div>
                      {item.note && (
                        <small className="muted-cell">{item.note}</small>
                      )}
                    </td>
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
                        onClick={() => {
                          if (!window.confirm("عملیات حذف شود؟")) return;
                          const nextAccounts =
                            item.accountId ||
                            item.fromAccountId ||
                            item.toAccountId
                              ? applyAccountEffect(state.accounts, item, -1)
                              : state.accounts;
                          const nextProducts = applyProductEffect(
                            state.products,
                            item,
                            -1
                          );
                          onSave(
                            {
                              ...state,
                              accounts: nextAccounts,
                              products: nextProducts,
                              transactions: state.transactions.filter(
                                row => row.id !== item.id
                              ),
                            },
                            "عملیات حذف شد و اثر حسابی آن برگشت داده شد"
                          );
                        }}
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
              <JalaliDatePicker
                value={editForm.date}
                onChange={date => setEditForm({ ...editForm, date })}
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
    code: "",
    name: "",
    roles: ["مشتری"] as AppState["people"][number]["roles"],
    phone: "",
    defaultPaymentRuleId: "",
  };
  const [open, setOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<
    AppState["people"][number] | null
  >(null);
  const [peopleSortDirection, setPeopleSortDirection] = useState<
    "asc" | "desc"
  >("asc");
  const [form, setForm] = useState(blank);
  const nextPersonCode = useMemo(
    () =>
      suggestNextNumber(
        state.people.map(item => item.code),
        1
      ).padStart(3, "0"),
    [state.people]
  );
  function beginEdit(person: AppState["people"][number]) {
    setEditingPerson(person);
    setForm({
      code: person.code || nextPersonCode,
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
      code: form.code.trim() || nextPersonCode,
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
          <div className="panel-heading-actions">
            <SortControl
              direction={peopleSortDirection}
              onChange={setPeopleSortDirection}
              ascLabel="الفبایی"
              descLabel="معکوس"
            />
            <div className="search-box compact">
              <Search size={16} />
              <input placeholder="جست‌وجو..." />
            </div>
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
                [...state.people]
                  .sort(
                    (a, b) =>
                      (peopleSortDirection === "asc" ? 1 : -1) *
                      a.name.localeCompare(b.name, "fa")
                  )
                  .map(person => (
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
            <label>
              کد طرف حساب
              <input
                inputMode="numeric"
                value={form.code}
                placeholder={`پیشنهاد: ${nextPersonCode}`}
                onChange={e => setForm({ ...form, code: e.target.value })}
              />
            </label>
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
  const [warehouseFilter, setWarehouseFilter] = useState("همه");
  const [productSortDirection, setProductSortDirection] = useState<
    "asc" | "desc"
  >("asc");
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
    stockUnit: "کارتن",
    minStock: "0",
    price: "0",
  });
  const nextProductCode = useMemo(
    () =>
      suggestNextNumber(
        state.products.map(item => item.code),
        1
      ).padStart(3, "0"),
    [state.products]
  );
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
  const visibleProducts = state.products
    .filter(product =>
      warehouseFilter === "همه"
        ? true
        : warehouseFilter === "بدون انبار"
          ? !product.warehouseId
          : product.warehouseId === warehouseFilter
    )
    .sort(
      (a, b) =>
        (productSortDirection === "asc" ? 1 : -1) *
        a.name.localeCompare(b.name, "fa")
    );
  const movements = useMemo(() => {
    if (!selectedProduct) return [];
    const rows: Array<{
      id: string;
      date: string;
      reference: string;
      direction: string;
      quantity: number;
      unit: string;
      amount: number;
      warehouse: string;
    }> = [];
    state.invoices
      .filter(invoice => invoice.status !== "باطل")
      .forEach(invoice =>
        invoice.items
          .filter(item => item.productId === selectedProduct.id)
          .forEach(item =>
            rows.push({
              id: `invoice-${invoice.id}-${item.id}`,
              date: invoice.date,
              reference: `فاکتور ${invoice.number}`,
              direction: invoice.type === "خرید" ? "ورود خرید" : "خروج فروش",
              quantity: item.quantityBase || item.quantity,
              unit: item.unit,
              amount: item.total,
              warehouse:
                state.warehouses.find(
                  warehouse => warehouse.id === selectedProduct.warehouseId
                )?.name || "بدون انبار",
            })
          )
      );
    state.transactions
      .filter(
        item =>
          item.status !== "باطل" &&
          item.productId === selectedProduct.id &&
          ["خرید کالا", "فروش کالا"].includes(item.type)
      )
      .forEach(item =>
        rows.push({
          id: `transaction-${item.id}`,
          date: item.date,
          reference: "عملیات مستقیم",
          direction: item.type === "خرید کالا" ? "ورود خرید" : "خروج فروش",
          quantity: item.quantity || 0,
          unit: item.unit || selectedProduct.unit,
          amount: item.amount,
          warehouse:
            state.warehouses.find(
              warehouse => warehouse.id === item.warehouseId
            )?.name || "بدون انبار",
        })
      );
    state.productionRecords.forEach(record => {
      const formula = state.productionFormulas.find(
        item => item.id === record.formulaId
      );
      if (!formula) return;
      if (formula.outputProductId === selectedProduct.id) {
        rows.push({
          id: `production-output-${record.id}`,
          date: record.date,
          reference: `تولید ${formula.name}`,
          direction: "ورود تولید",
          quantity: record.outputQuantityBase ?? record.outputQuantity,
          unit: selectedProduct.unit,
          amount: record.totalCost,
          warehouse:
            state.warehouses.find(
              warehouse => warehouse.id === selectedProduct.warehouseId
            )?.name || "بدون انبار",
        });
      }
      formula.materials
        .filter(material => material.productId === selectedProduct.id)
        .forEach(material =>
          rows.push({
            id: `production-material-${record.id}-${material.id}`,
            date: record.date,
            reference: `مصرف تولید ${formula.name}`,
            direction: "خروج مصرف تولید",
            quantity: quantityInBase(
              selectedProduct,
              material.quantity,
              material.unit
            ),
            unit: selectedProduct.unit,
            amount:
              quantityInBase(
                selectedProduct,
                material.quantity,
                material.unit
              ) * selectedProduct.price,
            warehouse:
              state.warehouses.find(
                warehouse => warehouse.id === selectedProduct.warehouseId
              )?.name || "بدون انبار",
          })
        );
    });
    return rows.sort((a, b) =>
      jalaliDateKey(a.date).localeCompare(jalaliDateKey(b.date))
    );
  }, [selectedProduct, state]);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const enteredStock = Number(form.stock.replace(/[^0-9.-]/g, "")) || 0;
    const draftProduct = {
      id: "draft",
      code: form.code,
      name: form.name,
      unit: form.unit,
      unit2: form.unit2,
      conversionRate: Number(form.conversionRate) || 1,
      stock: 0,
      minStock: 0,
      price: 0,
    } satisfies Product;
    const product = {
      id: editingProduct?.id || createId("product"),
      code:
        form.code.trim() || String(state.products.length + 1).padStart(3, "0"),
      name: form.name.trim(),
      unit: form.unit,
      unit2: form.unit2,
      conversionRate: draftProduct.conversionRate,
      warehouseId: form.warehouseId || undefined,
      stock: editingProduct
        ? enteredStock
        : quantityInBase(
            draftProduct,
            enteredStock,
            form.stockUnit || form.unit
          ),
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
        onAction={() => {
          setEditingProduct(null);
          setForm(current => ({ ...current, code: nextProductCode }));
          setOpen(true);
        }}
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
      <div className="warehouse-tabs" role="tablist" aria-label="فیلتر انبار">
        <button
          className={
            warehouseFilter === "همه" ? "warehouse-tab active" : "warehouse-tab"
          }
          onClick={() => setWarehouseFilter("همه")}
        >
          همه کالاها ({formatNumber(state.products.length)})
        </button>
        {state.warehouses.map(warehouse => {
          const count = state.products.filter(
            product => product.warehouseId === warehouse.id
          ).length;
          return (
            <button
              key={warehouse.id}
              className={
                warehouseFilter === warehouse.id
                  ? "warehouse-tab active"
                  : "warehouse-tab"
              }
              onClick={() => setWarehouseFilter(warehouse.id)}
            >
              {warehouse.name} ({formatNumber(count)})
            </button>
          );
        })}
        <button
          className={
            warehouseFilter === "بدون انبار"
              ? "warehouse-tab active"
              : "warehouse-tab"
          }
          onClick={() => setWarehouseFilter("بدون انبار")}
        >
          بدون انبار (
          {formatNumber(
            state.products.filter(product => !product.warehouseId).length
          )}
          )
        </button>
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
            <h3>
              {warehouseFilter === "همه"
                ? "وضعیت فعلی انبار"
                : warehouseFilter === "بدون انبار"
                  ? "کالاهای بدون انبار"
                  : state.warehouses.find(item => item.id === warehouseFilter)
                      ?.name}
            </h3>
          </div>
          <div className="panel-heading-actions">
            <SortControl
              direction={productSortDirection}
              onChange={setProductSortDirection}
              ascLabel="الفبایی"
              descLabel="معکوس"
            />
            <span className="soft-tag">واحد اول / واحد دوم</span>
          </div>
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
              {visibleProducts.length ? (
                visibleProducts.map(product => (
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
                            stockUnit: product.unit,
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
                  <th>انبار</th>
                  <th>ارزش گردش</th>
                </tr>
              </thead>
              <tbody>
                {movements.length ? (
                  movements.map(row => (
                    <tr key={row.id}>
                      <td>{formatDate(row.date)}</td>
                      <td>{row.reference}</td>
                      <td>
                        <span
                          className={`status-pill ${row.direction.startsWith("ورود") ? "status-success" : "status-warning"}`}
                        >
                          {row.direction}
                        </span>
                      </td>
                      <td>
                        {formatNumber(row.quantity)} {row.unit}
                      </td>
                      <td>{row.warehouse}</td>
                      <td>
                        {formatMoney(row.amount, state.settings.currency)}
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
                inputMode="numeric"
                placeholder={`پیشنهاد: ${nextProductCode}`}
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
                {state.settings.units.map(unit => (
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
                {state.settings.units.map(unit => (
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
              <select
                value={form.stockUnit}
                onChange={e => setForm({ ...form, stockUnit: e.target.value })}
              >
                {[form.unit, form.unit2, ...state.settings.units]
                  .filter(
                    (unit, index, list) => unit && list.indexOf(unit) === index
                  )
                  .map(unit => (
                    <option key={unit}>{unit}</option>
                  ))}
              </select>
              <input
                inputMode="decimal"
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
    const selectedProduct = state.products.find(
      item => item.name === form.productName
    );
    const priceUnit = selectedProduct?.unit || form.unit;
    onSave(
      {
        ...state,
        priceHistory: editingPrice
          ? state.priceHistory.map(item =>
              item.id === editingPrice.id
                ? {
                    ...item,
                    productId: selectedProduct?.id,
                    productName: form.productName.trim(),
                    scope: form.scope,
                    partyIds:
                      form.scope === "اختصاصی" ? form.partyIds : undefined,
                    effectiveDate: form.effectiveDate,
                    unit: priceUnit,
                    price,
                    note: form.note,
                  }
                : item
            )
          : [
              {
                id: createId("price"),
                productId: selectedProduct?.id,
                productName: form.productName.trim(),
                scope: form.scope,
                partyIds: form.scope === "اختصاصی" ? form.partyIds : undefined,
                effectiveDate: form.effectiveDate,
                unit: priceUnit,
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
                    item => item.name === e.target.value
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
              <JalaliDatePicker
                value={form.effectiveDate}
                onChange={effectiveDate => setForm({ ...form, effectiveDate })}
              />
            </label>
            <label>
              واحد
              <select
              value={form.unit}
                disabled={Boolean(
                  state.products.find(item => item.name === form.productName)
                )}
                onChange={e => setForm({ ...form, unit: e.target.value })}
              >
                {(state.products.find(item => item.name === form.productName)
                  ? [
                      state.products.find(
                        item => item.name === form.productName
                      )!.unit,
                    ]
                  : state.settings.units
                ).map(unit => (
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
  const [expandedCheckIds, setExpandedCheckIds] = useState<Set<string>>(
    new Set()
  );
  const [checkSortDirection, setCheckSortDirection] = useState<"asc" | "desc">(
    "asc"
  );
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
  const nextCheckNumber = useMemo(() => {
    const checkParty = state.people.find(item => item.id === form.partyId);
    return suggestNextPartyNumber(
      state.checks,
      form.partyId,
      checkParty?.code,
      state.checks.map(item => item.number)
    );
  }, [state.checks, state.people, form.partyId]);
  const visibleChecks = state.checks
    .filter(
      check =>
        (statusFilter === "همه" || check.status === statusFilter) &&
        (bankFilter === "همه" || check.bankAccountId === bankFilter) &&
        (!receivedFrom || check.receivedDate >= receivedFrom) &&
        (!receivedTo || check.receivedDate <= receivedTo) &&
        (!dueFrom || check.dueDate >= dueFrom) &&
        (!dueTo || check.dueDate <= dueTo)
    )
    .sort(
      (a, b) =>
        (checkSortDirection === "asc" ? 1 : -1) *
        (jalaliDateKey(a.dueDate).localeCompare(jalaliDateKey(b.dueDate)) ||
          jalaliDateKey(a.receivedDate).localeCompare(
            jalaliDateKey(b.receivedDate)
          ) ||
          a.id.localeCompare(b.id))
    );
  const allocationDetails = settleChecksFIFO(
    state.checks,
    state.invoices,
    state.paymentRules,
    state.settings.dayBasis
  );
  const allocationBalances = useMemo(
    () =>
      getSettlementBalances(
        allocationDetails,
        state.checks,
        state.invoices
      ),
    [allocationDetails, state.checks, state.invoices]
  );
  function recalculateAllocations() {
    onSave(
      rebuildCheckAllocations(state),
      "تخصیص FIFO همه چک‌ها بر اساس سررسید محاسبه شد"
    );
  }
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
    if (["نزد ما", "وصول شده", "برگشتی"].includes(status) && !targetId) {
      window.alert(
        "برای این وضعیت، ابتدا حساب بانکی مرجع را از ستون بعدی یا فرم ویرایش انتخاب کنید."
      );
      return;
    }
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
      rebuildCheckAllocations({
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
      }),
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
        rebuildCheckAllocations({
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
        }),
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
    const nextState = rebuildCheckAllocations({
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
    });
    onSave(
      nextState,
      editingCheck ? "تمام اطلاعات چک ویرایش شد" : "چک دریافتی ثبت شد"
    );
    setOpen(false);
    setEditingCheck(null);
    setForm(blank);
    setReplacementLines("");
  }
  function targetLabel(status: CheckStatus) {
    if (["نزد ما", "وصول شده", "برگشتی"].includes(status))
      return status === "برگشتی" ? "حساب امانت" : "حساب مرجع";
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
            number: nextCheckNumber,
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
          فیلتر حساب مرجع
          <select
            value={bankFilter}
            onChange={e => setBankFilter(e.target.value)}
          >
            <option value="همه">همه حساب‌ها</option>
            {state.accounts
              .filter(account =>
                ["بانک", "صندوق", "شریک"].includes(account.type)
              )
              .map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          دریافت از
          <JalaliDatePicker
            value={receivedFrom}
            onChange={setReceivedFrom}
            placeholder="از تاریخ"
          />
        </label>
        <label>
          دریافت تا
          <JalaliDatePicker
            value={receivedTo}
            onChange={setReceivedTo}
            placeholder="تا تاریخ"
          />
        </label>
        <label>
          سررسید از
          <JalaliDatePicker
            value={dueFrom}
            onChange={setDueFrom}
            placeholder="از تاریخ"
          />
        </label>
        <label>
          سررسید تا
          <JalaliDatePicker
            value={dueTo}
            onChange={setDueTo}
            placeholder="تا تاریخ"
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
        <button
          className="button button-primary button-small"
          onClick={recalculateAllocations}
        >
          محاسبه مجدد تخصیص‌ها
        </button>
      </div>
      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">دفتر چک</span>
            <h3>پیگیری و تغییر وضعیت چک‌ها</h3>
          </div>
          <div className="panel-heading-actions">
            <SortControl
              direction={checkSortDirection}
              onChange={setCheckSortDirection}
              ascLabel="سررسید نزدیک‌تر"
              descLabel="سررسید دورتر"
            />
            <span className="soft-tag">مرجع وابسته به وضعیت</span>
          </div>
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
                visibleChecks.map(check => {
                  const checkAllocations = allocationDetails.filter(
                    item => item.checkId === check.id
                  );
                  const expanded = expandedCheckIds.has(check.id);
                  return (
                    <Fragment key={check.id}>
                      <tr
                        key={check.id}
                        className={`check-row check-row-${check.status === "وصول شده" ? "cleared" : check.status === "خرج شده" ? "spent" : ["برگشتی", "عودت داده شده", "باطل"].includes(check.status) ? "bad" : check.status === "جایگزین شده" ? "replaced" : "open"}`}
                      >
                        <td>
                          <button
                            type="button"
                            className={`allocation-toggle ${expanded ? "is-expanded" : ""}`}
                            onClick={() =>
                              setExpandedCheckIds(current => {
                                const next = new Set(current);
                                if (next.has(check.id)) next.delete(check.id);
                                else next.add(check.id);
                                return next;
                              })
                            }
                            aria-expanded={expanded}
                            title="نمایش فاکتورهای تخصیص‌یافته"
                          >
                            <ChevronDown size={14} />
                            <strong>
                              {check.number} ·{" "}
                              {formatMoney(
                                check.amount,
                                state.settings.currency
                              )}
                            </strong>
                          </button>
                          {check.replacementOf && (
                            <small className="muted-cell">
                              جایگزین چک اصلی
                            </small>
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
                                  check.bankAccountId ||
                                    check.returnPartyId ||
                                    ""
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
                                saveCheckStatus(
                                  check,
                                  check.status,
                                  e.target.value
                                )
                              }
                            >
                              <option value="">
                                {check.bankAccountId
                                  ? "تغییر حساب مرجع"
                                  : "انتخاب حساب مرجع *"}
                              </option>
                              {state.accounts
                                .filter(account =>
                                  ["بانک", "صندوق", "شریک"].includes(
                                    account.type
                                  )
                                )
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
                                saveCheckStatus(
                                  check,
                                  check.status,
                                  e.target.value
                                )
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
                                        paymentRuleId:
                                          check.paymentRuleId || "",
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
                              onClick={() => {
                                if (!window.confirm("چک و ارجاعات آن حذف شود؟"))
                                  return;
                                onSave(
                                  rebuildCheckAllocations({
                                    ...state,
                                    checks: state.checks
                                      .filter(item => item.id !== check.id)
                                      .map(item => ({
                                        ...item,
                                        replacementIds:
                                          item.replacementIds?.filter(
                                            id => id !== check.id
                                          ),
                                      })),
                                    transactions: state.transactions.filter(
                                      item =>
                                        !item.note?.includes(
                                          `__check:${check.id}`
                                        )
                                    ),
                                  }),
                                  "چک حذف شد"
                                );
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="allocation-detail-row">
                          <td colSpan={8}>
                            {checkAllocations.length ? (
                              checkAllocations.map(item => {
                                const invoice = state.invoices.find(
                                  row => row.id === item.invoiceId
                                );
                                const checkAllocated = checkAllocations.reduce(
                                  (sum, row) => sum + row.amount,
                                  0
                                );
                                const invoiceAllocated = state.checks
                                  .flatMap(row =>
                                    allocationDetails.filter(
                                      allocation =>
                                        allocation.checkId === row.id
                                    )
                                  )
                                  .filter(
                                    allocation =>
                                      allocation.invoiceId === item.invoiceId
                                  )
                                  .reduce(
                                    (sum, row) => sum + row.principalAmount,
                                    0
                                  );
                                const allocationBalance =
                                  allocationBalances.get(
                                    `${item.checkId}:${item.invoiceId}`
                                  );
                                return (
                                  <div
                                    className="allocation-detail-card"
                                    key={`${item.checkId}-${item.invoiceId}`}
                                  >
                                    <strong>
                                      فاکتور {invoice?.number || "—"} · چک{" "}
                                      {formatMoney(
                                        check.amount,
                                        state.settings.currency
                                      )}
                                    </strong>
                                    <span>
                                      مبلغ تخصیص:{" "}
                                      {formatMoney(
                                        item.amount,
                                        state.settings.currency
                                      )}
                                    </span>
                                    <span>
                                      اصل:{" "}
                                      {formatMoney(
                                        item.principalAmount,
                                        state.settings.currency
                                      )}
                                    </span>
                                    <span>
                                      سود:{" "}
                                      {formatMoney(
                                        item.profit,
                                        state.settings.currency
                                      )}
                                    </span>
                                    <span>
                                      اختلاف تاریخ:{" "}
                                      {formatNumber(item.days || 0)} روز
                                    </span>
                                    <span>
                                      مانده چک پس از تخصیص:{" "}
                                      {formatMoney(
                                        allocationBalance?.remainingCheck ??
                                          Math.max(
                                            0,
                                            check.amount - checkAllocated
                                          ),
                                        state.settings.currency
                                      )}
                                    </span>
                                    <span>
                                      مانده فاکتور پس از تخصیص:{" "}
                                      {formatMoney(
                                        allocationBalance?.remainingInvoice ??
                                          Math.max(
                                            0,
                                            (invoice?.amount || 0) -
                                              invoiceAllocated
                                          ),
                                        state.settings.currency
                                      )}
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <span className="muted-cell">
                                برای این چک تخصیصی ثبت نشده است.
                              </span>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
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
                inputMode="text"
                placeholder={`پیشنهاد: ${nextCheckNumber}`}
                onChange={e => setForm({ ...form, number: e.target.value })}
              />
            </label>
            <label>
              طرف حساب
              <select
                value={form.partyId}
                onChange={e => {
                  const selected = state.people.find(
                    item => item.id === e.target.value
                  );
                  setForm({
                    ...form,
                    number: editingCheck
                      ? form.number
                      : suggestNextPartyNumber(
                          state.checks,
                          e.target.value,
                          selected?.code,
                          state.checks.map(item => item.number)
                        ),
                    partyId: e.target.value,
                  });
                }}
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
              <JalaliDatePicker
                value={form.receivedDate}
                onChange={receivedDate => setForm({ ...form, receivedDate })}
              />
            </label>
            <label>
              تاریخ سررسید
              <JalaliDatePicker
                value={form.dueDate}
                onChange={dueDate => setForm({ ...form, dueDate })}
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
                  <option value="">انتخاب حساب مرجع *</option>
                  {state.accounts.filter(account =>
                    ["بانک", "صندوق", "شریک"].includes(account.type)
                  ).length ? (
                    state.accounts
                      .filter(account =>
                        ["بانک", "صندوق", "شریک"].includes(account.type)
                      )
                      .map(account => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))
                  ) : (
                    <option value="" disabled>
                      ابتدا در صفحه بانک‌ها و صندوق‌ها حساب بسازید
                    </option>
                  )}
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
    .sort(
      (a, b) =>
        jalaliDateKey(a.date).localeCompare(jalaliDateKey(b.date)) ||
        a.id.localeCompare(b.id)
    );
  const partyChecks = state.checks
    .filter(
      check =>
        check.status !== "باطل" &&
        check.status !== "جایگزین شده" &&
        (!partyId || check.partyId === partyId)
    )
    .sort(
      (a, b) =>
        jalaliDateKey(a.dueDate).localeCompare(jalaliDateKey(b.dueDate)) ||
        a.id.localeCompare(b.id)
    );
  const fifoSettlements = settleChecksFIFO(
    partyChecks,
    partyInvoices,
    state.paymentRules,
    state.settings.dayBasis
  );
  const allValidSalesTotal = state.invoices
    .filter(invoice => invoice.type === "فروش" && invoice.status !== "باطل")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const selectedValidSalesTotal = partyInvoices.reduce(
    (sum, invoice) => sum + invoice.amount,
    0
  );
  const excludedSalesTotal = Math.max(
    0,
    allValidSalesTotal - selectedValidSalesTotal
  );
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
    const invoiceSettlements = fifoSettlements.filter(
      item => item.invoiceId === invoice.id
    );
    const collected = invoiceSettlements.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const profit = invoiceSettlements.reduce(
      (sum, item) => sum + item.profit,
      0
    );
    const principalCollected = invoiceSettlements.reduce(
      (sum, item) => sum + item.principalAmount,
      0
    );
    const baseRemaining = Math.max(0, invoice.amount - principalCollected);
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
      state.paymentRules.find(item => item.id === invoice.paymentRuleId) ||
        state.paymentRules.find(item => item.active),
      invoice.date,
      baseRemaining,
      state.settings.dayBasis
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
      <div className="scope-audit panel">
        <strong>کنترل دامنهٔ محاسبه</strong>
        <span>
          کل فروش معتبر:{" "}
          {formatMoney(allValidSalesTotal, state.settings.currency)}
        </span>
        <span>
          فروش مشتری انتخاب‌شده:{" "}
          {formatMoney(selectedValidSalesTotal, state.settings.currency)}
        </span>
        <span className={excludedSalesTotal ? "amount-negative" : "muted-cell"}>
          خارج از این گزارش:{" "}
          {formatMoney(excludedSalesTotal, state.settings.currency)}
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
  const cashRows = useMemo(
    () =>
      state.transactions
        .filter(item => item.status !== "باطل")
        .map(item => {
          const incoming = ["دریافت", "درآمد", "فروش کالا"].includes(item.type);
          const account = state.accounts.find(
            value => value.id === (item.accountId || item.toAccountId)
          );
          return {
            ...item,
            incoming,
            accountName: account?.name || "بدون حساب",
            partyName: personName(state, item.partyId),
          };
        })
        .sort((a, b) =>
          jalaliDateKey(b.date).localeCompare(jalaliDateKey(a.date))
        ),
    [state]
  );
  const directStockOperations = state.transactions.filter(
    item =>
      item.status !== "باطل" &&
      (item.type === "خرید کالا" || item.type === "فروش کالا")
  );
  const possibleDuplicates = directStockOperations.filter(operation =>
    state.invoices.some(invoice => {
      if (
        invoice.status === "باطل" ||
        invoice.type !== (operation.type === "خرید کالا" ? "خرید" : "فروش")
      )
        return false;
      const sameParty =
        !operation.partyId || invoice.partyId === operation.partyId;
      const sameDate = invoice.date === operation.date;
      const sameProduct =
        operation.productId &&
        invoice.items.some(item => item.productId === operation.productId);
      return (
        sameParty &&
        sameDate &&
        sameProduct &&
        Math.abs(invoice.amount - operation.amount) < 0.01
      );
    })
  );
  const [ledgerMode, setLedgerMode] = useState<"account" | "party">("account");
  const [ledgerAccountId, setLedgerAccountId] = useState("");
  const [ledgerPartyId, setLedgerPartyId] = useState("");
  const ledgerRows = useMemo(() => {
    if (ledgerMode === "account" && !ledgerAccountId) return [];
    if (ledgerMode === "party" && !ledgerPartyId) return [];
    const rows: Array<{
      id: string;
      date: string;
      title: string;
      increase: number;
      decrease: number;
      note: string;
    }> = [];
    state.transactions.forEach(item => {
      if (item.status === "باطل") return;
      if (ledgerMode === "party" && item.partyId !== ledgerPartyId) return;
      if (
        ledgerMode === "account" &&
        item.accountId !== ledgerAccountId &&
        item.fromAccountId !== ledgerAccountId &&
        item.toAccountId !== ledgerAccountId
      )
        return;
      const increase =
        ledgerMode === "account"
          ? item.toAccountId === ledgerAccountId ||
            ["دریافت", "درآمد", "فروش کالا"].includes(item.type)
          : item.partnerEffect === "افزایش طلب شریک" ||
            item.partnerEffect === "کاهش طلب کارگاه از شریک" ||
            item.type === "خرید" ||
            item.type === "هزینه/خرید توسط شریک";
      rows.push({
        id: item.id,
        date: item.date,
        title: transactionLabel(item.type),
        increase: increase ? item.amount : 0,
        decrease: increase ? 0 : item.amount,
        note: [
          item.settlementDirection,
          item.referenceLabel
            ? `مرجع ${item.referenceType}: ${item.referenceLabel}`
            : "",
          item.note || "",
        ]
          .filter(Boolean)
          .join(" · "),
      });
    });
    if (ledgerMode === "account") {
      state.checks.forEach(check => {
        if (
          check.status === "وصول شده" &&
          check.bankAccountId === ledgerAccountId
        )
          rows.push({
            id: `check-${check.id}`,
            date: check.dueDate,
            title: `وصول چک ${check.number}`,
            increase: check.amount,
            decrease: 0,
            note: personName(state, check.partyId),
          });
      });
    } else {
      state.invoices.forEach(invoice => {
        if (invoice.status === "باطل" || invoice.partyId !== ledgerPartyId)
          return;
        rows.push({
          id: `invoice-${invoice.id}`,
          date: invoice.date,
          title: `فاکتور ${invoice.type} ${invoice.number}`,
          increase: invoice.type === "فروش" ? invoice.amount : 0,
          decrease: invoice.type === "خرید" ? invoice.amount : 0,
          note: invoice.note || "",
        });
      });
      state.checks.forEach(check => {
        if (check.partyId !== ledgerPartyId || check.status === "باطل") return;
        rows.push({
          id: `check-party-${check.id}`,
          date: check.receivedDate,
          title: `چک دریافتی ${check.number}`,
          increase: 0,
          decrease: check.amount,
          note: check.status,
        });
      });
    }
    return rows.sort((a, b) =>
      jalaliDateKey(a.date).localeCompare(jalaliDateKey(b.date))
    );
  }, [ledgerAccountId, ledgerMode, ledgerPartyId, state]);
  const ledgerBalance = ledgerRows.reduce(
    (sum, row) => sum + row.increase - row.decrease,
    0
  );
  const profitReport = useMemo(() => {
    const validInvoices = state.invoices.filter(
      invoice => invoice.status !== "باطل"
    );
    const sales = validInvoices
      .filter(invoice => invoice.type === "فروش")
      .reduce((sum, invoice) => sum + invoice.amount, 0);
    const purchases = validInvoices
      .filter(invoice => invoice.type === "خرید")
      .reduce((sum, invoice) => sum + invoice.amount, 0);
    const estimatedCost = validInvoices
      .filter(invoice => invoice.type === "فروش")
      .reduce(
        (sum, invoice) =>
          sum +
          invoice.items.reduce((lineSum, item) => {
            const product = state.products.find(
              value => value.id === item.productId
            );
            return (
              lineSum +
              (item.quantityBase || item.quantity) *
                (product?.price || item.unitPrice)
            );
          }, 0),
        0
      );
    const receivables = state.people
      .map(person => {
        const invoices = validInvoices.filter(
          invoice => invoice.partyId === person.id
        );
        const salesBase = invoices
          .filter(invoice => invoice.type === "فروش")
          .reduce((sum, invoice) => sum + invoice.amount, 0);
        const purchasesBase = invoices
          .filter(invoice => invoice.type === "خرید")
          .reduce((sum, invoice) => sum + invoice.amount, 0);
        const collected = invoices.reduce(
          (sum, invoice) => sum + (invoice.paidAmount || 0),
          0
        );
        return {
          person,
          salesBase,
          purchasesBase,
          collected,
          balance: salesBase - purchasesBase - collected,
        };
      })
      .filter(row => row.salesBase || row.purchasesBase || row.collected)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
    return {
      sales,
      purchases,
      estimatedCost,
      grossProfit: sales - estimatedCost,
      inventoryValue: state.products.reduce(
        (sum, product) => sum + product.stock * product.price,
        0
      ),
      receivables,
    };
  }, [state]);
  const agingReport = useMemo(() => {
    const buckets = [
      { key: "0-30", label: "۰ تا ۳۰ روز" },
      { key: "31-60", label: "۳۱ تا ۶۰ روز" },
      { key: "61-90", label: "۶۱ تا ۹۰ روز" },
      { key: "90+", label: "بیش از ۹۰ روز" },
    ];
    const summary = buckets.map(bucket => ({
      ...bucket,
      receivable: 0,
      payable: 0,
      count: 0,
    }));
    state.invoices
      .filter(invoice => invoice.status !== "باطل")
      .forEach(invoice => {
        const outstanding = Math.max(
          0,
          invoice.amount - (invoice.paidAmount || 0)
        );
        if (!outstanding) return;
        const age = jalaliDayDifference(invoice.date, todayJalali());
        const index = age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3;
        summary[index].count += 1;
        if (invoice.type === "فروش") summary[index].receivable += outstanding;
        else summary[index].payable += outstanding;
      });
    return summary;
  }, [state]);
  const [statementPartyId, setStatementPartyId] = useState("");
  const statementRows = useMemo(() => {
    if (!statementPartyId) return [];
    const raw: Array<{
      id: string;
      date: string;
      reference: string;
      debit: number;
      credit: number;
      note: string;
    }> = [];
    state.invoices
      .filter(
        invoice =>
          invoice.partyId === statementPartyId && invoice.status !== "باطل"
      )
      .forEach(invoice =>
        raw.push({
          id: `statement-invoice-${invoice.id}`,
          date: invoice.date,
          reference: `فاکتور ${invoice.type} ${invoice.number}`,
          debit: invoice.type === "فروش" ? invoice.amount : 0,
          credit: invoice.type === "خرید" ? invoice.amount : 0,
          note: invoice.note || "",
        })
      );
    state.checks
      .filter(
        check => check.partyId === statementPartyId && check.status !== "باطل"
      )
      .forEach(check =>
        raw.push({
          id: `statement-check-${check.id}`,
          date: check.receivedDate || check.dueDate,
          reference: `چک دریافتی ${check.number}`,
          debit: ["برگشتی", "عودت داده شده"].includes(check.status)
            ? check.amount
            : 0,
          credit: ["برگشتی", "عودت داده شده"].includes(check.status)
            ? 0
            : check.amount,
          note: check.status,
        })
      );
    return raw
      .sort((a, b) =>
        jalaliDateKey(a.date).localeCompare(jalaliDateKey(b.date))
      )
      .map((row, index, all) => ({
        ...row,
        balance: all
          .slice(0, index + 1)
          .reduce((sum, item) => sum + item.debit - item.credit, 0),
      }));
  }, [statementPartyId, state]);
  function downloadStatement() {
    if (!statementPartyId || !statementRows.length) return;
    const person = state.people.find(item => item.id === statementPartyId);
    const csv = [
      "تاریخ,مرجع,بدهکار,بستانکار,مانده,شرح",
      ...statementRows.map(row =>
        [
          row.date,
          row.reference,
          row.debit,
          row.credit,
          row.balance,
          row.note,
        ].join(",")
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `statement-${person?.code || statementPartyId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
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
      <div className="panel table-panel aging-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">گزارش سررسید</span>
            <h3>سن مطالبات و بدهی فاکتورها</h3>
          </div>
          <span className="soft-tag">تا {todayJalali()}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>بازه</th>
                <th>تعداد سند</th>
                <th>مطالبات فروش</th>
                <th>بدهی خرید</th>
                <th>خالص باز</th>
              </tr>
            </thead>
            <tbody>
              {agingReport.map(row => (
                <tr key={row.key}>
                  <td>
                    <strong>{row.label}</strong>
                  </td>
                  <td>{formatNumber(row.count)}</td>
                  <td className="amount-negative">
                    {formatMoney(row.receivable, state.settings.currency)}
                  </td>
                  <td className="amount-positive">
                    {formatMoney(row.payable, state.settings.currency)}
                  </td>
                  <td>
                    {formatMoney(
                      row.receivable - row.payable,
                      state.settings.currency
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <section className="metric-grid profit-metric-grid">
        <MetricCard
          label="فروش معتبر"
          value={formatMoney(profitReport.sales, state.settings.currency)}
          helper="فاکتورهای فروش بدون ابطال"
          icon={<ArrowDownLeft size={20} />}
          tone="mint"
        />
        <MetricCard
          label="بهای تقریبی فروش"
          value={formatMoney(
            profitReport.estimatedCost,
            state.settings.currency
          )}
          helper="بر اساس قیمت پایه فعلی کالا"
          icon={<Boxes size={20} />}
          tone="amber"
        />
        <MetricCard
          label="سود ناخالص تقریبی"
          value={formatMoney(profitReport.grossProfit, state.settings.currency)}
          helper="فروش منهای بهای تقریبی"
          icon={<ChartNoAxesCombined size={20} />}
          tone={profitReport.grossProfit >= 0 ? "indigo" : "rose"}
        />
        <MetricCard
          label="ارزش موجودی"
          value={formatMoney(
            profitReport.inventoryValue,
            state.settings.currency
          )}
          helper="موجودی فعلی × قیمت پایه"
          icon={<WalletCards size={20} />}
          tone="violet"
        />
      </section>
      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">مطالبات و ماندهٔ طرف حساب</span>
            <h3>بدهکاران و بستانکاران</h3>
          </div>
          <span className="soft-tag">فاکتور معتبر و مبلغ تخصیص‌یافته</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>طرف حساب</th>
                <th>فروش</th>
                <th>خرید</th>
                <th>وصول/تسویه</th>
                <th>مانده</th>
              </tr>
            </thead>
            <tbody>
              {profitReport.receivables.length ? (
                profitReport.receivables.map(row => (
                  <tr key={row.person.id}>
                    <td>
                      <strong>{row.person.name}</strong>
                      <small className="muted-cell">{row.person.code}</small>
                    </td>
                    <td>
                      {formatMoney(row.salesBase, state.settings.currency)}
                    </td>
                    <td>
                      {formatMoney(row.purchasesBase, state.settings.currency)}
                    </td>
                    <td>
                      {formatMoney(row.collected, state.settings.currency)}
                    </td>
                    <td
                      className={
                        row.balance >= 0 ? "amount-negative" : "amount-positive"
                      }
                    >
                      {formatMoney(
                        Math.abs(row.balance),
                        state.settings.currency
                      )}{" "}
                      {row.balance >= 0 ? "بدهکار" : "بستانکار"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    برای طرف حساب‌ها فاکتور یا وصولی ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel table-panel customer-statement-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">صورت‌حساب تفصیلی</span>
            <h3>گردش کامل مشتری</h3>
          </div>
          <div className="panel-heading-actions">
            <button
              className="button button-ghost"
              onClick={() => window.print()}
            >
              چاپ
            </button>
            <button className="button button-ghost" onClick={downloadStatement}>
              خروجی CSV
            </button>
          </div>
        </div>
        <div className="statement-controls">
          <label>
            مشتری
            <select
              value={statementPartyId}
              onChange={event => setStatementPartyId(event.target.value)}
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
          </label>
          <span className="soft-tag">
            بدهکار: فروش · بستانکار: خرید و چک دریافتی
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>مرجع</th>
                <th>بدهکار</th>
                <th>بستانکار</th>
                <th>مانده تجمعی</th>
                <th>شرح</th>
              </tr>
            </thead>
            <tbody>
              {statementRows.length ? (
                statementRows.map(row => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date)}</td>
                    <td>
                      <strong>{row.reference}</strong>
                    </td>
                    <td>{formatMoney(row.debit, state.settings.currency)}</td>
                    <td>{formatMoney(row.credit, state.settings.currency)}</td>
                    <td
                      className={
                        row.balance >= 0 ? "amount-negative" : "amount-positive"
                      }
                    >
                      {formatMoney(
                        Math.abs(row.balance),
                        state.settings.currency
                      )}
                    </td>
                    <td>{row.note || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    مشتری را انتخاب کنید تا صورت‌حساب فاکتورها و چک‌های او نمایش
                    داده شود.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel ledger-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">دفتر معین و تفصیلی</span>
            <h3>گردش حساب و طرف حساب</h3>
          </div>
          <button
            className="button button-ghost"
            onClick={() => window.print()}
          >
            چاپ دفتر
          </button>
        </div>
        <div className="ledger-controls">
          <div className="segmented-control">
            <button
              className={ledgerMode === "account" ? "active" : ""}
              onClick={() => setLedgerMode("account")}
            >
              حساب‌ها
            </button>
            <button
              className={ledgerMode === "party" ? "active" : ""}
              onClick={() => setLedgerMode("party")}
            >
              طرف حساب‌ها
            </button>
          </div>
          {ledgerMode === "account" ? (
            <select
              value={ledgerAccountId}
              onChange={event => setLedgerAccountId(event.target.value)}
            >
              <option value="">انتخاب بانک، صندوق یا شریک</option>
              {state.accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.type}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={ledgerPartyId}
              onChange={event => setLedgerPartyId(event.target.value)}
            >
              <option value="">انتخاب طرف حساب</option>
              {state.people.map(person => (
                <option key={person.id} value={person.id}>
                  {person.code} · {person.name}
                </option>
              ))}
            </select>
          )}
          <strong
            className={
              ledgerBalance >= 0 ? "amount-positive" : "amount-negative"
            }
          >
            مانده:{" "}
            {formatMoney(Math.abs(ledgerBalance), state.settings.currency)}
          </strong>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>شرح</th>
                <th>افزایش</th>
                <th>کاهش</th>
                <th>مانده</th>
              </tr>
            </thead>
            <tbody>
              {ledgerRows.length ? (
                (() => {
                  let running = 0;
                  return ledgerRows.map(row => {
                    running += row.increase - row.decrease;
                    return (
                      <tr key={row.id}>
                        <td>{formatDate(row.date)}</td>
                        <td>
                          <strong>{row.title}</strong>
                          <small className="muted-cell">{row.note}</small>
                        </td>
                        <td className="amount-positive">
                          {row.increase
                            ? formatMoney(row.increase, state.settings.currency)
                            : "—"}
                        </td>
                        <td className="amount-negative">
                          {row.decrease
                            ? formatMoney(row.decrease, state.settings.currency)
                            : "—"}
                        </td>
                        <td>
                          {formatMoney(
                            Math.abs(running),
                            state.settings.currency
                          )}{" "}
                          {running < 0 ? "(کاهش)" : "(افزایش)"}
                        </td>
                      </tr>
                    );
                  });
                })()
              ) : (
                <tr>
                  <td colSpan={5}>
                    برای مشاهدهٔ دفتر، حساب یا طرف حساب را انتخاب کنید.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">دفتر جریان نقدی</span>
            <h3>ورودی و خروجی به تفکیک حساب</h3>
          </div>
          <span className="status-pill status-success">
            {formatNumber(cashRows.length)} ردیف
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>نوع</th>
                <th>طرف حساب</th>
                <th>حساب</th>
                <th>ورودی</th>
                <th>خروجی</th>
              </tr>
            </thead>
            <tbody>
              {cashRows.length ? (
                cashRows.slice(0, 30).map(row => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date)}</td>
                    <td>{transactionLabel(row.type)}</td>
                    <td>{row.partyName}</td>
                    <td>{row.accountName}</td>
                    <td className="amount-positive">
                      {row.incoming
                        ? formatMoney(row.amount, state.settings.currency)
                        : "—"}
                    </td>
                    <td className="amount-negative">
                      {row.incoming
                        ? "—"
                        : formatMoney(row.amount, state.settings.currency)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>هنوز گردش نقدی ثبت نشده است.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {cashRows.length > 30 && (
          <small className="muted-cell">
            ۳۰ ردیف اخیر نمایش داده شد؛ دفتر عملیات منبع کامل داده است.
          </small>
        )}
      </div>
      <div className="panel insight-panel">
        <div className="mini-icon amber">
          <ShieldCheck size={18} />
        </div>
        <div>
          <strong>کنترل تداخل فاکتور و عملیات مستقیم</strong>
          <p>
            {possibleDuplicates.length
              ? `${formatNumber(possibleDuplicates.length)} عملیات خرید/فروش مستقیم با یک فاکتور مشابه شناسایی شد؛ برای جلوگیری از دوباره‌شماری، فقط یکی از آن‌ها را مرجع اصلی قرار دهید.`
              : "مورد مشابهی بین عملیات مستقیم خرید/فروش و فاکتورهای معتبر پیدا نشد."}
          </p>
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

function Production({
  state,
  onSave,
}: {
  state: AppState;
  onSave: (next: AppState, message: string) => void;
}) {
  const rawWarehouses = state.warehouses.filter(warehouse =>
    warehouse.name.includes("مواد")
  );
  const outputWarehouses = state.warehouses.filter(warehouse =>
    warehouse.name.includes("محصول")
  );
  const rawProducts = state.products.filter(product => {
    const warehouse = state.warehouses.find(
      item => item.id === product.warehouseId
    );
    return (
      product.category === "مواد اولیه" ||
      product.category === "بسته تولید" ||
      warehouse?.name.includes("مواد")
    );
  });
  const outputProducts = state.products.filter(product => {
    const warehouse = state.warehouses.find(
      item => item.id === product.warehouseId
    );
    return (
      warehouse?.name.includes("محصول") || product.category === "محصول تولیدی"
    );
  });
  const blankMaterial: ProductionMaterial = {
    id: createId("material"),
    productId: "",
    quantity: 0,
    unit: "",
  };
  const blankCost: ProductionCost = {
    id: createId("cost"),
    title: "",
    amount: 0,
  };
  const [form, setForm] = useState({
    name: "",
    formulaType: "قطعه" as "قطعه" | "بسته تولید",
    outputProductId: "",
    outputQuantity: "1",
    outputUnit: "",
    materials: [blankMaterial],
    costs: [blankCost],
    note: "",
    packageOutput: false,
  });
  const [selectedFormulaId, setSelectedFormulaId] = useState("");
  const [productionDialog, setProductionDialog] = useState<{
    formula: ProductionFormula;
    quantity: string;
    unit: string;
  } | null>(null);
  const selectedOutput = state.products.find(
    product => product.id === form.outputProductId
  );
  const unitPrice = (productId: string, unit: string) => {
    const product = state.products.find(item => item.id === productId);
    if (!product) return 0;
    const history = state.priceHistory
      .filter(
        item =>
          item.productId === productId && item.effectiveDate <= todayJalali()
      )
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
    return Number(history[0]?.price ?? product.price) || 0;
  };
  const materialCost = form.materials.reduce((sum, material) => {
    const product = state.products.find(item => item.id === material.productId);
    const conversion = product
      ? unitConversionToBase(product, material.unit)
      : 1;
    return (
      sum +
      (Number(material.quantity) || 0) *
        conversion *
        unitPrice(material.productId, material.unit)
    );
  }, 0);
  const overheadCost = form.costs.reduce(
    (sum, cost) => sum + (Number(cost.amount) || 0),
    0
  );
  const totalCost = materialCost + overheadCost;
  const formulaCostPerUnit =
    totalCost / Math.max(1, Number(form.outputQuantity) || 1);
  const currentFormulaCost = (formula: ProductionFormula) => {
    const materialTotal = formula.materials.reduce((sum, material) => {
      const product = state.products.find(
        item => item.id === material.productId
      );
      return (
        sum +
        (product
          ? quantityInBase(product, material.quantity, material.unit)
          : 0) *
          unitPrice(material.productId, material.unit)
      );
    }, 0);
    const overhead = formula.costs.reduce(
      (sum, cost) => sum + (Number(cost.amount) || 0),
      0
    );
    return (materialTotal + overhead) / Math.max(1, formula.outputQuantity);
  };

  function saveProduction(event: React.FormEvent) {
    event.preventDefault();
    const quantity = Number(form.outputQuantity) || 0;
    const materials = form.materials.filter(
      item => item.productId && Number(item.quantity) > 0
    );
    if (
      !form.name.trim() ||
      (form.formulaType === "قطعه" && !form.outputProductId) ||
      quantity <= 0 ||
      !materials.length
    )
      return;
    const insufficient = materials.find(material => {
      const product = state.products.find(
        item => item.id === material.productId
      );
      return (
        (product?.stock || 0) <
        (product
          ? quantityInBase(product, material.quantity, material.unit)
          : 0)
      );
    });
    if (insufficient) {
      window.alert("موجودی یکی از مواد اولیه کافی نیست.");
      return;
    }
    const outputProduct =
      selectedOutput ||
      (form.formulaType === "بسته تولید"
        ? {
            id: createId("package"),
            code: `PKG-${Date.now()}`,
            name: form.name.trim(),
            unit: form.outputUnit || "کیلوگرم",
            unit2: form.outputUnit || "کیلوگرم",
            conversionRate: 1,
            warehouseId: rawWarehouses[0]?.id,
            stock: 0,
            minStock: 0,
            price: formulaCostPerUnit,
            category: "بسته تولید" as const,
          }
        : undefined);
    if (!outputProduct) return;
    const outputQuantityBase = quantityInBase(
      outputProduct,
      quantity,
      form.outputUnit || outputProduct.unit
    );
    const formula: ProductionFormula = {
      id: selectedFormulaId || createId("formula"),
      name: form.name.trim(),
      formulaType: form.formulaType,
      outputProductId: outputProduct.id,
      outputName: outputProduct.name,
      outputQuantity: quantity,
      outputUnit: form.outputUnit || selectedOutput?.unit || "عدد",
      materials,
      costs: form.costs.filter(
        item => item.title.trim() && Number(item.amount) > 0
      ),
      note: form.note,
    };
    const rawIds = new Set(materials.map(item => item.productId));
    let products = state.products.map(product => {
      const material = materials.find(item => item.productId === product.id);
      if (material) {
        const conversion = unitConversionToBase(product, material.unit);
        return {
          ...product,
          stock:
            product.stock -
            quantityInBase(product, material.quantity, material.unit),
        };
      }
      if (product.id === outputProduct.id) {
        return {
          ...product,
          stock: product.stock + outputQuantityBase,
          category: (form.formulaType === "بسته تولید"
            ? "بسته تولید"
            : "محصول تولیدی") as Product["category"],
          warehouseId:
            form.formulaType === "بسته تولید"
              ? rawWarehouses[0]?.id || product.warehouseId
              : product.warehouseId,
          price: formulaCostPerUnit,
        };
      }
      return product;
    });
    if (!selectedOutput && form.formulaType === "بسته تولید")
      products = [outputProduct, ...products];
    const record = {
      id: createId("production"),
      formulaId: formula.id,
      date: todayJalali(),
      outputQuantity: quantity,
      outputQuantityBase,
      materialCost,
      overheadCost,
      totalCost,
      unitCost: formulaCostPerUnit,
      note: form.note,
    };
    onSave(
      {
        ...state,
        products,
        productionFormulas: selectedFormulaId
          ? state.productionFormulas.map(item =>
              item.id === selectedFormulaId ? formula : item
            )
          : [...state.productionFormulas, formula],
        productionRecords: [...state.productionRecords, record],
      },
      "فرمول و عملیات تولید ثبت شد"
    );
    setForm({
      name: "",
      formulaType: "قطعه",
      outputProductId: "",
      outputQuantity: "1",
      outputUnit: "",
      materials: [{ ...blankMaterial, id: createId("material") }],
      costs: [{ ...blankCost, id: createId("cost") }],
      note: "",
      packageOutput: false,
    });
  }

  function loadFormula(formula: ProductionFormula) {
    setSelectedFormulaId(formula.id);
    setForm({
      name: formula.name,
      formulaType: formula.formulaType || "قطعه",
      outputProductId: formula.outputProductId || "",
      outputQuantity: String(formula.outputQuantity),
      outputUnit: formula.outputUnit,
      materials: formula.materials,
      costs: formula.costs.length
        ? formula.costs
        : [{ ...blankCost, id: createId("cost") }],
      note: formula.note,
      packageOutput: false,
    });
  }

  function deleteFormula(formula: ProductionFormula) {
    if (!window.confirm(`فرمول ${formula.name} و سوابق تولید آن حذف شود؟`))
      return;
    const records = state.productionRecords.filter(
      record => record.formulaId === formula.id
    );
    const products = state.products.map(product => {
      let stock = product.stock;
      if (product.id === formula.outputProductId) {
        stock -= records.reduce(
          (sum, record) =>
            sum + (record.outputQuantityBase ?? record.outputQuantity),
          0
        );
      }
      for (const material of formula.materials.filter(
        item => item.productId === product.id
      )) {
        stock +=
          records.length *
          quantityInBase(product, material.quantity, material.unit);
      }
      return { ...product, stock };
    });
    onSave(
      {
        ...state,
        products,
        productionFormulas: state.productionFormulas.filter(
          item => item.id !== formula.id
        ),
        productionRecords: state.productionRecords.filter(
          item => item.formulaId !== formula.id
        ),
      },
      `فرمول ${formula.name} و سوابق تولید آن حذف شد`
    );
    if (selectedFormulaId === formula.id) setSelectedFormulaId("");
  }

  function produceFormula(event: React.FormEvent) {
    event.preventDefault();
    if (!productionDialog) return;
    try {
      const quantity = Number(productionDialog.quantity);
      const next = executeProduction(
        state,
        productionDialog.formula.id,
        quantity,
        productionDialog.unit
      ).state;
      onSave(next, `تولید ${productionDialog.formula.name} ثبت شد`);
      setProductionDialog(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "تولید انجام نشد");
    }
  }

  return (
    <div className="page-stack page-enter">
      <PageIntro
        kicker="فرمول و بهای ساخت"
        title="تولید"
        description="مواد اولیه را از انبار مصرف کنید، بسته‌های نیمه‌آماده بسازید و هزینهٔ تمام‌شده را محاسبه کنید."
      />
      <div className="production-layout">
        <form className="panel production-form" onSubmit={saveProduction}>
          <div className="section-heading">
            <div>
              <span className="section-kicker">ثبت تولید</span>
              <h3>فرمول جدید و تولید محصول</h3>
            </div>
            <span className="status-pill">
              بهای ساخت: {formatMoney(totalCost, state.settings.currency)}
            </span>
          </div>
          <div className="form-grid">
            <label className="full-field">
              نام فرمول
              <input
                value={form.name}
                onChange={event =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="مثلاً فرمول تولید لقمه Z"
              />
            </label>
            <label>
              نوع فرمول
              <select
                value={form.formulaType}
                onChange={event =>
                  setForm({
                    ...form,
                    formulaType: event.target.value as "قطعه" | "بسته تولید",
                    outputProductId:
                      event.target.value === "بسته تولید"
                        ? ""
                        : form.outputProductId,
                  })
                }
              >
                <option value="قطعه">فرمول قطعه</option>
                <option value="بسته تولید">فرمول بسته مستقل</option>
              </select>
            </label>
            <label>
              {form.formulaType === "بسته تولید"
                ? "بسته در انبار مواد اولیه ذخیره می‌شود"
                : "محصول نهایی از انبار محصولات"}
              <select
                value={form.outputProductId}
                disabled={form.formulaType === "بسته تولید"}
                onChange={event => {
                  const product = state.products.find(
                    item => item.id === event.target.value
                  );
                  setForm({
                    ...form,
                    outputProductId: event.target.value,
                    outputUnit: product?.unit || "",
                  });
                }}
              >
                <option value="">
                  {form.formulaType === "بسته تولید"
                    ? "خودکار از نام فرمول"
                    : "انتخاب محصول"}
                </option>
                {outputProducts.map(product => (
                  <option value={product.id} key={product.id}>
                    {product.name} · {product.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              مقدار تولید
              <input
                inputMode="decimal"
                value={form.outputQuantity}
                onChange={event =>
                  setForm({ ...form, outputQuantity: event.target.value })
                }
              />
            </label>
            <label>
              واحد تولید
              <select
                value={form.outputUnit}
                onChange={event =>
                  setForm({ ...form, outputUnit: event.target.value })
                }
              >
                <option value="">واحد پایه</option>
                {Array.from(
                  new Set(
                    (selectedOutput
                      ? [selectedOutput.unit, selectedOutput.unit2]
                      : []
                    ).concat(state.settings.units)
                  )
                )
                  .filter(Boolean)
                  .map(unit => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="production-section">
            <div className="tier-editor-head">
              <strong>مواد اولیه و بسته‌های نیمه‌آماده</strong>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setForm({
                    ...form,
                    materials: [
                      ...form.materials,
                      { ...blankMaterial, id: createId("material") },
                    ],
                  })
                }
              >
                <Plus size={14} /> افزودن ماده
              </button>
            </div>
            {form.materials.map((material, index) => {
              const product = state.products.find(
                item => item.id === material.productId
              );
              return (
                <div className="production-row" key={material.id}>
                  <select
                    value={material.productId}
                    onChange={event => {
                      const item = state.products.find(
                        product => product.id === event.target.value
                      );
                      const materials = [...form.materials];
                      materials[index] = {
                        ...material,
                        productId: event.target.value,
                        unit: item?.unit || "",
                      };
                      setForm({ ...form, materials });
                    }}
                  >
                    <option value="">انتخاب از انبار مواد اولیه</option>
                    {rawProducts.map(item => (
                      <option value={item.id} key={item.id}>
                        {item.name} · موجودی {formatNumber(item.stock)}
                      </option>
                    ))}
                  </select>
                  <input
                    inputMode="decimal"
                    value={material.quantity || ""}
                    onChange={event => {
                      const materials = [...form.materials];
                      materials[index] = {
                        ...material,
                        quantity: Number(event.target.value) || 0,
                      };
                      setForm({ ...form, materials });
                    }}
                    placeholder="مقدار مصرف"
                  />
                  <select
                    value={material.unit}
                    onChange={event => {
                      const materials = [...form.materials];
                      materials[index] = {
                        ...material,
                        unit: event.target.value,
                      };
                      setForm({ ...form, materials });
                    }}
                  >
                    {Array.from(
                      new Set([
                        product?.unit,
                        product?.unit2,
                        ...state.settings.units,
                      ])
                    )
                      .filter(Boolean)
                      .map(unit => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                  </select>
                  <strong>
                    {formatMoney(
                      (Number(material.quantity) || 0) *
                        (product
                          ? unitConversionToBase(product, material.unit)
                          : 1) *
                        unitPrice(material.productId, material.unit),
                      state.settings.currency
                    )}
                  </strong>
                  {form.materials.length > 1 && (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() =>
                        setForm({
                          ...form,
                          materials: form.materials.filter(
                            item => item.id !== material.id
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="production-section">
            <div className="tier-editor-head">
              <strong>هزینه‌های سربار</strong>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setForm({
                    ...form,
                    costs: [
                      ...form.costs,
                      { ...blankCost, id: createId("cost") },
                    ],
                  })
                }
              >
                <Plus size={14} /> افزودن هزینه
              </button>
            </div>
            {form.costs.map((cost, index) => (
              <div className="production-row" key={cost.id}>
                <input
                  value={cost.title}
                  onChange={event => {
                    const costs = [...form.costs];
                    costs[index] = { ...cost, title: event.target.value };
                    setForm({ ...form, costs });
                  }}
                  placeholder="برق، اجاره، کارگر و..."
                />
                <input
                  inputMode="numeric"
                  value={cost.amount || ""}
                  onChange={event => {
                    const costs = [...form.costs];
                    costs[index] = {
                      ...cost,
                      amount: Number(event.target.value) || 0,
                    };
                    setForm({ ...form, costs });
                  }}
                  placeholder="مبلغ"
                />
                {form.costs.length > 1 && (
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() =>
                      setForm({
                        ...form,
                        costs: form.costs.filter(item => item.id !== cost.id),
                      })
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <label className="full-field">
            توضیحات
            <textarea
              value={form.note}
              onChange={event => setForm({ ...form, note: event.target.value })}
              placeholder="توضیحات فرایند یا بچ تولید"
            />
          </label>
          <div className="production-total">
            <span>
              مواد: {formatMoney(materialCost, state.settings.currency)}
            </span>
            <span>
              سربار: {formatMoney(overheadCost, state.settings.currency)}
            </span>
            <strong>
              هزینه کل: {formatMoney(totalCost, state.settings.currency)} · هر
              واحد: {formatMoney(formulaCostPerUnit, state.settings.currency)}
            </strong>
          </div>
          <button className="button button-primary" type="submit">
            <Check size={16} /> ثبت فرمول و تولید
          </button>
        </form>
        <div className="panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">سوابق</span>
              <h3>فرمول‌های ثبت‌شده</h3>
            </div>
          </div>
          {state.productionFormulas.length ? (
            state.productionFormulas.map(formula => {
              const product = state.products.find(
                item => item.id === formula.outputProductId
              );
              const record = state.productionRecords
                .filter(item => item.formulaId === formula.id)
                .at(-1);
              return (
                <div
                  className={`production-card ${selectedFormulaId === formula.id ? "selected" : ""}`}
                  key={formula.id}
                >
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => loadFormula(formula)}
                  >
                    <strong>{formula.name}</strong>
                  </button>
                  <span>
                    {product?.name || formula.outputName || "بسته مستقل"} ·{" "}
                    {formatNumber(formula.materials.length)} ماده اولیه
                  </span>
                  <small>
                    {formula.formulaType === "بسته تولید"
                      ? "بسته مستقل · انبار مواد اولیه"
                      : "فرمول قطعه"}
                  </small>
                  {record && (
                    <small>
                      بهای جاری با قیمت مواد:{" "}
                      {formatMoney(
                        currentFormulaCost(formula),
                        state.settings.currency
                      )}
                    </small>
                  )}
                  <button
                    type="button"
                    className="button button-primary button-small"
                    onClick={() =>
                      setProductionDialog({
                        formula,
                        quantity: String(formula.outputQuantity),
                        unit: formula.outputUnit,
                      })
                    }
                  >
                    <Plus size={14} /> تولید
                  </button>
                  <button
                    type="button"
                    className="icon-button row-action"
                    title="حذف فرمول"
                    onClick={() => deleteFormula(formula)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          ) : (
            <EmptyState
              title="فرمولی ثبت نشده"
              description="اولین فرمول تولید را با افزودن مواد اولیه و هزینه‌های سربار بسازید."
            />
          )}
        </div>
      </div>
      {productionDialog && (
        <Dialog
          title={`تولید: ${productionDialog.formula.name}`}
          onClose={() => setProductionDialog(null)}
        >
          <form className="form-grid" onSubmit={produceFormula}>
            <label>
              مقدار تولید
              <input
                inputMode="decimal"
                value={productionDialog.quantity}
                onChange={event =>
                  setProductionDialog({
                    ...productionDialog,
                    quantity: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              واحد خروجی
              <select
                value={productionDialog.unit}
                onChange={event =>
                  setProductionDialog({
                    ...productionDialog,
                    unit: event.target.value,
                  })
                }
              >
                {[
                  productionDialog.formula.outputUnit,
                  "عدد",
                  "کارتن",
                  "کیلوگرم",
                  "گرم",
                ]
                  .filter(
                    (unit, index, units) =>
                      unit && units.indexOf(unit) === index
                  )
                  .map(unit => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
              </select>
            </label>
            <p className="muted-cell">
              مواد اولیه طبق فرمول مصرف می‌شوند. اگر مادهٔ اولیه خود محصول یک
              فرمول باشد، مقدار لازم از آن فرمول ابتدا تولید خواهد شد.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setProductionDialog(null)}
              >
                انصراف
              </button>
              <button className="button button-primary" type="submit">
                <Check size={16} /> ثبت تولید
              </button>
            </div>
          </form>
        </Dialog>
      )}
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
  const [units, setUnits] = useState(state.settings.units);
  const [unitDraft, setUnitDraft] = useState("");
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  const [unitsOpen, setUnitsOpen] = useState(false);
  function saveUnit() {
    const value = unitDraft.trim();
    if (!value) return;
    if (editingUnit) {
      setUnits(current =>
        current.map(unit => (unit === editingUnit ? value : unit))
      );
    } else if (!units.includes(value)) {
      setUnits(current => [...current, value]);
    }
    setUnitDraft("");
    setEditingUnit(null);
  }
  return (
    <div className="page-stack page-enter">
      <PageIntro
        kicker="تنظیمات برنامه"
        title="مشخصات و تنظیمات کارگاه"
        description="تنظیمات عمومی برنامه مستقل از عملیات بکاپ و بازیابی مدیریت می‌شود."
      />
      <div className="panel settings-panel">
        <div className="backup-hero">
          <div className="backup-hero-icon">
            <Settings2 size={25} />
          </div>
          <div>
            <span className="section-kicker">تنظیمات عمومی</span>
            <h3>اطلاعات پایه کارگاه</h3>
            <p>
              این بخش فقط مشخصات و تنظیمات محاسباتی را تغییر می‌دهد؛ برای ذخیره
              و بازیابی داده به صفحهٔ «پشتیبان و بازیابی» بروید.
            </p>
          </div>
        </div>
        <div className="settings-form">
          <label>
            نام کارگاه
            <input
              value={businessName}
              onChange={event => setBusinessName(event.target.value)}
            />
          </label>
          <label>
            واحد پول
            <input
              value={currency}
              onChange={event => setCurrency(event.target.value)}
            />
          </label>
          <label>
            مبنای روزشمار سود
            <select
              value={dayBasis}
              onChange={event => setDayBasis(event.target.value)}
            >
              <option value="شمسی">تقویم شمسی واقعی (۳۱، ۳۰، ۲۹/۳۰)</option>
              <option value="30">ماه ثابت ۳۰ روزه</option>
              <option value="365">سال ثابت ۳۶۵ روزه</option>
            </select>
          </label>
        </div>
        <div className="settings-units">
          <button
            className="settings-folder"
            onClick={() => setUnitsOpen(open => !open)}
          >
            <div className="settings-folder-icon">
              <Boxes size={20} />
            </div>
            <div>
              <span className="section-kicker">واحدهای کالا</span>
              <h3>مدیریت واحدها</h3>
              <small>
                {formatNumber(units.length)} واحد ثبت شده · برای ورود انتخاب
                کنید
              </small>
            </div>
            <ChevronDown
              className={unitsOpen ? "folder-chevron open" : "folder-chevron"}
              size={18}
            />
          </button>
          {unitsOpen && (
            <div className="settings-units-content">
              <div className="unit-manager-form">
                <input
                  placeholder="نام واحد جدید"
                  value={unitDraft}
                  onChange={event => setUnitDraft(event.target.value)}
                />
                <button
                  className="button button-primary button-small"
                  onClick={saveUnit}
                >
                  {editingUnit ? "ذخیره اصلاح" : "افزودن واحد"}
                </button>
                {editingUnit && (
                  <button
                    className="button button-ghost button-small"
                    onClick={() => {
                      setEditingUnit(null);
                      setUnitDraft("");
                    }}
                  >
                    انصراف
                  </button>
                )}
              </div>
              <div className="unit-list">
                {units.map(unit => (
                  <div className="unit-row" key={unit}>
                    <span>{unit}</span>
                    <div>
                      <button
                        className="icon-button row-action"
                        title="ویرایش واحد"
                        onClick={() => {
                          setEditingUnit(unit);
                          setUnitDraft(unit);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="icon-button row-action"
                        title="حذف واحد"
                        onClick={() => {
                          if (
                            units.length > 1 &&
                            window.confirm(`واحد ${unit} حذف شود؟`)
                          )
                            setUnits(current =>
                              current.filter(item => item !== unit)
                            );
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="form-actions">
          <button
            className="button button-primary"
            onClick={() =>
              onSave(
                {
                  ...state,
                  settings: {
                    ...state.settings,
                    businessName: businessName.trim() || "کارگاه من",
                    currency: currency.trim() || "ریال",
                    dayBasis:
                      dayBasis === "شمسی"
                        ? "شمسی"
                        : Math.max(1, Number(dayBasis) || 30),
                    units,
                  },
                },
                "تنظیمات برنامه ذخیره شد"
              )
            }
          >
            ذخیره تنظیمات
          </button>
        </div>
      </div>
    </div>
  );
}

function BackupPage({
  state,
  onExport,
  onImport,
  onManualImport,
  onClearAll,
  onDriveRestore,
  onDriveUpload,
  driveBackups,
  driveLoading,
  onDriveRefresh,
  driveClientId,
  onDriveConnect,
}: {
  state: AppState;
  onExport: () => void;
  onImport: () => void;
  onManualImport: (payload: string) => void;
  onClearAll: () => void;
  onDriveRestore: (fileId?: string) => void;
  onDriveUpload: () => void;
  driveBackups: DriveBackupFile[];
  driveLoading: boolean;
  onDriveRefresh: () => void;
  driveClientId: string;
  onDriveConnect: (clientId: string) => void;
}) {
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [manualPayload, setManualPayload] = useState("");
  const [driveQuery, setDriveQuery] = useState("");
  const [driveSort, setDriveSort] = useState<"newest" | "oldest" | "largest">(
    "newest"
  );
  const [clientIdDraft, setClientIdDraft] = useState(driveClientId);
  const recordCount =
    state.people.length +
    state.products.length +
    state.transactions.length +
    state.checks.length +
    state.invoices.length;
  const visibleDriveBackups = useMemo(
    () =>
      driveBackups
        .filter(file =>
          file.name.toLowerCase().includes(driveQuery.trim().toLowerCase())
        )
        .sort((a, b) => {
          if (driveSort === "largest")
            return Number(b.size || 0) - Number(a.size || 0);
          const aTime = a.modifiedTime || "";
          const bTime = b.modifiedTime || "";
          return driveSort === "newest"
            ? bTime.localeCompare(aTime)
            : aTime.localeCompare(bTime);
        }),
    [driveBackups, driveQuery, driveSort]
  );
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
                فایل JSON خروجی بگیرید. این فایل شامل همهٔ اطلاعات ورودی و
                تنظیمات قابل انتقال به نسخه‌های بعدی برنامه است.
              </p>
            </div>
          </div>
          <div className="backup-scope-note">
            <strong>محتوای کامل پشتیبان</strong>
            <span>
              طرف حساب‌ها، کالاها، انبارها، تاریخچه قیمت، شرایط پرداخت،
              فاکتورها، عملیات مالی، چک‌ها، حساب‌های بانکی، تنظیمات و حسابرسی
            </span>
            <small>
              نسخهٔ قالب پشتیبان: ۲ · بازیابی با نرمال‌سازی و مهاجرت نسخه‌ای
            </small>
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
          <div className="manual-restore-box">
            <strong>بازیابی دستی در گوشی یا مرورگر دیگر</strong>
            <p>
              اگر Drive در این مرورگر مجوز موقت ندارد، فایل JSON را از Drive
              دانلود کنید و متن آن را اینجا بچسبانید.
            </p>
            <textarea
              value={manualPayload}
              onChange={event => setManualPayload(event.target.value)}
              placeholder="محتوای فایل backup-accounting-....json را اینجا Paste کنید"
              rows={4}
            />
            <button
              className="button button-primary"
              disabled={!manualPayload.trim()}
              onClick={() => onManualImport(manualPayload)}
            >
              اعتبارسنجی و بازیابی متن
            </button>
          </div>
          <div className="danger-zone">
            <div>
              <strong>حذف همه اطلاعات کسب‌وکار</strong>
              <small>
                ابتدا یک فایل JSON دانلود می‌شود؛ سپس طرف حساب‌ها، کالاها،
                فاکتورها، عملیات و چک‌ها پاک می‌شوند.
              </small>
            </div>
            <button
              className="button button-danger"
              onClick={() => {
                setClearOpen(true);
                setConfirmation("");
              }}
            >
              <Trash2 size={15} /> حذف همه اطلاعات
            </button>
          </div>
          {clearOpen && (
            <div className="clear-confirm-panel">
              <strong>این عملیات قابل بازگشت مستقیم نیست</strong>
              <p>
                برای ادامه عبارت <b>حذف کامل</b> را وارد کنید. قبل از پاک‌سازی،
                بکاپ JSON به‌صورت خودکار دانلود خواهد شد.
              </p>
              <input
                value={confirmation}
                onChange={event => setConfirmation(event.target.value)}
                placeholder="حذف کامل"
                aria-label="تأیید حذف کامل"
              />
              <div className="form-actions">
                <button
                  className="button button-ghost"
                  onClick={() => setClearOpen(false)}
                >
                  انصراف
                </button>
                <button
                  className="button button-danger"
                  disabled={confirmation !== "حذف کامل"}
                  onClick={() => {
                    onClearAll();
                    setClearOpen(false);
                  }}
                >
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
          <span className="section-kicker">اتصال ابری اختیاری</span>
          <h3>پشتیبان روی Google Drive</h3>
          <p>
            این قابلیت فقط زمانی کار می‌کند که همین مرورگر مجوز OAuth موقت Drive
            داشته باشد. پشتیبان محلی همچنان بدون وابستگی به اینترنت کار می‌کند.
          </p>
          <div className="drive-auth-box">
            <strong>اتصال امن این مرورگر</strong>
            <small>
              Client ID از نوع Web را از Google Cloud وارد کنید؛ این مقدار رمز
              نیست و توکن دسترسی در فایل پشتیبان ذخیره نمی‌شود.
            </small>
            <input
              value={clientIdDraft}
              onChange={event => setClientIdDraft(event.target.value)}
              placeholder="Google OAuth Web Client ID"
              dir="ltr"
            />
            <button
              className="button button-primary"
              onClick={() => onDriveConnect(clientIdDraft)}
              disabled={!clientIdDraft.trim()}
            >
              اتصال به Google Drive
            </button>
            <small>
              دسترسی در هر نشست کوتاه‌مدت است؛ در صورت انقضا دوباره اتصال را
              بزنید.
            </small>
          </div>
          <div className="drive-path-card">
            <strong>حسابداری کارگاه — پشتیبان‌های PWA</strong>
            <small>زیرپوشه: نسخه‌های پشتیبان JSON</small>
          </div>
          <div className="form-actions">
            <button className="button button-primary" onClick={onDriveUpload}>
              <CloudUpload size={15} /> ذخیره در Drive
            </button>
            <button
              className="button button-ghost"
              onClick={onDriveRefresh}
              disabled={driveLoading}
            >
              <RefreshCw size={15} className={driveLoading ? "spin" : ""} />{" "}
              {driveLoading ? "در حال خواندن" : "تازه‌سازی فهرست"}
            </button>
            <a
              className="button button-primary"
              href={PROJECT_BACKUPS_FOLDER_URL}
              target="_blank"
              rel="noreferrer"
            >
              مشاهده نسخه‌های پشتیبان
            </a>
            <a
              className="button button-ghost"
              href={PROJECT_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noreferrer"
            >
              پوشه اصلی پروژه
            </a>
          </div>
          <div className="drive-backup-list">
            <div className="drive-list-toolbar">
              <input
                value={driveQuery}
                onChange={event => setDriveQuery(event.target.value)}
                placeholder="جست‌وجوی نام فایل"
                aria-label="جست‌وجوی نسخه پشتیبان"
              />
              <select
                value={driveSort}
                onChange={event =>
                  setDriveSort(event.target.value as typeof driveSort)
                }
                aria-label="مرتب‌سازی نسخه‌ها"
              >
                <option value="newest">جدیدترین</option>
                <option value="oldest">قدیمی‌ترین</option>
                <option value="largest">بیشترین حجم</option>
              </select>
            </div>
            {visibleDriveBackups.map(file => (
              <div className="drive-backup-row" key={file.id}>
                <div>
                  <strong>{file.name}</strong>
                  <small>
                    {file.modifiedTime
                      ? formatDate(file.modifiedTime.slice(0, 10))
                      : "نسخهٔ پشتیبان"}{" "}
                    · {formatNumber(Number(file.size) || 0)} بایت
                  </small>
                </div>
                <button
                  className="button button-primary"
                  onClick={() => onDriveRestore(file.id)}
                >
                  بازیابی
                </button>
              </div>
            ))}
            {!visibleDriveBackups.length && (
              <small className="drive-empty">
                نسخه‌ای با این نام پیدا نشد.
              </small>
            )}
          </div>
          <span className="coming-tag">
            نام نسخه‌های جدید: تاریخ شمسی امروز ({todayJalali()}) + شمارهٔ ردیف
            سه‌رقمی؛ نسخه‌های قبلی حذف نمی‌شوند.
          </span>
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
          <JalaliDatePicker
            value={form.date}
            onChange={date => setForm({ ...form, date })}
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
