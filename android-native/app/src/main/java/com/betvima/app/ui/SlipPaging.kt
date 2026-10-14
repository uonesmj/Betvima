package com.betvima.app.ui

/**
 * A page has a known physical height: cards, gaps, insets, and pager controls
 * are measured by the same constants that drive Compose. This avoids cropping
 * the second card when screen size and number of picks change.
 */
internal const val SLIP_CARD_HEIGHT_DP = 76
internal const val SLIP_CARD_SPACING_DP = 6
internal const val SLIP_PICK_PADDING_DP = 10
internal const val SLIP_PAGER_HEIGHT_DP = 34
internal const val SLIP_PAGER_SPACING_DP = 6

internal fun slipPageCapacity(screenHeightDp: Int): Int = when {
    screenHeightDp >= 1040 -> 3
    screenHeightDp >= 750 -> 2
    else -> 1
}

internal fun slipPickAreaHeightDp(count: Int, capacity: Int): Int {
    if (count <= 0) return 65
    val visible = count.coerceAtMost(capacity.coerceAtLeast(1))
    val rows = visible * SLIP_CARD_HEIGHT_DP +
        (visible - 1) * SLIP_CARD_SPACING_DP
    val nav = if (count > capacity) SLIP_PAGER_HEIGHT_DP + SLIP_PAGER_SPACING_DP else 0
    return rows + nav + SLIP_PICK_PADDING_DP
}

internal fun slipMaxPage(count: Int, capacity: Int): Int =
    (count - 1).coerceAtLeast(0) / capacity.coerceAtLeast(1)

internal fun slipPageWindow(count: Int, capacity: Int, page: Int): IntRange {
    val size = capacity.coerceAtLeast(1)
    val first = page.coerceIn(0, slipMaxPage(count, size)) * size
    val end = (first + size).coerceAtMost(count)
    return first until end
}
