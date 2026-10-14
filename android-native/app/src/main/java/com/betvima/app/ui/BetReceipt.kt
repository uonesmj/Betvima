package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.money
import com.betvima.app.data.odds

private fun legStatusLabel(raw: String, lang: Lang): String = when (raw.uppercase()) {
    "WON" -> tr(lang, "Won", "برنده")
    "LOST" -> tr(lang, "Lost", "بازنده")
    "VOID" -> tr(lang, "Void", "باطل")
    "HALF_WON" -> tr(lang, "Half won", "نیم‌برد")
    "HALF_LOST" -> tr(lang, "Half lost", "نیم‌باخت")
    "PENDING" -> tr(lang, "Pending", "در انتظار")
    "PENDING_REVIEW", "MANUAL_REVIEW" -> tr(lang, "Under review", "در حال بررسی")
    "CANCELLED" -> tr(lang, "Cancelled", "لغوشده")
    "REFUNDED" -> tr(lang, "Refunded", "برگشت‌خورده")
    else -> raw.replace("_", " ")
}

/** Server-authoritative read-only receipt: no client-side regrading or payout calculations. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BetReceiptSheet(state: AppState, model: AppViewModel) {
    ModalBottomSheet(
        onDismissRequest = model::closeBet,
        containerColor = Palette.paper,
        dragHandle = { BottomSheetDefaults.DragHandle() }
    ) {
        val receipt = state.betDetail
        if (receipt == null) {
            Box(Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Palette.green)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(start = 18.dp, end = 18.dp, bottom = 45.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Surface(color = Palette.ink, shape = RoundedCornerShape(22.dp)) {
                        Column(Modifier.fillMaxWidth().padding(20.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.ReceiptLong, null, tint = Palette.green)
                                Spacer(Modifier.width(9.dp))
                                Text(tr(state.lang, "Bet receipt", "رسید شرط"),
                                    color = Color.White, fontSize = 20.sp,
                                    fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                            }
                            Spacer(Modifier.height(10.dp))
                            Text(receipt.publicId, color = Color(0xFFB3C8CE),
                                fontSize = 11.sp)
                            if (receipt.placedAt.isNotBlank()) Text(
                                receipt.placedAt.replace("T", " · ").take(19),
                                color = Color(0xFFB3C8CE), fontSize = 10.sp)
                            Spacer(Modifier.height(13.dp))
                            SmallPill(betStatus(receipt.status, state.lang),
                                Palette.greenLight, Palette.ink)
                            Spacer(Modifier.height(14.dp))
                            Text(tr(state.lang, "Stake", "مبلغ شرط"),
                                color = Color(0xFFACBFC7), fontSize = 11.sp)
                            Text(money(receipt.stakeMinor, receipt.currency),
                                color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Black)
                            Spacer(Modifier.height(12.dp))
                            Text(if (receipt.settledPayoutMinor != null)
                                tr(state.lang, "Confirmed payout", "پرداخت قطعی")
                                else tr(state.lang, "Projected payout", "پرداخت احتمالی"),
                                color = Color(0xFFACBFC7), fontSize = 11.sp)
                            Text(money(receipt.settledPayoutMinor ?: receipt.potentialPayoutMinor,
                                receipt.currency), color = Palette.green,
                                fontWeight = FontWeight.Black, fontSize = 20.sp)
                            if (receipt.netResultMinor != null) {
                                Spacer(Modifier.height(8.dp))
                                Text(tr(state.lang, "Net result: ", "نتیجه خالص: ") +
                                    money(receipt.netResultMinor, receipt.currency),
                                    color = Color.White, fontSize = 12.sp)
                            }
                        }
                    }
                }
                item {
                    SectionHeading(tr(state.lang, "Selections", "انتخاب‌ها"),
                        tr(state.lang, "Original accepted odds and per-leg status",
                            "ضرایب زمان ثبت و وضعیت هر انتخاب"))
                }
                items(receipt.legs) { leg ->
                    Surface(color = Color.White, shape = RoundedCornerShape(16.dp),
                        border = BorderStroke(1.dp, Palette.border)) {
                        Column(Modifier.fillMaxWidth().padding(16.dp)) {
                            if (leg.league.isNotBlank()) Text(leg.league,
                                color = Palette.muted, fontSize = 10.sp)
                            Text(leg.matchLabel, color = Palette.text,
                                fontWeight = FontWeight.Black, fontSize = 13.sp)
                            Spacer(Modifier.height(6.dp))
                            Text(leg.marketLabel + " · " + leg.selectionLabel,
                                color = Palette.muted, fontSize = 11.sp)
                            Spacer(Modifier.height(11.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(tr(state.lang, "At placement", "هنگام ثبت") + "  " +
                                    odds(leg.oddsScaled), color = Palette.blue,
                                    fontWeight = FontWeight.Bold, fontSize = 12.sp,
                                    modifier = Modifier.weight(1f))
                                val status = if (leg.result.isNotBlank()) leg.result else leg.status
                                SmallPill(legStatusLabel(status, state.lang),
                                    Palette.paper, Palette.text)
                            }
                        }
                    }
                }
                item {
                    Text(tr(state.lang,
                        "This receipt reflects the server record. It cannot change settlement or available balances.",
                        "این رسید صرفاً سوابق سرور را نمایش می‌دهد و تغییری در تسویه یا موجودی ایجاد نمی‌کند."),
                        color = Palette.muted, fontSize = 11.sp)
                }
            }
        }
    }
}
