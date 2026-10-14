package com.betvima.app.ui

import android.graphics.Bitmap
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.betvima.app.data.*
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import java.util.UUID

private val wBlue = Color(0xFF087FF5)
private val wGreen = Color(0xFF00D47A)
private val wText = Color(0xFF172033)
private val wMuted = Color(0xFF758195)
private val wBorder = Color(0xFFE1E7EF)

private fun wTr(lang: Lang, english: String, farsi: String): String = tr(lang, english, farsi)

private fun walletMinCrypto(currency: String, usdRate: String?): BigInteger? =
    when (currency) {
        "USD" -> BigInteger("2000")
        "IRR", "IRT" -> runCatching {
            val rate = BigDecimal(usdRate ?: return null)
            require(rate.signum() > 0)
            (BigDecimal("2000") * rate)
                .divide(if (currency == "IRT") BigDecimal(100) else BigDecimal(10),
                    0, RoundingMode.CEILING).toBigIntegerExact()
        }.getOrNull()
        else -> null
    }

private fun moneyInCurrency(minor: String, currency: String): String =
    money(minor, currency)

private fun rateVoucherText(quote: WalletExchangeQuote?, lang: Lang): String =
    quote?.takeIf { it.valid() }?.let {
        wTr(lang, "uWallet quote: ", "نرخ مرجع یوولت: ") + it.rateIrrPerUsd + " IRR/USD"
    } ?: wTr(lang, "uWallet rate unavailable; refresh.", "نرخ یوولت در دسترس نیست؛ تازه‌سازی کنید.")

private fun walletIntentPayload(
    direction: String, method: String, coin: String, network: String,
    amountMinor: String, walletCurrency: String, destination: String,
    voucherCode: String, quote: WalletExchangeQuote?
): JSONObject {
    val voucher = method != "crypto"
    if (voucher) require(method in listOf("voucher_uvoucher", "voucher_hotvoucher"))
    return JSONObject().apply {
        put("amountMinor", amountMinor)
        put("currency", if (direction == "deposit" || voucher) "USD" else walletCurrency)
        put("methodId", when {
            voucher -> method
            direction == "deposit" -> "crypto_usdt"
            else -> "crypto_withdrawal"
        })
        if (!voucher) {
            put("asset", coin)
            put("network", network)
            if (direction == "withdraw") put("destination", destination.trim())
        } else if (direction == "deposit") {
            put("voucherCode", voucherCode.trim())
        } else {
            put("email", destination.trim().lowercase())
            if (walletCurrency != "USD" && quote != null) {
                put("quoteRateIrrPerUsd", quote.rateIrrPerUsd)
                put("quoteTimestamp", quote.quotedAt)
                put("quoteSignature", quote.signature)
                val raw = walletInputMinor(amountMinor, "IRR")
                // Caller passes the original wallet minor amount separately.
            }
        }
    }
}

/** Pure validation. No mutation is sent before the user reviews a confirmation dialog. */
internal fun walletTransferValidation(
    direction: String, method: String, coin: String, network: String,
    walletCurrency: String, amount: String, destination: String,
    voucherCode: String, availableMinor: String, integrity: String,
    methodEnabled: Boolean, quote: WalletExchangeQuote?, usdRate: String?
): String? {
    if (integrity != "ok") return "ledger"
    if (!methodEnabled) return "method"
    val voucher = method != "crypto"
    val inputCurrency = when {
        voucher -> walletCurrency
        direction == "deposit" -> "USD"
        else -> walletCurrency
    }
    val walletMinor = walletInputMinor(amount, inputCurrency) ?: return "amount"
    val minor = if (voucher && inputCurrency != "USD")
        voucherUsdMinor(walletMinor, inputCurrency, quote?.rateIrrPerUsd.orEmpty()) ?: return "quote"
        else walletMinor
    val n = minor.toBigIntegerOrNull() ?: return "amount"
    val minimum = if (voucher) BigInteger("150")
        else if (direction == "deposit") BigInteger("2000")
        else walletMinCrypto(walletCurrency, usdRate) ?: return "rate"
    if (voucher && walletCurrency != "USD" && quote?.valid() != true) return "quote"
    if (n < if (voucher) BigInteger("150") else if (direction == "deposit")
            BigInteger("2000") else if (walletCurrency == "USD") BigInteger("2000")
            else minimum) return "minimum"
    if (direction == "withdraw") {
        val available = availableMinor.toBigIntegerOrNull() ?: return "balance"
        if (walletMinor.toBigInteger() > available) return "balance"
        if (voucher) {
            if (!validWalletEmail(destination)) return "email"
        } else {
            if (!supportedWalletNetwork(coin, network)) return "network"
            if (destination.trim().length !in 4..120 ||
                destination.contains(Regex("\\s"))) return "address"
        }
    } else if (voucher && voucherCode.trim().isBlank()) return "code"
    if (!voucher && !supportedWalletNetwork(coin, network)) return "network"
    return null
}

private fun walletErrorText(issue: String, lang: Lang): String = when (issue) {
    "ledger" -> wTr(lang,"The account ledger requires review.", "دفترکل حساب نیازمند بررسی است.")
    "method" -> wTr(lang,"This payment method is currently unavailable.",
        "این روش پرداخت فعلاً در دسترس نیست.")
    "minimum" -> wTr(lang,"Below the minimum: crypto $20 / voucher $1.50.",
        "کمتر از حداقل: رمزارز ۲۰ دلار / ووچر ۱٫۵۰ دلار.")
    "balance" -> wTr(lang,"Insufficient confirmed available balance.",
        "موجودی قابل استفاده کافی نیست.")
    "quote", "rate" -> wTr(lang, "A fresh exchange rate is required. Refresh and retry.",
        "نرخ تبدیل معتبر لازم است؛ تازه‌سازی کنید.")
    "email" -> wTr(lang, "Enter a valid recipient email.", "ایمیل معتبر گیرنده را وارد کنید.")
    "network" -> wTr(lang, "Select the correct supported network.", "شبکه معتبر را انتخاب کنید.")
    "address" -> wTr(lang, "Verify the destination wallet address.", "آدرس کیف پول مقصد را بررسی کنید.")
    "code" -> wTr(lang, "Enter the voucher code.", "کد ووچر را وارد کنید.")
    else -> wTr(lang, "Enter a valid amount.", "مبلغ معتبر وارد کنید.")
}

@Composable
private fun CryptoLogo(coin: CryptoCoin, modifier: Modifier = Modifier.size(37.dp)) {
    val iconUrl = "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/" +
        coin.code.lowercase() + ".png"
    Surface(
        color = Color(0xFFF0F3F8), shape = RoundedCornerShape(50),
        modifier = modifier
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(coin.glyph, fontSize = 20.sp, fontWeight = FontWeight.Black,
                color = if (coin.code == "BTC") Color(0xFFF7931A) else wBlue)
            AsyncImage(model = iconUrl, contentDescription = coin.name,
                modifier = Modifier.fillMaxSize().padding(3.dp))
        }
    }
}

@Composable
private fun WalletMenuRow(
    title: String, subtitle: String, leading: @Composable () -> Unit,
    onClick: () -> Unit, modifier: Modifier = Modifier
) {
    Surface(color = Color(0xFFF8FAFD), shape = RoundedCornerShape(15.dp),
        border = BorderStroke(1.dp, wBorder),
        modifier = modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.padding(11.dp), verticalAlignment = Alignment.CenterVertically) {
            leading()
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = wText, fontSize = 13.sp, fontWeight = FontWeight.Black)
                Text(subtitle, color = wMuted, fontSize = 10.sp, maxLines = 1,
                    overflow = TextOverflow.Ellipsis)
            }
            Icon(Icons.Default.KeyboardArrowDown, null, tint = wMuted)
        }
    }
}

private fun qrBitmap(value: String): Bitmap? = runCatching {
    val matrix = MultiFormatWriter().encode(
        value, BarcodeFormat.QR_CODE, 450, 450,
        mapOf(EncodeHintType.MARGIN to 1)
    )
    Bitmap.createBitmap(matrix.width, matrix.height, Bitmap.Config.ARGB_8888).apply {
        for (x in 0 until matrix.width) for (y in 0 until matrix.height)
            setPixel(x, y, if (matrix[x,y]) android.graphics.Color.BLACK
                else android.graphics.Color.WHITE)
    }
}.getOrNull()

@Composable
private fun WalletReceipt(
    receipt: WalletPaymentIntent,
    lang: Lang,
    onClose: () -> Unit,
    onCheck: () -> Unit,
    checking: Boolean
) {
    val clipboard = LocalClipboardManager.current
    val address = receipt.providerAddress
    val bitmap = remember(address) {
        address.takeIf { it.isNotBlank() }?.let(::qrBitmap)
    }
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(Icons.Default.Verified, null, tint = Color(0xFF15945B),
            modifier = Modifier.size(42.dp))
        Text(wTr(lang,"Payment request received","درخواست پرداخت ثبت شد"),
            fontSize = 19.sp, color = wText, fontWeight = FontWeight.Black)
        Text(wTr(lang,"Status: ","وضعیت: ") + receipt.status,
            color = wMuted, fontSize = 12.sp)
        if (address.isNotBlank()) {
            Text(wTr(lang,"Send only the selected asset on the matching network.",
                "فقط ارز انتخاب‌شده را روی شبکه صحیح ارسال کنید."),
                color = Color(0xFF9F6319), fontSize = 11.sp)
            if (bitmap != null) {
                Surface(color = Color.White, shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, wBorder)) {
                    Image(bitmap.asImageBitmap(), null,
                        modifier = Modifier.padding(9.dp).size(176.dp))
                }
            }
            Text(address, color = wText, fontSize = 12.sp,
                modifier = Modifier.fillMaxWidth(), lineHeight = 18.sp)
            FilledTonalButton(
                onClick = { clipboard.setText(AnnotatedString(address)) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.ContentCopy, null)
                Spacer(Modifier.width(8.dp))
                Text(wTr(lang,"Copy deposit address","کپی آدرس واریز"))
            }
        } else {
            Text(wTr(lang,
                "No deposit address was returned. Never transfer funds to a guessed address.",
                "درگاه آدرس واریز برنگردانده است؛ هرگز وجه را به آدرس حدسی ارسال نکنید."),
                color = wMuted, fontSize = 11.sp)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(receipt.publicId, color = wMuted, fontSize = 10.sp,
                modifier = Modifier.weight(1f))
            IconButton(onClick = {
                clipboard.setText(AnnotatedString(receipt.publicId))
            }) {
                Icon(Icons.Default.ContentCopy, wTr(lang,"Copy receipt","کپی رسید"),
                    tint = wBlue)
            }
        }
        if (receipt.status !in setOf("succeeded","failed") &&
            address.isBlank() && receipt.publicId.isNotBlank()) {
            OutlinedButton(onClick = onCheck, enabled = !checking,
                modifier = Modifier.fillMaxWidth()) {
                if (checking) CircularProgressIndicator(Modifier.size(16.dp),
                    strokeWidth = 2.dp)
                else Text(wTr(lang,"Check voucher status","بررسی وضعیت ووچر"))
            }
        }
        Button(onClick = onClose, modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = wBlue),
            shape = RoundedCornerShape(14.dp)) {
            Text(wTr(lang,"Done","تأیید"))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletTransferSheet(
    lang: Lang, wallet: Wallet, model: AppViewModel, direction: String,
    onDismiss: () -> Unit, onOpenHistory: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    var method by rememberSaveable(direction) { mutableStateOf("crypto") }
    var coin by rememberSaveable(direction) { mutableStateOf("USDT") }
    var network by rememberSaveable(direction) { mutableStateOf("Tron (TRC-20)") }
    var amount by rememberSaveable(direction) { mutableStateOf("") }
    var destination by rememberSaveable(direction) { mutableStateOf("") }
    // Voucher codes are not persisted in Android's saved instance state.
    var voucherCode by remember { mutableStateOf("") }
    var picker by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var receipt by remember { mutableStateOf<WalletPaymentIntent?>(null) }
    var methods by remember { mutableStateOf<WalletMethodCatalogue?>(null) }
    var quote by remember { mutableStateOf<WalletExchangeQuote?>(null) }
    var usdRate by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    val selectedCoin = walletCoins.firstOrNull { it.code == coin } ?: walletCoins.first()
    val isDeposit = direction == "deposit"
    val voucher = method != "crypto"
    val currency = wallet.currency
    val paymentMethodId = when {
        voucher -> method
        isDeposit -> "crypto_usdt"
        else -> "crypto_withdrawal"
    }
    val lookupCurrency = if (isDeposit || voucher) "USD" else currency

    LaunchedEffect(direction, method, currency, refreshKey) {
        methods = null
        quote = null
        usdRate = null
        loading = true
        error = null
        try {
            methods = model.walletPaymentMethods(
                if (isDeposit) "deposit" else "withdrawal", lookupCurrency)
            if (currency != "USD" && voucher)
                quote = model.walletVoucherReference()
            if (currency != "USD" && !isDeposit && !voucher)
                usdRate = model.walletUsdRate()
        } catch (_: Exception) {
            error = wTr(lang, "Payment services unavailable. Refresh to retry.",
                "ارتباط با سرویس مالی برقرار نشد؛ دوباره تلاش کنید.")
        } finally { loading = false }
    }

    val methodEnabled = methods?.enabled(
        if (isDeposit) "deposit" else "withdrawal", paymentMethodId) == true
    val issue = walletTransferValidation(
        direction,method,coin,network,currency,amount,destination,voucherCode,
        wallet.availableMinor,wallet.integrity,methodEnabled,quote,usdRate
    )
    val amountInputCurrency = if (!voucher && isDeposit) "USD" else currency
    val walletMinor = walletInputMinor(amount, amountInputCurrency)
    val transactionMinor = walletMinor?.let {
        if (voucher && currency != "USD")
            voucherUsdMinor(it,currency,quote?.rateIrrPerUsd.orEmpty()) else it
    }
    val amountReadable = transactionMinor?.let {
        moneyInCurrency(it, if (isDeposit || voucher) "USD" else currency)
    }.orEmpty()

    fun submit() {
        if (busy || issue != null || transactionMinor == null) return
        scope.launch {
            busy = true
            error = null
            confirm = false
            try {
                val idempotency = UUID.randomUUID().toString()
                val payload = walletIntentPayload(
                    direction,method,coin,network,transactionMinor,currency,
                    destination,voucherCode,quote
                )
                if (voucher && !isDeposit && currency != "USD") {
                    // Server verifies this signed, fresh exchange quote and applies
                    // the immutable wallet debit; never calculate ledger mutations locally.
                    payload.put("walletRequestedAmountMinor",walletMinor)
                }
                receipt = if (isDeposit) model.walletCreateDeposit(payload,idempotency)
                    else model.walletCreateWithdrawal(payload,idempotency)
                voucherCode = ""
                model.refreshAccount()
            } catch (_: Exception) {
                // A timeout may follow an accepted request. Do not automatically
                // re-submit a second money request with a different idempotency key.
                error = wTr(lang,
                    "Request not confirmed. Check payment history before retrying.",
                    "تأیید درخواست دریافت نشد؛ قبل از تلاش دوباره تاریخچه پرداخت را بررسی کنید.")
            } finally { busy = false }
        }
    }

    ModalBottomSheet(
        onDismissRequest = { if (!busy) onDismiss() },
        containerColor = Color.White,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState())
                .padding(horizontal = 17.dp).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (receipt == null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = Color(0xFFEEF4FF), shape = RoundedCornerShape(14.dp)) {
                        Icon(if (isDeposit) Icons.Default.SouthWest else Icons.Default.NorthEast,
                            null, tint = wBlue, modifier = Modifier.padding(10.dp).size(23.dp))
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(if (isDeposit) wTr(lang,"Add funds","واریز وجه")
                            else wTr(lang,"Withdraw funds","برداشت وجه"),
                            color = wText, fontSize = 20.sp, fontWeight = FontWeight.Black)
                        Text(wTr(lang,"Secure BetVima wallet","کیف پول امن بت‌ویما"),
                            color = wMuted, fontSize = 11.sp)
                    }
                    IconButton(onClick = onDismiss, enabled = !busy) {
                        Icon(Icons.Default.Close, null)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    listOf("crypto","voucher_uvoucher","voucher_hotvoucher").forEach { option ->
                        val selected = method == option
                        Surface(
                            color = if (selected) wBlue else Color(0xFFF3F6FA),
                            border = BorderStroke(1.dp, if (selected) wBlue else wBorder),
                            shape = RoundedCornerShape(13.dp),
                            modifier = Modifier.weight(1f).clickable {
                                if (!busy) { method = option; amount = ""; error = null }
                            }
                        ) {
                            Column(Modifier.padding(vertical = 10.dp),
                                horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(if (option == "crypto") "₿" else if (option == "voucher_uvoucher")
                                    "🎟" else "🎫", fontSize = 19.sp)
                                Text(when (option) {
                                    "crypto" -> "Crypto"
                                    "voucher_uvoucher" -> "U-Voucher"
                                    else -> "HotVoucher"
                                }, color = if (selected) Color.White else wText,
                                    fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                if (!voucher) {
                    WalletMenuRow(
                        wTr(lang,"Cryptocurrency","رمزارز"), coin + " · " + selectedCoin.name,
                        leading = { CryptoLogo(selectedCoin) },
                        onClick = { picker = "coin" }
                    )
                    WalletMenuRow(
                        wTr(lang,"Blockchain network","شبکه بلاکچین"), network,
                        leading = {
                            Icon(Icons.Default.Hub, null, tint = wBlue,
                                modifier = Modifier.size(33.dp))
                        },
                        onClick = { picker = "network" }
                    )
                } else {
                    Surface(color = Color(0xFFF5F3FF), shape = RoundedCornerShape(12.dp)) {
                        Row(Modifier.padding(11.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.LocalOffer, null, tint = Color(0xFF6D28D9))
                            Spacer(Modifier.width(8.dp))
                            Text(if (method == "voucher_uvoucher") "U-Voucher" else "HotVoucher",
                                color = wText, fontWeight = FontWeight.Black)
                        }
                    }
                }
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it.take(25); error = null },
                    label = {
                        Text(wTr(lang, "Amount", "مبلغ") +
                            " · " + amountInputCurrency)
                    },
                    placeholder = { Text(if (currency == "IRR" && !isDeposit) "20000000" else "20.00") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true, shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                    trailingIcon = {
                        if (!isDeposit) TextButton(onClick = {
                            amount = if (currency == "USD")
                                BigDecimal(wallet.availableMinor).movePointLeft(2)
                                    .setScale(2).toPlainString()
                            else wallet.availableMinor
                        }) { Text("MAX", fontSize = 10.sp, fontWeight = FontWeight.Black) }
                        else Text(if (voucher) currency else "USD",
                            fontSize = 11.sp, color = wMuted)
                    }
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(if (voucher) wTr(lang,"Minimum $1.50","حداقل ۱٫۵۰ دلار")
                        else wTr(lang,"Minimum $20.00","حداقل ۲۰ دلار"),
                        color = wMuted, fontSize = 10.sp)
                    Spacer(Modifier.weight(1f))
                    if (!isDeposit)
                        Text(wTr(lang, "Available: ", "قابل برداشت: ") +
                            money(wallet.availableMinor,wallet.currency),
                            color = wMuted, fontSize = 10.sp)
                }
                if (voucher && currency != "USD") {
                    Surface(color = Color(0xFFEEF4FF), shape = RoundedCornerShape(13.dp)) {
                        Column(Modifier.padding(11.dp)) {
                            Text(rateVoucherText(quote, lang), color = wText, fontSize = 10.sp)
                            if (transactionMinor != null)
                                Text(wTr(lang, "Estimated voucher: ", "معادل تقریبی ووچر: ") +
                                    money(transactionMinor, "USD"),
                                    color = wBlue, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }
                if (voucher && isDeposit) {
                    OutlinedTextField(
                        value = voucherCode,
                        onValueChange = { voucherCode = it.take(128); error = null },
                        label = { Text(wTr(lang,"Voucher code","کد ووچر")) },
                        leadingIcon = { Icon(Icons.Default.ConfirmationNumber, null) },
                        shape = RoundedCornerShape(14.dp),
                        singleLine = true, modifier = Modifier.fillMaxWidth()
                    )
                }
                if (!isDeposit) {
                    OutlinedTextField(
                        value = destination,
                        onValueChange = { destination = it.take(254); error = null },
                        label = { Text(if (voucher)
                            wTr(lang, "Recipient uWallet email", "ایمیل حساب یوولت گیرنده")
                        else wTr(lang,"Destination wallet address","آدرس کیف پول مقصد")) },
                        leadingIcon = { Icon(if (voucher) Icons.Default.Email
                            else Icons.Default.AccountBalanceWallet, null) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = if (voucher) KeyboardType.Email else KeyboardType.Text),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text(wTr(lang,
                        "Verify recipient and network. Blockchain withdrawals cannot be reversed.",
                        "ایمیل یا آدرس و شبکه را بررسی کنید؛ برداشت رمزارز برگشت‌پذیر نیست."),
                        color = Color(0xFF936018), fontSize = 11.sp)
                }
                if (loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = wBlue)
                if (!loading && !methodEnabled) {
                    Surface(color = Color(0xFFFFF2EF), shape = RoundedCornerShape(12.dp)) {
                        Text(
                            wTr(lang,"Payment method is disabled by the server.",
                                "این روش پرداخت توسط سرور غیرفعال است.") +
                                " " + (methods?.methods?.firstOrNull { it.id == paymentMethodId }
                                    ?.reason.orEmpty()),
                            modifier = Modifier.padding(12.dp), color = Color(0xFFB5472F),
                            fontSize = 11.sp
                        )
                    }
                }
                if (error != null) {
                    Surface(color = Color(0xFFFFF1F1), shape = RoundedCornerShape(12.dp)) {
                        Text(error.orEmpty(), color = Color(0xFFBC344A),
                            fontSize = 11.sp, modifier = Modifier.padding(11.dp))
                    }
                }
                if (!loading && issue != null && amount.isNotBlank() && methodEnabled) {
                    Text(walletErrorText(issue,lang), color = Color(0xFFB5472F), fontSize = 11.sp)
                }
                OutlinedButton(onClick = { refreshKey++ },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !busy && !loading,
                    shape = RoundedCornerShape(12.dp)) {
                    Icon(Icons.Default.Refresh, null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(7.dp))
                    Text(wTr(lang,"Refresh payment methods & rate","تازه‌سازی روش پرداخت و نرخ"),
                        fontSize = 11.sp)
                }
                Button(onClick = { confirm = true },
                    enabled = !busy && !loading && issue == null,
                    modifier = Modifier.fillMaxWidth().height(53.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = wBlue),
                    shape = RoundedCornerShape(15.dp)) {
                    if (busy) CircularProgressIndicator(Modifier.size(18.dp),
                        color = Color.White, strokeWidth = 2.dp)
                    else {
                        Icon(Icons.Default.Shield, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(7.dp))
                        Text(wTr(lang,"Review and continue","بررسی و ادامه"),
                            fontWeight = FontWeight.Black)
                    }
                }
            } else {
                WalletReceipt(
                    receipt = receipt!!, lang = lang,
                    onClose = onDismiss,
                    onCheck = {
                        val previous = receipt ?: return@WalletReceipt
                        if (busy || previous.publicId.isBlank()) return@WalletReceipt
                        scope.launch {
                            busy = true
                            try {
                                receipt = model.walletVoucherStatus(previous.publicId)
                                model.refreshAccount()
                            } catch (_: Exception) {
                                error = wTr(lang, "Unable to check status. Try again later.",
                                    "بررسی وضعیت ممکن نشد؛ کمی بعد تلاش کنید.")
                            } finally { busy = false }
                        }
                    },
                    checking = busy
                )
                if (error != null) Text(error.orEmpty(), color = Color(0xFFBC344A),
                    fontSize = 11.sp)
                TextButton(onClick = onOpenHistory) {
                    Text(wTr(lang,"Open payment history","مشاهده تاریخچه پرداخت‌ها"))
                }
            }
        }
    }

    if (picker.isNotBlank()) {
        AlertDialog(
            onDismissRequest = { picker = "" },
            title = { Text(if (picker == "coin")
                wTr(lang,"Choose cryptocurrency","انتخاب رمزارز")
            else wTr(lang,"Select network","انتخاب شبکه")) },
            text = {
                Column(Modifier.heightIn(max = 410.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (picker == "coin") walletCoins.forEach { item ->
                        WalletMenuRow(
                            item.code, item.name,
                            leading = { CryptoLogo(item) },
                            onClick = {
                                coin = item.code
                                network = item.networkOptions.first()
                                picker = ""
                            }
                        )
                    } else selectedCoin.networkOptions.forEach { option ->
                        WalletMenuRow(option,wTr(lang,"Blockchain network","شبکه بلاکچین"),
                            leading = {
                                Icon(Icons.Default.Hub, null, tint = wBlue,
                                    modifier = Modifier.size(25.dp))
                            },
                            onClick = { network = option; picker = "" })
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { picker = "" }) {
                    Text(wTr(lang,"Close","بستن"))
                }
            }
        )
    }
    if (confirm) {
        AlertDialog(
            onDismissRequest = { if (!busy) confirm = false },
            icon = { Icon(Icons.Default.Security, null, tint = wBlue) },
            title = {
                Text(if (isDeposit)
                    wTr(lang,"Confirm deposit details","تأیید مشخصات واریز")
                else wTr(lang,"Confirm withdrawal","تأیید نهایی برداشت"))
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(amountReadable, fontSize = 21.sp, color = wText,
                        fontWeight = FontWeight.Black)
                    Text(if (voucher) {
                        if (method == "voucher_uvoucher") "U-Voucher" else "HotVoucher"
                    } else "$coin · $network", color = wMuted, fontSize = 12.sp)
                    if (!isDeposit)
                        Text(wTr(lang,"Destination: ","مقصد: ") + destination.trim(),
                            color = wText, fontSize = 11.sp)
                    if (isDeposit)
                        Text(wTr(lang,
                            "Payment will be credited only after provider confirmation.",
                            "شارژ فقط پس از تأیید درگاه در موجودی ثبت می‌شود."),
                            color = wMuted, fontSize = 11.sp)
                    else Text(wTr(lang,
                        "Check all details carefully. Confirming submits a real withdrawal request.",
                        "تمام مشخصات را دقیق بررسی کنید؛ تأیید، درخواست برداشت واقعی ثبت می‌کند."),
                        color = Color(0xFF9F6319), fontSize = 11.sp)
                }
            },
            confirmButton = {
                Button(onClick = ::submit, enabled = !busy && issue == null,
                    colors = ButtonDefaults.buttonColors(containerColor = wBlue)) {
                    Text(wTr(lang,"Confirm","تأیید نهایی"))
                }
            },
            dismissButton = {
                TextButton(onClick = { confirm = false }, enabled = !busy) {
                    Text(wTr(lang,"Cancel","انصراف"))
                }
            }
        )
    }
}
