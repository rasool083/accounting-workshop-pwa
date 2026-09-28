# گزارش مقایسهٔ خواندنی `accounting-workshop-pwa-cedric` با پروژهٔ اصلی

**تاریخ بررسی:** ۱۴۰۵/۰۷/۰۷ (2026-09-29)  
**محدوده:** فقط خواندن مخزن Cedric؛ هیچ فایل، commit یا تنظیمی در آن تغییر داده نشد.  
**هدف:** شناسایی تمام اختلاف‌های Git-tracked، تحلیل علت هر تغییر، انتقال فقط ایده‌های معتبر به پروژهٔ اصلی، و جلوگیری از merge کورکورانه.

## ۱. روش و نقطهٔ مقایسه

| مورد | پروژهٔ اصلی | مخزن Cedric |
|---|---|---|
| Repository | `rasool083/accounting-workshop-pwa` | `rasool083/accounting-workshop-pwa-cedric` |
| Commit بررسی‌شده | `3aa43cb11a6c6f71d093f8f0e1ac84845e5a2283` | `2df92ae3659d8997febee99141907e6c883b854c` |
| فایل‌های Git-tracked | ۱۹۸ | ۲۱۲ |
| فایل‌های مشترک متفاوت | ۱۳ | ۱۳ |
| فایل‌های اختصاصی Cedric | ۳ گروه | `cedric-patches/`، `docs/CEDRIC-HANDOFF.md`، `scripts/apply-cedric-patches.mjs` |
| روش diff | archive تمیز از Git و `diff -ruN` | بدون `.git`، `node_modules` و فایل‌های build |

برای فایل‌های بزرگ، patchهای Cedric جداگانه نیز خط‌به‌خط خوانده شدند؛ بنابراین تفاوت‌های پنهان در patch archive از diff فایل‌های نهایی حذف نشدند.

## ۲. فهرست کامل اختلاف‌های واقعی

### فایل‌های هویتی و انتشار

- `client/public/manifest.webmanifest`
- `client/public/sw.js`
- `client/src/lib/buildIdentity.ts`

### منطق و آزمون‌های حسابداری

- `client/src/lib/accounting.ts`
- `client/src/lib/accounting.test.ts`
- `client/src/lib/pwa.test.ts`

### Dropbox و رابط اصلی

- `client/src/lib/dropbox.ts`
- `client/src/lib/dropbox.test.ts`
- `client/src/pages/Home.tsx`
- `client/src/index.css`

### مستندات و ابزار فرایند

- `docs/DECISION-LOG.md`
- `docs/PROJECT-CONTINUITY.md`
- `package.json`
- `cedric-patches/*`
- `scripts/apply-cedric-patches.mjs`
- `docs/CEDRIC-HANDOFF.md`

## ۳. تحلیل دسته‌بندی‌شدهٔ تغییرات

### ۳.۱. جداسازی نصب دوم Cedric

Cedric این موارد را به namespace مستقل تغییر داده است:

- base مسیر Pages: `/accounting-workshop-pwa-cedric/`
- کلیدهای `localStorage` و snapshot
- کلید Google Drive و vendor directory
- نام cache سرویس‌ورکر با پیشوند `accounting-workshop-pwa-cedric-`
- `manifest.id`، نام برنامه و `buildIdentity.repository`
- نام backupهای جدید: `cedric-backup-*`

**علت:** هر دو برنامه روی origin یکسان `rasool083.github.io` هستند و بدون جداسازی ممکن است localStorage، refresh token، cache یا فایل‌های پشتیبان با هم قاطی شوند.

**تصمیم برای پروژهٔ اصلی:** انتقال نشود. پروژهٔ اصلی باید هویت و namespace خودش را حفظ کند؛ کپی‌کردن suffix `-cedric` باعث می‌شود نصب اصلی به دادهٔ اشتباه یا مسیر نادرست اشاره کند. ایدهٔ عمومیِ جداسازی namespace معتبر است و در نسخهٔ اصلی برای Dropbox و هویت build با نام اصلی خود پروژه اعمال شده است.

### ۳.۲. Dropbox

Cedric ابتدا Dropbox را در patchهای کوچک به Home اضافه کرده و سپس r6.1 و r6.2 این موارد را تکمیل کرده است:

- OAuth PKCE و refresh token آفلاین
- پیام خطای قابل‌فهم برای scopeهای ناقص Dropbox
- scopeهای `files.metadata.read`، `files.content.read` و `files.content.write`
- ذخیره در `/backups/<سال>/<ماه فارسی>/`
- پشتیبانی از فایل‌های قدیمی در root
- escape یونیکد فارسی در `Dropbox-API-Arg`
- تست مرز نوروز و نام ماه شمسی

**نتیجه:** قرارداد payload یکپارچه و قابل restore بین Drive، Dropbox و فایل محلی حفظ شده است؛ فقط نام و محل ذخیره متفاوت است. این الگو قبلاً به‌صورت انتخابی در پروژهٔ اصلی منتقل شده و در این مقایسه تغییر جدیدی برای انتقال باقی نماند.

**تفاوت UI:** Cedric یک panel مستقل Dropbox را کنار Drive نگه می‌دارد؛ نسخهٔ اصلی فعلی Dropbox را در قرارداد BackupPage یکپارچه‌تر کرده است. هر دو از نظر داده compatible هستند. انتقال UI Cedric لازم نیست.

### ۳.۳. اصلاحات مالی و تولیدی Cedric

#### الف) بهای بستهٔ تولیدی

Cedric برای بسته‌ای که `product.price = 0` است، بهای آن را recursively از فرمول بسته و با تبدیل واحد محاسبه می‌کند و سپس در فرمول والد به کار می‌برد.

**وضعیت اصلی:** این ایده قبلاً به پروژهٔ اصلی منتقل شده و تست تولید بسته و تبدیل واحد دارد. نسخهٔ اصلی فعلی حتی helperهای متمرکز `calculateCurrentProductionUnitCost` و `refreshProductionRecordPrice` دارد؛ بنابراین patch قدیمی Cedric نباید روی آن اعمال شود.

#### ب) وزن واقعی چندقطعه‌ای

Cedric وزن برنامه‌ریزی‌شدهٔ کل فرمول را به وزن هر قطعه تبدیل می‌کند تا نسبت `actualPieceWeight` اشتباه نشود.

**وضعیت اصلی:** در تاریخچهٔ پروژهٔ اصلی این اصلاح قبلاً ثبت شده و تست‌های weight/material usage موجود است. هنگام merge نباید نسخهٔ Cedric جایگزین نسخهٔ اصلی شود.

#### ج) ترتیب معکوس‌سازی تولید تو‌در‌تو

Cedric در `reverseProductionRun` روی `runRecords.reverse()` حرکت می‌کند. علت درست است: هنگام تولید، رکورد بستهٔ فرعی ابتدا ایجاد می‌شود و سپس رکورد محصول والد؛ محصول والد بستهٔ فرعی را مصرف می‌کند و ممکن است موجودی بسته به صفر رسیده باشد.

**وضعیت اصلی قبل از این بررسی:** حلقهٔ اصلی روی `runRecords` مستقیم حرکت می‌کرد. در سناریوی تولید یک محصول از دو بستهٔ خودکار، حذف بچ ابتدا بسته را کم می‌کرد و به‌دلیل موجودی صفر با خطای کمبود موجودی روبه‌رو می‌شد.

**اقدام انجام‌شده در پروژهٔ اصلی:** حلقه به `for (const record of [...runRecords].reverse())` تغییر کرد و توضیح علت کنار کد افزوده شد. یک تست regression اضافه شد که تولید بستهٔ تو‌در‌تو را با موجودی صفر بسته حذف می‌کند و برگشت موجودی raw، package و output را بررسی می‌کند.

#### د) چک برگشتی/خرج‌شده

Cedric در نسخهٔ خود چک‌های `برگشتی` و `خرج شده` را تا ابطال/جایگزینی در تخصیص نگه می‌دارد؛ در نسخه‌های قبلی main، `برگشتی` و `خرج شده` از eligible حذف شده بودند. این موضوع باید با قرارداد کسب‌وکار تفکیک شود:

- درخواست اخیر کاربر صریحاً می‌گوید **برگشتی نباید تخصیص فاکتور را حذف کند** مگر ابطال یا جایگزینی.
- تست اصلی فعلی این قرارداد برگشتی را دارد.
- دربارهٔ `خرج شده`، تست و تصمیم قبلی main رفتار متفاوتی دارد و تغییر آن بدون تأیید معنای عملی «خرج شده» پرریسک است.

**تصمیم:** رفتار `خرج شده` از Cedric منتقل نشد؛ این اختلاف به‌عنوان موضوع نیازمند تصمیم مستقل باقی ماند، ولی رفتار `برگشتی` در main قبلاً اصلاح شده است.

#### هـ) دیرکرد وصول

Cedric یک متن اطلاع‌رسانی در UI برای فاصلهٔ سررسید تا وصول اضافه کرده است. اما در patchهای قدیمی، بعضی مسیرها فاصلهٔ تاریخ فاکتور تا سررسید را برای `calculateLateProfit` استفاده می‌کردند؛ این با قرارداد جدید main سازگار نیست.

**تصمیم:** فقط معنای اطلاع‌رسانی «سررسید تا وصول واقعی» معتبر است. محاسبهٔ سود/هزینه نباید به‌خاطر نمایش دیرکرد تغییر کند. نسخهٔ اصلی فعلی `calculateLateProfit` را بر اساس وصول واقعی و بدون وصول صفر نگه می‌دارد؛ patch محاسباتی Cedric منتقل نشد.

#### و) سطرهای قیمت بخشی بچ

Cedric نوع `ProductionPriceTier`، helper `productionUnitCostAt` و `repriceProductionRecord` دارد. پروژهٔ اصلی به‌جای آن `ProductionPriceRevision` و `refreshProductionRecordPrice` را پذیرفته است؛ این طراحی شامل مقدار پایه، بهای واحد، مبلغ کل، تاریخ مؤثر و توضیح است و مقدار revisionها را از کل بچ بیشتر نمی‌کند.

**نکتهٔ مهم برای مرحلهٔ بعد:** در main، revisionها در UI ثبت و نمایش می‌شوند، اما باید جداگانه با سناریوی «بخشی از بچ با قیمت قدیم فروخته شد و باقی با قیمت جدید» بررسی شود تا انتخاب revision معتبر برای `unitCostAtSale` و سود مؤثر کاملاً بر اساس تاریخ/مقدار باشد. Cedric نیز این مشکل را به‌طور کامل حل نکرده؛ `quantity` در `priceTiers` در بخشی از کد informational است و allocation واقعی مقدار به فروش را نگه نمی‌دارد. بنابراین merge مستقیم Cedric راه‌حل نهایی نیست.

### ۳.۴. چاپ landscape

Cedric در `printWithTarget` علاوه بر کلاس CSS، یک `@page` style موقت در DOM تزریق می‌کند و cleanup را با `afterprint`/focus انجام می‌دهد؛ علت، تفاوت رفتار Firefox و Edge در بستن asynchronous dialog است.

**وضعیت اصلی:** main هم `@page landscape` و کلاس `body.print-landscape` دارد، اما cleanup فعلی timeout ثابت ۱۵۰۰ میلی‌ثانیه است. این یک hardening قابل بررسی است، نه یک اصلاح حسابداری.

**پیشنهاد مرحلهٔ بعد:** با تست دستی در Chrome، Edge و Firefox بررسی شود. اگر در Firefox/Edge کلاس CSS کافی نبود، lifecycle مقاوم Cedric به‌صورت مستقل و با تست cleanup منتقل شود؛ تزریق style در هر چاپ بدون اثبات مشکل انجام نشود.

### ۳.۵. patch runner و CI

Cedric برای محدودیت انتقال فایل‌های بزرگ، patchهای کوچک را با manifest شامل hash قبل/بعد و اسکریپت fail-fast اعمال می‌کند:

- اگر hash نسخهٔ اصلی یا نسخهٔ patched نباشد، build متوقف می‌شود.
- در شکست patch، فایل به نسخهٔ قبل برگردانده می‌شود.
- اجرای دوباره idempotent است.
- `check` و `test` نیز patch runner را قبل از اجرا فراخوانی می‌کنند.

**ارزش ایده:** کنترل hash و fail-fast برای تغییر فایل‌های حساس مفید است.

**تصمیم:** معماری patch runner به main منتقل نشد، چون پروژهٔ اصلی امکان commit مستقیم فایل‌ها را دارد و patchهای build-time می‌توانند working tree را mutate کنند. ایدهٔ قابل انتقال فقط افزودن `tsc --noEmit` به CI و بررسی hash/clean tree در pipeline است.

## ۴. تغییر اصلاحی اعمال‌شده در پروژهٔ اصلی

فقط این اصلاح کدنویسی از یافتهٔ Cedric منتقل شد:

- `client/src/lib/accounting.ts`: معکوس‌سازی رکوردهای تولید تو‌در‌تو parent-first.
- `client/src/lib/accounting.test.ts`: تست `reverses a nested production run parent-first`.

هیچ فایل مخزن Cedric تغییر نکرد.

## ۵. اعتبارسنجی

- تست focused حسابداری: **۶۰ تست موفق**.
- کل Vitest: **۱۱ فایل و ۹۶ تست موفق**.
- TypeScript: `pnpm exec tsc --noEmit --pretty false` موفق.
- Build: `pnpm build` موفق.
- هشدار Vite دربارهٔ chunk بزرگ موجود و غیرمسدودکننده است.
- `git diff --check` موفق.

## ۶. موارد باقی‌مانده برای مرحلهٔ بعد

1. سناریوهای مقدارمحور `priceRevisions` را با فروش بخشی از بچ و تاریخ‌های متفاوت اضافه کنیم؛ بدون جعل رکورد تولید و بدون تغییر موجودی.
2. معنای دقیق وضعیت `خرج شده` در تخصیص فاکتور را با قرارداد کسب‌وکار مشخص کنیم؛ تا آن زمان patch Cedric برای این بخش merge نشود.
3. چاپ landscape را در مرورگرهای هدف آزمایش کنیم و فقط در صورت بازتولید مشکل lifecycle Cedric را منتقل کنیم.
4. موارد open خود Cedric مثل `payment-rule dayBasis`، dashboard balance/cash events، month close، CSV escaping و تأیید دانلود قبل از Delete All در backlog main بمانند؛ هیچ‌کدام در این مقایسه بدون تست و تصمیم مستقل اعمال نشدند.
