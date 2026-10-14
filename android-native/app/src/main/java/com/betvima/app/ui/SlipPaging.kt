package com.betvima.app.ui

/** Fixed, non-scrolling pages of selections; all picks remain reachable. */
internal fun slipPageCapacity(screenHeightDp: Int): Int = when {
    screenHeightDp >= 920 -> 3
    screenHeightDp >= 690 -> 2
    else -> 1
}

internal fun slipMaxPage(count: Int, capacity: Int): Int =
    (count - 1).coerceAtLeast(0) / capacity.coerceAtLeast(1)

internal fun slipPageWindow(count: Int, capacity: Int, page: Int): IntRange {
    val size = capacity.coerceAtLeast(1)
    val first = page.coerceIn(0, slipMaxPage(count, size)) * size
    val end = (first + size).coerceAtMost(count)
    return first until end
}
