package com.betvima.app.ui

/** Only known app-authored interpolated messages; never reword server/user data. */
internal object AzerbaijaniDynamic179 {
    fun translate(source: String): String? {
        Regex("""^(\d+) days$""").matchEntire(source)?.let {
            return "${it.groupValues[1]} gün"
        }
        Regex("""^Live · (\d+)$""").matchEntire(source)?.let {
            return "Canlı · ${it.groupValues[1]}"
        }
        Regex("""^Space freed: (.+)$""").matchEntire(source)?.let {
            return "Boşaldılan yer: ${it.groupValues[1]}"
        }
        Regex("""^Temporary files removed: (\d+)$""").matchEntire(source)?.let {
            return "Silinmiş müvəqqəti fayllar: ${it.groupValues[1]}"
        }
        Regex("""^Locked for (\d+) seconds$""").matchEntire(source)?.let {
            return "Kilidin açılmasına ${it.groupValues[1]} saniyə qalır"
        }
        Regex("""^File content or format was rejected \(HTTP (\d{3})\)\. Choose a JPG, PNG, WEBP or PDF\.$""")
            .matchEntire(source)?.let {
                return "Faylın məzmunu və ya formatı qəbul edilmədi (HTTP ${it.groupValues[1]}). JPG, PNG, WEBP və ya PDF seçin."
            }
        Regex("""^Upload access denied \(HTTP (\d{3})\)\. Sign in again or contact support\.$""")
            .matchEntire(source)?.let {
                return "Fayl yükləmək üçün icazə verilmədi (HTTP ${it.groupValues[1]}). Yenidən daxil olun və ya dəstəklə əlaqə saxlayın."
            }
        return null
    }
}
