package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import kotlinx.coroutines.launch
import org.json.JSONObject

data class TicketMessage(val id: String, val content: String, val sender: String, val time: String)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketThreadSheet(ticket: SupportTicket, lang: Lang, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val api = remember { ApiClient() }
    val vault = remember { SessionVault(context) }
    val scope = rememberCoroutineScope()
    var messages by remember(ticket.id) { mutableStateOf<List<TicketMessage>>(emptyList()) }
    var text by remember(ticket.id) { mutableStateOf("") }
    var loading by remember(ticket.id) { mutableStateOf(true) }
    var sending by remember(ticket.id) { mutableStateOf(false) }
    var error by remember(ticket.id) { mutableStateOf<String?>(null) }

    suspend fun loadMessages() {
        loading = true
        try {
            val token = vault.accessToken(api) ?: throw IllegalStateException("Sign in required")
            val response = api.get("/api/v1/support/" + ticket.id, token)
            val payload = response.opt("messages")
            val records = when (payload) {
                is org.json.JSONArray -> payload
                is JSONObject -> payload.optJSONArray("items") ?: org.json.JSONArray()
                else -> org.json.JSONArray()
            }
            messages = records.objects().map { message ->
                TicketMessage(
                    message.str("id"),
                    message.str("body", message.str("message")),
                    message.str("senderRole", message.str("sender_role", "support")),
                    message.str("createdAt", message.str("created_at"))
                )
            }
            error = null
        } catch (ex: Exception) {
            error = ex.message ?: "Messages unavailable"
        } finally { loading = false }
    }
    LaunchedEffect(ticket.id) { loadMessages() }

    ModalBottomSheet(onDismissRequest = onDismiss,
        containerColor = Palette.paper, dragHandle = { BottomSheetDefaults.DragHandle() }) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.8f).padding(horizontal = 17.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(ticket.subject, fontSize = 19.sp, fontWeight = FontWeight.Black)
                    Text(tr(lang, "Support conversation", "گفت‌وگو با پشتیبانی"),
                        color = Palette.muted, fontSize = 11.sp)
                }
                SmallPill(ticket.status, Palette.greenLight, Palette.ink)
            }
            Spacer(Modifier.height(15.dp))
            if (loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Palette.green)
            if (error != null) {
                Text(error.orEmpty(), color = Palette.red, fontSize = 12.sp)
                TextButton(onClick = { scope.launch { loadMessages() } }) {
                    Text(tr(lang, "Retry", "تلاش دوباره"))
                }
            }
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (!loading && messages.isEmpty()) {
                    item {
                        EmptyPanel(tr(lang, "No messages yet", "هنوز پیامی ثبت نشده"),
                            tr(lang, "Replies will appear after they arrive from support.",
                                "پاسخ‌های پشتیبانی پس از ثبت در اینجا نمایش داده می‌شوند."))
                    }
                }
                items(messages, key = { it.id }) { message ->
                    val own = message.sender.lowercase() in setOf("user", "customer")
                    Row(Modifier.fillMaxWidth(),
                        horizontalArrangement = if (own) Arrangement.End else Arrangement.Start) {
                        Surface(
                            modifier = Modifier.fillMaxWidth(.9f),
                            color = if (own) Palette.greenLight else Color.White,
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(1.dp,
                                if (own) Palette.green.copy(alpha = .25f) else Palette.border)
                        ) {
                            Column(Modifier.padding(12.dp)) {
                                Text(
                                    if (own) tr(lang, "You", "شما")
                                    else tr(lang, "Support", "پشتیبانی"),
                                    fontSize = 10.sp, color = Palette.muted,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(message.content, fontSize = 13.sp,
                                    color = Palette.text, modifier = Modifier.padding(top = 5.dp))
                                Text(message.time.take(16).replace("T", " "),
                                    fontSize = 9.sp, color = Palette.muted,
                                    modifier = Modifier.padding(top = 8.dp))
                            }
                        }
                    }
                }
            }
            if (ticket.status !in setOf("closed", "resolved")) {
                Row(Modifier.fillMaxWidth().padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = text, onValueChange = { text = it.take(5000) },
                        modifier = Modifier.weight(1f), minLines = 1, maxLines = 3,
                        placeholder = { Text(tr(lang, "Type a message", "پیام بنویسید")) })
                    FilledIconButton(
                        onClick = {
                            scope.launch {
                                sending = true
                                try {
                                    val token = vault.accessToken(api)
                                        ?: throw IllegalStateException("Sign in required")
                                    api.post("/api/v1/support/" + ticket.id + "/messages",
                                        JSONObject().put("body", text.trim()), token)
                                    text = ""
                                    loadMessages()
                                } catch (ex: Exception) {
                                    error = ex.message ?: "Unable to send"
                                } finally { sending = false }
                            }
                        },
                        enabled = !sending && text.isNotBlank(),
                        colors = IconButtonDefaults.filledIconButtonColors(
                            containerColor = Palette.green, contentColor = Palette.ink)
                    ) {
                        Icon(Icons.Default.Send,
                            contentDescription = tr(lang, "Send", "ارسال"))
                    }
                }
            } else {
                Text(tr(lang, "This ticket is closed.", "این درخواست بسته شده است."),
                    modifier = Modifier.padding(vertical = 15.dp), color = Palette.muted)
            }
        }
    }
}
