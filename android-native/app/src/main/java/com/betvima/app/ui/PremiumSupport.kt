package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import kotlinx.coroutines.launch

private val supportNavy = Color(0xFF0A182B)
private val supportBlue = Color(0xFF087FF5)
private val supportMint = Color(0xFF00D47A)
private val supportInk = Color(0xFFF5F6F8)
private val supportMuted = Color(0xFFA7ABB6)
private val supportBorder = Color(0xFF39393D)
private val supportBg = Color(0xFF111113)
private val supportPanel = Color(0xFF222224)

internal val supportCategories = listOf(
    "general", "deposit", "withdrawal", "bet", "login", "bonus", "technical", "other"
)

internal fun supportCategoryName(category: String, lang: Lang): String = when(category) {
    "deposit" -> tr(lang, "Deposit", "واریز")
    "withdrawal" -> tr(lang, "Withdrawal", "برداشت")
    "bet" -> tr(lang, "Sports bets", "شرط‌های ورزشی")
    "login" -> tr(lang, "Account access", "ورود به حساب")
    "bonus" -> tr(lang, "Rewards", "بونوس و پاداش")
    "technical" -> tr(lang, "Technical issue", "مشکل فنی")
    "other" -> tr(lang, "Other", "سایر")
    else -> tr(lang, "General inquiry", "پرسش عمومی")
}

internal fun supportStatusName(status: String, lang: Lang): String = when(status) {
    "open" -> tr(lang, "Open", "باز")
    "waiting_user" -> tr(lang, "Your reply needed", "منتظر پاسخ شما")
    "waiting_support" -> tr(lang, "Awaiting support", "در انتظار پشتیبانی")
    "resolved" -> tr(lang, "Resolved", "حل‌شده")
    "closed" -> tr(lang, "Closed", "بسته‌شده")
    else -> tr(lang, "In progress", "در حال بررسی")
}
internal fun supportActive(status: String) = status !in setOf("resolved", "closed")
internal fun supportValidDraft(category: String, title: String, text: String): Boolean =
    category in supportCategories && title.trim().length in 3..160 &&
        text.trim().length in 1..5000

private fun supportStatusTint(status: String): Color = when(status) {
    "waiting_user" -> Color(0xFFD97706)
    "resolved", "closed" -> Color(0xFF6B7B8E)
    "open" -> supportBlue
    else -> Color(0xFF008F61)
}

@Composable
internal fun SupportStatusChip(status: String, lang: Lang) {
    val color = supportStatusTint(status)
    Surface(
        shape = RoundedCornerShape(50),
        color = color.copy(alpha = .095f),
        border = BorderStroke(1.dp, color.copy(alpha = .15f))
    ) {
        Row(
            modifier = Modifier.widthIn(max = 190.dp)
                .padding(horizontal = 9.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(Modifier.size(6.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(6.dp))
            Text(
                supportStatusName(status, lang), color = color,
                fontSize = 10.sp, fontWeight = FontWeight.Bold,
                maxLines = 1, overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun SupportHero(lang: Lang, total: Int, needsReply: Int) {
    Surface(color = supportNavy, shape = RoundedCornerShape(25.dp),
        modifier = Modifier.fillMaxWidth(), shadowElevation = 4.dp) {
        Box(Modifier.fillMaxWidth().background(Brush.linearGradient(
            listOf(Color(0xFF0C1A2E), Color(0xFF132B45), Color(0xFF104C53))))) {
            Box(Modifier.align(Alignment.TopEnd).offset(x = 73.dp, y = (-89).dp)
                .size(228.dp).clip(CircleShape).background(supportMint.copy(alpha = .065f)))
            Box(Modifier.align(Alignment.BottomStart).offset(x = (-60).dp, y = 85.dp)
                .size(140.dp).clip(CircleShape).background(supportBlue.copy(alpha = .10f)))
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = supportMint.copy(alpha = .13f),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, supportMint.copy(alpha = .25f))) {
                        Icon(Icons.Default.SupportAgent, null, tint = supportMint,
                            modifier = Modifier.padding(11.dp).size(24.dp))
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tr(LocalNativeLanguage176.current, "BETVIMA / SUPPORT", "BETVIMA / SUPPORT"), color = Color.White,
                            fontWeight = FontWeight.Black, fontSize = 13.sp,
                            letterSpacing = .75.sp)
                        Text(tr(lang, "Dedicated help center", "مرکز ارتباط با پشتیبانی"),
                            color = Color(0xFFB7CED4), fontSize = 11.sp)
                    }
                    Surface(color = Color.White.copy(alpha = .09f),
                        shape = RoundedCornerShape(50)) {
                        Row(Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(6.dp).clip(CircleShape).background(supportMint))
                            Spacer(Modifier.width(5.dp))
                            Text("24/7", color = Color.White,
                                fontSize = 10.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }
                Text(tr(lang, "Your support, simplified.",
                    "پشتیبانی، دقیق و بی‌دردسر."),
                    color = Color.White, fontSize = 23.sp,
                    fontWeight = FontWeight.Black, lineHeight = 32.sp)
                Text(tr(lang,
                    "Send a request, follow every update and talk directly with the support team.",
                    "درخواستتان را ثبت کنید، وضعیت آن را ببینید و گفت‌وگو را در همان تیکت ادامه دهید."),
                    color = Color(0xFFB5C8D4), fontSize = 11.sp,
                    lineHeight = 18.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    listOf(
                        Triple(Icons.Default.ConfirmationNumber,
                            tr(lang, "My requests", "درخواست‌های من"), total.toString()),
                        Triple(Icons.Default.MarkChatUnread,
                            tr(lang, "Needs reply", "نیازمند پاسخ"), needsReply.toString())
                    ).forEach { (icon, label, value) ->
                        Surface(color = Color.White.copy(alpha = .085f),
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = .10f)),
                            modifier = Modifier.weight(1f)) {
                            Row(Modifier.padding(11.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(icon, null, tint = supportMint, modifier = Modifier.size(19.dp))
                                Spacer(Modifier.width(8.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(value, color = Color.White, fontSize = 16.sp,
                                        fontWeight = FontWeight.Black)
                                    Text(label, color = Color(0xFFB9CDDA),
                                        fontSize = 9.sp, maxLines = 1)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SupportTicketCard(ticket: SupportTicket, lang: Lang, onClick: () -> Unit) {
    val status = supportStatusTint(ticket.status)
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        color = supportPanel, shape = RoundedCornerShape(19.dp),
        border = BorderStroke(1.dp, supportBorder), shadowElevation = 1.dp
    ) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.Top) {
            Surface(color = status.copy(alpha = .10f), shape = RoundedCornerShape(14.dp)) {
                Icon(when(ticket.category) {
                    "deposit", "withdrawal" -> Icons.Default.AccountBalanceWallet
                    "bet" -> Icons.Default.SportsSoccer
                    "technical" -> Icons.Default.Build
                    "login" -> Icons.Default.Lock
                    else -> Icons.Default.Forum
                }, null, tint = status, modifier = Modifier.padding(11.dp).size(21.dp))
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(ticket.subject, color = supportInk,
                    fontWeight = FontWeight.Black, fontSize = 13.sp,
                    maxLines = 2, overflow = TextOverflow.Ellipsis, lineHeight = 19.sp)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(supportCategoryName(ticket.category, lang), color = supportMuted,
                        fontSize = 10.sp, maxLines = 1)
                    if (ticket.updatedAt.isNotBlank()) {
                        Text("  ·  " + ticket.updatedAt.take(10),
                            color = supportMuted, fontSize = 10.sp)
                    }
                }
                SupportStatusChip(ticket.status, lang)
            }
            Spacer(Modifier.width(5.dp))
            Icon(Icons.Default.ChevronRight, null, tint = supportMuted,
                modifier = Modifier.padding(top = 14.dp).size(20.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PremiumSupportPage(state: AppState, model: AppViewModel) {
    val lang = state.lang
    val context = LocalContext.current
    val api = remember { ApiClient() }
    val vault = remember { SessionVault(context) }
    val scope = rememberCoroutineScope()
    var tickets by remember { mutableStateOf<List<SupportTicket>>(emptyList()) }
    var total by remember { mutableIntStateOf(0) }
    var page by remember { mutableIntStateOf(1) }
    var hasMore by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var loadingMore by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var selected by remember { mutableStateOf<SupportTicket?>(null) }
    var composing by rememberSaveable { mutableStateOf(false) }
    var search by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf("all") }

    suspend fun refresh(nextPage: Int = 1) {
        if (nextPage > 1) loadingMore = true else loading = true
        try {
            val jwt = vault.accessToken(api) ?: throw IllegalStateException(
                tr(lang,"Please sign in again.","لطفاً دوباره وارد شوید."))
            val result = api.supportTickets(jwt, nextPage)
            tickets = if (nextPage == 1) result.items
                else (tickets + result.items).distinctBy { it.id }
            page = result.page; total = result.total; hasMore = result.hasMore
            error = null
        } catch (ex: Exception) {
            error = ex.message ?: tr(lang,"Unable to load requests","دریافت درخواست‌ها ممکن نشد")
        } finally { loading = false; loadingMore = false }
    }
    LaunchedEffect(state.signedIn) {
        if (state.signedIn) refresh()
        else { tickets = emptyList(); total = 0; hasMore = false; loading = false; selected = null }
    }

    val activeCount = tickets.count { supportActive(it.status) }
    val needsReply = tickets.count { it.status == "waiting_user" }
    val shown = tickets.filter {
        (filter == "all" ||
            (filter == "active" && supportActive(it.status)) ||
            (filter == "done" && !supportActive(it.status))) &&
            (search.isBlank() || (it.subject + " " + supportCategoryName(it.category, lang))
                .contains(search.trim(), ignoreCase = true))
    }
    LazyColumn(Modifier.fillMaxSize().background(supportBg),
        contentPadding = PaddingValues(start = 15.dp, end = 15.dp, top = 15.dp, bottom = 26.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp), flingBehavior = rememberPremiumFlingBehavior()) {
        item { SupportHero(lang, total, needsReply) }
        item {
            Surface(color = supportPanel, shape = RoundedCornerShape(18.dp),
                border = BorderStroke(1.dp, supportBorder)) {
                Row(Modifier.fillMaxWidth().padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = Color(0xFF1B382D), shape = RoundedCornerShape(12.dp)) {
                        Icon(Icons.Default.AddComment, null, tint = Color(0xFF67D8AA),
                            modifier = Modifier.padding(10.dp).size(22.dp))
                    }
                    Spacer(Modifier.width(11.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tr(lang, "Need assistance?", "به کمک نیاز دارید؟"),
                            fontSize = 14.sp, color = supportInk, fontWeight = FontWeight.Black)
                        Text(tr(lang,"Start a private support request",
                            "یک درخواست خصوصی برای پشتیبانی ثبت کنید"),
                            fontSize = 10.sp, color = supportMuted)
                    }
                    FilledTonalIconButton(onClick = { if (state.signedIn) composing = true
                        else model.showLogin(true) },
                        colors = IconButtonDefaults.filledTonalIconButtonColors(
                            containerColor = supportMint, contentColor = supportNavy)) {
                        Icon(Icons.Default.Add, tr(lang, "New request", "درخواست جدید"))
                    }
                }
            }
        }
        if (!state.signedIn) {
            item { LockedFeature(lang,
                tr(lang,"Sign in to securely access your tickets",
                    "برای ثبت و پیگیری درخواست‌ها وارد حساب شوید"),
                onRegister = { model.showLogin(true, register = true) },
                icon = Icons.Default.SupportAgent
            ) { model.showLogin(true) } }
        } else {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(tr(lang, "My conversations", "گفت‌وگوهای من"),
                            color = supportInk, fontSize = 18.sp, fontWeight = FontWeight.Black)
                        Text(tr(lang, "Manage requests and follow replies",
                            "پیگیری درخواست‌ها و پاسخ‌های پشتیبانی"),
                            color = supportMuted, fontSize = 10.sp)
                    }
                    IconButton(onClick = { scope.launch { refresh() } }, enabled = !loading) {
                        Icon(Icons.Default.Refresh, tr(lang,"Refresh","تازه‌سازی"),
                            tint = supportBlue)
                    }
                }
            }
            item {
                OutlinedTextField(
                    value = search, onValueChange = { search = it.take(100) },
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = { Icon(Icons.Default.Search, null, tint = supportBlue) },
                    label = { Text(tr(lang, "Search your requests", "جستجو در درخواست‌ها")) },
                    trailingIcon = {
                        if (search.isNotBlank()) IconButton(onClick = { search = "" }) {
                            Icon(Icons.Default.Close, tr(lang,"Clear","پاک‌کردن"))
                        }
                    },
                    singleLine = true, shape = RoundedCornerShape(15.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = supportPanel,
                        unfocusedContainerColor = supportPanel,
                        focusedTextColor = supportInk,
                        unfocusedTextColor = supportInk,
                        focusedLabelColor = Color(0xFF85C5FF),
                        unfocusedLabelColor = supportMuted,
                        focusedTrailingIconColor = supportMuted,
                        unfocusedTrailingIconColor = supportMuted,
                        focusedBorderColor = supportBlue,
                        unfocusedBorderColor = supportBorder)
                )
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    listOf("all","active","done").forEach { option ->
                        FilterChip(
                            selected = filter == option,
                            onClick = { filter = option },
                            label = { Text(when(option) {
                                "active" -> tr(lang,"Active","فعال")
                                "done" -> tr(lang,"Finished","پایان‌یافته")
                                else -> tr(lang,"All","همه")
                            }, fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                            leadingIcon = if (filter == option) ({
                                Icon(Icons.Default.Check, null, modifier = Modifier.size(16.dp))
                            }) else null,
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Color(0xFF173550),
                                selectedLabelColor = Color.White),
                            shape = RoundedCornerShape(13.dp)
                        )
                    }
                }
            }
            if (loading) {
                item { LinearProgressIndicator(Modifier.fillMaxWidth(), color = supportMint) }
            }
            if (error != null) item {
                Surface(color = Color(0xFF3B252B), shape = RoundedCornerShape(15.dp)) {
                    Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(error.orEmpty(), fontSize = 11.sp, color = Color(0xFFFFA3AD))
                        TextButton(onClick = { scope.launch { refresh() } }) {
                            Text(tr(lang, "Try again", "تلاش دوباره"))
                        }
                    }
                }
            }
            if (!loading && shown.isEmpty()) item {
                Surface(color = supportPanel, shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, supportBorder)) {
                    Column(Modifier.fillMaxWidth().padding(28.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Surface(color = Color(0xFF19344C), shape = CircleShape) {
                            Icon(Icons.Default.Forum, null, tint = supportBlue,
                                modifier = Modifier.padding(17.dp).size(29.dp))
                        }
                        Text(if (tickets.isEmpty())
                            tr(lang,"No conversations yet","هنوز گفت‌وگویی ندارید")
                            else tr(lang,"No matching requests","درخواستی با این فیلتر پیدا نشد"),
                            color = supportInk, fontWeight = FontWeight.Black)
                        Text(tr(lang,"Your requests and replies will appear here.",
                            "درخواست‌ها و پاسخ‌های دریافتی اینجا نمایش داده می‌شوند."),
                            color = supportMuted, fontSize = 11.sp,
                            textAlign = TextAlign.Center)
                        TextButton(onClick = { composing = true }) {
                            Icon(Icons.Default.Add, null)
                            Text(tr(lang,"Create a request","ثبت درخواست"))
                        }
                    }
                }
            }
            items(shown, key = { it.id }) { ticket ->
                SupportTicketCard(ticket, lang) { selected = ticket }
            }
            if (hasMore && !loading) item {
                OutlinedButton(
                    onClick = { scope.launch { refresh(page+1) } },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !loadingMore, shape = RoundedCornerShape(14.dp)
                ) {
                    if (loadingMore) CircularProgressIndicator(Modifier.size(17.dp),
                        strokeWidth = 2.dp)
                    else Text(tr(lang,"Load older conversations","گفت‌وگوهای قدیمی‌تر"))
                }
            }
        }
    }

    if (state.signedIn && composing) {
        SupportNewTicketSheet(
            lang = lang, api = api, vault = vault,
            onDismiss = { composing = false },
            onCreated = { ticket ->
                composing = false
                selected = ticket
                scope.launch { refresh() }
            }
        )
    }
    selected?.let { ticket ->
        TicketThreadSheet(ticket, lang,
            onDismiss = { selected = null },
            onUpdated = { scope.launch { refresh() } })
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SupportNewTicketSheet(
    lang: Lang, api: ApiClient, vault: SessionVault,
    onDismiss: () -> Unit, onCreated: (SupportTicket) -> Unit
) {
    val scope = rememberCoroutineScope()
    var subject by rememberSaveable { mutableStateOf("") }
    var text by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf("general") }
    var categoryMenu by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var uncertain by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val closeSheet: () -> Unit = {
        if (!busy) scope.launch {
            sheet.hide()
            onDismiss()
        }
    }
    ModalBottomSheet(onDismissRequest = closeSheet,
        containerColor = supportBg,
        contentColor = supportInk,
        scrimColor = Color.Black.copy(alpha = .72f),
        sheetState = sheet) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState(), flingBehavior = rememberPremiumFlingBehavior())
            .padding(horizontal = 17.dp).padding(bottom = 26.dp),
            verticalArrangement = Arrangement.spacedBy(13.dp)) {
            Surface(shape = RoundedCornerShape(20.dp), color = supportNavy) {
                Row(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(
                    Color(0xFF10243D), Color(0xFF14505A)))).padding(15.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = supportMint.copy(alpha = .14f),
                        shape = RoundedCornerShape(14.dp)) {
                        Icon(Icons.Default.Edit, null, tint = supportMint,
                            modifier = Modifier.padding(11.dp).size(23.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tr(lang,"New support request","درخواست جدید پشتیبانی"),
                            color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black)
                        Text(tr(lang,"Private conversation with BetVima",
                            "گفت‌وگوی خصوصی با پشتیبانی بت‌ویما"),
                            color = Color(0xFFBED3DB), fontSize = 10.sp)
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, null, tint = Color.White)
                    }
                }
            }
            Text(tr(lang, "What can we help with?", "موضوع درخواست شما چیست؟"),
                fontWeight = FontWeight.Black, fontSize = 13.sp, color = supportInk)
            Box {
                Surface(
                    modifier = Modifier.fillMaxWidth().clickable { categoryMenu = true },
                    color = supportBg,
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, supportBorder)
                ) {
                    Row(Modifier.fillMaxWidth().padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Category, null, tint = supportBlue)
                        Spacer(Modifier.width(11.dp))
                        Column(Modifier.weight(1f)) {
                            Text(tr(lang, "Category", "دسته‌بندی"),
                                color = supportMuted, fontSize = 10.sp)
                            Text(supportCategoryName(category, lang), color = supportInk,
                                fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                        Icon(Icons.Default.KeyboardArrowDown, null, tint = supportMuted)
                    }
                }
                DropdownMenu(expanded = categoryMenu,
                    onDismissRequest = { categoryMenu = false },
                    containerColor = supportPanel) {
                    supportCategories.forEach { key ->
                        DropdownMenuItem(
                            text = { Text(supportCategoryName(key, lang),
                                color = supportInk, fontSize = 12.sp,
                                fontWeight = FontWeight.Bold) },
                            onClick = { category = key; categoryMenu = false },
                            trailingIcon = {
                                if (category == key)
                                    Icon(Icons.Default.CheckCircle, null, tint = supportBlue)
                            }
                        )
                    }
                }
            }
            OutlinedTextField(subject,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = supportInk, unfocusedTextColor = supportInk,
                    focusedContainerColor = supportPanel,
                    unfocusedContainerColor = supportPanel,
                    focusedBorderColor = supportBlue, unfocusedBorderColor = supportBorder,
                    focusedLabelColor = Color(0xFF85C5FF), unfocusedLabelColor = supportMuted,
                    focusedPlaceholderColor = supportMuted, unfocusedPlaceholderColor = supportMuted,
                    cursorColor = supportBlue),
                onValueChange = { subject = it.take(160); error = null },
                label = { Text(tr(lang,"Subject","عنوان درخواست")) },
                placeholder = { Text(tr(lang,"A short description","موضوع را کوتاه توضیح دهید")) },
                shape = RoundedCornerShape(14.dp), singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Sentences))
            OutlinedTextField(text,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = supportInk, unfocusedTextColor = supportInk,
                    focusedContainerColor = supportPanel,
                    unfocusedContainerColor = supportPanel,
                    focusedBorderColor = supportBlue, unfocusedBorderColor = supportBorder,
                    focusedLabelColor = Color(0xFF85C5FF), unfocusedLabelColor = supportMuted,
                    focusedPlaceholderColor = supportMuted, unfocusedPlaceholderColor = supportMuted,
                    cursorColor = supportBlue),
                onValueChange = { text = it.take(5000); error = null },
                label = { Text(tr(lang,"Describe your issue","شرح مشکل")) },
                placeholder = {
                    Text(tr(lang,"Include any relevant details so we can help.",
                        "جزئیات لازم را بنویسید تا بررسی دقیق‌تر انجام شود."),
                        fontSize = 12.sp)
                },
                minLines = 4, maxLines = 6,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth())
            Row {
                Text(tr(lang,"Please avoid passwords and recovery codes.",
                    "رمز عبور یا کد بازیابی را در پیام ارسال نکنید."),
                    color = supportMuted, fontSize = 10.sp,
                    modifier = Modifier.weight(1f))
                Text("${text.length}/5000", color = supportMuted, fontSize = 10.sp)
            }
            if (error != null || uncertain) {
                Surface(color = Color(0xFF383020), shape = RoundedCornerShape(12.dp)) {
                    Text(error ?: tr(lang,"Confirm ticket status before submitting again.",
                        "پیش از ثبت دوباره، فهرست تیکت‌ها را بررسی کنید."),
                        color = Color(0xFFFFD489),
                        modifier = Modifier.padding(11.dp), fontSize = 11.sp)
                }
            }
            Button(
                onClick = {
                    if (busy || uncertain || !supportValidDraft(category, subject, text)) return@Button
                    scope.launch {
                        busy = true; error = null
                        try {
                            val token = vault.accessToken(api)
                                ?: throw IllegalStateException(tr(lang,"Sign in required","ورود ضروری است"))
                            val created = api.createTicket(token, category, subject, text)
                            onCreated(created)
                        } catch(ex: Exception) {
                            // When a timeout follows server acceptance, never silently
                            // re-post the same ticket. The user must inspect the list.
                            uncertain = true
                            error = tr(lang,
                                "Request status unknown. Close and refresh the ticket list before retrying.",
                                "نتیجه ثبت درخواست مشخص نیست. پیش از تلاش دوباره، فهرست را تازه‌سازی کنید.")
                        } finally { busy = false }
                    }
                },
                enabled = !busy && !uncertain && supportValidDraft(category, subject, text),
                colors = ButtonDefaults.buttonColors(
                    containerColor = supportMint, contentColor = supportNavy),
                shape = RoundedCornerShape(15.dp),
                modifier = Modifier.fillMaxWidth().height(53.dp)
            ) {
                if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Icon(Icons.Default.Send, null, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(8.dp))
                Text(tr(lang,"Submit support request","ارسال درخواست پشتیبانی"),
                    fontWeight = FontWeight.Black)
            }
        }
    }
}
