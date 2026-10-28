package com.cfcoin.exchange

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val navy = Color(0xFF080D16)
private val raised = Color(0xFF111B2B)
private val blue = Color(0xFF2184FF)
private val pale = Color(0xFF7CBDFF)
private val white = Color(0xFFF3F7FD)
private val gray = Color(0xFF8C9CAF)
private val border = Color(0xFF26374D)
private val green = Color(0xFF21C998)
private val danger = Color(0xFFED5A72)

data class LocalAccount(val displayName: String, val mobile: String)
enum class AuthScreen { LOGIN, REGISTER }
enum class HistoryFilter { ALL, DEPOSITS, WITHDRAWALS }

@Composable
fun AccountCenter(
    account: LocalAccount?,
    onBack: () -> Unit,
    onSignInDemo: (LocalAccount) -> Unit,
    onLogout: () -> Unit,
    onSupport: () -> Unit
) {
    var screen by rememberSaveable { mutableStateOf(AuthScreen.LOGIN) }
    var mobile by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var fullName by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    var accepted by rememberSaveable { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    BackHandler { onBack() }

    Column(
        Modifier.fillMaxSize().background(navy).verticalScroll(rememberScrollState())
            .padding(horizontal = 19.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp)
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack, modifier = Modifier.size(38.dp)) {
                Icon(Icons.Default.ArrowForward, "بازگشت", tint = white)
            }
            Spacer(Modifier.width(7.dp))
            Text(if (account == null) "حساب کاربری CFCoin" else "پروفایل من", color = white, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.weight(1f))
            Box(
                Modifier.background(blue.copy(alpha = 0.16f), RoundedCornerShape(9.dp))
                    .padding(horizontal = 9.dp, vertical = 5.dp)
            ) { Text("DEMO", color = pale, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
        }
        if (account == null) {
            Column(Modifier.fillMaxWidth().padding(vertical = 13.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    Modifier.size(78.dp)
                        .background(Brush.linearGradient(listOf(Color(0xFF0B54B5), blue, Color(0xFF39C8FC))), RoundedCornerShape(25.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("CF", color = white, fontSize = 29.sp, fontWeight = FontWeight.Black)
                }
                Spacer(Modifier.height(13.dp))
                Text(if (screen == AuthScreen.LOGIN) "ورود به CFCoin" else "ایجاد حساب CFCoin", color = white, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                Text("نمایش آزمایشی، بدون ساخت حساب واقعی یا ارسال اطلاعات", color = gray, fontSize = 11.sp)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                ProfileToggle("ورود", screen == AuthScreen.LOGIN, Modifier.weight(1f)) { screen = AuthScreen.LOGIN; error = "" }
                ProfileToggle("ثبت نام", screen == AuthScreen.REGISTER, Modifier.weight(1f)) { screen = AuthScreen.REGISTER; error = "" }
            }
            if (screen == AuthScreen.REGISTER) {
                ProfileInput("نام و نام خانوادگی", fullName, { fullName = it.take(70) }, Icons.Default.PersonOutline)
            }
            ProfileInput("شماره موبایل ایران", mobile, { mobile = it.filter { c -> c.isDigit() }.take(11) }, Icons.Default.Phone)
            ProfileInput(
                "رمز عبور آزمایشی (حداقل ۸ کاراکتر)", password, { password = it.take(80) },
                Icons.Default.Lock, secret = !showPassword
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = showPassword, onCheckedChange = { showPassword = it }, colors = CheckboxDefaults.colors(checkedColor = blue))
                Text("نمایش رمز عبور", color = gray, fontSize = 12.sp)
            }
            if (screen == AuthScreen.REGISTER) {
                ProfileInput("تکرار رمز عبور", confirm, { confirm = it.take(80) }, Icons.Default.Lock, secret = !showPassword)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = accepted, onCheckedChange = { accepted = it }, colors = CheckboxDefaults.colors(checkedColor = blue))
                    Text("شرایط نسخه آزمایشی را می‌پذیرم", color = gray, fontSize = 12.sp)
                }
            }
            if (error.isNotBlank()) Text(error, color = danger, fontSize = 12.sp)
            Button(
                onClick = {
                    error = when {
                        !mobile.matches(Regex("^09[0-9]{9}$")) -> "شماره موبایل معتبر ایران وارد کنید."
                        password.length < 8 -> "رمز عبور باید دست‌کم ۸ کاراکتر باشد."
                        screen == AuthScreen.REGISTER && fullName.trim().length < 3 -> "نام و نام خانوادگی را کامل وارد کنید."
                        screen == AuthScreen.REGISTER && confirm != password -> "تکرار رمز عبور یکسان نیست."
                        screen == AuthScreen.REGISTER && !accepted -> "پذیرش شرایط نسخه آزمایشی لازم است."
                        else -> ""
                    }
                    if (error.isEmpty()) {
                        onSignInDemo(LocalAccount(if (fullName.isBlank()) "کاربر CFCoin" else fullName.trim(), mobile))
                        password = ""
                        confirm = ""
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = blue),
                shape = RoundedCornerShape(13.dp),
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                Text(if (screen == AuthScreen.LOGIN) "ورود به حساب آزمایشی" else "ثبت نام آزمایشی", color = white, fontWeight = FontWeight.Bold)
            }
            Text(
                "این فرم نمایشی است و هیچ حساب واقعی، تأیید شماره موبایل یا احراز هویت ایجاد نمی‌کند. از رمز واقعی خود استفاده نکنید.",
                color = gray, fontSize = 11.sp, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        } else {
            AccountAvatar(account)
            SectionHeading("تحلیل حساب")
            FundsGraph()
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SummaryCard("کل واریز", "0.00", "USDT", green, Modifier.weight(1f))
                SummaryCard("کل برداشت", "0.00", "USDT", danger, Modifier.weight(1f))
            }
            SectionHeading("سوابق تراکنش‌ها")
            TransactionsSection()
            SectionHeading("تنظیمات و خدمات")
            listOf(
                Triple("اطلاعات کاربری", "ویرایش اطلاعات حساب آزمایشی", Icons.Default.PersonOutline),
                Triple("امنیت حساب", "رمز عبور، ورود دومرحله‌ای و دستگاه‌ها", Icons.Default.Security),
                Triple("احراز هویت", "اتصال سرویس KYC در نسخه بعدی", Icons.Default.VerifiedUser),
                Triple("اعلان‌ها", "تنظیم اعلان‌های سفارش و امنیت", Icons.Default.NotificationsNone),
                Triple("پشتیبانی", "گفت‌وگو و راهنمای خدمات", Icons.Default.HeadsetMic)
            ).forEach { (name, description, icon) ->
                Surface(
                    color = raised, shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().clickable { if (name == "پشتیبانی") onSupport() }
                ) {
                    Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(icon, null, tint = pale)
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(name, color = white, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Text(description, color = gray, fontSize = 11.sp)
                        }
                        Spacer(Modifier.weight(1f))
                        Icon(Icons.Default.ChevronLeft, null, tint = gray)
                    }
                }
            }
            OutlinedButton(
                onClick = onLogout, modifier = Modifier.fillMaxWidth().height(48.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, danger.copy(alpha = 0.7f)),
                shape = RoundedCornerShape(13.dp)
            ) {
                Icon(Icons.Default.Logout, null, tint = danger)
                Spacer(Modifier.width(9.dp))
                Text("خروج از حساب آزمایشی", color = danger, fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.height(12.dp))
        CFCoinLegalFooter()
    }
}

@Composable
private fun AccountAvatar(account: LocalAccount) {
    Surface(color = raised, shape = RoundedCornerShape(19.dp)) {
        Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(62.dp).background(blue.copy(alpha = 0.16f), CircleShape),
                contentAlignment = Alignment.Center
            ) { Icon(Icons.Default.Person, null, tint = pale, modifier = Modifier.size(32.dp)) }
            Spacer(Modifier.width(13.dp))
            Column {
                Text(account.displayName, color = white, fontWeight = FontWeight.ExtraBold, fontSize = 19.sp)
                Text(account.mobile, color = gray, fontSize = 12.sp)
                Spacer(Modifier.height(5.dp))
                Text("حساب آزمایشی · سطح مهمان", color = pale, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun ProfileInput(name: String, value: String, change: (String) -> Unit, icon: androidx.compose.ui.graphics.vector.ImageVector, secret: Boolean = false) {
    OutlinedTextField(
        value = value, onValueChange = change,
        label = { Text(name, fontSize = 12.sp) },
        leadingIcon = { Icon(icon, null, tint = pale, modifier = Modifier.size(19.dp)) },
        visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None,
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(13.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = blue, unfocusedBorderColor = border,
            focusedTextColor = white, unfocusedTextColor = white,
            focusedLabelColor = pale, unfocusedLabelColor = gray
        )
    )
}

@Composable
private fun ProfileToggle(name: String, active: Boolean, modifier: Modifier, click: () -> Unit) {
    Box(
        modifier.background(if (active) blue.copy(alpha = 0.18f) else raised, RoundedCornerShape(12.dp))
            .border(1.dp, if (active) blue else border, RoundedCornerShape(12.dp))
            .clip(RoundedCornerShape(12.dp)).clickable { click() }.padding(13.dp),
        contentAlignment = Alignment.Center
    ) { Text(name, color = if (active) pale else gray, fontWeight = FontWeight.Bold) }
}

@Composable
private fun SectionHeading(title: String) {
    Text(title, color = white, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
}

@Composable
fun FundsGraph() {
    var period by rememberSaveable { mutableStateOf("۳۰ روز") }
    val deposits = listOf(6, 11, 9, 13, 7, 16, 11, 18, 12, 16, 20, 14)
    val withdraws = listOf(3, 5, 4, 6, 5, 8, 5, 6, 10, 7, 10, 9)
    Surface(color = raised, shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("نمودار واریز و برداشت", color = white, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Spacer(Modifier.weight(1f))
                listOf("۷ روز", "۳۰ روز").forEach { value ->
                    Box(Modifier.clip(RoundedCornerShape(8.dp))
                        .background(if (period == value) blue.copy(alpha = 0.18f) else Color.Transparent)
                        .clickable { period = value }.padding(horizontal = 7.dp, vertical = 5.dp)) {
                        Text(value, color = if (period == value) pale else gray, fontSize = 10.sp)
                    }
                }
            }
            Canvas(Modifier.fillMaxWidth().height(155.dp)) {
                for (i in 1..4) {
                    val y = size.height * i / 5
                    drawLine(border, Offset(0f, y), Offset(size.width, y), 1.dp.toPx())
                }
                val points = if (period == "۷ روز") 7 else 12
                val w = size.width / points
                for (i in 0 until points) {
                    val first = deposits[i] / 22f
                    val second = withdraws[i] / 22f
                    val x = i * w + w * 0.12f
                    drawRoundRect(
                        blue, topLeft = Offset(x, size.height * (1f - first)),
                        size = Size(w * 0.29f, size.height * first),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(4.dp.toPx())
                    )
                    drawRoundRect(
                        danger, topLeft = Offset(x + w * 0.34f, size.height * (1f - second)),
                        size = Size(w * 0.29f, size.height * second),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(4.dp.toPx())
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                LegendDot("واریز (نمونه)", blue)
                LegendDot("برداشت (نمونه)", danger)
            }
            Text("این نمودار صرفاً برای نمایش طراحی است؛ مقادیر واقعی کاربر صفر هستند.", color = gray, fontSize = 11.sp)
        }
    }
}

@Composable
private fun LegendDot(name: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(7.dp).background(color, CircleShape))
        Spacer(Modifier.width(5.dp))
        Text(name, color = gray, fontSize = 11.sp)
    }
}

@Composable
private fun SummaryCard(title: String, value: String, currency: String, tint: Color, modifier: Modifier) {
    Surface(color = raised, shape = RoundedCornerShape(14.dp), modifier = modifier) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(title, color = gray, fontSize = 12.sp)
            Text(value, color = tint, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text(currency, color = gray, fontSize = 11.sp)
        }
    }
}

@Composable
fun TransactionsSection() {
    var filter by rememberSaveable { mutableStateOf(HistoryFilter.ALL) }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                HistoryFilter.ALL to "همه تراکنش‌ها",
                HistoryFilter.DEPOSITS to "واریز",
                HistoryFilter.WITHDRAWALS to "برداشت"
            ).forEach { (key, name) ->
                Box(
                    Modifier.clip(RoundedCornerShape(9.dp))
                        .background(if (filter == key) blue.copy(alpha = 0.15f) else raised)
                        .border(1.dp, if (filter == key) blue else border, RoundedCornerShape(9.dp))
                        .clickable { filter = key }.padding(horizontal = 13.dp, vertical = 10.dp)
                ) { Text(name, color = if (filter == key) pale else gray, fontSize = 12.sp) }
            }
        }
        Surface(color = raised, shape = RoundedCornerShape(16.dp)) {
            Column(
                Modifier.fillMaxWidth().padding(vertical = 27.dp, horizontal = 13.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Icon(Icons.Default.ReceiptLong, null, tint = pale, modifier = Modifier.size(32.dp))
                Text(
                    when (filter) {
                        HistoryFilter.ALL -> "هنوز تراکنشی ثبت نشده است"
                        HistoryFilter.DEPOSITS -> "سابقه واریزی وجود ندارد"
                        HistoryFilter.WITHDRAWALS -> "سابقه برداشتی وجود ندارد"
                    }, color = white, fontWeight = FontWeight.SemiBold, fontSize = 13.sp
                )
                Text("بعد از اتصال حساب مستقل CFCoin، اطلاعات واقعی اینجا نمایش داده می‌شود.", color = gray, fontSize = 11.sp, textAlign = TextAlign.Center)
            }
        }
    }
}

@Composable
fun CFCoinLegalFooter() {
    Column(Modifier.fillMaxWidth().padding(top = 13.dp, bottom = 14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        HorizontalDivider(color = border)
        Spacer(Modifier.height(13.dp))
        Text("CFCoin  •  Digital Asset Exchange", color = pale, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        Spacer(Modifier.height(5.dp))
        Text("نسخه آزمایشی 0.3  •  بدون خدمات مالی واقعی", color = gray, fontSize = 10.sp)
    }
}
