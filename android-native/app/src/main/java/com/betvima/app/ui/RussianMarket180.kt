package com.betvima.app.ui

/** Match-context Russian names; never conflate home-team "Home" with main navigation. */
internal object RussianMarket180 {
    private val marketTerms = mapOf(
        "Home" to "Хозяева", "Away" to "Гости", "Draw" to "Ничья",
        "Home win" to "Победа хозяев", "Away win" to "Победа гостей",
        "Over" to "Больше", "Under" to "Меньше",
        "Yes" to "Да", "No" to "Нет", "Win" to "Победа",
        "Lose" to "Поражение", "Both teams to score" to "Обе команды забьют",
        "Double chance" to "Двойной шанс", "Handicap" to "Фора"
    )
    private val sports = mapOf(
        "football" to "Футбол", "basketball" to "Баскетбол",
        "tennis" to "Теннис", "volleyball" to "Волейбол",
        "hockey" to "Хоккей", "handball" to "Гандбол",
        "american-football" to "Американский футбол",
        "cricket" to "Крикет", "mma" to "Смешанные единоборства",
        "boxing" to "Бокс", "table-tennis" to "Настольный теннис",
        "baseball" to "Бейсбол", "esports" to "Киберспорт",
        "other" to "Другие виды спорта"
    )
    private val ledger = mapOf(
        "deposit" to "Пополнение", "withdrawal" to "Вывод средств",
        "withdrawal_hold" to "Резервирование суммы вывода",
        "withdrawal_release" to "Снятие резерва на вывод",
        "bet_debit" to "Списание суммы ставки",
        "bet_refund" to "Возврат ставки",
        "win_credit" to "Зачисление выигрыша",
        "void_refund" to "Возврат отменённой ставки",
        "bonus" to "Бонус", "adjustment" to "Корректировка баланса",
        "reversal" to "Сторнирование операции",
        "affiliate_payout" to "Партнёрская выплата",
        "cashout" to "Досрочный расчёт"
    )
    fun selection(english: String): String {
        marketTerms[english]?.let { return it }
        Regex("""^(Over|Under) (\d+(?:\.\d+)?)$""").matchEntire(english)?.let {
            val direction = if (it.groupValues[1] == "Over") "Больше" else "Меньше"
            return "$direction ${it.groupValues[2]}"
        }
        return RussianQuality180.translate(english) ?: RussianTranslations180.translate(english)
    }
    fun sport(key: String, english: String): String =
        sports[key] ?: RussianQuality180.translate(english) ?: RussianTranslations180.translate(english)
    fun transaction(key: String): String? = ledger[key]
}
