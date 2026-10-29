package com.betvima.app.ui

import kotlinx.coroutines.launch
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.money

/**
 * A single, non-scrolling native profile cockpit. No affiliate entry here:
 * partnership has its own entry point elsewhere in the application.
 *
 * Keeping these routes explicit also guards against obsolete menu items
 * quietly coming back in a future visual refactor.
 */
internal enum class ProfileQuickDestination {
    BONUSES, VIP, BET_HISTORY, TRANSACTIONS, SETTINGS, SUPPORT
}
internal fun profileQuickDestinations(): List<ProfileQuickDestination> =
    ProfileQuickDestination.entries.toList()

private object ProfileStyle161 {
    val canvas: Color get() = ThemeTokens.canvas
    val surface: Color get() = ThemeTokens.panel
    val border: Color get() = ThemeTokens.outline
    val text: Color get() = ThemeTokens.ink
    val muted: Color get() = ThemeTokens.muted
    val green=Color(0xFF00D47A)
    val red=Color(0xFFF18C9A)
}

/** Full-height surface, pinned sign out and a 2x3 adaptive tile grid. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReferenceProfileSheet(state: AppState, model: AppViewModel, onClose: () -> Unit) {
    val sheetState=rememberModalBottomSheetState(skipPartiallyExpanded=true)
    val scope=rememberCoroutineScope()
    val closeAnimated: () -> Unit = {
        scope.launch { sheetState.hide(); onClose() }
    }
    fun navigate(destination: ProfileQuickDestination) {
        onClose()
        when(destination) {
            ProfileQuickDestination.BONUSES -> model.feature(Feature.BONUSES)
            ProfileQuickDestination.VIP -> model.feature(Feature.VIP)
            ProfileQuickDestination.BET_HISTORY -> model.tab(Tab.BETS)
            ProfileQuickDestination.TRANSACTIONS -> model.tab(Tab.WALLET)
            ProfileQuickDestination.SETTINGS -> model.feature(Feature.PROFILE)
            ProfileQuickDestination.SUPPORT -> model.feature(Feature.SUPPORT)
        }
    }

    ModalBottomSheet(
        onDismissRequest=closeAnimated,
        modifier=Modifier.fillMaxHeight(),
        containerColor=ProfileStyle161.canvas,
        contentColor=ProfileStyle161.text,
        scrimColor=Color.Black.copy(alpha=.78f),
        dragHandle=null,
        sheetState=sheetState,
        shape=RoundedCornerShape(topStart=23.dp,topEnd=23.dp)
    ) {
        BoxWithConstraints(
            Modifier.fillMaxSize()
                .background(ProfileStyle161.canvas)
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(horizontal=15.dp)
                .padding(bottom=12.dp)
        ) {
            val compressed=maxHeight < 715.dp
            val gap=if(compressed) 7.dp else 12.dp
            Column(Modifier.fillMaxSize()) {
                Row(
                    Modifier.fillMaxWidth().height(if(compressed)43.dp else 49.dp),
                    verticalAlignment=Alignment.CenterVertically
                ) {
                    Text(tr(state.lang,"Profile","پروفایل"),
                        fontWeight=FontWeight.Black,fontSize=23.sp,
                        color=ProfileStyle161.text,modifier=Modifier.weight(1f))
                    Surface(
                        modifier=Modifier.size(36.dp).clickable(onClick=closeAnimated),
                        shape=RoundedCornerShape(12.dp),
                        color=ProfileStyle161.surface,
                        border=BorderStroke(1.dp,ProfileStyle161.border)
                    ) {
                        Box(contentAlignment=Alignment.Center) {
                            Icon(Icons.Default.Close,
                                tr(state.lang,"Close profile","بستن پروفایل"),
                                modifier=Modifier.size(19.dp),
                                tint=ProfileStyle161.text)
                        }
                    }
                }

                Row(
                    Modifier.fillMaxWidth().height(if(compressed)54.dp else 64.dp),
                    verticalAlignment=Alignment.CenterVertically
                ) {
                    Box(
                        Modifier.size(if(compressed)40.dp else 49.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Brush.linearGradient(listOf(
                                Color(0xFF1C5A48),Color(0xFF172D35)))),
                        contentAlignment=Alignment.Center
                    ) {
                        Icon(Icons.Default.Person,null,
                            modifier=Modifier.size(25.dp),
                            tint=Color(0xFFB3F2D5))
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tr(state.lang,"BetVima account","حساب بت‌ویما"),
                            fontSize=16.sp,fontWeight=FontWeight.Black,
                            color=ProfileStyle161.text)
                        Text(tr(state.lang,"Your private account center","مرکز اختصاصی حساب شما"),
                            fontSize=10.sp,color=ProfileStyle161.muted)
                    }
                    Surface(
                        color=Color(0xFF17382B),shape=RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.VerifiedUser,null,
                            modifier=Modifier.padding(8.dp).size(18.dp),
                            tint=Color(0xFF70E8A8))
                    }
                }
                Spacer(Modifier.height(gap))

                // Single integrated wallet feature panel (not a stack of menu rows).
                Box(
                    Modifier.fillMaxWidth().height(if(compressed)126.dp else 144.dp)
                        .clip(RoundedCornerShape(21.dp))
                        .background(Brush.linearGradient(
                            listOf(Color(0xFF1A1C1D),Color(0xFF111314),Color(0xFF1C1D1F))))
                        .border(1.dp,Color(0xFF353739),RoundedCornerShape(21.dp))
                ) {
                    Box(
                        Modifier.align(Alignment.TopEnd).offset(x=36.dp,y=(-52).dp)
                            .size(155.dp).background(
                                Color.White.copy(alpha=.018f),CircleShape))
                    Column(Modifier.fillMaxSize().padding(
                        horizontal=17.dp,vertical=if(compressed)11.dp else 15.dp),
                        verticalArrangement=Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment=Alignment.CenterVertically) {
                            Icon(Icons.Default.AccountBalanceWallet,null,
                                modifier=Modifier.size(18.dp),
                                tint=ProfileStyle161.green)
                            Spacer(Modifier.width(7.dp))
                            Text(tr(state.lang,"AVAILABLE BALANCE","موجودی قابل استفاده"),
                                color=Color(0xFFB8D0C5),
                                fontSize=10.sp,fontWeight=FontWeight.Bold,
                                letterSpacing=.7.sp,modifier=Modifier.weight(1f))
                            Icon(Icons.Default.Shield,null,
                                tint=Color(0xFF71DEA9),
                                modifier=Modifier.size(18.dp))
                        }
                        Text(state.wallet?.let{ money(it.availableMinor,it.currency) }
                                ?: tr(state.lang,"Unavailable","نامشخص"),
                            color=ChromeTokens.ink,
                            fontSize=if(compressed)26.sp else 31.sp,
                            fontWeight=FontWeight.Black,maxLines=1,
                            overflow=TextOverflow.Ellipsis)
                        Row(
                            Modifier.fillMaxWidth()
                                .height(if(compressed)35.dp else 39.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(ProfileStyle161.green)
                                .clickable { onClose();model.tab(Tab.WALLET) }
                                .padding(horizontal=13.dp),
                            verticalAlignment=Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.AccountBalanceWallet,null,
                                modifier=Modifier.size(16.dp),
                                tint=Color(0xFF072218))
                            Spacer(Modifier.width(8.dp))
                            Text(tr(state.lang,"Open wallet","باز کردن کیف‌پول"),
                                color=Color(0xFF072218),
                                fontWeight=FontWeight.Black,fontSize=12.sp,
                                modifier=Modifier.weight(1f))
                            Icon(Icons.Default.ArrowForward,null,
                                modifier=Modifier.size(17.dp),
                                tint=Color(0xFF072218))
                        }
                    }
                }
                Spacer(Modifier.height(gap))
                Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                    Text(tr(state.lang,"Account services","خدمات حساب"),
                        color=ProfileStyle161.text,
                        fontSize=14.sp,fontWeight=FontWeight.Black,
                        modifier=Modifier.weight(1f))
                    Text(tr(state.lang,"6 shortcuts","۶ میانبر"),
                        fontSize=10.sp,color=ProfileStyle161.muted)
                }
                Spacer(Modifier.height(if(compressed)6.dp else 9.dp))

                // Six independent, curved black rows. Each one uses equal
                // remaining height, so the page itself never needs scrolling.
                Column(
                    Modifier.fillMaxWidth().weight(1f),
                    verticalArrangement=Arrangement.spacedBy(8.dp)
                ) {
                    profileQuickDestinations().forEach { destination ->
                        ProfileQuickTile161(
                            destination=destination,
                            lang=state.lang,
                            compact=compressed,
                            tint=ProfileStyle161.text,
                            modifier=Modifier.fillMaxWidth().weight(1f),
                            onClick={navigate(destination)}
                        )
                    }
                }
                Spacer(Modifier.height(gap))
                Surface(
                    modifier=Modifier.fillMaxWidth()
                        .height(if(compressed)43.dp else 48.dp)
                        .clickable { onClose();model.signOut() },
                    shape=RoundedCornerShape(13.dp),
                    color=Color(0xFF18181A),
                    border=BorderStroke(1.dp,Color(0xFF36383A))
                ) {
                    Row(Modifier.fillMaxSize(),verticalAlignment=Alignment.CenterVertically,
                        horizontalArrangement=Arrangement.Center) {
                        Icon(Icons.Default.Logout,null,tint=ChromeTokens.ink,
                            modifier=Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(tr(state.lang,"Sign out","خروج از حساب"),
                            color=ChromeTokens.ink,fontWeight=FontWeight.Bold,
                            fontSize=12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileQuickTile161(
    destination:ProfileQuickDestination,
    lang:Lang,
    compact:Boolean,
    tint:Color,
    modifier:Modifier=Modifier,
    onClick:()->Unit
) {
    val icon:ImageVector=when(destination) {
        ProfileQuickDestination.BONUSES -> Icons.Default.CardGiftcard
        ProfileQuickDestination.VIP -> Icons.Default.EmojiEvents
        ProfileQuickDestination.BET_HISTORY -> Icons.Default.History
        ProfileQuickDestination.TRANSACTIONS -> Icons.Default.ReceiptLong
        ProfileQuickDestination.SETTINGS -> Icons.Default.Settings
        ProfileQuickDestination.SUPPORT -> Icons.Default.SupportAgent
    }
    val name=when(destination) {
        ProfileQuickDestination.BONUSES -> tr(lang,"Bonuses","بونوس‌ها")
        ProfileQuickDestination.VIP -> tr(lang,"VIP Club","باشگاه VIP")
        ProfileQuickDestination.BET_HISTORY -> tr(lang,"Bet history","تاریخچه شرط")
        ProfileQuickDestination.TRANSACTIONS -> tr(lang,"Transactions","تراکنش‌ها")
        ProfileQuickDestination.SETTINGS -> tr(lang,"Settings","تنظیمات")
        ProfileQuickDestination.SUPPORT -> tr(lang,"24/7 Support","پشتیبانی ۲۴/۷")
    }
    val subtitle=when(destination) {
        ProfileQuickDestination.BONUSES -> tr(lang,"Rewards & offers","پاداش‌ها")
        ProfileQuickDestination.VIP -> tr(lang,"Loyalty benefits","مزایای وفاداری")
        ProfileQuickDestination.BET_HISTORY -> tr(lang,"Open & settled","باز و تسویه‌شده")
        ProfileQuickDestination.TRANSACTIONS -> tr(lang,"Account statement","صورتحساب")
        ProfileQuickDestination.SETTINGS -> tr(lang,"Privacy & security","حریم خصوصی و امنیت")
        ProfileQuickDestination.SUPPORT -> tr(lang,"Tickets & replies","تیکت‌ها و پاسخ‌ها")
    }
    Row(
        modifier
            .clip(RoundedCornerShape(24.dp))
            .background(ThemeTokens.panel)
            .border(1.dp,ThemeTokens.outline,RoundedCornerShape(24.dp))
            .clickable(onClick=onClick)
            .padding(horizontal=14.dp,vertical=5.dp),
        verticalAlignment=Alignment.CenterVertically
    ) {
        Box(
            Modifier.size(if(compact)35.dp else 42.dp)
                .clip(RoundedCornerShape(13.dp))
                .background(ThemeTokens.elevated),
            contentAlignment=Alignment.Center
        ) {
            Icon(icon,null,tint=ThemeTokens.ink,
                modifier=Modifier.size(if(compact)19.dp else 22.dp))
        }
        Spacer(Modifier.width(13.dp))
        Column(Modifier.weight(1f),
            verticalArrangement=Arrangement.Center) {
            Text(name,color=ProfileStyle161.text,
                fontSize=if(compact)12.sp else 13.sp,
                fontWeight=FontWeight.Bold,maxLines=1,
                overflow=TextOverflow.Ellipsis)
            Text(subtitle,color=ProfileStyle161.muted,
                fontSize=if(compact)9.sp else 10.sp,
                maxLines=1,overflow=TextOverflow.Ellipsis)
        }
        Icon(Icons.Default.ChevronRight,null,
            tint=Color(0xFF999BA0),modifier=Modifier.size(19.dp))
    }
}
