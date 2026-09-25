import { isJalaliLeapYear, isValidJalaliDate } from "../client/src/lib/accounting";

const mismatches: Array<{ year: number; core: boolean; ui: boolean }> = [];
for (let year = 1200; year <= 1500; year += 1) {
  const core = isJalaliLeapYear(year);
  const ui = year % 4 === 3;
  if (core !== ui) mismatches.push({ year, core, ui });
}

const invalidAccordingToCoreButVisibleByUi = mismatches.filter(item => item.ui && !item.core).map(item => item.year);
const hiddenByUiButValidInCore = mismatches.filter(item => !item.ui && item.core).map(item => item.year);

console.log(JSON.stringify({
  checkedYears: 301,
  mismatchCount: mismatches.length,
  firstMismatches: mismatches.slice(0, 20),
  invalidAccordingToCoreButVisibleByUi,
  hiddenByUiButValidInCore,
  core1403Day30: isValidJalaliDate(1403, 12, 30),
  core1404Day30: isValidJalaliDate(1404, 12, 30),
}, null, 2));

if (mismatches.length > 0) process.exitCode = 1;
