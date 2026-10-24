package com.betvima.app.ui

import com.betvima.app.data.NotificationLocalizedCopy184
import com.betvima.app.data.UserNotification
import java.util.Locale

internal data class DisplayNotification184(
    val title: String,
    val body: String,
    val ctaLabel: String?
)

internal fun notificationLanguageTag184(lang: Lang): String = when (lang) {
    Lang.EN -> "en"
    Lang.FA -> "fa"
    Lang.TR -> "tr"
    Lang.DARI -> "dari"
    Lang.HY -> "hy"
    Lang.AR -> "ar"
    Lang.AZ -> "az"
    Lang.RU -> "ru"
}

/**
 * The already-issued 100%-deposit welcome notification exists in different
 * source languages on the server. Only identify this SPECIFIC branded template:
 * promo link, greeting, matching bonus, 24h and four-pick constraints.
 * Never overwrite an unrelated admin-authored message.
 */
internal fun isWelcomeDepositBonus184(note: UserNotification): Boolean {
    if (notificationDestination(note.ctaHref) != NotificationDestination.BONUSES) return false
    fun normalized(value: String): String = buildString(value.length) {
        value.forEach { ch ->
            append(when (ch) {
                in '۰'..'۹' -> ('0'.code + (ch.code - '۰'.code)).toChar()
                in '٠'..'٩' -> ('0'.code + (ch.code - '٠'.code)).toChar()
                '‌', '‍' -> ' '
                'آ' -> 'ا'
                '٫', '،' -> '.'
                else -> ch
            })
        }
    }.lowercase(Locale.ROOT)
    val title = normalized(note.title)
    val body = normalized(note.body)
    val greeting = title.contains("خوش امد") ||
        title.contains("welcome", ignoreCase = true)
    val bonus = (title.contains("بونوس") || title.contains("bonus")) &&
        (title.contains("100") || body.contains("100"))
    return greeting && bonus && body.contains("24") &&
        body.contains("4") && body.contains("1.60")
}

/** Curated translations of the existing promotional welcome template. */
private val welcomeBonusCopies184: Map<String, DisplayNotification184> = mapOf(
    "en" to DisplayNotification184(
        "Welcome to BetVima! 100% bonus on each eligible deposit",
        "Each eligible deposit earns a matching bonus. Valid for 24 hours. Use one accumulator with exactly 4 selections, each at odds of at least 1.60, from the Bonus Account only. Read the rules and restrictions.",
        "View bonus"
    ),
    "fa" to DisplayNotification184(
        "به بت‌ویما خوش آمدید! بونوس ۱۰۰٪ برای هر واریز",
        "برای هر واریز واجد شرایط، بونوس معادل دریافت کنید. اعتبار بونوس ۲۴ ساعت است. تنها یک شرط ترکیبی با دقیقاً ۴ انتخاب و ضریب حداقل ۱٫۶۰ برای هر انتخاب، از حساب بونوس مجاز است. قوانین و محدودیت‌ها را بخوانید.",
        "مشاهده بونوس"
    ),
    "tr" to DisplayNotification184(
        "BetVima'ya hoş geldiniz! Uygun her yatırıma %100 bonus",
        "Şartları karşılayan her para yatırma işlemi için eşdeğer bonus kazanın. Bonus 24 saat geçerlidir. Yalnızca Bonus Hesabından, her biri en az 1,60 oranlı tam 4 seçimli tek bir kombine kupon kullanın. Kuralları ve kısıtlamaları okuyun.",
        "Bonusu görüntüle"
    ),
    "dari" to DisplayNotification184(
        "به بت‌ویما خوش آمدید! بونوس ۱۰۰٪ برای هر واریز",
        "برای هر واریز واجد شرایط، بونوس برابر دریافت کنید. اعتبار ۲۴ ساعت است. تنها یک شرط ترکیبی با دقیقاً ۴ انتخاب و ضریب حداقل ۱٫۶۰ برای هر انتخاب از حساب بونوس مجاز است. قوانین و محدودیت‌ها را بخوانید.",
        "دیدن بونوس"
    ),
    "hy" to DisplayNotification184(
        "Բարի գալուստ BetVima․ 100% բոնուս յուրաքանչյուր համապատասխան ավանդի համար",
        "Յուրաքանչյուր համապատասխան ավանդի դիմաց ստացեք նույն չափի բոնուս։ Այն գործում է 24 ժամ։ Օգտագործեք միայն բոնուսային հաշիվը՝ ճիշտ 4 ընտրությամբ մեկ բազմակի խաղադրույքի համար, յուրաքանչյուր ընտրության գործակիցը՝ առնվազն 1.60։ Կարդացեք կանոններն ու սահմանափակումները։",
        "Դիտել բոնուսը"
    ),
    "ar" to DisplayNotification184(
        "مرحبًا بك في BetVima! مكافأة 100% على كل إيداع مؤهل",
        "احصل على مكافأة مساوية لكل إيداع مؤهل. صلاحيتها 24 ساعة. استخدم حساب المكافأة فقط لقسيمة مجمّعة واحدة من 4 اختيارات بالضبط، بمعامل لا يقل عن 1.60 لكل اختيار. اقرأ الشروط والقيود.",
        "عرض المكافأة"
    ),
    "az" to DisplayNotification184(
        "BetVima-ya xoş gəlmisiniz! Hər uyğun depozitə 100% bonus",
        "Hər uyğun depozit üçün eyni məbləğdə bonus əldə edin. Bonus 24 saat etibarlıdır. Yalnız Bonus Hesabından, hər biri ən azı 1.60 əmsallı dəqiq 4 seçimdən ibarət bir kombinə kupon istifadə edin. Qaydaları və məhdudiyyətləri oxuyun.",
        "Bonusa bax"
    ),
    "ru" to DisplayNotification184(
        "Добро пожаловать в BetVima! Бонус 100% к каждому подходящему депозиту",
        "Каждый подходящий депозит даёт бонус в размере суммы депозита. Бонус действует 24 часа. Сделайте один экспресс ровно из 4 событий с коэффициентом не ниже 1,60 на каждое, используя только бонусный счёт. Ознакомьтесь с правилами и ограничениями.",
        "Посмотреть бонус"
    )
)

/**
 * Switching the selected language re-evaluates the displayed text immediately.
 * Per-locale copy supplied by the authenticated API has priority. Only the
 * known welcome-promo template may use the curated client-side fallback.
 * Unknown personal/admin messages retain their exact original words.
 */
internal fun displayNotification184(note: UserNotification, lang: Lang): DisplayNotification184 {
    val tag = notificationLanguageTag184(lang)
    val provided: NotificationLocalizedCopy184? = note.translations[tag]
    val recognized = if (isWelcomeDepositBonus184(note)) welcomeBonusCopies184[tag] else null
    return DisplayNotification184(
        title = provided?.title ?: recognized?.title ?: note.title,
        body = provided?.body ?: recognized?.body ?: note.body,
        ctaLabel = provided?.ctaLabel ?: recognized?.ctaLabel ?: note.ctaLabel
    )
}
