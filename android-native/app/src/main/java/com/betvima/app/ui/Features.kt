package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import kotlinx.coroutines.launch

@Composable
fun FeaturePage(state: AppState, model: AppViewModel) {
    // Keep the existing feature navigation. Settings and Support share the
    // premium dark chrome; unrelated features retain their original palette.
    if (state.feature == Feature.CASINO) {
        CasinoLobby(state, model)
        return
    }
    // Never draw the legacy full notifications page, including for a single
    // frame while BetvimaApp's navigation compatibility effect runs.
    if (state.feature == Feature.NOTIFICATIONS || state.feature == Feature.VIP ||
        state.feature == Feature.BONUSES) return
    val title = when (state.feature) {
        Feature.PROFILE -> tr(state.lang, "Settings", "تنظیمات")
        Feature.BONUSES -> tr(state.lang, "My Bonuses", "بونوس‌های من")
        Feature.VIP -> tr(state.lang, "VIP Club", "باشگاه VIP")
        Feature.SUPPORT -> tr(state.lang, "24/7 Support", "پشتیبانی ۲۴ ساعته")
        Feature.CASINO -> tr(state.lang, "Casino", "کازینو")
        Feature.AFFILIATE -> tr(state.lang, "Affiliate", "همکاری در فروش")
        Feature.NOTIFICATIONS -> tr(state.lang, "Notifications", "اعلان‌ها")
        else -> "BetVima"
    }
    val darkChrome = state.feature == Feature.SUPPORT ||
        state.feature == Feature.PROFILE
    Column(Modifier.fillMaxSize().background(
        if (darkChrome) Palette.headerDark else Palette.paper)) {
        Surface(color = if (darkChrome) Palette.headerDark else Color.White,
            shadowElevation = if (darkChrome) 0.dp else 1.dp) {
            Row(Modifier.fillMaxWidth().heightIn(min = 54.dp)
                .padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { model.feature(Feature.NONE) }) {
                    Icon(Icons.Default.ArrowBack,
                        tr(state.lang, "Back", "بازگشت"), tint = if (darkChrome) DarkHomePalette.ink else Palette.text)
                }
                Text(title, fontSize = 17.sp, fontWeight = FontWeight.Black,
                    color = if (darkChrome) DarkHomePalette.ink else Palette.text,
                    modifier = Modifier.weight(1f))
                Surface(color = if (state.feature == Feature.VIP) Color(0xFFEAF4FF)
                    else if (darkChrome) DarkHomePalette.panel else Palette.greenLight,
                    shape = RoundedCornerShape(10.dp)) {
                    Icon(if (state.feature == Feature.VIP) Icons.Default.WorkspacePremium
                        else Icons.Default.VerifiedUser, null,
                        tint = if (state.feature == Feature.VIP || darkChrome) Palette.blue else Palette.ink,
                        modifier = Modifier.padding(8.dp).size(19.dp))
                }
            }
        }
        when (state.feature) {
            Feature.PROFILE -> ProfilePage(state, model)
            Feature.VIP -> PremiumVipClubPage(state, model)
            Feature.BONUSES -> BonusPage(state, model)
            Feature.SUPPORT -> SupportPage(state, model)
            Feature.CASINO -> CasinoLobby(state, model)
            Feature.AFFILIATE -> AffiliateDashboard(state, model)
            Feature.NOTIFICATIONS -> Unit
            else -> Unit
        }
    }
}

@Composable
private fun BonusPage(state: AppState, model: AppViewModel) {
    PremiumBonusesPage(state, model)
}

@Composable
private fun SupportPage(state: AppState, model: AppViewModel) {
    PremiumSupportPage(state, model)
}

@Composable
private fun AffiliatePage(state: AppState) {
    val uri = LocalUriHandler.current
    Column(Modifier.verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Surface(color = Palette.ink, shape = RoundedCornerShape(22.dp)) {
            Column(Modifier.padding(22.dp)) {
                Icon(Icons.Default.Groups, null, tint = Palette.green, modifier = Modifier.size(34.dp))
                Text(tr(state.lang, "BetVima Partners", "همکاران بت‌ویما"), color = Color.White,
                    fontSize = 23.sp, fontWeight = FontWeight.Black)
                Text(tr(state.lang, "Referral links, codes, commissions and payout statements.",
                    "لینک‌ها و کدهای معرفی، کمیسیون و گزارش پرداخت‌ها."),
                    color = Color(0xFFACC3C8), fontSize = 12.sp)
            }
        }
        Text(tr(state.lang,
            "Partner onboarding remains protected by the existing web authentication flow.",
            "ثبت‌نام همکاران فعلاً از طریق مسیر احراز هویت امن سایت انجام می‌شود."),
            color = Palette.muted, fontSize = 12.sp)
        Button(onClick = { uri.openUri("https://betvima.com/affiliate") },
            colors = ButtonDefaults.buttonColors(containerColor = Palette.green),
            modifier = Modifier.fillMaxWidth()) {
            Text(tr(state.lang, "Open partner portal", "ورود به پنل همکاران"), color = Palette.ink)
        }
    }
}

@Composable
private fun SimpleFeaturePage(title: String, detail: String, lang: Lang) {
    Column(Modifier.fillMaxSize().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(60.dp))
        Icon(Icons.Default.Shield, null, tint = Palette.blue, modifier = Modifier.size(52.dp))
        Spacer(Modifier.height(16.dp))
        Text(title, fontSize = 22.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.height(12.dp))
        Text(detail, textAlign = TextAlign.Center, fontSize = 13.sp,
            lineHeight = 21.sp, color = Palette.muted)
        ResponsibleNote(lang)
    }
}
