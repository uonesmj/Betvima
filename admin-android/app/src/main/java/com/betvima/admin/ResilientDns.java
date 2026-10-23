package com.betvima.admin;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.List;
import java.util.concurrent.TimeUnit;

import okhttp3.Dns;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.dnsoverhttps.DnsOverHttps;

/**
 * Android system DNS is the default. Only when the system cannot resolve a
 * hostname, retry over authenticated DNS-over-HTTPS using public resolvers.
 * This does NOT replace TLS verification, change the HTTPS hostname, use a
 * hard-coded BetVima IP, bypass authorization, or allow HTTP.
 *
 * Resolver bootstrap IPs are the well-known public DNS servers' own addresses;
 * the actual DNS response is obtained over TLS and uses normal certificate
 * verification and SNI for the resolver hostname.
 */
public final class ResilientDns implements Dns {
 private final Dns cloudflare;
 private final Dns google;

 public ResilientDns(){
  OkHttpClient resolverClient=new OkHttpClient.Builder()
   .dns(Dns.SYSTEM)
   .connectTimeout(4, TimeUnit.SECONDS)
   .readTimeout(5, TimeUnit.SECONDS)
   .callTimeout(7, TimeUnit.SECONDS)
   .followRedirects(false)
   .followSslRedirects(false)
   .build();

  cloudflare=new DnsOverHttps.Builder()
   .client(resolverClient)
   .url(HttpUrl.get("https://cloudflare-dns.com/dns-query"))
   .bootstrapDnsHosts(address(1,1,1,1),address(1,0,0,1))
   .includeIPv6(false)
   .build();

  google=new DnsOverHttps.Builder()
   .client(resolverClient)
   .url(HttpUrl.get("https://dns.google/dns-query"))
   .bootstrapDnsHosts(address(8,8,8,8),address(8,8,4,4))
   .includeIPv6(false)
   .build();
 }
 private static InetAddress address(int a,int b,int c,int d){
  try{
   return InetAddress.getByAddress(new byte[]{(byte)a,(byte)b,(byte)c,(byte)d});
  }catch(UnknownHostException impossible){throw new IllegalStateException(impossible);}
 }

 @Override public List<InetAddress> lookup(String hostname) throws UnknownHostException {
  UnknownHostException systemError;
  try { return Dns.SYSTEM.lookup(hostname); }
  catch(UnknownHostException error){systemError=error;}

  try{
   List<InetAddress> result=cloudflare.lookup(hostname);
   if(!result.isEmpty())return result;
  }catch(Exception ignored){}

  try{
   List<InetAddress> result=google.lookup(hostname);
   if(!result.isEmpty())return result;
  }catch(Exception ignored){}

  UnknownHostException notFound=new UnknownHostException(
    hostname+" (System DNS and both encrypted DNS resolvers were unavailable)");
  notFound.initCause(systemError);
  throw notFound;
 }
}
