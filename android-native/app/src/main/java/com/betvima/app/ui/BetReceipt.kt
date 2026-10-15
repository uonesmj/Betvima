package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.money
import kotlinx.coroutines.launch

private val receiptInk = Color(0xFF1C2932)
private val receiptMuted = Color(0xFF73808C)
private val receiptStroke = Color(0xFFE0E7EE)

/** Receipt status derives ONLY from the server's settlement and net accounting. */
internal fun receiptStatus(status: String, netMinor: String?, lang: Lang): String {
    if (status.lowercase() != "settled") return betStatus(status, lang)
    return when(netMinor?.toBigDecimalOrNull()?.signum()) {
        1 -> tr(lang, "Won", "برد")
        -1 -> tr(lang, "Lost", "باخت")
        0 -> tr(lang, "Stake returned", "برگشت مبلغ")
        else -> tr(lang, "Settled", "تسویه‌شده")
    }
}

internal fun receiptStatusColor(status: String, netMinor: String?): Color {
    if (status.lowercase() != "settled") return when(status.lowercase()) {
        "rejected" -> Palette.red
        "void", "refunded", "cancelled" -> Palette.blue
        else -> Palette.blue
    }
    return when(netMinor?.toBigDecimalOrNull()?.signum()) {
        1 -> Palette.green
        -1 -> Palette.red
        else -> Palette.blue
    }
}

/**
 * The receipt is now a light, compact continuation of My Bets.
 * No redundant full-screen black hero; no client-generated settlement state.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BetReceiptSheet(state: AppState, model: AppViewModel) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val dismiss: () -> Unit = {
        scope.launch {
            sheetState.hide()
            model.closeBet()
        }
    }
    ModalBottomSheet(
        onDismissRequest = dismiss,
        containerColor = Color(0xFFF3F6FA),
        sheetState = sheetState,
        dragHandle = { BottomSheetDefaults.DragHandle() }
    ) {
        val receipt = state.betDetail
        if (receipt == null) {
            Box(Modifier.fillMaxWidth().height(180.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Palette.blue)
            }
        } else {
            val accent = receiptStatusColor(receipt.status, receipt.netResultMinor)
            val settled = receipt.settledPayoutMinor != null
            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(start = 15.dp, end = 15.dp,
                    top = 4.dp, bottom = 40.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                flingBehavior = rememberPremiumFlingBehavior()
            ) {
                item(key = "receipt-overview") {
                    Surface(
                        color = Color.White, shape = RoundedCornerShape(21.dp),
                        border = BorderStroke(1.dp, receiptStroke)
                    ) {
                        Column(Modifier.fillMaxWidth().padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(13.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(color = Color(0xFFE8F3FF),
                                    shape = RoundedCornerShape(12.dp)) {
                                    Icon(Icons.Default.ReceiptLong, null,
                                        tint = Palette.blue,
                                        modifier = Modifier.padding(10.dp).size(22.dp))
                                }
                                Spacer(Modifier.width(10.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(tr(state.lang, "Bet receipt", "رسید شرط"),
                                        fontSize = 18.sp, fontWeight = FontWeight.Black,
                                        color = receiptInk)
                                    Text(receipt.publicId,
                                        color = receiptMuted, fontSize = 10.sp,
                                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                Surface(color = accent.copy(alpha = .11f),
                                    shape = RoundedCornerShape(9.dp)) {
                                    Text(receiptStatus(receipt.status,
                                        receipt.netResultMinor, state.lang),
                                        modifier = Modifier.padding(horizontal = 10.dp,
                                            vertical = 7.dp),
                                        color = accent, fontSize = 11.sp,
                                        fontWeight = FontWeight.Black)
                                }
                            }
                            if (receipt.placedAt.isNotBlank()) Text(
                                receipt.placedAt.take(19).replace("T", " · "),
                                color = receiptMuted, fontSize = 11.sp)
                            HorizontalDivider(color = receiptStroke)
                            Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                                ReceiptAmount(
                                    title = tr(state.lang, "Stake", "مبلغ شرط"),
                                    amount = money(receipt.stakeMinor, receipt.currency),
                                    modifier = Modifier.weight(1f),
                                    tint = receiptInk)
                                ReceiptAmount(
                                    title = if (settled)
                                        tr(state.lang, "Confirmed payout", "پرداخت قطعی")
                                    else tr(state.lang, "Potential return", "بازگشت احتمالی"),
                                    amount = money(
                                        receipt.settledPayoutMinor ?: receipt.potentialPayoutMinor,
                                        receipt.currency),
                                    modifier = Modifier.weight(1f),
                                    tint = if (settled) accent else receiptInk)
                            }
                            if (receipt.netResultMinor != null) {
                                Surface(color = accent.copy(alpha = .08f),
                                    shape = RoundedCornerShape(12.dp)) {
                                    Row(
                                        Modifier.fillMaxWidth().padding(horizontal = 12.dp,
                                            vertical = 10.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(tr(state.lang, "Net result", "سود / زیان خالص"),
                                            color = receiptMuted, fontSize = 11.sp,
                                            modifier = Modifier.weight(1f))
                                        Text(money(receipt.netResultMinor, receipt.currency),
                                            color = accent, fontWeight = FontWeight.Black,
                                            fontSize = 15.sp)
                                    }
                                }
                            } else {
                                Text(
                                    tr(state.lang,
                                        "Potential return is not credited until settlement.",
                                        "بازگشت احتمالی تا زمان تسویه به موجودی اضافه نمی‌شود."),
                                    color = receiptMuted, fontSize = 10.sp,
                                    lineHeight = 15.sp)
                            }
                        }
                    }
                }
                item(key = "receipt-selections-heading") {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 3.dp,
                            vertical = 6.dp)) {
                        Box(Modifier.width(4.dp).height(28.dp)
                            .background(Palette.green, RoundedCornerShape(4.dp)))
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(tr(state.lang, "Your selections", "انتخاب‌های شما"),
                                fontWeight = FontWeight.Black, color = receiptInk,
                                fontSize = 16.sp)
                            Text(tr(state.lang,
                                "Original accepted prices and verified selection status",
                                "ضرایب پذیرفته‌شده و وضعیت ثبت‌شده هر انتخاب"),
                                color = receiptMuted, fontSize = 10.sp)
                        }
                        Surface(color = Color.White, shape = RoundedCornerShape(10.dp)) {
                            Text(receipt.legs.size.toString(),
                                modifier = Modifier.padding(horizontal = 11.dp,
                                    vertical = 7.dp),
                                color = receiptInk, fontWeight = FontWeight.Black,
                                fontSize = 12.sp)
                        }
                    }
                }
                itemsIndexed(receipt.legs,
                    key = { index, leg -> leg.matchId + "-" + index }) { _, leg ->
                    BetSelectionOverview(
                        leg = leg, lang = state.lang,
                        modifier = Modifier.fillMaxWidth(),
                        resolvedMatch = state.matchForLeg(leg))
                }
                item(key = "receipt-footnote") {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 5.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.Top) {
                        Icon(Icons.Default.VerifiedUser, null, tint = Palette.green,
                            modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(7.dp))
                        Text(tr(state.lang,
                            "Read-only server receipt. Live score is informational and does not grade your bet.",
                            "رسید فقط‌خواندنی سرور است؛ امتیاز زنده صرفاً اطلاع‌رسانی است و شرط را تسویه نمی‌کند."),
                            color = receiptMuted, fontSize = 10.sp, lineHeight = 16.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun ReceiptAmount(
    title: String, amount: String, modifier: Modifier = Modifier,
    tint: Color = receiptInk
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(title, color = receiptMuted, fontSize = 11.sp, maxLines = 2)
        Text(amount, color = tint, fontWeight = FontWeight.Black,
            fontSize = 17.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
