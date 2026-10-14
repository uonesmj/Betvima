package com.betvima.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.core.view.WindowCompat
import com.betvima.app.ui.AppViewModel
import com.betvima.app.ui.BetvimaApp
import com.betvima.app.ui.BetvimaTheme

class MainActivity : ComponentActivity() {
    private val model: AppViewModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        setContent {
            BetvimaTheme { BetvimaApp(model) }
        }
    }
}
