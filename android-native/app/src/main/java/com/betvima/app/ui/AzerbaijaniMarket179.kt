package com.betvima.app.ui

/** Azerbaijani-specific sports terms; "Home" means home team here, not main tab. */
internal object AzerbaijaniMarket179 {
    private val selections = mapOf(
        "Home" to "Ev sahibi", "Away" to "Qonaq", "Draw" to "Heç-heçə",
        "Home win" to "Ev sahibinin qələbəsi",
        "Away win" to "Qonağın qələbəsi",
        "Over" to "Üst", "Under" to "Alt",
        "Yes" to "Bəli", "No" to "Xeyr",
        "Win" to "Qələbə", "Lose" to "Məğlubiyyət",
        "Both teams to score" to "Hər iki komanda qol vuracaq",
        "Double chance" to "İkili şans",
        "Handicap" to "Handikap"
    )
    private val sports = mapOf(
        "football" to "Futbol", "basketball" to "Basketbol",
        "tennis" to "Tennis", "volleyball" to "Voleybol",
        "hockey" to "Xokkey", "handball" to "Həndbol",
        "american-football" to "Amerika futbolu",
        "cricket" to "Kriket", "mma" to "Qarışıq döyüş sənətləri",
        "boxing" to "Boks", "table-tennis" to "Stolüstü tennis",
        "baseball" to "Beysbol", "esports" to "Kibersport",
        "other" to "Digər idman növləri"
    )
    private val ledger = mapOf(
        "deposit" to "Depozit", "withdrawal" to "Vəsaitin çıxarılması",
        "withdrawal_hold" to "Çıxarılacaq məbləğin bloklanması",
        "withdrawal_release" to "Bloklanmış vəsaitin açılması",
        "bet_debit" to "Mərc məbləğinin çıxılması",
        "bet_refund" to "Mərcin qaytarılması",
        "win_credit" to "Uduşun hesaba köçürülməsi",
        "void_refund" to "Ləğv olunmuş mərcin qaytarılması",
        "bonus" to "Bonus", "adjustment" to "Balans düzəlişi",
        "reversal" to "Əməliyyatın geri qaytarılması",
        "affiliate_payout" to "Tərəfdaş ödənişi",
        "cashout" to "Erkən hesablaşma"
    )
    fun selection(english: String): String {
        selections[english]?.let { return it }
        Regex("""^(Over|Under) (\d+(?:\.\d+)?)$""").matchEntire(english)?.let {
            return (if (it.groupValues[1] == "Over") "Üst " else "Alt ") +
                it.groupValues[2]
        }
        return AzerbaijaniQuality179.translate(english)
            ?: AzerbaijaniTranslations179.translate(english)
    }
    fun sport(key: String, english: String): String =
        sports[key] ?: AzerbaijaniQuality179.translate(english)
            ?: AzerbaijaniTranslations179.translate(english)
    fun transaction(key: String): String? = ledger[key]
}
