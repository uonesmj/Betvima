package com.betvima.app.ui

/** Only template messages with known syntax. Player data and monetary values untouched. */
internal object RussianDynamic180 {
    fun translate(english: String): String? {
        Regex("""^(\d+) days$""").matchEntire(english)?.let { return "${it.groupValues[1]} дн." }
        Regex("""^Live · (\d+)$""").matchEntire(english)?.let { return "В эфире · ${it.groupValues[1]}" }
        Regex("""^Space freed: (.+)$""").matchEntire(english)?.let { return "Освобождено места: ${it.groupValues[1]}" }
        Regex("""^Temporary files removed: (\d+)$""").matchEntire(english)?.let { return "Удалено временных файлов: ${it.groupValues[1]}" }
        Regex("""^Locked for (\d+) seconds$""").matchEntire(english)?.let { return "Блокировка ещё на ${it.groupValues[1]} сек." }
        Regex("""^File content or format was rejected \(HTTP (\d{3})\)\. Choose a JPG, PNG, WEBP or PDF\.$""")
            .matchEntire(english)?.let {
                return "Содержимое или формат файла отклонены (HTTP ${it.groupValues[1]}). Выберите JPG, PNG, WEBP или PDF."
            }
        Regex("""^Upload access denied \(HTTP (\d{3})\)\. Sign in again or contact support\.$""")
            .matchEntire(english)?.let {
                return "Отказано в загрузке (HTTP ${it.groupValues[1]}). Войдите снова или обратитесь в поддержку."
            }
        return null
    }
}
