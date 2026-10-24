package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** The server owns event identity and read state; the client never fabricates notices. */
@Composable
fun NotificationsPage(state: AppState, model: AppViewModel) {
    val unread = state.notifications.count { it.readAt == null }
    LazyColumn(contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(11.dp)) {
        item {
            BvPageBanner(
                eyebrow = tr(state.lang, "INBOX", "صندوق اعلان‌ها"),
                title = tr(state.lang, "Stay up to date", "همیشه در جریان باشید"),
                subtitle = tr(state.lang,
                    "Important account events and messages, directly from BetVima.",
                    "پیام‌ها و رویدادهای حساب شما، مستقیماً از بت‌ویما."),
                icon = Icons.Default.NotificationsActive
            ) {
                Spacer(Modifier.height(5.dp))
                SmallPill(unread.toString() + tr(state.lang, " unread", " خوانده‌نشده"),
                    Palette.green.copy(alpha = .15f), Palette.green)
            }
        }
        item {
            SectionHeading(tr(state.lang, "Notifications", "اعلان‌ها"),
                tr(state.lang, "Messages from your BetVima account", "پیام‌های حساب بت‌ویما"),
                tr(state.lang, "Refresh", "تازه‌سازی")) { model.refreshNotifications() }
        }
        if (!state.signedIn) {
            item {
                LockedFeature(state.lang,
                    tr(state.lang, "Sign in to view notifications", "برای مشاهده اعلان‌ها وارد شوید")) {
                    model.showLogin(true)
                }
            }
        } else {
            if (state.notificationLoading) item {
                LinearProgressIndicator(Modifier.fillMaxWidth(), color = Palette.green)
            }
            if (unread > 0) item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(tr(state.lang, "Unread: ", "خوانده‌نشده: ") + unread,
                        color = Palette.text, fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f))
                    TextButton(onClick = model::markAllNotificationsRead) {
                        Icon(Icons.Default.DoneAll, null, tint = Palette.blue,
                            modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(tr(state.lang, "Mark all read", "خواندن همه"),
                            color = Palette.blue)
                    }
                }
            }
            if (state.notifications.isEmpty() && !state.notificationLoading) item {
                EmptyPanel(tr(state.lang, "No notifications", "اعلانی وجود ندارد"),
                    tr(state.lang, "Account events will appear here when the server issues them.",
                        "پس از صدور پیام از سرور، در این صفحه نمایش داده می‌شود.")) {
                    model.refreshNotifications()
                }
            }
            items(state.notifications, key = { it.id }) { note ->
                val display = notificationDisplayCopy184(note, state.lang)
                Surface(
                    modifier = Modifier.fillMaxWidth().clickable(enabled = note.readAt == null) {
                        model.markNotificationRead(note.id)
                    },
                    color = if (note.readAt == null) Palette.greenLight else Color.White,
                    border = BorderStroke(1.dp,
                        if (note.readAt == null) Palette.green else Palette.border),
                    shape = RoundedCornerShape(19.dp),
                    shadowElevation = 1.dp
                ) {
                    Row(Modifier.padding(16.dp),
                        verticalAlignment = Alignment.Top) {
                        Surface(color = Palette.paper, shape = RoundedCornerShape(11.dp)) {
                            Icon(Icons.Default.NotificationsNone, null, tint = Palette.blue,
                                modifier = Modifier.padding(9.dp).size(20.dp))
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(display.title, color = Palette.text, fontWeight = FontWeight.Black,
                                fontSize = 13.sp)
                            Spacer(Modifier.height(5.dp))
                            Text(display.body, color = Palette.muted, fontSize = 12.sp)
                            Spacer(Modifier.height(10.dp))
                            Text(note.createdAt.take(16).replace("T", " · "),
                                fontSize = 10.sp, color = Palette.muted)
                        }
                        if (note.readAt == null) Surface(
                            color = Palette.green, shape = CircleShape,
                            modifier = Modifier.size(9.dp)) {}
                    }
                }
            }
            if (state.notificationHasMore) item {
                OutlinedButton(onClick = { model.refreshNotifications(more = true) },
                    enabled = !state.notificationLoading, modifier = Modifier.fillMaxWidth()) {
                    Text(tr(state.lang, "Older notifications", "اعلان‌های قدیمی‌تر"))
                }
            }
        }
    }
}
