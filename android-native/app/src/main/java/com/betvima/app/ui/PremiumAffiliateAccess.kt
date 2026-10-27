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

internal val affiliateBlue = Color(0xFF198957)
internal val affiliatePink = Color(0xFF45C98A)
internal val affiliateInk = Color(0xFF0B1610)
internal val affiliateMute = Color(0xFF667C6E)
internal val affiliateCanvas = Color(0xFFF3F7F3)
internal val affiliateOutline = Color(0xFFE1E9E2)

// Affiliate authentication matches the native dark UI; business logic is unchanged.
private val affiliateAuthPanel = Color(0xFF222224)
private val affiliateAuthCanvas = Color(0xFF17181B)
private val affiliateAuthField = Color(0xFF191B1E)
private val affiliateAuthInk = Color(0xFFF5F6F8)
private val affiliateAuthMuted = Color(0xFFADB3BD)
private val affiliateAuthEdge = Color(0xFF41434A)

@Composable
fun AffiliateHeroBanner(lang: Lang, authenticated: Boolean = false) {
    val shape = RoundedCornerShape(25.dp)
    Surface(shape = shape, color = Color.White,
        border = BorderStroke(1.dp, Color(0xFFD9EBDE)),
        shadowElevation = 2.dp) {
        Column(Modifier.fillMaxWidth()
            .background(Brush.linearGradient(listOf(Color.White, Color(0xFFEDF7EE),
                Color(0xFFF2FFF4))),shape)
            .padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(9.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, Color(0xFFD9EADF))) {
                    Row(Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.AutoAwesome,null,tint=affiliatePink,
                            modifier=Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(tr(LocalNativeLanguage176.current, "BETVIMA  PARTNERS", "BETVIMA  PARTNERS"),fontSize=11.sp,
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
                        Brush.linearGradient(listOf(Color(0xFFDEF6E4),Color(0xFFCCF5DA))),
                        CircleShape))
                    Box(Modifier.size(66.dp).background(
                        Brush.linearGradient(listOf(affiliateBlue,Color(0xFF16472A),affiliatePink)),
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
        Text(tr(lang,title,fa),color=affiliateAuthInk,
            fontSize=13.sp,fontWeight=FontWeight.ExtraBold)
    }
}

@Composable
fun AffiliateAccessPanel(lang: Lang, api: ApiClient, vault: SessionVault,
    initialRegister: Boolean = false,
    onAuthenticated: () -> Unit) {
    val scope = rememberCoroutineScope()
    var registering by rememberSaveable(initialRegister) { mutableStateOf(initialRegister) }
    var username by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    // Credentials must not be saved in the Android state bundle.
    var password by remember { mutableStateOf("") }
    var recovering by rememberSaveable { mutableStateOf(false) }
    var payoutAccount by rememberSaveable { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var working by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    if (recovering) {
        PasswordRecoveryPanel(
            lang = lang,
            account = RecoveryAccount.AFFILIATE,
            api = api,
            initialEmail = email,
            onBack = { recovering = false }
        )
        return
    }
    val validEmail = AffiliateInputRules.validEmail(email)
    val validPassword = AffiliateInputRules.validPassword(password)
    val validRegister = AffiliateInputRules.validRegistration(
        email, username, password, payoutAccount
    )
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = affiliateAuthInk,
        unfocusedTextColor = affiliateAuthInk,
        focusedContainerColor = affiliateAuthField,
        unfocusedContainerColor = affiliateAuthField,
        cursorColor = affiliatePink,
        focusedBorderColor = affiliatePink,
        unfocusedBorderColor = affiliateAuthEdge,
        focusedPlaceholderColor = affiliateAuthMuted,
        unfocusedPlaceholderColor = affiliateAuthMuted,
        focusedTrailingIconColor = affiliateAuthInk,
        unfocusedTrailingIconColor = affiliateAuthMuted
    )
    Surface(color=affiliateAuthPanel,shape=RoundedCornerShape(21.dp),
        border=BorderStroke(1.dp,affiliateAuthEdge),shadowElevation=0.dp) {
        Column(Modifier.fillMaxWidth().padding(17.dp),
            verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Text(tr(lang,"Your partner account","حساب اختصاصی همکاری"),
                color=affiliateAuthInk,fontWeight=FontWeight.Black,fontSize=19.sp)
            Text(tr(lang,"Partner credentials are separate from your normal sportsbook login.",
                "ورود به افیلیت مستقل از حساب پیش‌بینی ورزشی است."),
                color=affiliateAuthMuted,fontSize=11.sp,lineHeight=17.sp)
            Row(Modifier.fillMaxWidth().background(affiliateAuthCanvas,
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
                                color=if(active)Color.White else affiliateAuthInk,
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
                    shape=RoundedCornerShape(12.dp), colors=fieldColors)
            }
            AffiliateFormLabel(Icons.Default.AlternateEmail,
                "Registered affiliate email",lang,"ایمیل حساب افیلیت")
            OutlinedTextField(value=email,
                onValueChange={email=it.trim().take(254)},
                singleLine=true,modifier=Modifier.fillMaxWidth(),
                keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email),
                placeholder={Text("partner@example.com")},
                shape=RoundedCornerShape(12.dp), colors=fieldColors)
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
                },shape=RoundedCornerShape(12.dp), colors=fieldColors)
            if(registering) {
                AffiliateFormLabel(Icons.Default.AccountBalanceWallet,
                    "Payout account identifier",lang,"شناسه حساب تسویه")
                OutlinedTextField(value=payoutAccount,
                    onValueChange={payoutAccount=it.take(120)},
                    singleLine=true,modifier=Modifier.fillMaxWidth(),
                    shape=RoundedCornerShape(12.dp), colors=fieldColors)
                Text(tr(lang,
                    "Provide the payout account identifier required by BetVima registration. You can add crypto wallets after sign-in.",
                    "شناسه حساب تسویه موردنیاز ثبت‌نام را وارد کنید. کیف پول‌های رمزارزی بعد از ورود قابل ثبت هستند."),
                    fontSize=10.sp,lineHeight=16.sp,color=affiliateAuthMuted)
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
                                val newPassword=password
                                // Registration is already committed on the server here.
                                // Never repeat the create-user POST to recover a login error.
                                if (pending) {
                                    password=""
                                    registering=false
                                    message=tr(lang,
                                        "Registration submitted. You can sign in after approval.",
                                        "ثبت‌نام انجام شد. پس از تأیید حساب وارد شوید.")
                                } else {
                                    try {
                                        vault.signInAffiliate(email.trim(),newPassword,api)
                                        password=""
                                        onAuthenticated()
                                    } catch(loginError:Exception) {
                                        // Preserve the successful registration. Retry LOGIN only.
                                        password=""
                                        registering=false
                                        message=tr(lang,
                                            "Partner account created. Please sign in with your email and password.",
                                            "حساب افیلیت ساخته شد. لطفاً با ایمیل و رمز عبور وارد شوید.")
                                    }
                                }
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
            if (!registering) {
                TextButton(onClick = { recovering = true; password = "" },
                    modifier = Modifier.align(Alignment.End)) {
                    Icon(Icons.Default.LockReset, null, tint = affiliateBlue,
                        modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(tr(lang, "Forgot Affiliate password?", "فراموشی رمز افیلیت؟"),
                        color = affiliateBlue, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
            Text(tr(lang,
                "For an existing partner username login, use the email registered to that username. Your password is verified by Supabase; the app checks affiliate authorization on the server.",
                "برای حساب همکاری موجود، ایمیل ثبت‌شده با آن نام کاربری را وارد کنید. رمز توسط سیستم احراز هویت بررسی و مجوز افیلیت در سرور تأیید می‌شود."),
                color=affiliateAuthMuted,fontSize=10.sp,lineHeight=16.sp)
        }
    }
}
