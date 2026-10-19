package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import org.json.JSONObject
import java.math.BigDecimal

private val referralDark122 = Color(0xFF0C1711)
private val referralGreen122 = Color(0xFF36CE82)
private val referralMuted122 = Color(0xFF617866)
private val referralLine122 = Color(0xFFDFE9E0)

private fun signColor122(raw: String): Color {
    val value = raw.toBigDecimalOrNull() ?: BigDecimal.ZERO
    return when {
        value > BigDecimal.ZERO -> Color(0xFF168654)
        value < BigDecimal.ZERO -> Color(0xFFD3484B)
        else -> referralMuted122
    }
}

@Composable
internal fun AffiliateReferralCard122(row: JSONObject, lang: Lang, timezone:String = "Asia/Tehran") {
    val lifetime = row.arr("financialByCurrency").objects()
    val financial = if (row.has("periodFinancialByCurrency")) {
        row.arr("periodFinancialByCurrency").objects()
    } else lifetime
    val date = runCatching {
        Instant.parse(row.str("registeredAt")).atZone(ZoneId.of(timezone))
            .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
    }.getOrDefault(row.str("registeredAt").take(16).replace("T", " "))
    val playerId = row.str("numericId").takeUnless { it.isBlank() || it == "null" }
        ?: row.str("publicId").takeUnless { it.isBlank() || it == "null" }
        ?: row.str("userId").take(12) + "…"
    var expanded by remember(row.str("userId")) { mutableStateOf(false) }
    val deposited = lifetime.any {
        (it.str("depositMinor").toBigDecimalOrNull() ?: BigDecimal.ZERO) > BigDecimal.ZERO
    }
    val status = row.str("status", "pending")
    val inReview = status == "review" || status == "pending"
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, referralLine122),
        shadowElevation = 1.dp
    ) {
        Column(Modifier.fillMaxWidth()) {
            Row(Modifier.fillMaxWidth()
                .background(Brush.horizontalGradient(listOf(
                    Color(0xFFEDF8F0), Color(0xFFF7FBF8))))
                .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFD9F4E4)
                ) {
                    Icon(Icons.Default.Person, null, tint = Color(0xFF148751),
                        modifier = Modifier.padding(10.dp).size(19.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(playerId,
                        fontWeight = FontWeight.Black, fontSize = 13.sp,
                        color = referralDark122, maxLines = 1)
                    Text(
                        tr(lang, "Registered: ", "تاریخ ثبت‌نام: ") +
                            date.ifBlank { "—" },
                        color = referralMuted122, fontSize = 10.sp
                    )
                }
                Surface(
                    color = if (inReview) Color(0xFFFFF0CB)
                        else Color(0xFFDEF8E7),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        if (inReview) tr(lang, "Under review", "در انتظار بررسی")
                        else tr(lang, "Confirmed", "تأییدشده"),
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp),
                        color = if (inReview) Color(0xFF976509) else Color(0xFF168654),
                        fontWeight = FontWeight.Bold, fontSize = 10.sp
                    )
                }
            }

            Column(
                Modifier.fillMaxWidth().padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(11.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        if (deposited) Icons.Default.CheckCircle else Icons.Default.Info,
                        null,
                        tint = if (deposited) Color(0xFF168654) else referralMuted122,
                        modifier = Modifier.size(17.dp)
                    )
                    Spacer(Modifier.width(7.dp))
                    Text(
                        if (deposited) tr(lang, "Deposit recorded", "واریز ثبت شده")
                        else tr(lang, "No completed deposit recorded", "هنوز واریز موفق ثبت نشده"),
                        color = if (deposited) Color(0xFF168654) else referralMuted122,
                        fontSize = 11.sp, fontWeight = FontWeight.Bold
                    )
                }
                Text(tr(lang,"Selected period activity","فعالیت در بازه انتخاب‌شده"),
                    fontSize=11.sp,fontWeight=FontWeight.Bold,color=Color(0xFF0E7349))
                if (financial.isEmpty()) {
                    Text(
                        tr(lang, "No recorded transactions in the selected period.",
                            "در بازه انتخاب‌شده تراکنشی ثبت نشده است."),
                        color = referralMuted122, fontSize = 11.sp
                    )
                }
                financial.forEach { moneyRow ->
                    val currency = moneyRow.str("currency", "USD")
                    Text(currency, color = Color(0xFF147848),
                        fontWeight = FontWeight.Black, fontSize = 11.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        AffiliateReferralValue122(
                            Modifier.weight(1f),
                            tr(lang, "Deposits", "مجموع واریز"),
                            moneyRow.str("depositMinor", "0"), currency
                        )
                        AffiliateReferralValue122(
                            Modifier.weight(1f),
                            tr(lang, "Withdrawals", "مجموع برداشت"),
                            moneyRow.str("withdrawalMinor", "0"), currency
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        AffiliateReferralValue122(
                            Modifier.weight(1f),
                            tr(lang, "Player P/L", "سود و زیان کاربر"),
                            moneyRow.str("playerNetMinor", "0"), currency,
                            signed = true
                        )
                        AffiliateReferralValue122(
                            Modifier.weight(1f),
                            tr(lang, "Recorded commission", "کمیسیون ثبت‌شده"),
                            moneyRow.str("ledgerMinor", "0"), currency,
                            signed = true
                        )
                    }
                }
                OutlinedButton(onClick={ expanded=!expanded },
                    modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(12.dp),
                    border=BorderStroke(1.dp,Color(0xFFB7DEC6))) {
                    Icon(if(expanded)Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        null,modifier=Modifier.size(17.dp),tint=Color(0xFF158451))
                    Spacer(Modifier.width(6.dp))
                    Text(if(expanded)tr(lang,"Hide all-time details","بستن جزئیات کل دوره")
                        else tr(lang,"All-time financial details","جزئیات مالی از ابتدا تاکنون"),
                        fontSize=11.sp,fontWeight=FontWeight.Bold,color=Color(0xFF0F7045))
                }
                if(expanded) {
                    Text(tr(lang,"All-time deposits, withdrawals and settled P/L",
                        "مجموع واریز، برداشت و سود و زیان از ابتدا"),
                        fontSize=11.sp,fontWeight=FontWeight.Black,color=referralDark122)
                    if(lifetime.isEmpty()) {
                        Text(tr(lang,"No financial entries recorded yet","هنوز گردش مالی ثبت نشده است"),
                            fontSize=11.sp,color=referralMuted122)
                    }
                    lifetime.forEach { moneyRow ->
                        val currency=moneyRow.str("currency","USD")
                        Text(currency,color=Color(0xFF168654),fontWeight=FontWeight.Bold,fontSize=11.sp)
                        Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                            AffiliateReferralValue122(Modifier.weight(1f),
                                tr(lang,"Deposits","واریز"),moneyRow.str("depositMinor","0"),currency)
                            AffiliateReferralValue122(Modifier.weight(1f),
                                tr(lang,"Withdrawals","برداشت"),moneyRow.str("withdrawalMinor","0"),currency)
                        }
                        Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                            AffiliateReferralValue122(Modifier.weight(1f),
                                tr(lang,"Player P/L","سود و زیان کاربر"),
                                moneyRow.str("playerNetMinor","0"),currency,signed=true)
                            AffiliateReferralValue122(Modifier.weight(1f),
                                tr(lang,"Recorded commission","کمیسیون ثبت‌شده"),
                                moneyRow.str("ledgerMinor","0"),currency,signed=true)
                        }
                    }
                }
                Text(
                    tr(lang,
                        "Financial figures are recorded in their original currency. Review status never removes a signup from the count.",
                        "ارقام مالی با ارز اصلی ثبت می‌شوند و وضعیت بررسی، ثبت‌نام را از آمار حذف نمی‌کند."),
                    color=referralMuted122,fontSize=10.sp,lineHeight=16.sp
                )
            }
        }
    }
}

@Composable
private fun AffiliateReferralValue122(
    modifier: Modifier, label: String, raw: String, currency: String,
    signed: Boolean = false
) {
    Column(
        modifier.background(Color(0xFFF3F8F4), RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 11.dp)
    ) {
        Text(label, color = referralMuted122, fontSize = 10.sp,
            maxLines = 2, lineHeight = 14.sp)
        Spacer(Modifier.height(5.dp))
        Text(
            money(raw, currency),
            color = if (signed) signColor122(raw) else referralDark122,
            fontWeight = FontWeight.Black, fontSize = 13.sp,
            maxLines = 1, overflow = TextOverflow.Ellipsis
        )
    }
}

/** Period-level totals. Values from different currencies are deliberately never combined. */
@Composable
internal fun AffiliateReferralPeriodSummary124(row:JSONObject,lang:Lang) {
    val currency=row.str("currency","USD")
    Surface(color=Color(0xFFEAF8F0),shape=RoundedCornerShape(18.dp),
        border=BorderStroke(1.dp,Color(0xFFC7E7D5))) {
        Column(Modifier.fillMaxWidth().padding(14.dp),verticalArrangement=Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Text(currency,fontWeight=FontWeight.Black,color=Color(0xFF0A7245),
                    fontSize=14.sp,modifier=Modifier.weight(1f))
                Text(tr(lang,"Depositing users: ","کاربران واریزکننده: ") +
                    row.optInt("depositingUsers").toString(),
                    color=referralMuted122,fontSize=11.sp)
            }
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                AffiliateReferralValue122(Modifier.weight(1f),
                    tr(lang,"Period deposits","واریز دوره"),
                    row.str("depositMinor","0"),currency)
                AffiliateReferralValue122(Modifier.weight(1f),
                    tr(lang,"Period withdrawals","برداشت دوره"),
                    row.str("withdrawalMinor","0"),currency)
            }
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                AffiliateReferralValue122(Modifier.weight(1f),
                    tr(lang,"Settled player P/L","سود/زیان تسویه‌شده"),
                    row.str("playerNetMinor","0"),currency,signed=true)
                AffiliateReferralValue122(Modifier.weight(1f),
                    tr(lang,"Recorded commission","کمیسیون ثبت‌شده"),
                    row.str("ledgerMinor","0"),currency,signed=true)
            }
        }
    }
}
