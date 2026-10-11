# دسترسی گیت‌هاب — راهنمای یک‌باره

## کلید عمومی من (این را در گیت‌هاب ثبت کنید)

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEXL9Doz8GlAbfRfSzDA/RRM/vwKt4OEpMau9Ic2QuyB arena-agent-betvima
```

## مراحل (۶۰ ثانیه، از موبایل هم می‌شود)

1. این لینک را باز کنید:
   **https://github.com/uonesmj/Betvima/settings/keys**
2. دکمه **Add deploy key** را بزنید
3. Title: `arena-agent`
4. Key: متن بالا را کامل پیست کنید
5. تیک **Allow write access** را بزنید ← بدون این تیک فقط خواندن می‌توانم
6. **Add key**

بعد یک پیام در چت بدهید: «کلید اضافه شد»

## بعد از آن چه می‌کنم

- ریموت را روی SSH تنظیم می‌کنم
- ۳ کامیت آمادهٔ لوگو را پوش می‌کنم (ری‌بیس روی آخرین main انجام شده، بدون تضاد، ۱۷۳ تست پاس)

## بعد از پوش، خودکار چه می‌شود

- **GitHub Actions**: تست + typecheck + lint + build + تست‌های controller را اجرا می‌کند
- **پیش‌نمایش**: نسخهٔ ایزوله روی `https://preview.betvima.com/` ساخته می‌شود (بدون دیتابیس و کلیدهای پول)
- **پروداکشن**: خودکار **نمی‌شود** — فقط خودتان (`uonesmj`) با اجرای دستی workflow و `approve_production=true` منتشر می‌کنید

## ⚠️ دو نکته مهم دربارهٔ این ریلیز

1. **مایگریشن ۰۱۹۶** (`nova.logo_cache`) در این کامیت‌ها هست و طبق سیاست ریپو، مایگریشن‌ها **هرگز خودکار اعمال نمی‌شوند** و تغییر فایل مایگریشن **انتشار پروداکشن را متوقف می‌کند**. یعنی قبل از تأیید پروداکشن باید روی سرور اجرا کنید:

   ```bash
   bash scripts/db-migrate.sh
   ```

2. **بک‌فیل لوگو** بعد از دیپلوی، جداگانه است:

   ```bash
   NOVA_WORKER_ONCE=true npm run worker:logo    # چند بار تکرار تا resolved صفر شود
   pm2 start ecosystem.config.cjs --only nova-worker-logo   # یا ورکر دائمی
   ```

## نکات امنیتی

- این کلید **فقط به همین ریپو** دسترسی دارد؛ نه به اکانت شما، نه به ریپوهای دیگر
- هر لحظه بخواهید قطع کنید: همان صفحه → Delete key (دسترسی فوراً قطع می‌شود)
- کلید خصوصی در محیط کاری من می‌ماند و به گیت‌هاب نمی‌رود
- من هرگز force-push روی main نمی‌کنم و بدون دستور شما پوش نمی‌کنم

## اگر کلید نمی‌خواهید (راه جایگزین)

یک **Fine-grained Token** بسازید:
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens →
Repository access: فقط `uonesmj/Betvima` → Permissions → Contents: **Read and write** →
Expiration: ۷ روز → Generate → توکن (`github_pat_...`) را در چت بدهید.

عیبش: توکن در تاریخچهٔ چت می‌ماند و باید بعداً revoke کنید. کلید deploy امن‌تر و تمیزتر است.
