package com.betvima.app.ui

import android.media.AudioManager
import android.media.ToneGenerator
import android.speech.tts.TextToSpeech
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.layout.ContentScale
import com.betvima.app.BuildConfig
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.betvima.app.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val messengerBlue = Color(0xFF087FF5)
private val messengerButton = Color(0xFF087FF5)
private val messengerPaper = Color(0xFF111113)
private val messengerGray = Color(0xFF29292C)
private val messengerInk = Color(0xFFF5F6F8)
private val messengerMuted = Color(0xFFA6A9B3)

private fun chatTime(date: String): String = try {
    DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault())
        .format(Instant.parse(date))
} catch (_: Exception) { date.take(16).substringAfter("T", "") }

private data class MessengerDocument(
    val uri: Uri, val name: String, val type: String, val size: Long
)

internal enum class SupportAttachmentPhase { READY, UPLOADING, FAILED, VERIFY }

internal fun supportAttachmentPhaseLabel(phase: SupportAttachmentPhase, lang: Lang): String =
    when (phase) {
        SupportAttachmentPhase.READY -> tr(lang, "Ready to send", "آماده ارسال")
        SupportAttachmentPhase.UPLOADING -> tr(lang, "Uploading...", "در حال ارسال...")
        SupportAttachmentPhase.FAILED -> tr(lang, "Upload failed · retry", "ارسال ناموفق · تلاش دوباره")
        SupportAttachmentPhase.VERIFY -> tr(lang, "Check chat before retrying", "قبل از ارسال مجدد، چت را بررسی کنید")
    }

private fun definiteAttachmentFailure(error: Exception): Boolean =
    error is ApiFailure && error.code in 400..499 && error.code !in setOf(408, 409, 429)

/** Keep server diagnostics actionable without exposing private backend details. */
internal fun supportAttachmentErrorMessage(status: Int?, lang: Lang): String =
    when (status) {
        400, 415, 422 -> tr(lang,
            "File content or format was rejected (HTTP $status). Choose a JPG, PNG, WEBP or PDF.",
            "محتوا یا نوع فایل پذیرفته نشد (خطای $status). JPG، PNG، WEBP یا PDF انتخاب کنید.")
        401, 403 -> tr(lang,
            "Upload access denied (HTTP $status). Sign in again or contact support.",
            "دسترسی آپلود رد شد (خطای $status). دوباره وارد شوید یا با پشتیبانی تماس بگیرید.")
        413 -> tr(lang,
            "Upload is too large for the gateway (HTTP 413). Choose a smaller image.",
            "حجم عکس از محدودیت درگاه بیشتر است (خطای ۴۱۳). عکس کوچک‌تری انتخاب کنید.")
        409 -> tr(lang,
            "This conversation cannot accept uploads (HTTP 409). Refresh the chat.",
            "این گفت‌وگو امکان دریافت فایل ندارد (خطای ۴۰۹). چت را تازه‌سازی کنید.")
        429 -> tr(lang,
            "Too many upload attempts (HTTP 429). Try again later.",
            "تعداد تلاش‌ها زیاد است (خطای ۴۲۹). کمی بعد تلاش کنید.")
        else -> tr(lang, "Upload rejected. Refresh the chat or contact support.",
            "آپلود رد شد. گفتگو را تازه‌سازی کنید یا با پشتیبانی تماس بگیرید.")
    }

private val supportDisplayNames206 = listOf("Olivia", "Amelia", "Sophia", "Charlotte", "Mia",
    "Emma", "Isabella", "Grace", "James", "Daniel", "Ethan", "Noah", "Oliver", "Liam",
    "Lucas", "Henry")
internal fun supportDisplayName206(ticketId: String): String {
    var hash = 0x811c9dc5.toInt()
    ticketId.forEach { hash = (hash xor it.code) * 16777619 }
    return supportDisplayNames206[((hash.toLong() and 0xffffffffL) % supportDisplayNames206.size).toInt()]
}
private fun messengerActive(ticket: SupportTicket): Boolean = supportActive(ticket.status)

// Layout invariants for compact bubbles and safe navigation on gesture devices.
internal fun supportChatBubbleCapDp(viewportDp: Int): Float = viewportDp * .76f
internal fun supportChatBottomClearanceDp(keyboardVisible: Boolean): Int =
    if (keyboardVisible) 6 else 8

@Composable
private fun MessengerIcon(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String, onClick: () -> Unit, enabled: Boolean = true,
    tint: Color = Color(0xFFA6A9B3)
) {
    IconButton(onClick = onClick, enabled = enabled) {
        Icon(icon, label, tint = tint, modifier = Modifier.size(23.dp))
    }
}

/**
 * A native, full-screen messenger dialog. Closing the dialog does NOT call the
 * ticket close API. Both the website and the app use the same authenticated
 * conversation IDs and server-side message/attachment storage.
 */
@Composable
fun SupportMessenger(
    state: AppState,
    model: AppViewModel,
    requestedTicketId: String?,
    onDismiss: () -> Unit
) {
    val lang = state.lang
    val context = LocalContext.current
    val api = remember { ApiClient() }
    val vault = remember(context) { SessionVault(context) }
    val scope = rememberCoroutineScope()
    val prefs = remember(context) { context.getSharedPreferences("betvima_support_chat", 0) }
    val listState = rememberLazyListState()
    // Bubble width follows its content; only long messages reach this viewport cap.
    val bubbleMaxWidth = supportChatBubbleCapDp(LocalConfiguration.current.screenWidthDp).dp
    val keyboardVisible = WindowInsets.ime.getBottom(LocalDensity.current) > 0
    // Android 15 gesture navigation can draw over a fullscreen Dialog's bottom edge.
    // Reserve a real layout slot instead of only relying on the window inset report.
    val bottomClearance = supportChatBottomClearanceDp(keyboardVisible).dp
    val pulseTransition = rememberInfiniteTransition(label = "supportAgentPulse206")
    val onlinePulse by pulseTransition.animateFloat(
        initialValue = .48f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(880), RepeatMode.Reverse),
        label = "onlinePresenceAlpha206")
    var supportOnline by remember { mutableStateOf(false) }
    var incomingSound by remember { mutableStateOf(prefs.getBoolean("incoming_sound", true)) }
    var outgoingSound by remember { mutableStateOf(prefs.getBoolean("outgoing_sound", true)) }
    var speaker by remember { mutableStateOf<TextToSpeech?>(null) }
    var speakerReady by remember { mutableStateOf(false) }
    DisposableEffect(context) {
        val tts = TextToSpeech(context) { result -> speakerReady = result == TextToSpeech.SUCCESS }
        speaker = tts
        onDispose { tts.stop(); tts.shutdown(); speaker = null }
    }
    fun playMessage(body: String) {
        val engine = speaker ?: return
        if (!speakerReady || body.isBlank()) return
        runCatching {
            engine.language = if (body.any { it.code in 0x0600..0x06FF }) Locale("fa") else Locale.US
            engine.speak(body.take(2500), TextToSpeech.QUEUE_FLUSH, null, "support_message_206")
        }
    }
    var tickets by remember { mutableStateOf<List<SupportTicket>>(emptyList()) }
    var chosen by remember { mutableStateOf<SupportTicket?>(null) }
    var messages by remember { mutableStateOf<List<SupportThreadMessage>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var sending by remember { mutableStateOf(false) }
    var uncertain by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var draft by rememberSaveable { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var file by remember { mutableStateOf<MessengerDocument?>(null) }
    var attachmentPhase by remember { mutableStateOf(SupportAttachmentPhase.READY) }
    var attachmentViewToken by remember { mutableStateOf<String?>(null) }
    var menuOpen by remember { mutableStateOf(false) }
    var historyOpen by remember { mutableStateOf(false) }
    var emojiOpen by remember { mutableStateOf(false) }
    var ratingOpen by remember { mutableStateOf(false) }
    var rating by remember { mutableIntStateOf(0) }
    var feedback by remember { mutableStateOf("") }
    var confirmEnd by remember { mutableStateOf(false) }
    var muted by remember { mutableStateOf(prefs.getBoolean("muted", false)) }
    var newConversation by remember { mutableStateOf(false) }
    var lastSupportId by remember { mutableStateOf<String?>(null) }
    val currentId = chosen?.id
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) scope.launch {
            try {
                val candidate = withContext(Dispatchers.IO) {
                    val resolver = context.contentResolver
                    val mime = resolver.getType(uri).orEmpty()
                    var display = "attachment"
                    var bytes = -1L
                    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
                        ?.use { cursor ->
                            if (cursor.moveToFirst()) {
                                val n = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                                val s = cursor.getColumnIndex(OpenableColumns.SIZE)
                                if (n >= 0 && !cursor.isNull(n)) display = cursor.getString(n).orEmpty()
                                if (s >= 0 && !cursor.isNull(s)) bytes = cursor.getLong(s)
                            }
                        }
                    require(supportUploadSelectable(mime, bytes)) { "Unsupported file" }
                    MessengerDocument(uri, supportSafeFilename(display), mime, bytes)
                }
                file = candidate
                attachmentPhase = SupportAttachmentPhase.READY
                uncertain = false
                error = null
            } catch (_: Exception) {
                error = tr(lang, "Choose a JPG, PNG, WEBP or PDF up to 10MB.",
                    "فایل JPG، PNG، WEBP یا PDF تا ۱۰ مگابایت انتخاب کنید.")
            }
        }
    }

    suspend fun token(): String = vault.accessToken(api)
        ?: throw IllegalStateException(tr(lang, "Please sign in again.", "لطفاً دوباره وارد شوید."))

    suspend fun reloadTickets() {
        val first = api.supportTickets(token(), 1)
        val all = first.items.toMutableList()
        // Locate an existing active conversation before creating anything new.
        var page = 2
        var more = first.hasMore
        while (more && page <= 10 && all.none(::messengerActive)) {
            val next = api.supportTickets(token(), page++)
            all += next.items
            more = next.hasMore
        }
        tickets = all.distinctBy { it.id }
    }

    LaunchedEffect(state.signedIn, requestedTicketId) {
        if (!state.signedIn) {
            chosen = null; loading = false; return@LaunchedEffect
        }
        loading = true
        try {
            reloadTickets()
            val exact = requestedTicketId?.takeIf(::validSupportNotificationTicketId)
            val destination = if (exact != null) {
                tickets.firstOrNull { it.id.equals(exact, ignoreCase = true) }
                    ?: api.supportConversation(token(), exact).ticket
            } else null
            chosen = destination ?: tickets.firstOrNull(::messengerActive)
            newConversation = false
            error = null
        } catch (ex: Exception) {
            // Never jump to a different private ticket when a notification
            // deep-link fails (including unauthorized or missing tickets).
            chosen = null
            error = ex.message ?: tr(lang, "Unable to load support.", "خطا در دریافت پشتیبانی.")
        } finally { loading = false }
    }

    LaunchedEffect(currentId) {
        attachmentViewToken = if (currentId != null) {
            try { token() } catch (_: Exception) { null }
        } else null
    }

    LaunchedEffect(currentId, newConversation) {
        if (currentId == null || newConversation) { messages = emptyList(); return@LaunchedEffect }
        val id = currentId
        messages = emptyList()
        lastSupportId = null
        while (true) {
            try {
                val result = api.supportConversation(token(), id)
                chosen = result.ticket
                val latestSupport = result.messages.lastOrNull { it.senderRole == "support" }?.id
                if (lastSupportId != null && latestSupport != null &&
                    lastSupportId != latestSupport && incomingSound && !muted) {
                    val player = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 40)
                    try { player.startTone(ToneGenerator.TONE_PROP_BEEP, 130); delay(150) }
                    finally { player.release() }
                }
                lastSupportId = latestSupport
                messages = result.messages.distinctBy { it.id }
                supportOnline = result.supportOnline
                if (result.messages.any { it.senderRole == "support" && it.readAt == null }) {
                    runCatching { api.markSupportRead(token(), id) }
                }
                error = null
            } catch (ex: Exception) {
                if (messages.isEmpty()) error = ex.message ?: "Unable to load messages"
            }
            delay(5_000)
        }
    }

    LaunchedEffect(messages.lastOrNull()?.id, currentId) {
        if (messages.isNotEmpty()) {
            delay(75)
            val bottomItem = messages.size + 1 +
                if (messages.any { it.senderRole == "support" }) 1 else 0
            listState.animateScrollToItem(bottomItem)
        }
    }

    LaunchedEffect(currentId, state.notifications) {
        val id = currentId ?: return@LaunchedEffect
        if (newConversation) return@LaunchedEffect
        state.notifications.filter {
            it.eventKey == "support.reply" && it.readAt == null &&
                supportTicketFromNotificationHref(it.ctaHref) == id
        }.forEach { model.markNotificationRead(it.id) }
    }

    suspend fun send() {
        if (sending || uncertain || chosen == null || !messengerActive(chosen!!) ||
            (draft.isBlank() && file == null)) return
        val target = chosen!!.id
        val previous = draft
        val attached = file
        sending = true; error = null
        if (attached != null) attachmentPhase = SupportAttachmentPhase.UPLOADING
        try {
            val jwt = token()
            val acknowledged = if (attached == null) api.sendSupportMessage(jwt, target, previous)
                else api.sendSupportFile(jwt, target, previous,
                    context.contentResolver, attached.uri, attached.name, attached.type)
            // A successful POST response is the upload acknowledgement. Show the
            // message immediately even if the subsequent conversation GET fails.
            if (messages.none { it.id == acknowledged.id }) messages = messages + acknowledged
            if (outgoingSound && !muted) runCatching {
                val tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 28)
                tone.startTone(ToneGenerator.TONE_PROP_ACK, 80)
                delay(95)
                tone.release()
            }
            draft = ""; file = null; emojiOpen = false
            attachmentPhase = SupportAttachmentPhase.READY
            try {
                val latest = api.supportConversation(jwt, target)
                messages = latest.messages.distinctBy { it.id }
                chosen = latest.ticket
            } catch (_: Exception) {
                error = tr(lang, "Sent. Chat refresh is temporarily unavailable.",
                    "ارسال شد؛ تازه‌سازی گفتگو موقتاً در دسترس نیست.")
            }
        } catch (ex: Exception) {
            val definite = definiteAttachmentFailure(ex)
            uncertain = !definite
            if (attached != null) attachmentPhase =
                if (definite) SupportAttachmentPhase.FAILED else SupportAttachmentPhase.VERIFY
            error = if (definite) supportAttachmentErrorMessage((ex as? ApiFailure)?.code, lang)
            else tr(lang,
                "Delivery is not confirmed. Refresh the chat before trying again.",
                "تأیید ارسال دریافت نشد؛ پیش از تلاش دوباره، گفتگو را تازه‌سازی کنید.")
        } finally { sending = false }
    }

    suspend fun start() {
        if (sending || uncertain || draft.isBlank()) return
        sending = true; error = null
        val body = if (name.isBlank()) draft.trim()
            else ("Name: " + name.trim().take(80) + "\n\n" + draft.trim()).take(5000)
        val attached = file
        try {
            val jwt = token()
            val created = api.createTicket(jwt, "general", "Online Support", body)
            // Once created, NEVER create a second ticket because its upload failed.
            chosen = created; newConversation = false; draft = ""
            if (attached != null) {
                attachmentPhase = SupportAttachmentPhase.UPLOADING
                try {
                    val acknowledged = api.sendSupportFile(jwt, created.id, "",
                        context.contentResolver, attached.uri, attached.name, attached.type)
                    messages = listOf(acknowledged)
                    file = null
                    attachmentPhase = SupportAttachmentPhase.READY
                } catch (ex: Exception) {
                    val definite = definiteAttachmentFailure(ex)
                    attachmentPhase = if (definite) SupportAttachmentPhase.FAILED
                        else SupportAttachmentPhase.VERIFY
                    uncertain = !definite
                    error = tr(lang,
                        "Chat started, but the attachment was not confirmed. Check the chat before resending.",
                        "گفتگو ایجاد شد ولی ارسال پیوست تأیید نشده؛ قبل از ارسال مجدد چت را بررسی کنید.")
                }
            } else file = null
            try { reloadTickets() } catch (_: Exception) { /* Keep the newly created ticket open. */ }
        } catch (_: Exception) {
            uncertain = true
            error = tr(lang,
                "Ticket status is uncertain. Close and reopen support before retrying.",
                "وضعیت ایجاد تیکت مشخص نیست؛ پیش از تلاش دوباره پشتیبانی را ببندید و باز کنید.")
        } finally { sending = false }
    }

    suspend fun refreshConversation() {
        val id = currentId ?: return
        try {
            val latest = api.supportConversation(token(), id)
            messages = latest.messages.distinctBy { it.id }; chosen = latest.ticket
            uncertain = false
            if (attachmentPhase == SupportAttachmentPhase.VERIFY)
                attachmentPhase = SupportAttachmentPhase.READY
            error = null
        } catch (ex: Exception) { error = ex.message ?: "Refresh failed" }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = true
        )
    ) {
        Column(
            Modifier.fillMaxSize().background(messengerPaper)
                .statusBarsPadding().imePadding().navigationBarsPadding()
        ) {
            if (!state.signedIn) {
                Row(Modifier.fillMaxWidth().padding(18.dp),
                    horizontalArrangement = Arrangement.End) {
                    MessengerIcon(Icons.Default.Close, tr(lang,"Close","بستن"),onDismiss)
                }
                Text(tr(lang, "Sign in to chat with support.", "برای چت با پشتیبانی وارد شوید."),
                    modifier = Modifier.padding(24.dp), color = messengerInk)
                Button(onClick = { onDismiss(); model.showLogin(true) },
                    modifier = Modifier.padding(24.dp)) {
                    Text(tr(lang, "Sign in", "ورود"))
                }
            } else if (loading) {
                Row(Modifier.fillMaxWidth().padding(14.dp),
                    horizontalArrangement = Arrangement.End) {
                    MessengerIcon(Icons.Default.Close, "Close", onDismiss)
                }
                LinearProgressIndicator(Modifier.fillMaxWidth(), color = messengerBlue)
            } else if (chosen == null || newConversation) {
                Box(Modifier.fillMaxWidth().height(195.dp).background(
                    Brush.linearGradient(listOf(Color(0xFF546E86), Color(0xFF283F54))))) {
                    Column(Modifier.align(Alignment.CenterStart).padding(horizontal = 23.dp)) {
                        Text("•" + tr(lang,"Online Support","پشتیبانی آنلاین") + "•",
                            fontSize = 26.sp, color = Color.White, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(12.dp))
                        Text(tr(lang,"We are ready to help you 24/7.\nPlease enter your contact information and your question.",
                            "۲۴ ساعته در کنار شما هستیم.\nنام و پیام خود را وارد کنید."),
                            fontSize = 15.sp, lineHeight = 23.sp, color = Color.White)
                    }
                    IconButton(onClick = onDismiss, modifier = Modifier.align(Alignment.TopEnd)
                        .padding(10.dp).background(Color.Black.copy(alpha=.18f),CircleShape)) {
                        Icon(Icons.Default.Close, "Close", tint = Color.White)
                    }
                }
                Column(Modifier.fillMaxWidth().weight(1f)
                    .clip(RoundedCornerShape(topStart=27.dp, topEnd=27.dp))
                    .background(messengerPaper).padding(horizontal=24.dp, vertical=23.dp)) {
                    if (tickets.any(::messengerActive) && !newConversation) {
                        TextButton(onClick = { chosen = tickets.firstOrNull(::messengerActive) }) {
                            Text(tr(lang,"Resume conversation","ادامه گفت‌وگو"))
                        }
                    }
                    if (tickets.isNotEmpty()) {
                        TextButton(onClick = { historyOpen=true }) {
                            Text(tr(lang,"Previous conversations","گفت‌وگوهای قبلی"), color=messengerBlue)
                        }
                    }
                    MessengerInput(name, { name=it.take(80) },
                        tr(lang,"Your name (optional)","نام شما (اختیاری)"))
                    Spacer(Modifier.height(16.dp))
                    MessengerComposer(draft, {draft=it.take(5000)}, file, attachmentPhase,
                        {file=null;attachmentPhase=SupportAttachmentPhase.READY},
                        {picker.launch(arrayOf("image/jpeg","image/png","image/webp","application/pdf"))},
                        {emojiOpen=!emojiOpen}, {scope.launch{start()}}, !sending && !uncertain && draft.isNotBlank(),
                        lang, expanded=true)
                    if (emojiOpen) MessengerEmojiPicker { draft=(draft+it).take(5000);emojiOpen=false }
                    if (error != null) Text(error.orEmpty(), color=Color(0xFFCA354C), fontSize=12.sp,
                        modifier=Modifier.padding(top=10.dp))
                    Button(
                        onClick={scope.launch{start()}},
                        enabled=!sending && !uncertain && draft.isNotBlank(),
                        modifier=Modifier.fillMaxWidth().padding(top=20.dp).height(60.dp),
                        shape=RoundedCornerShape(18.dp),
                        colors=ButtonDefaults.buttonColors(containerColor=messengerButton)
                    ) { Text(tr(lang,"Start chat","شروع گفت‌وگو"), fontSize=17.sp, fontWeight=FontWeight.Bold) }
                }
            } else {
                val ticket = chosen!!
                Row(Modifier.fillMaxWidth().height(92.dp)
                    .padding(horizontal=18.dp), verticalAlignment=Alignment.CenterVertically) {
                    Box(Modifier.size(42.dp).clip(CircleShape).background(
                        Brush.linearGradient(listOf(Color(0xFF174CBB),messengerButton))),
                        contentAlignment=Alignment.Center) {
                        Text("BV",color=Color.White,fontSize=14.sp,fontWeight=FontWeight.Black)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(supportDisplayName206(ticket.id) + " · BetVima Support",
                            color=messengerInk,fontSize=18.sp,fontWeight=FontWeight.SemiBold,
                            maxLines=1,overflow=TextOverflow.Ellipsis)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(8.dp).clip(CircleShape)
                                .background(if (supportOnline) Color(0xFF00D47A).copy(alpha = onlinePulse)
                                    else Color(0xFF7B808B)))
                            Spacer(Modifier.width(6.dp))
                            Text(if (supportOnline) tr(lang, "Support online", "پشتیبان آنلاین است")
                                else tr(lang, "Support offline", "پشتیبان آفلاین است"),
                                color=messengerMuted,fontSize=12.sp)
                        }
                    }
                    Box {
                        MessengerIcon(Icons.Default.MoreVert, tr(lang,"Options","گزینه‌ها"),{menuOpen=true})
                        DropdownMenu(expanded=menuOpen,onDismissRequest={menuOpen=false},
                            modifier=Modifier.background(messengerGray)) {
                            DropdownMenuItem(
                                text={Text(tr(lang,
                                    if (muted) "Switch on sound" else "Switch off sound",
                                    if (muted) "فعال کردن صدا" else "خاموش کردن صدا"),color=messengerInk)},
                                onClick={muted=!muted;prefs.edit().putBoolean("muted",muted).apply();menuOpen=false},
                                leadingIcon={Icon(if(muted) Icons.Default.VolumeOff else Icons.Default.VolumeUp,null)}
                            )
                            DropdownMenuItem(
                                text={Text(tr(lang,"Incoming message sound","صدای پیام دریافتی"),color=messengerInk)},
                                onClick={incomingSound=!incomingSound;prefs.edit().putBoolean("incoming_sound",incomingSound).apply();menuOpen=false},
                                leadingIcon={Icon(if(incomingSound) Icons.Default.VolumeUp else Icons.Default.VolumeOff,null)}
                            )
                            DropdownMenuItem(
                                text={Text(tr(lang,"Outgoing message sound","صدای پیام ارسالی"),color=messengerInk)},
                                onClick={outgoingSound=!outgoingSound;prefs.edit().putBoolean("outgoing_sound",outgoingSound).apply();menuOpen=false},
                                leadingIcon={Icon(if(outgoingSound) Icons.Default.VolumeUp else Icons.Default.VolumeOff,null)}
                            )
                            DropdownMenuItem(
                                text={Text(tr(lang,"Rate the manager","امتیاز به پشتیبان"),color=messengerInk)},
                                onClick={ratingOpen=true;menuOpen=false}, enabled=messengerActive(ticket),
                                leadingIcon={Icon(Icons.Default.Star,null)}
                            )
                            DropdownMenuItem(
                                text={Text(tr(lang,"Chat history","تاریخچه گفت‌وگو"),color=messengerInk)},
                                onClick={historyOpen=true;menuOpen=false},
                                leadingIcon={Icon(Icons.Default.History,null)}
                            )
                            if (messengerActive(ticket)) DropdownMenuItem(
                                text={Text(tr(lang,"End conversation","پایان گفت‌وگو"),color=Color.Red)},
                                onClick={confirmEnd=true;menuOpen=false},
                                leadingIcon={Icon(Icons.Default.Close,null,tint=Color.Red)}
                            )
                        }
                    }
                    MessengerIcon(Icons.Default.Close,tr(lang,"Close window","بستن پنجره"),onDismiss,tint=messengerInk)
                }
                HorizontalDivider(color=Color(0xFF39393D))
                LazyColumn(
                    modifier=Modifier.weight(1f).fillMaxWidth(),
                    state=listState,
                    contentPadding=PaddingValues(horizontal=16.dp,vertical=15.dp),
                    verticalArrangement=Arrangement.spacedBy(12.dp, Alignment.Bottom)
                ) {
                    item {
                        Box(Modifier.fillMaxWidth(),contentAlignment=Alignment.Center) {
                            Text(ticket.createdAt.take(10),fontSize=12.sp,color=messengerMuted,
                                modifier=Modifier.clip(CircleShape).background(messengerGray)
                                    .padding(horizontal=14.dp,vertical=7.dp))
                        }
                    }
                    if (messages.any {it.senderRole=="support"}) item {
                        Text(tr(lang,"A support manager joined the chat","پشتیبان وارد گفت‌وگو شد"),
                            modifier=Modifier.fillMaxWidth(),color=Color.LightGray,
                            fontSize=12.sp)
                    }
                    items(messages,key={it.id}) { message ->
                        val mine=message.senderRole == "user"
                        Row(Modifier.fillMaxWidth().animateItem(
                            fadeInSpec = tween(260),
                            placementSpec = spring(stiffness = Spring.StiffnessLow),
                            fadeOutSpec = tween(180)
                        ),
                            horizontalArrangement=if(mine) Arrangement.End else Arrangement.Start) {
                            Column(
                                Modifier.widthIn(min = 108.dp, max = bubbleMaxWidth)
                                    .clip(RoundedCornerShape(
                                        topStart=21.dp,topEnd=21.dp,
                                        bottomEnd=if(mine) 5.dp else 21.dp,
                                        bottomStart=if(mine) 21.dp else 5.dp
                                    ))
                                    .background(if(mine) messengerBlue else messengerGray)
                                    .padding(horizontal=18.dp,vertical=11.dp)
                            ) {
                                if (message.body.isNotBlank()) Text(message.body,
                                    color=if(mine) Color.White else messengerInk,
                                    fontSize=16.sp,lineHeight=23.sp)
                                if (message.attachmentDetails.isNotEmpty()) {
                                    message.attachmentDetails.forEach { attachment ->
                                        MessengerUploadedAttachment(
                                            attachment, ticket.id, attachmentViewToken, mine, lang
                                        )
                                    }
                                } else {
                                    message.attachments.forEach { attachment ->
                                        Row(verticalAlignment=Alignment.CenterVertically) {
                                            Icon(Icons.Default.AttachFile,null,
                                                tint=if(mine) Color.White else messengerBlue,
                                                modifier=Modifier.size(18.dp))
                                            Text(attachment,color=if(mine) Color.White else messengerBlue,
                                                fontSize=13.sp,maxLines=2,overflow=TextOverflow.Ellipsis)
                                        }
                                    }
                                }
                                Row(Modifier.align(Alignment.End),
                                    horizontalArrangement=Arrangement.End,
                                    verticalAlignment=Alignment.CenterVertically) {
                                    if (mine) Icon(
                                        if (message.readAt != null) Icons.Default.DoneAll else Icons.Default.Check,
                                        tr(lang, if (message.readAt != null) "Read" else "Sent",
                                            if (message.readAt != null) "خوانده‌شده" else "ارسال‌شده"),
                                        tint=if(message.readAt != null) Color(0xFFB3FFD1)
                                            else Color.White.copy(alpha=.8f),
                                        modifier=Modifier.size(15.dp))
                                    if (message.body.isNotBlank()) {
                                        IconButton(onClick = { playMessage(message.body) },
                                            enabled = speakerReady, modifier = Modifier.size(28.dp)) {
                                            Icon(Icons.Default.VolumeUp,
                                                tr(lang, "Play message", "پخش صوتی پیام"),
                                                tint = if (mine) Color.White.copy(alpha = .88f)
                                                    else messengerMuted,
                                                modifier = Modifier.size(16.dp))
                                        }
                                    }
                                    Text(chatTime(message.createdAt),
                                        color=if(mine) Color.White.copy(alpha=.75f) else messengerMuted,
                                        fontSize=11.sp)
                                }
                            }
                        }
                    }
                    item { Spacer(Modifier.height(2.dp)) }
                }
                if (error != null) Row(Modifier.fillMaxWidth().padding(horizontal=18.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    Text(error.orEmpty(),color=Color(0xFFB93348),fontSize=11.sp,modifier=Modifier.weight(1f))
                    TextButton(onClick={scope.launch{refreshConversation()}}) {
                        Text(tr(lang,"Refresh","تازه‌سازی"),color=messengerBlue)
                    }
                }
                if (messengerActive(ticket)) {
                    if (emojiOpen) MessengerEmojiPicker { draft=(draft+it).take(5000);emojiOpen=false }
                    MessengerComposer(draft,{draft=it.take(5000)},file,attachmentPhase,
                        {file=null;attachmentPhase=SupportAttachmentPhase.READY},
                        {picker.launch(arrayOf("image/jpeg","image/png","image/webp","application/pdf"))},
                        {emojiOpen=!emojiOpen},{scope.launch{send()}},
                        !sending && !uncertain && (draft.isNotBlank() || file!=null),lang)
                } else {
                    TextButton(onClick={chosen=null;newConversation=true;draft="";file=null},
                        modifier=Modifier.fillMaxWidth().padding(13.dp)) {
                        Text(tr(lang,"Start a new chat","شروع گفت‌وگوی جدید"),color=messengerBlue)
                    }
                }
                // Keep the composer and send icon above the Android gesture area.
                Spacer(Modifier.fillMaxWidth().height(bottomClearance))
            }
        }
        if (historyOpen) AlertDialog(
            containerColor = messengerGray,
            onDismissRequest={historyOpen=false},
            title={Text(tr(lang,"Previous conversations","گفت‌وگوهای قبلی"),color=messengerInk)},
            text={
                Column(Modifier.heightIn(max=400.dp)) {
                    tickets.forEach { ticket ->
                        TextButton(onClick={
                            chosen=ticket;newConversation=false;historyOpen=false;error=null
                        },modifier=Modifier.fillMaxWidth()) {
                            Text(ticket.subject+" · "+ticket.status,
                                color=messengerInk,maxLines=2)
                        }
                    }
                    TextButton(onClick={
                        chosen=null;newConversation=true;draft="";file=null;historyOpen=false;error=null
                    }) {Text(tr(lang,"New chat","گفت‌وگوی جدید"),color=messengerBlue)}
                }
            },
            confirmButton={TextButton(onClick={historyOpen=false}){Text(tr(lang,"Close","بستن"))}}
        )
        if (confirmEnd) AlertDialog(
            containerColor = messengerGray,
            onDismissRequest={confirmEnd=false},
            title={Text(tr(lang,"End this conversation?","پایان این گفت‌وگو؟"),color=messengerInk)},
            text={Text(tr(lang,
                "The X button only hides the chat. End the ticket only if your issue is resolved.",
                "دکمه × فقط پنجره را می‌بندد. فقط در صورت رفع مشکل، گفت‌وگو را پایان دهید."),color=messengerInk)},
            confirmButton={
                TextButton(onClick={
                    scope.launch {
                        sending=true
                        try { chosen=api.closeSupportTicket(token(),currentId!!); reloadTickets()
                            confirmEnd=false }
                        catch(ex:Exception){error=ex.message}
                        finally{sending=false}
                    }
                },enabled=!sending){Text(tr(lang,"End chat","پایان چت"),color=Color.Red)}
            },
            dismissButton={TextButton(onClick={confirmEnd=false}){Text(tr(lang,"Keep chatting","ادامه چت"))}}
        )
        if (ratingOpen) AlertDialog(
            containerColor = messengerGray,
            onDismissRequest={ratingOpen=false},
            title={Text(tr(lang,"Rate the manager","امتیاز به پشتیبان"),color=messengerInk)},
            text={
                Column {
                    Row {
                        (1..5).forEach { index ->
                            IconButton(onClick={rating=index}) {
                                Icon(if(index<=rating) Icons.Default.Star else Icons.Default.StarBorder,
                                    "$index",tint=if(index<=rating) Color(0xFFFFB83D) else messengerMuted)
                            }
                        }
                    }
                    OutlinedTextField(value=feedback,onValueChange={feedback=it.take(400)},
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = messengerInk, unfocusedTextColor = messengerInk,
                            focusedContainerColor = messengerPaper, unfocusedContainerColor = messengerPaper,
                            focusedBorderColor = messengerBlue,
                            unfocusedBorderColor = Color(0xFF39393D),
                            focusedPlaceholderColor = messengerMuted,
                            unfocusedPlaceholderColor = messengerMuted),
                        placeholder={Text(tr(lang,"Feedback (optional)","نظر شما (اختیاری)"))})
                }
            },
            confirmButton={
                TextButton(enabled=rating>0&&!sending,onClick={
                    val id=currentId ?: return@TextButton
                    scope.launch {
                        sending=true
                        try {
                            api.sendSupportMessage(token(),id,
                                "Support rating: $rating/5" +
                                    if(feedback.isBlank()) "" else "\n"+feedback.trim())
                            ratingOpen=false;rating=0;feedback=""
                            refreshConversation()
                        } catch(ex:Exception){error=ex.message}
                        finally{sending=false}
                    }
                }){Text(tr(lang,"Submit","ثبت"))}
            },
            dismissButton={TextButton(onClick={ratingOpen=false}){Text(tr(lang,"Cancel","انصراف"))}}
        )
    }
}

@Composable
private fun MessengerInput(value: String,onValueChange:(String)->Unit,hint:String) {
    BasicTextField(value=value,onValueChange=onValueChange,
        modifier=Modifier.fillMaxWidth().heightIn(min=65.dp)
            .clip(RoundedCornerShape(18.dp)).background(messengerGray)
            .padding(horizontal=22.dp,vertical=21.dp),
        textStyle=androidx.compose.ui.text.TextStyle(color=messengerInk,fontSize=17.sp),
        singleLine=true,
        decorationBox={inner->
            Box {
                if(value.isEmpty()) Text(hint,color=messengerMuted,fontSize=17.sp)
                inner()
            }
        }
    )
}

@Composable
private fun MessengerEmojiPicker(onSelect:(String)->Unit) {
    val options=listOf("😊","🙂","❤️","👍","🙏","✅","😢","🤝","🎉","💙")
    Row(Modifier.fillMaxWidth().background(messengerPaper).padding(8.dp),
        horizontalArrangement=Arrangement.spacedBy(6.dp)) {
        options.forEach { emoji ->
            Text(emoji,modifier=Modifier.weight(1f).clickable{onSelect(emoji)},fontSize=19.sp)
        }
    }
}

@Composable
private fun MessengerComposer(
    draft: String, onDraft: (String) -> Unit,
    file: MessengerDocument?, phase: SupportAttachmentPhase,
    clearFile: () -> Unit,
    onAttach: () -> Unit, onEmoji: () -> Unit, onSend: () -> Unit,
    enabled: Boolean, lang: Lang, expanded: Boolean = false
) {
    Column(Modifier.fillMaxWidth().background(messengerPaper)
        .padding(horizontal = if (expanded) 0.dp else 15.dp, vertical = 10.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f).clip(RoundedCornerShape(18.dp))
                .background(messengerGray)) {
                // Keep attachment preview/status inside the input field itself.
                if (file != null) {
                    MessengerPendingAttachment(
                        uri = file.uri, filename = file.name, mime = file.type,
                        phase = phase, lang = lang, onRemove = clearFile
                    )
                }
                Row(Modifier.fillMaxWidth().heightIn(min = 62.dp)
                    .padding(start = 15.dp, end = 2.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    BasicTextField(
                        value = draft, onValueChange = onDraft,
                        modifier = Modifier.weight(1f),
                        textStyle = androidx.compose.ui.text.TextStyle(
                            fontSize = 16.sp, color = messengerInk),
                        maxLines = 4,
                        decorationBox = { inner ->
                            Box {
                                if (draft.isEmpty()) Text(tr(lang, "Text...", "پیام..."),
                                    color = messengerMuted, fontSize = 16.sp)
                                inner()
                            }
                        }
                    )
                    MessengerIcon(Icons.Default.AttachFile,
                        tr(lang,"Attach file","پیوست فایل"),onAttach,
                        enabled = phase != SupportAttachmentPhase.UPLOADING)
                    MessengerIcon(Icons.Default.SentimentSatisfied,
                        tr(lang,"Emoji","شکلک"),onEmoji)
                }
            }
            if (!expanded) {
                Spacer(Modifier.width(10.dp))
                FilledIconButton(onClick = onSend, enabled = enabled,
                    modifier = Modifier.size(width = 64.dp, height = 61.dp),
                    shape = RoundedCornerShape(17.dp),
                    colors = IconButtonDefaults.filledIconButtonColors(
                        containerColor = messengerButton, contentColor = Color.White
                    )) {
                    Icon(Icons.Default.Send,tr(lang,"Send message","ارسال پیام"),
                        modifier=Modifier.size(26.dp))
                }
            }
        }
    }
}
