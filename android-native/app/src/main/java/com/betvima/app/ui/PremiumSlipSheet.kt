package com.betvima.app.ui

import androidx.compose.animation.animateContentSize
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.decode.SvgDecoder
import androidx.compose.ui.layout.ContentScale
import com.betvima.app.data.*

private val slipNavy = Color(0xFF0C1A2E)
private val slipBlue = Color(0xFF087FF5)
private val slipGreen = Color(0xFF00D47A)
private val slipPaper = Color(0xFFF6F8FB)
private val slipBorder = Color(0xFFE2E7EF)
private val slipText = Color(0xFF202C3C)
private val slipMuted = Color(0xFF7F8B9C)

@Composable
private fun SlipWordmark(
    modifier: Modifier = Modifier,
    opacity: Float = .16f
) {
    val context = LocalContext.current
    val imageLoader = remember(context) {
        ImageLoader.Builder(context).components { add(SvgDecoder.Factory()) }.build()
    }
    AsyncImage(
        model = "file:///android_asset/betvima_wordmark.svg",
        imageLoader = imageLoader,
        contentDescription = null,
        contentScale = ContentScale.Fit,
        modifier = modifier.alpha(opacity)
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
                color = Color(0xFFEAF4FF),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(number.toString().padStart(2,'0'),
                    fontWeight = FontWeight.Black,fontSize = 11.sp,
                    color = slipBlue,
                    modifier = Modifier.padding(horizontal = 9.dp,vertical = 8.dp))
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PremiumSlipSheet(state: AppState,model: AppViewModel) {
    val lang=state.lang
    val config=LocalConfiguration.current
    val viewport=config.screenHeightDp.dp
    val maxSheet=viewport*.89f
    val maxPicks=viewport*.235f
    var funding by rememberSaveable { mutableStateOf("main") }
    var mode by rememberSaveable { mutableStateOf("single") }
    val listHeight = if (state.picks.isEmpty()) 68.dp else
        ((state.picks.size * 86 + 17).dp).coerceAtMost(maxPicks)
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
                .animateContentSize()
        ) {
            Box(
                modifier=Modifier.fillMaxWidth().background(
                    Brush.linearGradient(listOf(slipNavy,Color(0xFF143755))))
            ) {
                SlipWordmark(
                    modifier=Modifier.align(Alignment.CenterEnd)
                        .padding(end=7.dp).width(190.dp).height(54.dp),
                    opacity=.18f
                )
                Row(
                    Modifier.fillMaxWidth()
                        .padding(horizontal=14.dp,vertical=10.dp),
                    verticalAlignment=Alignment.CenterVertically
                ) {
                    IconButton(onClick={model.showSlip(false)},
                        modifier=Modifier.size(33.dp)) {
                        Icon(Icons.Default.KeyboardArrowDown,
                            tr(lang,"Close","بستن"),tint=Color.White)
                    }
                    Spacer(Modifier.width(7.dp))
                    Column(Modifier.weight(1f)) {
                        Text("BETVIMA / BETSLIP",
                            fontWeight=FontWeight.Black,color=Color.White,
                            fontSize=15.sp,letterSpacing=.5.sp)
                        Text(tr(lang,"Your prediction slip","برگه پیش‌بینی شما"),
                            fontSize=10.sp,color=Color(0xFFC7D5E4))
                    }
                    Surface(color=slipGreen.copy(alpha=.17f),
                        shape=RoundedCornerShape(50),
                        border=BorderStroke(1.dp,slipGreen.copy(alpha=.35f))) {
                        Text(
                            tr(lang,"PICKS ","انتخاب‌ها ")+state.picks.size,
                            color=Color(0xFFADFFDD),fontWeight=FontWeight.Black,
                            fontSize=10.sp,modifier=Modifier.padding(
                                horizontal=11.dp,vertical=7.dp)
                        )
                    }
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
            Box(Modifier.fillMaxWidth()) {
                SlipWordmark(
                    modifier=Modifier.align(Alignment.Center)
                        .fillMaxWidth(.82f).height(85.dp),
                    opacity=.07f
                )
                if(state.picks.isEmpty()) {
                    Row(
                        Modifier.fillMaxWidth().height(listHeight)
                            .padding(horizontal=17.dp),
                        verticalAlignment=Alignment.CenterVertically,
                        horizontalArrangement=Arrangement.Center
                    ) {
                        Icon(Icons.Default.SportsSoccer,null,tint=slipBlue,
                            modifier=Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(tr(lang,
                            "Pick a match to start a prediction.",
                            "برای شروع، یک مسابقه را انتخاب کنید."),
                            color=slipMuted,fontSize=11.sp)
                    }
                } else {
                    LazyColumn(
                        modifier=Modifier.fillMaxWidth().height(listHeight),
                        contentPadding=PaddingValues(
                            horizontal=13.dp,vertical=5.dp),
                        verticalArrangement=Arrangement.spacedBy(6.dp)
                    ) {
                        items(state.picks,key={it.selectionId}) { pick ->
                            SlipPickCard(
                                pick,lang,state.picks.indexOf(pick)+1,
                                onRemove={model.removePick(pick.selectionId)})
                        }
                    }
                }
            }
            HorizontalDivider(color=slipBorder)
            // Short slips are content-sized; only a long action dock can scroll.
            // The final action never expands the sheet to 96% for one pick.
            Column(
                Modifier.fillMaxWidth().heightIn(max=viewport*.37f)
                    .verticalScroll(rememberScrollState())
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
