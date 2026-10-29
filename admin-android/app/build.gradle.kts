plugins { id("com.android.application") }
android {
 namespace = "com.betvima.admin"
 compileSdk = 35
 defaultConfig {
  applicationId = "com.betvima.admin"
  minSdk = 26
  targetSdk = 35
  versionCode = 11
  versionName = "1.3.3"
 }
 buildTypes { getByName("release") { isMinifyEnabled = false } }
 compileOptions {
  sourceCompatibility = JavaVersion.VERSION_17
  targetCompatibility = JavaVersion.VERSION_17
 }
}

dependencies { implementation("com.squareup.okhttp3:okhttp:4.12.0"); implementation("com.squareup.okhttp3:okhttp-dnsoverhttps:4.12.0") }
