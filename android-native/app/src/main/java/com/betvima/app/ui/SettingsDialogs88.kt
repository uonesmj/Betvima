package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.betvima.app.data.*
import kotlinx.coroutines.launch
import org.json.JSONObject

private val sheetBg88 = Color(0xFF202127)
private val white88 = Color(0xFFF9FAFF)
private val gray88 = Color(0xFFB9BDCA)
private val blue88 = Color(0xFF248FFF)
private fun t88(lang:Lang,en:String,fa:String):String = tr(lang,en,fa)

@Composable
private fun SecureField88(value:String,onValue:(String)->Unit,label:String,
    digits:Boolean=false){
    OutlinedTextField(value=value, onValueChange=onValue, label={Text(label)},
        visualTransformation=PasswordVisualTransformation(),
        keyboardOptions=KeyboardOptions(keyboardType=if(digits)KeyboardType.NumberPassword
            else KeyboardType.Password),
        singleLine=true, modifier=Modifier.fillMaxWidth(),
        colors=OutlinedTextFieldDefaults.colors(
            focusedTextColor=white88,unfocusedTextColor=white88,
            focusedBorderColor=blue88, unfocusedBorderColor=Color(0xFF646875),
            focusedLabelColor=blue88,unfocusedLabelColor=gray88
        ))
}
@Composable
private fun SecureShell88(title:String,close:()->Unit,content:@Composable ColumnScope.()->Unit){
    Dialog(onDismissRequest=close,properties=DialogProperties(usePlatformDefaultWidth=false)){
        Column(Modifier.fillMaxWidth(.96f).heightIn(max=690.dp)
            .background(sheetBg88, RoundedCornerShape(26.dp))
            .verticalScroll(rememberScrollState())
            .padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
            Row(verticalAlignment=Alignment.CenterVertically){
                Text(title,color=white88,fontWeight=FontWeight.Black,fontSize=20.sp,
                    modifier=Modifier.weight(1f))
                IconButton(onClick=close){
                    Icon(Icons.Default.Close,contentDescription=tr(lang, "Close", "بستن"),tint=gray88)
                }
            }
            content()
        }
    }
}

@Composable
internal fun PasswordDialog88(lang:Lang,api:ApiClient,vault:SessionVault,
    onSuccess:()->Unit,onDismiss:()->Unit){
    val scope=rememberCoroutineScope()
    var current by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var repeated by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf(false) }
    var fault by remember { mutableStateOf("") }
    SecureShell88(t88(lang,"Change password","تغییر رمز عبور"),onDismiss){
        Text(t88(lang,
            "Confirm your current password before setting a new one. The update is verified by the BetVima server.",
            "برای تنظیم رمز جدید، ابتدا رمز فعلی را تأیید کنید. تغییر در سرور بت‌ویما بررسی می‌شود."),
            color=gray88,fontSize=12.sp)
        SecureField88(current,{current=it.take(128)},
            t88(lang,"Current password","رمز عبور فعلی"))
        SecureField88(next,{next=it.take(128)},
            t88(lang,"New password (10+ characters)","رمز جدید (حداقل ۱۰ کاراکتر)"))
        SecureField88(repeated,{repeated=it.take(128)},
            t88(lang,"Confirm new password","تکرار رمز جدید"))
        if (next.isNotEmpty() && repeated.isNotEmpty() && next != repeated)
            Text(t88(lang,"New passwords do not match","تکرار رمز با رمز جدید برابر نیست"),
                fontSize=11.sp,color=Color(0xFFFFADAD))
        if(fault.isNotBlank())Text(fault,color=Color(0xFFFFA7A7),fontSize=12.sp)
        Button(
            enabled = !pending && current.isNotBlank() && next.length in 10..128 &&
                next==repeated && current != next,
            modifier=Modifier.fillMaxWidth().height(51.dp),
            colors=ButtonDefaults.buttonColors(containerColor=blue88),
            shape=RoundedCornerShape(15.dp),
            onClick={
                scope.launch {
                    pending=true;fault=""
                    try{
                        val jwt=vault.accessToken(api)
                            ?: throw IllegalStateException(t88(lang,
                                "Please sign in again","لطفاً دوباره وارد شوید"))
                        val data=api.changePassword88(jwt,current,next)
                        if(!data.optBoolean("changed"))throw IllegalStateException("Update not confirmed")
                        current="";next="";repeated=""
                        onSuccess()
                    }catch(e:Exception){
                        fault=e.message ?: t88(lang,"Password change failed","تغییر رمز ناموفق بود")
                    }finally{pending=false}
                }
            }
        ){
            if(pending) CircularProgressIndicator(Modifier.size(21.dp),color=white88,strokeWidth=2.dp)
            else Text(t88(lang,"Update password","ثبت رمز جدید"),fontWeight=FontWeight.Bold)
        }
    }
}

@Composable
internal fun AppLockDialog88(lang:Lang,settings:SettingsDevice87,
    onChanged:()->Unit,onDismiss:()->Unit){
    val priorMode=remember { settings.lockMode88() }
    var authorized by remember { mutableStateOf(priorMode=="none") }
    var priorSecret by remember { mutableStateOf("") }
    var oldInput by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf(if(priorMode=="pattern")"pattern" else "pin") }
    var pin by remember { mutableStateOf("") }
    var repeatPin by remember { mutableStateOf("") }
    var firstPattern by remember { mutableStateOf("") }
    var repeatedPattern by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var confirmDisable by remember { mutableStateOf(false) }
    fun approve(value:String){
        when(settings.unlock88(value)){
            1 -> {priorSecret=value;authorized=true;error=""}
            -1 -> error=t88(lang,"Too many attempts. Please wait.",
                "تعداد تلاش زیاد است. کمی صبر کنید.")
            else -> error=t88(lang,"Incorrect code or pattern","پین یا الگو نادرست است")
        }
        oldInput=""
    }
    fun commit(newMode:String,secret:String){
        if(settings.updateLock88(newMode,secret,
                if(priorMode=="none")null else priorSecret)){
            onChanged();onDismiss()
        }else error=t88(lang,"Could not update the app lock","تغییر قفل انجام نشد")
    }
    if (confirmDisable) AlertDialog(
        onDismissRequest={confirmDisable=false},
        shape=RoundedCornerShape(24.dp),containerColor=sheetBg88,
        title={Text(t88(lang,"Turn off app lock?","قفل برنامه خاموش شود؟"),
            color=white88,fontWeight=FontWeight.Black)},
        text={Text(t88(lang,
            "You have verified the current lock. Turning it off will remove the PIN or pattern from this device.",
            "قفل فعلی تأیید شده است. با خاموش‌کردن، پین یا الگوی این دستگاه حذف می‌شود."),
            color=gray88,fontSize=13.sp)},
        confirmButton={TextButton(onClick={
            confirmDisable=false
            commit("none","")
        }){Text(t88(lang,"Turn off lock","خاموش‌کردن قفل"),
            color=Color(0xFFFF9FAE))}},
        dismissButton={TextButton(onClick={confirmDisable=false}){
            Text(t88(lang,"Cancel","انصراف"),color=gray88)
        }}
    )
    SecureShell88(t88(lang,"App lock protection","قفل برنامه"),onDismiss) {
        if(!authorized){
            Text(t88(lang,"Confirm your existing lock before changing it.",
                "برای تغییر یا حذف قفل ابتدا روش قبلی را تأیید کنید."),
                color=gray88,fontSize=12.sp)
            if(priorMode=="pattern"){
                PatternPad88(onComplete={approve(it)})
            }else{
                SecureField88(oldInput,{oldInput=it.filter(Char::isDigit).take(6)},
                    t88(lang,"Current 6-digit PIN","پین فعلی ۶ رقمی"),true)
                Button(onClick={approve(oldInput)},enabled=oldInput.length==6,
                    modifier=Modifier.fillMaxWidth(),
                    colors=ButtonDefaults.buttonColors(containerColor=blue88)){
                    Text(t88(lang,"Verify","تأیید"))
                }
            }
            val seconds=settings.blockedRemainingMs88()/1000
            if(seconds>0)Text(t88(lang,"Temporarily locked: ","قفل موقت: ")+seconds.toString()+"s",
                color=Color(0xFFFFBD78),fontSize=12.sp)
        }else{
            Text(t88(lang,"Choose how to unlock this device",
                "روش بازکردن قفل این دستگاه را انتخاب کنید"),
                color=gray88,fontSize=12.sp)
            Row(horizontalArrangement=Arrangement.spacedBy(6.dp),
                verticalAlignment=Alignment.CenterVertically){
                listOf("pin" to t88(lang,"PIN","عدد"),
                    "pattern" to t88(lang,"Pattern","الگو")).forEach{(value,label)->
                    FilterChip(selected=mode==value,onClick={
                        mode=value;pin="";repeatPin="";firstPattern="";repeatedPattern="";error=""
                    },label={Text(label,fontSize=12.sp)},
                        modifier=Modifier.weight(1f))
                }
                if(priorMode!="none") {
                    OutlinedButton(onClick={confirmDisable=true},
                        modifier=Modifier.weight(1.1f).height(46.dp),
                        shape=RoundedCornerShape(16.dp),
                        border=BorderStroke(1.dp,Color(0xFFB64F63)),
                        contentPadding=PaddingValues(horizontal=2.dp)) {
                        Icon(Icons.Default.PowerSettingsNew,null,
                            tint=Color(0xFFFF9DAF),modifier=Modifier.size(15.dp))
                        Spacer(Modifier.width(3.dp))
                        Text(t88(lang,"Off","خاموش"),
                            color=Color(0xFFFFABBB),fontSize=12.sp)
                    }
                }
            }
            if(mode=="pin"){
                SecureField88(pin,{pin=it.filter(Char::isDigit).take(6)},
                    t88(lang,"New 6-digit PIN","پین جدید ۶ رقمی"),true)
                SecureField88(repeatPin,{repeatPin=it.filter(Char::isDigit).take(6)},
                    t88(lang,"Repeat PIN","تکرار پین"),true)
            }else{
                Text(if(firstPattern.isBlank())
                    t88(lang,"Draw the new pattern (4–9 dots)","الگوی جدید را رسم کنید (۴ تا ۹ نقطه)")
                    else t88(lang,"Repeat the same pattern to confirm",
                        "همان الگو را برای تأیید دوباره رسم کنید"),
                    color=gray88,fontSize=11.sp)
                PatternPad88(onComplete={candidate->
                    if(firstPattern.isBlank()){
                        firstPattern=candidate;error=""
                    }else{
                        repeatedPattern=candidate
                        error=if(candidate==firstPattern)""
                            else t88(lang,"Patterns do not match. Try again.",
                                "الگوها برابر نیستند؛ دوباره تلاش کنید.")
                    }
                })
                if(firstPattern.isNotBlank())TextButton(onClick={
                    firstPattern="";repeatedPattern="";error=""
                }){Text(t88(lang,"Start pattern again","رسم مجدد الگو"))}
            }
            val valid=if(mode=="pin")pin.length==6 && pin==repeatPin
                else firstPattern.isNotBlank()&&firstPattern==repeatedPattern
            Button(onClick={
                commit(mode,if(mode=="pin")pin else firstPattern)
            },enabled=valid,modifier=Modifier.fillMaxWidth().height(49.dp),
                colors=ButtonDefaults.buttonColors(containerColor=blue88),
                shape=RoundedCornerShape(15.dp)){
                Text(t88(lang,"Activate "+if(mode=="pin")"PIN" else "pattern",
                    "فعال‌سازی "+if(mode=="pin")"پین" else "الگو"))
            }

        }
        if(error.isNotBlank())Text(error,color=Color(0xFFFFA3AD),fontSize=12.sp)
    }
}

@Composable
internal fun LoginHistoryDialog88(lang:Lang,api:ApiClient,vault:SessionVault,
    onDismiss:()->Unit){
    val scope=rememberCoroutineScope()
    val records=remember { mutableStateListOf<JSONObject>() }
    var page by remember { mutableIntStateOf(1) }
    var hasMore by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf("") }
    suspend fun fetchPage(target:Int){
        if(busy) return
        busy=true;failure=""
        try{
            val token=vault.accessToken(api)
                ?: throw IllegalStateException(t88(lang,"Please sign in","لطفاً وارد شوید"))
            val response=api.loginHistory88(token,target)
            val values=response.optJSONArray("items")
            if(target==1)records.clear()
            if(values!=null)for(i in 0 until values.length()){
                values.optJSONObject(i)?.let {records.add(it)}
            }
            page=target
            hasMore=response.optBoolean("hasMore",false)
        }catch(e:Exception){failure=e.message?:t88(lang,
            "Could not retrieve login history","خطا در دریافت سوابق ورود")}
        finally{busy=false}
    }
    LaunchedEffect(Unit){fetchPage(1)}
    Dialog(onDismissRequest=onDismiss,properties=DialogProperties(usePlatformDefaultWidth=false)){
        Column(Modifier.fillMaxWidth(.94f).fillMaxHeight(.79f)
            .background(sheetBg88,RoundedCornerShape(26.dp))
            .padding(18.dp),verticalArrangement=Arrangement.spacedBy(13.dp)){
            Row(verticalAlignment=Alignment.CenterVertically){
                Icon(Icons.Default.History,null,tint=blue88,modifier=Modifier.size(25.dp))
                Spacer(Modifier.width(9.dp))
                Text(t88(lang,"Login history","سوابق ورود"),color=white88,
                    fontWeight=FontWeight.Black,fontSize=20.sp,
                    modifier=Modifier.weight(1f))
                IconButton(onClick=onDismiss){
                    Icon(Icons.Default.Close,"Close",tint=gray88)
                }
            }
            Text(t88(lang,
                "Verified account events • only your own sessions are shown. Earlier logins may not have been recorded.",
                "رویدادهای واقعی حساب • فقط ورودهای متعلق به شما نمایش داده می‌شود. ممکن است ورودهای قدیمی ثبت نشده باشند."),
                color=gray88,fontSize=11.sp)
            if(busy && records.isEmpty())LinearProgressIndicator(Modifier.fillMaxWidth(),color=blue88)
            if(failure.isNotBlank()){
                Text(failure,color=Color(0xFFFFB5B5),fontSize=12.sp)
                TextButton(onClick={scope.launch{fetchPage(page)}}){
                    Text(t88(lang,"Retry","تلاش دوباره"),color=blue88)
                }
            }
            LazyColumn(modifier=Modifier.weight(1f),
                verticalArrangement=Arrangement.spacedBy(9.dp)){
                if(!busy && records.isEmpty() && failure.isBlank()){
                    item{Text(t88(lang,"No login events recorded yet",
                        "هنوز سابقه ورود ثبت نشده است"),color=gray88)}
                }
                items(records,key={it.optString("id")}){record->
                    Surface(shape=RoundedCornerShape(15.dp),color=Color(0xFF2E303A)){
                        Row(Modifier.fillMaxWidth().padding(13.dp),
                            verticalAlignment=Alignment.CenterVertically){
                            Icon(if(record.optString("client")=="android")
                                Icons.Default.PhoneAndroid else Icons.Default.Computer,
                                null,tint=blue88,modifier=Modifier.size(23.dp))
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)){
                                Text(record.optString("device","Unknown device"),
                                    color=white88,fontWeight=FontWeight.Bold,fontSize=13.sp)
                                Text(record.optString("at").replace("T","  ").take(19)+" UTC",
                                    color=gray88,fontSize=11.sp)
                            }
                            Icon(Icons.Default.CheckCircle,null,
                                tint=Color(0xFF81CBA6),modifier=Modifier.size(18.dp))
                        }
                    }
                }
                if(hasMore){
                    item{
                        OutlinedButton(onClick={scope.launch{fetchPage(page+1)}},
                            enabled=!busy,modifier=Modifier.fillMaxWidth()){
                            Text(t88(lang,"Load older logins","نمایش ورودهای قدیمی‌تر"),
                                color=blue88)
                        }
                    }
                }
            }
        }
    }
}
