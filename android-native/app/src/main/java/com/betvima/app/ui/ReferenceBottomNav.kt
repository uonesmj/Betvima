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
    BvDestination("bonus", "Free money", "پاداش‌ها", Icons.Default.MonetizationOn),
    BvDestination("sports", "Sports", "ورزش‌ها", Icons.Default.SportsSoccer)
)

@Composable
fun ReferenceAnimatedBottomNav(
    state: AppState,
    onNavigate: (String) -> Unit
) {
    val selected = when {
        state.feature == Feature.CASINO -> "casino"
        state.feature == Feature.BONUSES || state.feature == Feature.VIP -> "bonus"
        state.tab == Tab.LIVE || state.tab == Tab.SPORTS -> "sports"
        state.tab == Tab.HOME && state.feature == Feature.NONE -> "home"
        else -> ""
    }
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Surface(color = Color(0xFF121315), tonalElevation = 0.dp,
            shadowElevation = 4.dp) {
            Row(Modifier.fillMaxWidth().height(76.dp),
                verticalAlignment = Alignment.CenterVertically) {
                bottomDestinations.forEach { item ->
                    val active = selected == item.id
                    val tint by animateColorAsState(
                        if (active) Palette.blue else Color(0xFF989EAE),
                        animationSpec = tween(220), label = "bottomNavTint")
                    val scale by animateFloatAsState(
                        if (active) 1.15f else 1f,
                        animationSpec = spring(
                            dampingRatio = Spring.DampingRatioMediumBouncy,
                            stiffness = Spring.StiffnessMediumLow),
                        label = "bottomNavScale")
                    val underline by animateDpAsState(
                        if (active) 25.dp else 0.dp,
                        animationSpec = spring(stiffness = Spring.StiffnessMediumLow),
                        label = "bottomNavIndicator")
                    Column(Modifier.weight(1f).fillMaxHeight()
                        .clickable(role = Role.Tab) { onNavigate(item.id) }
                        .semantics { this.selected = active }
                        .padding(top = 9.dp, bottom = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.SpaceBetween) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(item.icon, contentDescription = tr(state.lang, item.en, item.fa),
                                tint = tint,
                                modifier = Modifier.size(24.dp).graphicsLayer {
                                    scaleX = scale; scaleY = scale
                                })
                            Spacer(Modifier.height(6.dp))
                            Text(tr(state.lang, item.en, item.fa),
                                fontSize = 10.sp, fontWeight = if (active)
                                    FontWeight.Black else FontWeight.SemiBold,
                                color = tint, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Box(Modifier.width(underline).height(3.dp)
                            .clip(CircleShape).background(tint))
                    }
                }
            }
        }
    }
}

@Composable
fun AnimatedFloatingBetslip(
    count: Int,
    lang: Lang,
    onOpen: () -> Unit
) {
    // The reference always shows the current selection counter, including zero.
    Box(Modifier.fillMaxWidth().padding(top = 5.dp, bottom = 4.dp),
        contentAlignment = Alignment.Center) {
        Surface(color = Palette.blue,
            shape = RoundedCornerShape(28.dp),
            shadowElevation = 7.dp,
            modifier = Modifier.width(134.dp).height(43.dp)
                .clickable(onClick = onOpen)) {
            Row(Modifier.fillMaxSize().padding(horizontal = 13.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.ConfirmationNumber,
                    contentDescription = tr(lang, "Bet slip", "برگه شرط"),
                    tint = Color.White, modifier = Modifier.size(19.dp))
                Spacer(Modifier.width(5.dp))
                AnimatedContent(
                    targetState = count, label = "betSlipCounter",
                    transitionSpec = {
                        (slideInVertically { it / 2 } + fadeIn())
                            .togetherWith(slideOutVertically { -it / 2 } + fadeOut())
                    }) { value ->
                    Text(value.toString(), color = Color.White,
                        fontWeight = FontWeight.Black, fontSize = 15.sp)
                }
                Spacer(Modifier.width(9.dp))
                Icon(Icons.Default.KeyboardArrowUp,
                    tr(lang, "Open slip", "باز کردن برگه شرط"),
                    tint = Color.White, modifier = Modifier.size(22.dp))
            }
        }
    }
}
