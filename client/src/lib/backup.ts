import {
  exportPayload,
  importPayload,
  type AppState,
} from "./accounting";
import {
  exportVendorDirectory,
  importVendorDirectory,
  type VendorDirectoryState,
} from "./vendorDirectory";

export const UNIFIED_BACKUP_FORMAT = "accounting-workshop-unified-backup-v1";

export type UnifiedBackupEnvelope = {
  format: typeof UNIFIED_BACKUP_FORMAT;
  backupId: string;
  createdAt: string;
  application: "حسابداری کارگاه";
  sections: {
    accounting: Record<string, unknown>;
    vendorDirectory: Record<string, unknown>;
  };
  counts: {
    accounting: Record<string, number>;
    vendorDirectory: { vendors: number; quotes: number };
  };
};

export type ImportedBackup = {
  accounting: AppState;
  vendorDirectory?: VendorDirectoryState;
  unified: boolean;
};

function createBackupId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `backup-${random}`;
}

function parseJsonObject(payload: string) {
  const parsed: unknown = JSON.parse(payload);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("ساختار فایل پشتیبان معتبر نیست");
  }
  return parsed as Record<string, unknown>;
}

function countVendorDirectory(directory: VendorDirectoryState) {
  return {
    vendors: directory.vendors.length,
    quotes: directory.quotes.length,
  };
}

export function exportUnifiedPayload(
  accounting: AppState,
  vendorDirectory: VendorDirectoryState
) {
  const accountingPayload = parseJsonObject(exportPayload(accounting));
  const vendorPayload = parseJsonObject(exportVendorDirectory(vendorDirectory));
  const accountingData = accountingPayload.data;
  const vendorData = vendorPayload.data;
  const accountingCollections = accountingPayload.collections;

  if (
    !accountingData || typeof accountingData !== "object" ||
    !vendorData || typeof vendorData !== "object"
  ) {
    throw new Error("ساختار داخلی backup برای ترکیب معتبر نیست");
  }

  const envelope: UnifiedBackupEnvelope = {
    format: UNIFIED_BACKUP_FORMAT,
    backupId: createBackupId(),
    createdAt: new Date().toISOString(),
    application: "حسابداری کارگاه",
    sections: {
      accounting: {
        format: accountingPayload.format,
        backupFormatVersion: accountingPayload.backupFormatVersion,
        schemaVersion: accountingPayload.schemaVersion,
        exportedAt: accountingPayload.exportedAt,
        collections: accountingCollections,
        data: accountingData,
      },
      vendorDirectory: {
        format: vendorPayload.format,
        exportedAt: vendorPayload.exportedAt,
        data: vendorData,
      },
    },
    counts: {
      accounting: (accountingCollections || {}) as Record<string, number>,
      vendorDirectory: countVendorDirectory(vendorDirectory),
    },
  };

  return JSON.stringify(envelope, null, 2);
}

export function importUnifiedPayload(payload: string): ImportedBackup {
  const parsed = parseJsonObject(payload);
  if (parsed.format !== UNIFIED_BACKUP_FORMAT) {
    return {
      accounting: importPayload(payload),
      unified: false,
    };
  }

  const sections = parsed.sections;
  if (!sections || typeof sections !== "object" || Array.isArray(sections)) {
    throw new Error("بخش‌های backup یکپارچه ناقص است");
  }
  const sectionRecord = sections as Record<string, unknown>;
  const accountingSection = sectionRecord.accounting;
  const vendorSection = sectionRecord.vendorDirectory;
  if (
    !accountingSection || typeof accountingSection !== "object" ||
    !vendorSection || typeof vendorSection !== "object"
  ) {
    throw new Error("بخش حسابداری یا تأمین‌کنندگان در backup وجود ندارد");
  }

  const accounting = importPayload(JSON.stringify(accountingSection));
  const vendorDirectory = importVendorDirectory(
    JSON.stringify(vendorSection)
  );
  return { accounting, vendorDirectory, unified: true };
}
