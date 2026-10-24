package com.betvima.app.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.CheckCircleOutline
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.betvima.app.data.UserNotification

private val notificationBlue = Color(0xFF087FF5)
private val notificationPaper = Color(0xFF111113)
private val notificationMuted = Color(0xFFA6A9B3)
private val notificationCardGray = Color(0xFF222224)
private val notificationTabGray = Color(0xFF29292C)

/**
 * Reference-style notification bottom sheet. It reads only authenticated API
 * data from AppViewModel; no demo messages, synthetic read receipts or balances.
 * This is an overlay, never a replacement for the active casino/sports screen.
 */
@Composable
fun NotificationsPopup(
    state: AppState,
    model: AppViewModel,
    onDismiss: () -> Unit,
    onLogin: () -> Unit,
    onNavigate: (NotificationDestination, String?) -> Unit
) {
    var category by remember { mutableStateOf(NotificationCategory.ALL) }
    val lang = state.lang
    // Keep Dialog mounted until the exit motion finishes. Closing, Back and
    // opening a notification all animate down instead of abruptly removing it.
    val visible = remember { MutableTransitionState(false) }
    var didOpen by remember { mutableStateOf(false) }
    var pendingLogin by remember { mutableStateOf(false) }
    var pendingRoute by remember { mutableStateOf<Pair<NotificationDestination, String?>?>(null) }
    LaunchedEffect(Unit) {
        didOpen = true
        visible.targetState = true
    }
    LaunchedEffect(visible.isIdle, visible.currentState, visible.targetState, didOpen) {
        if (didOpen && visible.isIdle && !visible.currentState && !visible.targetState) {
            onDismiss()
            if (pendingLogin) onLogin()
            pendingRoute?.let { (destination, id) -> onNavigate(destination, id) }
        }
    }
    val closeAnimated = { visible.targetState = false }
    Dialog(
        onDismissRequest = closeAnimated,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
            val popupShape = RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp)
            AnimatedVisibility(
                visibleState = visible,
                enter = slideInVertically(
                    initialOffsetY = { it },
                    animationSpec = tween(420, easing = FastOutSlowInEasing)
                ) + fadeIn(tween(250)),
                exit = slideOutVertically(
                    targetOffsetY = { it },
                    animationSpec = tween(300, easing = FastOutSlowInEasing)
                ) + fadeOut(tween(230)),
                modifier = Modifier.fillMaxWidth()
            ) {
            Column(
                Modifier.fillMaxWidth().fillMaxHeight(.94f)
                    .shadow(22.dp, popupShape)
                    .clip(popupShape)
                    .background(notificationPaper)
            ) {
                // A tactile sheet grabber and an unobstructed, reference-style title.
                Box(Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 5.dp),
                    contentAlignment = Alignment.Center) {
                    Box(Modifier.size(width = 43.dp, height = 4.dp)
                        .clip(CircleShape).background(Color(0xFF696970)))
                }
                Row(
                    Modifier.fillMaxWidth().padding(start = 22.dp, end = 18.dp,
                        top = 7.dp, bottom = 13.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(tr(lang, "Notifications", "اعلان‌ها"),
                            fontSize = 27.sp, fontWeight = FontWeight.Black,
                            letterSpacing = (-0.6f).sp,
                            color = Color(0xFFF5F6F8),
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (state.signedIn && state.notificationUnreadCount > 0) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(7.dp).clip(CircleShape)
                                    .background(Color(0xFFFF6330)))
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    tr(lang, "Unread notifications", "اعلان‌های خوانده‌نشده")
                                        + " · " + state.notificationUnreadCount,
                                    color = notificationMuted, fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                    IconButton(
                        onClick = closeAnimated,
                        modifier = Modifier.size(42.dp)
                            .clip(CircleShape).background(Color(0xFF29292C))
                    ) {
                        Icon(Icons.Default.Close,
                            contentDescription = tr(lang, "Close", "بستن"),
                            tint = notificationMuted,
                            modifier = Modifier.size(25.dp))
                    }
                }
                NotificationCategoryTabs(category, lang) { category = it }
                Spacer(Modifier.height(14.dp))
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    AnimatedContent(
                        targetState = category,
                        modifier = Modifier.fillMaxSize(),
                        transitionSpec = {
                            val direction = if (targetState.ordinal > initialState.ordinal) 1 else -1
                            (slideInHorizontally(
                                animationSpec = tween(280, easing = FastOutSlowInEasing),
                                initialOffsetX = { width -> direction * width / 5 }
                            ) + fadeIn(tween(200))) togetherWith
                                (slideOutHorizontally(
                                    animationSpec = tween(220, easing = FastOutSlowInEasing),
                                    targetOffsetX = { width -> -direction * width / 5 }
                                ) + fadeOut(tween(160)))
                        },
                        label = "notification184CategoryContent"
                    ) { displayedCategory ->
                        val notices = state.notifications.filter {
                            notificationStillVisible(it.createdAt, System.currentTimeMillis()) &&
                                notificationMatchesCategory(it, displayedCategory)
                        }
                        Box(Modifier.fillMaxSize()) {
                    when {
                        !state.signedIn -> NotificationEmpty(
                            title = tr(lang, "Sign in to view notifications", "برای مشاهده اعلان‌ها وارد شوید"),
                            message = tr(lang,
                                "Sign in to receive personal updates from BetVima.",
                                "برای دیدن پیام‌های شخصی بت‌ویما وارد حساب خود شوید."),
                            buttonText = tr(lang, "Sign in", "ورود"),
                            onClick = { pendingLogin = true; closeAnimated() }
                        )
                        notices.isEmpty() && state.notificationLoading ->
                            CircularProgressIndicator(
                                modifier = Modifier.align(Alignment.Center),
                                color = notificationBlue)
                        notices.isEmpty() && state.notificationError != null ->
                            NotificationEmpty(
                                title = tr(lang, "Could not load notifications", "دریافت اعلان‌ها ناموفق بود"),
                                message = tr(lang, "Please check your connection and try again.",
                                    "اتصال خود را بررسی کنید و دوباره تلاش کنید."),
                                buttonText = tr(lang, "Try again", "تلاش دوباره"),
                                onClick = { model.refreshNotifications() }
                            )
                        notices.isEmpty() -> NotificationEmpty(
                            title = tr(lang, "No results", "پیامی موجود نیست"),
                            message = tr(lang,
                                "When a notification arrives, it will appear in this section.",
                                "با دریافت اعلان جدید، پیام آن در این بخش نمایش داده می‌شود.")
                        )
                        else -> LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 3.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            items(notices, key = { it.id }) { note ->
                                NotificationReferenceCard(
                                    note = note,
                                    lang = lang,
                                    onMarkRead = { model.markNotificationRead(note.id) },
                                    onAction = { destination ->
                                        if (note.readAt == null) model.markNotificationRead(note.id)
                                        pendingRoute = destination to supportTicketFromNotificationHref(note.ctaHref)
                                        closeAnimated()
                                    }
                                )
                            }
                            if (state.notificationHasMore) {
                                item(key = "load-more") {
                                    OutlinedButton(
                                        enabled = !state.notificationLoading,
                                        onClick = { model.refreshNotifications(more = true) },
                                        modifier = Modifier.fillMaxWidth().heightIn(min = 47.dp),
                                        shape = RoundedCornerShape(15.dp),
                                        border = BorderStroke(1.dp, Color(0xFF39393D))
                                    ) {
                                        Text(tr(lang, "Show older notifications", "اعلان‌های قدیمی‌تر"),
                                            color = notificationBlue, fontWeight = FontWeight.SemiBold)
                                    }
                                }
                            }
                            if (state.notificationLoading) {
                                item(key = "progress") {
                                    LinearProgressIndicator(
                                        modifier = Modifier.fillMaxWidth(),
                                        color = notificationBlue)
                                }
                            }
                            if (state.notificationError != null) {
                                item(key = "retry") {
                                    TextButton(onClick = { model.refreshNotifications(more = state.notificationHasMore) }) {
                                        Icon(Icons.Default.Refresh, null, tint = notificationBlue)
                                        Spacer(Modifier.width(5.dp))
                                        Text(tr(lang, "Retry loading", "تلاش دوباره"), color = notificationBlue)
                                    }
                                }
                            }
                            item(key = "bottom-space") { Spacer(Modifier.height(20.dp)) }
                        }
                    }
                        }
                    }
                }
                if (state.signedIn && state.notificationUnreadCount > 0) {
                    HorizontalDivider(color = Color(0xFF39393D))
                    Row(Modifier.fillMaxWidth().padding(horizontal = 19.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.End) {
                        TextButton(
                            onClick = model::markAllNotificationsRead,
                            modifier = Modifier.heightIn(min = 42.dp)
                        ) {
                            Icon(Icons.Default.DoneAll, null, tint = notificationBlue,
                                modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(7.dp))
                            Text(tr(lang, "Mark all as read", "خواندن همه اعلان‌ها"),
                                color = notificationBlue, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
            }
        }
    }
}

@Composable
private fun NotificationCategoryTabs(
    selected: NotificationCategory,
    lang: Lang,
    onSelect: (NotificationCategory) -> Unit
) {
    SmoothThreeTabs184(
        selected = selected,
        options = listOf(
            SmoothTab184(NotificationCategory.ALL, tr(lang, "All", "همه")),
            SmoothTab184(NotificationCategory.PERSONAL, tr(lang, "Personal", "شخصی")),
            SmoothTab184(NotificationCategory.GENERAL, tr(lang, "General", "عمومی"))
        ),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        height = 55.dp,
        textSize = 15.sp,
        onSelect = onSelect
    )
}

@Composable
private fun NotificationReferenceCard(
    note: UserNotification,
    lang: Lang,
    onMarkRead: () -> Unit,
    onAction: (NotificationDestination) -> Unit
) {
    val destination = notificationDestination(note.ctaHref)
    val copy = displayNotification184(note, lang)
    val hasAction = destination != null && !copy.ctaLabel.isNullOrBlank()
    Column(
        Modifier.fillMaxWidth()
            .shadow(2.dp, RoundedCornerShape(23.dp))
            .clip(RoundedCornerShape(23.dp))
            .background(notificationCardGray)
            .border(1.dp, Color(0xFF39393D), RoundedCornerShape(23.dp))
            .clickable(enabled = note.readAt == null) { onMarkRead() }
            .padding(horizontal = 18.dp, vertical = 19.dp)
    ) {
        Row(Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween) {
            Text(notificationDisplayDate(note.createdAt, lang),
                color = notificationMuted, fontSize = 13.sp)
            if (note.readAt == null) {
                Box(
                    Modifier.clip(CircleShape)
                        .background(Color(0xFFFF632E))
                        .padding(horizontal = 11.dp, vertical = 5.dp)
                ) {
                    Text(tr(lang, "New", "جدید"),
                        color = Color.White,
                        fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            } else {
                Icon(Icons.Default.CheckCircleOutline,
                    contentDescription = tr(lang, "Read", "خوانده‌شده"),
                    tint = notificationMuted, modifier = Modifier.size(17.dp))
            }
        }
        Spacer(Modifier.height(5.dp))
        Text(copy.title, color = Color(0xFFF5F6F8), fontSize = 18.sp,
            fontWeight = FontWeight.Black, lineHeight = 25.sp)
        Spacer(Modifier.height(6.dp))
        Text(copy.body, color = notificationMuted, fontSize = 14.sp,
            lineHeight = 22.sp)
        if (hasAction && destination != null) {
            Spacer(Modifier.height(14.dp))
            Button(
                onClick = { onAction(destination) },
                modifier = Modifier.fillMaxWidth().height(52.dp)
                    .shadow(3.dp, RoundedCornerShape(14.dp)),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = notificationBlue),
                contentPadding = PaddingValues(horizontal = 14.dp)
            ) {
                Text(copy.ctaLabel.orEmpty(),
                    color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.width(6.dp))
                Icon(Icons.Default.ArrowForward, null,
                    modifier = Modifier.size(16.dp), tint = Color.White)
            }
        } else if (note.readAt == null) {
            Spacer(Modifier.height(8.dp))
            Text(tr(lang, "Tap to mark as read", "برای خواندن لمس کنید"),
                fontSize = 11.sp, color = notificationBlue)
        }
    }
}

@Composable
private fun NotificationEmpty(
    title: String,
    message: String,
    buttonText: String? = null,
    onClick: (() -> Unit)? = null
) {
    Column(
        Modifier.fillMaxSize().padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(Modifier.size(102.dp)
            .clip(CircleShape)
            .background(Color(0xFF29292C)),
            contentAlignment = Alignment.Center) {
            Icon(Icons.Default.Notifications,
                contentDescription = null,
                tint = Color(0xFFA6A9B3),
                modifier = Modifier.size(58.dp))
        }
        Spacer(Modifier.height(22.dp))
        Text(title, fontWeight = FontWeight.Bold,
            color = Color(0xFFF5F6F8), fontSize = 22.sp,
            textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        Text(message, fontSize = 14.sp,
            color = notificationMuted, lineHeight = 23.sp,
            textAlign = TextAlign.Center)
        if (buttonText != null && onClick != null) {
            Spacer(Modifier.height(24.dp))
            Button(
                onClick = onClick,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = notificationBlue)
            ) {
                Text(buttonText, fontWeight = FontWeight.Bold)
            }
        }
    }
}
