plugins { id("com.android.application") }
android {
 namespace = "com.betvima.admin"
 compileSdk = 35
 defaultConfig {
  applicationId = "com.betvima.admin"
  minSdk = 26
  targetSdk = 35
  versionCode = 4
  versionName = "1.1.2"
 }
 buildTypes { getByName("release") { isMinifyEnabled = false } }
 compileOptions {
  sourceCompatibility = JavaVersion.VERSION_17
  targetCompatibility = JavaVersion.VERSION_17
 }
}

dependencies { implementation("com.squareup.okhttp3:okhttp:4.12.0") }
