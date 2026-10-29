package com.betvima.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import com.betvima.app.R
import android.widget.Toast
import androidx.compose.animation.core.tween
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

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
    onBackToTop: () -> Unit,
    seamlessBackground: Boolean = false
) {
    var informationOpen by rememberSaveable { mutableStateOf(false) }
    var informationPage by rememberSaveable { mutableStateOf<String?>(null) }
    var categoriesOpen by rememberSaveable { mutableStateOf(false) }
    var languageOpen by rememberSaveable { mutableStateOf(false) }
    var linkCopied by remember { mutableStateOf(false) }
    LaunchedEffect(linkCopied) {
        if (linkCopied) {
            delay(2_000)
            linkCopied = false
        }
    }
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
                    tr(lang, "No email app available", "برنامه ایمیل در دسترس نیست"),
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
        val chooserTitle = tr(lang, "Share BetVima", "اشتراک‌گذاری بت‌ویما")
        // Open the selected app directly when installed; fall back to Android Sharesheet.
        // Never invent official BetVima social account URLs.
        val directTarget = targetPackage?.let { Intent(base).apply { setPackage(it) } }
        val launched = directTarget?.let { runCatching { context.startActivity(it) }.isSuccess } ?: false
        if (!launched) {
            runCatching {
                context.startActivity(Intent.createChooser(base, chooserTitle))
            }.onFailure {
                Toast.makeText(context,
                    tr(lang, "No sharing app available", "برنامه‌ای برای اشتراک‌گذاری یافت نشد"),
                    Toast.LENGTH_SHORT).show()
            }
        }
    }
    fun copyLink() {
        runCatching {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                ?: error("Clipboard unavailable")
            clipboard.setPrimaryClip(ClipData.newPlainText("BetVima", "https://betvima.com"))
            linkCopied = true
            Toast.makeText(context,
                tr(lang, "Link copied", "لینک کپی شد"), Toast.LENGTH_SHORT).show()
        }.onFailure {
            Toast.makeText(context,
                tr(lang, "Could not copy link", "کپی لینک امکان‌پذیر نیست"),
                Toast.LENGTH_SHORT).show()
        }
    }

    Column(
        Modifier.fillMaxWidth()
            .padding(top = if (state.feature == Feature.CASINO) 0.dp else 26.dp)
            .background(
                Brush.verticalGradient(
                    if (seamlessBackground) listOf(ChromeTokens.black, ChromeTokens.black)
                    else listOf(
                        if (state.feature == Feature.CASINO) Color(0xFF141414) else Color(0xFF18191C),
                        footerInk, Color(0xFF0C0D0F)
                    )
                ))
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
                    Text(when(lang) { Lang.FA -> "🇮🇷"; Lang.TR -> "🇹🇷"; Lang.DARI -> "🇦🇫"; Lang.HY -> "🇦🇲"; Lang.AR -> "🇸🇦"; Lang.AZ -> "🇦🇿"; Lang.RU -> "🇷🇺"; Lang.EN -> "🇬🇧" }, fontSize = 19.sp)
                    Spacer(Modifier.width(5.dp))
                    Text(when(lang) { Lang.FA -> "FA"; Lang.TR -> "TR"; Lang.DARI -> "DR"; Lang.HY -> "HY"; Lang.AR -> "AR"; Lang.AZ -> "AZ"; Lang.RU -> "RU"; Lang.EN -> "EN" },
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
            legalLinks.forEachIndexed { index, (name, _, icon) ->
                FooterMenuAction(name, icon) {
                    informationPage = when (index) {
                        0 -> "terms"
                        1 -> "privacy"
                        else -> "responsible"
                    }
                }
            }
            FooterMenuAction(tr(lang, "Visit BetVima", "وب‌سایت بت‌ویما"),
                Icons.Default.Public) {
                informationPage = "guide"
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
                    value = "BetVima • Partners\nVimaPartner@gmail.com", icon = Icons.Default.OpenInNew
                ) { email("VimaPartner@gmail.com") }
                HorizontalDivider(color = Color.White.copy(alpha = .12f))
                FooterContactRow(
                    title = tr(lang, "Support email", "ایمیل پشتیبانی"),
                    value = "BetVima • Support\nBetVimaSupport@gmail.com", icon = Icons.Default.Email
                ) { email("BetVimaSupport@gmail.com") }
            }
        }

        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = Color(0xFF17191F),
            border = BorderStroke(1.dp, Color.White.copy(alpha = .12f))
        ) {
            Column(
                Modifier.fillMaxWidth()
                    .background(Brush.verticalGradient(listOf(
                        Color(0xFF1E2026), Color(0xFF14161B), Color(0xFF101319))))
                    .padding(horizontal = 13.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(tr(lang, "SHARE BETVIMA", "اشتراک‌گذاری بت‌ویما"),
                    fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFC4CBD7),
                    letterSpacing = 1.sp)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FooterSocialAction(
                        label = "WhatsApp", accent = Color(0xFF25D366),
                        modifier = Modifier.weight(1f), onClick = { share("com.whatsapp") }
                    ) {
                        Icon(painterResource(R.drawable.ic_social_whatsapp), null,
                            tint = Color.Unspecified, modifier = Modifier.size(27.dp))
                    }
                    FooterSocialAction(
                        label = "Telegram", accent = Color(0xFF28A8EA),
                        modifier = Modifier.weight(1f), onClick = { share("org.telegram.messenger") }
                    ) {
                        Icon(painterResource(R.drawable.ic_social_telegram), null,
                            tint = Color.Unspecified, modifier = Modifier.size(27.dp))
                    }
                    FooterSocialAction(
                        label = "X", accent = Color.White,
                        modifier = Modifier.weight(1f), onClick = { share("com.twitter.android") }
                    ) {
                        Icon(painterResource(R.drawable.ic_social_x), null,
                            tint = Color.Unspecified, modifier = Modifier.size(22.dp))
                    }
                    FooterSocialAction(
                        label = tr(lang, "Share", "اشتراک‌گذاری"), accent = Color(0xFFC7D7EF),
                        modifier = Modifier.weight(1f), onClick = { share() }
                    ) {
                        Icon(Icons.Default.Share, null, tint = Color(0xFFE4ECFA),
                            modifier = Modifier.size(25.dp))
                    }
                    FooterSocialAction(
                        label = tr(lang, "Copy link", "کپی لینک"),
                        accent = if (linkCopied) Palette.green else Color(0xFFC7D7EF),
                        modifier = Modifier.weight(1f), onClick = { copyLink() }
                    ) {
                        Icon(if (linkCopied) Icons.Default.Check else Icons.Default.Link,
                            null, tint = if (linkCopied) Palette.green else Color(0xFFE4ECFA),
                            modifier = Modifier.size(25.dp))
                    }
                }
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
    informationPage?.let { page ->
        FooterInformationSheet(
            id = page,
            lang = lang,
            onDismiss = { informationPage = null }
        )
    }
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
        Icon(icon, null, tint = Color(0xFF9BA3B0),
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
    label: String,
    accent: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
    icon: @Composable () -> Unit
) {
    val shape = RoundedCornerShape(16.dp)
    Surface(
        modifier = modifier.height(52.dp)
            .shadow(5.dp, shape)
            .clip(shape)
            .clickable(onClickLabel = label, role = Role.Button, onClick = onClick),
        shape = shape,
        color = Color(0xFF252830),
        border = BorderStroke(1.dp, accent.copy(alpha = .20f))
    ) {
        Box(
            Modifier.fillMaxSize()
                .background(Brush.linearGradient(listOf(
                    Color(0xFF31343C), Color(0xFF1C1F26)))),
            contentAlignment = Alignment.Center
        ) {
            icon()
        }
    }
}
