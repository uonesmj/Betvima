package com.betvima.admin;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

/* Native independent administrator client. Never embeds a user password, secret key or JWT. */
public final class MainActivity extends Activity {
 private static final String HOME = "https://betvima.com/admin/mobile";
 private static final int FILE_REQUEST = 8182;
 private WebView webView;
 private ProgressBar spinner;
 private LinearLayout errorView;
 private ValueCallback<Uri[]> fileCallback;

 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  getWindow().setStatusBarColor(Color.rgb(16,18,22));
  getWindow().setNavigationBarColor(Color.rgb(22,24,29));
  FrameLayout root = new FrameLayout(this);
  root.setBackgroundColor(Color.rgb(12,13,17));
  webView = new WebView(this);
  root.addView(webView,new FrameLayout.LayoutParams(-1,-1));
  spinner = new ProgressBar(this);
  root.addView(spinner,new FrameLayout.LayoutParams(52,52,Gravity.CENTER));
  setupErrorView(root);
  setContentView(root);

  WebSettings settings=webView.getSettings();
  settings.setJavaScriptEnabled(true);
  settings.setDomStorageEnabled(true);
  settings.setJavaScriptCanOpenWindowsAutomatically(false);
  settings.setAllowFileAccess(false);
  settings.setAllowContentAccess(false);
  settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  settings.setSafeBrowsingEnabled(true);
  settings.setSupportZoom(false);
  settings.setBuiltInZoomControls(false);
  settings.setCacheMode(WebSettings.LOAD_DEFAULT);
  CookieManager cookies=CookieManager.getInstance();
  cookies.setAcceptCookie(true);
  cookies.setAcceptThirdPartyCookies(webView,false);
  webView.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    Uri uri=request.getUrl();
    String scheme=uri.getScheme(),host=uri.getHost();
    if("https".equals(scheme)&&("betvima.com".equals(host)||"www.betvima.com".equals(host)))return false;
    if("https".equals(scheme)||"http".equals(scheme)){
     try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}
    }
    return true;
   }
   @Override public void onPageFinished(WebView view,String url){
    spinner.setVisibility(View.GONE);
    CookieManager.getInstance().flush();
   }
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){
    if(request.isForMainFrame())showError();
   }
   @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response){
    if(request.isForMainFrame()&&response.getStatusCode()>=500)showError();
   }
   @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,SslError error){
    handler.cancel();showError();
   }
  });
  webView.setWebChromeClient(new WebChromeClient(){
   @Override public void onProgressChanged(WebView view,int progress){
    if(progress>85)spinner.setVisibility(View.GONE);
   }
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(fileCallback!=null)fileCallback.onReceiveValue(null);
    fileCallback=callback;
    try{
     startActivityForResult(params.createIntent(),FILE_REQUEST);
     return true;
    }catch(ActivityNotFoundException e){
     fileCallback=null;callback.onReceiveValue(null);return false;
    }
   }
  });
  if(state!=null)webView.restoreState(state);
  else webView.loadUrl(HOME);
 }

 private void setupErrorView(FrameLayout root){
  errorView=new LinearLayout(this);
  errorView.setOrientation(LinearLayout.VERTICAL);
  errorView.setGravity(Gravity.CENTER);
  errorView.setPadding(28,20,28,20);
  errorView.setBackgroundColor(Color.rgb(12,13,17));
  TextView title=new TextView(this);
  title.setText("BetVima Admin");
  title.setTextSize(23);
  title.setTextColor(Color.WHITE);
  title.setGravity(Gravity.CENTER);
  errorView.addView(title);
  TextView message=new TextView(this);
  message.setText("اتصال امن به سرور برقرار نشد. اینترنت خود را بررسی کنید.");
  message.setTextColor(Color.rgb(170,177,182));
  message.setTextSize(13);
  message.setGravity(Gravity.CENTER);
  message.setPadding(0,20,0,20);
  errorView.addView(message);
  Button retry=new Button(this);
  retry.setText("تلاش مجدد");
  retry.setOnClickListener(v->{errorView.setVisibility(View.GONE);spinner.setVisibility(View.VISIBLE);webView.loadUrl(HOME);});
  errorView.addView(retry);
  errorView.setVisibility(View.GONE);
  root.addView(errorView,new FrameLayout.LayoutParams(-1,-1));
 }
 private void showError(){spinner.setVisibility(View.GONE);errorView.setVisibility(View.VISIBLE);}
 @Override protected void onActivityResult(int code,int result,Intent data){
  super.onActivityResult(code,result,data);
  if(code!=FILE_REQUEST)return;
  if(fileCallback!=null){
   fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));
   fileCallback=null;
  }
 }
 @Override public void onBackPressed(){
  if(errorView.getVisibility()==View.VISIBLE){errorView.setVisibility(View.GONE);webView.loadUrl(HOME);}
  else if(webView.canGoBack())webView.goBack();
  else super.onBackPressed();
 }
 @Override protected void onSaveInstanceState(Bundle state){webView.saveState(state);super.onSaveInstanceState(state);}
 @Override protected void onDestroy(){
  if(fileCallback!=null){fileCallback.onReceiveValue(null);fileCallback=null;}
  webView.destroy();super.onDestroy();
 }
}
