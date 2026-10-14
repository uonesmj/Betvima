package com.betvima.app.ui

/**
 * The bet slip expands as picks are added through five visible selections.
 * Only picks beyond five scroll in the same list (never paginate).
 *
 * The minimum card height fits all three text rows with their full line heights.
 * If the phone, font scale or IME leaves less space, allow natural scrolling
 * rather than cutting off any row of text.
 */
internal const val SLIP_VISIBLE_PICK_LIMIT = 5
internal const val SLIP_CARD_HEIGHT_DP = 86
internal const val SLIP_CARD_SPACING_DP = 6
internal const val SLIP_PICK_PADDING_DP = 10

internal fun slipPickAreaHeightDp(count: Int): Int {
    if (count <= 0) return 65
    val visible = count.coerceAtMost(SLIP_VISIBLE_PICK_LIMIT)
    return visible * SLIP_CARD_HEIGHT_DP +
        (visible - 1) * SLIP_CARD_SPACING_DP + SLIP_PICK_PADDING_DP
}

internal fun slipRequiresScroll(count: Int, availableHeightDp: Int): Boolean =
    count > SLIP_VISIBLE_PICK_LIMIT ||
        slipPickAreaHeightDp(count) > availableHeightDp
