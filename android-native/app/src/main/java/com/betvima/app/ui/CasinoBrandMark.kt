package com.betvima.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.betvima.app.R

/** Crisp vector logo matching the bundled SVG; no image-network dependency. */
@Composable
fun CasinoBrandMark(modifier: Modifier = Modifier, size: Dp = 22.dp) {
    Image(
        painter = painterResource(id = R.drawable.ic_betvima_mini),
        contentDescription = "BetVima",
        modifier = modifier.size(size)
    )
}
