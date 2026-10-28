package com.betvima.admin;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Completely native UI: Activity, native Views, native drawer and dialogs.
 * No WebView, browser redirection, HTML interface or front-end dependency.
 */
public final class MainActivity extends Activity {
 private static final int BG=Color.rgb(10,12,16), PANEL=Color.rgb(22,26,32);
 private static final int EDGE=Color.rgb(47,53,61), FG=Color.rgb(246,249,247);
 private static final int MUTED=Color.rgb(151,160,170), GREEN=Color.rgb(8,215,133);
 private static final int AMBER=Color.rgb(248,197,109), RED=Color.rgb(255,136,146);
 private final String[][] MENU={
  {"dashboard","◈","داشبورد","سود و آمار روزانه"},
  {"users","◎","کاربران","اطلاعات و حساب‌ها"},
  {"bets","▤","شرط‌ها","جزئیات شرط و تسویه"},
  {"deposit","↙","واریزها","دریافت‌های مالی"},
  {"withdrawal","↗","برداشت‌ها","درخواست‌ها و تأیید"},
  {"casino","◇","کازینو","تراکنش‌ها و گردش"},
  {"support","✉","پشتیبانی","پاسخ تیکت‌ها"},
  {"manual","⊕","افزودن مسابقه","ساخت بازی دستی"},
  {"affiliates","♧","افیلیت","همکاران"},
  {"notifications","◌","اعلان‌ها","کمپین کاربران"},
  {"operations","⚙","تنظیمات عملیاتی","کنترل وضعیت سرویس"},
  {"audit","≡","گزارش تغییرات","سوابق مدیریتی"}
 };
 private AdminApi api;
 private FrameLayout frame;
 private LinearLayout body;
 private String page="dashboard",period="24h",query="",selectedId="",factorId="",mfaSecret="",email="",userOrder="newest";
 private int userPage=1;
 private JSONObject selected;
 private boolean loggedIn=false,loading=false,drawerOpened=false,showingUserDetail=false;
 private long lastTap=0;
 private final Handler supportRefresh=new Handler(Looper.getMainLooper());
 private TextView supportBadge;
 private int unansweredTickets=0;
 private final Runnable supportTicker=new Runnable(){@Override public void run(){
  if(!isFinishing()&&loggedIn){refreshSupportBadge();supportRefresh.postDelayed(this,45000);}
 }};

 @Override public void onCreate(Bundle savedState){
  super.onCreate(savedState);
  getWindow().setStatusBarColor(BG);getWindow().setNavigationBarColor(BG);
  getWindow().getDecorView().setSystemUiVisibility(0);
  api=new AdminApi(this);
  loadingScreen("راه‌اندازی ارتباط امن");
  api.perform(()->api.resume(),u->{loggedIn=true;email=u.optString("email","Administrator");showPage("dashboard");},
   e->showLogin(null));
 }
 private int dp(int n){return (int)(getResources().getDisplayMetrics().density*n+.5f);}
 private GradientDrawable bg(int color,int stroke,int radius){
  GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(dp(radius));
  if(stroke!=0)g.setStroke(dp(1),stroke);return g;
 }
 private GradientDrawable gradient(){
  GradientDrawable g=new GradientDrawable(GradientDrawable.Orientation.TL_BR,
   new int[]{Color.rgb(33,68,51),Color.rgb(19,36,30),Color.rgb(21,27,29)});
  g.setCornerRadius(dp(24));g.setStroke(dp(1),Color.rgb(54,102,75));return g;
 }
 private LinearLayout col(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);l.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);return l;}
 private LinearLayout row(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);l.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);return l;}
 private TextView text(String s,int size,int color,boolean heavy){
  TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(color);
  t.setGravity(Gravity.CENTER_VERTICAL|Gravity.RIGHT);t.setTextDirection(View.TEXT_DIRECTION_FIRST_STRONG);
  if(heavy)t.setTypeface(Typeface.create("sans-serif",Typeface.BOLD));t.setIncludeFontPadding(true);
  return t;
 }
 private void space(LinearLayout host,int height){View v=new View(this);host.addView(v,new LinearLayout.LayoutParams(1,dp(height)));}
 private void pad(View v,int p){v.setPadding(dp(p),dp(p),dp(p),dp(p));}
 private LinearLayout panel(LinearLayout parent){
  LinearLayout l=col();l.setBackground(bg(PANEL,EDGE,21));pad(l,17);
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(12);parent.addView(l,lp);return l;
 }
 private LinearLayout hero(LinearLayout parent){
  LinearLayout l=col();l.setBackground(gradient());pad(l,23);
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(12);parent.addView(l,lp);return l;
 }
 private TextView label(String text){return text(text,11,MUTED,false);}
 private TextView large(String text){return text(text,29,FG,true);}
 private void addTitle(LinearLayout parent,String s){
  TextView v=text(s,16,FG,true);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
  lp.topMargin=dp(19);lp.bottomMargin=dp(13);parent.addView(v,lp);
 }
 private TextView action(String title,boolean primary,Runnable click){
  TextView b=text(title,13,primary?BG:FG,true);b.setGravity(Gravity.CENTER);
  b.setBackground(bg(primary?GREEN:Color.rgb(38,45,50),primary?0:EDGE,14));
  b.setMinHeight(dp(47));b.setPadding(dp(13),dp(9),dp(13),dp(9));b.setOnClickListener(v->click.run());return b;
 }
 private void addAction(LinearLayout parent,String title,boolean primary,Runnable click){
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(48));lp.topMargin=dp(11);parent.addView(action(title,primary,click),lp);
 }
 private EditText field(String hint,int type){
  EditText e=new EditText(this);e.setSingleLine(true);e.setTextColor(FG);e.setHintTextColor(MUTED);
  e.setTextSize(14);e.setHint(hint);e.setInputType(type);e.setBackground(bg(Color.rgb(28,33,39),EDGE,13));
  e.setPadding(dp(14),dp(13),dp(14),dp(13));e.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);
  return e;
 }
 private EditText input(LinearLayout parent,String hint,int type){
  EditText e=field(hint,type);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(51));
  lp.topMargin=dp(10);parent.addView(e,lp);return e;
 }
 private void divider(LinearLayout parent){
  View v=new View(this);v.setBackgroundColor(EDGE);
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(1));
  lp.topMargin=dp(12);lp.bottomMargin=dp(12);parent.addView(v,lp);
 }
 private void info(LinearLayout parent,String name,String value){
  LinearLayout r=row();TextView n=label(name),v=text(value==null?"—":value,12,FG,true);
  v.setGravity(Gravity.LEFT|Gravity.CENTER_VERTICAL);v.setMaxLines(3);v.setEllipsize(TextUtils.TruncateAt.END);
  r.addView(n,new LinearLayout.LayoutParams(0,-2,1));r.addView(v,new LinearLayout.LayoutParams(0,-2,1.4f));
  parent.addView(r);space(parent,9);
 }
 private void centerText(LinearLayout target,String s){
  TextView t=text(s,12,MUTED,false);t.setGravity(Gravity.CENTER);pad(t,22);target.addView(t);
 }
 private String pick(JSONObject o,String... keys){
  for(String key:keys){String s=o.optString(key,"");if(!s.isEmpty()&&!"null".equals(s))return s;}
  return "—";
 }
 private String cash(Object value){
  try{
   BigDecimal n=new BigDecimal(String.valueOf(value)).movePointLeft(2);
   return new DecimalFormat("#,##0.00",java.text.DecimalFormatSymbols.getInstance(Locale.US)).format(n)+" $";
  }catch(Exception ignored){return "—";}
 }
 private String money(JSONObject o,String usdKey,String fallback){
  return o.isNull(usdKey)||!o.has(usdKey)?"—":cash(o.optString(usdKey,"0"));
 }
 private String amountMinor(Object value,String currency){
  try{
   BigDecimal n=new BigDecimal(String.valueOf(value)).movePointLeft(2);
   return new DecimalFormat("#,##0.00",java.text.DecimalFormatSymbols.getInstance(Locale.US)).format(n)+" "+currency;
  }catch(Exception ignored){return "—";}
 }
 private String date(String value){
  try{
   Date d=Date.from(Instant.parse(value));
   SimpleDateFormat f=new SimpleDateFormat("yyyy/MM/dd  HH:mm",Locale.US);
   return f.format(d);
  }catch(Exception ignored){return value.length()>19?value.substring(0,19):value;}
 }
 private void loadingScreen(String message){
  frame=new FrameLayout(this);frame.setBackgroundColor(BG);setContentView(frame);
  LinearLayout l=col();l.setGravity(Gravity.CENTER);pad(l,25);frame.addView(l,new FrameLayout.LayoutParams(-1,-1));
  TextView logo=text("B",52,GREEN,true);logo.setGravity(Gravity.CENTER);l.addView(logo);
  TextView title=text("BetVima  ADMIN",20,FG,true);title.setGravity(Gravity.CENTER);l.addView(title);
  space(l,25);ProgressBar progress=new ProgressBar(this);
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(dp(38),dp(38));lp.gravity=Gravity.CENTER;l.addView(progress,lp);
  space(l,20);TextView d=label(message);d.setGravity(Gravity.CENTER);l.addView(d);
 }
 private void showLogin(String notice){
  loggedIn=false;
  frame=new FrameLayout(this);frame.setBackgroundColor(BG);setContentView(frame);
  ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);frame.addView(scroll);
  LinearLayout host=col();pad(host,25);host.setGravity(Gravity.CENTER_VERTICAL);scroll.addView(host);
  TextView logo=text("B",45,GREEN,true);logo.setGravity(Gravity.CENTER);
  logo.setBackground(bg(Color.rgb(26,66,47),0,23));
  LinearLayout.LayoutParams lg=new LinearLayout.LayoutParams(dp(82),dp(82));lg.gravity=Gravity.CENTER;host.addView(logo,lg);
  space(host,23);
  TextView heading=text("BetVima Admin",29,FG,true);heading.setGravity(Gravity.CENTER);host.addView(heading);
  TextView sub=text("ورود اختصاصی مدیریت • Native Android",12,MUTED,false);sub.setGravity(Gravity.CENTER);host.addView(sub);
  space(host,32);
  if(notice!=null){TextView err=text(notice,12,RED,false);pad(err,8);host.addView(err);}
  EditText emailField=input(host,"ایمیل حساب مدیر",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
  EditText pw=input(host,"رمز عبور",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
  pw.setImeOptions(EditorInfo.IME_ACTION_DONE);
  addAction(host,"ورود امن ←",true,()->{
   String em=emailField.getText().toString().trim(),pass=pw.getText().toString();
   if(em.isEmpty()||pass.isEmpty()){showMessage("ایمیل و رمز را کامل وارد کنید");return;}
   loadingScreen("تأیید هویت حساب ادمین");
   api.perform(()->{api.login(em,pass);return api.checkRole();},u->{
    email=u.optString("email",em);
    if("aal2".equals(u.optString("mfaLevel"))&&u.optBoolean("mfaEnrolled")){api.persistVerified();loggedIn=true;showPage("dashboard");}
    else showMfa();
   },e->{api.clear();showLogin(e);});
  });
  space(host,12);
  addAction(host,"⚙ تنظیم آدرس اتصال سرور",false,this::serverDialog);
  space(host,8);
  TextView configured=text("سرور فعلی: "+api.origin(),11,MUTED,false);
  configured.setGravity(Gravity.CENTER);host.addView(configured);
  space(host,20);
  TextView safety=text("حفاظت‌شده با احراز هویت دومرحله‌ای و دسترسی سطح مدیر",11,MUTED,false);
  safety.setGravity(Gravity.CENTER);host.addView(safety);
 }
 private void showMfa(){
  loadingScreen("بررسی روش دومرحله‌ای");
  api.perform(()->api.factors(),user->{
   JSONArray factors=user.optJSONArray("factors");factorId="";
   if(factors!=null)for(int i=0;i<factors.length();i++){
    JSONObject f=factors.optJSONObject(i);
    if(f!=null&&"totp".equals(f.optString("factor_type"))&&"verified".equals(f.optString("status"))){factorId=f.optString("id");break;}
   }
   if(factorId.isEmpty())startEnrollment();else mfaCode();
  },e->showLogin(e));
 }
 private void startEnrollment(){
  loadingScreen("راه‌اندازی تأیید دومرحله‌ای");
  api.perform(()->api.enrollFactor(),out->{
   factorId=out.optString("id","");
   mfaSecret=out.optJSONObject("totp")!=null?out.optJSONObject("totp").optString("secret",""):"";
   mfaCode();
  },e->showLogin("برای اولین ورود باید 2FA فعال شود: "+e));
 }
 private void mfaCode(){
  frame=new FrameLayout(this);frame.setBackgroundColor(BG);setContentView(frame);
  ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);frame.addView(scroll);
  LinearLayout host=col();pad(host,24);host.setGravity(Gravity.CENTER_VERTICAL);scroll.addView(host);
  TextView icon=text("✓",35,GREEN,true);icon.setGravity(Gravity.CENTER);host.addView(icon);
  TextView title=text("تأیید دومرحله‌ای",27,FG,true);title.setGravity(Gravity.CENTER);host.addView(title);
  TextView note=text("کد ۶ رقمی برنامه Authenticator خود را وارد کنید",13,MUTED,false);note.setGravity(Gravity.CENTER);host.addView(note);
  space(host,22);
  if(!mfaSecret.isEmpty()){
   LinearLayout box=panel(host);box.addView(text("کلید راه‌اندازی برای Google Authenticator",12,AMBER,true));
   space(box,8);TextView secret=text(mfaSecret,14,FG,true);secret.setTextIsSelectable(true);box.addView(secret);
   space(box,8);box.addView(label("این کلید را در برنامه رمزساز ثبت کنید؛ آن را با کسی به اشتراک نگذارید."));
  }
  EditText code=input(host,"کد یکبار مصرف",InputType.TYPE_CLASS_NUMBER);
  code.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(6)});
  addAction(host,"تأیید و ورود",true,()->{
   String digits=code.getText().toString().trim();if(!digits.matches("[0-9]{6}")){showMessage("کد باید ۶ رقم باشد");return;}
   String id=factorId;loadingScreen("تأیید کد امنیتی");
   api.perform(()->{
    JSONObject challenge=api.challenge(id);
    return api.verify(id,challenge.getString("id"),digits);
   },user->{mfaSecret="";loggedIn=true;email=user.optString("email",email);showPage("dashboard");},
    e->{mfaCode();showMessage(e);});
  });
  addAction(host,"بازگشت به ورود",false,()->{api.clear();showLogin(null);});
 }
 private void showMessage(String message){
  if(isFinishing())return;
  new AlertDialog.Builder(this).setTitle("BetVima Admin").setMessage(message).setPositiveButton("باشه",null).show();
 }
 private String titleFor(String key){
  switch(key){
   case "dashboard":return "داشبورد";case "users":return "کاربران";case "bets":return "شرط‌ها";
   case "deposit":return "واریزها";case "withdrawal":return "برداشت‌ها";
   case "casino":return "کازینو";case "support":return "پشتیبانی";
   case "manual":return "بازی‌های دستی";case "affiliates":return "افیلیت";
   case "notifications":return "اعلان‌ها";case "operations":return "تنظیمات عملیاتی";
   case "audit":return "گزارش تغییرات";default:return "مدیریت BetVima";
  }
 }
 private void showPage(String next){
  page=next;selectedId="";query="";userPage=1;showingUserDetail=false;
  createPage(titleFor(page),"پنل مدیریت مستقل • اطلاعات سرور اصلی");
  loadPage();
  if(loggedIn)refreshSupportBadge();
 }
 private void createPage(String title,String subtitle){
  drawerOpened=false;
  frame=new FrameLayout(this);frame.setBackgroundColor(BG);setContentView(frame);
  LinearLayout layout=col();frame.addView(layout,new FrameLayout.LayoutParams(-1,-1));
  LinearLayout bar=row();bar.setPadding(dp(17),dp(14),dp(17),dp(10));
  TextView hamburger=text("☰",28,FG,false);hamburger.setGravity(Gravity.CENTER);
  hamburger.setBackground(bg(PANEL,EDGE,14));bar.addView(hamburger,new LinearLayout.LayoutParams(dp(46),dp(46)));
  hamburger.setOnClickListener(v->drawer());
  LinearLayout brand=col();brand.setPadding(dp(12),0,dp(12),0);
  brand.addView(text("BetVima",19,FG,true));brand.addView(text("ADMIN CONTROL CENTER",9,GREEN,true));
  bar.addView(brand,new LinearLayout.LayoutParams(0,-2,1));
  TextView b=text("B",22,BG,true);b.setGravity(Gravity.CENTER);b.setBackground(bg(GREEN,0,12));
  bar.addView(b,new LinearLayout.LayoutParams(dp(41),dp(41)));
  layout.addView(bar);
  LinearLayout header=col();header.setPadding(dp(19),dp(12),dp(19),dp(15));
  header.addView(text(title,27,FG,true));space(header,5);header.addView(text(subtitle,11,MUTED,false));
  layout.addView(header);
  View edge=new View(this);edge.setBackgroundColor(EDGE);layout.addView(edge,new LinearLayout.LayoutParams(-1,dp(1)));
  ScrollView scroll=new ScrollView(this);scroll.setFillViewport(false);scroll.setClipToPadding(false);
  body=col();body.setPadding(dp(17),dp(20),dp(17),dp(22));scroll.addView(body);
  layout.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
  LinearLayout nav=row();nav.setPadding(dp(11),dp(8),dp(11),dp(8));nav.setBackgroundColor(PANEL);
  String[][] tabs={{"dashboard","◈","خانه"},{"users","◎","کاربران"},{"bets","▤","شرط‌ها"},{"withdrawal","↗","مالی"},{"support","✉","تیکت"}};
  for(String[] tab:tabs){
   LinearLayout item=col();item.setGravity(Gravity.CENTER);
   TextView ic=text(tab[1],22,page.equals(tab[0])?GREEN:MUTED,true);ic.setGravity(Gravity.CENTER);item.addView(ic);
   TextView name=text(tab[2],10,page.equals(tab[0])?GREEN:MUTED,false);name.setGravity(Gravity.CENTER);item.addView(name);
   if("support".equals(tab[0])){supportBadge=name;updateSupportBadge();}
   nav.addView(item,new LinearLayout.LayoutParams(0,dp(53),1));item.setOnClickListener(v->showPage(tab[0]));
  }
  layout.addView(nav);
 }
 private void drawer(){
  if(drawerOpened)return;drawerOpened=true;
  FrameLayout cover=new FrameLayout(this);cover.setTag("drawer");cover.setBackgroundColor(0xBB030509);
  frame.addView(cover,new FrameLayout.LayoutParams(-1,-1));
  cover.setOnClickListener(v->{frame.removeView(cover);drawerOpened=false;});
  ScrollView scroll=new ScrollView(this);scroll.setBackgroundColor(PANEL);
  FrameLayout.LayoutParams fp=new FrameLayout.LayoutParams(dp(300),-1,Gravity.RIGHT);cover.addView(scroll,fp);
  scroll.setOnClickListener(v->{});
  LinearLayout menu=col();menu.setPadding(dp(19),dp(26),dp(19),dp(25));scroll.addView(menu);
  TextView head=text("BetVima Admin",23,FG,true);menu.addView(head);
  space(menu,5);menu.addView(text(email,11,MUTED,false));space(menu,23);
  for(String[] entry:MENU){
   LinearLayout item=row();item.setPadding(dp(11),dp(10),dp(11),dp(10));
   if(page.equals(entry[0]))item.setBackground(bg(Color.rgb(25,56,40),0,13));
   TextView icon=text(entry[1],22,page.equals(entry[0])?GREEN:MUTED,true);icon.setGravity(Gravity.CENTER);
   item.addView(icon,new LinearLayout.LayoutParams(dp(33),dp(40)));
   LinearLayout words=col();words.addView(text(entry[2],13,FG,true));words.addView(text(entry[3],10,MUTED,false));
   item.addView(words,new LinearLayout.LayoutParams(0,-2,1));
   menu.addView(item,new LinearLayout.LayoutParams(-1,dp(61)));
   item.setOnClickListener(v->{frame.removeView(cover);drawerOpened=false;showPage(entry[0]);});
  }
  space(menu,14);divider(menu);
  TextView address=text("آدرس API: "+api.origin(),10,MUTED,false);
  address.setMaxLines(3);menu.addView(address);
  addAction(menu,"⚙ تنظیم آدرس سرور",false,()->{
   frame.removeView(cover);drawerOpened=false;serverDialog();
  });
  addAction(menu,"آزمایش اتصال سرور",false,()->{
   api.perform(()->api.testServer(),d->showMessage("ارتباط HTTPS با API تایید شد."),this::showMessage);
  });
  space(menu,8);divider(menu);
  addAction(menu,"خروج امن از حساب",false,()->{
   new AlertDialog.Builder(this).setTitle("خروج از حساب").setMessage("نشست مدیریتی در این دستگاه پایان یابد؟")
    .setNegativeButton("انصراف",null).setPositiveButton("خروج",(d,w)->{
     api.perform(()->{api.logout();return new JSONObject();},o->showLogin(null),e->{api.clear();showLogin(null);});
    }).show();
  });
 }
 private void busy(String title){body.removeAllViews();centerText(body,title+" ...");}
 private void failure(String err){
  body.removeAllViews();
  LinearLayout p=panel(body);
  p.addView(text("دریافت اطلاعات ممکن نشد",16,RED,true));space(p,12);
  p.addView(text(err,12,MUTED,false));space(p,13);
  p.addView(label("آدرس فعلی سرور: "+api.origin()));space(p,7);
  addAction(p,"↻ تلاش دوباره",false,this::loadPage);
  addAction(p,"⚙ تغییر آدرس اتصال سرور",true,this::serverDialog);
  addAction(p,"آزمایش مسیر HTTPS و تنظیمات احراز هویت",false,()->{
   api.perform(()->api.testServer(),
    ok->showMessage("اتصال امن به سرور برقرار است. اگر خطا باقی ماند، APIهای پنل باید منتشر شوند."),
    this::showMessage);
  });
 }
 private interface Display {void done(JSONObject json);}
 /** Manual operator-controlled host selection, never automatically follows an unknown
  * redirect or sends stored bearer tokens to an unverified destination.
  */
 private void serverDialog(){
  LinearLayout box=col();box.setPadding(dp(18),dp(8),dp(18),dp(8));
  box.addView(text("دامنه HTTPS سرور BetVima را وارد کنید. آدرس باید API فعلی و همان پروژه Supabase را داشته باشد.",12,MUTED,false));
  EditText entry=input(box,"https://example.com",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);
  entry.setText(api.origin());entry.setSelectAllOnFocus(true);
  space(box,9);box.addView(label("آدرس IP، HTTP و گواهی SSL نامعتبر قبول نمی‌شوند. برای حفظ امنیت، بعد از تغییر سرور دوباره وارد شوید."));
  AlertDialog prompt=new AlertDialog.Builder(this).setTitle("تنظیم اتصال سرور")
   .setView(box).setNegativeButton("انصراف",(d,w)->{})
   .setPositiveButton("تست و ذخیره",null).create();
  prompt.setOnShowListener(dialog->prompt.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
   String entered=entry.getText().toString().trim();
   prompt.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
   api.perform(()->api.configureServer(entered),response->{
    prompt.dismiss();loggedIn=false;showLogin("سرور جدید تأیید شد. با حساب ادمین دوباره وارد شوید.");
   },error->{
    if(prompt.isShowing())prompt.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
    showMessage("سرور جدید تأیید نشد:\n"+error);
   });
  }));
  prompt.show();
 }
 private void request(String path,Display handler){
  busy("دریافت اطلاعات");
  api.perform(()->api.get(path),handler::done,e->failure(e));
 }
 private void loadPage(){
  switch(page){
   case "dashboard":dashboard();break;
   case "users":list("users",query);break;
   case "bets":list("bets",query);break;
   case "deposit":case "withdrawal":list("payments",page);break;
   case "support":list("support",query);break;
   case "manual":list("manual","");break;
   case "casino":casino();break;
   case "notifications":list("notifications","");break;
   case "affiliates":list("affiliates","");break;
   case "audit":list("audit","");break;
   case "operations":operations();break;
  }
 }
 private void updateSupportBadge(){
  if(supportBadge!=null){
   supportBadge.setText(unansweredTickets>0?"تیکت "+unansweredTickets:"تیکت");
   supportBadge.setTextColor(unansweredTickets>0?RED:(page.equals("support")?GREEN:MUTED));
  }
 }
 private void refreshSupportBadge(){
  if(!loggedIn)return;
  api.perform(()->api.get("/api/v1/admin/support?page=1&pageSize=100"),data->{
   JSONObject tickets=data.optJSONObject("tickets");
   JSONArray rows=tickets!=null?tickets.optJSONArray("items"):data.optJSONArray("tickets");
   int count=0;
   if(rows!=null)for(int i=0;i<rows.length();i++){
    JSONObject ticket=rows.optJSONObject(i);
    if(ticket!=null && !"closed".equals(ticket.optString("status")) &&
       !"resolved".equals(ticket.optString("status")))count+=Math.max(0,ticket.optInt("unreadMessages"));
   }
   unansweredTickets=count;updateSupportBadge();
  },err->{/* Keep last known badge and never clear a real pending message on transient failure. */});
 }
 @Override protected void onResume(){super.onResume();supportRefresh.removeCallbacks(supportTicker);supportRefresh.postDelayed(supportTicker,45000);}
 @Override protected void onPause(){supportRefresh.removeCallbacks(supportTicker);super.onPause();}
 private LinearLayout sectionGroup(String title,String hint,boolean expanded){
  LinearLayout card=panel(body);
  TextView heading=text((expanded?"▾ ":"▸ ")+title,16,FG,true);
  card.addView(heading);space(card,6);card.addView(text(hint,11,MUTED,false));
  LinearLayout content=col();content.setVisibility(expanded?View.VISIBLE:View.GONE);
  space(card,10);card.addView(content);
  heading.setOnClickListener(v->{
   boolean open=content.getVisibility()!=View.VISIBLE;
   content.setVisibility(open?View.VISIBLE:View.GONE);
   heading.setText((open?"▾ ":"▸ ")+title);
  });
  return content;
 }
 private String faStatus(String value){
  switch(value){
   case "accepted":return "باز";case "partially_settled":return "بخشی تسویه‌شده";
   case "manual_review":return "در انتظار بررسی";case "settled":return "تسویه‌شده";
   case "cashed_out":return "نقدشده";case "won":return "برد";case "lost":return "باخت";
   case "void":return "باطل";case "cancelled":return "لغوشده";case "rejected":return "ردشده";
   case "active":return "فعال";case "suspended":return "مسدود";case "closed":return "بسته";
   case "open":return "باز";case "waiting_support":return "منتظر پشتیبانی";
   case "waiting_user":return "منتظر کاربر";case "resolved":return "حل‌شده";
   case "completed":return "تکمیل‌شده";case "sent":return "ارسال‌شده";case "draft":return "پیش‌نویس";
   default:return value==null?"—":value;
  }
 }
 private void switcher(){
  LinearLayout line=row();line.setBackground(bg(PANEL,EDGE,15));pad(line,4);
  String[][] options={{"24h","امروز"},{"7d","۷ روز"},{"30d","۳۰ روز"}};
  for(String[] opt:options){
   TextView t=text(opt[1],13,period.equals(opt[0])?FG:MUTED,period.equals(opt[0]));
   t.setGravity(Gravity.CENTER);if(period.equals(opt[0]))t.setBackground(bg(Color.rgb(54,64,65),0,12));
   line.addView(t,new LinearLayout.LayoutParams(0,dp(43),1));
   t.setOnClickListener(v->{period=opt[0];loadPage();});
  }
  LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(15);body.addView(line,lp);
 }
 private void metric(LinearLayout container,String title,String figure,String foot){
  LinearLayout card=panel(container);card.addView(label(title));space(card,10);
  TextView number=text(figure,21,FG,true);number.setSingleLine(true);number.setEllipsize(TextUtils.TruncateAt.END);card.addView(number);
  space(card,8);card.addView(text(foot,10,MUTED,false));
 }
 private void dashboard(){
  request("/api/v1/admin/dashboard?window="+period,json->{
   body.removeAllViews();switcher();
   JSONObject m=json.optJSONObject("metrics");
   if(m==null){failure("داده‌های داشبورد ناقص است");return;}
   JSONObject b=m.optJSONObject("betting"),u=m.optJSONObject("users"),w=m.optJSONObject("wallet");
   if(b==null)b=new JSONObject();if(u==null)u=new JSONObject();if(w==null)w=new JSONObject();
   LinearLayout featured=hero(body);
   featured.addView(text("SPORTSBOOK · GROSS PROFIT",11,GREEN,true));
   space(featured,12);featured.addView(text("سود ناخالص شرط‌بندی ورزشی",13,FG,false));
   space(featured,9);featured.addView(text(cash(b.optString("ggr24hMinor","0")),34,FG,true));
   space(featured,12);featured.addView(text("نتیجه مبلغ شرط منهای پرداخت‌های ورزشی در این بازه",10,MUTED,false));
   addTitle(body,"عملکرد انتخاب‌شده");
   LinearLayout grid=row();
   LinearLayout right=col(),left=col();grid.addView(right,new LinearLayout.LayoutParams(0,-2,1));
   LinearLayout.LayoutParams l=new LinearLayout.LayoutParams(0,-2,1);l.rightMargin=dp(10);grid.addView(left,l);
   body.addView(grid);
   metric(right,"ثبت‌نام جدید",u.optString("new24h","—"),"کل کاربران: "+u.optString("total","—"));
   metric(left,"شرط ثبت‌شده",b.optString("bets24h","—"),"شرط باز: "+b.optString("openBets","—"));
   metric(right,"واریز دوره",cash(w.optString("deposits24hMinor","0")),"حجم پرداخت");
   metric(left,"برداشت دوره",cash(w.optString("withdrawals24hMinor","0")),"در انتظار: "+w.optString("pendingWithdrawals","—"));
   addTitle(body,"دسترسی سریع");
   for(String[] link:new String[][]{{"users","مدیریت کاربران","حساب، وضعیت و تراکنش‌ها"},{"support","صندوق پشتیبانی","پاسخ تیکت‌های کاربران"},{"manual","افزودن بازی دستی","مسابقات بدون مارکت"},{"casino","حسابداری کازینو","گزارش به تفکیک ارز"}})
    menuRow(body,link[1],link[2],()->showPage(link[0]));
   LinearLayout c=panel(body);c.addView(text("وضعیت سود کازینو",14,FG,true));
   space(c,10);c.addView(label("به تفکیک ارز و ارائه‌دهنده • بدون جمع‌زدن ارزهای متفاوت"));
   addAction(c,"مشاهده گردش کازینو ←",false,()->showPage("casino"));
  });
 }
 private void menuRow(LinearLayout host,String title,String sub,Runnable click){
  LinearLayout p=panel(host),r=row();
  LinearLayout words=col();words.addView(text(title,14,FG,true));words.addView(text(sub,10,MUTED,false));
  r.addView(words,new LinearLayout.LayoutParams(0,-2,1));
  r.addView(text("‹",27,GREEN,true));
  p.addView(r);p.setOnClickListener(v->click.run());
 }
 private void searchUi(String section){
  LinearLayout bar=row();EditText q=field("جستجو با ایمیل، شناسه یا عنوان",InputType.TYPE_CLASS_TEXT);
  q.setText(query);
  bar.addView(q,new LinearLayout.LayoutParams(0,dp(47),1));
  TextView go=action("جستجو",true,()->{query=q.getText().toString().trim();if(section.equals("users"))userPage=1;list(section,query);});
  LinearLayout.LayoutParams bl=new LinearLayout.LayoutParams(dp(86),dp(47));bl.rightMargin=dp(8);bar.addView(go,bl);
  body.addView(bar);space(body,15);
  q.setOnEditorActionListener((v,action,event)->{query=q.getText().toString().trim();list(section,query);return true;});
 }
 private void list(String section,String filter){
  String path;
  switch(section){
   case "users":path="/api/v1/admin/users?page="+userPage+"&pageSize=25&sort="+userOrder+"&role=user,affiliate&q="+enc(filter);break;
   case "bets":path="/api/v1/admin/bets?page=1&pageSize=40&q="+enc(filter);break;
   case "payments":path="/api/v1/admin/payments?page=1&pageSize=40&direction="+filter;break;
   case "support":path="/api/v1/admin/support?page=1&pageSize=40&search="+enc(filter);break;
   case "manual":path="/api/v1/admin/mobile/manual-matches";break;
   case "notifications":path="/api/v1/admin/notifications?page=1";break;
   case "affiliates":path="/api/v1/admin/affiliates?page=1&pageSize=40";break;
   case "audit":path="/api/v1/admin/audit?page=1&pageSize=40";break;
   default:throw new IllegalArgumentException("section");
  }
  request(path,json->{
   body.removeAllViews();
   if(section.equals("users")||section.equals("bets")||section.equals("support"))searchUi(section);
   if(section.equals("manual"))addAction(body,"＋ ثبت مسابقه جدید",true,this::manualForm);
   if(section.equals("notifications")){
    addAction(body,"＋ ارسال اعلان جدید به کاربران",true,this::notificationCompose);
    addTitle(body,"اعلان‌های ثبت‌شده");
   }
   if(section.equals("support")){
    addTitle(body,"تیکت‌های نیازمند پاسخ");
    addAction(body,"↻ بروزرسانی پیام‌های جدید",false,()->list("support",query));
   }
   JSONArray arr;
   if(section.equals("support")){
    JSONObject tickets=json.optJSONObject("tickets");
    arr=tickets==null?json.optJSONArray("tickets"):tickets.optJSONArray("items");
   }else arr=json.optJSONArray("items");
   if(arr==null||arr.length()==0){centerText(body,section.equals("notifications")?"هنوز اعلانی ثبت نشده است. برای ارسال، دکمه بالا را بزنید.":"در این بخش اطلاعاتی ثبت نشده است.");if(section.equals("users")&&userPage>1)addAction(body,"صفحه قبل",false,()->{userPage--;list("users",query);});return;}
   if(!section.equals("notifications")&&!section.equals("support"))addTitle(body,section.equals("users")?("oldest".equals(userOrder)?"کاربران قدیمی":"کاربران جدید"):"جدیدترین موارد");
   for(int i=0;i<arr.length();i++){
    JSONObject item=arr.optJSONObject(i);if(item==null)continue;
    String name="",subtitle="",total="",status=pick(item,"status");
    switch(section){
     case "users":
      name=pick(item,"email","username","publicId");
      subtitle="شناسه "+pick(item,"publicId")+" · "+date(pick(item,"registeredAt"));
      total=money(item,"usdBalanceMinor","usdBalanceMinor");break;
     case "bets":
      name="شرط #"+pick(item,"publicId","id");
      subtitle=date(pick(item,"placedAt"))+" · "+pick(item,"type");
      total=money(item,"usdStakeMinor","stakeMinor");break;
     case "payments":
      name=filter.equals("deposit")?"واریز":"برداشت";
      subtitle=pick(item,"publicId","id")+" · "+date(pick(item,"initiatedAt","createdAt"));
      total=money(item,"usdAmountMinor","amountMinor");break;
     case "support":
      name=pick(item,"subject");subtitle=pick(item,"userEmail","userDisplayName")+" · "+date(pick(item,"updatedAt"));
      total=item.optInt("unreadMessages",0)>0?item.optInt("unreadMessages",0)+" منتظر پاسخ":"پاسخ داده‌شده";break;
     case "manual":
      name=pick(item,"home")+" - "+pick(item,"away");
      subtitle=pick(item,"league")+" · "+date(pick(item,"scheduledAt"));
      total="بدون ضریب";break;
     case "notifications":
      name=pick(item,"title");subtitle=("personal".equals(item.optString("audience"))?"شخصی":"همگانی")+" · "+date(pick(item,"created_at"));
      total=faStatus(pick(item,"status"))+" · "+pick(item,"delivered")+" گیرنده";break;
     case "affiliates":
      name=pick(item,"username","name","id");subtitle=pick(item,"model");
      total=money(item,"usdPayableMinor","payableMinor");break;
     case "audit":
      name=pick(item,"action","event_key");subtitle=pick(item,"actorId","actor_id");
      total=date(pick(item,"createdAt","created_at"));break;
    }
    JSONObject record=item;String s=section;
    itemRow(name,subtitle,status,total,()->details(s,record));
   }
   if(section.equals("users")||section.equals("bets")||section.equals("payments"))body.addView(label(section.equals("users")?"برای دیدن شرط‌ها و کازینو، پرونده هر کاربر را باز کنید.":"برای محدود کردن نتایج از جستجو استفاده کنید."));
  });
 }
 private String enc(String s){
  try{return java.net.URLEncoder.encode(s,"UTF-8");}catch(Exception e){return "";}
 }
 private void itemRow(String title,String subtitle,String status,String trailing,Runnable click){
  LinearLayout panel=panel(body);LinearLayout r=row();
  TextView badge=text("◉",21,GREEN,true);badge.setGravity(Gravity.CENTER);
  badge.setBackground(bg(Color.rgb(33,55,45),0,13));r.addView(badge,new LinearLayout.LayoutParams(dp(45),dp(45)));
  LinearLayout words=col();words.setPadding(dp(12),0,dp(9),0);
  TextView t=text(title,13,FG,true);t.setSingleLine(true);t.setEllipsize(TextUtils.TruncateAt.END);
  words.addView(t);space(words,5);
  TextView sub=text(subtitle,10,MUTED,false);sub.setMaxLines(2);words.addView(sub);
  space(words,7);words.addView(text(status,10,AMBER,true));
  r.addView(words,new LinearLayout.LayoutParams(0,-2,1));
  TextView extra=text(trailing,11,FG,true);extra.setGravity(Gravity.LEFT|Gravity.CENTER_VERTICAL);
  extra.setMaxLines(2);r.addView(extra,new LinearLayout.LayoutParams(dp(92),-2));
  panel.addView(r);panel.setOnClickListener(v->click.run());
 }
 private void details(String section,JSONObject item){
  selected=item;selectedId=pick(item,"id");showingUserDetail="users".equals(section);
  createPage("جزئیات "+titleFor(page),"ثبت‌شده در BetVima • "+selectedId);
  switch(section){
   case "users":userDetail(item);break;
   case "bets":betDetail(item);break;
   case "support":ticketDetail(item);break;
   case "notifications":notificationDetail(item);break;
   case "payments":paymentDetail(item);break;
   default:generic(item,"جزئیات ثبت‌شده");
  }
 }
 private void generic(JSONObject json,String title){
  addTitle(body,title);
  LinearLayout c=panel(body);
  JSONArray names=json.names();
  if(names==null){centerText(c,"اطلاعاتی ثبت نشده است");return;}
  int max=Math.min(names.length(),20);
  for(int i=0;i<max;i++){
   String key=names.optString(i,"");
   Object v=json.opt(key);
   if(v==null||v==JSONObject.NULL)continue;
   String value=String.valueOf(v);
   if(value.length()>150)value=value.substring(0,150)+"…";
   info(c,key,value);
  }
 }
 private void userDetail(JSONObject item){
  String id=item.optString("id","");
  if(id.isEmpty()){showMessage("شناسه کاربر موجود نیست");return;}
  body.removeAllViews();
  centerText(body,"در حال دریافت پرونده کاربر ...");
  requestInto("/api/v1/admin/mobile/user-overview/"+enc(id),json->{
   if(!id.equals(selectedId)||!"users".equals(page))return;
   body.removeAllViews();
   JSONObject u=json.optJSONObject("user");
   if(u==null){centerText(body,"اطلاعات کاربر ناقص است");return;}
   addTitle(body,"پرونده کاربر");
   LinearLayout identity=sectionGroup("هویت و وضعیت حساب","ایمیل، شناسه، ثبت‌نام و آخرین فعالیت",true);
   info(identity,"ایمیل",pick(u,"email"));
   info(identity,"شناسه عددی",pick(u,"numericId"));
   info(identity,"شناسه عمومی",pick(u,"publicId"));
   info(identity,"نام کاربری",pick(u,"username"));
   info(identity,"تاریخ ثبت‌نام",date(pick(u,"registeredAt")));
   String source=pick(u,"registrationSource");
   info(identity,"محل ثبت‌نام",source.equals("app")?"اپلیکیشن":source.equals("web")?"وب‌سایت":"نامشخص");
   info(identity,"وضعیت حساب",faStatus(pick(u,"status")));
   info(identity,"آخرین ورود",date(pick(u,"lastLoginAt")));
   info(identity,"آخرین فعالیت",date(pick(u,"lastSeenAt")));
   info(identity,"وضعیت نشست",u.optBoolean("recentlyActive")?"فعال در ۵ دقیقه اخیر":"نشست فعال اخیر مشاهده نشد");
   info(identity,"تأیید کازینو",faStatus(pick(u,"kycStatus")));

   JSONArray wallets=json.optJSONArray("balances");
   LinearLayout walletSection=sectionGroup("موجودی فعلی کیف پول","مبالغ در ارز واقعی حساب، بدون تبدیل تخمینی",true);
   if(wallets==null||wallets.length()==0)centerText(walletSection,"کیف پولی ثبت نشده");
   if(wallets!=null)for(int i=0;i<wallets.length();i++){
    JSONObject w=wallets.optJSONObject(i);if(w==null)continue;
    String currency=pick(w,"currency");
    info(walletSection,"موجودی "+currency,amountMinor(w.optString("balanceMinor","0"),currency));
    info(walletSection,"مبلغ قفل‌شده",amountMinor(w.optString("lockedMinor","0"),currency));
    info(walletSection,"وضعیت",w.optBoolean("frozen")?"مسدود":"فعال");
    divider(walletSection);
   }

   LinearLayout finance=sectionGroup("واریز و برداشت","فقط پرداخت‌های تکمیل‌شده",false);
   JSONArray pays=json.optJSONArray("paymentTotals");
   if(pays==null||pays.length()==0)centerText(finance,"تراکنش تکمیل‌شده ندارد");
   if(pays!=null)for(int i=0;i<pays.length();i++){
    JSONObject p=pays.optJSONObject(i);if(p==null)continue;
    info(finance,p.optString("direction").equals("deposit")?"جمع شارژ":"جمع برداشت",
      amountMinor(p.optString("amountMinor","0"),pick(p,"currency")));
    info(finance,"تعداد تراکنش موفق",pick(p,"count"));
    divider(finance);
   }

   LinearLayout sports=sectionGroup("شرط‌های ورزشی","همه شرط‌ها فقط برای همین کاربر، با زمان و جزئیات انتخاب",true);
   JSONArray bets=json.optJSONArray("betting");
   if(bets==null||bets.length()==0)centerText(sports,"هنوز شرطی ثبت نشده");
   if(bets!=null)for(int i=0;i<bets.length();i++){
    JSONObject b=bets.optJSONObject(i);if(b==null)continue;
    String currency=pick(b,"currency");
    info(sports,"شرط‌های باز · "+currency,pick(b,"openCount"));
    info(sports,"مبلغ شرط‌های باز",amountMinor(b.optString("openStakeMinor","0"),currency));
    info(sports,"شرط‌های بسته‌شده",pick(b,"closedCount"));
    info(sports,"مبلغ بسته‌شده",amountMinor(b.optString("closedStakeMinor","0"),currency));
    info(sports,"سود/زیان کاربر (تسویه‌شده)",amountMinor(b.optString("customerNetMinor","0"),currency));
    info(sports,"سود/زیان سایت (تسویه‌شده)",amountMinor(b.optString("siteNetMinor","0"),currency));
    divider(sports);
   }
   addAction(sports,"همه شرط‌های همین کاربر",true,()->userBetsPage(id,"all",1));
   addAction(sports,"شرط‌های باز",false,()->userBetsPage(id,"open",1));
   addAction(sports,"شرط‌های بسته و تسویه‌شده",false,()->userBetsPage(id,"closed",1));
   LinearLayout recent=col();sports.addView(recent);
   loadRecentUserBets(id,recent);

   LinearLayout casino=sectionGroup("سود و زیان کازینو","گردش واقعی، تفکیک ارائه‌دهنده و ارز",true);
   JSONArray casinos=json.optJSONArray("casino");
   if(casinos==null||casinos.length()==0)centerText(casino,"بازی کازینویی ثبت نشده");
   if(casinos!=null)for(int i=0;i<casinos.length();i++){
    JSONObject r=casinos.optJSONObject(i);if(r==null)continue;
    String currency=pick(r,"currency");
    casino.addView(text("internal_slots".equals(r.optString("source"))?"اسلات اختصاصی":"ارائه‌دهنده خارجی",13,GREEN,true));
    info(casino,"ارز",currency);
    info(casino,"دورهای قابل‌شمارش",pick(r,"rounds"));
    info(casino,"مجموع شرط‌ها",amountMinor(r.optString("stakeMinor","0"),currency));
    info(casino,"مجموع بردهای پرداختی",amountMinor(r.optString("payoutMinor","0"),currency));
    info(casino,"بازگشت شرط لغوشده",amountMinor(r.optString("refundMinor","0"),currency));
    info(casino,"سود / زیان کاربر",amountMinor(r.optString("netUserMinor","0"),currency));
    info(casino,"سود / زیان سایت",amountMinor(r.optString("netSiteMinor","0"),currency));
    divider(casino);
   }

   LinearLayout bonusSection=sectionGroup("بونوس‌های فعال و گذشته","مبلغ اعطا، باقی‌مانده، انقضا و وضعیت",false);
   JSONArray bonuses=json.optJSONArray("bonuses");
   if(bonuses==null||bonuses.length()==0)centerText(bonusSection,"بونوسی ثبت نشده");
   if(bonuses!=null)for(boolean active:new boolean[]{true,false}){
    addTitle(bonusSection,active?"بونوس‌های فعال":"بونوس‌های قبلی");
    int shown=0;
    for(int i=0;i<bonuses.length();i++){
     JSONObject b=bonuses.optJSONObject(i);if(b==null||b.optBoolean("active")!=active)continue;
     shown++;
     info(bonusSection,"عنوان",pick(b,"title"));
     info(bonusSection,"وضعیت",faStatus(pick(b,"status")));
     info(bonusSection,"مبلغ",amountMinor(b.optString("amountMinor","0"),pick(b,"currency")));
     info(bonusSection,"باقی‌مانده",amountMinor(b.optString("remainingMinor","0"),pick(b,"currency")));
     info(bonusSection,"تاریخ اعطا",date(pick(b,"grantedAt")));
     info(bonusSection,"انقضا",date(pick(b,"expiresAt")));
     divider(bonusSection);
    }
    if(shown==0)centerText(bonusSection,"موردی موجود نیست");
   }

   LinearLayout actions=sectionGroup("اقدامات مدیریتی","تمام عملیات از API امن و حسابرسی عبور می‌کنند",false);
   addAction(actions,"active".equals(u.optString("status"))?"مسدودسازی حساب":"فعال‌کردن حساب",false,()->userStatus(u));
   addAction(actions,"تأیید کازینو (صفحه موجود سایت)",false,this::openCasinoApproval);
   addAction(actions,"تغییر رمز کاربر",false,()->resetUserPassword(id));
   addAction(actions,"ارسال اعلان فقط برای همین کاربر",true,()->sendUserNotice(id));
   addAction(actions,"افزایش یا کاهش موجودی",false,()->adjustUserWallet(id,wallets));
   addAction(body,"بازگشت به فهرست کاربران",false,()->showPage("users"));
  });
 }
 private void loadRecentUserBets(String userId,LinearLayout host){
  api.perform(()->api.get("/api/v1/admin/mobile/user-bets/"+enc(userId)+"?status=all&page=1"),data->{
   if(!"users".equals(page)||!userId.equals(selectedId))return;
   JSONArray rows=data.optJSONArray("items");
   if(rows==null||rows.length()==0){centerText(host,"شرطی برای این کاربر یافت نشد");return;}
   addTitle(host,"آخرین شرط‌ها");
   for(int i=0;i<Math.min(5,rows.length());i++){
    JSONObject b=rows.optJSONObject(i);if(b==null)continue;
    LinearLayout c=col();host.addView(c);
    String title="شرط "+pick(b,"publicId")+" · "+faStatus(pick(b,"status"));
    addAction(c,title,false,()->showBetInformation(b,c));
    info(c,"ثبت",date(pick(b,"placedAt")));
    info(c,"مبلغ شرط",amountMinor(b.optString("stakeMinor","0"),pick(b,"currency")));
    divider(c);
   }
  },err->centerText(host,"جزئیات شرط‌ها در دسترس نیست: "+err));
 }
 private void userBetsPage(String id,String state,int number){
  if(!"users".equals(page)||!id.equals(selectedId))return;
  body.removeAllViews();
  addTitle(body,"شرط‌های اختصاصی همین کاربر");
  addAction(body,"بازگشت به پرونده کاربر",false,()->userDetail(selected));
  LinearLayout filters=row();
  for(String[] option:new String[][]{{"all","همه"},{"open","باز"},{"closed","بسته"}}){
   TextView chip=action(option[1],option[0].equals(state),()->userBetsPage(id,option[0],1));
   filters.addView(chip,new LinearLayout.LayoutParams(0,dp(46),1));
  }
  body.addView(filters);space(body,10);
  centerText(body,"در حال دریافت شرط‌های کاربر ...");
  api.perform(()->api.get("/api/v1/admin/mobile/user-bets/"+enc(id)+"?status="+state+"&page="+number),data->{
   if(!"users".equals(page)||!id.equals(selectedId))return;
   // Keep the filter strip and return action, remove only its loading label.
   if(body.getChildCount()>3)body.removeViewAt(body.getChildCount()-1);
   JSONArray rows=data.optJSONArray("items");
   if(rows==null||rows.length()==0){centerText(body,"در این دسته شرطی یافت نشد");return;}
   for(int i=0;i<rows.length();i++){
    JSONObject b=rows.optJSONObject(i);if(b==null)continue;
    LinearLayout c=panel(body);
    String currency=pick(b,"currency");
    c.addView(text("کد شرط: "+pick(b,"publicId"),14,GREEN,true));
    info(c,"وضعیت",faStatus(pick(b,"status")));
    info(c,"نوع شرط",faBetType(pick(b,"type")));
    info(c,"زمان دقیق ثبت",date(pick(b,"placedAt")));
    info(c,"زمان تسویه",date(pick(b,"settledAt")));
    info(c,"مبلغ شرط",amountMinor(b.optString("stakeMinor","0"),currency));
    info(c,"برد احتمالی",amountMinor(b.optString("potentialPayoutMinor","0"),currency));
    info(c,"مبلغ تسویه واقعی",b.isNull("payoutMinor")?"تسویه نشده":amountMinor(b.optString("payoutMinor","0"),currency));
    info(c,"ضریب کل",formatOdds(pick(b,"combinedOddsScaled")));
    info(c,"موجودی پیش از شرط",b.isNull("balanceBeforePlacementMinor")?"ثبت نشده":amountMinor(b.optString("balanceBeforePlacementMinor"),currency));
    info(c,"موجودی بعد از شرط",b.isNull("balanceAfterPlacementMinor")?"ثبت نشده":amountMinor(b.optString("balanceAfterPlacementMinor"),currency));
    info(c,"محل ثبت شرط",faDevice(pick(b,"device")));
    JSONArray legs=b.optJSONArray("legs");
    if(legs!=null)for(int k=0;k<legs.length();k++){
     JSONObject leg=legs.optJSONObject(k);if(leg==null)continue;
     LinearLayout legCard=col();legCard.setBackground(bg(Color.rgb(29,35,42),0,12));pad(legCard,12);
     LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.topMargin=dp(8);c.addView(legCard,lp);
     legCard.addView(text("انتخاب "+(k+1),12,GREEN,true));
     info(legCard,"مسابقه",pick(leg,"match"));
     info(legCard,"بازار",pick(leg,"market"));
     info(legCard,"آپشن انتخاب‌شده",pick(leg,"selection"));
     info(legCard,"ضریب انتخاب",formatOdds(pick(leg,"oddsScaled")));
     info(legCard,"وضعیت انتخاب",faStatus(pick(leg,"status")));
     info(legCard,"زمان نتیجه",date(pick(leg,"settledAt")));
    }
   }
   LinearLayout pager=row();
   if(number>1)pager.addView(action("صفحه قبل",false,()->userBetsPage(id,state,number-1)),new LinearLayout.LayoutParams(0,dp(46),1));
   if(data.optBoolean("hasMore"))pager.addView(action("صفحه بعد",true,()->userBetsPage(id,state,number+1)),new LinearLayout.LayoutParams(0,dp(46),1));
   body.addView(pager);
  },this::showMessage);
 }
 private String faBetType(String value){
  if("single".equals(value))return "تکی";
  if("multiple".equals(value)||"accumulator".equals(value))return "ترکیبی";
  if("system".equals(value))return "سیستمی";
  return value;
 }
 private String faDevice(String value){
  if("android".equals(value)||"app".equals(value))return "اپلیکیشن";
  if("web".equals(value))return "وب‌سایت";
  return "—".equals(value)?"ثبت نشده":value;
 }
 private String formatOdds(String scaled){
  try{
   if("—".equals(scaled))return "—";
   return new DecimalFormat("0.00",java.text.DecimalFormatSymbols.getInstance(Locale.US)).format(
     new BigDecimal(scaled).movePointLeft(4));
  }catch(Exception ignore){return "—";}
 }
 private void showBetInformation(JSONObject bet,LinearLayout host){
  JSONArray legs=bet.optJSONArray("legs");if(legs==null||legs.length()==0){showMessage("جزئیات انتخاب ثبت نشده");return;}
  StringBuilder out=new StringBuilder();
  for(int i=0;i<legs.length();i++){
   JSONObject l=legs.optJSONObject(i);if(l==null)continue;
   out.append("\nانتخاب ").append(i+1).append(": ").append(pick(l,"selection"));
   out.append("\nمسابقه: ").append(pick(l,"match"));
   out.append("\nبازار: ").append(pick(l,"market"));
   out.append("\nضریب: ").append(formatOdds(pick(l,"oddsScaled"))).append("\n");
  }
  new AlertDialog.Builder(this).setTitle("انتخاب‌های شرط").setMessage(out.toString())
   .setPositiveButton("بستن",null).show();
 }
 private void openCasinoApproval(){
  // Do not duplicate, weaken, or alter the existing web KYC approval flow.
  new AlertDialog.Builder(this).setTitle("تأیید کازینو")
   .setMessage("همان صفحه تأیید هویت موجود در پنل وب باز می‌شود. تأیید مدارک و سن فقط در همان صفحه انجام می‌شود.")
   .setNegativeButton("انصراف",null).setPositiveButton("بازکردن صفحه رسمی",(d,w)->{
     Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse("https://betvima.com/admin/casino-approvals"));
     startActivity(intent);
   }).show();
 }
 private void showUserBets(String id,boolean open){
  String statuses=open?"accepted,partially_settled":"settled,void,cancelled,cashed_out,rejected,reversed";
  requestInto("/api/v1/admin/bets?page=1&pageSize=30&userId="+enc(id)+"&status="+enc(statuses),json->{
   if(!page.equals("users")||!selectedId.equals(id))return;
   addTitle(body,open?"آخرین شرط‌های باز":"آخرین شرط‌های بسته‌شده");
   JSONArray items=json.optJSONArray("items");
   if(items==null||items.length()==0){centerText(body,"شرطی در این وضعیت ثبت نشده");return;}
   for(int i=0;i<items.length();i++){
    JSONObject b=items.optJSONObject(i);if(b==null)continue;
    LinearLayout c=panel(body);
    info(c,"شماره شرط",pick(b,"publicId","id"));
    info(c,"وضعیت",pick(b,"status"));
    info(c,"تاریخ",date(pick(b,"placedAt")));
    String currency=pick(b,"currency");
    info(c,"مبلغ شرط",amountMinor(b.optString("stakeMinor","0"),currency));
    info(c,"پرداخت تسویه",b.isNull("settledPayoutMinor")?"—":amountMinor(b.optString("settledPayoutMinor","0"),currency));
   }
  });
 }
 private void resetUserPassword(String id){
  LinearLayout form=col();pad(form,12);
  EditText pass=input(form,"رمز جدید (حداقل ۸ کاراکتر)",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
  EditText confirm=input(form,"تکرار رمز جدید",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
  EditText reason=input(form,"دلیل تغییر (حداقل ۸ کاراکتر)",InputType.TYPE_CLASS_TEXT);
  AlertDialog dialog=new AlertDialog.Builder(this).setTitle("تغییر رمز حساب")
    .setView(form).setNegativeButton("انصراف",null).setPositiveButton("تغییر رمز",null).create();
  dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
   String p=pass.getText().toString(),c=confirm.getText().toString(),why=reason.getText().toString().trim();
   if(p.length()<8||p.length()>128||!p.equals(c)||why.length()<8){showMessage("رمزها باید برابر و حداقل ۸ حرف باشند و دلیل تغییر معتبر باشد");return;}
   dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
   api.perform(()->api.post("/api/v1/admin/users/"+enc(id)+"/password",
    new JSONObject().put("password",p).put("reason",why)),
    ok->{pass.setText("");confirm.setText("");dialog.dismiss();showMessage("رمز با موفقیت تغییر کرد. عملیات ثبت حسابرسی شد.");},
    err->{dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);showMessage(err);});
  }));
  dialog.show();
 }
 private void sendUserNotice(String id){
  LinearLayout form=col();pad(form,12);
  EditText title=input(form,"عنوان اعلان",InputType.TYPE_CLASS_TEXT);
  EditText message=input(form,"متن اعلان فقط برای این کاربر",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE);
  message.setSingleLine(false);message.setMinLines(3);
  AlertDialog dialog=new AlertDialog.Builder(this).setTitle("اعلان شخصی").setView(form)
   .setNegativeButton("انصراف",null).setPositiveButton("ارسال",null).create();
  dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
   String t=title.getText().toString().trim(),b=message.getText().toString().trim();
   if(t.isEmpty()||t.length()>100||b.isEmpty()||b.length()>500){showMessage("عنوان ۱ تا ۱۰۰ و متن ۱ تا ۵۰۰ کاراکتر باشد");return;}
   dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
   api.perform(()->api.post("/api/v1/admin/notifications",
    new JSONObject().put("audience","personal").put("targetUserId",id)
      .put("title",t).put("body",b).put("mode","send").put("locale","fa")),
    ok->{dialog.dismiss();showMessage("اعلان فقط به صندوق پیام همین کاربر ارسال شد.");},
    err->{dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);showMessage(err);});
  }));
  dialog.show();
 }
 private void adjustUserWallet(String id,JSONArray wallets){
  if(wallets==null||wallets.length()==0){showMessage("کیف پولی برای این کاربر ثبت نشده است.");return;}
  java.util.ArrayList<String> currencies=new java.util.ArrayList<>();
  for(int i=0;i<wallets.length();i++){
   JSONObject w=wallets.optJSONObject(i);if(w!=null){
    String c=w.optString("currency","");
    if(java.util.Arrays.asList("USD","IRT","IRR","EUR","GBP").contains(c)&&!currencies.contains(c))currencies.add(c);
   }
  }
  if(currencies.isEmpty()){showMessage("ارز معتبر برای تعدیل موجودی موجود نیست.");return;}
  LinearLayout form=col();pad(form,12);
  form.addView(label("انتخاب ارز کیف پول موجود:"));
  Spinner currency=new Spinner(this);
  ArrayAdapter<String> adapter=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,currencies);
  currency.setAdapter(adapter);form.addView(currency);
  EditText amount=input(form,"مبلغ به واحد اصلی ارز (مثلاً 10.50)",InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);
  EditText reason=input(form,"دلیل درخواست (حداقل ۸ کاراکتر)",InputType.TYPE_CLASS_TEXT);
  final boolean[] credit={true};
  TextView direction=action("نوع درخواست: افزایش موجودی",false,()->{credit[0]=!credit[0];});
  direction.setOnClickListener(v->{
   credit[0]=!credit[0];direction.setText(credit[0]?"نوع درخواست: افزایش موجودی":"نوع درخواست: کاهش موجودی");
  });
  form.addView(direction);
  form.addView(label("این درخواست به‌تنهایی پول جابه‌جا نمی‌کند؛ تأیید مدیر دوم لازم است."));
  AlertDialog dialog=new AlertDialog.Builder(this).setTitle("درخواست تعدیل کیف پول")
   .setView(form).setNegativeButton("انصراف",null).setPositiveButton("ثبت درخواست",null).create();
  dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
   String why=reason.getText().toString().trim(),selected=(String)currency.getSelectedItem();
   String minor;
   try{
    BigDecimal decimal=new BigDecimal(amount.getText().toString().trim());
    if(decimal.signum()<=0)throw new Exception();
    minor=decimal.movePointRight(2).toBigIntegerExact().toString();
    if(minor.length()>19)throw new Exception();
   }catch(Exception e){showMessage("مبلغ باید مثبت و دارای حداکثر دو رقم اعشار باشد.");return;}
   if(why.length()<8){showMessage("دلیل درخواست حداقل ۸ کاراکتر باشد.");return;}
   dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
   String directionValue=credit[0]?"credit":"debit";
   api.perform(()->api.post("/api/v1/admin/wallet/adjustments",
    new JSONObject().put("userId",id).put("amountMinor",minor)
      .put("currency",selected).put("direction",directionValue)
      .put("type","admin_adjustment").put("reason",why)),
    ok->{
      dialog.dismiss();
      JSONObject applied=ok.optJSONObject("adjustment");
      String state=applied==null?"":applied.optString("status","");
      if("applied".equals(state)){
       showMessage("موجودی به‌صورت مستقیم اصلاح و در دفترکل ثبت شد.");
       if("users".equals(page)&&id.equals(selectedId)&&MainActivity.this.selected!=null){
        createPage("جزئیات کاربر","بروزرسانی موجودی از سرور");
        userDetail(MainActivity.this.selected);
       }
      }else{
       showMessage("درخواست ذخیره شد، ولی هنوز اعمال نشده است: "+(state.isEmpty()?"نامشخص":state));
      }
    },
    err->{dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);showMessage(err);});
  }));
  dialog.show();
 }
 private void userStatus(JSONObject item){
  String current=pick(item,"status");
  if("self_excluded".equals(current)||"closed".equals(current)){
   showMessage("حساب بسته یا خودمحروم‌شده را نمی‌توان با این دکمه دوباره فعال کرد.");return;
  }
  String next=current.equals("active")?"suspended":"active";
  EditText why=field("دلیل تغییر وضعیت (حداقل ۸ حرف)",InputType.TYPE_CLASS_TEXT);
  LinearLayout box=col();pad(box,18);box.addView(why);
  new AlertDialog.Builder(this).setTitle("تغییر وضعیت به "+next)
   .setMessage("این عملیات روی حساب واقعی انجام می‌شود و ثبت حسابرسی دارد.")
   .setView(box).setNegativeButton("انصراف",null)
   .setPositiveButton("تأیید",(d,w)->{
    String reason=why.getText().toString().trim();if(reason.length()<8){showMessage("دلیل تغییر باید حداقل ۸ حرف باشد");return;}
    api.perform(()->api.patch("/api/v1/admin/users/"+enc(item.optString("id")),
     new JSONObject().put("action","set_status").put("status",next).put("reason",reason)),
     o->{showMessage("وضعیت حساب تغییر کرد");createPage("جزئیات کاربر","اطلاعات حساب • "+item.optString("id"));selectedId=item.optString("id");userDetail(item);},this::showMessage);
   }).show();
 }
 private void betDetail(JSONObject item){
  LinearLayout p=panel(body);
  info(p,"شماره شرط",pick(item,"publicId","id"));info(p,"وضعیت",pick(item,"status"));
  info(p,"نوع شرط",pick(item,"type"));
  info(p,"مبلغ USD",money(item,"usdStakeMinor","stakeMinor"));
  info(p,"برد احتمالی",money(item,"usdPotentialPayoutMinor","potentialPayoutMinor"));
  info(p,"برد پرداخت‌شده",money(item,"usdSettledPayoutMinor","settledPayoutMinor"));
  info(p,"شناسه کاربر",pick(item,"userId"));
  requestInto("/api/v1/admin/bets/"+enc(item.optString("id")),json->{
   JSONObject bet=json.optJSONObject("bet");
   if(bet!=null)generic(bet,"جزئیات شرط");
  });
 }
 private void paymentDetail(JSONObject item){
  LinearLayout p=panel(body);
  info(p,"شناسه عمومی",pick(item,"publicId","id"));info(p,"وضعیت",pick(item,"status"));
  info(p,"مبلغ",amountMinor(item.optString("amountMinor","0"),pick(item,"currency")));
  info(p,"مبلغ USD",money(item,"usdAmountMinor","amountMinor"));
  info(p,"شناسه کاربر",pick(item,"userId"));
  info(p,"ارائه‌دهنده",pick(item,"provider"));
  info(p,"آغاز",date(pick(item,"initiatedAt","createdAt")));
  if(page.equals("withdrawal")&&!"succeeded".equals(item.optString("status"))){
   addTitle(body,"بررسی برداشت");
   addAction(body,"تأیید درخواست برداشت",false,()->reviewWithdrawal(item,"approve"));
   addAction(body,"رد درخواست برداشت",false,()->reviewWithdrawal(item,"reject"));
   body.addView(label("این عملیات فقط درخواست را بررسی می‌کند و به معنی پرداخت موفق ارز دیجیتال نیست."));
  }
 }
 private void reviewWithdrawal(JSONObject item,String decision){
  EditText why=field("دلیل بررسی",InputType.TYPE_CLASS_TEXT);
  LinearLayout box=col();pad(box,14);box.addView(why);
  new AlertDialog.Builder(this).setTitle(decision.equals("approve")?"تأیید برداشت":"رد برداشت")
   .setMessage("آیا درخواست واقعی را بررسی می‌کنید؟")
   .setView(box).setNegativeButton("انصراف",null).setPositiveButton("ثبت تصمیم",(d,w)->{
    String id=pick(item,"publicId");if("—".equals(id)){showMessage("شناسه معتبر پرداخت وجود ندارد");return;}
    String reason=why.getText().toString().trim();if(reason.length()<4){showMessage("دلیل حداقل ۴ کاراکتر باشد");return;}
    api.perform(()->api.post("/api/v1/admin/payments/"+enc(id)+"/review",
     new JSONObject().put("decision",decision).put("reason",reason)),o->{showMessage("نتیجه بررسی ثبت شد");showPage("withdrawal");},this::showMessage);
   }).show();
 }
 private void ticketDetail(JSONObject item){
  String id=item.optString("id");
  request("/api/v1/admin/support/"+enc(id),json->{
   body.removeAllViews();
   JSONObject ticket=json.optJSONObject("ticket");
   LinearLayout head=panel(body);
   info(head,"موضوع",pick(ticket==null?item:ticket,"subject"));
   info(head,"وضعیت",pick(ticket==null?item:ticket,"status"));
   addAction(head,"تغییر وضعیت تیکت",false,()->ticketStatus(id));
   addTitle(body,"گفتگو");
   JSONArray messages=json.optJSONArray("messages");
   if(messages!=null)for(int i=0;i<messages.length();i++){
    JSONObject msg=messages.optJSONObject(i);if(msg==null)continue;
    LinearLayout bubble=panel(body);
    if("support".equals(msg.optString("senderRole")))bubble.setBackground(bg(Color.rgb(28,60,43),0,18));
    bubble.addView(text("support".equals(msg.optString("senderRole"))?"پشتیبانی":"کاربر",11,GREEN,true));
    space(bubble,6);bubble.addView(text(pick(msg,"body"),13,FG,false));
    space(bubble,6);bubble.addView(label(date(pick(msg,"createdAt"))));
   }
   addTitle(body,"پاسخ جدید");
   LinearLayout c=panel(body);
   EditText draft=input(c,"متن پاسخ به کاربر",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE);
   draft.setSingleLine(false);draft.setMinLines(3);draft.setGravity(Gravity.TOP|Gravity.RIGHT);
   addAction(c,"ارسال پاسخ ←",true,()->{
    String message=draft.getText().toString().trim();
    if(message.length()==0)return;
    new AlertDialog.Builder(this).setTitle("ارسال پیام").setMessage("پاسخ برای کاربر ارسال شود؟")
     .setNegativeButton("انصراف",null).setPositiveButton("ارسال",(d,w)->{
      api.perform(()->api.post("/api/v1/admin/support/"+enc(id)+"/messages",new JSONObject().put("body",message)),
       o->{showMessage("پاسخ ارسال شد");ticketDetail(item);},this::showMessage);
     }).show();
   });
  });
 }
 private void ticketStatus(String id){
  final String[] opts={"open","waiting_user","waiting_support","resolved","closed"};
  new AlertDialog.Builder(this).setTitle("وضعیت تیکت").setItems(opts,(d,which)->{
   api.perform(()->api.patch("/api/v1/admin/support/"+enc(id),new JSONObject().put("status",opts[which])),
    o->{showMessage("وضعیت ثبت شد");showPage("support");},this::showMessage);
  }).show();
 }
 private void notificationDetail(JSONObject item){
  LinearLayout card=panel(body);
  info(card,"عنوان",pick(item,"title"));
  info(card,"وضعیت",faStatus(pick(item,"status")));
  info(card,"مخاطب","personal".equals(item.optString("audience"))?"کاربر خاص":"تمام کاربران فعال");
  info(card,"تاریخ",date(pick(item,"created_at")));
  info(card,"تحویل‌شده",pick(item,"delivered"));
  info(card,"خوانده‌شده",pick(item,"read_count"));
  card.addView(text(pick(item,"body"),13,FG,false));
  addAction(body,"بازگشت به اعلان‌ها",false,()->showPage("notifications"));
 }
 private void notificationCompose(){
  LinearLayout form=col();pad(form,14);
  EditText title=input(form,"عنوان اعلان (تا ۱۰۰ کاراکتر)",InputType.TYPE_CLASS_TEXT);
  EditText message=input(form,"متن اعلان (تا ۵۰۰ کاراکتر)",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE);
  message.setSingleLine(false);message.setMinLines(4);
  form.addView(label("ارسال همگانی به تمام کاربران فعال، در صندوق پیام سایت و اپ انجام می‌شود."));
  AlertDialog dialog=new AlertDialog.Builder(this).setTitle("ارسال اعلان جدید")
   .setView(form).setNegativeButton("انصراف",null).setPositiveButton("ارسال",null).create();
  dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
   String t=title.getText().toString().trim(),b=message.getText().toString().trim();
   if(t.isEmpty()||t.length()>100||b.isEmpty()||b.length()>500){showMessage("عنوان ۱ تا ۱۰۰ و متن ۱ تا ۵۰۰ کاراکتر باشد");return;}
   new AlertDialog.Builder(this).setTitle("تأیید ارسال همگانی")
    .setMessage("این پیام برای تمام کاربران فعال فرستاده شود؟")
    .setNegativeButton("انصراف",null).setPositiveButton("ارسال قطعی",(dd,which)->{
     dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
     api.perform(()->api.post("/api/v1/admin/notifications",
       new JSONObject().put("title",t).put("body",b).put("audience","general")
         .put("locale","fa").put("mode","send")),
       response->{dialog.dismiss();JSONObject saved=response.optJSONObject("campaign");
        showMessage("ارسال ثبت شد. گیرندگان: "+(saved==null?"—":pick(saved,"recipients")));showPage("notifications");},
       err->{dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);showMessage(err);});
    }).show();
  }));
  dialog.show();
 }
 private void casino(){
  request("/api/v1/admin/mobile/casino?window="+period,json->{
   body.removeAllViews();switcher();
   LinearLayout h=hero(body);
   h.addView(text("گزارش سود و زیان کازینو",17,GREEN,true));space(h,11);
   h.addView(text(pick(json,"totalRounds"),33,FG,true));
   h.addView(label("دورهای بازی ثبت‌شده"));
   addTitle(body,"تفکیک ارائه‌دهنده و ارز");
   JSONArray rows=json.optJSONArray("periods");
   if(rows==null||rows.length()==0){centerText(body,"در این بازه گردش ثبت‌شده‌ای یافت نشد.");return;}
   for(int i=0;i<rows.length();i++){
    JSONObject r=rows.optJSONObject(i);if(r==null)continue;
    LinearLayout p=panel(body);
    p.addView(text("internal_slots".equals(r.optString("source"))?"اسلات اختصاصی":"ارائه‌دهنده خارجی",16,FG,true));
    String currency=pick(r,"currency");
    info(p,"ارز",currency);
    info(p,"دورهای بازی",pick(r,"rounds"));
    info(p,"جمع مبالغ شرط",amountMinor(r.optString("stakeMinor","0"),currency));
    info(p,"بردهای پرداخت‌شده",amountMinor(r.optString("payoutMinor","0"),currency));
    info(p,"بازپرداخت لغو راند",amountMinor(r.optString("refundMinor","0"),currency));
    info(p,"سود / زیان ناخالص سایت",amountMinor(r.optString("netSiteMinor","0"),currency));
   }
   body.addView(label("مبالغ به تفکیک ارز هستند. تراکنش ناموفق یا برگشتی به‌عنوان برد ثبت نمی‌شود."));
  });
 }
 private String faOperation(String key){
  switch(key){
   case "AFFILIATE_PAYOUT":return "پرداخت افیلیت";
   case "LIVE_BETTING":return "شرط‌بندی زنده";
   case "DEPOSITS":return "واریزها";
   case "WITHDRAWALS":return "برداشت‌ها";
   case "MAINTENANCE_MODE":return "حالت تعمیرات";
   default:return key;
  }
 }
 private void operations(){
  request("/api/v1/admin/operations",json->{
   body.removeAllViews();
   addTitle(body,"وضعیت سرویس‌های سایت");
   JSONObject maintenance=json.optJSONObject("maintenance");
   if(maintenance!=null){
    LinearLayout p=sectionGroup("وضعیت تعمیرات","نمایش وضعیت واقعی سایت",true);
    info(p,"وضعیت",maintenance.optBoolean("enabled")?"فعال":"غیرفعال");
    info(p,"توضیح",pick(maintenance,"message"));
   }
   JSONArray rows=json.optJSONArray("operations");
   LinearLayout panel=sectionGroup("کنترل‌های عملیاتی","نمایش مرتب فعال و غیرفعال بودن سرویس‌ها",true);
   if(rows==null||rows.length()==0)centerText(panel,"تنظیمی ثبت نشده");
   if(rows!=null)for(int i=0;i<rows.length();i++){
    JSONObject op=rows.optJSONObject(i);if(op==null)continue;
    panel.addView(text(faOperation(pick(op,"key")),14,FG,true));
    info(panel,"وضعیت",op.optBoolean("isEnabled")?"فعال":"غیرفعال");
    info(panel,"دلیل",pick(op,"reason"));
    info(panel,"آخرین تغییر",date(pick(op,"updatedAt")));
    divider(panel);
   }
   JSONArray guards=json.optJSONArray("killSwitches");
   LinearLayout stopped=sectionGroup("توقف‌های اضطراری","فعال‌شدن توقف، سرویس را غیرفعال می‌کند",false);
   if(guards!=null)for(int i=0;i<guards.length();i++){
    JSONObject k=guards.optJSONObject(i);if(k==null)continue;
    info(stopped,faOperation(pick(k,"key")),k.optBoolean("isActive")?"توقف فعال":"توقف غیرفعال");
   }
   body.addView(label("تغییر تنظیمات عملیاتی نیازمند عملیات جداگانه و ثبت دلیل است."));
  });
 }
 private void manualForm(){
  createPage("مسابقه جدید","افزودن مستقل به فهرست سایت و اپ کاربران");
  LinearLayout p=panel(body);
  p.addView(label("رشته ورزشی"));
  String[] sports={"football","basketball","tennis","volleyball","hockey","handball"};
  Spinner sport=new Spinner(this);
  ArrayAdapter<String> adapter=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,sports);
  sport.setAdapter(adapter);p.addView(sport);
  EditText league=input(p,"نام لیگ (English)",InputType.TYPE_CLASS_TEXT);
  EditText home=input(p,"نام تیم میزبان",InputType.TYPE_CLASS_TEXT);
  EditText away=input(p,"نام تیم مهمان",InputType.TYPE_CLASS_TEXT);
  final Calendar when=Calendar.getInstance();when.add(Calendar.DAY_OF_MONTH,1);
  TextView kickoff=action("انتخاب تاریخ و ساعت شروع",false,()->{
   Calendar initial=when;
   new DatePickerDialog(this,(v,year,month,day)->{
    when.set(Calendar.YEAR,year);when.set(Calendar.MONTH,month);when.set(Calendar.DAY_OF_MONTH,day);
    new TimePickerDialog(this,(time,hour,minute)->{
     when.set(Calendar.HOUR_OF_DAY,hour);when.set(Calendar.MINUTE,minute);when.set(Calendar.SECOND,0);
     kickoffLabelRefresh();
    },when.get(Calendar.HOUR_OF_DAY),when.get(Calendar.MINUTE),true).show();
   },initial.get(Calendar.YEAR),initial.get(Calendar.MONTH),initial.get(Calendar.DAY_OF_MONTH)).show();
  });
  // Timestamp field has an explicit native date/time picker; label updates via sibling.
  p.addView(kickoff,new LinearLayout.LayoutParams(-1,dp(47)));
  TextView chosen=label("زمان: فردا (برای تغییر روی دکمه بزنید)");p.addView(chosen);
  kickoff.setOnClickListener(v->{
   new DatePickerDialog(this,(picker,year,month,day)->{
    when.set(Calendar.YEAR,year);when.set(Calendar.MONTH,month);when.set(Calendar.DAY_OF_MONTH,day);
    new TimePickerDialog(this,(picker2,hour,minute)->{
     when.set(Calendar.HOUR_OF_DAY,hour);when.set(Calendar.MINUTE,minute);when.set(Calendar.SECOND,0);
     chosen.setText("زمان شروع: "+date(DateTimeFormatter.ISO_INSTANT.format(when.toInstant())));
    },when.get(Calendar.HOUR_OF_DAY),when.get(Calendar.MINUTE),true).show();
   },when.get(Calendar.YEAR),when.get(Calendar.MONTH),when.get(Calendar.DAY_OF_MONTH)).show();
  });
  space(p,14);
  p.addView(label("در نسخه اولیه بازی بدون ضریب ثبت می‌شود و شرط‌پذیر نیست."));
  addAction(p,"ذخیره مسابقه دستی",true,()->{
   String leagueName=league.getText().toString().trim(),host=home.getText().toString().trim(),visitor=away.getText().toString().trim();
   if(leagueName.length()<2||host.length()<2||visitor.length()<2||host.equalsIgnoreCase(visitor)){
    showMessage("نام لیگ و دو تیم متفاوت را درست وارد کنید");return;
   }
   if(when.getTimeInMillis()<System.currentTimeMillis()+60000){showMessage("زمان شروع باید در آینده باشد");return;}
   new AlertDialog.Builder(this).setTitle("ثبت بازی دستی")
    .setMessage(host+" - "+visitor+"\n\nبدون مارکت و بدون امکان ثبت شرط ذخیره شود؟")
    .setNegativeButton("انصراف",null).setPositiveButton("تأیید",(d,w)->{
     api.perform(()->api.post("/api/v1/admin/mobile/manual-matches",
      new JSONObject().put("sport",sports[sport.getSelectedItemPosition()])
       .put("league",leagueName).put("home",host).put("away",visitor)
       .put("scheduledAt",DateTimeFormatter.ISO_INSTANT.format(when.toInstant()))),
      o->{showMessage("بازی ذخیره شد");showPage("manual");},this::showMessage);
    }).show();
  });
  addAction(body,"← بازگشت",false,()->showPage("manual"));
 }
 private void kickoffLabelRefresh(){/* Picker callback label is bound below. */}
 private void requestInto(String path,Display done){
  api.perform(()->api.get(path),done::done,e->{
   LinearLayout p=panel(body);p.addView(text("اطلاعات تکمیلی: "+e,11,MUTED,false));
  });
 }
 @Override public void onBackPressed(){
  if(drawerOpened){showPage(page);return;}
  if(showingUserDetail){showingUserDetail=false;selectedId="";createPage("کاربران","فهرست کاربران • اطلاعات سرور اصلی");list("users",query);return;}
  if(loggedIn&&!page.equals("dashboard")){showPage("dashboard");return;}
  new AlertDialog.Builder(this).setMessage("از برنامه مدیریت خارج شوید؟")
   .setNegativeButton("لغو",null).setPositiveButton("خروج",(d,w)->finish()).show();
 }
 @Override protected void onDestroy(){supportRefresh.removeCallbacks(supportTicker);api.destroy();super.onDestroy();}
}
