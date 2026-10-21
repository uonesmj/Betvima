package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import org.json.JSONObject
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

private val financeInk159 = Color(0xFF10231D)
private val financeGreen159 = Color(0xFF13835C)
private val financeGray159 = Color(0xFF67766F)
private val financeDivider159 = Color(0xFFE0EAE4)
private val financeBg159 = Color(0xFFF5F8F5)

/** Use existing authoritative endpoint data: never generate financial values. */
internal fun affiliateRange159(from: LocalDate, to: LocalDate, today: LocalDate): Boolean =
    !to.isAfter(today) && !from.isAfter(to) &&
        ChronoUnit.DAYS.between(from, to) in 0..364

internal fun affiliatePresetStart159(days: Int, today: LocalDate): LocalDate {
    require(days in 1..365)
    return today.minusDays((days - 1).toLong())
}

@Composable
internal fun FinancePanel159(
    modifier: Modifier = Modifier,
    title: String? = null,
    subtitle: String? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier.fillMaxWidth()
            .background(Color.White, RoundedCornerShape(18.dp))
            .padding(horizontal = 16.dp, vertical = 15.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (!title.isNullOrBlank()) {
            Text(title, color = financeInk159, fontWeight = FontWeight.Black, fontSize = 17.sp)
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, color = financeGray159, fontSize = 11.sp, lineHeight = 17.sp)
            }
            HorizontalDivider(color = financeDivider159)
        }
        content()
    }
}

@Composable
internal fun FinanceSectionRow159(
    title: String,
    value: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    footnote: String? = null,
    onClick: (() -> Unit)? = null,
    valueColor: Color = financeInk159
) {
    Row(
        modifier.fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(color = Color(0xFFE8F5EE), shape = RoundedCornerShape(12.dp)) {
            Icon(icon, null, tint = financeGreen159,
                modifier = Modifier.padding(10.dp).size(20.dp))
        }
        Spacer(Modifier.width(11.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                color = financeInk159, maxLines = 2)
            if (!footnote.isNullOrBlank()) Text(footnote, fontSize = 10.sp,
                color = financeGray159, maxLines = 2)
        }
        Spacer(Modifier.width(7.dp))
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.Black,
            color = valueColor, maxLines = 2)
        if (onClick != null) Icon(Icons.Default.ChevronRight, null,
            tint = financeGray159, modifier = Modifier.size(19.dp))
    }
}

/** A solid, full-width financial cockpit rather than detached KPI tiles. */
@Composable
internal fun FinanceOverview159(
    lang: Lang,
    partner: JSONObject?,
    payable: JSONObject?,
    stats: JSONObject?,
    currency: String,
    rate: String,
    allReferrals: Int?,
    registrationDays: List<Int>,
    verifiedDaily: Boolean,
    selectedDays: Int,
    onDaysChange: (Int) -> Unit,
    onNavigate: (String) -> Unit
) {
    val available = payable?.str("payableMinor")?.takeIf(String::isNotBlank)
        ?.let { money(it, currency) } ?: "—"
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(
            Modifier.fillMaxWidth()
                .background(
                    Brush.linearGradient(listOf(Color(0xFF102E23),Color(0xFF0F1815))),
                    RoundedCornerShape(19.dp)
                )
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp)
        ) {
            Text(tr(lang,"PARTNER FINANCIAL OVERVIEW","نمای مالی حساب همکاری"),
                color = Color(0xFF81E6B0), fontSize = 11.sp,
                fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Text(available, color = Color.White, fontSize = 32.sp,
                fontWeight = FontWeight.Black, maxLines = 1,
                overflow = TextOverflow.Ellipsis)
            Text(tr(lang, "Available for approved payout", "قابل برداشت پس از تأیید"),
                color = Color(0xFFC8DAD0), fontSize = 11.sp)
            HorizontalDivider(color = Color.White.copy(alpha=.17f))
            Row(verticalAlignment=Alignment.CenterVertically) {
                Text(tr(lang,"Contract commission rate","نرخ کمیسیون قرارداد"),
                    color=Color(0xFFD6E7DE),fontSize=12.sp, modifier=Modifier.weight(1f))
                Text(rate,color=Color(0xFF71E4A8),fontSize=20.sp,fontWeight=FontWeight.Black)
            }
            Row(verticalAlignment=Alignment.CenterVertically) {
                Text(tr(lang,"Partner account status","وضعیت حساب همکاری"),
                    color=Color(0xFFD6E7DE),fontSize=12.sp,modifier=Modifier.weight(1f))
                Text(partner?.str("status")?.uppercase() ?: "—",
                    color=Color(0xFF71E4A8),fontWeight=FontWeight.Bold,fontSize=11.sp)
            }
        }
        FinancePanel159(title=tr(lang,"Performance dashboard","داشبورد عملکرد"),
            subtitle=tr(lang,"Server-verified results; financial balances are never estimated.",
                "نتایج تأییدشده سرور؛ موجودی مالی تخمین زده نمی‌شود.")) {
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                listOf(7,30,90,365).forEach { n ->
                    FilterChip(
                        modifier=Modifier.weight(1f), selected=selectedDays==n,
                        onClick={onDaysChange(n)},
                        label={ Text(if(n==365)"1y" else "${n}d",fontSize=11.sp) },
                        colors=FilterChipDefaults.filterChipColors(
                            selectedContainerColor=Color(0xFFD7F4E5),
                            selectedLabelColor=financeGreen159)
                    )
                }
            }
            val currentRegistrations = if(verifiedDaily) registrationDays.takeLast(selectedDays).sum().toString() else "—"
            val lastWeek = if(verifiedDaily) registrationDays.takeLast(7).sum().toString() else "—"
            val metrics = listOf(
                Triple(tr(lang,"All referrals","کل زیرمجموعه‌ها"), allReferrals?.toString() ?: "—", Icons.Default.Groups),
                Triple(tr(lang,"Period registrations","ثبت‌نام دوره"), currentRegistrations, Icons.Default.PersonAdd),
                Triple(tr(lang,"Last 7 days","۷ روز اخیر"), lastWeek, Icons.Default.DateRange),
                Triple(tr(lang,"Active users","کاربران فعال"), stats?.optInt("activeUsers")?.toString() ?: "—", Icons.Default.ShowChart),
                Triple(tr(lang,"First deposits","اولین واریزها"), stats?.optInt("firstDeposits")?.toString() ?: "—", Icons.Default.AccountBalanceWallet)
            )
            metrics.forEachIndexed { index, metric ->
                FinanceSectionRow159(metric.first, metric.second, metric.third)
                if(index!=metrics.lastIndex) HorizontalDivider(color=financeDivider159)
            }
        }
        FinancePanel159(title=tr(lang,"Partner operations","عملیات همکاری"),
            subtitle=tr(lang,"Manage accounts, commission history and settlements.",
                "مدیریت زیرمجموعه‌ها، گردش کمیسیون و تسویه‌ها")) {
            FinanceSectionRow159(tr(lang,"Referred accounts","حساب‌های زیرمجموعه"),
                tr(lang,"View details","مشاهده جزئیات"),Icons.Default.Groups,
                onClick={onNavigate.bindDestination159("referrals")})
            HorizontalDivider(color=financeDivider159)
            FinanceSectionRow159(tr(lang,"Commission ledger","گردش کمیسیون"),
                tr(lang,"Transaction history","تاریخچه مالی"),Icons.Default.ReceiptLong,
                onClick={onNavigate.bindDestination159("ledger")})
            HorizontalDivider(color=financeDivider159)
            FinanceSectionRow159(tr(lang,"Payouts and settlement","برداشت و تسویه"),
                tr(lang,"Review payments","بررسی پرداخت"),Icons.Default.Payments,
                onClick={onNavigate.bindDestination159("payouts")})
        }
    }
}

private fun ((String) -> Unit).bindDestination159(destination: String): () -> Unit =
    { this(destination) }

/** Ledger rows remain in a single connected table, with source IDs and status. */
@Composable
internal fun FinanceLedgerRow159(row: JSONObject, lang: Lang, currency: String) {
    var expanded by remember(row.str("id")) { mutableStateOf(false) }
    val rawAmount = row.str("amountMinor")
    val amount = rawAmount.takeIf(String::isNotBlank)?.let { money(it,currency) } ?: "—"
    val debit = row.str("direction") == "debit" || rawAmount.startsWith("-")
    Column {
        Row(Modifier.fillMaxWidth().clickable { expanded=!expanded }
            .padding(vertical=14.dp),verticalAlignment=Alignment.CenterVertically) {
            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                Text(row.str("type","commission").replace("_"," "),
                    color=financeInk159,fontWeight=FontWeight.Bold,fontSize=13.sp)
                Text(row.str("createdAt").take(16).replace("T"," · "),
                    color=financeGray159,fontSize=10.sp)
            }
            Column(horizontalAlignment=Alignment.End) {
                Text(amount, color=if(debit) Color(0xFFBA4147) else financeGreen159,
                    fontWeight=FontWeight.Black,fontSize=14.sp)
                Text(row.str("status","posted"),fontSize=10.sp,
                    color=financeGray159)
            }
            Icon(if(expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                null,tint=financeGray159,modifier=Modifier.size(19.dp))
        }
        if(expanded) {
            Column(Modifier.fillMaxWidth().background(financeBg159,
                RoundedCornerShape(12.dp)).padding(12.dp),
                verticalArrangement=Arrangement.spacedBy(7.dp)) {
                Text(tr(lang,"Reference: ","شناسه تراکنش: ")+row.str("id"),
                    color=financeGray159,fontSize=10.sp)
                Text(tr(lang,"Source: ","منبع: ")+row.str("sourceKind","—"),
                    color=financeGray159,fontSize=10.sp)
                val user=row.str("userId")
                if(user.isNotBlank()) Text(tr(lang,"Referred user: ","کاربر زیرمجموعه: ")+user.take(12),
                    color=financeGray159,fontSize=10.sp)
                val reason=row.str("reason")
                if(reason.isNotBlank()) Text(reason,color=financeInk159,fontSize=11.sp)
            }
        }
        HorizontalDivider(color=financeDivider159)
    }
}

@Composable
internal fun FinanceReferralRow159(row: JSONObject, lang: Lang, timezone: String) {
    var expanded by remember(row.str("userId")) { mutableStateOf(false) }
    val identity=row.str("numericId").ifBlank { row.str("publicId")
        .ifBlank { row.str("userId").take(12) } }
    val review=row.str("status") in listOf("pending","review")
    Column {
        Row(Modifier.fillMaxWidth().clickable { expanded=!expanded }
            .padding(vertical=13.dp),
            verticalAlignment=Alignment.CenterVertically) {
            Surface(color=Color(0xFFE4F7ED),shape=RoundedCornerShape(12.dp)) {
                Icon(Icons.Default.Person, null, tint=financeGreen159,
                    modifier=Modifier.padding(10.dp).size(20.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("#"+identity,color=financeInk159,
                    fontWeight=FontWeight.Black,fontSize=13.sp)
                Text(row.str("registeredAt").take(16).replace("T"," · "),
                    color=financeGray159,fontSize=10.sp)
            }
            Text(if(review) tr(lang,"Review","در بررسی") else tr(lang,"Confirmed","تأیید"),
                color=if(review) Color(0xFF94650C) else financeGreen159,
                fontSize=10.sp,fontWeight=FontWeight.Bold)
            Icon(if(expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                null,tint=financeGray159,modifier=Modifier.size(19.dp))
        }
        if(expanded) {
            Column(Modifier.fillMaxWidth().background(financeBg159,
                RoundedCornerShape(12.dp)).padding(12.dp),
                verticalArrangement=Arrangement.spacedBy(10.dp)) {
                FinanceReferralMoney159(lang, row.arr("periodFinancialByCurrency").objects(),
                    tr(lang,"Selected period","بازه انتخاب‌شده"))
                FinanceReferralMoney159(lang, row.arr("financialByCurrency").objects(),
                    tr(lang,"All-time financials","گردش مالی کل دوره"))
                Text(tr(lang,
                    "Figures retain each currency and are taken directly from your affiliate account.",
                    "مبالغ با ارز اصلی و مستقیماً از حساب افیلیت گزارش می‌شوند."),
                    fontSize=10.sp,color=financeGray159,lineHeight=16.sp)
            }
        }
        HorizontalDivider(color=financeDivider159)
    }
}

@Composable
private fun FinanceReferralMoney159(lang:Lang,values:List<JSONObject>,label:String) {
    Text(label,fontSize=12.sp,fontWeight=FontWeight.Black,color=financeInk159)
    if(values.isEmpty()) {
        Text(tr(lang,"No recorded financial activity","گردش مالی ثبت نشده است"),
            fontSize=11.sp,color=financeGray159)
    }
    values.forEach { item ->
        val c=item.str("currency","USD")
        Text(c,color=financeGreen159,fontSize=11.sp,fontWeight=FontWeight.Black)
        listOf(
            tr(lang,"Deposits","واریزها") to "depositMinor",
            tr(lang,"Withdrawals","برداشت‌ها") to "withdrawalMinor",
            tr(lang,"Player P/L","سود/زیان کاربر") to "playerNetMinor",
            tr(lang,"Commission","کمیسیون") to "ledgerMinor"
        ).forEachIndexed { index,pair ->
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                Text(pair.first,color=financeGray159,fontSize=11.sp,
                    modifier=Modifier.weight(1f))
                Text(money(item.str(pair.second,"0"),c),
                    color=if(index==2||index==3) financeGreen159 else financeInk159,
                    fontWeight=FontWeight.Bold,fontSize=12.sp)
            }
        }
    }
}

/**
 * Single reusable 1-to-365-day filter for referrals AND ledger.
 * All calendar boundaries are based on the affiliate settlement timezone.
 * Never pass invalid ranges to the server and never substitute lifetime money
 * for period money.
 */
@Composable
internal fun FinanceDateFilter159(
    lang: Lang,
    from: LocalDate,
    to: LocalDate,
    today: LocalDate,
    zone: ZoneId,
    selectedPreset: String,
    onPreset: (String) -> Unit,
    onDates: (LocalDate, LocalDate) -> Unit
) {
    val context=LocalContext.current
    FinancePanel159(
        title=tr(lang,"Reporting period","بازه گزارش"),
        subtitle=tr(lang,
            "Choose 1 to 365 days. Dates use your partner settlement timezone.",
            "از ۱ تا ۳۶۵ روز؛ تاریخ‌ها بر اساس منطقه زمانی تسویه حساب است.")
    ) {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement=Arrangement.spacedBy(7.dp)) {
            listOf(
                "1D" to "1D","7D" to "7D","30D" to "30D",
                "90D" to "90D","180D" to "180D","365D" to "1Y"
            ).forEach { (preset,label) ->
                FilterChip(
                    selected=selectedPreset==preset,
                    onClick={onPreset(preset)},
                    label={Text(label,fontSize=12.sp,fontWeight=FontWeight.Bold)},
                    colors=FilterChipDefaults.filterChipColors(
                        selectedContainerColor=Color(0xFFD5F2E1),
                        selectedLabelColor=financeGreen159)
                )
            }
        }
        Row(Modifier.fillMaxWidth(),
            horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            listOf(true,false).forEach { isStart ->
                val chosen=if(isStart)from else to
                OutlinedButton(
                    onClick={
                        android.app.DatePickerDialog(
                            context,
                            { _,year,month,day ->
                                val picked=LocalDate.of(year,month+1,day)
                                    .coerceIn(affiliatePresetStart159(365,today),today)
                                val newFrom=if(isStart) picked else
                                    from.coerceAtMost(picked)
                                val newTo=if(isStart) to.coerceAtLeast(picked) else picked
                                if(affiliateRange159(newFrom,newTo,today)) onDates(newFrom,newTo)
                            },
                            chosen.year,chosen.monthValue-1,chosen.dayOfMonth
                        ).apply {
                            datePicker.minDate=affiliatePresetStart159(365,today)
                                .atStartOfDay(zone).toInstant().toEpochMilli()
                            datePicker.maxDate=today.plusDays(1).atStartOfDay(zone)
                                .toInstant().toEpochMilli()-1
                        }.show()
                    },
                    modifier=Modifier.weight(1f),
                    shape=RoundedCornerShape(12.dp),
                    contentPadding=PaddingValues(horizontal=7.dp, vertical=10.dp),
                    border=BorderStroke(1.dp,financeDivider159)
                ) {
                    Icon(Icons.Default.CalendarMonth,null,modifier=Modifier.size(15.dp),
                        tint=financeGreen159)
                    Spacer(Modifier.width(4.dp))
                    Column {
                        Text(if(isStart)tr(lang,"From","از") else tr(lang,"To","تا"),
                            fontSize=9.sp,color=financeGray159)
                        Text(chosen.toString(),fontSize=11.sp,
                            fontWeight=FontWeight.Bold,color=financeInk159,
                            maxLines=1)
                    }
                }
            }
        }
        Text(tr(lang,"Timezone: ","منطقه زمانی: ")+zone.id,
            color=financeGray159,fontSize=10.sp)
    }
}
