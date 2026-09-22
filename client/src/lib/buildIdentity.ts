export const BUILD_IDENTITY = {
  repository: "rasool083/accounting-workshop-pwa",
  branch: "main",
  application: "حسابداری کارگاه | دفتر هوشمند",
  commit: import.meta.env.VITE_BUILD_COMMIT || "unknown",
  sourceLabel: "مخزن اصلی پروژه",
} as const;

export function buildIdentityLabel() {
  return `${BUILD_IDENTITY.sourceLabel} · ${BUILD_IDENTITY.commit}`;
}
