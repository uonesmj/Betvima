package com.betvima.app.ui

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest

// The visual sequence and swipeable cards follow the user's video reference.
// All assets are BetVima-neutral licensed imagery, never a third-party brand logo.
// The photos are editorial illustrations, not representations of employee identity,
// a promised gift catalogue, or an approved VIP entitlement.
private val v192Night = Color(0xFF121316)
private val v192Panel = Color(0xFF202328)
private val v192Line = Color(0xFF363A42)
private val v192Silver = Color(0xFFEBEFF3)
private val v192Mute = Color(0xFFA8B1BD)
private val v192Mint = Color(0xFF00D47A)
private val v192Text = Color(0xFFF7F8FA)

private const val v192Jet = "https://images.unsplash.com/photo-1704652329502-93c8cfcb2e45?auto=format&fit=crop&w=1000&q=82"
private const val v192Luggage = "https://images.unsplash.com/photo-1766954798687-9f683c8c75be?auto=format&fit=crop&w=700&q=80"
private const val v192Interior = "https://images.unsplash.com/photo-1758448755778-90ebf4d0f1e7?auto=format&fit=crop&w=700&q=80"
private const val v192Car = "https://images.unsplash.com/photo-1752959814043-722bfdbc0f51?auto=format&fit=crop&w=700&q=80"
private const val v192BlueCar = "https://images.unsplash.com/photo-1770648591920-0a8d73f9dc02?auto=format&fit=crop&w=700&q=80"
private const val v192Yacht = "https://images.unsplash.com/photo-1755307739588-0bf45e1e1ed6?auto=format&fit=crop&w=700&q=80"
private const val v192Watch = "https://images.unsplash.com/photo-1702865053958-71ec751c4118?auto=format&fit=crop&w=700&q=80"
private const val v192Man = "file:///android_asset/affiliate/people_1.webp"
private const val v192Woman = "file:///android_asset/affiliate/people_2.webp"

private data class V192Tile(
    val titleEn: String, val titleFa: String, val image: String,
    val symbol: String = ""
)
private val v192Concierge = listOf(
    V192Tile("Travel arrangements", "برنامه‌ریزی سفر", v192Luggage),
    V192Tile("Leisure organization", "برنامه‌های تفریحی", v192Car),
    V192Tile("Family assistance", "خدمات خانوادگی", v192Interior),
    V192Tile("Shopping assistance", "راهنمایی خرید", v192Watch),
    V192Tile("Health-related assistance", "راهنمایی خدمات سلامت", v192Yacht)
)
private val v192Personal = listOf(
    V192Tile("Personal bonuses", "پاداش‌های اختصاصی", v192Watch),
    V192Tile("Private experiences", "تجربه‌های اختصاصی", v192Jet),
    V192Tile("Custom interface", "رابط اختصاصی", v192Interior),
    V192Tile("Epic events", "رویدادهای ویژه", v192BlueCar),
    V192Tile("Premium travel", "سفرهای ویژه", v192Yacht)
)
private val v192Gifts = listOf(
    V192Tile("Premium cars", "خودروهای ممتاز", v192BlueCar, "VIP"),
    V192Tile("Luxury jewellery", "جواهرات لوکس", v192Watch, "VIP"),
    V192Tile("Luxury watches", "ساعت‌های لوکس", v192Watch, "VIP"),
    V192Tile("Yacht experiences", "تجربه قایق‌های تفریحی", v192Yacht, "VIP")
)

@Composable
private fun V192Photo(url: String, modifier: Modifier = Modifier) {
    Box(modifier.background(
        Brush.linearGradient(listOf(Color(0xFF34404B), v192Panel, Color(0xFF191C21)))
    )) {
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current).data(url).crossfade(true).build(),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
    }
}

@Composable
private fun V192Dots(current: Int, count: Int, light: Boolean = false) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 11.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        repeat(count) { index ->
            Box(
                Modifier.padding(horizontal = 3.dp)
                    .width(if (index == current) 19.dp else 7.dp)
                    .height(3.dp)
                    .clip(CircleShape)
                    .background(if (index == current)
                        (if (light) Color(0xFF101215) else Color.White)
                        else (if (light) Color(0xFFB9BEC4) else Color(0xFF686E77)))
            )
        }
    }
}

@Composable
private fun V192Hero(lang: Lang) {
    Box(Modifier.fillMaxWidth().height(435.dp)) {
        V192Photo(v192Jet, Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
            listOf(Color(0xDB101216), Color(0x2C13171C),
                Color(0x38202024), v192Night)
        )))
        Column(Modifier.align(Alignment.TopStart).padding(start = 16.dp, top = 24.dp)) {
            Text(tr(lang, "VIP Club", "باشگاه VIP"),
                color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(8.dp))
            Text(tr(lang, "What makes BetVima VIP CLUB\nthe best choice out there?",
                "چرا باشگاه VIP بت‌ویما\nانتخاب متفاوتی است؟"),
                color = Color.White, fontSize = 14.sp, lineHeight = 20.sp,
                fontWeight = FontWeight.Medium)
        }
        Row(
            Modifier.align(Alignment.BottomCenter)
                .fillMaxWidth().padding(horizontal = 12.dp, vertical = 27.dp),
            horizontalArrangement = Arrangement.spacedBy(11.dp)
        ) {
            listOf(
                tr(lang, "PREMIUM\nEXPERIENCES", "تجربه‌های\nممتاز"),
                tr(lang, "VIP\nACCESS", "دسترسی\nVIP"),
                tr(lang, "BETVIMA\nREWARDS", "پاداش‌های\nبت‌ویما")
            ).forEach { label ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.EmojiEvents, null, tint = Color(0xFFD7C8A2),
                        modifier = Modifier.size(23.dp))
                    Text(label, fontSize = 9.sp, lineHeight = 11.sp,
                        color = v192Silver, fontWeight = FontWeight.Bold,
                        maxLines = 2)
                }
            }
        }
    }
}

@Composable
private fun V192Manager(lang: Lang) {
    Box(Modifier.fillMaxWidth().height(278.dp)
        .background(Brush.verticalGradient(listOf(Color(0xFF333A42), v192Night)))) {
        Row(Modifier.fillMaxSize().padding(top = 72.dp)) {
            Box(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(topStart = 13.dp))) {
                V192Photo(v192Woman, Modifier.fillMaxSize())
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
                    listOf(Color(0xFF20252B), Color.Transparent, v192Night.copy(alpha=.50f)))))
            }
            Box(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(topEnd = 13.dp))) {
                V192Photo(v192Man, Modifier.fillMaxSize())
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
                    listOf(Color(0xFF20252B), Color.Transparent, v192Night.copy(alpha=.50f)))))
            }
        }
        Column(Modifier.align(Alignment.TopStart).padding(17.dp)) {
            Text(tr(lang, "VIP manager", "مدیر VIP"), color = v192Text,
                fontSize = 23.sp, fontWeight = FontWeight.Bold)
            Text(tr(lang, "Here to help with VIP questions\nand guide you through available benefits",
                "راهنمای پرسش‌های VIP و\nمزایای موجود برای حساب شما"),
                color = v192Mute, fontSize = 11.sp, lineHeight = 15.sp)
        }
        Surface(Modifier.align(Alignment.TopEnd).padding(15.dp),
            color = Color(0xFF404950), shape = CircleShape) {
            Text(tr(lang, "Support", "پشتیبانی"),
                color = Color.White, modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun V192ImageSlider(
    lang: Lang, title: String, subtitle: String, tiles: List<V192Tile>,
    light: Boolean, tall: Boolean = false
) {
    val listState = rememberLazyListState()
    val current = listState.firstVisibleItemIndex.coerceIn(0, tiles.lastIndex)
    val background = if (light) Color(0xFFF1F2F2) else v192Night
    Column(
        Modifier.fillMaxWidth()
            .background(background,
                RoundedCornerShape(if (light) 24.dp else 0.dp))
            .padding(top = 20.dp, bottom = 7.dp)
    ) {
        Column(Modifier.padding(horizontal = 15.dp)) {
            Text(title, color = if (light) Color(0xFF121416) else v192Text,
                fontSize = 21.sp, fontWeight = FontWeight.Bold)
            if (subtitle.isNotBlank()) {
                Text(subtitle,
                    color = if (light) Color(0xFF60656B) else v192Mute,
                    fontSize = 11.sp, lineHeight = 15.sp)
            }
        }
        Spacer(Modifier.height(13.dp))
        LazyRow(
            state = listState,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(9.dp),
            flingBehavior = rememberSnapFlingBehavior(lazyListState = listState)
        ) {
            itemsIndexed(tiles) { _, tile ->
                Box(Modifier.width(if (tall) 232.dp else 153.dp)
                    .height(if (tall) 275.dp else 198.dp)
                    .clip(RoundedCornerShape(17.dp))
                    .background(Color(0xFF555F6B))) {
                    V192Photo(tile.image, Modifier.fillMaxSize())
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
                        listOf(Color(0x9C1B222A), Color.Transparent, Color(0x33111519)))))
                    Column(Modifier.align(Alignment.TopStart).padding(10.dp)) {
                        if (tile.symbol.isNotBlank()) {
                            Text(tile.symbol, color=Color.White,
                                fontSize = 41.sp, fontWeight = FontWeight.Black)
                        }
                        Text(tr(lang, tile.titleEn, tile.titleFa),
                            color = Color.White, fontSize = 12.sp, lineHeight = 16.sp,
                            fontWeight = FontWeight.Bold, maxLines = 2,
                            overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        V192Dots(current, tiles.size, light = light)
    }
}

@Composable
private fun V192Numbers(lang: Lang) {
    val cards = listOf(
        Triple("05", tr(lang, "weekly cashback tiers", "سطح کش‌بک هفتگی"),
            tr(lang, "Based on published BetVima plans", "بر اساس پلن‌های اعلام‌شده بت‌ویما")),
        Triple("3–11%", tr(lang, "eligible-loss cashback rates", "درصد کش‌بک باخت واجد شرایط"),
            tr(lang, "Rate depends on weekly deposit band", "نرخ به سطح واریز هفتگی بستگی دارد")),
        Triple("$2k+", tr(lang, "weekly deposits for the first plan", "شروع نخستین سطح واریز هفتگی"),
            tr(lang, "Actual credited rewards require server verification",
                "پاداش واریزشده نیازمند تأیید سرور است"))
    )
    val listState = rememberLazyListState()
    val current = listState.firstVisibleItemIndex.coerceIn(0, cards.lastIndex)
    Column(Modifier.fillMaxWidth().background(v192Night)
        .padding(top = 21.dp, bottom = 8.dp)) {
        Text(tr(lang, "VIP Club by the numbers", "باشگاه VIP در یک نگاه"),
            modifier = Modifier.padding(horizontal = 16.dp),
            color = v192Text, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        LazyRow(state = listState,
            contentPadding = PaddingValues(horizontal = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(11.dp),
            flingBehavior = rememberPremiumFlingBehavior()) {
            itemsIndexed(cards) { _, card ->
                Box(Modifier.fillParentMaxWidth(.94f).height(267.dp)
                    .clip(RoundedCornerShape(19.dp))
                    .background(Brush.linearGradient(listOf(
                        Color(0xFFFFFFFF), Color(0xFFDCE0E5), Color(0xFFF9FAFC)
                    )))) {
                    Column(
                        Modifier.fillMaxSize().padding(18.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.SpaceEvenly
                    ) {
                        Text(card.first, color = Color(0xFF25292E),
                            fontSize = 61.sp, lineHeight = 70.sp,
                            fontWeight = FontWeight.Black)
                        Text(card.second, color = Color(0xFF2B3036),
                            fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Text(card.third, color = Color(0xFF666B73),
                            fontSize = 12.sp, lineHeight = 18.sp)
                        Text("BETVIMA VIP", color = Color(0xFF959CA7),
                            fontSize = 10.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
        }
        V192Dots(current, cards.size)
    }
}

@Composable
private fun V192Access(lang: Lang, onPlans: () -> Unit, onSupport: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 11.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(11.dp)) {
        Text(tr(lang, "Choose how to get access\nto the VIP Club",
            "راه‌های دسترسی به\nباشگاه VIP"),
            color = v192Text, fontSize = 22.sp, lineHeight = 26.sp,
            fontWeight = FontWeight.Bold)
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(Brush.linearGradient(listOf(
                Color(0xFF242C3A), Color(0xFF425266), Color(0xFF273346)
            ))).padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(tr(lang, "Migrate your VIP status", "انتقال سطح VIP"),
                color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Text(tr(lang,
                "Ask support whether status from another platform can be reviewed for BetVima.",
                "از پشتیبانی بپرسید آیا سطح VIP پلتفرم دیگر برای بت‌ویما قابل بررسی است."),
                color = Color(0xFFD3DBE6), fontSize = 11.sp, lineHeight = 16.sp)
            Button(onClick = onSupport,
                shape = RoundedCornerShape(11.dp),
                colors=ButtonDefaults.buttonColors(containerColor=Color.White)) {
                Text(tr(lang, "Ask support", "پرسش از پشتیبانی"),
                    color = Color(0xFF252A30), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(Brush.linearGradient(listOf(
                Color(0xFF425166), Color(0xFF8E9DAE), Color(0xFF38495E)
            ))).padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(tr(lang, "Advance through levels", "ارتقا در سطوح VIP"),
                color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Text(tr(lang, "Explore the five published weekly cashback bands.",
                "پنج سطح منتشرشده کش‌بک هفتگی بت‌ویما را بررسی کنید."),
                color = Color.White, fontSize = 11.sp)
            Button(onClick = onPlans,
                shape = RoundedCornerShape(11.dp),
                colors=ButtonDefaults.buttonColors(containerColor=Color.White)) {
                Text(tr(lang, "Learn more", "اطلاعات بیشتر"),
                    color = Color(0xFF252A30), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

private data class V192Faq(val en: String, val fa: String, val answerEn: String, val answerFa: String)
private val v192Faq = listOf(
    V192Faq("How do I get VIP status?", "چطور VIP می‌شوم؟",
        "Review the published BetVima weekly cashback plans. Personal tier eligibility must be confirmed on the server.",
        "پلن‌های کش‌بک هفتگی را بررسی کنید. سطح واقعی هر حساب باید توسط سرور تأیید شود."),
    V192Faq("Can I keep my status from another platform when switching to BetVima?",
        "آیا می‌توان سطح VIP پلتفرم قبلی را منتقل کرد؟",
        "Contact support to ask about any possible status review. Transfer is not automatic or guaranteed.",
        "برای بررسی امکان انتقال به پشتیبانی پیام دهید؛ انتقال خودکار یا تضمینی نیست."),
    V192Faq("Why do I need a personal VIP manager, and how are they different from support?",
        "مدیر VIP چه تفاوتی با پشتیبانی دارد؟",
        "A dedicated manager would provide tailored guidance where this service is available. Contact support for current eligibility.",
        "مدیر اختصاصی در صورت ارائه این خدمت، راهنمایی ویژه ارائه می‌کند. درباره فعال بودن آن با پشتیبانی هماهنگ کنید."),
    V192Faq("What is the concierge service?", "خدمات Concierge چیست؟",
        "The examples above illustrate premium assistance. Availability and terms must be confirmed by BetVima.",
        "نمونه‌های بالا فقط ایده‌های خدمات ویژه هستند. ارائه و شرایط آنها باید توسط بت‌ویما تأیید شود.")
)

@Composable
private fun V192FaqSection(lang: Lang) {
    var expanded by rememberSaveable { mutableIntStateOf(-1) }
    Column(Modifier.fillMaxWidth().padding(horizontal = 11.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(tr(lang, "FAQ", "پرسش‌های متداول"),
            color = v192Text, fontSize = 23.sp, fontWeight = FontWeight.Bold)
        v192Faq.forEachIndexed { i, q ->
            Column(Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0xFF232528))
                .clickable { expanded = if (expanded == i) -1 else i }
                .animateContentSize()
                .padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(tr(lang, q.en, q.fa), modifier = Modifier.weight(1f),
                        color = v192Text, fontSize = 12.sp, lineHeight = 17.sp,
                        fontWeight = FontWeight.Medium)
                    Icon(if (expanded == i) Icons.Default.KeyboardArrowUp
                        else Icons.Default.KeyboardArrowDown, null,
                        tint = v192Mute, modifier = Modifier.size(18.dp))
                }
                if (expanded == i) {
                    Spacer(Modifier.height(9.dp))
                    Text(tr(lang, q.answerEn, q.answerFa),
                        color = v192Mute, fontSize = 11.sp, lineHeight = 18.sp)
                }
            }
        }
    }
}

@Composable
private fun V192Footer(lang: Lang, onSupport: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(13.dp),
        verticalArrangement=Arrangement.spacedBy(13.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("BET", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
            Text("VIMA", color = v192Mint, fontSize = 20.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.weight(1f))
            Text("VIP", color=v192Silver, fontSize=13.sp, fontWeight=FontWeight.Black)
        }
        HorizontalDivider(color=v192Line)
        Text(tr(lang, "Information", "اطلاعات"),
            color=v192Text, fontSize=12.sp, fontWeight=FontWeight.Bold)
        Text(tr(lang, "Categories", "دسته‌بندی‌ها"),
            color=v192Text, fontSize=12.sp, fontWeight=FontWeight.Bold)
        Surface(onClick=onSupport, shape=RoundedCornerShape(13.dp),
            color = v192Panel, border=BorderStroke(1.dp,v192Line)) {
            Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.SupportAgent, null, tint = v192Mint)
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(tr(lang, "Support", "پشتیبانی"), color=v192Text, fontSize=13.sp)
                    Text(tr(lang, "Ask about VIP services and account eligibility",
                        "پرسش درباره خدمات و شرایط حساب VIP"),
                        color=v192Mute, fontSize=10.sp)
                }
            }
        }
        Text(tr(lang,
            "VIP pictures are editorial examples, not confirmed BetVima gifts or services. The published cashback plans remain subject to server verification. Photography via Unsplash.",
            "تصاویر VIP نمونه‌های تبلیغاتی هستند و به معنی اعطای هدیه یا تضمین خدمت از سوی بت‌ویما نیستند. پلن‌های کش‌بک تابع تأیید سرور هستند. تصاویر از Unsplash."),
            color=v192Mute, fontSize=10.sp, lineHeight=15.sp)
    }
}

@Composable
internal fun VipReference192Screen(
    state: AppState, model: AppViewModel, onViewPlans: () -> Unit
) {
    val lang = state.lang
    val onSupport: () -> Unit = { model.feature(Feature.SUPPORT) }
    Box(Modifier.fillMaxSize().background(v192Night)) {
        LazyColumn(
            modifier=Modifier.fillMaxSize(),
            contentPadding=PaddingValues(bottom = 96.dp),
            flingBehavior=rememberPremiumFlingBehavior()
        ) {
            item(key="reference-hero") { V192Hero(lang) }
            item(key="reference-manager") { V192Manager(lang) }
            item(key="reference-concierge") {
                V192ImageSlider(lang, tr(lang,"Concierge service","خدمات ویژه Concierge"),
                    tr(lang,"Enjoy the comfort while we take care of the rest",
                        "آسودگی با خدمات متناسب با شرایط حساب"),
                    v192Concierge, light=true)
            }
            item(key="reference-personal") {
                V192ImageSlider(lang,tr(lang,"A personal approach","رویکرد اختصاصی"),
                    "",v192Personal,light=false)
            }
            item(key="reference-gifts") {
                V192ImageSlider(lang,tr(lang,"Exclusive gifts","هدایای ویژه"),
                    tr(lang,"Premium experiences: illustrative concepts",
                        "تجربه‌های لوکس؛ نمونه‌های تصویری"),
                    v192Gifts,light=false,tall=true)
            }
            item(key="reference-numbers") { V192Numbers(lang) }
            item(key="reference-access") { V192Access(lang,onViewPlans,onSupport) }
            item(key="reference-faq") { V192FaqSection(lang) }
            item(key="reference-footer") { V192Footer(lang,onSupport) }
        }
        Surface(
            modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                .background(Brush.verticalGradient(listOf(
                    Color.Transparent,v192Night.copy(alpha=.95f),v192Night)))
                .padding(horizontal=10.dp,vertical=11.dp),
            color=Color.Transparent
        ) {
            Button(onClick=onSupport,
                modifier=Modifier.fillMaxWidth().height(44.dp),
                shape=RoundedCornerShape(9.dp),
                colors=ButtonDefaults.buttonColors(containerColor=Color.White)) {
                Text(tr(lang,"Migrate your VIP status","بررسی انتقال سطح VIP"),
                    color=Color(0xFF17191B), fontSize=12.sp, fontWeight=FontWeight.Bold)
            }
        }
    }
}
