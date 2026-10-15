package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import kotlinx.coroutines.launch
import org.json.JSONObject

internal val affiliateBlue = Color(0xFF117DF2)
internal val affiliatePink = Color(0xFFF3439B)
internal val affiliateInk = Color(0xFF151C2A)
internal val affiliateMute = Color(0xFF64738B)
internal val affiliateCanvas = Color(0xFFF5F7FB)
internal val affiliateOutline = Color(0xFFE5EAF3)

@Composable
fun AffiliateHeroBanner(lang: Lang, authenticated: Boolean = false) {
    val shape = RoundedCornerShape(25.dp)
    Surface(shape = shape, color = Color.White,
        border = BorderStroke(1.dp, Color(0xFFD9E8FB)),
        shadowElevation = 2.dp) {
        Column(Modifier.fillMaxWidth()
            .background(Brush.linearGradient(listOf(Color.White, Color(0xFFF0F7FF),
                Color(0xFFFFF2F9))),shape)
            .padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(9.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, Color(0xFFD9E6FF))) {
                    Row(Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.AutoAwesome,null,tint=affiliatePink,
                            modifier=Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("BETVIMA  PARTNERS",fontSize=11.sp,
                            fontWeight=FontWeight.Black,color=affiliateInk)
                    }
                }
                Spacer(Modifier.weight(1f))
                Icon(Icons.Default.Verified, null, tint=affiliateBlue,
                    modifier=Modifier.size(22.dp))
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(7.dp)) {
                    Text(tr(lang,"Affiliate Studio","استودیو همکاری"),
                        color=affiliateInk,fontSize=27.sp,
                        fontWeight=FontWeight.Black,lineHeight=31.sp)
                    Text(tr(lang,"A smarter way to grow together",
                            "مدیریت حرفه‌ای همکاری در بت‌ویما"),
                        color=affiliateBlue,fontSize=12.sp,fontWeight=FontWeight.Bold)
                    Text(tr(lang,
                        "Track your verified traffic, share campaigns, follow commission and manage payouts in one place.",
                        "آمار بازدید، کمپین‌ها، کمیسیون و درخواست‌های برداشت را یکجا و با اطلاعات واقعی حساب مدیریت کنید."),
                        color=affiliateMute,fontSize=11.sp,lineHeight=18.sp)
                }
                Box(Modifier.size(94.dp),contentAlignment=Alignment.Center) {
                    Box(Modifier.size(90.dp).background(
                        Brush.linearGradient(listOf(Color(0xFFE0F0FF),Color(0xFFFFE1F0))),
                        CircleShape))
                    Box(Modifier.size(66.dp).background(
                        Brush.linearGradient(listOf(affiliateBlue,Color(0xFF8863E8),affiliatePink)),
                        RoundedCornerShape(21.dp)),contentAlignment=Alignment.Center) {
                        Icon(Icons.Default.Hub,null,tint=Color.White,
                            modifier=Modifier.size(43.dp))
                    }
                    Icon(Icons.Default.Star,null,tint=affiliatePink,
                        modifier=Modifier.align(Alignment.TopEnd).size(15.dp))
                }
            }
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple(Icons.Default.Link, "Links", "لینک‌ها"),
                    Triple(Icons.Default.Groups, "Referrals", "زیرمجموعه‌ها"),
                    Triple(Icons.Default.Payments, "Payouts", "برداشت‌ها")
                ).forEachIndexed { i, item ->
                    Surface(modifier=Modifier.weight(1f),color=Color.White,
                        shape=RoundedCornerShape(12.dp),
                        border=BorderStroke(1.dp,affiliateOutline)) {
                        Row(Modifier.padding(horizontal=7.dp,vertical=10.dp),
                            horizontalArrangement=Arrangement.Center,
                            verticalAlignment=Alignment.CenterVertically) {
                            Icon(item.first,null,
                                tint=if(i==1)affiliatePink else affiliateBlue,
                                modifier=Modifier.size(15.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(tr(lang,item.second,item.third),
                                color=affiliateInk,fontWeight=FontWeight.Bold,
                                fontSize=10.sp,maxLines=1)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AffiliateFormLabel(icon: ImageVector, title: String, lang: Lang, fa: String) {
    Row(verticalAlignment=Alignment.CenterVertically) {
        Icon(icon, null, tint=affiliateBlue, modifier=Modifier.size(18.dp))
        Spacer(Modifier.width(7.dp))
        Text(tr(lang,title,fa),color=affiliateInk,
            fontSize=13.sp,fontWeight=FontWeight.ExtraBold)
    }
}

@Composable
fun AffiliateAccessPanel(lang: Lang, api: ApiClient, vault: SessionVault,
    onAuthenticated: () -> Unit) {
    val scope = rememberCoroutineScope()
    var registering by rememberSaveable { mutableStateOf(false) }
    var username by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var payoutAccount by rememberSaveable { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var working by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    val validEmail = AffiliateInputRules.validEmail(email)
    val validPassword = AffiliateInputRules.validPassword(password)
    val validRegister = AffiliateInputRules.validRegistration(
        email, username, password, payoutAccount
    )
    Surface(color=Color.White,shape=RoundedCornerShape(24.dp),
        border=BorderStroke(1.dp,affiliateOutline),shadowElevation=2.dp) {
        Column(Modifier.fillMaxWidth().padding(17.dp),
            verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Text(tr(lang,"Your partner account","حساب اختصاصی همکاری"),
                color=affiliateInk,fontWeight=FontWeight.Black,fontSize=19.sp)
            Text(tr(lang,"Partner credentials are separate from your normal sportsbook login.",
                "ورود به افیلیت مستقل از حساب پیش‌بینی ورزشی است."),
                color=affiliateMute,fontSize=11.sp,lineHeight=17.sp)
            Row(Modifier.fillMaxWidth().background(affiliateCanvas,
                RoundedCornerShape(13.dp)).padding(4.dp)) {
                listOf(false,true).forEach { register ->
                    val active = registering == register
                    Surface(modifier=Modifier.weight(1f)
                        .clickable { if(!working) { registering=register;error=null;message=null } },
                        color=if(active) affiliateBlue else Color.Transparent,
                        shape=RoundedCornerShape(10.dp)) {
                        Box(Modifier.padding(vertical=11.dp),contentAlignment=Alignment.Center) {
                            Text(if(register) tr(lang,"Register","ثبت‌نام")
                                else tr(lang,"Sign in","ورود"),
                                color=if(active)Color.White else affiliateInk,
                                fontWeight=FontWeight.Black,fontSize=12.sp)
                        }
                    }
                }
            }
            if(registering) {
                AffiliateFormLabel(Icons.Default.Badge,"Partner username",lang,"نام کاربری همکار")
                OutlinedTextField(value=username,
                    onValueChange={ username=it.lowercase().take(32) },
                    placeholder={Text("partner_name")},
                    singleLine=true,modifier=Modifier.fillMaxWidth(),
                    shape=RoundedCornerShape(12.dp))
            }
            AffiliateFormLabel(Icons.Default.AlternateEmail,
                "Registered affiliate email",lang,"ایمیل حساب افیلیت")
            OutlinedTextField(value=email,
                onValueChange={email=it.trim().take(254)},
                singleLine=true,modifier=Modifier.fillMaxWidth(),
                keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email),
                placeholder={Text("partner@example.com")},
                shape=RoundedCornerShape(12.dp))
            AffiliateFormLabel(Icons.Default.Lock,"Password",lang,"رمز عبور")
            OutlinedTextField(value=password,
                onValueChange={password=it.take(128)},
                singleLine=true,modifier=Modifier.fillMaxWidth(),
                visualTransformation=if(showPassword)VisualTransformation.None
                    else PasswordVisualTransformation(),
                keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Password),
                trailingIcon={
                    IconButton(onClick={showPassword=!showPassword}) {
                        Icon(if(showPassword) Icons.Default.VisibilityOff
                            else Icons.Default.Visibility,null)
                    }
                },shape=RoundedCornerShape(12.dp))
            if(registering) {
                AffiliateFormLabel(Icons.Default.AccountBalanceWallet,
                    "Payout account identifier",lang,"شناسه حساب تسویه")
                OutlinedTextField(value=payoutAccount,
                    onValueChange={payoutAccount=it.take(120)},
                    singleLine=true,modifier=Modifier.fillMaxWidth(),
                    shape=RoundedCornerShape(12.dp))
                Text(tr(lang,
                    "Provide the payout account identifier required by BetVima registration. You can add crypto wallets after sign-in.",
                    "شناسه حساب تسویه موردنیاز ثبت‌نام را وارد کنید. کیف پول‌های رمزارزی بعد از ورود قابل ثبت هستند."),
                    fontSize=10.sp,lineHeight=16.sp,color=affiliateMute)
            }
            if(error!=null) BvInformationStrip(error.orEmpty(),
                Icons.Default.ErrorOutline,accent=Color(0xFFE54068))
            if(message!=null) BvInformationStrip(message.orEmpty(),
                Icons.Default.CheckCircle,accent=Color(0xFF168C78))
            Button(
                enabled=!working && (if(registering)validRegister else validEmail&&validPassword),
                onClick={
                    scope.launch {
                        working=true;error=null;message=null
                        try {
                            if(registering) {
                                val result=api.registerAffiliate(JSONObject()
                                    .put("email",email.trim())
                                    .put("username",username.trim().lowercase())
                                    .put("password",password)
                                    .put("payoutAccountId",payoutAccount.trim()))
                                val pending=result.optBoolean("pendingApproval",false)
                                password=""
                                registering=false
                                message=tr(lang,
                                    if(pending)"Registration submitted. Sign in once approved."
                                    else "Account created. Sign in with your partner email.",
                                    if(pending)"ثبت‌نام انجام شد. پس از تأیید وارد شوید."
                                    else "حساب ساخته شد. با ایمیل افیلیت وارد شوید.")
                            } else {
                                vault.signInAffiliate(email.trim(),password,api)
                                password=""
                                onAuthenticated()
                            }
                        } catch(ex:Exception) {
                            error=ex.message ?: tr(lang,
                                "Partner authentication failed","احراز هویت افیلیت انجام نشد")
                        } finally { working=false }
                    }
                },
                modifier=Modifier.fillMaxWidth().height(52.dp),
                shape=RoundedCornerShape(14.dp),
                colors=ButtonDefaults.buttonColors(containerColor=affiliateBlue)
            ) {
                if(working) CircularProgressIndicator(Modifier.size(19.dp),
                    color=Color.White,strokeWidth=2.dp)
                else {
                    Icon(if(registering) Icons.Default.PersonAdd
                        else Icons.Default.Login,null,modifier=Modifier.size(19.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(if(registering)tr(lang,"Create partner account","ساخت حساب همکاری")
                        else tr(lang,"Open partner dashboard","ورود به پنل همکاری"),
                        fontWeight=FontWeight.Black,fontSize=13.sp)
                }
            }
            Text(tr(lang,
                "For an existing partner username login, use the email registered to that username. Your password is verified by Supabase; the app checks affiliate authorization on the server.",
                "برای حساب همکاری موجود، ایمیل ثبت‌شده با آن نام کاربری را وارد کنید. رمز توسط سیستم احراز هویت بررسی و مجوز افیلیت در سرور تأیید می‌شود."),
                color=affiliateMute,fontSize=10.sp,lineHeight=16.sp)
        }
    }
}
