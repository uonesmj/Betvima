package com.betvima.app.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.zIndex
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private data class BvDestination(
    val id: String, val en: String, val fa: String, val icon: ImageVector
)

private val bottomDestinations = listOf(
    BvDestination("menu", "Menu", "منو", Icons.Default.Menu),
    BvDestination("home", "Home", "خانه", Icons.Default.Home),
    BvDestination("casino", "Casino", "کازینو", Icons.Default.Casino),
    BvDestination("bets", "My Bets", "شرط‌های من", Icons.Default.ReceiptLong),
    BvDestination("sports", "Sports", "ورزش‌ها", Icons.Default.SportsSoccer),
    BvDestination("language", "Language", "زبان", Icons.Default.Language)
)

/**
 * A true fixed app footer, rendered in Scaffold.bottomBar outside the page scroll.
 * Six destinations, all at least 48dp tall, are always visible. Language lives
 * here, never in the authenticated/guest header.
 */
@Composable
fun ReferenceAnimatedBottomNav(
    state: AppState,
    menuOpen: Boolean = false,
    onNavigate: (String) -> Unit
) {
    val selected = when {
        menuOpen -> "menu"
        state.feature == Feature.CASINO -> "casino"
        state.tab == Tab.BETS && state.feature == Feature.NONE -> "bets"
        state.tab == Tab.LIVE || state.tab == Tab.SPORTS -> "sports"
        state.tab == Tab.HOME && state.feature == Feature.NONE -> "home"
        else -> ""
    }
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Surface(color = Color(0xFF101114), tonalElevation = 0.dp,
            shadowElevation = 10.dp) {
            Row(Modifier.fillMaxWidth().heightIn(min = 75.dp)
                .navigationBarsPadding()
                .padding(horizontal = 3.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically) {
                bottomDestinations.forEach { item ->
                    val active = selected == item.id
                    val tint by animateColorAsState(
                        if (active) Palette.blue else Color(0xFFB6BDCB),
                        animationSpec = tween(180), label = "footerTint")
                    val scale by animateFloatAsState(
                        if (active) 1.10f else 1f,
                        animationSpec = spring(
                            dampingRatio = Spring.DampingRatioMediumBouncy,
                            stiffness = Spring.StiffnessMedium), label = "footerScale")
                    val underline by animateDpAsState(
                        if (active) 22.dp else 0.dp,
                        animationSpec = spring(stiffness = Spring.StiffnessMedium),
                        label = "footerUnderline")
                    Column(Modifier.weight(1f).heightIn(min = 65.dp)
                        .clickable(role = Role.Tab) { onNavigate(item.id) }
                        .semantics { this.selected = active }
                        .padding(top = 8.dp, bottom = 3.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.SpaceBetween) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            if (item.id == "language") {
                                Text(if (state.lang == Lang.FA) "🇮🇷" else "🇬🇧",
                                    fontSize = 21.sp, modifier = Modifier.size(25.dp),
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                            } else {
                                Icon(item.icon,
                                    contentDescription = tr(state.lang, item.en, item.fa),
                                    tint = tint,
                                    modifier = Modifier.size(23.dp).graphicsLayer {
                                        scaleX = scale; scaleY = scale
                                    })
                            }
                            Text(tr(state.lang, item.en, item.fa),
                                fontSize = 9.sp, lineHeight = 12.sp,
                                fontWeight = if (active) FontWeight.Black
                                    else FontWeight.SemiBold,
                                color = if (item.id == "language") Color.White else tint,
                                maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Box(Modifier.width(underline).height(3.dp)
                            .clip(CircleShape).background(tint))
                    }
                }
            }
        }
    }
}

/**
 * Fixed bottom navigation plus a COMPACT, truly center-aligned bet-slip pill.
 *
 * The accessory rail is removed entirely when no selection exists, preventing
 * the unused dark rectangle seen in previous screenshots. With selections, a
 * 34dp rail is just large enough for the 30dp action (no oversized empty box).
 * The tab bar is never covered by the action.
 */
@Composable
fun ReferenceBottomBar(
    state: AppState,
    showSlip: Boolean,
    menuOpen: Boolean = false,
    onNavigate: (String) -> Unit,
    onSlip: () -> Unit
) {
    val hasSelection = showSlip && state.picks.isNotEmpty()
    Column(Modifier.fillMaxWidth().background(Color(0xFF101114))) {
        AnimatedVisibility(
            visible = hasSelection,
            enter = expandVertically(animationSpec = tween(180)) + fadeIn(tween(160)),
            exit = shrinkVertically(animationSpec = tween(160)) + fadeOut(tween(130))
        ) {
            Box(
                Modifier.fillMaxWidth().height(36.dp),
                contentAlignment = Alignment.Center
            ) {
                AnimatedFloatingBetslip(state.picks.size, state.lang, onSlip)
            }
        }
        HorizontalDivider(color = Color.White.copy(alpha = .11f), thickness = 1.dp)
        ReferenceAnimatedBottomNav(state, menuOpen, onNavigate)
    }
}

@Composable
fun AnimatedFloatingBetslip(
    count: Int,
    lang: Lang,
    onOpen: () -> Unit
) {
    val interactions = remember { MutableInteractionSource() }
    val pressed by interactions.collectIsPressedAsState()
    val scale by animateFloatAsState(
        if (pressed) .94f else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
        label = "compactSlipScale")
    Surface(
        color = Palette.blue, shape = RoundedCornerShape(13.dp),
        shadowElevation = 3.dp,
        modifier = Modifier.width(96.dp).height(31.dp)
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .clickable(
                interactionSource = interactions,
                indication = ripple(), onClick = onOpen)
    ) {
        Row(Modifier.fillMaxSize().padding(horizontal = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center) {
            Icon(Icons.Default.ConfirmationNumber,
                contentDescription = tr(lang, "Open bet slip", "باز کردن برگه شرط"),
                tint = Color.White, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(5.dp))
            AnimatedContent(
                targetState = count, label = "betslipCount",
                transitionSpec = {
                    (slideInVertically(tween(170)) { it / 2 } + fadeIn())
                        .togetherWith(slideOutVertically(tween(150)) { -it / 2 } + fadeOut())
                }
            ) { value ->
                Text(value.toString(), color = Color.White,
                    fontWeight = FontWeight.Black, fontSize = 13.sp)
            }
            Icon(Icons.Default.KeyboardArrowUp, null,
                tint = Color.White, modifier = Modifier.size(17.dp))
        }
    }
}
