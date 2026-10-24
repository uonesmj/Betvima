package com.betvima.app.ui

/** Sports taxonomy and financial ledger descriptions localized by stable keys. */
internal object NativeLocalizedNouns176 {
    private val sports = mapOf(
        "football" to Triple("Futbol", "Ֆուտբոլ", "كرة القدم"),
        "basketball" to Triple("Basketbol", "Բասկետբոլ", "كرة السلة"),
        "tennis" to Triple("Tenis", "Թենիս", "التنس"),
        "volleyball" to Triple("Voleybol", "Վոլեյբոլ", "الكرة الطائرة"),
        "hockey" to Triple("Buz hokeyi", "Հոկեյ", "هوكي الجليد"),
        "handball" to Triple("Hentbol", "Հանդբոլ", "كرة اليد"),
        "american-football" to Triple("Amerikan futbolu", "Ամերիկյան ֆուտբոլ", "كرة القدم الأمريكية"),
        "cricket" to Triple("Kriket", "Կրիկետ", "الكريكيت"),
        "mma" to Triple("Karma dövüş sanatları", "Խառը մարտարվեստ", "الفنون القتالية المختلطة"),
        "boxing" to Triple("Boks", "Բռնցքամարտ", "الملاكمة"),
        "table-tennis" to Triple("Masa tenisi", "Սեղանի թենիս", "تنس الطاولة"),
        "baseball" to Triple("Beyzbol", "Բեյսբոլ", "البيسبول"),
        "esports" to Triple("E-spor", "Կիբերսպորտ", "الرياضات الإلكترونية"),
        "other" to Triple("Diğer sporlar", "Այլ մարզաձևեր", "رياضات أخرى")
    )
    private val finance = mapOf(
        "deposit" to Triple("Para yatırma", "Մուտքագրում", "إيداع"),
        "withdrawal" to Triple("Para çekme", "Ելքագրում", "سحب"),
        "withdrawal_hold" to Triple("Çekim tutarı bloke edildi", "Ելքագրման գումարը պահվել է", "حجز مبلغ السحب"),
        "withdrawal_release" to Triple("Çekim blokesi kaldırıldı", "Ելքագրման պահումը հանվել է", "إلغاء حجز السحب"),
        "bet_debit" to Triple("Bahis tutarı düşüldü", "Խաղադրույքի գումարը գանձվել է", "خصم مبلغ الرهان"),
        "bet_refund" to Triple("Bahis iadesi", "Խաղադրույքի գումարի վերադարձ", "استرداد مبلغ الرهان"),
        "win_credit" to Triple("Kazanç eklendi", "Շահումը մուտքագրվել է", "إضافة أرباح الرهان"),
        "void_refund" to Triple("Geçersiz bahis iadesi", "Չեղարկված խաղադրույքի վերադարձ", "استرداد رهان ملغى"),
        "bonus" to Triple("Bonus", "Բոնուս", "مكافأة"),
        "adjustment" to Triple("Hesap düzeltmesi", "Հաշվի ճշգրտում", "تسوية الحساب"),
        "reversal" to Triple("Ters işlem kaydı", "Գործարքի հակադարձում", "عكس المعاملة"),
        "affiliate_payout" to Triple("İş ortağı ödemesi", "Գործընկերային վճարում", "دفعة الشريك"),
        "cashout" to Triple("Erken ödeme", "Վաղաժամ վճարում", "تسوية مبكرة")
    )
    private fun localized(lang: Lang, row: Triple<String, String, String>?): String? = when (lang) {
        Lang.TR -> row?.first
        Lang.HY -> row?.second
        Lang.AR -> row?.third
        else -> null
    }
    fun sport(lang: Lang, key: String, english: String): String =
        if (lang == Lang.AZ) AzerbaijaniMarket179.sport(key, english)
        else localized(lang, sports[key]) ?: english
    fun transaction(lang: Lang, key: String): String? =
        if (lang == Lang.AZ) AzerbaijaniMarket179.transaction(key)
        else localized(lang, finance[key])
}
