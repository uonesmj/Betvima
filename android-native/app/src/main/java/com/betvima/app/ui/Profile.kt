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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * User-managed profile; shown only for an authenticated account. No local
 * imitation of user identity, wallet or authorization roles.
 */
@Composable
fun ProfilePage(state: AppState, model: AppViewModel) {
    val context = LocalContext.current
    val api = remember { ApiClient() }
    val vault = remember { SessionVault(context) }
    val scope = rememberCoroutineScope()
    var profile by remember { mutableStateOf<JSONObject?>(null) }
    var session by remember { mutableStateOf<JSONObject?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var editing by remember { mutableStateOf(false) }

    suspend fun reload() {
        loading = true
        try {
            val token = vault.accessToken(api) ?: throw IllegalStateException("Please sign in")
            val data = api.get("/api/v1/account/profile", token)
            profile = data.optJSONObject("profile")
            session = data.optJSONObject("session")
            name = profile?.str("username", profile?.str("displayName") ?: "") ?: ""
            phone = profile?.str("phone") ?: ""
            error = null
        } catch (ex: Exception) {
            profile = null
            error = ex.message ?: "Account unavailable"
        } finally { loading = false }
    }
    LaunchedEffect(state.signedIn) { if (state.signedIn) reload() }
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp)
    ) {
        item {
            BvPageBanner(
                eyebrow = tr(state.lang, "ACCOUNT CENTER", "مرکز حساب کاربری"),
                title = tr(state.lang, "Your BetVima profile", "پروفایل اختصاصی شما"),
                subtitle = tr(state.lang,
                    "Manage your profile and view your account status securely.",
                    "اطلاعات شخصی و وضعیت حساب خود را با امنیت کامل بررسی کنید."),
                icon = Icons.Default.VerifiedUser,
                accent = Palette.green
            )
        }
        item {
            SectionHeading(
                tr(state.lang, "Your profile", "پروفایل کاربری"),
                tr(state.lang, "Private account details", "اطلاعات خصوصی حساب")
            )
        }
        if (!state.signedIn) {
            item {
                LockedFeature(state.lang,
                    tr(state.lang, "Sign in to manage your profile",
                        "برای مدیریت پروفایل وارد شوید")) { model.showLogin(true) }
            }
        } else {
            if (loading) item {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = Palette.green)
            }
            if (error != null) item {
                Text(error.orEmpty(), color = Palette.red, fontSize = 12.sp)
            }
            if (profile != null) {
                item {
                    Surface(color = Palette.ink, shape = RoundedCornerShape(23.dp),
                        shadowElevation = 2.dp) {
                        Column(Modifier.fillMaxWidth().padding(21.dp)) {
                            Icon(Icons.Default.VerifiedUser, null, tint = Palette.green,
                                modifier = Modifier.size(31.dp))
                            Spacer(Modifier.height(13.dp))
                            Text(profile?.str("username", "BetVima Member").orEmpty(),
                                fontSize = 21.sp, fontWeight = FontWeight.Black,
                                color = Color.White)
                            Text(session?.str("email").orEmpty(),
                                color = Color(0xFFB2C3CC), fontSize = 12.sp)
                            Spacer(Modifier.height(15.dp))
                            SmallPill(session?.str("status", "active").orEmpty().uppercase(),
                                Palette.green.copy(alpha = .13f), Palette.green)
                        }
                    }
                }
                item {
                    Surface(color = Color.White, shape = RoundedCornerShape(19.dp),
                        border = BorderStroke(1.dp, Palette.border),
                        shadowElevation = 1.dp) {
                        Column(Modifier.padding(17.dp)) {
                            ProfileInfoRow(
                                tr(state.lang, "Account currency", "ارز حساب"),
                                session?.str("currency", profile?.str("preferredCurrency", "USD") ?: "USD") ?: "USD"
                            )
                            HorizontalDivider(color = Palette.border)
                            ProfileInfoRow(
                                tr(state.lang, "Email", "ایمیل"), session?.str("email") ?: "—"
                            )
                            HorizontalDivider(color = Palette.border)
                            ProfileInfoRow(
                                tr(state.lang, "Account status", "وضعیت حساب"),
                                session?.str("status") ?: "—"
                            )
                        }
                    }
                }
                item {
                    Surface(color = Color.White, shape = RoundedCornerShape(18.dp),
                        border = BorderStroke(1.dp, Palette.border)) {
                        Column(Modifier.padding(17.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(tr(state.lang, "Personal details", "اطلاعات شخصی"),
                                    fontWeight = FontWeight.Black,
                                    modifier = Modifier.weight(1f))
                                TextButton(onClick = { editing = !editing }) {
                                    Text(if (editing) tr(state.lang, "Cancel", "انصراف")
                                         else tr(state.lang, "Edit", "ویرایش"),
                                        color = Palette.blue)
                                }
                            }
                            OutlinedTextField(name, { name = it.take(60) },
                                modifier = Modifier.fillMaxWidth(), enabled = editing,
                                label = { Text(tr(state.lang, "Display name", "نام نمایشی")) },
                                singleLine = true)
                            OutlinedTextField(phone, { phone = it.take(32) },
                                modifier = Modifier.fillMaxWidth(), enabled = editing,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                label = { Text(tr(state.lang, "Phone", "تلفن")) },
                                singleLine = true)
                            if (editing) {
                                Button(
                                    enabled = !loading && name.trim().length in 2..60 &&
                                        (phone.isBlank() || phone.length in 6..32),
                                    colors = ButtonDefaults.buttonColors(containerColor = Palette.green),
                                    modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp),
                                    shape = RoundedCornerShape(13.dp),
                                    onClick = {
                                        scope.launch {
                                            loading = true
                                            try {
                                                val token = vault.accessToken(api)
                                                    ?: throw IllegalStateException("Sign-in required")
                                                val body = JSONObject().put("displayName", name.trim())
                                                if (phone.isNotBlank()) body.put("phone", phone)
                                                api.patch("/api/v1/account/profile", body, token)
                                                editing = false
                                                reload()
                                            } catch (ex: Exception) {
                                                error = ex.message ?: "Update failed"
                                            } finally { loading = false }
                                        }
                                    }
                                ) {
                                    Text(tr(state.lang, "Save changes", "ذخیره تغییرات"),
                                        color = Palette.ink, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
                item {
                    Text(
                        tr(state.lang,
                            "Account changes are verified, stored and audited by BetVima's server. Passwords and payment details are never displayed here.",
                            "تغییرات حساب در سرور بت‌ویما بررسی، ذخیره و ثبت می‌شوند. رمز عبور و جزئیات پرداخت در این بخش نمایش داده نمی‌شوند."),
                        color = Palette.muted, fontSize = 11.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfileInfoRow(title: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Text(title, modifier = Modifier.weight(1f), color = Palette.muted, fontSize = 11.sp)
        Text(value, fontWeight = FontWeight.Bold, color = Palette.text, fontSize = 12.sp)
    }
}
