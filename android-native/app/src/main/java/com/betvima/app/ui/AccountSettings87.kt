
package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import android.text.format.Formatter
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.BuildConfig
import com.betvima.app.data.*
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.launch
import org.json.JSONObject

private val ink87=Color(0xFFF6F7FA)
private val muted87=Color(0xFFB9BEC9)
private val accent87=Color(0xFF00D47A)
private val panel87=Color(0xFF19191C)
private val stroke87=Color(0xFF2C2D30)
private fun label87(lang:Lang,en:String,fa:String)=tr(lang,en,fa)

@Composable
internal fun AccountSettings87(state:AppState,model:AppViewModel) {
    val context=LocalContext.current
    val local=remember { SettingsDevice87(context) }
    val api=remember { ApiClient() }
    val vault=remember { SessionVault(context) }
    val scope=rememberCoroutineScope()
    var profile by remember { mutableStateOf<JSONObject?>(null) }
    var session by remember { mutableStateOf<JSONObject?>(null) }
    var loading by remember { mutableStateOf(false) }
    var fault by remember { mutableStateOf<String?>(null) }
    var modal by remember { mutableStateOf("") }
    var showPassword88 by remember { mutableStateOf(false) }
    var showLock88 by remember { mutableStateOf(false) }
    var showHistory88 by remember { mutableStateOf(false) }
    var showMfa by remember { mutableStateOf(false) }
    var showCacheConfirmation by remember { mutableStateOf(false) }
    var cacheCleaning by remember { mutableStateOf(false) }
    var cacheResult by remember { mutableStateOf<AppCacheCleanupResult?>(null) }
    var cacheError by remember { mutableStateOf<String?>(null) }
    var lockMode88 by remember { mutableStateOf(local.lockMode88()) }

    var langOpen by remember { mutableStateOf(false) }
    var first by remember { mutableStateOf("") }
    var last by remember { mutableStateOf("") }
    var currentPass by remember { mutableStateOf("") }
    var newPass by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var repeatPin by remember { mutableStateOf("") }
    var enabledPin by remember { mutableStateOf(local.hasPin()) }
    var appAlerts by remember { mutableStateOf(local.appAlerts()) }
    var betAlerts by remember { mutableStateOf(local.betAlerts()) }
    var appearance by remember { mutableStateOf(local.theme()) }
    var feedback by remember { mutableStateOf("") }
    suspend fun reload() {
        if(!state.signedIn) return
        loading=true
        try {
            val token=vault.accessToken(api)?:throw IllegalStateException("Sign in required")
            val data=api.get("/api/v1/account/profile",token)
            profile=data.optJSONObject("profile")
            session=data.optJSONObject("session")
            fault=null
        } catch(e:Exception){fault=e.message?:"Account unavailable"}
        finally{loading=false}
    }
    LaunchedEffect(state.signedIn) { reload() }
    val lang=state.lang
    val id=profile?.optLong("numericId",0)?.takeIf{it>0}?.toString()
    val email=session?.str("email",profile?.str("email").orEmpty()).orEmpty()
    val fullName=profile?.str("fullName").orEmpty()
    val name=fullName.ifBlank{profile?.str("username").orEmpty()}.ifBlank{"BetVima Member"}
    val status=profile?.str("status",session?.str("status","unknown")?:"unknown")?:"unknown"
    val phone=profile?.str("phone").orEmpty()
    val phoneVerified=profile?.optBoolean("isPhoneVerified",false)?:false
    val lastLogin=profile?.str("lastLoginAt").orEmpty()
    val bg=Color.Black
    fun open(v:String){
        when(v) {
            "password" -> showPassword88=true
            "pin" -> showLock88=true
            "history" -> showHistory88=true
            "mfa" -> showMfa=true
            else -> modal=v
        }
        feedback="";first="";last="";pin="";repeatPin=""
        currentPass="";newPass="";confirm=""
    }
    if (showPassword88) PasswordDialog88(lang,api,vault,
        onSuccess={
            showPassword88=false
            model.notice(label87(lang,"Password updated successfully","رمز عبور با موفقیت تغییر کرد"))
        },onDismiss={showPassword88=false})
    if (showLock88) AppLockDialog88(lang,local,
        onChanged={
            enabledPin=local.hasPin()
            lockMode88=local.lockMode88()
            model.notice(label87(lang,"Application lock updated","قفل برنامه تغییر کرد"))
        },onDismiss={showLock88=false})
    if (showHistory88) LoginHistoryDialog88(lang,api,vault,
        onDismiss={showHistory88=false})
    if (showMfa) GoogleAuthenticatorDialog(lang, api, vault,
        adminRequired = session?.optBoolean("isAdmin", false) == true,
        onDismiss = { showMfa = false })

    if (showCacheConfirmation) AlertDialog(
        onDismissRequest = { if (!cacheCleaning) showCacheConfirmation = false },
        shape = RoundedCornerShape(24.dp),
        containerColor = panel87,
        title = {
            Text(label87(lang, "Clear temporary cache?", "کش موقت پاک شود؟"),
                color = ink87, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(label87(lang,
                    "Cached images, WebView HTTP files and temporary app files will be removed. They may download again when needed. Your sign-in, wallet, PIN, authenticator, messages and settings will not be erased.",
                    "تصاویر کش‌شده، فایل‌های HTTP وب‌ویو و فایل‌های موقت برنامه حذف می‌شوند و در صورت نیاز دوباره دانلود خواهند شد. ورود حساب، کیف پول، پین، Authenticator، پیام‌ها و تنظیمات حذف نمی‌شوند."),
                    color = muted87, fontSize = 13.sp, lineHeight = 20.sp)
                if (cacheCleaning) {
                    LinearProgressIndicator(Modifier.fillMaxWidth(), color = accent87)
                    Text(label87(lang, "Cleaning temporary files…",
                        "در حال پاک‌سازی فایل‌های موقت…"),
                        color = muted87, fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            TextButton(enabled = !cacheCleaning, onClick = {
                cacheCleaning = true
                scope.launch {
                    try {
                        cacheResult = AppCacheCleaner87.clear(context)
                        cacheError = null
                    } catch (ex: Exception) {
                        cacheError = ex.message ?: "Cache cleanup could not finish"
                        cacheResult = null
                    } finally {
                        cacheCleaning = false
                        showCacheConfirmation = false
                    }
                }
            }) {
                Text(label87(lang, "Clear cache", "پاک‌سازی کش"), color = accent87)
            }
        },
        dismissButton = {
            TextButton(enabled = !cacheCleaning, onClick = {
                showCacheConfirmation = false
            }) { Text(label87(lang, "Cancel", "انصراف"), color = muted87) }
        }
    )

    if (cacheResult != null || cacheError != null) AlertDialog(
        onDismissRequest = { cacheResult = null; cacheError = null },
        shape = RoundedCornerShape(24.dp),
        containerColor = panel87,
        title = {
            Text(
                if (cacheError != null || cacheResult?.complete == false)
                    label87(lang, "Cache partially cleared", "پاک‌سازی ناقص بود")
                else label87(lang, "Cache cleared", "کش پاک‌سازی شد"),
                color = ink87, fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                cacheResult?.let { cleaned ->
                    Text(label87(lang,
                        "Space freed: ${Formatter.formatShortFileSize(context, cleaned.bytesFreed)}",
                        "فضای آزادشده: ${Formatter.formatShortFileSize(context, cleaned.bytesFreed)}"),
                        color = ink87, fontSize = 14.sp)
                    Text(label87(lang,
                        "Temporary files removed: ${cleaned.deletedFiles}",
                        "فایل‌های موقت حذف‌شده: ${cleaned.deletedFiles}"),
                        color = muted87, fontSize = 12.sp)
                    if (!cleaned.complete) Text(label87(lang,
                        "Some cached resources are currently in use or could not be removed. Account data was preserved.",
                        "بعضی از فایل‌های کش در حال استفاده بودند یا پاک نشدند. اطلاعات حساب حفظ شده است."),
                        color = Color(0xFFFFB6AB), fontSize = 12.sp)
                }
                cacheError?.let {
                    Text(label87(lang,
                        "Cache cleanup could not finish. Please retry.",
                        "پاک‌سازی کامل نشد؛ دوباره تلاش کنید."),
                        color = Color(0xFFFFB6AB), fontSize = 12.sp)
                }
                Text(label87(lang, "Your account and settings remain unchanged.",
                    "حساب کاربری و تنظیمات شما تغییر نکرده‌اند."),
                    color = muted87, fontSize = 11.sp)
            }
        },
        confirmButton = {
            TextButton(onClick = { cacheResult = null; cacheError = null }) {
                Text(label87(lang, "Done", "متوجه شدم"), color = accent87)
            }
        }
    )

    if(langOpen)LanguagePickerDialog(lang,{model.setLanguage(it);langOpen=false},{langOpen=false})

    if(modal.isNotBlank()) AlertDialog(
        onDismissRequest={if(!loading)modal=""},
        shape=RoundedCornerShape(25.dp),containerColor=panel87,
        title={Text(when(modal){
            "name"->label87(lang,"Legal name (one-time)","نام و نام خانوادگی (یک‌بار)")
            "phone"->label87(lang,"Phone verification","تأیید شماره")
            "mfa"->"Google Authenticator"
            "password"->label87(lang,"Change password","تغییر رمز عبور")
            "pin"->label87(lang,"6-digit device PIN","پین شش‌رقمی دستگاه")
            "history"->label87(lang,"Login history","سوابق ورود")
            "notification"->label87(lang,"Notification preferences","تنظیمات اعلان")
            "appearance"->label87(lang,"Settings appearance","پس‌زمینه تنظیمات")
            "proxy"->label87(lang,"Proxy configuration","تنظیم پروکسی")
            "qr"->label87(lang,"Share via QR","اشتراک با QR")
            else->label87(lang,"Account information","اطلاعات حساب")
        },color=ink87,fontWeight=FontWeight.Black,fontSize=19.sp)},
        text={Column(verticalArrangement=Arrangement.spacedBy(11.dp)){
            when(modal){
                "name"->{
                    Text(label87(lang,"Legal name can only be submitted once in this screen.",
                        "نام قانونی فقط یک بار از این صفحه ثبت می‌شود."),
                        color=muted87,fontSize=11.sp)
                    Field87(first,{first=it.take(30)},label87(lang,"First name","نام"))
                    Field87(last,{last=it.take(30)},label87(lang,"Last name","نام خانوادگی"))
                }
                "password"->Text(label87(lang,
                    "Password changes require a server-backed authenticated update flow. This server's current reset endpoint does not perform the change. No credentials are collected until a verified flow is available.",
                    "تغییر رمز به مسیر احراز هویت معتبر در سرور نیاز دارد. سرویس فعلی بازیابی رمز، تغییر واقعی انجام نمی‌دهد؛ تا آماده شدن آن، رمز جدیدی دریافت نمی‌شود."),
                    color=muted87,fontSize=12.sp)
                "pin"->{
                    Text(label87(lang,if(enabledPin)"Enter PIN to remove it" else "Set a device-only 6-digit PIN",
                        if(enabledPin)"برای حذف، پین فعلی را وارد کنید" else "پین شش‌رقمی مخصوص این دستگاه بسازید"),
                        color=muted87,fontSize=12.sp)
                    Field87(pin,{pin=it.filter(Char::isDigit).take(6)},"PIN",true,true)
                    if(!enabledPin)Field87(repeatPin,{repeatPin=it.filter(Char::isDigit).take(6)},
                        label87(lang,"Repeat PIN","تکرار پین"),true,true)
                }
                "phone"->Text(if(phoneVerified)label87(lang,"Verified phone: "+phone,"شماره تأییدشده: "+phone)
                    else label87(lang,"SMS verification service is not configured. A number cannot be called verified until a valid one-time code is confirmed by the server.",
                        "سرویس تأیید پیامکی پیکربندی نشده است. بدون دریافت و تأیید کد معتبر، شماره تأییدشده تلقی نمی‌شود."),
                    color=muted87,fontSize=12.sp)
                "mfa"->Text("Authenticator settings",color=muted87,fontSize=12.sp)
                "history"->{
                    Text(label87(lang,"Last server-recorded login","آخرین ورود ثبت‌شده"),
                        color=muted87,fontSize=12.sp)
                    Text(lastLogin.ifBlank{label87(lang,"Not available","نامشخص")},
                        color=ink87,fontWeight=FontWeight.Bold)
                    Text(label87(lang,
                        "The backend does not yet expose a complete per-device login history.",
                        "سرور هنوز تاریخچه کامل ورود همه دستگاه‌ها را ارائه نمی‌کند."),
                        color=muted87,fontSize=11.sp)
                }
                "notification"->{
                    Toggle87(label87(lang,"In-app alerts","اعلان‌های درون برنامه"),appAlerts){
                        appAlerts=it;local.setAppAlerts(it)
                    }
                    Toggle87(label87(lang,"Bet settlement alerts","اعلان تسویه شرط"),betAlerts){
                        betAlerts=it;local.setBetAlerts(it)
                    }
                    Text(label87(lang,
                        "These are device preferences, not a background push subscription. Win/loss/refund events must be emitted by the settlement server; background delivery needs a push service.",
                        "اینها ترجیحات دستگاه هستند، نه اشتراک پوش پس‌زمینه. رویداد برد، باخت و برگشت وجه باید در سرور ثبت شود و اعلان پس‌زمینه نیازمند سرویس پوش است."),
                        color=muted87,fontSize=11.sp)
                }
                "appearance"->{
                    listOf("dark" to label87(lang,"Black","مشکی"),
                        "system" to label87(lang,"Graphite","گرافیتی"),
                        "light" to label87(lang,"Soft charcoal","ذغالی")).forEach{(v,title)->
                        Row(Modifier.fillMaxWidth().clickable{appearance=v;local.setTheme(v)}.padding(7.dp),
                            verticalAlignment=Alignment.CenterVertically){
                            Text(title,modifier=Modifier.weight(1f),color=ink87)
                            RadioButton(selected=appearance==v,onClick={appearance=v;local.setTheme(v)})
                        }
                    }
                    Text(label87(lang,"Changes Settings background; other pages have independent themes.",
                        "پس‌زمینه تنظیمات تغییر می‌کند؛ صفحات دیگر تم مستقل دارند."),
                        color=muted87,fontSize=11.sp)
                }
                "proxy"->Text(label87(lang,
                    "Open Android Wi-Fi settings to configure the operating-system proxy. Financial credentials are not silently routed to an untrusted in-app proxy.",
                    "برای تنظیم پروکسی سیستم به Wi-Fi اندروید بروید. اطلاعات مالی و ورود بدون اطلاع از پروکسی نامطمئن عبور داده نمی‌شوند."),
                    color=muted87,fontSize=12.sp)
                "qr"->{
                    Text(label87(lang,
                        "This QR links to betvima.com. A permanent verified APK download URL is not configured yet.",
                        "این کد به betvima.com می‌رود؛ لینک دائمی معتبر دانلود APK هنوز مشخص نشده است."),
                        color=muted87,fontSize=11.sp)
                    val image=remember{createQr87("https://betvima.com")}
                    if(image!=null)Image(image.asImageBitmap(),"BetVima website QR",
                        Modifier.align(Alignment.CenterHorizontally).size(195.dp))
                }
            }
            if(feedback.isNotBlank())Text(feedback,color=Color(0xFFEAC584),fontSize=12.sp)
        }},
        confirmButton={
            val valid=when(modal){
                "name"->first.trim().length>=2&&last.trim().length>=2&&!loading
                "pin"->pin.length==6&&(enabledPin||pin==repeatPin)&&!loading
                "password"->true
                else->true
            }
            TextButton(enabled=valid,onClick={
                when(modal){
                    "name"->scope.launch {
                        loading=true
                        try{
                            val token=vault.accessToken(api)?:error("Login required")
                            api.patch("/api/v1/account/profile",
                                JSONObject().put("displayName",first.trim()+" "+last.trim()),token)
                            reload();modal=""
                        }catch(e:Exception){feedback=e.message?:"Save failed"}
                        finally{loading=false}
                    }
                    "pin"->{
                        if(enabledPin){
                            if(local.removePin(pin)){enabledPin=false;modal=""}
                            else feedback=label87(lang,"Incorrect PIN","پین نادرست")
                        }else{local.setPin(pin);enabledPin=true;modal=""}
                    }
                    "proxy"->{openProxySettings87(context);modal=""}
                    "qr"->{shareBetvima(context);modal=""}
                    else->modal=""
                }
            }){Text(when(modal){
                "name"->label87(lang,"Save once","ثبت یک‌باره")
                "password"->label87(lang,"Close","بستن")
                "pin"->if(enabledPin)label87(lang,"Remove","حذف") else label87(lang,"Enable","فعال‌سازی")
                "proxy"->label87(lang,"Open settings","بازکردن تنظیمات")
                "qr"->label87(lang,"Share","اشتراک")
                else->label87(lang,"Done","تأیید")
            },color=accent87)}
        },
        dismissButton={TextButton(onClick={modal=""}){Text(label87(lang,"Close","بستن"),color=muted87)}}
    )

    LazyColumn(Modifier.fillMaxSize().background(bg),
        contentPadding=PaddingValues(horizontal=13.dp,vertical=15.dp),
        verticalArrangement=Arrangement.spacedBy(15.dp),flingBehavior=rememberPremiumFlingBehavior()){
        item {
            Box(
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(Brush.linearGradient(listOf(
                        Color(0xFF1C1D20), Color(0xFF171719), Color(0xFF171719))))
                    .border(1.dp, Color(0xFF36383A), RoundedCornerShape(22.dp))
            ) {
                Column(Modifier.fillMaxWidth().padding(19.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(13.dp)) {
                        Box(Modifier.size(49.dp).clip(RoundedCornerShape(15.dp))
                            .background(Brush.linearGradient(listOf(
                                Color(0xFF292A2C), Color(0xFF232426))))
                            .border(1.dp, Color(0xFF3A3C3E), RoundedCornerShape(15.dp)),
                            contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.AdminPanelSettings, null,
                                tint = Color(0xFFF2F3F4), modifier = Modifier.size(27.dp))
                        }
                        Column(Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("BETVIMA / ACCOUNT", color = Color(0xFFB9BEC9),
                                fontSize = 10.sp, fontWeight = FontWeight.Black,
                                letterSpacing = .8.sp)
                            Text(label87(lang,"Settings & Security","تنظیمات و امنیت"),
                                color = ink87, fontWeight = FontWeight.ExtraBold,
                                fontSize = 20.sp, lineHeight = 26.sp)
                        }
                        Icon(Icons.Default.VerifiedUser, null,
                            tint = Color(0xFF7ED8BA), modifier = Modifier.size(19.dp))
                    }
                    HorizontalDivider(color = Color(0xFF34404D))
                    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(name, color = ink87, fontSize = 16.sp,
                            fontWeight = FontWeight.Bold)
                        Text(email.ifBlank{"—"}, color = muted87, fontSize = 12.sp,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Box(Modifier.size(7.dp).clip(RoundedCornerShape(50))
                            .background(if(status=="active")Color(0xFF4ADFB4)
                                else Color(0xFFFFB77C)))
                        Text(label87(lang,"Account status: ","وضعیت حساب: ")+status,
                            color = if(status=="active") Color(0xFF93EAC6)
                                else Color(0xFFFFC99A),
                            fontWeight = FontWeight.Bold, fontSize = 11.sp)
                    }
                }
            }
        }
        if(loading)item{LinearProgressIndicator(Modifier.fillMaxWidth(),color=accent87)}
        if(fault!=null)item{Text(fault.orEmpty(),color=Color(0xFFFFA4A4),fontSize=12.sp)}
        if(!state.signedIn)item{
            LockedFeature(lang,label87(lang,"Sign in to manage settings","برای تنظیمات وارد شوید")){model.showLogin(true)}
        }
        else {
            item{Group87(label87(lang,"ACCOUNT","حساب کاربری")){
                Tile87(Icons.Default.Badge,label87(lang,"Numeric account ID","شناسه عددی"),
                    id?:label87(lang,"Unavailable","ناموجود"),if(id!=null)"copy" else "next"){
                    if(id!=null){copyText87(context,"BetVima ID",id)
                        model.notice(label87(lang,"ID copied","شناسه کپی شد"))}
                }
                Tile87(Icons.Default.Email,label87(lang,"Registered email","ایمیل ثبت‌نام"),email.ifBlank{"—"},"next"){}
                Tile87(Icons.Default.Person,label87(lang,"Legal name","نام و نام خانوادگی"),
                    fullName.ifBlank{label87(lang,"Set once","ثبت یک‌باره")},
                    if(fullName.isBlank())"edit" else "next"){if(fullName.isBlank())open("name")}
                Tile87(Icons.Default.PhoneAndroid,label87(lang,"Phone verification","تأیید شماره"),
                    if(phoneVerified)phone else label87(lang,"Requires SMS provider","نیازمند سرویس پیامک"),"next"){open("phone")}
                Tile87(Icons.Default.Language,label87(lang,"Language","زبان"),
                    when(lang) { Lang.FA -> "🇮🇷 فارسی"; Lang.TR -> "🇹🇷 Türkçe"; Lang.DARI -> "🇦🇫 دری"; Lang.HY -> "🇦🇲 Հայերեն"; Lang.EN -> "🇬🇧 English" },"next"){langOpen=true}
                Tile87(Icons.Default.VerifiedUser,label87(lang,"Account status","وضعیت حساب"),status,"next"){}
            }}
            item{Group87(label87(lang,"SECURITY","امنیت")){
                Tile87(Icons.Default.Security,"Google Authenticator",
                    label87(lang,"Set up or manage 2FA","فعال‌سازی یا مدیریت دومرحله‌ای"),"next"){open("mfa")}
                Tile87(Icons.Default.Key,label87(lang,"Change password","تغییر رمز عبور"),
                    label87(lang,"Verify current password","تأیید رمز فعلی"),"next"){open("password")}
                Tile87(Icons.Default.Pin,label87(lang,"App lock","قفل برنامه"),
                    when(lockMode88) {
                        "pin" -> label87(lang,"6-digit numeric PIN active","پین عددی ۶ رقمی فعال")
                        "pattern" -> label87(lang,"Pattern lock active","قفل الگوی نقطه‌ای فعال")
                        else -> label87(lang,"Choose PIN or pattern","انتخاب پین یا الگو")
                    },"next"){open("pin")}
                Tile87(Icons.Default.History,label87(lang,"Login history","سوابق ورود"),
                    lastLogin.take(19).ifBlank{label87(lang,"Not available","ناموجود")},"next"){open("history")}
                Tile87(Icons.Default.SupportAgent,label87(lang,"Support tickets","تیکت پشتیبانی"),
                    label87(lang,"Open requests & messages","درخواست‌ها و پیام‌ها"),"next"){
                    model.feature(Feature.SUPPORT)
                }
            }}
            item{Group87(label87(lang,"APP & PREFERENCES","برنامه و ترجیحات")){
                Tile87(Icons.Default.NotificationsActive,label87(lang,"Notifications","اعلان‌ها"),
                    label87(lang,"Bet outcomes and app alerts","نتایج شرط و اعلان‌ها"),"next"){open("notification")}
                Tile87(Icons.Default.Palette,label87(lang,"Background","پس‌زمینه"),
                    when(appearance){"dark"->"Black";"light"->"Charcoal";else->"Graphite"},"next"){open("appearance")}
                Tile87(Icons.Default.WifiTethering,label87(lang,"Proxy settings","تنظیمات پروکسی"),
                    label87(lang,"OS network configuration","تنظیمات سیستم"),"next"){open("proxy")}
                Tile87(Icons.Default.Share,label87(lang,"Share BetVima","اشتراک برنامه"),"betvima.com","next"){
                    shareBetvima(context)
                }
                Tile87(Icons.Default.QrCode2,label87(lang,"Share using QR","اشتراک با QR"),
                    label87(lang,"Official website","وب‌سایت رسمی"),"next"){open("qr")}
                Tile87(Icons.Default.Info,label87(lang,"App version","نسخه برنامه"),
                    BuildConfig.VERSION_NAME,"next"){}
                Tile87(Icons.Default.CleaningServices,label87(lang,"Clear cache","پاک‌سازی کش"),
                    label87(lang,"Images, HTTP cache & temporary files","تصاویر، کش HTTP و فایل‌های موقت"),"next"){
                    if (!cacheCleaning) {
                        cacheResult = null
                        cacheError = null
                        showCacheConfirmation = true
                    }
                }
            }}
            item{
                OutlinedButton(onClick={model.signOut()},
                    modifier=Modifier.fillMaxWidth().height(55.dp),
                    border=BorderStroke(1.dp,stroke87),
                    shape=RoundedCornerShape(24.dp)){
                    Icon(Icons.Default.Logout,null,tint=ink87)
                    Spacer(Modifier.width(9.dp))
                    Text(label87(lang,"Sign out","خروج از حساب"),color=ink87,
                        fontWeight=FontWeight.Bold)
                }
            }
            item{Text(label87(lang,
                "Account ID, email, status and last login are server-provided. PIN and appearance are local to this device. SMS OTP, server-enforced MFA and push delivery require backend integration.",
                "آیدی، ایمیل، وضعیت و آخرین ورود از سرور می‌آیند. پین و ظاهر مخصوص این دستگاه‌اند. تأیید پیامکی، ۲مرحله‌ای سرور و پوش‌نوتیفیکیشن به زیرساخت بک‌اند نیاز دارند."),
                color=muted87,fontSize=10.sp,lineHeight=17.sp)}
        }
    }
}
@Composable private fun Field87(value:String,changed:(String)->Unit,label:String,
    secret:Boolean=false,digits:Boolean=false){
    OutlinedTextField(value,changed,modifier=Modifier.fillMaxWidth(),
        singleLine=true,label={Text(label)},
        textStyle=androidx.compose.ui.text.TextStyle(color=ink87),
        visualTransformation=if(secret)PasswordVisualTransformation()
            else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions=KeyboardOptions(keyboardType=if(digits)KeyboardType.NumberPassword
            else if(secret)KeyboardType.Password else KeyboardType.Text),
        colors=OutlinedTextFieldDefaults.colors(focusedBorderColor=accent87,
            unfocusedBorderColor=Color(0xFF535761),focusedLabelColor=accent87,
            unfocusedLabelColor=muted87))
}
@Composable private fun Toggle87(label:String,value:Boolean,onChange:(Boolean)->Unit){
    Row(verticalAlignment=Alignment.CenterVertically){
        Text(label,modifier=Modifier.weight(1f),color=ink87,fontSize=12.sp)
        Switch(value,onChange)
    }
}
@Composable private fun Group87(title:String,content:@Composable ColumnScope.()->Unit){
    Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
        Text(title,modifier=Modifier.padding(start=10.dp,bottom=3.dp),
            color=Color(0xFFBCBEC2),fontWeight=FontWeight.Black,
            fontSize=11.sp,letterSpacing=.5.sp)
        Column(Modifier.fillMaxWidth(),
            verticalArrangement=Arrangement.spacedBy(8.dp),content=content)
    }
}

@Composable private fun Tile87(icon:ImageVector,title:String,subtitle:String,
    suffix:String,onClick:()->Unit){
    val shape=RoundedCornerShape(24.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(panel87)
            .border(1.dp,stroke87,shape).clickable(onClick=onClick)
            .heightIn(min=73.dp).padding(horizontal=14.dp,vertical=9.dp),
        verticalAlignment=Alignment.CenterVertically
    ) {
        Box(Modifier.size(41.dp).clip(RoundedCornerShape(13.dp))
            .background(Color(0xFF29292C)),
            contentAlignment=Alignment.Center){
            Icon(icon,null,tint=Color(0xFFE8E9EA),modifier=Modifier.size(21.dp))
        }
        Spacer(Modifier.width(13.dp))
        Column(Modifier.weight(1f),
            verticalArrangement=Arrangement.spacedBy(3.dp)){
            Text(title,color=ink87,fontSize=13.sp,fontWeight=FontWeight.Bold,
                maxLines=2,overflow=TextOverflow.Ellipsis)
            Text(subtitle,color=muted87,fontSize=10.sp,maxLines=2,
                overflow=TextOverflow.Ellipsis)
        }
        Icon(if(suffix=="copy") Icons.Default.ContentCopy
            else if(suffix=="edit") Icons.Default.Edit
            else Icons.Default.ChevronRight,
            null,tint=Color(0xFF999BA0),modifier=Modifier.size(20.dp))
    }
}
private fun createQr87(link:String):android.graphics.Bitmap?=runCatching{
    val matrix=QRCodeWriter().encode(link,BarcodeFormat.QR_CODE,400,400)
    val pixels=IntArray(160000)
    for(y in 0 until 400)for(x in 0 until 400)
        pixels[y*400+x]=if(matrix[x,y])android.graphics.Color.BLACK
            else android.graphics.Color.WHITE
    android.graphics.Bitmap.createBitmap(pixels,400,400,android.graphics.Bitmap.Config.ARGB_8888)
}.getOrNull()
