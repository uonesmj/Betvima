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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.boundsInWindow
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
import androidx.compose.ui.text.style.TextAlign
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
    BvDestination("sports", "Sports", "ورزش‌ها", Icons.Default.SportsSoccer)
)

/** The original five routes and their order are an API contract with Scaffold. */
internal val fixedBottomNavigationIds: List<String> = bottomDestinations.map { it.id }

/** Preserve existing selection priority; this function has no UI or state side effects. */
internal fun selectedBottomNavigationId(state: AppState, menuOpen: Boolean): String = when {
    menuOpen -> "menu"
    state.feature == Feature.CASINO -> "casino"
    state.tab == Tab.BETS && state.feature == Feature.NONE -> "bets"
    state.tab == Tab.LIVE || state.tab == Tab.SPORTS -> "sports"
    state.tab == Tab.HOME && state.feature == Feature.NONE -> "home"
    else -> ""
}

/**
 * Permanent premium bottom navigation, still mounted in Scaffold.bottomBar.
 *
 * Maintains the exact five destinations/icons and the stable equal-width
 * footprint. Icon wells have a fixed size even when a tab is selected, so
 * changing pages cannot shift neighbouring tabs or the footer.
 */
@Composable
fun ReferenceAnimatedBottomNav(
    state: AppState,
    menuOpen: Boolean = false,
    onNavigate: (String) -> Unit
) {
    val selected = selectedBottomNavigationId(state, menuOpen)
    val surface = if (selected == "bets") Palette.headerDark else Color(0xFF101114)

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Column(
            modifier = Modifier.fillMaxWidth().background(surface)
        ) {
            // Subtle separator from page content, not a floating card or overlay.
            Box(
                Modifier.fillMaxWidth().height(1.dp)
                    .background(Color(0xFF30343C))
            )
            Row(
                modifier = Modifier.fillMaxWidth()
                    .padding(horizontal = 5.dp, vertical = 5.dp)
                    .height(83.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                bottomDestinations.forEach { item ->
                    val active = selected == item.id
                    val interactions = remember(item.id) { MutableInteractionSource() }
                    val pressed by interactions.collectIsPressedAsState()

                    val iconTint by animateColorAsState(
                        targetValue = if (active) Color(0xFF299AFF) else Color(0xFFBFC6D3),
                        animationSpec = tween(220),
                        label = "nav181IconTint"
                    )
                    val captionTint by animateColorAsState(
                        targetValue = if (active) Color(0xFF57B0FF) else Color(0xFFADB6C6),
                        animationSpec = tween(220),
                        label = "nav181TextTint"
                    )
                    val haloTop by animateColorAsState(
                        targetValue = if (active) Color(0xFF203752) else Color.Transparent,
                        animationSpec = tween(230),
                        label = "nav181HaloTop"
                    )
                    val haloBottom by animateColorAsState(
                        targetValue = if (active) Color(0xFF13273C) else Color.Transparent,
                        animationSpec = tween(230),
                        label = "nav181HaloBottom"
                    )
                    val stroke by animateColorAsState(
                        targetValue = if (active) Color(0xFF345C88) else Color.Transparent,
                        animationSpec = tween(230),
                        label = "nav181HaloStroke"
                    )
                    val iconScale by animateFloatAsState(
                        targetValue = if (pressed) 0.93f else if (active) 1.07f else 1f,
                        animationSpec = spring(
                            dampingRatio = Spring.DampingRatioNoBouncy,
                            stiffness = Spring.StiffnessMedium
                        ),
                        label = "nav181IconScale"
                    )
                    val indicatorWidth by animateDpAsState(
                        targetValue = if (active) 30.dp else 0.dp,
                        animationSpec = tween(240),
                        label = "nav181Indicator"
                    )

                    Column(
                        modifier = Modifier.weight(1f).fillMaxHeight()
                            .clip(RoundedCornerShape(15.dp))
                            .clickable(
                                interactionSource = interactions,
                                indication = ripple(bounded = true),
                                role = Role.Tab,
                                onClick = { onNavigate(item.id) }
                            )
                            .semantics { this.selected = active }
                            .padding(top = 3.dp, bottom = 3.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Box(
                            modifier = Modifier.size(width = 54.dp, height = 42.dp)
                                .clip(RoundedCornerShape(15.dp))
                                .background(Brush.verticalGradient(
                                    colors = listOf(haloTop, haloBottom)
                                ))
                                .border(1.dp, stroke, RoundedCornerShape(15.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = item.icon,
                                contentDescription = tr(state.lang, item.en, item.fa),
                                tint = iconTint,
                                modifier = Modifier.size(27.dp).graphicsLayer {
                                    scaleX = iconScale
                                    scaleY = iconScale
                                }
                            )
                        }
                        Text(
                            text = tr(state.lang, item.en, item.fa),
                            fontSize = 10.sp,
                            lineHeight = 13.sp,
                            fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                            color = captionTint,
                            maxLines = 1,
                            softWrap = false,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 1.dp)
                        )
                        Box(
                            modifier = Modifier.width(indicatorWidth).height(3.dp)
                                .clip(CircleShape).background(
                                    if (active) Palette.blue else Color.Transparent
                                )
                        )
                    }
                }
            }
        }
    }
}

/** Navigation has no spacer rail. The bet slip lives in Scaffold's FAB slot. */
@Composable
fun ReferenceBottomBar(
    state: AppState,
    menuOpen: Boolean = false,
    onNavigate: (String) -> Unit
) {
    ReferenceAnimatedBottomNav(state, menuOpen, onNavigate)
}

@Composable
fun AnimatedFloatingBetslip(
    count: Int,
    lang: Lang,
    onOpen: () -> Unit,
    onCenterChanged: (Offset) -> Unit = {},
    receivingPick: Boolean = false
) {
    val interactions = remember { MutableInteractionSource() }
    val pressed by interactions.collectIsPressedAsState()
    val scale by animateFloatAsState(
        if (pressed) .94f else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
        label = "compactSlipScale")
    val receiveScale by animateFloatAsState(
        if (receivingPick) 1.085f else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
        label = "slipReceivingSelection")
    // Report the center of the *actual rendered button* in window pixels.
    // Flight destination must never be guessed from screen height.
    Box(
        modifier = Modifier.width(112.dp).height(48.dp)
            .onGloballyPositioned { onCenterChanged(it.boundsInWindow().center) }
            .graphicsLayer {
                scaleX = scale * receiveScale
                scaleY = scale * receiveScale
            }
            .clickable(
                interactionSource = interactions,
                indication = ripple(),
                onClick = onOpen
            ),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            color = Palette.blue,
            shape = RoundedCornerShape(13.dp),
            shadowElevation = if (receivingPick) 8.dp else 3.dp,
            border = if (receivingPick) BorderStroke(1.4.dp, Color(0xFFB6E5FF)) else null,
            modifier = Modifier.width(100.dp).height(36.dp)
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
}
