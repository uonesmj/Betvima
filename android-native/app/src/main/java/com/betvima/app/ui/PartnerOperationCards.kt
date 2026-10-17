package com.betvima.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import org.json.JSONObject

private val infoInk = Color(0xFF172033)
private val infoMuted = Color(0xFF718096)
private val infoBorder = Color(0xFFE2E6ED)
private val infoBlue = Color(0xFF1689EA)
private val infoPink = Color(0xFFE65399)
private val infoGreen = Color(0xFF0ACB81)

@Composable
internal fun PartnerInfoCard(
    title: String, subtitle: String, icon: androidx.compose.ui.graphics.vector.ImageVector,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(Modifier.fillMaxWidth(), color = Color.White,
        shape = RoundedCornerShape(22.dp), border = BorderStroke(1.dp, infoBorder),
        shadowElevation = 1.dp) {
        Column(Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(color=Color(0xFFEAF4FF),shape=RoundedCornerShape(12.dp)) {
                    Icon(icon, null,tint=infoBlue, modifier=Modifier.padding(10.dp).size(21.dp))
                }
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(title,fontSize=16.sp,fontWeight=FontWeight.Black,color=infoInk)
                    Text(subtitle,fontSize=11.sp,color=infoMuted,lineHeight=16.sp)
                }
            }
            content()
        }
    }
}

@Composable
internal fun PartnerField(label: String, value: String, modifier: Modifier = Modifier,
    emphasis: Color = infoInk) {
    Column(modifier.padding(vertical=5.dp),
        verticalArrangement=Arrangement.spacedBy(4.dp)) {
        Text(label,fontSize=10.sp,color=infoMuted,maxLines=2)
        Text(value.ifBlank { "—" },fontSize=12.sp,fontWeight=FontWeight.Bold,
            color=emphasis, maxLines=3,overflow=TextOverflow.Ellipsis)
    }
}

@Composable
internal fun PartnerStatusPill(status: String) {
    val normalized = status.lowercase()
    val bg = when(normalized) {
        "paid","approved","confirmed","posted","completed" -> Color(0xFFE8FAF1)
        "rejected","failed","cancelled" -> Color(0xFFFFEAF0)
        else -> Color(0xFFEAF3FF)
    }
    val ink = when(normalized) {
        "paid","approved","confirmed","posted","completed" -> Color(0xFF098657)
        "rejected","failed","cancelled" -> Color(0xFFB93462)
        else -> infoBlue
    }
    Surface(shape=RoundedCornerShape(50),color=bg) {
        Text(status.replace('_',' ').ifBlank { "—" },
            color=ink,fontWeight=FontWeight.Black,fontSize=10.sp,
            modifier=Modifier.padding(horizontal=10.dp,vertical=6.dp),
            maxLines=1)
    }
}

@Composable
internal fun PartnerEmptyPanel(lang:Lang, title:String, detail:String,
    icon:androidx.compose.ui.graphics.vector.ImageVector) {
    Surface(Modifier.fillMaxWidth(),color=Color.White,
        shape=RoundedCornerShape(20.dp),
        border=BorderStroke(1.dp,infoBorder)) {
        Column(Modifier.fillMaxWidth().padding(24.dp),
            horizontalAlignment=Alignment.CenterHorizontally,
            verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Icon(icon,null,tint=infoBlue,modifier=Modifier.size(28.dp))
            Text(title,fontSize=14.sp,color=infoInk,fontWeight=FontWeight.Black)
            Text(detail,fontSize=11.sp,color=infoMuted,lineHeight=17.sp)
        }
    }
}

@Composable
internal fun PartnerReferralCard(row: JSONObject, lang:Lang, currency:String,
    onCopy: (String)->Unit) {
    val userId = row.str("userId")
    // The upgraded API supplies authentic currency-separated ledger buckets.
    // Older aggregated totals must never be labeled as USD or IRR.
    val byCurrency = row.arr("financialByCurrency").objects()
    val single = byCurrency.singleOrNull()
    val singleCurrency = single?.str("currency") ?: ""
    val summaryDeposit = when {
        single != null -> money(single.str("depositMinor","0"),singleCurrency)
        byCurrency.size > 1 -> tr(lang,"Multiple currencies","چندارزی")
        else -> "—"
    }
    val summaryWithdrawal = when {
        single != null -> money(single.str("withdrawalMinor","0"),singleCurrency)
        byCurrency.size > 1 -> tr(lang,"Multiple currencies","چندارزی")
        else -> "—"
    }
    var expanded by rememberSaveable(userId) { mutableStateOf(false) }
    Surface(Modifier.fillMaxWidth(),color=Color.White,
        shape=RoundedCornerShape(20.dp),border=BorderStroke(1.dp,infoBorder)) {
        Column(Modifier.animateContentSize().padding(14.dp),
            verticalArrangement=Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.PersonOutline,null,tint=infoBlue,
                    modifier=Modifier.size(22.dp))
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(row.str("code").ifBlank { userId.take(10) },
                        fontSize=14.sp,fontWeight=FontWeight.Black,color=infoInk,
                        maxLines=1,overflow=TextOverflow.Ellipsis)
                    Text(tr(lang,"User ID: ","شناسه کاربر: ")+userId.take(13)+"…",
                        fontSize=10.sp,color=infoMuted)
                }
                PartnerStatusPill(row.str("status"))
                IconButton(onClick={expanded=!expanded}) {
                    Icon(if(expanded)Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        tr(lang,"Details","جزئیات"),tint=infoBlue)
                }
            }
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                PartnerField(tr(lang,"Total deposits","کل واریز"),
                    summaryDeposit,Modifier.weight(1f),infoGreen)
                PartnerField(tr(lang,"Total withdrawals","کل برداشت"),
                    summaryWithdrawal,Modifier.weight(1f),infoPink)
            }
            AnimatedVisibility(visible=expanded,
                enter=expandVertically()+fadeIn(),
                exit=shrinkVertically()+fadeOut()) {
                Column(verticalArrangement=Arrangement.spacedBy(5.dp)) {
                    Divider(color=infoBorder)
                    Text(tr(lang,"Registered user ID","شناسه کامل کاربر"),
                        fontSize=10.sp,color=infoMuted)
                    Row(verticalAlignment=Alignment.CenterVertically) {
                        Text(userId,Modifier.weight(1f),color=infoInk,
                            fontSize=11.sp,maxLines=2)
                        IconButton(onClick={onCopy(userId)}) {
                            Icon(Icons.Default.ContentCopy,
                                tr(lang,"Copy user ID","کپی شناسه"),
                                tint=infoBlue,modifier=Modifier.size(19.dp))
                        }
                    }
                    PartnerField(tr(lang,"Registration date","تاریخ ثبت‌نام"),
                        row.str("registeredAt").take(16).replace("T"," · ")
                            .ifBlank { "—" })
                    PartnerField(tr(lang,"Referral confirmation","تأیید معرفی"),
                        row.str("confirmedAt").take(16).replace("T"," · ")
                            .ifBlank { "—" })
                    if(byCurrency.isEmpty()) {
                        Text(tr(lang,
                            "Currency-specific financial history is not yet available; refresh after the API update.",
                            "اطلاعات مالی تفکیک‌شده هنوز از سرور دریافت نشده؛ پس از به‌روزرسانی API تازه‌سازی کنید."),
                            fontSize=11.sp,color=infoMuted,lineHeight=17.sp)
                    }
                    byCurrency.forEach { bucket ->
                        val code=bucket.str("currency")
                        Divider(color=infoBorder)
                        Row(verticalAlignment=Alignment.CenterVertically) {
                            Icon(Icons.Default.AccountBalanceWallet,null,
                                tint=infoBlue,modifier=Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(code, fontWeight=FontWeight.Black,
                                color=infoBlue,fontSize=13.sp)
                        }
                        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                            PartnerField(tr(lang,"Deposits","واریزها"),
                                money(bucket.str("depositMinor","0"),code),
                                Modifier.weight(1f),infoGreen)
                            PartnerField(tr(lang,"Withdrawals","برداشت‌ها"),
                                money(bucket.str("withdrawalMinor","0"),code),
                                Modifier.weight(1f),infoPink)
                        }
                        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                            PartnerField(tr(lang,"Total wagered","گردش شرط"),
                                money(bucket.str("wageredMinor","0"),code),
                                Modifier.weight(1f))
                            PartnerField(tr(lang,"Player P/L","سود و زیان کاربر"),
                                money(bucket.str("playerNetMinor","0"),code),
                                Modifier.weight(1f))
                        }
                        PartnerField(tr(lang,"Posted affiliate ledger","گردش کمیسیون ثبت‌شده"),
                            money(bucket.str("ledgerMinor","0"),code),
                            emphasis=infoBlue)
                    }
                }
            }
        }
    }
}

@Composable
internal fun PartnerLedgerCard(row:JSONObject, lang:Lang,currency:String) {
    var expanded by rememberSaveable(row.str("id")) { mutableStateOf(false) }
    Surface(Modifier.fillMaxWidth(),color=Color.White,
        shape=RoundedCornerShape(19.dp),border=BorderStroke(1.dp,infoBorder)) {
        Column(Modifier.animateContentSize().padding(14.dp),
            verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.ReceiptLong,null,tint=infoBlue)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(row.str("type").replace('_',' '),
                        fontSize=12.sp,fontWeight=FontWeight.Black,color=infoInk)
                    Text(row.str("createdAt").take(16).replace("T"," · "),
                        fontSize=10.sp,color=infoMuted)
                }
                Text(row.str("amountMinor").takeIf {it.isNotBlank()}
                    ?.let{money(it,currency)}?:"—",fontSize=12.sp,
                    fontWeight=FontWeight.Black,
                    color=if(row.str("direction")=="debit")infoPink else infoGreen)
                IconButton(onClick={expanded=!expanded}) {
                    Icon(if(expanded)Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        tr(lang,"Details","جزئیات"),tint=infoBlue)
                }
            }
            AnimatedVisibility(visible=expanded) {
                Column {
                    Divider(color=infoBorder)
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        PartnerField(tr(lang,"Status","وضعیت"),row.str("status"),
                            Modifier.weight(1f))
                        PartnerField(tr(lang,"Source","منبع"),row.str("sourceKind"),
                            Modifier.weight(1f))
                    }
                    PartnerField(tr(lang,"Related user ID","شناسه کاربر مرتبط"),
                        row.str("userId").ifBlank{"—"})
                    PartnerField(tr(lang,"Ledger reason","شرح گردش"),
                        row.str("reason").ifBlank{"—"})
                }
            }
        }
    }
}

@Composable
internal fun PartnerPayoutHistoryCard(row:JSONObject,lang:Lang,currency:String) {
    var expanded by rememberSaveable(row.str("id")) { mutableStateOf(false) }
    val status=row.str("status")
    Surface(Modifier.fillMaxWidth(),color=Color.White,
        shape=RoundedCornerShape(20.dp),border=BorderStroke(1.dp,infoBorder)) {
        Column(Modifier.animateContentSize().padding(15.dp),
            verticalArrangement=Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.Payments,null,tint=infoBlue,
                    modifier=Modifier.size(22.dp))
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(row.str("publicId",row.str("id").take(12)),
                        fontSize=12.sp,fontWeight=FontWeight.Black,color=infoInk,
                        maxLines=1,overflow=TextOverflow.Ellipsis)
                    Text(row.str("requestedAt").take(16).replace("T"," · "),
                        fontSize=10.sp,color=infoMuted)
                }
                PartnerStatusPill(status)
            }
            Row(verticalAlignment=Alignment.CenterVertically) {
                Text(row.str("amountMinor").takeIf {it.isNotBlank()}
                        ?.let{money(it,currency)}?:"—",
                    modifier=Modifier.weight(1f),fontSize=18.sp,
                    fontWeight=FontWeight.Black,color=infoInk)
                Text(row.str("payoutAsset",row.str("method")),
                    fontSize=11.sp,color=infoBlue,fontWeight=FontWeight.Bold)
                IconButton(onClick={expanded=!expanded}) {
                    Icon(if(expanded)Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        tr(lang,"Payout details","جزئیات برداشت"),tint=infoBlue)
                }
            }
            AnimatedVisibility(visible=expanded) {
                Column(verticalArrangement=Arrangement.spacedBy(5.dp)) {
                    Divider(color=infoBorder)
                    PartnerField(tr(lang,"Destination (masked)","مقصد برداشت (مخفی‌شده)"),
                        row.str("destinationMasked").ifBlank { "—" })
                    val date=when(status.lowercase()) {
                        "paid"->row.str("paidAt")
                        "approved","processing"->row.str("approvedAt")
                        "rejected"->row.str("rejectedAt")
                        else->""
                    }
                    PartnerField(tr(lang,"Last processing date","تاریخ آخرین رسیدگی"),
                        date.take(16).replace("T"," · ").ifBlank{"—"})
                    if (status.equals("rejected",true)||status.equals("failed",true)) {
                        PartnerField(tr(lang,"Reason","علت"),
                            row.str("rejectionReason").ifBlank{"—"},emphasis=infoPink)
                    }
                    PartnerField(tr(lang,"Request reference","شناسه درخواست"),
                        row.str("id"))
                }
            }
        }
    }
}

@Composable
internal fun PartnerCampaignCard(row:JSONObject,lang:Lang,
    onCopy:(String)->Unit,onShare:(String)->Unit) {
    val url=row.str("url")
    val valid=url.startsWith("https://")
    Surface(Modifier.fillMaxWidth(),color=Color.White,shape=RoundedCornerShape(19.dp),
        border=BorderStroke(1.dp,infoBorder)) {
        Column(Modifier.padding(15.dp),verticalArrangement=Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.Link,null,tint=infoBlue)
                Spacer(Modifier.width(8.dp))
                Text(row.str("campaign").ifBlank {row.str("code")},
                    modifier=Modifier.weight(1f),fontWeight=FontWeight.Black,
                    fontSize=13.sp,color=infoInk,maxLines=2)
                PartnerStatusPill(if (row.optBoolean("is_active",true))
                    tr(lang,"Active","فعال") else tr(lang,"Inactive","غیرفعال"))
            }
            Text(url.ifBlank{"—"},fontSize=11.sp,color=infoBlue,
                maxLines=2,overflow=TextOverflow.Ellipsis)
            Row(horizontalArrangement=Arrangement.spacedBy(9.dp)) {
                PartnerField(tr(lang,"Clicks","کلیک‌ها"),row.optInt("clicks").toString(),
                    Modifier.weight(1f))
                PartnerField(tr(lang,"Created at","تاریخ ساخت"),
                    row.str("created_at").take(10).ifBlank{"—"},Modifier.weight(1f))
            }
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick={onCopy(url)},enabled=valid,
                    modifier=Modifier.weight(1f)) {
                    Icon(Icons.Default.ContentCopy,null,modifier=Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(tr(lang,"Copy","کپی"),fontSize=11.sp)
                }
                OutlinedButton(onClick={onShare(url)},enabled=valid,
                    modifier=Modifier.weight(1f)) {
                    Icon(Icons.Default.Share,null,modifier=Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(tr(lang,"Share","اشتراک"),fontSize=11.sp)
                }
            }
        }
    }
}
