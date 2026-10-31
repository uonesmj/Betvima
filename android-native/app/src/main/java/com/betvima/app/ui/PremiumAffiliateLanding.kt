package com.betvima.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.core.*
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.betvima.app.data.ApiClient
import com.betvima.app.data.SessionVault
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

// A genuinely native, illustrated and animated Partners landing.
// Does not embed 1win content, third-party media, or an external website.
private val partnerNight = Color(0xFF090B12)
private val partnerBlue = Color(0xFF315DFF)
private val partnerViolet = Color(0xFF5442B9)
private val partnerMint = Color(0xFF969CFF)
private val partnerPaper = Color(0xFFF3F5FA)
private val partnerMuted = Color(0xFF818A9D)
private val partnerWhite = Color.White

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PremiumAffiliateSheet(state: AppState, model: AppViewModel, onClose: () -> Unit) {
    val lang = state.lang
    val context = LocalContext.current
    val affiliateApi = remember { ApiClient() }
    val affiliateVault = remember(context) { SessionVault(context, "affiliate") }
    var showPortal by rememberSaveable { mutableStateOf(affiliateVault.signedIn()) }
    var authMode by rememberSaveable { mutableStateOf<String?>(null) }
    var confirmPartnerSignOut by remember { mutableStateOf(false) }
    val partnerDrawerState = rememberDrawerState(DrawerValue.Closed)
    val partnerDrawerScope = rememberCoroutineScope()
    val publicAffiliateScroll = rememberLazyListState()
    val publicAffiliateScope = rememberCoroutineScope()
    var publicMenuOpen by rememberSaveable { mutableStateOf(false) }
    var partnerNav by rememberSaveable { mutableStateOf("overview") }
    var partnerNavRevision by rememberSaveable { mutableIntStateOf(0) }
    val openRegister = {
        if (affiliateVault.signedIn()) showPortal = true
        else authMode = "register"
    }
    val openLogin = {
        if (affiliateVault.signedIn()) showPortal = true
        else authMode = "login"
    }
    // Full-height native Dialog: no bottom-sheet handle, no partial expansion.
    // Close button stays visible while the inner landing independently scrolls.
    PremiumMotionDialog(
        onDismissRequest = onClose,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false,
            decorFitsSystemWindows = false
        )
    ) { motion, closeWith ->
        ModalNavigationDrawer(
            drawerState = partnerDrawerState,
            gesturesEnabled = showPortal,
            drawerContent = {
                if (showPortal) PremiumAffiliateDrawer117(
                    lang = lang, selected = partnerNav,
                    onNavigate = { destination ->
                        partnerNav = destination
                        partnerNavRevision++
                        partnerDrawerScope.launch { partnerDrawerState.close() }
                    },
                    onClose = { partnerDrawerScope.launch { partnerDrawerState.close() } },
                    onSignOut = {
                        partnerDrawerScope.launch { partnerDrawerState.close() }
                        confirmPartnerSignOut = true
                    }
                )
            }
        ) {
        Column(
            Modifier.fillMaxSize()
                .then(motion)
                .background(partnerNight)
                .windowInsetsPadding(WindowInsets.safeDrawing)
        ) {
            // VIP-style header only. Landing, drawer and partner data stay unchanged.
            Column(
                Modifier.fillMaxWidth()
                    .background(Brush.verticalGradient(listOf(
                        Color(0xFF202127), Color(0xFF0E0F13))))
                    .padding(horizontal=19.dp,vertical=14.dp)
            ) {
                Box(Modifier.align(Alignment.CenterHorizontally)
                    .width(37.dp).height(4.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha=.25f)))
                Spacer(Modifier.height(11.dp))
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(tr(LocalNativeLanguage176.current, "BETVIMA  /  PARTNERS", "BETVIMA  /  PARTNERS"),
                            color=partnerMint,fontSize=10.sp,
                            fontWeight=FontWeight.Black,letterSpacing=1.2.sp)
                        Text(tr(lang,"Affiliate Center","مرکز همکاری"),
                            color=Color.White,fontSize=23.sp,
                            fontWeight=FontWeight.Black)
                    }
                    if(showPortal) {
                        IconButton(onClick={
                            partnerDrawerScope.launch { partnerDrawerState.open() }
                        }) {
                            Icon(Icons.Default.Menu,
                                tr(lang,"Open partner menu","باز کردن منو"),
                                tint=partnerMint)
                        }
                    } else {
                        TextButton(onClick=openLogin) {
                            Text(tr(lang,"Log in","ورود"),color=Color.White)
                        }
                        Spacer(Modifier.width(10.dp))
                        IconButton(
                            onClick={publicMenuOpen=!publicMenuOpen},
                            modifier=Modifier.size(46.dp)
                                .clip(RoundedCornerShape(15.dp))
                                .background(if(publicMenuOpen)partnerBlue else Color(0xFF292D39))
                        ) {
                            Icon(if(publicMenuOpen)Icons.Default.Close else Icons.Default.Menu,
                                tr(lang,"Navigate partner sections","منوی بخش‌های همکاری"),
                                tint=Color.White,modifier=Modifier.size(24.dp))
                        }
                    }
                    Spacer(Modifier.width(12.dp))
                    IconButton(onClick={closeWith({})},
                        modifier=Modifier.clip(CircleShape)
                            .background(Color.White.copy(alpha=.1f))) {
                        Icon(Icons.Default.Close,
                            tr(lang,"Close affiliate","بستن افیلیت"),
                            tint=Color.White)
                    }
                }
                if(!showPortal) {
                    AnimatedVisibility(
                        visible=publicMenuOpen,
                        enter=fadeIn(animationSpec=tween(210))+expandVertically(animationSpec=tween(250)),
                        exit=fadeOut(animationSpec=tween(150))+shrinkVertically(animationSpec=tween(210))
                    ) {
                        val links = listOf(
                            Triple(tr(lang,"Features","ویژگی‌ها"),3,Icons.Default.AutoAwesome),
                            Triple(tr(lang,"Products","محصولات"),8,Icons.Default.Apps),
                            Triple(tr(lang,"FAQ","سؤالات"),10,Icons.Default.QuestionAnswer),
                            Triple(tr(lang,"Gallery","گالری"),12,Icons.Default.Collections),
                            Triple(tr(lang,"Partner guides","راهنما"),14,Icons.Default.MenuBook),
                            Triple(tr(lang,"Contact","ارتباط"),16,Icons.Default.Email)
                        )
                        Column(
                            Modifier.fillMaxWidth().padding(top=13.dp)
                                .clip(RoundedCornerShape(20.dp))
                                .background(Color(0xFF191D2B))
                                .border(BorderStroke(1.dp,Color(0xFF343B55)),
                                    RoundedCornerShape(20.dp))
                                .padding(10.dp),
                            verticalArrangement=Arrangement.spacedBy(5.dp)
                        ) {
                            links.chunked(2).forEach { group ->
                                Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                                    group.forEach { (label,index,icon) ->
                                        Row(
                                            Modifier.weight(1f)
                                                .clip(RoundedCornerShape(13.dp))
                                                .clickable {
                                                    publicMenuOpen=false
                                                    publicAffiliateScope.launch {
                                                        publicAffiliateScroll.animateScrollToItem(index)
                                                    }
                                                }
                                                .background(Color(0xFF252B3C))
                                                .padding(horizontal=10.dp,vertical=13.dp),
                                            verticalAlignment=Alignment.CenterVertically,
                                            horizontalArrangement=Arrangement.spacedBy(8.dp)
                                        ) {
                                            Icon(icon,null,tint=Color(0xFF96AEFF),
                                                modifier=Modifier.size(18.dp))
                                            Text(label,color=Color.White,fontSize=12.sp,
                                                fontWeight=FontWeight.SemiBold,maxLines=1)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Box(Modifier.weight(1f)) {
                if(showPortal) {
                    AffiliateStudio118(
                        state=state,model=model,destination=partnerNav,
                        onNavigate={ destination ->
                            partnerNav=destination
                            partnerNavRevision++
                        })
                } else {
                    AffiliateMotionLanding(lang,onGetStarted=openRegister,onLogin=openLogin,list=publicAffiliateScroll)
                }
            }
        }
        }
        if (confirmPartnerSignOut) {
            AlertDialog(
                onDismissRequest={confirmPartnerSignOut=false},
                title={Text(tr(lang,"Sign out of partner account?",
                    "از حساب همکاری خارج می‌شوید؟"),color=Color(0xFFF5F6F8))},
                text={Text(tr(lang,
                    "Only the affiliate session on this device will be cleared. Your main BetVima session and wallet are not affected.",
                    "فقط نشست افیلیت این دستگاه پاک می‌شود. حساب اصلی و کیف پول بت‌ویما بدون تغییر می‌مانند."),color=Color(0xFFADB3BC))},
                confirmButton={
                    TextButton(onClick={
                        affiliateVault.clear()
                        showPortal=false
                        partnerNav="overview"
                        partnerNavRevision++
                        authMode=null
                        confirmPartnerSignOut=false
                    }) {
                        Text(tr(lang,"Sign out","خروج"),
                            color=Color(0xFFB73C40),fontWeight=FontWeight.Bold)
                    }
                },
                dismissButton={
                    TextButton(onClick={confirmPartnerSignOut=false}) {
                        Text(tr(lang,"Cancel","انصراف"))
                    }
                },
                containerColor=Color(0xFF222224),
                titleContentColor=Color(0xFFF5F6F8),
                textContentColor=Color(0xFFADB3BC)
            )
        }
        if (authMode != null) {
            // An independently scrollable credential dialog over the current Affiliate sheet.
            // Neither registration nor sign-in navigates to a new screen or website.
            Dialog(
                onDismissRequest = { authMode = null },
                properties = DialogProperties(
                    usePlatformDefaultWidth = false,
                    dismissOnBackPress = true,
                    dismissOnClickOutside = true
                )
            ) {
                BoxWithConstraints(
                    modifier = Modifier.fillMaxSize().imePadding(),
                    contentAlignment = Alignment.Center
                ) {
                    // Wrap the content instead of leaving a tall, empty white sheet.
                    val formScrollMaxHeight = maxHeight * .75f
                    Surface(
                        modifier = Modifier.fillMaxWidth(.94f)
                            .heightIn(max = maxHeight * .90f),
                        shape = RoundedCornerShape(23.dp),
                        color = Color(0xFF191A1D),
                        border = BorderStroke(1.dp, Color(0xFF3A3C42)),
                        shadowElevation = 20.dp
                    ) {
                        Column(Modifier.fillMaxWidth()) {
                        Row(Modifier.fillMaxWidth()
                            .background(partnerNight)
                            .padding(horizontal = 19.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(tr(LocalNativeLanguage176.current, "BetVima Partners", "BetVima Partners"), color = Color.White,
                                    fontWeight = FontWeight.Black, fontSize = 19.sp)
                                Text(
                                    if(authMode=="register")
                                        tr(lang,"Create partner account","ثبت‌نام همکاری")
                                    else tr(lang,"Partner sign in","ورود به حساب همکاری"),
                                    color=Color(0xFFB0C3D8),fontSize=12.sp
                                )
                            }
                            IconButton(onClick={authMode=null}) {
                                Icon(Icons.Default.Close,
                                    tr(lang,"Dismiss","بستن"),tint=Color.White)
                            }
                        }
                        Column(Modifier.fillMaxWidth()
                            .heightIn(max = formScrollMaxHeight)
                            .verticalScroll(rememberScrollState())
                            .padding(15.dp)) {
                            AffiliateAccessPanel(
                                lang=lang,api=affiliateApi,vault=affiliateVault,
                                initialRegister=authMode=="register",
                                onAuthenticated={
                                    authMode=null
                                    showPortal=true
                                }
                            )
                        }
                        }
                    }
                }
            }
        }
    }
}

/** Two adjacent sections share this curved boundary with no detached spacer.
 * A filled Bézier arc creates the shallow crescent transition at every contrast change.
 */
@Composable
private fun PartnerCrescentSeam(top:Color,bottom:Color,reverse:Boolean=false) {
    Canvas(Modifier.fillMaxWidth().height(43.dp).background(top)) {
        val start=if(reverse)size.height*.18f else size.height*.72f
        val finish=if(reverse)size.height*.76f else size.height*.14f
        val arch=Path().apply {
            moveTo(0f,start)
            cubicTo(size.width*.25f,if(reverse)size.height*1.08f else -size.height*.22f,
                size.width*.73f,if(reverse)-size.height*.18f else size.height*1.04f,
                size.width,finish)
            lineTo(size.width,size.height)
            lineTo(0f,size.height)
            close()
        }
        drawPath(arch,color=bottom)
    }
}

@Composable
private fun AffiliateMotionLanding(
    lang: Lang,
    onGetStarted: () -> Unit,
    onLogin: () -> Unit,
    list: androidx.compose.foundation.lazy.LazyListState
) {
    val showing: (Int) -> Boolean = { index ->
        list.layoutInfo.visibleItemsInfo.any { it.index == index }
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(partnerNight),
        state = list,
        flingBehavior = rememberPremiumFlingBehavior(),
        contentPadding = PaddingValues(bottom = 32.dp)
    ) {
        item(key = "hero") {
            val active by remember { derivedStateOf { showing(0) } }
            PartnerHero(lang, active, onGetStarted, onLogin)
        }
        item(key = "stats") {
            val active by remember { derivedStateOf { showing(1) } }
            PartnerStats(lang, active)
        }
        item(key = "seam-hero-to-features") {
            PartnerCrescentSeam(partnerNight,partnerPaper)
        }
        item(key = "features-heading") {
            LightHeading(lang, "FEATURES",
                "The ecosystem behind every partnership",
                "یک اکوسیستم برای رشد همکاری")
        }
        item(key = "features") {
            val active by remember { derivedStateOf { showing(4) } }
            PartnerFeatures(lang, active)
        }
        item(key = "chart") {
            val active by remember { derivedStateOf { showing(5) } }
            PartnerChart(lang, active)
        }
        item(key = "coverage") {
            val active by remember { derivedStateOf { showing(6) } }
            PartnerCoverage(lang, active, onGetStarted)
        }
        item(key = "seam-light-to-products") {
            PartnerCrescentSeam(partnerPaper,partnerNight,reverse=true)
        }
        item(key = "products") {
            val active by remember { derivedStateOf { showing(8) } }
            PartnerProducts(lang, active)
        }
        item(key = "seam-products-to-faq") {
            PartnerCrescentSeam(partnerNight,partnerPaper)
        }
        item(key = "questions") {
            val active by remember { derivedStateOf { showing(10) } }
            PartnerFaq(lang, active)
        }
        item(key = "seam-faq-to-gallery") {
            PartnerCrescentSeam(partnerPaper,Color(0xFFFAFAFD),reverse=true)
        }
        item(key = "gallery") {
            val active by remember { derivedStateOf { showing(12) } }
            PartnerGallery(lang, active)
        }
        item(key = "seam-gallery-to-guides") {
            PartnerCrescentSeam(Color(0xFFFAFAFD),partnerPaper)
        }
        item(key = "learning") {
            PartnerGuides196(lang)
        }
        item(key = "seam-guides-to-signup") {
            PartnerCrescentSeam(partnerPaper,partnerNight,reverse=true)
        }
        item(key = "signup") {
            val active by remember { derivedStateOf { showing(16) } }
            PartnerSignup(lang, active, onGetStarted)
        }
    }
}

@Composable
private fun PartnerHero(
    lang: Lang,
    active: Boolean,
    onGetStarted: () -> Unit,
    onLogin: () -> Unit
) {
    // User-supplied artwork is the ENTIRE hero. Its container keeps the exact
    // source aspect ratio (1229 x 1536), so there is no crop, letterboxing,
    // colored backdrop, gradient overlay, duplicate caption, or extra margin.
    // The button and sign-in callouts are already baked into the graphic.
    // Transparent hit targets keep both calls to action fully functional.
    BoxWithConstraints(
        modifier = Modifier.fillMaxWidth().aspectRatio(1229f / 1536f)
    ) {
        Image(
            painter = painterResource(com.betvima.app.R.drawable.affiliate_hero_custom_20261031),
            contentDescription = tr(
                lang,
                "BetVima Partners affiliate program hero",
                "تصویر بخش همکاری در فروش بت‌ویما"
            ),
            contentScale = ContentScale.FillBounds,
            modifier = Modifier.matchParentSize()
        )
        Box(
            modifier = Modifier
                .offset(x = maxWidth * .047f, y = maxHeight * .453f)
                .width(maxWidth * .345f)
                .height(maxHeight * .081f)
                .semantics {
                    contentDescription = tr(
                        lang, "Become an affiliate", "شروع همکاری"
                    )
                }
                .clickable(role = Role.Button, onClick = onGetStarted)
        )
        Box(
            modifier = Modifier
                .offset(x = maxWidth * .044f, y = maxHeight * .538f)
                .width(maxWidth * .240f)
                .height(maxHeight * .045f)
                .semantics {
                    contentDescription = tr(
                        lang, "Already partnered? Sign in", "همکار هستید؟ ورود"
                    )
                }
                .clickable(role = Role.Button, onClick = onLogin)
        )
    }
}

@Composable
private fun PartnerFloatLabel(title: String, sub: String, modifier: Modifier) {
    Surface(modifier = modifier.shadow(13.dp, RoundedCornerShape(19.dp)),
        color = Color.White, shape = RoundedCornerShape(19.dp),
        border = BorderStroke(2.dp, Color(0xFFC5CCF7))) {
        Column(Modifier.padding(horizontal = 13.dp, vertical = 10.dp)) {
            Text(title, fontSize = 20.sp, fontWeight = FontWeight.Black,
                color = partnerNight)
            Text(sub, fontSize = 9.sp, color = Color(0xFF73809A))
        }
    }
}

@Composable
private fun PartnerPhone(lang:Lang) {
    Surface(
        modifier = Modifier.size(width = 183.dp, height = 337.dp),
        color = Color(0xFF080A13), shape = RoundedCornerShape(27.dp),
        border = BorderStroke(5.dp, Color(0xFF343A47)),
        shadowElevation = 20.dp
    ) {
        Column(Modifier.padding(9.dp)) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Box(Modifier.size(64.dp, 9.dp).clip(CircleShape)
                    .background(Color.Black))
            }
            Spacer(Modifier.height(11.dp))
            Text("BETVIMA", color = partnerWhite, fontSize = 14.sp,
                fontWeight = FontWeight.Black)
            Spacer(Modifier.height(9.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf("Live", "Sports", "Casino").forEach {
                    Surface(shape = RoundedCornerShape(5.dp),
                        color = if (it == "Live") partnerBlue else Color(0xFF20283A)) {
                        Text(it, Modifier.padding(5.dp), color = Color.White, fontSize = 7.sp)
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Box(Modifier.fillMaxWidth().height(93.dp).clip(RoundedCornerShape(12.dp))
                .background(Brush.linearGradient(listOf(Color(0xFF15275C),
                    Color(0xFF315DFF), Color(0xFF111B45))))) {
                Column(Modifier.align(Alignment.CenterStart).padding(11.dp)) {
                    Text("BETVIMA", color = Color(0xFFB7C5FF), fontSize = 8.sp)
                    Text(tr(lang,"Explore the game","دنیای بازی"), color = Color.White, fontSize = 14.sp,
                        fontWeight = FontWeight.Black)
                    Spacer(Modifier.height(5.dp))
                    Text(tr(lang,"SPORTS • CASINO","ورزش • کازینو"), color = Color.White, fontSize = 7.sp)
                }
            }
            Spacer(Modifier.height(9.dp))
            repeat(3) { idx ->
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 3.dp)
                        .background(Color(0xFF1B2330), RoundedCornerShape(8.dp))
                        .padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(if(idx==0) Icons.Default.SportsSoccer else
                        if(idx==1) Icons.Default.Casino else Icons.Default.BarChart,
                        null, tint = if(idx==0)partnerMint else Color(0xFFB1DDC1),
                        modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(9.dp))
                    Text(listOf("Football", "Live Casino", "Insights")[idx],
                        color = Color.White, fontSize = 9.sp)
                    Spacer(Modifier.weight(1f))
                    Icon(Icons.Default.ChevronRight,null,
                        tint=Color(0xFFBAC5D4),modifier=Modifier.size(14.dp))
                }
            }
        }
    }
}

@Composable
private fun PartnerStats(lang: Lang, active: Boolean) {
    val count by animateIntAsState(
        if(active) 3 else 0,
        animationSpec=tween(940,easing=FastOutSlowInEasing),
        label="partner-products-count"
    )
    val appear by animateFloatAsState(
        if(active) 1f else 0f,
        animationSpec=tween(770),label="partner-blue-band"
    )
    Column(
        Modifier.fillMaxWidth()
            .offset(y=(-19).dp)
            .padding(horizontal=10.dp)
            .graphicsLayer {
                alpha=.55f+appear*.45f
                translationY=(1f-appear)*30f
            }
            .clip(RoundedCornerShape(27.dp))
            .background(Brush.horizontalGradient(listOf(
                Color(0xFF264AFF),Color(0xFF365FFF),Color(0xFF4568FF)
            )))
            .padding(horizontal=16.dp,vertical=22.dp)
    ) {
        Text(
            tr(lang,
                "Build your reach. Grow together.",
                "مخاطبان بیشتری جذب کنید؛ با هم رشد کنیم."),
            color=Color.White,fontSize=17.sp,
            fontWeight=FontWeight.Black,
            lineHeight=22.sp
        )
        Spacer(Modifier.height(22.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement=Arrangement.SpaceEvenly,
            verticalAlignment=Alignment.Top
        ) {
            val cells=listOf(
                Pair("70%",tr(lang,"Base\nRevShare","سهم پایه")),
                Pair("$count",tr(lang,"BetVima\nproducts","محصولات")),
                Pair("1",tr(lang,"Partner\ndashboard","داشبورد همکار"))
            )
            cells.forEachIndexed { index,item ->
                if(index>0) {
                    Box(Modifier.width(1.dp).height(58.dp)
                        .background(Color.White.copy(alpha=.30f)))
                }
                Column(Modifier.weight(1f),horizontalAlignment=Alignment.CenterHorizontally) {
                    Text(item.first,color=Color.White,fontSize=29.sp,
                        fontWeight=FontWeight.Black,maxLines=1)
                    Text(item.second,color=Color(0xFFE6EBFF),fontSize=10.sp,
                        lineHeight=14.sp,textAlign=TextAlign.Center,
                        fontWeight=FontWeight.Medium)
                }
            }
        }
        Spacer(Modifier.height(9.dp))
        Text(
            tr(lang,
                "Revenue share applies under each approved partner agreement.",
                "محاسبه سهم درآمد مطابق قرارداد تأییدشده هر همکار است."),
            color=Color(0xFFDDE5FF),fontSize=9.sp,lineHeight=13.sp
        )
    }
}

@Composable
private fun LightHeading(lang: Lang, label: String, en: String, fa: String) {
    Column(Modifier.fillMaxWidth().background(partnerPaper)
        .padding(start = 24.dp, end = 24.dp, top = 53.dp, bottom = 24.dp)) {
        Text(label, color = partnerBlue, fontSize = 11.sp, letterSpacing = 2.sp,
            fontWeight = FontWeight.Black)
        Spacer(Modifier.height(13.dp))
        Text(tr(lang,en,fa), color = partnerNight,
            fontSize = 30.sp, fontWeight = FontWeight.Black, lineHeight = 35.sp)
    }
}

@Composable
private fun PartnerFeatures(lang: Lang, active: Boolean) {
    Column(Modifier.fillMaxWidth().background(partnerPaper)
        .padding(horizontal=17.dp), verticalArrangement=Arrangement.spacedBy(12.dp)) {
        val cards = listOf(
            Triple(Icons.Default.Casino,
                tr(lang,"One BetVima ecosystem","اکوسیستم یکپارچه"),
                tr(lang,"Sports and casino experiences in one brand.",
                    "تجربه ورزش و کازینو با هویت مشترک.")),
            Triple(Icons.Default.Smartphone,
                tr(lang,"Designed for mobile","طراحی ویژه موبایل"),
                tr(lang,"Native experiences and smooth navigation.",
                    "تجربه بومی و پیمایش نرم در اپلیکیشن.")),
            Triple(Icons.Default.Leaderboard,
                tr(lang,"Partner reporting","گزارش‌های همکاری"),
                tr(lang,"Review traffic, links and eligible commissions.",
                    "آمار ورودی، لینک‌ها و کمیسیون‌های مجاز."))
        )
        cards.forEachIndexed { i, card ->
            val featured = i == 0
            Surface(
                color = if(featured) Color(0xFF111828) else Color.White,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.fillMaxWidth(),
                border = BorderStroke(1.dp,
                    if(featured) Color(0xFF344466) else Color(0xFFE1E6F0)),
                shadowElevation = 0.dp
            ) {
                Column(Modifier.padding(19.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(card.first, null,
                            tint = if (i==0) partnerMint else partnerBlue,
                            modifier = Modifier.size(32.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(card.second,
                            color = if(i==0)Color.White else partnerNight,
                            fontSize = 20.sp, fontWeight = FontWeight.Black)
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(card.third,
                        color = if(i==0)Color(0xFFC0C9DE) else partnerMuted,
                        fontSize = 13.sp, lineHeight = 19.sp)
                    Spacer(Modifier.height(19.dp))
                    AffiliateReveal(visible=active,delayMillis=i*110,
                        modifier=Modifier.fillMaxWidth()) {
                        AffiliateCinematicPhoto(
                            when(i) {
                                0 -> AffiliateScene.ECOSYSTEM
                                1 -> AffiliateScene.MOBILE
                                else -> AffiliateScene.STATISTICS
                            },Modifier.fillMaxWidth().height(178.dp),active,corner=17
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PartnerChart(lang: Lang, active: Boolean) {
    Column(Modifier.fillMaxWidth().background(partnerPaper)
        .padding(start=17.dp,end=17.dp,top=19.dp,bottom=24.dp)) {
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
            .background(Color(0xFF101625)).padding(19.dp)) {
            Text(tr(lang,"Statistics that move with you","آمار پویا و حرفه‌ای"),
                fontWeight=FontWeight.Black,color=Color.White,fontSize=22.sp,
                lineHeight=27.sp)
            Spacer(Modifier.height(9.dp))
            Text(tr(lang,
                    "Animated sample only. Actual traffic and commissions appear in the signed-in partner dashboard.",
                    "نمودار انیمیشنی نمونه است؛ ترافیک و کمیسیون واقعی فقط در داشبورد همکاری نمایش داده می‌شوند."),
                fontSize=11.sp,lineHeight=17.sp,color=Color(0xFFA9B6C7))
            Spacer(Modifier.height(17.dp))
            // Live vector geometry: the line grows on entry and the highlighted
            // marker moves while visible. No static chart image is used here.
            AffiliateAnimatedChart199(
                active=active,
                modifier=Modifier.fillMaxWidth().height(179.dp),
                compact=false
            )
            Spacer(Modifier.height(15.dp))
            AffiliateAnimatedBars199(
                active=active,
                modifier=Modifier.fillMaxWidth().height(135.dp)
            )
        }
    }
}

@Composable
private fun PartnerCoverage(lang: Lang, active: Boolean, onGetStarted: () -> Unit) {
    Column(Modifier.fillMaxWidth().background(partnerPaper)
        .padding(horizontal=24.dp, vertical=40.dp),
        horizontalAlignment=Alignment.CenterHorizontally) {
        AffiliateCinematicPhoto(AffiliateScene.GEOGRAPHY,
            Modifier.fillMaxWidth().height(175.dp),active,corner=24)
        Spacer(Modifier.height(13.dp))
        Icon(Icons.Default.Public, null, tint=partnerBlue,
            modifier=Modifier.size(38.dp))
        Spacer(Modifier.height(19.dp))
        Text(tr(lang,"Partner thinking, worldwide","همکاری با نگاهی جهانی"),
            color=partnerNight, fontSize=27.sp, lineHeight=32.sp,
            fontWeight=FontWeight.Black, textAlign=TextAlign.Center)
        Spacer(Modifier.height(11.dp))
        Text(tr(lang,"Availability depends on the markets and territories approved for BetVima. Local restrictions apply.",
                "ارائه خدمات بر اساس قوانین منطقه و کشورهای مجاز BetVima تعیین می‌شود."),
            color=partnerMuted,fontSize=13.sp,textAlign=TextAlign.Center,lineHeight=19.sp)
        Spacer(Modifier.height(22.dp))
        Button(onClick=onGetStarted,
            shape=RoundedCornerShape(13.dp),
            colors=ButtonDefaults.buttonColors(containerColor=partnerNight)) {
            Text(tr(lang,"Become an affiliate","شروع همکاری"),
                color=Color.White,fontWeight=FontWeight.Bold)
            Spacer(Modifier.width(8.dp))
            Icon(Icons.Default.ArrowForward,null,tint=Color.White)
        }
    }
}

@Composable
@OptIn(ExperimentalFoundationApi::class)
private fun PartnerProducts(lang: Lang, active: Boolean) {
    Column(Modifier.fillMaxWidth().background(partnerNight)
        .padding(vertical=45.dp)) {
        Column(Modifier.padding(horizontal=24.dp)) {
            Text(tr(lang,"PRODUCT","محصولات"), color=partnerMint,letterSpacing=2.sp,fontSize=11.sp,
                fontWeight=FontWeight.Black)
            Spacer(Modifier.height(14.dp))
            Text(tr(lang,"The BetVima experience,\nin your pocket",
                    "محصولات بت‌ویما\nدر موبایل شما"),
                fontSize=30.sp,lineHeight=36.sp,color=Color.White,
                fontWeight=FontWeight.Black)
            Spacer(Modifier.height(13.dp))
            Text(tr(lang,"Swipe to explore the platform.",
                "برای دیدن محصولات ورق بزنید."),
                color=Color(0xFF9CA3B7),fontSize=13.sp)
        }
        Spacer(Modifier.height(21.dp))
        val carousel=rememberLazyListState()
        LazyRow(
            state=carousel,
            contentPadding=PaddingValues(horizontal=18.dp),
            horizontalArrangement=Arrangement.spacedBy(11.dp),
            flingBehavior=rememberSnapFlingBehavior(lazyListState=carousel)
        ) {
            itemsIndexed(listOf(
                Triple(Icons.Default.Casino,"Casino","کازینو"),
                Triple(Icons.Default.SportsSoccer,"Sports","ورزش"),
                Triple(Icons.Default.Smartphone,"Mobile app","اپلیکیشن")
            )) { index, (icon, en, fa) ->
                val selected = carousel.firstVisibleItemIndex == index && active
                val zoom by animateFloatAsState(if(selected)1f else .94f,
                    animationSpec=tween(400,easing=FastOutSlowInEasing),
                    label="affiliate-product-focus")
                Surface(
                    modifier=Modifier.fillParentMaxWidth(.86f).height(358.dp)
                        .graphicsLayer {
                            scaleX=zoom
                            scaleY=zoom
                            clip=true
                            shape=RoundedCornerShape(23.dp)
                        },
                    shape=RoundedCornerShape(23.dp),
                    color=Color(0xFF171D28),
                    border=BorderStroke(1.dp,Color(0xFF303D59))
                ) {
                    Column(Modifier.padding(19.dp)) {
                        Icon(icon,null,tint=partnerMint,
                            modifier=Modifier.size(34.dp))
                        Spacer(Modifier.height(11.dp))
                        Text(tr(lang,en,fa), color=Color.White,
                            fontSize=26.sp,fontWeight=FontWeight.Black)
                        Spacer(Modifier.height(8.dp))
                        Text(tr(lang,
                            "Explore BetVima products designed for discovery and mobile navigation.",
                            "محصولات بت‌ویما برای استفاده روان و راحت در موبایل."),
                            color=Color(0xFFBBC2D3),fontSize=12.sp,lineHeight=18.sp)
                        Spacer(Modifier.weight(1f))
                        AffiliateCinematicPhoto(
                            when(en) {
                                "Casino" -> AffiliateScene.CASINO
                                "Sports" -> AffiliateScene.SPORTS
                                else -> AffiliateScene.MOBILE_PRODUCT
                            },Modifier.fillMaxWidth().height(148.dp),active,corner=16
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(13.dp))
        Text(tr(lang,"←   SWIPE   →","←   ورق بزنید   →"),color=Color(0xFF99A3BE),
            modifier=Modifier.align(Alignment.CenterHorizontally),fontSize=11.sp)
    }
}

private data class PartnerQuestion(val en:String,val fa:String,val answerEn:String,val answerFa:String)
private val partnerQuestions=listOf(
    PartnerQuestion(
        "Is the 70% revenue share available?", "آیا سهم ۷۰٪ فعال است؟",
        "70% is the advertised default rate for approved partners. The binding rate, eligible revenue and adjustments are determined by your approved agreement and verified dashboard.",
        "۷۰٪ نرخ پایه اعلام‌شده برای همکاران تأییدشده است. نرخ قطعی، درآمد مشمول و تعدیلات طبق قرارداد تأییدشده و داشبورد معتبر تعیین می‌شوند."),
    PartnerQuestion(
        "How do I earn with BetVima?","چطور از BetVima درآمد داشته باشم؟",
        "Register a separate partner account, share eligible referral links, and see approved commission in your dashboard.",
        "حساب همکاری بسازید، لینک اختصاصی را به اشتراک بگذارید و کمیسیون تأییدشده را در پنل ببینید."),
    PartnerQuestion(
        "RevShare or CPA?","RevShare و CPA چه تفاوتی دارند؟",
        "RevShare follows your approved revenue agreement. CPA requires a separate approval and is not automatically active.",
        "RevShare طبق قرارداد درآمدی محاسبه می‌شود. CPA نیاز به تأیید جداگانه دارد و به‌صورت خودکار فعال نیست."),
    PartnerQuestion(
        "When are payouts issued?","تسویه چه زمانی انجام می‌شود؟",
        "Payment timing and eligibility follow the current approved partner agreement and account settlement rules.",
        "زمان و شرایط برداشت مطابق قرارداد تأییدشده و مقررات تسویه حساب است."),
    PartnerQuestion(
        "How can I check my statistics?","آمار را کجا می‌بینم؟",
        "Sign in to your native partner dashboard for traffic, referrals, and account-authorized reports.",
        "پس از ورود به پنل بومی، آمار ورودی‌ها، معرفی‌ها و گزارش‌های حساب را ببینید.")
)

@Composable
private fun PartnerFaq(lang: Lang, active: Boolean) {
    Column(Modifier.fillMaxWidth().background(partnerPaper)
        .padding(horizontal=19.dp, vertical=45.dp)) {
        Text(tr(lang,"FAQ","پرسش‌های متداول"),color=partnerBlue,letterSpacing=2.sp,fontSize=12.sp,
            fontWeight=FontWeight.Black)
        Spacer(Modifier.height(13.dp))
        Text(tr(lang,"Frequently asked questions","پرسش‌های متداول"),
            color=partnerNight,fontSize=29.sp,fontWeight=FontWeight.Black,
            lineHeight=34.sp)
        Spacer(Modifier.height(17.dp))
        AffiliateCinematicPhoto(AffiliateScene.FAQ,
            Modifier.fillMaxWidth().height(135.dp),active,corner=20)
        Spacer(Modifier.height(16.dp))
        Surface(color=Color.White,shape=RoundedCornerShape(20.dp)) {
            Column(Modifier.padding(17.dp)) {
                Text(tr(lang,"Hello! Tell me about joining BetVima.",
                        "سلام! درباره همکاری با بت‌ویما توضیح می‌دهید؟"),
                    color=partnerNight,fontSize=12.sp)
                Spacer(Modifier.height(9.dp))
                Text(tr(lang,"Welcome! Create a partner account to get started.",
                        "خوش آمدید! برای شروع یک حساب همکار ایجاد کنید."),
                    modifier=Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(13.dp))
                        .background(partnerBlue).padding(13.dp),
                    color=Color.White,fontSize=12.sp)
            }
        }
        Spacer(Modifier.height(21.dp))
        val faqPhotos = listOf(
            AffiliateScene.FAQ_REVSHARE,
            AffiliateScene.FAQ_EARNING,
            AffiliateScene.FAQ_CPA,
            AffiliateScene.FAQ_PAYOUTS,
            AffiliateScene.FAQ_STATISTICS
        )
        partnerQuestions.forEachIndexed { index, question ->
            var expanded by rememberSaveable(index) { mutableStateOf(false) }
            Column(Modifier.padding(vertical=6.dp).fillMaxWidth()
                .clip(RoundedCornerShape(19.dp))
                .background(Color.White).animateContentSize()) {
                Row(Modifier.fillMaxWidth().clickable { expanded=!expanded }
                    .padding(horizontal=12.dp,vertical=12.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    // Thumbnail is clipped to the card and never owns its layout width.
                    AffiliateCinematicPhoto(
                        faqPhotos[index],Modifier.width(78.dp).height(68.dp),
                        active=active,corner=13
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(tr(lang,question.en,question.fa),
                        color=partnerNight,fontSize=14.sp,lineHeight=18.sp,
                        fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
                    Spacer(Modifier.width(5.dp))
                    Icon(if(expanded)Icons.Default.Remove else Icons.Default.Add,
                        null,tint=partnerBlue,modifier=Modifier.size(20.dp))
                }
                if(expanded) {
                    Text(tr(lang,question.answerEn,question.answerFa),
                        modifier=Modifier.padding(start=17.dp,end=17.dp,bottom=19.dp),
                        color=partnerMuted,fontSize=12.sp,lineHeight=19.sp)
                }
            }
        }
    }
}

@Composable
private fun PartnerGallery(lang: Lang, active: Boolean) {
    Column(Modifier.fillMaxWidth().background(Color(0xFFFAFAFD))
        .padding(20.dp)) {
        Text(tr(lang,"ABOUT US","درباره ما"),color=partnerBlue,letterSpacing=2.sp,
            fontWeight=FontWeight.Black,fontSize=11.sp)
        Spacer(Modifier.height(12.dp))
        Text(tr(lang,"Discover BetVima","دنیای بت‌ویما"),
            color=partnerNight,fontWeight=FontWeight.Black,fontSize=31.sp)
        Spacer(Modifier.height(16.dp))
        val tiles=listOf(
            Triple(Icons.Default.Smartphone,"BETVIMA","MOBILE"),
            Triple(Icons.Default.SportsSoccer,"SPORTS","EXPERIENCE"),
            Triple(Icons.Default.Casino,"CASINO","DISCOVERY"),
            Triple(Icons.Default.ShowChart,"PARTNER","INSIGHTS")
        )
        tiles.chunked(2).forEachIndexed { row, group ->
            Row(horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                group.forEachIndexed { col, tile ->
                    AffiliateReveal(visible=active,delayMillis=(row*2+col)*95,
                        modifier=Modifier.weight(1f)) {
                        AffiliateCinematicPhoto(
                            when(row*2+col) {
                                0 -> AffiliateScene.GALLERY_MOBILE
                                1 -> AffiliateScene.GALLERY_SPORTS
                                2 -> AffiliateScene.GALLERY_CASINO
                                else -> AffiliateScene.GALLERY_INSIGHTS
                            },
                            Modifier.fillMaxWidth().height(183.dp),active,corner=22
                        ) {
                            Column(
                                Modifier.align(Alignment.BottomStart)
                                    .padding(start=13.dp,end=11.dp,bottom=15.dp)
                            ) {
                                Text(tile.second+"\n"+tile.third,
                                    color=Color.White,fontSize=14.sp,
                                    fontWeight=FontWeight.Black,
                                    lineHeight=17.sp)
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

/**
 * Editorial partner education — original BetVima copy, not unverified blog
 * traffic, payouts, partner counts, or material copied from another operator.
 */
@Composable
private fun PartnerGuides196(lang: Lang) {
    val articles = listOf(
        Triple(
            tr(lang,"Getting started with BetVima","شروع همکاری با بت‌ویما"),
            tr(lang,"Create a separate partner account and request an approved campaign link.",
                "حساب همکاری جداگانه بسازید و لینک تأییدشده کمپین دریافت کنید."),
            Icons.Default.RocketLaunch
        ),
        Triple(
            tr(lang,"Understanding the 70% RevShare","آشنایی با سهم ۷۰٪"),
            tr(lang,"The advertised base rate applies to approved partners; your contract and verified revenue statement control actual earnings.",
                "نرخ پایه برای همکار تأییدشده است و کمیسیون واقعی طبق قرارداد و گزارش معتبر محاسبه می‌شود."),
            Icons.Default.Percent
        ),
        Triple(
            tr(lang,"Read your partner reports","تحلیل گزارش‌های همکاری"),
            tr(lang,"Review attributed registrations, qualified activity and approved payouts in the secure dashboard.",
                "ثبت‌نام‌های منتسب، فعالیت واجد شرایط و تسویه‌های تأییدشده را در داشبورد ببینید."),
            Icons.Default.QueryStats
        )
    )
    var opened by rememberSaveable { mutableIntStateOf(-1) }
    Column(
        Modifier.fillMaxWidth().background(partnerPaper)
            .padding(horizontal=17.dp,vertical=35.dp),
        verticalArrangement=Arrangement.spacedBy(13.dp)
    ) {
        Text(tr(lang,"PARTNER KNOWLEDGE","راهنمای همکاران"),
            color=partnerBlue,fontSize=11.sp,fontWeight=FontWeight.Black,letterSpacing=1.4.sp)
        Text(tr(lang,"Build smarter campaigns","کمپین‌های مؤثرتری بسازید"),
            color=partnerNight,fontWeight=FontWeight.Black,
            fontSize=28.sp,lineHeight=34.sp)
        val guidePhotos = listOf(
            AffiliateScene.GUIDE_START,
            AffiliateScene.GUIDE_REVSHARE,
            AffiliateScene.GUIDE_REPORTING
        )
        articles.forEachIndexed { index,article ->
            Surface(
                onClick={opened=if(opened==index)-1 else index},
                shape=RoundedCornerShape(20.dp),
                color=Color.White,
                border=BorderStroke(1.dp,Color(0xFFE2E7F3)),
                modifier=Modifier.fillMaxWidth().animateContentSize()
            ) {
                Column(Modifier.padding(12.dp)) {
                    Row(verticalAlignment=Alignment.CenterVertically) {
                        Box(Modifier.width(94.dp).height(72.dp)
                            .clip(RoundedCornerShape(13.dp))) {
                            AffiliateCinematicPhoto(
                                guidePhotos[index],
                                Modifier.fillMaxSize(),
                                active=true,corner=13
                            )
                            Icon(article.third,null,tint=Color.White,
                                modifier=Modifier.align(Alignment.BottomStart)
                                    .padding(7.dp).size(19.dp))
                        }
                        Spacer(Modifier.width(12.dp))
                        Text(article.first,color=partnerNight,
                            fontSize=14.sp,lineHeight=18.sp,
                            fontWeight=FontWeight.Black,
                            modifier=Modifier.weight(1f))
                        Icon(if(opened==index)Icons.Default.KeyboardArrowUp
                            else Icons.Default.KeyboardArrowDown,null,
                            tint=partnerBlue,modifier=Modifier.size(20.dp))
                    }
                    if(opened==index) {
                        Spacer(Modifier.height(13.dp))
                        HorizontalDivider(color=Color(0xFFE7EAF1))
                        Spacer(Modifier.height(12.dp))
                        Text(article.second,color=partnerMuted,fontSize=12.sp,lineHeight=19.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun PartnerSignup(lang: Lang, active: Boolean, onGetStarted: () -> Unit) {
    Column(Modifier.fillMaxWidth().background(partnerNight)
        .padding(horizontal=23.dp,vertical=58.dp)) {
        AffiliateReveal(visible=active,modifier=Modifier.fillMaxWidth()) {
            AffiliateCinematicPhoto(AffiliateScene.JOIN,
                Modifier.fillMaxWidth().height(205.dp),active,corner=24)
        }
        Spacer(Modifier.height(24.dp))
        Text(tr(lang,"JOIN US","به ما بپیوندید"),color=partnerMint,fontSize=11.sp,letterSpacing=2.sp,
            fontWeight=FontWeight.Black)
        Spacer(Modifier.height(13.dp))
        Text(tr(lang,"Start earning right now","همین حالا همکاری را آغاز کنید"),
            color=Color.White,fontSize=32.sp,lineHeight=38.sp,
            fontWeight=FontWeight.Black)
        Spacer(Modifier.height(13.dp))
        Text(tr(lang,"Your own partner login, referral dashboard and approved contract terms.",
                "ورود اختصاصی، داشبورد ارجاع‌ها و شرایط قرارداد تأییدشده."),
            color=Color(0xFF9DA8BE),fontSize=13.sp,lineHeight=20.sp)
        Spacer(Modifier.height(26.dp))
        Button(onClick=onGetStarted, modifier=Modifier.fillMaxWidth().height(56.dp),
            shape=RoundedCornerShape(16.dp),
            colors=ButtonDefaults.buttonColors(containerColor=partnerBlue)) {
            Text(tr(lang,"Sign up or log in","ثبت‌نام یا ورود"),color=Color.White,
                fontSize=16.sp,fontWeight=FontWeight.Bold)
            Spacer(Modifier.width(9.dp))
            Icon(Icons.Default.ArrowForward,null,tint=Color.White)
        }
        Spacer(Modifier.height(27.dp))
        HorizontalDivider(color=Color.White.copy(alpha=.14f))
        Spacer(Modifier.height(22.dp))
        Text(tr(lang,"Contact us","ارتباط با ما"),
            color=Color.White,fontSize=20.sp,fontWeight=FontWeight.Black)
        Spacer(Modifier.height(11.dp))
        Row(verticalAlignment=Alignment.CenterVertically) {
            Icon(Icons.Default.Email,null,tint=partnerMint,
                modifier=Modifier.size(21.dp))
            Spacer(Modifier.width(9.dp))
            Text("BetVimaSupport@gmail.com",color=Color.White,fontSize=13.sp)
        }
        Spacer(Modifier.height(26.dp))
        Text(tr(lang,"Partnership eligibility and payments are subject to applicable rules and approved agreements.",
            "شرایط همکاری و تسویه تابع قوانین و قرارداد تأییدشده است."),
            color=Color(0xFF7E879B),fontSize=11.sp,lineHeight=18.sp)
    }
}
