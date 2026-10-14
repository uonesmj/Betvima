package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*

private val slipNavy = Color(0xFF0C1A2E)
private val slipBlue = Color(0xFF087FF5)
private val slipGreen = Color(0xFF00D47A)
private val slipPaper = Color(0xFFF6F8FB)
private val slipBorder = Color(0xFFE2E7EF)
private val slipText = Color(0xFF202C3C)
private val slipMuted = Color(0xFF7F8B9C)

/**
 * Compact text wordmark specifically for the bet slip. The former SVG put
 * "Bet" and "Vima" at fixed, widely separated x positions on narrow devices.
 * Compose paints a single word; the caller controls centering and contrast.
 */
@Composable
private fun SlipBrandWordmark(
    modifier: Modifier = Modifier,
    color: Color,
    fontSize: TextUnit,
    opacity: Float = 1f
) {
    Text(
        text = "Betvima",
        modifier = modifier,
        color = color.copy(alpha = opacity),
        fontWeight = FontWeight.Black,
        fontFamily = FontFamily.SansSerif,
        fontSize = fontSize,
        letterSpacing = 0.sp,
        lineHeight = (fontSize.value * 1.1f).sp,
        maxLines = 1,
        softWrap = false,
        overflow = TextOverflow.Clip,
        textAlign = TextAlign.Center
    )
}

@Composable
private fun SlipPickCard(
    pick: Pick, lang: Lang, number: Int, onRemove: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = Color.White,
        border = BorderStroke(1.dp, slipBorder),
        shadowElevation = 1.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            Modifier.fillMaxWidth().padding(start = 10.dp,end = 7.dp,top = 9.dp,bottom = 9.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                modifier = Modifier.size(width = 32.dp, height = 34.dp),
                color = slipBlue,
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, Color(0xFF4DA9FF)),
                shadowElevation = 2.dp
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        number.toString().padStart(2, '0'),
                        fontWeight = FontWeight.Black,
                        fontSize = 12.sp,
                        color = Color.White
                    )
                }
            }
            Spacer(Modifier.width(9.dp))
            Column(
                Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(pick.match,
                    color = slipMuted,fontSize = 10.sp,
                    maxLines = 1,overflow = TextOverflow.Ellipsis)
                Text(pick.selection,
                    color = slipText,fontSize = 13.sp,
                    fontWeight = FontWeight.Black,maxLines = 1,
                    overflow = TextOverflow.Ellipsis)
                Text(pick.market,color = slipMuted,fontSize = 10.sp,
                    maxLines = 1,overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.width(5.dp))
            Surface(color = Color(0xFFE8F8F0),shape = RoundedCornerShape(10.dp)) {
                Text(odds(pick.oddsScaled),color = Color(0xFF078955),
                    fontWeight = FontWeight.Black,fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 10.dp,vertical = 8.dp))
            }
            IconButton(onClick = onRemove,modifier = Modifier.size(29.dp)) {
                Icon(Icons.Default.Close,
                    tr(lang,"Remove","حذف"),tint = slipMuted,
                    modifier = Modifier.size(17.dp))
            }
        }
    }
}

@Composable
private fun SlipFundingRow(
    funding: String, lang: Lang, onSelect: (String) -> Unit
) {
    Row(horizontalArrangement = Arrangement.spacedBy(7.dp),
        modifier = Modifier.fillMaxWidth()) {
        listOf(
            Triple("main",tr(lang,"Main Account","حساب اصلی"),
                Icons.Default.AccountBalanceWallet),
            Triple("bonus",tr(lang,"Bonus Account","حساب بونوس"),
                Icons.Default.CardGiftcard)
        ).forEach { (id,label,icon) ->
            val current = funding == id
            val tone = if (id == "bonus") Color(0xFF8741BC) else slipBlue
            Surface(
                modifier = Modifier.weight(1f).height(43.dp).clickable { onSelect(id) },
                color = if (current) tone.copy(alpha = .095f) else Color(0xFFF3F6FA),
                border = BorderStroke(if (current) 1.4.dp else 1.dp,
                    if (current) tone else slipBorder),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    Modifier.fillMaxSize().padding(horizontal = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(icon,null,tint = if(current) tone else slipMuted,
                        modifier = Modifier.size(16.dp))
                    Text(label,fontSize = 11.sp,fontWeight = FontWeight.Black,
                        color = if(current) slipText else slipMuted,
                        maxLines = 1,overflow=TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f))
                    if(current) Icon(Icons.Default.CheckCircle,null,
                        tint=tone,modifier=Modifier.size(13.dp))
                }
            }
        }
    }
}

@Composable
private fun MainAccountSlipControls(
    state: AppState, model: AppViewModel, mode: String
) {
    val lang=state.lang
    var stake by rememberSaveable { mutableStateOf("5.00") }
    val canQuote=state.picks.isNotEmpty() &&
        ((mode=="single" && state.picks.size==1) ||
            (mode=="multiple" && state.picks.size>=2))
    val curr=state.wallet?.currency ?: "USD"
    Column(Modifier.fillMaxWidth(),
        verticalArrangement=Arrangement.spacedBy(8.dp)) {
        if(state.picks.isNotEmpty()) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                OutlinedTextField(
                    value=stake,
                    onValueChange={
                        if(it.matches(Regex("[0-9]{0,10}(\\.[0-9]{0,2})?"))) {
                            stake=it
                            model.clearQuote()
                        }
                    },
                    singleLine=true,
                    label={Text(tr(lang,"Stake (USD)","مبلغ شرط (دلار)"),fontSize=11.sp)},
                    modifier=Modifier.weight(1f),
                    shape=RoundedCornerShape(12.dp),
                    keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal)
                )
                Spacer(Modifier.width(12.dp))
                Column(horizontalAlignment=Alignment.End,
                    verticalArrangement=Arrangement.spacedBy(4.dp)) {
                    Text(tr(lang,"Official quote","استعلام رسمی"),
                        color=slipMuted,fontSize=10.sp)
                    Text(if(canQuote)state.quote ?: "—" else "—",
                        color=Color(0xFF087F53),fontWeight=FontWeight.Black,
                        fontSize=16.sp,maxLines=1)
                }
            }
            Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                listOf("1.00","5.00","10.00","20.00").forEach { preset ->
                    Surface(
                        color=if(stake==preset)slipBlue else Color(0xFFF0F3F7),
                        shape=RoundedCornerShape(9.dp),
                        modifier=Modifier.weight(1f).height(31.dp).clickable {
                            stake=preset;model.clearQuote()
                        }
                    ) {
                        Box(contentAlignment=Alignment.Center) {
                            Text("$"+preset.removeSuffix(".00"),
                                fontSize=11.sp,fontWeight=FontWeight.Black,
                                color=if(stake==preset)Color.White else slipText)
                        }
                    }
                }
            }
        }
        Button(
            onClick={
                if(!state.signedIn) {
                    model.showSlip(false)
                    model.showLogin(true)
                } else model.quote(stake)
            },
            enabled=canQuote && !state.busy,
            modifier=Modifier.fillMaxWidth().height(47.dp),
            shape=RoundedCornerShape(13.dp),
            colors=ButtonDefaults.buttonColors(
                containerColor=slipGreen,contentColor=slipNavy)
        ) {
            Icon(Icons.Default.CheckCircle,null,modifier=Modifier.size(17.dp))
            Spacer(Modifier.width(8.dp))
            Text(if(!state.signedIn)
                tr(lang,"Log in for quote","ورود برای استعلام")
            else tr(lang,"Request official quote","استعلام رسمی ضریب"),
                fontWeight=FontWeight.Black,fontSize=12.sp)
        }
        Text(tr(lang,
            "Main Account: preview only. Real bonus wagering is available under Bonus Account.",
            "حساب اصلی: فقط پیش‌نمایش. ثبت شرط بونوسی در بخش حساب بونوس فعال است."),
            color=slipMuted,fontSize=9.sp,lineHeight=13.sp,maxLines=2)
    }
}

@Composable
private fun SlipPickPager(
    state: AppState,
    model: AppViewModel,
    capacity: Int,
    listHeight: androidx.compose.ui.unit.Dp
) {
    var page by rememberSaveable { mutableIntStateOf(0) }
    var previousCount by remember { mutableIntStateOf(state.picks.size) }
    val count = state.picks.size
    LaunchedEffect(count, capacity) {
        page = if (count > previousCount) slipMaxPage(count, capacity)
               else page.coerceAtMost(slipMaxPage(count, capacity))
        previousCount = count
    }
    val range = slipPageWindow(count, capacity, page)
    Column(
        modifier = Modifier.fillMaxWidth().height(listHeight)
            .padding(horizontal = 13.dp, vertical = 5.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        range.forEach { index ->
            val pick = state.picks[index]
            key(pick.selectionId) {
                SlipPickCard(pick, state.lang, index + 1) {
                    model.removePick(pick.selectionId)
                }
            }
        }
        if (count > capacity) {
            Row(
                modifier = Modifier.fillMaxWidth().height(30.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = { page = (page - 1).coerceAtLeast(0) },
                    enabled = page > 0,
                    modifier = Modifier.size(30.dp)
                ) {
                    Icon(Icons.Default.ChevronLeft,
                        tr(state.lang, "Previous picks", "انتخاب‌های قبلی"),
                        tint = if (page > 0) slipBlue else slipMuted)
                }
                Text(
                    text = "${range.first + 1}–${range.last + 1} / $count",
                    color = slipMuted, fontWeight = FontWeight.Bold, fontSize = 11.sp
                )
                IconButton(
                    onClick = { page = (page + 1).coerceAtMost(slipMaxPage(count, capacity)) },
                    enabled = page < slipMaxPage(count, capacity),
                    modifier = Modifier.size(30.dp)
                ) {
                    Icon(Icons.Default.ChevronRight,
                        tr(state.lang, "Next picks", "انتخاب‌های بعدی"),
                        tint = if (page < slipMaxPage(count, capacity)) slipBlue else slipMuted)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PremiumSlipSheet(state: AppState,model: AppViewModel) {
    val lang=state.lang
    val config=LocalConfiguration.current
    val viewport=config.screenHeightDp.dp
    val maxSheet=viewport*.89f
    val pickCapacity = slipPageCapacity(config.screenHeightDp)
    var funding by rememberSaveable { mutableStateOf("main") }
    var mode by rememberSaveable { mutableStateOf("single") }
    LaunchedEffect(state.signedIn) {
        if (state.signedIn) model.refreshAccount()
    }
    // Extra picks occupy new pages instead of growing a scrollable list.
    val listHeight = if (state.picks.isEmpty()) 68.dp else
        (state.picks.size.coerceAtMost(pickCapacity) * 75 +
            if (state.picks.size > pickCapacity) 43 else 10).dp
    LaunchedEffect(state.picks.size,funding) {
        val expected = if(funding=="bonus" || state.picks.size>1)
            "multiple" else "single"
        if(mode!=expected) {
            mode=expected
            model.clearQuote()
        }
    }
    val sheet=rememberModalBottomSheetState(skipPartiallyExpanded=true)
    ModalBottomSheet(
        onDismissRequest={model.showSlip(false)},
        sheetState=sheet,
        dragHandle={
            Surface(color=slipNavy,modifier=Modifier.fillMaxWidth()) {
                Box(Modifier.fillMaxWidth().height(18.dp),
                    contentAlignment=Alignment.Center) {
                    Box(Modifier.size(width=34.dp,height=4.dp)
                        .clip(CircleShape).background(Color.White.copy(alpha=.36f)))
                }
            }
        },
        contentWindowInsets={WindowInsets(0,0,0,0)},
        containerColor=Color.White,
        shape=RoundedCornerShape(topStart=23.dp,topEnd=23.dp)
    ) {
        Column(
            modifier=Modifier.fillMaxWidth().heightIn(max=maxSheet).imePadding()
        ) {
            Column(
                modifier = Modifier.fillMaxWidth()
                    .background(Brush.linearGradient(listOf(slipNavy, Color(0xFF143755))))
                    .padding(bottom = 3.dp)
            ) {
                Row(
                    Modifier.fillMaxWidth()
                        .padding(horizontal = 13.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = { model.showSlip(false) },
                        modifier = Modifier.size(33.dp)
                    ) {
                        Icon(
                            Icons.Default.KeyboardArrowDown,
                            tr(lang, "Close", "بستن"),
                            tint = Color.White
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            tr(lang, "BETSLIP", "برگه پیش‌بینی"),
                            fontWeight = FontWeight.Black,
                            color = Color.White,
                            fontSize = 13.sp,
                            letterSpacing = .25.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            tr(lang, "Your prediction slip", "برگه پیش‌بینی شما"),
                            fontSize = 10.sp,
                            color = Color(0xFFC7D5E4),
                            maxLines = 1
                        )
                    }
                    Spacer(Modifier.width(5.dp))
                    Surface(
                        color = slipGreen.copy(alpha = .15f),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, slipGreen.copy(alpha = .37f))
                    ) {
                        Row(
                            Modifier.widthIn(max = 153.dp)
                                .padding(horizontal = 9.dp, vertical = 7.dp),
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.AccountBalanceWallet,
                                contentDescription = null,
                                tint = Color(0xFF9CF8CE),
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                when {
                                    !state.signedIn -> tr(lang, "Sign in", "ورود")
                                    state.wallet == null -> tr(lang, "Loading…", "در حال بارگذاری…")
                                    else -> money(
                                        state.wallet.availableMinor,
                                        state.wallet.currency
                                    )
                                },
                                color = Color(0xFFDEFFEF),
                                fontWeight = FontWeight.Black,
                                fontSize = 11.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
                // A dedicated centered row prevents the wordmark from sitting behind
                // the balance pill or getting cropped on narrow phone screens.
                // One compact, centered brand line, independent of the balance width.
                Box(
                    Modifier.fillMaxWidth().height(27.dp),
                    contentAlignment = Alignment.Center
                ) {
                    SlipBrandWordmark(
                        modifier = Modifier.fillMaxWidth(),
                        color = Color(0xFFD2D6DE),
                        fontSize = 22.sp
                    )
                }
            }
            Column(
                modifier=Modifier.fillMaxWidth().padding(
                    start=13.dp,end=13.dp,top=10.dp,bottom=6.dp),
                verticalArrangement=Arrangement.spacedBy(7.dp)
            ) {
                Row(horizontalArrangement=Arrangement.spacedBy(6.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    Row(Modifier.weight(1f).background(
                        Color(0xFFF0F3F7),RoundedCornerShape(12.dp))
                        .padding(3.dp),
                        horizontalArrangement=Arrangement.spacedBy(2.dp)) {
                        listOf(
                            "single" to tr(lang,"Single","تکی"),
                            "multiple" to tr(lang,"Multiple","میکس"),
                            "series" to tr(lang,"Series","سیستمی")
                        ).forEach { (id,text) ->
                            val active=mode==id
                            val allowed=id!="series" &&
                                (funding!="bonus" || id=="multiple")
                            Surface(
                                color=if(active)slipBlue else Color.Transparent,
                                shape=RoundedCornerShape(9.dp),
                                modifier=Modifier.weight(1f).height(36.dp)
                                    .clickable(enabled=allowed) {
                                        mode=id
                                        model.clearQuote()
                                    }
                            ) {
                                Box(contentAlignment=Alignment.Center) {
                                    Text(text,fontSize=11.sp,
                                        fontWeight=FontWeight.Black,
                                        color=if(active)Color.White
                                            else if(allowed)slipText else slipMuted,
                                        maxLines=1)
                                }
                            }
                        }
                    }
                    Surface(color=Color(0xFFF0F3F7),
                        shape=RoundedCornerShape(11.dp),
                        modifier=Modifier.size(42.dp).clickable{
                            model.clearPicks()
                        }) {
                        Box(contentAlignment=Alignment.Center) {
                            Icon(Icons.Default.DeleteOutline,
                                tr(lang,"Clear slip","پاک‌کردن برگه"),
                                tint=slipMuted,modifier=Modifier.size(19.dp))
                        }
                    }
                }
                SlipFundingRow(funding,lang) { next ->
                    funding=next
                    if(next=="bonus") mode="multiple"
                    model.clearQuote()
                }
                BetSlipShareActions(state,model)
            }
            if (state.picks.isEmpty()) {
                // The watermark disappears immediately when odds are selected.
                Box(Modifier.fillMaxWidth().height(listHeight)) {
                    SlipBrandWordmark(
                        modifier = Modifier.align(Alignment.Center).fillMaxWidth(),
                        color = Color(0xFF9CA3AF),
                        fontSize = 46.sp,
                        opacity = .24f
                    )
                    Row(
                        Modifier.fillMaxSize().padding(horizontal = 17.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(Icons.Default.SportsSoccer, null, tint = slipBlue,
                            modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(tr(lang,
                            "Pick a match to start a prediction.",
                            "برای شروع، یک مسابقه را انتخاب کنید."),
                            color = slipMuted, fontSize = 11.sp)
                    }
                }
            } else {
                SlipPickPager(
                    state = state,
                    model = model,
                    capacity = pickCapacity,
                    listHeight = listHeight
                )
            }
            HorizontalDivider(color=slipBorder)
            // Cash stake/quote controls stay fixed. Bonus details retain
            // a bounded scroll only when required by small displays.
            Column(
                Modifier.fillMaxWidth()
                    .then(if (funding == "bonus") {
                        Modifier.heightIn(max = viewport * .37f)
                            .verticalScroll(rememberScrollState())
                    } else Modifier)
                    .background(Color.White)
                    .navigationBarsPadding()
                    .padding(horizontal=14.dp,vertical=10.dp),
                verticalArrangement=Arrangement.spacedBy(6.dp)
            ) {
                if(funding=="bonus") {
                    BonusAccountSlip(state,model)
                } else {
                    MainAccountSlipControls(state,model,mode)
                }
            }
        }
    }
}
