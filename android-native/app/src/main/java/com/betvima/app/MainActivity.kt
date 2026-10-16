package com.betvima.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.core.view.WindowCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.betvima.app.ui.AppViewModel
import com.betvima.app.ui.BetvimaApp
import com.betvima.app.ui.BetvimaTheme

class MainActivity : ComponentActivity() {
    private val model: AppViewModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        // Keep the system launch window in place until Compose's first frame.
        installSplashScreen()
        super.onCreate(savedInstanceState)
        window.setBackgroundDrawableResource(R.color.betvima_splash_background)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        setContent {
            BetvimaTheme { BetvimaApp(model) }
        }
    }
}
