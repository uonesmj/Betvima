package com.betvima.admin;

import android.app.Activity;
import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** No browser, WebView, cookies, privileged key, or password storage.
 * All administrative authorization is enforced again by the BetVima server.
 */
public final class AdminApi {
 public interface Success { void accept(JSONObject value) throws Exception; }
 public interface Failure { void accept(String message); }
 private interface Task { JSONObject run() throws Exception; }
 public static final String BASE="https://betvima.com";
 private final Activity context;
 private final ExecutorService pool=Executors.newSingleThreadExecutor();
 private final Vault vault;
 private String supabaseUrl="";
 private String publishableKey="";
 private String accessToken="";
 private String refreshToken="";

 public AdminApi(Activity context){this.context=context;vault=new Vault(context);}

 public void perform(Checked task, Success ok,Failure fail){
  pool.execute(()->{
   try{
    JSONObject response=task.run();
    context.runOnUiThread(()->{
     try{ok.accept(response);}catch(Exception err){fail.accept(message(err));}
    });
   }catch(Exception err){context.runOnUiThread(()->fail.accept(message(err)));}
  });
 }
 public interface Checked { JSONObject run() throws Exception; }
 private String message(Exception error){
  String m=error.getMessage();return m==null||m.isEmpty()?"خطا در ارتباط امن با سرور":m;
 }
 private JSONObject http(String method,String url,JSONObject data,String bearer,String apikey)throws Exception{
  if(!url.startsWith("https://"))throw new Exception("ارتباط فقط از طریق HTTPS مجاز است");
  HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
  c.setConnectTimeout(15000);c.setReadTimeout(25000);
  c.setRequestMethod(method);c.setInstanceFollowRedirects(false);
  c.setRequestProperty("Accept","application/json");
  c.setRequestProperty("Cache-Control","no-store");
  if(bearer!=null&&!bearer.isEmpty())c.setRequestProperty("Authorization","Bearer "+bearer);
  if(apikey!=null&&!apikey.isEmpty())c.setRequestProperty("apikey",apikey);
  try {
   if(data!=null){
    c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");
    byte[] b=data.toString().getBytes(StandardCharsets.UTF_8);
    try(OutputStream stream=c.getOutputStream()){stream.write(b);}
   }
   int status=c.getResponseCode();
   if(status>=300&&status<400)throw new Exception("سرور پاسخ انتقال ناامن داد");
   InputStream in=status>=400?c.getErrorStream():c.getInputStream();
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();
   if(in!=null)try(InputStream stream=in){
    byte[] buffer=new byte[4096];int n;
    while((n=stream.read(buffer))!=-1){if(bytes.size()>3_000_000)throw new Exception("پاسخ بیش از حد بزرگ");bytes.write(buffer,0,n);}
   }
   String body=bytes.toString("UTF-8");
   JSONObject json=body.trim().startsWith("{")?new JSONObject(body):new JSONObject();
   if(status>=400){
    String error=json.optString("message",json.optString("msg",json.optString("error_description",json.optString("error","HTTP "+status))));
    if(status==401)throw new Exception("UNAUTHORIZED: "+error);
    if(status==403)throw new Exception("دسترسی مدیریت مجاز نیست: "+error);
    if(status==404)throw new Exception("این API هنوز روی سرور BetVima منتشر نشده است.");
    throw new Exception(error);
   }
   if(json.optBoolean("ok",true)==false)throw new Exception(json.optString("message","Server error"));
   return json;
  }finally{c.disconnect();}
 }
 private JSONObject values(JSONObject response){JSONObject data=response.optJSONObject("data");return data==null?response:data;}
 public JSONObject bootstrap()throws Exception{
  JSONObject config=values(http("GET",BASE+"/api/v1/mobile/config",null,null,null));
  String url=config.optString("supabaseUrl","");
  String key=config.optString("supabaseAnonKey","");
  if(!url.matches("https://[A-Za-z0-9-]+\\.supabase\\.co/?")||key.length()<20)
   throw new Exception("تنظیمات احراز هویت در سرور موجود نیست");
  supabaseUrl=url.replaceAll("/+$","");
  publishableKey=key;
  return config;
 }
 private JSONObject auth(String method,String path,JSONObject data)throws Exception{
  if(supabaseUrl.isEmpty())bootstrap();
  return http(method,supabaseUrl+"/auth/v1"+path,data,accessToken,publishableKey);
 }
 private void useSession(JSONObject json,boolean persist)throws Exception{
  String at=json.optString("access_token","");
  String rt=json.optString("refresh_token","");
  if(at.isEmpty()||rt.isEmpty())throw new Exception("توکن معتبر دریافت نشد");
  accessToken=at;refreshToken=rt;
  if(persist)vault.save(accessToken,refreshToken);
 }
 public JSONObject login(String email,String password)throws Exception{
  bootstrap();
  JSONObject payload=new JSONObject().put("email",email.trim()).put("password",password);
  JSONObject session=auth("POST","/token?grant_type=password",payload);
  useSession(session,false);
  return currentUser();
 }
 public JSONObject currentUser()throws Exception{
  return auth("GET","/user",null);
 }
 public JSONObject checkRole()throws Exception{
  JSONObject session=values(http("GET",BASE+"/api/v1/auth/session",null,accessToken,null));
  JSONObject user=session.optJSONObject("user");
  if(!session.optBoolean("authenticated")||user==null||!user.optBoolean("isAdmin")){
   clear();throw new Exception("این حساب اجازه ورود به پنل مدیریت را ندارد");
  }
  return user;
 }
 public JSONObject factors()throws Exception{return currentUser();}
 public JSONObject enrollFactor()throws Exception{
  return auth("POST","/factors",new JSONObject().put("factor_type","totp").put("friendly_name","BetVima Admin Android"));
 }
 public JSONObject challenge(String factorId)throws Exception{
  return auth("POST","/factors/"+factorId+"/challenge",new JSONObject());
 }
 public JSONObject verify(String factorId,String challengeId,String code)throws Exception{
  JSONObject response=auth("POST","/factors/"+factorId+"/verify",new JSONObject().put("challenge_id",challengeId).put("code",code));
  useSession(response,true);
  JSONObject user=checkRole();
  if(!"aal2".equals(user.optString("mfaLevel")))throw new Exception("تأیید دومرحله‌ای هنوز کامل نیست");
  return user;
 }
 public JSONObject resume()throws Exception{
  if(supabaseUrl.isEmpty())bootstrap();
  String[] saved=vault.load();
  if(saved==null)throw new Exception("SESSION_MISSING");
  accessToken=saved[0];refreshToken=saved[1];
  refreshTokens();
  JSONObject user=checkRole();
  if(!"aal2".equals(user.optString("mfaLevel")))throw new Exception("SESSION_MISSING");
  return user;
 }
 private void refreshTokens()throws Exception{
  JSONObject session=auth("POST","/token?grant_type=refresh_token",new JSONObject().put("refresh_token",refreshToken));
  useSession(session,true);
 }
 public JSONObject get(String path)throws Exception{return endpoint("GET",path,null);}
 public JSONObject post(String path,JSONObject body)throws Exception{return endpoint("POST",path,body);}
 public JSONObject patch(String path,JSONObject body)throws Exception{return endpoint("PATCH",path,body);}
 private JSONObject endpoint(String method,String path,JSONObject body)throws Exception{
  if(!path.startsWith("/api/v1/admin/")&&!path.equals("/api/v1/auth/session"))
   throw new Exception("مسیر API مدیر نامعتبر است");
  try{return values(http(method,BASE+path,body,accessToken,null));}
  catch(Exception error){
   if(error.getMessage()!=null&&error.getMessage().startsWith("UNAUTHORIZED:")&&!refreshToken.isEmpty()){
    refreshTokens();return values(http(method,BASE+path,body,accessToken,null));
   }
   throw error;
  }
 }
 public void persistVerified(){if(!accessToken.isEmpty()&&!refreshToken.isEmpty())vault.save(accessToken,refreshToken);}
 public void clear(){
  accessToken="";refreshToken="";vault.clear();
 }
 public void logout()throws Exception{
  try{if(!accessToken.isEmpty())auth("POST","/logout",new JSONObject());}
  finally{clear();}
 }
 public void destroy(){pool.shutdownNow();}

 /** AES-256 GCM Android Keystore; no plaintext bearer token in SharedPreferences/backups. */
 static final class Vault{
  private static final String ALIAS="betvima_admin_native_session";
  private final android.content.SharedPreferences prefs;
  Vault(Context c){prefs=c.getSharedPreferences("native_admin_session",Context.MODE_PRIVATE);}
  private SecretKey key()throws Exception{
   KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
   if(ks.containsAlias(ALIAS))return (SecretKey)ks.getKey(ALIAS,null);
   KeyGenerator gen=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
   gen.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
    .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
   return gen.generateKey();
  }
  void save(String access,String refresh){
   try{
    Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
    byte[] bytes=new JSONObject().put("a",access).put("r",refresh).toString().getBytes(StandardCharsets.UTF_8);
    prefs.edit().putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP))
     .putString("cipher",Base64.encodeToString(cipher.doFinal(bytes),Base64.NO_WRAP)).apply();
   }catch(Exception ignored){clear();}
  }
  String[] load(){
   try{
    String iv=prefs.getString("iv",null),data=prefs.getString("cipher",null);
    if(iv==null||data==null)return null;
    Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(iv,Base64.DEFAULT)));
    JSONObject json=new JSONObject(new String(cipher.doFinal(Base64.decode(data,Base64.DEFAULT)),StandardCharsets.UTF_8));
    return new String[]{json.getString("a"),json.getString("r")};
   }catch(Exception err){clear();return null;}
  }
  void clear(){prefs.edit().clear().apply();}
 }
}
