package com.betvima.admin;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
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
 private String page="dashboard",period="24h",query="",selectedId="",factorId="",mfaSecret="",email="";
 private JSONObject selected;
 private boolean loggedIn=false,loading=false,drawerOpened=false;
 private long lastTap=0;

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
  return cash(o.optString(usdKey,o.optString(fallback,"0")));
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
  space(host,28);
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
  page=next;selectedId="";query="";
  createPage(titleFor(page),"پنل مدیریت مستقل • اطلاعات سرور اصلی");
  loadPage();
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
  space(menu,18);divider(menu);
  addAction(menu,"خروج امن از حساب",false,()->{
   new AlertDialog.Builder(this).setTitle("خروج از حساب").setMessage("نشست مدیریتی در این دستگاه پایان یابد؟")
    .setNegativeButton("انصراف",null).setPositiveButton("خروج",(d,w)->{
     api.perform(()->{api.logout();return new JSONObject();},o->showLogin(null),e->{api.clear();showLogin(null);});
    }).show();
  });
 }
 private void busy(String title){body.removeAllViews();centerText(body,title+" ...");}
 private void failure(String err){
  body.removeAllViews();LinearLayout p=panel(body);
  p.addView(text("دریافت اطلاعات ممکن نشد",15,RED,true));space(p,9);p.addView(text(err,12,MUTED,false));
  addAction(p,"تلاش دوباره",false,()->loadPage());
 }
 private interface Display {void done(JSONObject json);}
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
  TextView go=action("جستجو",true,()->{query=q.getText().toString().trim();list(section,query);});
  LinearLayout.LayoutParams bl=new LinearLayout.LayoutParams(dp(86),dp(47));bl.rightMargin=dp(8);bar.addView(go,bl);
  body.addView(bar);space(body,15);
  q.setOnEditorActionListener((v,action,event)->{query=q.getText().toString().trim();list(section,query);return true;});
 }
 private void list(String section,String filter){
  String path;
  switch(section){
   case "users":path="/api/v1/admin/users?page=1&pageSize=40&q="+enc(filter);break;
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
   JSONArray arr;
   if(section.equals("support")){
    JSONObject tickets=json.optJSONObject("tickets");
    arr=tickets==null?json.optJSONArray("tickets"):tickets.optJSONArray("items");
   }else arr=json.optJSONArray("items");
   if(arr==null||arr.length()==0){centerText(body,"در این بخش اطلاعاتی ثبت نشده است.");return;}
   addTitle(body,"لیست جدیدترین موارد");
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
      total=String.valueOf(item.optInt("unreadMessages",0))+" جدید";break;
     case "manual":
      name=pick(item,"home")+" - "+pick(item,"away");
      subtitle=pick(item,"league")+" · "+date(pick(item,"scheduledAt"));
      total="بدون ضریب";break;
     case "notifications":
      name=pick(item,"title");subtitle=pick(item,"audience")+" · "+date(pick(item,"created_at"));
      total=pick(item,"delivered");break;
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
   if(section.equals("users")||section.equals("bets")||section.equals("payments"))body.addView(label("۴۰ مورد آخر؛ برای محدود کردن نتایج از جستجو استفاده کنید."));
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
  selected=item;selectedId=pick(item,"id");
  createPage("جزئیات "+titleFor(page),"ثبت‌شده در BetVima • "+selectedId);
  switch(section){
   case "users":userDetail(item);break;
   case "bets":betDetail(item);break;
   case "support":ticketDetail(item);break;
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
  LinearLayout c=panel(body);
  info(c,"آدرس ایمیل",pick(item,"email"));info(c,"شناسه کاربر",pick(item,"publicId"));
  info(c,"وضعیت",pick(item,"status"));info(c,"موجودی USD",money(item,"usdBalanceMinor","usdBalanceMinor"));
  info(c,"مجموع شرط",money(item,"totalStakeMinor","totalStakeMinor"));
  info(c,"سود / زیان کاربر",money(item,"netResultMinor","netResultMinor"));
  addAction(c,"تغییر وضعیت کاربر",false,()->userStatus(item));
  requestInto("/api/v1/admin/users/"+enc(selectedId),json->{
   JSONObject summary=json.optJSONObject("summary");if(summary!=null){
    addTitle(body,"خلاصه حساب");
    LinearLayout d=panel(body);info(d,"تعداد شرط باز",pick(summary,"openBets"));
    info(d,"ارز حساب",pick(summary,"preferredCurrency","currency"));
   }
   JSONObject payments=json.optJSONObject("payments");
   if(payments!=null){
    JSONArray records=payments.optJSONArray("items");
    addTitle(body,"آخرین واریز و برداشت");
    if(records!=null)for(int i=0;i<records.length();i++){
     JSONObject record=records.optJSONObject(i);if(record==null)continue;
     LinearLayout p=panel(body);
     info(p,"نوع",pick(record,"direction","type"));
     info(p,"مبلغ",cash(record.optString("amountMinor","0"))+" "+pick(record,"currency"));
     info(p,"زمان",date(pick(record,"createdAt","initiatedAt")));
    }
   }
  });
  requestInto("/api/v1/admin/mobile/user-finance/"+enc(selectedId),json->{
   addTitle(body,"جمع واریز و برداشت‌های موفق کاربر");
   JSONArray amounts=json.optJSONArray("totals");
   if(amounts==null||amounts.length()==0){centerText(body,"تراکنش موفقی در این دسته ثبت نشده است");return;}
   for(int i=0;i<amounts.length();i++){
    JSONObject a=amounts.optJSONObject(i);if(a==null)continue;
    LinearLayout t=panel(body);
    info(t,pick(a,"type")+" · "+pick(a,"currency"),cash(a.optString("amountMinor","0"))+" "+pick(a,"currency"));
    info(t,"تعداد",pick(a,"count"));
   }
  });
 }
 private void userStatus(JSONObject item){
  String current=pick(item,"status"),next=current.equals("active")?"suspended":"active";
  EditText why=field("دلیل تغییر وضعیت (حداقل ۸ حرف)",InputType.TYPE_CLASS_TEXT);
  LinearLayout box=col();pad(box,18);box.addView(why);
  new AlertDialog.Builder(this).setTitle("تغییر وضعیت به "+next)
   .setMessage("این عملیات روی حساب واقعی انجام می‌شود و ثبت حسابرسی دارد.")
   .setView(box).setNegativeButton("انصراف",null)
   .setPositiveButton("تأیید",(d,w)->{
    String reason=why.getText().toString().trim();if(reason.length()<8){showMessage("دلیل تغییر باید حداقل ۸ حرف باشد");return;}
    api.perform(()->api.patch("/api/v1/admin/users/"+enc(item.optString("id")),
     new JSONObject().put("action","set_status").put("status",next).put("reason",reason)),
     o->{showMessage("وضعیت با موفقیت تغییر کرد");showPage("users");},this::showMessage);
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
  info(p,"مبلغ",cash(item.optString("amountMinor","0"))+" "+pick(item,"currency"));
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
 private void casino(){
  request("/api/v1/admin/mobile/casino?window="+period,json->{
   body.removeAllViews();switcher();
   LinearLayout h=hero(body);h.addView(text("CASINO / VERIFIED TRANSACTIONS",11,GREEN,true));space(h,15);
   h.addView(text(pick(json,"totalRounds"),35,FG,true));h.addView(label("دورهای ثبت‌شده در بازه"));
   addTitle(body,"تفکیک درآمد بر اساس ارائه‌دهنده و ارز");
   JSONArray rows=json.optJSONArray("periods");
   if(rows==null||rows.length()==0){centerText(body,"گردش تکمیل‌شده‌ای در این بازه ثبت نشده است.");return;}
   for(int i=0;i<rows.length();i++){
    JSONObject r=rows.optJSONObject(i);if(r==null)continue;
    LinearLayout p=panel(body);p.addView(text("slot".equals(r.optString("source"))?"اسلات داخلی":"SoftAggregator",16,FG,true));
    space(p,12);info(p,"ارز",pick(r,"currency"));info(p,"تعداد دور",pick(r,"rounds"));
    info(p,"گردش شرط",cash(r.optString("stakeMinor","0")));
    info(p,"پرداخت برد",cash(r.optString("payoutMinor","0")));
    info(p,"سود ناخالص",cash(r.optString("netMinor","0")));
   }
   body.addView(label("ارزهای مختلف هرگز بدون تبدیل معتبر با یکدیگر جمع نمی‌شوند."));
  });
 }
 private void operations(){
  request("/api/v1/admin/operations",json->{
   body.removeAllViews();
   addTitle(body,"وضعیت عملیات سایت");
   generic(json,"کنترل‌ها و سرویس‌های فعال");
   body.addView(label("برای تغییرات بحرانی سرور، تأیید مرحله‌ای و ثبت دلیل الزامی است."));
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
  if(loggedIn&&!page.equals("dashboard")){showPage("dashboard");return;}
  new AlertDialog.Builder(this).setMessage("از برنامه مدیریت خارج شوید؟")
   .setNegativeButton("لغو",null).setPositiveButton("خروج",(d,w)->finish()).show();
 }
 @Override protected void onDestroy(){api.destroy();super.onDestroy();}
}
