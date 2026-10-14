package com.betvima.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.net.Uri
import android.provider.OpenableColumns
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import com.betvima.app.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val chatNavy = Color(0xFF0C1C34)
private val chatBlue = Color(0xFF087FF5)
private val chatMint = Color(0xFF00D47A)
private val chatMuted = Color(0xFF7B8899)
private val chatInk = Color(0xFF192438)
private val chatLine = Color(0xFFE0E7F0)

private fun formatSupportTime(value: String) =
    value.take(16).replace('T', ' ').ifBlank { "—" }

private data class PickedSupportFile(
    val uri: Uri, val displayName: String, val mimeType: String, val sizeBytes: Long
)

private fun supportFileSizeLabel(bytes: Long): String =
    if (bytes < 0) "≤ 10 MB" else String.format(
        java.util.Locale.US, "%.1f MB", bytes.toDouble() / (1024.0 * 1024.0)
    )

@Composable
private fun ConversationMessage(message: SupportThreadMessage, lang: Lang) {
    val own = message.senderRole.lowercase() in setOf("user", "customer")
    Row(Modifier.fillMaxWidth(),
        horizontalArrangement = if (own) Arrangement.End else Arrangement.Start) {
        Column(
            modifier = Modifier.fillMaxWidth(.91f),
            horizontalAlignment = if (own) Alignment.End else Alignment.Start,
            verticalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(color = if (own) Color(0xFFE7F0FF) else Color(0xFFE1F7EB),
                    shape = CircleShape) {
                    Icon(
                        if (own) Icons.Default.Person else Icons.Default.SupportAgent,
                        null, tint = if (own) chatBlue else Color(0xFF058753),
                        modifier = Modifier.padding(6.dp).size(15.dp))
                }
                Spacer(Modifier.width(6.dp))
                Text(if (own) tr(lang,"You","شما")
                    else if (message.senderRole == "system")
                        tr(lang,"System","سیستم")
                    else tr(lang,"BetVima Support","پشتیبانی بت‌ویما"),
                    color = chatMuted, fontWeight = FontWeight.Black, fontSize = 10.sp)
            }
            Surface(
                color = if (own) Color(0xFFEBF2FF) else Color.White,
                shape = RoundedCornerShape(
                    topStart = 17.dp, topEnd = 17.dp,
                    bottomStart = if (own) 17.dp else 5.dp,
                    bottomEnd = if (own) 5.dp else 17.dp),
                border = BorderStroke(1.dp,
                    if (own) Color(0xFFD9E7FF) else chatLine),
                shadowElevation = if (own) 0.dp else 1.dp
            ) {
                Column(Modifier.fillMaxWidth().padding(13.dp),
                    verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    if (message.body.isNotBlank()) {
                        Text(message.body, color = chatInk,
                            fontSize = 13.sp, lineHeight = 21.sp)
                    }
                    if (message.attachments.isNotEmpty()) {
                        HorizontalDivider(color = chatLine)
                        message.attachments.forEach { attachment ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.AttachFile, null,
                                    tint = chatBlue, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text(attachment, color = chatBlue, fontSize = 11.sp,
                                    maxLines = 2, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                    Row(horizontalArrangement = Arrangement.End,
                        modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.Schedule, null,
                            tint = chatMuted, modifier = Modifier.size(12.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(formatSupportTime(message.createdAt), color = chatMuted,
                            fontSize = 9.sp)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketThreadSheet(
    ticket: SupportTicket,
    lang: Lang,
    onDismiss: () -> Unit,
    onUpdated: () -> Unit = {}
) {
    val context = LocalContext.current
    val api = remember { ApiClient() }
    val vault = remember { SessionVault(context) }
    val scope = rememberCoroutineScope()
    val scrollState = rememberLazyListState()
    var activeTicket by remember(ticket.id) { mutableStateOf(ticket) }
    var messages by remember(ticket.id) { mutableStateOf<List<SupportThreadMessage>>(emptyList()) }
    var draft by remember(ticket.id) { mutableStateOf("") }
    var loading by remember(ticket.id) { mutableStateOf(true) }
    var sending by remember(ticket.id) { mutableStateOf(false) }
    var uncertain by remember(ticket.id) { mutableStateOf(false) }
    var closing by remember(ticket.id) { mutableStateOf(false) }
    var askClose by remember(ticket.id) { mutableStateOf(false) }
    var error by remember(ticket.id) { mutableStateOf<String?>(null) }
    var scrollToNew by remember(ticket.id) { mutableStateOf(false) }
    var chosenFile by remember(ticket.id) { mutableStateOf<PickedSupportFile?>(null) }
    val documentPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri != null) scope.launch {
            try {
                val file = withContext(Dispatchers.IO) {
                    val resolver = context.contentResolver
                    val mime = resolver.getType(uri).orEmpty()
                    var name = "attachment"
                    var size = -1L
                    resolver.query(
                        uri,
                        arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
                        null, null, null
                    )?.use { cursor ->
                        if (cursor.moveToFirst()) {
                            val n = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                            val z = cursor.getColumnIndex(OpenableColumns.SIZE)
                            if (n >= 0 && !cursor.isNull(n))
                                name = cursor.getString(n).orEmpty()
                            if (z >= 0 && !cursor.isNull(z)) size = cursor.getLong(z)
                        }
                    }
                    if (!supportUploadSelectable(mime, size))
                        throw IllegalArgumentException(
                            "Only JPG, PNG, WEBP or PDF files up to 10 MB are supported"
                        )
                    PickedSupportFile(uri, supportSafeFilename(name), mime, size)
                }
                chosenFile = file
                error = null
            } catch (ex: Exception) {
                chosenFile = null
                error = tr(lang,
                    "Select a JPG, PNG, WEBP or PDF under 10 MB.",
                    "فقط فایل JPG، PNG، WEBP یا PDF کوچک‌تر از ۱۰ مگابایت انتخاب کنید.")
            }
        }
    }

    suspend fun refresh(silent: Boolean = false) {
        if (!silent) loading = true
        try {
            val jwt = vault.accessToken(api)
                ?: throw IllegalStateException(tr(lang,"Please sign in again","لطفاً دوباره وارد شوید"))
            val result = api.supportConversation(jwt, ticket.id)
            val before = messages.size
            messages = result.messages.distinctBy { it.id }
            activeTicket = result.ticket
            if (messages.size > before) scrollToNew = true
            error = null
            if (!silent) uncertain = false
        } catch (ex: Exception) {
            if (!silent) error = ex.message ?: tr(lang,
                "Could not load conversation","دریافت گفت‌وگو ممکن نشد")
        } finally {
            loading = false
        }
    }
    LaunchedEffect(ticket.id) {
        refresh()
        while (true) {
            delay(25_000)
            if (!sending && !closing) refresh(silent = true)
        }
    }
    LaunchedEffect(messages.size, scrollToNew) {
        if (scrollToNew && messages.isNotEmpty()) {
            scrollState.animateScrollToItem(messages.lastIndex)
            scrollToNew = false
        }
    }

    ModalBottomSheet(
        onDismissRequest = { if (!sending && !closing) onDismiss() },
        containerColor = Color(0xFFF6F8FC),
        contentWindowInsets = { WindowInsets(0, 0, 0, 0) },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ) {
        // Extend the sheet to the system navigation area. The message composer
        // owns the bottom safe inset, so no floating empty strip remains.
        Column(Modifier.fillMaxWidth().fillMaxHeight(.96f).imePadding()) {
            Surface(color = chatNavy, shape = RoundedCornerShape(
                topStart = 23.dp, topEnd = 23.dp)) {
                Column(Modifier.fillMaxWidth().background(
                    Brush.linearGradient(listOf(
                        Color(0xFF10243F), Color(0xFF133F55), Color(0xFF102B49))))
                    .padding(horizontal = 16.dp, vertical = 15.dp),
                    verticalArrangement = Arrangement.spacedBy(11.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = chatMint.copy(alpha = .15f),
                            shape = RoundedCornerShape(13.dp)) {
                            Icon(Icons.Default.Forum, null, tint = chatMint,
                                modifier = Modifier.padding(11.dp).size(21.dp))
                        }
                        Spacer(Modifier.width(11.dp))
                        Column(Modifier.weight(1f)) {
                            Text(tr(lang,"SUPPORT CONVERSATION","گفت‌وگوی پشتیبانی"),
                                color = Color(0xFFB6D3DB),
                                fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            Text(activeTicket.subject, color = Color.White,
                                fontWeight = FontWeight.Black, fontSize = 16.sp,
                                maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                        IconButton(onClick = onDismiss, enabled = !sending && !closing) {
                            Icon(Icons.Default.Close, tr(lang,"Close","بستن"),
                                tint = Color.White)
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = Color.White.copy(alpha = .10f),
                            shape = RoundedCornerShape(50)) {
                            Text("#" + activeTicket.id.take(8).uppercase(),
                                color = Color.White, fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp))
                        }
                        Spacer(Modifier.weight(1f))
                        IconButton(onClick = { scope.launch { refresh() } },
                            enabled = !loading && !sending && !closing) {
                            Icon(Icons.Default.Refresh, tr(lang,"Refresh","تازه‌سازی"),
                                tint = Color(0xFFB4DFF2))
                        }
                        if (supportActive(activeTicket.status)) {
                            IconButton(onClick = { askClose = true }, enabled = !sending) {
                                Icon(Icons.Default.TaskAlt,
                                    tr(lang,"Close ticket","بستن درخواست"),
                                    tint = Color(0xFFFFD29B))
                            }
                        }
                    }
                    // Status is on its own line; never compete for horizontal
                    // space with the ticket ID and action buttons.
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        SupportStatusChip(activeTicket.status, lang)
                        Spacer(Modifier.weight(1f))
                        Text(
                            supportCategoryName(activeTicket.category, lang),
                            color = Color(0xFFBDCEDD), fontSize = 10.sp,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.widthIn(max = 110.dp)
                        )
                    }
                }
            }
            if (loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = chatMint)
            if (error != null) {
                Surface(color = Color(0xFFFFF0EB),
                    modifier = Modifier.fillMaxWidth().padding(11.dp),
                    shape = RoundedCornerShape(12.dp)) {
                    Column(Modifier.padding(11.dp)) {
                        Text(error.orEmpty(), color = Color(0xFFB2463B), fontSize = 11.sp)
                        TextButton(onClick = { scope.launch { refresh() } }) {
                            Text(tr(lang,"Retry","تلاش مجدد"))
                        }
                    }
                }
            }
            LazyColumn(
                state = scrollState,
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 15.dp, vertical = 18.dp),
                verticalArrangement = Arrangement.spacedBy(17.dp)
            ) {
                if (messages.isEmpty() && !loading) {
                    item {
                        Surface(color = Color.White,
                            shape = RoundedCornerShape(17.dp),
                            border = BorderStroke(1.dp, chatLine)) {
                            Column(Modifier.fillMaxWidth().padding(22.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(9.dp)) {
                                Icon(Icons.Default.MarkChatUnread, null,
                                    tint = chatBlue, modifier = Modifier.size(29.dp))
                                Text(tr(lang,"Conversation is ready","گفت‌وگو آماده است"),
                                    color = chatInk, fontWeight = FontWeight.Black)
                                Text(tr(lang,
                                    "Messages from your support request appear here.",
                                    "پیام‌های مربوط به این درخواست اینجا نمایش داده می‌شوند."),
                                    color = chatMuted, fontSize = 11.sp)
                            }
                        }
                    }
                }
                items(messages, key = { it.id }) { message ->
                    ConversationMessage(message, lang)
                }
            }
            Surface(color = Color.White, shadowElevation = 9.dp,
                modifier = Modifier.fillMaxWidth()) {
                Column(
                    Modifier.fillMaxWidth().navigationBarsPadding()
                        .padding(horizontal = 13.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(9.dp)
                ) {
                    if (supportActive(activeTicket.status)) {
                        if (uncertain) {
                            Surface(color = Color(0xFFFFF5E6),
                                shape = RoundedCornerShape(12.dp)) {
                                Text(tr(lang,
                                    "Delivery is uncertain. Refresh the conversation before sending again.",
                                    "وضعیت ارسال نامشخص است؛ پیش از ارسال دوباره گفت‌وگو را تازه‌سازی کنید."),
                                    color = Color(0xFF95621F), fontSize = 11.sp,
                                    modifier = Modifier.padding(11.dp))
                            }
                        }
                        chosenFile?.let { file ->
                            Surface(
                                color = Color(0xFFEAF4FF),
                                shape = RoundedCornerShape(13.dp),
                                border = BorderStroke(1.dp, Color(0xFFD4E6FC))
                            ) {
                                Row(
                                    Modifier.fillMaxWidth().padding(
                                        start = 10.dp, top = 5.dp, bottom = 5.dp, end = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        if (file.mimeType == "application/pdf")
                                            Icons.Default.PictureAsPdf
                                        else Icons.Default.Image,
                                        null, tint = chatBlue,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(file.displayName, color = chatInk,
                                            fontSize = 11.sp, fontWeight = FontWeight.Bold,
                                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text(supportFileSizeLabel(file.sizeBytes),
                                            color = chatMuted, fontSize = 10.sp)
                                    }
                                    IconButton(onClick = { chosenFile = null }, enabled = !sending) {
                                        Icon(Icons.Default.Close,
                                            tr(lang, "Remove file", "حذف فایل"),
                                            tint = chatMuted, modifier = Modifier.size(18.dp))
                                    }
                                }
                            }
                        }
                        Row(Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.Bottom,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedIconButton(
                                onClick = {
                                    documentPicker.launch(arrayOf(
                                        "image/jpeg", "image/png", "image/webp",
                                        "application/pdf"
                                    ))
                                },
                                modifier = Modifier.size(48.dp),
                                enabled = !sending && !closing && !uncertain,
                                shape = RoundedCornerShape(15.dp),
                                border = BorderStroke(1.dp, chatLine)
                            ) {
                                Icon(Icons.Default.AttachFile,
                                    tr(lang, "Attach JPG, PNG, WEBP or PDF",
                                        "پیوست JPG، PNG، WEBP یا PDF"),
                                    tint = chatBlue, modifier = Modifier.size(22.dp))
                            }
                            OutlinedTextField(
                                value = draft,
                                onValueChange = { draft = it.take(5000) },
                                modifier = Modifier.weight(1f),
                                minLines = 1, maxLines = 4,
                                placeholder = { Text(tr(lang,"Write your reply…","پاسخ خود را بنویسید…"),
                                    fontSize = 12.sp) },
                                shape = RoundedCornerShape(17.dp)
                            )
                            FilledIconButton(
                                onClick = {
                                    if (sending || uncertain ||
                                        (draft.isBlank() && chosenFile == null))
                                        return@FilledIconButton
                                    scope.launch {
                                        sending = true; error = null
                                        try {
                                            val token = vault.accessToken(api)
                                                ?: throw IllegalStateException("Sign in required")
                                            val attachment = chosenFile
                                            val sent = if (attachment == null) {
                                                api.sendSupportMessage(token, ticket.id, draft)
                                            } else {
                                                api.sendSupportFile(
                                                    token, ticket.id, draft,
                                                    context.contentResolver, attachment.uri,
                                                    attachment.displayName,
                                                    attachment.mimeType
                                                )
                                            }
                                            draft = ""
                                            chosenFile = null
                                            messages = (messages + sent).distinctBy { it.id }
                                            scrollToNew = true
                                            refresh(silent = true)
                                            onUpdated()
                                        } catch (ex: Exception) {
                                            val rejected = (ex as? ApiFailure)?.code in
                                                setOf(400, 401, 403, 404, 413, 415, 422)
                                            uncertain = !rejected
                                            error = if (rejected) {
                                                ex.message?.take(220) ?: tr(lang,
                                                    "The server rejected this attachment.",
                                                    "سرور فایل یا پیام را نپذیرفت.")
                                            } else tr(lang,
                                                "Delivery is uncertain. Check the conversation before resending.",
                                                "وضعیت ارسال مشخص نیست؛ قبل از ارسال دوباره پیام‌ها را بررسی کنید.")
                                        } finally { sending = false }
                                    }
                                },
                                enabled = !sending && !uncertain &&
                                    (draft.isNotBlank() || chosenFile != null),
                                modifier = Modifier.size(54.dp),
                                shape = RoundedCornerShape(17.dp),
                                colors = IconButtonDefaults.filledIconButtonColors(
                                    containerColor = chatMint, contentColor = chatNavy)
                            ) {
                                if (sending) CircularProgressIndicator(Modifier.size(19.dp),
                                    strokeWidth = 2.dp, color = chatNavy)
                                else Icon(Icons.Default.Send,
                                    tr(lang,"Send reply","ارسال پاسخ"))
                            }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Lock, null, tint = chatMuted,
                                modifier = Modifier.size(12.dp))
                            Spacer(Modifier.width(5.dp))
                            Text(tr(lang,"Private ticket · Avoid sharing passwords",
                                "تیکت خصوصی · از ارسال رمز عبور خودداری کنید"),
                                color = chatMuted, fontSize = 10.sp,
                                modifier = Modifier.weight(1f))
                            Text("${draft.length}/5000", color = chatMuted, fontSize = 10.sp)
                        }
                    } else {
                        Row(Modifier.fillMaxWidth().padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.TaskAlt, null, tint = Color(0xFF108B5C))
                            Spacer(Modifier.width(9.dp))
                            Text(tr(lang,
                                "This conversation is finished. Open a new request if you need more help.",
                                "این گفت‌وگو پایان یافته است. در صورت نیاز درخواست جدید ثبت کنید."),
                                color = chatInk, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
    if (askClose) {
        AlertDialog(
            onDismissRequest = { if (!closing) askClose = false },
            icon = { Icon(Icons.Default.TaskAlt, null, tint = chatBlue) },
            title = { Text(tr(lang,"Close support ticket?","بستن درخواست پشتیبانی؟")) },
            text = { Text(tr(lang,
                "You will not be able to reply to this ticket after closing it.",
                "پس از بستن این درخواست، دیگر نمی‌توانید در همین گفت‌وگو پاسخ ارسال کنید.")) },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            closing = true
                            try {
                                val token = vault.accessToken(api)
                                    ?: throw IllegalStateException("Sign in required")
                                activeTicket = api.closeSupportTicket(token, ticket.id)
                                askClose = false
                                error = null
                                onUpdated()
                            } catch (ex: Exception) {
                                // A timeout may happen after the server has committed
                                // the close. Read back the authoritative status
                                // instead of telling users it definitely failed.
                                askClose = false
                                refresh()
                                if (activeTicket.status == "closed") {
                                    error = null
                                    onUpdated()
                                } else {
                                    error = (ex as? ApiFailure)?.message?.take(220)
                                        ?: tr(lang,
                                            "Could not confirm closure. Refresh this ticket before retrying.",
                                            "بسته‌شدن تیکت تأیید نشد. پیش از تلاش دوباره، وضعیت آن را تازه‌سازی کنید.")
                                }
                            } finally { closing = false }
                        }
                    }, enabled = !closing,
                    colors = ButtonDefaults.buttonColors(containerColor = chatBlue)
                ) { Text(tr(lang,"Close request","بستن درخواست")) }
            },
            dismissButton = {
                TextButton(onClick = { askClose = false }, enabled = !closing) {
                    Text(tr(lang,"Cancel","انصراف"))
                }
            }
        )
    }
}
