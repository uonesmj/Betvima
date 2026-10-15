package com.betvima.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val footerInk = Color(0xFF111214)
private val footerPanel = Color(0xFF202124)
private val footerMuted = Color(0xFF9FA3AF)

/**
 * Scrolling editorial footer inspired by the reference information architecture.
 * Belongs INSIDE the page's LazyColumn, not in Scaffold.bottomBar: the native
 * tab bar stays fixed and the footer is only reached at the end of content.
 *
 * All links navigate to verified BetVima destinations. Share affordances are
 * explicitly sharing controls, never fabricated "official" social accounts.
 */
@Composable
fun PremiumAppFooter(
    state: AppState,
    model: AppViewModel,
    onBackToTop: () -> Unit
) {
    var informationOpen by rememberSaveable { mutableStateOf(false) }
    var categoriesOpen by rememberSaveable { mutableStateOf(false) }
    var languageOpen by rememberSaveable { mutableStateOf(false) }
    val uriHandler = LocalUriHandler.current
    val context = LocalContext.current
    val lang = state.lang
    val legalLinks = listOf(
        Triple(tr(lang, "Terms & Conditions", "شرایط و قوانین"),
            "https://betvima.com/legal/terms", Icons.Default.Description),
        Triple(tr(lang, "Privacy policy", "حریم خصوصی"),
            "https://betvima.com/legal/privacy", Icons.Default.Shield),
        Triple(tr(lang, "Responsible gaming", "بازی مسئولانه"),
            "https://betvima.com/legal/responsible-gaming", Icons.Default.VerifiedUser)
    )
    fun email(address: String) {
        runCatching { uriHandler.openUri("mailto:$address") }
            .onFailure {
                Toast.makeText(context,
                    if (lang == Lang.FA) "برنامه ایمیل در دسترس نیست" else "No email app available",
                    Toast.LENGTH_SHORT).show()
            }
    }
    fun share(targetPackage: String? = null) {
        val invite = tr(lang,
            "BetVima — Sports and live events: https://betvima.com",
            "بت‌ویما — مسابقات ورزشی و زنده: https://betvima.com")
        val base = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, invite)
        }
        val target = Intent(base).apply { if (targetPackage != null) setPackage(targetPackage) }
        // Don't claim an account belongs to BetVima or force an uninstalled app.
        runCatching {
            context.startActivity(Intent.createChooser(target,
                tr(lang, "Share BetVima", "اشتراک‌گذاری بت‌ویما")))
        }.onFailure {
            runCatching {
                context.startActivity(Intent.createChooser(base,
                    tr(lang, "Share BetVima", "اشتراک‌گذاری بت‌ویما")))
            }
        }
    }
    fun copyLink() {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        clipboard?.setPrimaryClip(ClipData.newPlainText("BetVima", "https://betvima.com"))
        Toast.makeText(context,
            tr(lang, "Link copied", "لینک کپی شد"), Toast.LENGTH_SHORT).show()
    }

    Column(
        Modifier.fillMaxWidth()
            .padding(top = 26.dp)
            .background(
                Brush.verticalGradient(listOf(Color(0xFF18191C), footerInk, Color(0xFF0C0D0F))))
            .padding(start = 18.dp, end = 18.dp, top = 27.dp, bottom = 30.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // Brand bar + language and scroll-to-top controls, like reference layout.
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("BET", color = Color.White, fontSize = 25.sp,
                        fontWeight = FontWeight.Black, letterSpacing = (-1).sp)
                    Text("VIMA", color = Palette.green, fontSize = 25.sp,
                        fontWeight = FontWeight.Black, letterSpacing = (-1).sp)
                }
                Text(tr(lang, "THE GAME. ELEVATED.", "تجربه‌ای فراتر از بازی"),
                    color = footerMuted, fontSize = 9.sp, letterSpacing = .4.sp)
            }
            Spacer(Modifier.width(15.dp))
            Box(Modifier.weight(1f).height(1.dp)
                .background(Color.White.copy(alpha = .13f)))
            Spacer(Modifier.width(14.dp))
            Surface(
                color = Color(0xFF2B2D32), shape = RoundedCornerShape(13.dp),
                modifier = Modifier.clickable(role = Role.Button) { languageOpen = true }
            ) {
                Row(Modifier.heightIn(min = 48.dp)
                    .padding(horizontal = 10.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Text(if (lang == Lang.FA) "🇮🇷" else "🇬🇧", fontSize = 19.sp)
                    Spacer(Modifier.width(5.dp))
                    Text(if (lang == Lang.FA) "FA" else "EN",
                        color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    Icon(Icons.Default.ExpandMore,
                        tr(lang, "Select language", "انتخاب زبان"),
                        tint = footerMuted, modifier = Modifier.size(17.dp))
                }
            }
            Spacer(Modifier.width(7.dp))
            Surface(
                color = Color(0xFF2B2D32), shape = RoundedCornerShape(13.dp),
                modifier = Modifier.size(48.dp)
                    .clickable(role = Role.Button, onClick = onBackToTop)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.VerticalAlignTop,
                        tr(lang, "Back to top", "بازگشت به بالا"),
                        tint = Color.White, modifier = Modifier.size(25.dp))
                }
            }
        }

        FooterAccordion(
            title = tr(lang, "Information", "اطلاعات"),
            expanded = informationOpen,
            onToggle = { informationOpen = !informationOpen }
        ) {
            legalLinks.forEach { (name, url, icon) ->
                FooterMenuAction(name, icon) {
                    runCatching { uriHandler.openUri(url) }
                }
            }
            FooterMenuAction(tr(lang, "Visit BetVima", "وب‌سایت بت‌ویما"),
                Icons.Default.Public) {
                runCatching { uriHandler.openUri("https://betvima.com") }
            }
        }
        FooterAccordion(
            title = tr(lang, "Categories", "دسته‌بندی‌ها"),
            expanded = categoriesOpen,
            onToggle = { categoriesOpen = !categoriesOpen }
        ) {
            FooterMenuAction(tr(lang, "Home", "خانه"), Icons.Default.Home) {
                model.tab(Tab.HOME)
            }
            FooterMenuAction(tr(lang, "Live sports", "ورزش‌های زنده"), Icons.Default.Sensors) {
                model.tab(Tab.LIVE)
            }
            FooterMenuAction(tr(lang, "Upcoming", "مسابقات آینده"), Icons.Default.Event) {
                model.tab(Tab.SPORTS)
            }
            FooterMenuAction(tr(lang, "Casino", "کازینو"), Icons.Default.Casino) {
                model.feature(Feature.CASINO)
            }
            FooterMenuAction(tr(lang, "My Bets", "شرط‌های من"),
                Icons.Default.ReceiptLong) { model.tab(Tab.BETS) }
            FooterMenuAction(tr(lang, "Bonuses", "بونوس‌ها"), Icons.Default.CardGiftcard) {
                model.feature(Feature.BONUSES)
            }
            FooterMenuAction(tr(lang, "VIP Club", "باشگاه VIP"), Icons.Default.Stars) {
                model.feature(Feature.VIP)
            }
        }

        Surface(
            color = footerPanel, shape = RoundedCornerShape(23.dp),
            border = BorderStroke(1.dp, Color.White.copy(alpha = .035f)),
            modifier = Modifier.fillMaxWidth().clickable(role = Role.Button) {
                model.feature(Feature.SUPPORT)
            }
        ) {
            Row(Modifier.fillMaxWidth().padding(18.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(tr(lang, "Support", "پشتیبانی"), fontSize = 19.sp,
                            fontWeight = FontWeight.ExtraBold, color = Color.White)
                        Spacer(Modifier.width(6.dp))
                        Surface(color = Color.White, shape = CircleShape) {
                            Text("24/7", color = footerInk, fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                modifier = Modifier.padding(horizontal = 9.dp, vertical = 3.dp))
                        }
                        Spacer(Modifier.width(5.dp))
                        Icon(Icons.Default.ChevronRight, null,
                            tint = footerMuted, modifier = Modifier.size(20.dp))
                    }
                    Text(tr(lang, "Contact us if you still have questions",
                        "اگر سؤالی دارید، با تیم پشتیبانی در ارتباط باشید"),
                        color = footerMuted, fontSize = 13.sp, lineHeight = 20.sp)
                }
                Spacer(Modifier.width(12.dp))
                Box(Modifier.size(64.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Brush.linearGradient(listOf(
                        Color(0xFF4E789C), Palette.blue, Color(0xFF18384C)))),
                    contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Forum, null, tint = Color.White,
                        modifier = Modifier.size(32.dp))
                }
            }
        }
        Surface(
            color = footerPanel, shape = RoundedCornerShape(23.dp),
            border = BorderStroke(1.dp, Color.White.copy(alpha = .035f)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(horizontal = 18.dp, vertical = 18.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)) {
                FooterContactRow(
                    title = tr(lang, "Partner program", "برنامه همکاری"),
                    value = "VimaPartner@gmail.com", icon = Icons.Default.OpenInNew
                ) { email("VimaPartner@gmail.com") }
                HorizontalDivider(color = Color.White.copy(alpha = .12f))
                FooterContactRow(
                    title = tr(lang, "Support email", "ایمیل پشتیبانی"),
                    value = "BetVimaSupport@gmail.com", icon = Icons.Default.Email
                ) { email("BetVimaSupport@gmail.com") }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(tr(lang, "SHARE BETVIMA", "اشتراک‌گذاری بت‌ویما"),
                fontSize = 11.sp, fontWeight = FontWeight.Bold, color = footerMuted,
                letterSpacing = 1.sp)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                FooterSocialAction("WhatsApp", "WA", Modifier.weight(1f)) {
                    share("com.whatsapp")
                }
                FooterSocialAction("Telegram", "TG", Modifier.weight(1f)) {
                    share("org.telegram.messenger")
                }
                FooterSocialAction("X", "X", Modifier.weight(1f)) {
                    share("com.twitter.android")
                }
                FooterSocialAction(tr(lang, "Share", "اشتراک‌گذاری"), "↗",
                    Modifier.weight(1f)) { share() }
                FooterSocialAction(tr(lang, "Copy link", "کپی لینک"), "⛓",
                    Modifier.weight(1f)) { copyLink() }
            }
        }

        HorizontalDivider(color = Color.White.copy(alpha = .1f))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("© 2026 BetVima", fontWeight = FontWeight.SemiBold,
                    color = footerMuted, fontSize = 11.sp)
                Text("betvima.com", color = Color(0xFF77818E), fontSize = 10.sp,
                    modifier = Modifier.clickable {
                        runCatching { uriHandler.openUri("https://betvima.com") }
                    })
            }
            Text("18+", color = Color(0xFF838996),
                fontSize = 25.sp, fontWeight = FontWeight.Black)
        }
        Text(tr(lang,
            "Please play responsibly. Availability depends on local regulations.",
            "مسئولانه بازی کنید. دسترسی به خدمات تابع قوانین محل اقامت است."),
            fontSize = 10.sp, lineHeight = 16.sp, color = footerMuted,
            textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }

    if (languageOpen) LanguagePickerDialog(
        current = lang,
        onSelect = { selected -> model.setLanguage(selected); languageOpen = false },
        onDismiss = { languageOpen = false }
    )
}

@Composable
private fun FooterAccordion(
    title: String,
    expanded: Boolean,
    onToggle: () -> Unit,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().heightIn(min = 55.dp)
            .clickable(role = Role.Button, onClick = onToggle),
            verticalAlignment = Alignment.CenterVertically) {
            Text(title, color = Color.White, fontSize = 18.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.weight(1f))
            SmoothExpandChevron(expanded, description = title,
                tint = Color(0xFF959BA9), modifier = Modifier.size(27.dp))
        }
        AnimatedVisibility(
            visible = expanded,
            enter = expandVertically(animationSpec = tween(310)) + fadeIn(tween(210)),
            exit = shrinkVertically(animationSpec = tween(270)) + fadeOut(tween(180))
        ) {
            Column(Modifier.padding(bottom = 8.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
                content = content)
        }
    }
}

@Composable
private fun FooterMenuAction(
    title: String, icon: ImageVector, onClick: () -> Unit
) {
    Row(Modifier.fillMaxWidth().heightIn(min = 47.dp)
        .clip(RoundedCornerShape(12.dp))
        .clickable(role = Role.Button, onClick = onClick)
        .padding(horizontal = 9.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Palette.green,
            modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(11.dp))
        Text(title, fontWeight = FontWeight.Medium,
            color = Color(0xFFD7DBE3), fontSize = 13.sp,
            modifier = Modifier.weight(1f))
        Icon(Icons.Default.ChevronRight, null,
            tint = footerMuted, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun FooterContactRow(
    title: String, value: String, icon: ImageVector, onClick: () -> Unit
) {
    Row(Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, color = footerMuted, fontSize = 13.sp)
            Text(value, color = Color.White, fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        Icon(icon, title, tint = footerMuted, modifier = Modifier.size(22.dp))
    }
}

@Composable
private fun FooterSocialAction(
    label: String, mark: String, modifier: Modifier = Modifier, onClick: () -> Unit
) {
    Surface(
        modifier = modifier.height(50.dp).clickable(role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(15.dp),
        color = Color(0xFF292A2D),
        border = BorderStroke(1.dp, Color.White.copy(alpha = .045f))
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(mark, color = Color.White, fontWeight = FontWeight.Black,
                fontSize = if (mark.length > 1) 15.sp else 21.sp,
                maxLines = 1, textAlign = TextAlign.Center)
        }
    }
}
