package com.betvima.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import coil.request.CachePolicy
import coil.request.ImageRequest

/**
 * Bounded decode for remote catalogue artwork.
 * Keeps original provider URLs, names and card layout unchanged.
 * Coil's memory/disk cache avoids repeated image decoding on navigation.
 */
@Composable
internal fun casinoArtwork216(url: String?, widthPx: Int, heightPx: Int): ImageRequest {
    val context = LocalContext.current
    return remember(context, url, widthPx, heightPx) {
        ImageRequest.Builder(context)
            .data(url)
            .size(widthPx, heightPx)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .diskCachePolicy(CachePolicy.ENABLED)
            .crossfade(true)
            .build()
    }
}
