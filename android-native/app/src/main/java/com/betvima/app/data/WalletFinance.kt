package com.betvima.app.data

import org.json.JSONObject
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode

/** Site payment catalogue and account statement are authoritative. */
data class WalletPaymentMethod(
    val id: String,
    val name: String,
    val available: Boolean,
    val reason: String,
    val minMinor: String,
    val maxMinor: String,
    val feeBps: Int,
    val fixedFeeMinor: String,
    val estimatedSeconds: Int?
)
data class WalletMethodCatalogue(
    val methods: List<WalletPaymentMethod>,
    val depositsEnabled: Boolean,
    val withdrawalsEnabled: Boolean,
    val operationsUnavailable: Boolean
) {
    fun enabled(direction: String, id: String): Boolean =
        !operationsUnavailable &&
            (if (direction == "deposit") depositsEnabled else withdrawalsEnabled) &&
            methods.any { it.id == id && it.available }

    /** Never silently substitute a different payment method. */
    fun method(id: String): WalletPaymentMethod? = methods.firstOrNull { it.id == id }

    fun amountAllowed(id: String, usdMinor: String): Boolean {
        val value = usdMinor.toBigIntegerOrNull() ?: return false
        val m = method(id) ?: return false
        val minimum = m.minMinor.toBigIntegerOrNull() ?: return false
        val maximum = m.maxMinor.toBigIntegerOrNull() ?: return false
        return value >= minimum && (maximum == java.math.BigInteger.ZERO || value <= maximum)
    }
}

fun parseWalletMethods(json: JSONObject): WalletMethodCatalogue =
    WalletMethodCatalogue(
        json.arr("methods").objects().map {
            WalletPaymentMethod(
                it.str("id"), it.str("nameFa", it.str("nameEn", it.str("id"))),
                it.optBoolean("isAvailable", false),
                it.str("unavailableReason"),
                it.str("minAmountMinor", "0"),
                it.str("maxAmountMinor", "0"),
                it.optInt("feeBps", 0),
                it.str("fixedFeeMinor", "0"),
                if (it.isNull("estimatedSeconds")) null else it.optInt("estimatedSeconds")
            )
        },
        json.optBoolean("depositsEnabled", false),
        json.optBoolean("withdrawalsEnabled", false),
        json.optBoolean("operationsUnavailable", true)
    )

data class WalletPaymentIntent(
    val publicId: String,
    val status: String,
    val direction: String,
    val amountMinor: String,
    val currency: String,
    val providerAddress: String,
    val providerCurrency: String
)
fun parseWalletIntent(json: JSONObject): WalletPaymentIntent {
    val data = json.optJSONObject("intent") ?: json
    val metadata = data.optJSONObject("providerMetadata")
    return WalletPaymentIntent(
        publicId = data.str("publicId"), status = data.str("status"),
        direction = data.str("direction"), amountMinor = data.str("amountMinor"),
        currency = data.str("currency"),
        providerAddress = metadata?.str("pay_address").orEmpty(),
        providerCurrency = metadata?.str("pay_currency").orEmpty()
    )
}

data class WalletExchangeQuote(
    val rateIrrPerUsd: String,
    val quotedAt: String,
    val signature: String
) {
    fun valid(): Boolean = rateIrrPerUsd.toBigDecimalOrNull()?.signum() == 1 &&
        signature.matches(Regex("[a-f0-9]{64}")) &&
        quotedAt.isNotBlank() &&
        runCatching {
            java.time.Duration.between(java.time.Instant.parse(quotedAt),
                java.time.Instant.now()).seconds in 0..55
        }.getOrDefault(false)
}

data class WalletPaymentRecord(
    val id: String,
    val publicId: String,
    val direction: String,
    val status: String,
    val amountMinor: String,
    val currency: String,
    val createdAt: String,
    val failureMessage: String
)

data class CryptoCoin(
    val code: String, val name: String, val glyph: String,
    val networkOptions: List<String>
)
val walletCoins = listOf(
    CryptoCoin("USDT", "Tether", "₮", listOf("Tron (TRC-20)", "Ethereum (ERC-20)",
        "BNB Smart Chain (BEP-20)", "Solana")),
    CryptoCoin("BTC", "Bitcoin", "₿", listOf("Bitcoin")),
    CryptoCoin("ETH", "Ethereum", "Ξ", listOf("Ethereum (ERC-20)")),
    CryptoCoin("TRX", "TRON", "◈", listOf("Tron (TRC-20)")),
    CryptoCoin("XRP", "XRP", "✕", listOf("XRP Ledger")),
    CryptoCoin("ADA", "Cardano", "₳", listOf("Cardano")),
    CryptoCoin("DOGE", "Dogecoin", "Ð", listOf("Dogecoin"))
)
fun supportedWalletNetwork(coin: String, network: String): Boolean =
    walletCoins.firstOrNull { it.code == coin }
        ?.networkOptions?.any { it.equals(network, ignoreCase = true) } == true

/** Convert localized user input to exact minor units; reject rounding silently. */
fun normalizedWalletNumber(source: String): String = source.trim()
    .map { char ->
        when (char) {
            in '۰'..'۹' -> ('0'.code + char.code - '۰'.code).toChar()
            in '٠'..'٩' -> ('0'.code + char.code - '٠'.code).toChar()
            '٫' -> '.'
            '٬', ',' -> ' '
            else -> char
        }
    }.joinToString("").replace(" ", "")

fun walletInputMinor(source: String, currency: String): String? {
    val input = normalizedWalletNumber(source)
    val valid = if (currency == "IRR" || currency == "IRT")
        Regex("[0-9]{1,19}") else Regex("[0-9]{1,16}(\\.[0-9]{1,2})?")
    if (!valid.matches(input)) return null
    return runCatching {
        val minor = if (currency == "IRR" || currency == "IRT")
            BigInteger(input) else BigDecimal(input).movePointRight(2).toBigIntegerExact()
        minor.takeIf { it > BigInteger.ZERO && it.toString().length <= 19 }?.toString()
    }.getOrNull()
}

/** Voucher fiat forms always accept IRR, even if an existing account stores IRT (toman).
 * Keep the original wallet denomination in all signed server requests.
 */
fun voucherWalletMinorFromRials(input: String, walletCurrency: String): String? {
    if (walletCurrency == "USD") return walletInputMinor(input, "USD")
    if (walletCurrency !in setOf("IRR", "IRT")) return null
    val rials = walletInputMinor(input, "IRR")?.toBigIntegerOrNull() ?: return null
    return when (walletCurrency) {
        "IRR" -> rials.toString()
        "IRT" -> if (rials.mod(BigInteger.TEN) == BigInteger.ZERO)
            rials.divide(BigInteger.TEN).toString() else null
        else -> null
    }
}

fun voucherRialsFromWalletMinor(walletMinor: String, walletCurrency: String): BigInteger? =
    runCatching {
        val amount = BigInteger(walletMinor)
        require(amount >= BigInteger.ZERO)
        when (walletCurrency) {
            "IRR" -> amount
            "IRT" -> amount.multiply(BigInteger.TEN)
            else -> error("Unsupported voucher fiat wallet currency")
        }
    }.getOrNull()

/** Exact ceiling for $1.50 (150 cents) and any larger provider minimum. */
fun voucherMinimumWalletMinor(usdMinor: String, currency: String, rateIrrPerUsd: String): String? =
    runCatching {
        require(currency in setOf("IRT", "IRR"))
        val minor = BigInteger(usdMinor)
        require(minor >= BigInteger.ZERO)
        val rate = BigDecimal(rateIrrPerUsd)
        require(rate > BigDecimal.ZERO)
        val divisor = if (currency == "IRT") BigDecimal("1000") else BigDecimal("100")
        BigDecimal(minor).multiply(rate).divide(divisor, 0, RoundingMode.CEILING)
            .toBigIntegerExact().toString()
    }.getOrNull()

fun voucherMaximumWalletMinor(usdMinor: String, currency: String, rateIrrPerUsd: String): String? =
    runCatching {
        require(currency in setOf("IRT", "IRR"))
        val minor = BigInteger(usdMinor)
        require(minor >= BigInteger.ZERO)
        val rate = BigDecimal(rateIrrPerUsd)
        require(rate > BigDecimal.ZERO)
        val divisor = if (currency == "IRT") BigDecimal("1000") else BigDecimal("100")
        BigDecimal(minor).multiply(rate).divide(divisor, 0, RoundingMode.FLOOR)
            .toBigIntegerExact().toString()
    }.getOrNull()

/** Exact floor conversion: never promise a voucher larger than the user's fiat input. */
fun voucherUsdMinor(walletMinor: String, currency: String, rateIrrPerUsd: String): String? {
    if (currency == "USD") return walletMinor
    return runCatching {
        require(currency == "IRR" || currency == "IRT")
        val rate = BigDecimal(rateIrrPerUsd)
        require(rate > BigDecimal.ZERO)
        val multiplier = if (currency == "IRT") BigDecimal(1000) else BigDecimal(100)
        BigDecimal(walletMinor).multiply(multiplier)
            .divide(rate, 0, RoundingMode.DOWN).toBigIntegerExact().toString()
    }.getOrNull()
}

fun validWalletEmail(value: String): Boolean =
    value.trim().length <= 254 &&
        Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(value.trim())

fun walletTransferAllowed(integrity: String, available: Boolean, amountMinor: String?): Boolean =
    integrity == "ok" && available &&
        (amountMinor?.toBigIntegerOrNull()?.let { it > BigInteger.ZERO } == true)
