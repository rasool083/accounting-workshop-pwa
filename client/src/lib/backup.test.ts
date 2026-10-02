import { describe, expect, it } from "vitest";
import {
  exportPayload,
  importPayload,
  loadState,
  normalizeState,
} from "./accounting";
import {
  AI_STUDIO_UNIFIED_BACKUP_FORMAT,
  checksumJson,
  exportUnifiedPayload,
  importUnifiedPayload,
  UNIFIED_BACKUP_FORMAT,
} from "./backup";
import type { VendorDirectoryState } from "./vendorDirectory";

describe("unified backup contract", () => {
  const vendorDirectory: VendorDirectoryState = {
    version: 1,
    vendors: [
      {
        id: "vendor-1",
        name: "تأمین‌کننده آزمایشی",
        kind: "بازرگانی",
        contactName: "",
        phone: "",
        email: "",
        location: "",
        website: "",
        suppliedMaterials: ["اکسید آلومینیوم"],
        notes: "",
        active: true,
        createdAt: "2026-09-23T00:00:00.000Z",
        updatedAt: "2026-09-23T00:00:00.000Z",
      },
    ],
    quotes: [],
  };

  it("round-trips accounting and vendor directory sections", () => {
    const accounting = loadState();
    const payload = exportUnifiedPayload(accounting, vendorDirectory);
    const parsed = JSON.parse(payload) as {
      format: string;
      sections: unknown;
      currency: { code: string; label: string };
    };

    expect(parsed.format).toBe(UNIFIED_BACKUP_FORMAT);
    expect(parsed.sections).toBeTruthy();
    expect(parsed.currency).toEqual({ code: "IRT", label: "تومان" });

    const restored = importUnifiedPayload(payload);
    expect(restored.unified).toBe(true);
    expect(restored.accounting.settings.businessName).toBe(
      accounting.settings.businessName
    );
    expect(restored.vendorDirectory?.vendors).toHaveLength(1);
    expect(restored.vendorDirectory?.vendors[0].name).toBe(
      "تأمین‌کننده آزمایشی"
    );
  });

  it("does not export local password or PIN credentials", () => {
    const accounting = {
      ...loadState(),
      settings: {
        ...loadState().settings,
        security: {
          password: { salt: "local-salt", hash: "local-password-hash", iterations: 120000 },
          pin: { salt: "local-pin-salt", hash: "local-pin-hash", iterations: 120000 },
        },
      },
    };
    const payload = exportUnifiedPayload(accounting, vendorDirectory);
    expect(payload).not.toContain("local-password-hash");
    expect(payload).not.toContain("local-pin-hash");
    const restored = importUnifiedPayload(payload);
    expect(restored.accounting.settings.security).toBeUndefined();
  });

  it("strips credentials when restoring a legacy backup that already contains them", () => {
    const accounting = {
      ...loadState(),
      settings: {
        ...loadState().settings,
        security: {
          pin: { salt: "old-salt", hash: "old-pin-hash", iterations: 120000 },
        },
      },
    };
    const restored = importUnifiedPayload(exportPayload(accounting));
    expect(restored.unified).toBe(false);
    expect(restored.accounting.settings.security).toBeUndefined();
  });

  it("imports the legacy accounting-only payload without changing vendor data", () => {
    const accounting = loadState();
    const restored = importUnifiedPayload(exportPayload(accounting));

    expect(restored.unified).toBe(false);
    expect(restored.vendorDirectory).toBeUndefined();
    expect(restored.accounting.settings.businessName).toBe(
      accounting.settings.businessName
    );
  });

  it("rejects a payload whose section was changed after export", () => {
    const accounting = loadState();
    const parsed = JSON.parse(
      exportUnifiedPayload(accounting, vendorDirectory)
    ) as {
      sections: {
        vendorDirectory: { data: { vendors: Array<{ name?: string }> } };
      };
    };
    parsed.sections.vendorDirectory.data.vendors[0].name = "دادهٔ دستکاری‌شده";

    expect(() => importUnifiedPayload(JSON.stringify(parsed))).toThrow(
      "checksum"
    );
  });

  it("rejects a payload whose manifest count does not match its data", () => {
    const accounting = loadState();
    const parsed = JSON.parse(exportUnifiedPayload(accounting, vendorDirectory)) as {
      counts: { vendorDirectory: { vendors: number } };
    };
    parsed.counts.vendorDirectory.vendors += 1;

    expect(() => importUnifiedPayload(JSON.stringify(parsed))).toThrow(
      "تعداد تأمین‌کنندگان"
    );
  });

  /**
   * The read-only AI Studio continuation renamed the envelope identifier.
   * Its backups must keep restoring inside this application, otherwise the
   * user loses the recovery path they previously relied on.
   */
  it("restores a backup envelope produced by the AI Studio continuation", () => {
    const accounting = loadState();
    const payload = exportUnifiedPayload(accounting, vendorDirectory);
    const envelope = JSON.parse(payload) as Record<string, unknown>;
    envelope.format = AI_STUDIO_UNIFIED_BACKUP_FORMAT;

    const restored = importUnifiedPayload(JSON.stringify(envelope));
    expect(restored.unified).toBe(true);
    expect(restored.accounting.settings.businessName).toBe(
      accounting.settings.businessName
    );
    expect(restored.vendorDirectory?.vendors).toHaveLength(1);
  });

  it("keeps checksum validation active for AI Studio envelopes", () => {
    const accounting = loadState();
    const envelope = JSON.parse(
      exportUnifiedPayload(accounting, vendorDirectory)
    ) as Record<string, unknown> & {
      format: string;
      sections: { accounting: { data: { settings: { businessName: string } } } };
      checksums: { accounting: string };
    };
    envelope.format = AI_STUDIO_UNIFIED_BACKUP_FORMAT;
    envelope.sections.accounting.data.settings.businessName = "دادهٔ دستکاری‌شده";

    expect(() => importUnifiedPayload(JSON.stringify(envelope))).toThrow(
      "checksum"
    );
  });

  it("writes AI Studio-compatible check targets and group collections", () => {
    const accounting = {
      ...loadState(),
      checks: [
        {
          id: "check-compat",
          number: "C-COMPAT",
          partyId: "party-compat",
          designatedInvoiceId: "invoice-compat",
          dueDate: "1405/07/30",
          receivedDate: "1405/06/26",
          amount: 1_000_000,
          status: "نزد ما" as const,
          bank: "",
        },
      ],
      checkAllocationGroups: [
        {
          id: "group-native",
          name: "گروه بومی",
          createdAt: "1405/07/10",
          assignments: [
            { checkId: "check-compat", invoiceId: "invoice-compat" },
          ],
        },
      ],
    };
    const parsed = JSON.parse(exportPayload(accounting)) as {
      data: {
        checks: Array<{ id: string; targetInvoiceId?: string }>;
        checkGroupAllocations: Array<{
          name: string;
          checkIds: string[];
          invoiceIds: string[];
        }>;
      };
    };
    const exportedCheck = parsed.data.checks.find(
      check => check.id === "check-compat"
    );
    expect(exportedCheck?.targetInvoiceId).toBe("invoice-compat");
    expect(parsed.data.checkGroupAllocations[0]).toMatchObject({
      name: "گروه بومی",
      checkIds: ["check-compat"],
      invoiceIds: ["invoice-compat"],
    });
  });

  it("imports an AI Studio payload into the native target and group fields", () => {
    const source = {
      checks: [
        {
          id: "check-ai",
          number: "C-AI",
          partyId: "party-ai",
          targetInvoiceId: "invoice-ai",
          dueDate: "1405/07/30",
          receivedDate: "1405/06/26",
          amount: 500_000,
          status: "نزد ما",
          bank: "",
        },
      ],
      checkGroupAllocations: [
        {
          id: "group-ai",
          name: "تخصیص گروهی AI",
          partyId: "party-ai",
          checkIds: ["check-ai"],
          invoiceIds: ["invoice-ai"],
          createdAt: "1405/07/10",
        },
      ],
    };
    const restored = importPayload(
      JSON.stringify({ format: "accounting-workshop-backup", data: source })
    );
    expect(restored.checks[0].designatedInvoiceId).toBe("invoice-ai");
    expect(restored.legacyCheckGroupAllocations?.[0]).toMatchObject({
      id: "group-ai",
      checkIds: ["check-ai"],
      invoiceIds: ["invoice-ai"],
    });
  });

  it("round-trips preserved AI Studio groups through export and import", () => {
    const state = normalizeState({
      checks: [
        {
          id: "check-round",
          number: "C-R",
          partyId: "party-round",
          dueDate: "1405/07/30",
          receivedDate: "1405/06/26",
          amount: 900_000,
          status: "نزد ما",
          bank: "",
        },
      ],
      checkGroupAllocations: [
        {
          id: "group-round",
          name: "گروه رفت و برگشت",
          checkIds: ["check-round"],
          invoiceIds: ["invoice-round"],
          createdAt: "1405/07/10",
        },
      ],
    });
    const restored = importPayload(exportPayload(state));
    expect(restored.legacyCheckGroupAllocations).toHaveLength(1);
    expect(restored.legacyCheckGroupAllocations?.[0].name).toBe(
      "گروه رفت و برگشت"
    );
  });
});
