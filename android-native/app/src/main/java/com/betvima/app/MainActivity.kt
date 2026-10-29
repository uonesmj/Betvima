package com.betvima.app

import android.os.Bundle
import android.content.res.Configuration
import androidx.compose.runtime.SideEffect
import com.betvima.app.ui.NativeThemeState
import com.betvima.app.ui.SettingsDevice87
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
        NativeThemeState.mode = SettingsDevice87(this).theme()
        NativeThemeState.systemDark =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        setContent {
            BetvimaTheme {
                SideEffect {
                    WindowCompat.getInsetsController(window, window.decorView).apply {
                        isAppearanceLightStatusBars = false
                        isAppearanceLightNavigationBars = false
                    }
                    window.statusBarColor = android.graphics.Color.rgb(16, 17, 20)
                    window.navigationBarColor = android.graphics.Color.rgb(16, 17, 20)
                }
                BetvimaApp(model)
            }
        }
    }
}
