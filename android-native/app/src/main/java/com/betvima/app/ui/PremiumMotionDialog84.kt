package com.betvima.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

/**
 * Small GPU-only transform entrance/exit for full-height premium dialogs.
 * Retains their existing content and state until the exit finishes.
 */
@Composable
internal fun PremiumMotionDialog(
    onDismissRequest: () -> Unit,
    properties: DialogProperties = DialogProperties(usePlatformDefaultWidth = false),
    content: @Composable (motion: Modifier, closeWith: (() -> Unit) -> Unit) -> Unit
) {
    var closing by remember { mutableStateOf(false) }
    var nextAction by remember { mutableStateOf<(() -> Unit)?>(null) }
    val opacity = remember { Animatable(0f) }
    val scale = remember { Animatable(.965f) }
    val rise = remember { Animatable(32f) }
    val closeWith: (() -> Unit) -> Unit = { action ->
        if (!closing) {
            nextAction = action
            closing = true
        }
    }
    LaunchedEffect(Unit) {
        coroutineScope {
            launch { opacity.animateTo(1f, tween(220, easing = LinearOutSlowInEasing)) }
            launch { scale.animateTo(1f, tween(310, easing = FastOutSlowInEasing)) }
            launch { rise.animateTo(0f, tween(320, easing = FastOutSlowInEasing)) }
        }
    }
    LaunchedEffect(closing) {
        if (closing) {
            coroutineScope {
                launch { opacity.animateTo(0f, tween(165)) }
                launch { scale.animateTo(.983f, tween(180)) }
                launch { rise.animateTo(15f, tween(180)) }
            }
            onDismissRequest()
            nextAction?.invoke()
        }
    }
    Dialog(onDismissRequest = { closeWith({}) }, properties = properties) {
        content(
            Modifier.graphicsLayer {
                alpha = opacity.value
                scaleX = scale.value
                scaleY = scale.value
                translationY = rise.value * density
            },
            closeWith
        )
    }
}
