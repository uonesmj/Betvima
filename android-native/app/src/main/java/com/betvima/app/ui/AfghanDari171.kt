package com.betvima.app.ui

/**
 * Afghan Dari (prs-AF) native UI. The already localized Persian prose is a
 * starting point for common intelligibility, with Afghanistan-specific
 * vocabulary overriding labels. This does NOT convert currencies or values.
 * Distinct Pashto (ps-AF) requires a separate translation.
 */
internal object AfghanDari171 {
    private val terms = mapOf(
        "Language" to "زبان",
        "Choose your preferred language" to "زبان دلخواه خود را انتخاب کنید",
        "Home" to "صفحه اصلی",
        "Live" to "زنده",
        "Upcoming" to "مسابقات آینده",
        "Sports" to "ورزش‌ها",
        "Casino" to "کازینو",
        "My bets" to "شرط‌های من",
        "My Bets" to "شرط‌های من",
        "Wallet" to "کیف پول",
        "Deposit" to "واریز",
        "Withdraw" to "برداشت",
        "History" to "تاریخچه",
        "Log in" to "ورود",
        "Registration" to "ثبت نام",
        "Register" to "ثبت نام",
        "Sign out" to "خروج از حساب",
        "Settings" to "تنظیمات",
        "Profile" to "پروفایل",
        "Notifications" to "اطلاعیه‌ها",
        "Language" to "زبان",
        "Support" to "پشتیبانی",
        "24/7 support" to "پشتیبانی شبانه‌روزی",
        "Help" to "راهنمایی",
        "Account services" to "خدمات حساب",
        "Account status" to "وضعیت حساب",
        "Change password" to "تغییر رمز عبور",
        "Phone verification" to "تایید شماره تلفن",
        "Registered email" to "ایمیل ثبت‌شده",
        "Legal name" to "نام قانونی",
        "Select language" to "انتخاب زبان",
        "Available balance" to "موجودی قابل استفاده",
        "AVAILABLE BALANCE" to "موجودی قابل استفاده",
        "Open wallet" to "باز کردن کیف پول",
        "Deposit wallet" to "کیف پول واریز",
        "Amount" to "مبلغ",
        "Payment method" to "روش پرداخت",
        "Cryptocurrency" to "پول دیجیتالی",
        "Blockchain network" to "شبکه بلاک‌چین",
        "Minimum" to "حداقل",
        "Maximum" to "حداکثر",
        "Transaction history" to "تاریخچه معاملات",
        "Account statement" to "صورت حساب",
        "Place bet" to "ثبت شرط",
        "Bet slip" to "برگه شرط",
        "My slip" to "برگه شرط من",
        "Stake" to "مبلغ شرط",
        "Odds" to "ضریب‌ها",
        "Potential return" to "برد احتمالی",
        "Total odds" to "مجموع ضریب‌ها",
        "Won" to "برنده",
        "Lost" to "باخته",
        "Pending" to "در انتظار",
        "Confirmed" to "تایید شده",
        "Rejected" to "رد شده",
        "Error" to "خطا",
        "Retry" to "دوباره کوشش کنید",
        "Refresh" to "تازه‌سازی",
        "Search" to "جستجو",
        "All" to "همه",
        "Today" to "امروز",
        "Tomorrow" to "فردا",
        "Yesterday" to "دیروز",
        "Settings & Security" to "تنظیمات و امنیت",
        "Security" to "امنیت",
        "Bonuses" to "بونوس‌ها",
        "My Bonuses" to "بونوس‌های من",
        "VIP Club" to "کلپ VIP",
        "Referrals" to "زیرمجموعه‌ها",
        "Affiliate Center" to "مرکز همکاری",
        "Referral links" to "لینک‌های معرفی",
        "Commission ledger" to "دفتر ثبت کمیسیون",
        "Payouts" to "پرداخت‌ها",
        "Gift codes" to "کدهای تحفه",
        "Frequently asked questions" to "سوال‌های متداول",
        "Terms & Conditions" to "شرایط و مقررات",
        "Privacy policy" to "پالیسی محرمیت",
        "Responsible gaming" to "بازی مسئولانه",
        "Information" to "معلومات",
        "Categories" to "دسته‌بندی‌ها",
        "Payment services unavailable. Refresh to retry." to "خدمات پرداخت در دسترس نیست. دوباره تازه‌سازی کنید.",
        "No matches for this filter" to "برای این فلتر مسابقه‌ای نیست",
        "Choose a tournament" to "انتخاب تورنمنت",
        "Filter" to "فلتر",
        "Filters" to "فلترها",
        "Search results" to "نتایج جستجو",
        "Show more" to "نمایش بیشتر",
        "View all" to "نمایش همه",
        "Copy" to "کاپی",
        "Copied" to "کاپی شد",
        "Cancel" to "لغو",
        "Confirm" to "تایید",
        "Continue" to "ادامه",
        "Done" to "تمام",
        "Close" to "بستن"
    )

    // These substitutions only affect localized interface prose, never
    // user identifiers, game titles, server numeric values, or currency labels.
    private val variants = listOf(
        "اطلاعات" to "معلومات",
        "کپی" to "کاپی",
        "فیلتر" to "فلتر",
        "فیلترها" to "فلترها",
        "پاداش" to "امتیاز",
        "پشتیبانی ۲۴/۷" to "پشتیبانی شبانه‌روزی",
        "شماره موبایل" to "شماره تلفن"
    )

    fun translate(english: String, persian: String): String {
        terms[english]?.let { return it }
        if (persian.isBlank()) return english
        var result = persian
        variants.forEach { (from, to) -> result = result.replace(from, to) }
        return result
    }
}
