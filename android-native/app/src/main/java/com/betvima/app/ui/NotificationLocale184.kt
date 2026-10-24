package com.betvima.app.ui

import com.betvima.app.data.UserNotification
import java.util.Locale

/**
 * In-app notifications are immutable server records. Only *presentation* text
 * changes with AppState.lang. Never translate IDs, links, amounts or user input.
 *
 * Priority: explicit API locale payload > recognized first-party template >
 * existing translated UI term > original server text.
 */
data class DisplayNotice184(
    val title: String,
    val body: String,
    val cta: String?
)

internal fun notificationLanguageTag184(lang: Lang): String = when (lang) {
    Lang.EN -> "en"
    Lang.FA -> "fa"
    Lang.TR -> "tr"
    Lang.DARI -> "prs"
    Lang.HY -> "hy"
    Lang.AR -> "ar"
    Lang.AZ -> "az"
    Lang.RU -> "ru"
}

private data class BonusNotice184(val title: String, val body: String, val action: String)

private val welcomeBonus184 = mapOf(
    Lang.EN to BonusNotice184(
        "Welcome to BetVima! 100% bonus on every deposit",
        "Every eligible deposit earns a matching bonus. Valid for 24 hours. Use one accumulator with exactly four selections at odds of at least 1.60 each, from your Bonus Account. Read the terms and restrictions.",
        "View bonus"
    ),
    Lang.FA to BonusNotice184(
        "به بت‌ویما خوش آمدید! بونوس ۱۰۰٪ هر واریز",
        "برای هر واریز واجد شرایط، بونوس معادل دریافت کنید. اعتبار: ۲۴ ساعت. استفاده: یک شرط ترکیبی با دقیقاً ۴ انتخاب و ضریب حداقل ۱٫۶۰ برای هر انتخاب، از حساب بونوس. قوانین و محدودیت‌ها را بخوانید.",
        "مشاهده بونوس"
    ),
    Lang.TR to BonusNotice184(
        "BetVima'ya hoş geldiniz! Her yatırıma %100 bonus",
        "Uygun her para yatırma işlemi için aynı tutarda bonus alın. Süre: 24 saat. Bonusu yalnızca Bonus Hesabından, her seçimin oranı en az 1,60 olan tam dört seçimli bir kombinede kullanın. Kuralları ve kısıtlamaları okuyun.",
        "Bonusu görüntüle"
    ),
    Lang.DARI to BonusNotice184(
        "به بت‌ویما خوش آمدید! بونوس ۱۰۰٪ هر واریز",
        "برای هر واریز واجد شرایط، بونوس معادل دریافت کنید. اعتبار آن ۲۴ ساعت است. بونوس را تنها از حساب بونوس در یک شرط ترکیبی با دقیقاً چهار انتخاب و حداقل ضریب ۱٫۶۰ برای هر انتخاب استفاده کنید. شرایط و محدودیت‌ها را بخوانید.",
        "دیدن بونوس"
    ),
    Lang.HY to BonusNotice184(
        "Բարի գալուստ BetVima․ 100% բոնուս յուրաքանչյուր ավանդի համար",
        "Յուրաքանչյուր համապատասխան ավանդի համար ստացեք նույն չափի բոնուս։ Գործում է 24 ժամ։ Օգտագործեք միայն բոնուսային հաշվից՝ ճիշտ չորս ընտրությամբ մեկ համակցված խաղադրույքում, յուրաքանչյուր ընտրության գործակիցը՝ առնվազն 1.60։ Կարդացեք պայմաններն ու սահմանափակումները։",
        "Դիտել բոնուսը"
    ),
    Lang.AR to BonusNotice184(
        "مرحبًا بك في BetVima! مكافأة 100% على كل إيداع",
        "احصل على مكافأة مطابقة لكل إيداع مؤهل. الصلاحية 24 ساعة. استخدم المكافأة من حساب المكافآت فقط في رهان مجمّع من أربعة اختيارات بالضبط، بمعامل لا يقل عن 1.60 لكل اختيار. اقرأ الشروط والقيود.",
        "عرض المكافأة"
    ),
    Lang.AZ to BonusNotice184(
        "BetVima-ya xoş gəlmisiniz! Hər depozitə 100% bonus",
        "Şərtlərə uyğun hər depozit üçün eyni məbləğdə bonus qazanın. Etibarlılıq müddəti 24 saatdır. Bonusu yalnız Bonus Hesabından, hər seçimin əmsalı ən azı 1.60 olan dəqiq dörd seçimli bir kombinə mərcdə istifadə edin. Şərtləri və məhdudiyyətləri oxuyun.",
        "Bonusa bax"
    ),
    Lang.RU to BonusNotice184(
        "Добро пожаловать в BetVima! Бонус 100% на каждый депозит",
        "За каждый подходящий депозит начисляется бонус на ту же сумму. Срок действия — 24 часа. Используйте бонус только с бонусного счёта в одном экспрессе ровно из четырёх выборов с коэффициентом не ниже 1,60 на каждый. Ознакомьтесь с условиями и ограничениями.",
        "Посмотреть бонус"
    )
)

/**
 * Only the first-party welcome-deposit-bonus announcement is reconstructed.
 * Admin-authored or support messages never get substituted with generic text.
 */
internal fun isWelcomeDepositBonus184(note: UserNotification): Boolean {
    val route = note.ctaHref?.substringBefore('?')?.trimEnd('/')
    val text = (note.title + " " + note.body).lowercase(Locale.ROOT)
    val bonusTerms = listOf("bonus", "بونوس", "مكافأة", "бонус", "բոնուս")
    val depositTerms = listOf("deposit", "واریز", "إيداع", "депозит", "ավանդ", "yatır", "depozit")
    val welcomeTerms = listOf("welcome", "خوش آمد", "خوش‌آمد", "مرحب", "добро пожаловать",
        "բարի գալուստ", "hoş geld", "xoş gəl")
    val isBonus = bonusTerms.any(text::contains)
    val isDeposit = depositTerms.any(text::contains)
    val isWelcome = welcomeTerms.any { note.title.lowercase(Locale.ROOT).contains(it) }
    val isBonusRoute = route in setOf("/bonuses", "/bonus")
    val trustedEvent = note.eventKey in setOf(
        "auth.welcome", "bonus.welcome", "bonus.deposit_welcome",
        "promo.welcome_bonus", "welcome.deposit_bonus"
    )
    return isBonus && isDeposit && (isWelcome || (trustedEvent && isBonusRoute))
}

private fun explicitCopy184(
    values: Map<String, String>,
    language: Lang
): String? {
    val tag = notificationLanguageTag184(language)
    val aliases = when (language) {
        Lang.DARI -> listOf(tag, "fa-AF", "dari", "fa")
        Lang.FA -> listOf(tag, "fa-IR")
        Lang.AR -> listOf(tag, "ar-SA")
        Lang.AZ -> listOf(tag, "az-AZ")
        Lang.RU -> listOf(tag, "ru-RU")
        Lang.TR -> listOf(tag, "tr-TR")
        Lang.HY -> listOf(tag, "hy-AM")
        Lang.EN -> listOf(tag, "en-US")
    }
    return aliases.firstNotNullOfOrNull { alias ->
        values[alias]?.takeIf(String::isNotBlank)
    }
}

fun notificationDisplayCopy184(note: UserNotification, language: Lang): DisplayNotice184 {
    val apiTitle = explicitCopy184(note.localizedTitles, language)
    val apiBody = explicitCopy184(note.localizedBodies, language)
    val apiAction = explicitCopy184(note.localizedCtaLabels, language)
    val template = if (isWelcomeDepositBonus184(note)) welcomeBonus184[language] else null

    fun localText(serverText: String, localized: String?, templateText: String?): String =
        localized ?: templateText ?: tr(language, serverText, serverText)

    return DisplayNotice184(
        title = localText(note.title, apiTitle, template?.title),
        body = localText(note.body, apiBody, template?.body),
        cta = note.ctaLabel?.let { localText(it, apiAction, template?.action) }
    )
}
