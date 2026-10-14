# Study Planner — modular Cloudflare D1 project

این نسخه برای **دیتابیس D1 موجود** تنظیم شده است. ساختار دیتابیس از خروجی واقعی `sqlite_master` که کاربر ارائه کرده گرفته شده و قرار نیست جدول‌های موجود دوباره ساخته شوند.

## ساختار پروژه

- `public/study-dashboard.html` — داشبورد؛ داده‌ها را از `/api/data` می‌خواند و هر ۳۰ ثانیه تازه‌سازی می‌کند.
- `src/index.js` — ورودی Worker، CORS، بررسی سلامت و مسیریابی.
- `src/routes/data.js` — کوئری‌های خواندن اطلاعات موردنیاز داشبورد.
- `src/routes/mutations.js` — ماژول مستقل عملیات نوشتن برای توسعه بعدی.
- `src/lib/http.js` — توابع کمکی HTTP.
- `wrangler.toml` — اتصال به D1 موجود با binding به نام `DB`.

## نکات حیاتی دیتابیس

- دیتابیس موجود با نام `study-planner` و شناسه ثبت‌شده در `wrangler.toml` حفظ شده است.
- هیچ migration خودکاری در این پروژه وجود ندارد؛ روی دیتابیس فعلی دستور ساخت جدول اجرا نکن.
- جدول‌های برنامه‌ریزی، تکالیف و امتحان‌ها از وضعیت‌های واقعی schema پیروی می‌کنند:
  - `plan.status`: `todo`, `done`, `skipped`
  - `homework.status`: `todo`, `done`, `skipped`
  - `exams.status`: `upcoming`, `done`, `cancelled`
- `books.subject` برای عنوان درس استفاده می‌شود. `subjects` و `topics` نیز در دیتابیس موجودند، اما داشبورد فعلی برای ساخت نمای فعلی از `books` استفاده می‌کند.
- جدول داخلی `_cf_KV` در کوئری‌های برنامه دست‌کاری نمی‌شود.

## تست فقط‌خواندنی قبل از انتشار

ساختار را دوباره بررسی کن:

```sh
npx wrangler d1 execute study-planner --remote --command "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"
```

سپس Worker را در محیط توسعه اجرا کن:

```sh
npx wrangler dev
```

و در محیط محلی `/api/health` و `/api/data` را بررسی کن. این پروژه از اینجا به دیتابیس حساب Cloudflare تو دسترسی مستقیم نداشته و هنوز در حساب واقعی deploy یا end-to-end تست نشده است.

## تنظیم اتصال داشبورد

اگر HTML و Worker روی یک origin نیستند، قبل از اسکریپت اصلی داشبورد مقدار زیر را تنظیم کن:

```html
<script>window.STUDY_API_URL = "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/api/data";</script>
```

سپس در `wrangler.toml` مقدار `ALLOWED_ORIGINS` را دقیقاً روی origin فرانت‌اند بگذار (بدون مسیر `/api/data`) و deploy کن:

```sh
npx wrangler deploy
```

## امنیت

- CORS به‌تنهایی احراز هویت نیست. اگر اطلاعات درسی خصوصی‌اند، داشبورد و Worker را با Cloudflare Access یا راهکار احراز هویت مناسب محافظت کن.
- عملیات نوشتن به‌صورت پیش‌فرض رد می‌شود. برای فعال‌کردن آن، secret سمت سرور با نام `WRITE_API_TOKEN` تنظیم کن:

```sh
npx wrangler secret put WRITE_API_TOKEN
```

درخواست‌های مورداعتماد باید `Authorization: Bearer <token>` بفرستند. **این توکن را هرگز در فایل HTML عمومی قرار نده**؛ هر کسی که بتواند فایل فرانت‌اند را بخواند می‌تواند توکن داخل آن را بردارد.
- عملیات نوشتن هنوز از رابط داشبورد فراخوانی نمی‌شود؛ داشبورد فعلی فقط داده‌ها را می‌خواند.

## مسیرهای API

- `GET /api/health` — تست اتصال Worker به D1.
- `GET /api/data` — داده‌های داشبورد.
- `POST /api/plan`, `PATCH /api/plan/:id`, `DELETE /api/plan/:id`.
- `POST /api/homework`, `PATCH /api/homework/:id`, `DELETE /api/homework/:id`.
- `POST /api/exams`, `PATCH /api/exams/:id`, `DELETE /api/exams/:id`.

مسیرهای نوشتن نیاز به secret سمت سرور دارند و با توکن نباید از کد عمومی فرانت‌اند استفاده شود.
