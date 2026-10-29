plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
// A partner-specific APK is built using -PaffiliateRef=APPROVED_CODE.
// This is a public attribution marker, not a secret. It is never displayed
// in the optional gift field and is validated by the registration server.
val embeddedPartnerCode = providers.gradleProperty("affiliateRef").orNull
    ?.trim()?.uppercase().orEmpty()
require(embeddedPartnerCode.isBlank() ||
    Regex("^[A-Z0-9_-]{3,64}$").matches(embeddedPartnerCode)) {
    "Invalid affiliateRef build property"
}

// Signing credentials are supplied only by the secure Android build host.
// Never store keystores/passwords in the repository or in an APK.
val releaseStoreFile = providers.environmentVariable("BETVIMA_ANDROID_KEYSTORE_PATH").orNull
val releaseStorePass = providers.environmentVariable("BETVIMA_ANDROID_KEYSTORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("BETVIMA_ANDROID_KEY_ALIAS").orNull
val releaseKeyPass = providers.environmentVariable("BETVIMA_ANDROID_KEY_PASSWORD").orNull
val hasReleaseSigning = listOf(releaseStoreFile, releaseStorePass, releaseKeyAlias,
    releaseKeyPass).all { !it.isNullOrBlank() }

android {
    if (hasReleaseSigning) {
        signingConfigs {
            create("betvimaProduction") {
                storeFile = file(releaseStoreFile!!)
                storePassword = releaseStorePass
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPass
            }
        }
    }
    namespace = "com.betvima.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.betvima.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 217
        versionName = "0.217.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "API_BASE_URL", "\"https://betvima.com/\"")
        buildConfigField("String", "AFFILIATE_REFERRAL_CODE", "\"$embeddedPartnerCode\"")
        // Server-owned wagering switches are read at runtime. No bundled
        // permanent real-money authorization flag can become stale.
    }
    buildTypes {
        release {
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("betvimaProduction")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
    packaging { resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" } }
}
dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("io.coil-kt:coil-svg:2.7.0")
    // QR is generated locally; never send a payment address to a third-party QR service.
    implementation("com.google.zxing:core:3.5.3")
    implementation("androidx.browser:browser:1.8.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
