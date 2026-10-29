package com.betvima.app.ui

import com.betvima.app.data.Market
import com.betvima.app.data.Selection
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ReferenceMatchDetail211Test {
    private val selections = listOf(Selection(
        id = "selection", name = "Home", oddsScaled = "19000",
        status = "suspended", version = 1, movement = "STABLE"))
    private fun market(key: String, title: String) = Market(
        id = key, key = key, name = title, status = "suspended",
        selections = selections)

    @Test fun groupsUseRealMarketTitlesWithoutInventingPrices() {
        val input = listOf(
            market("h2h","Full time result"),
            market("total_goals","Goals Over Under 2.5"),
            market("first_half_total","1st Half Total"),
            market("correct_score","Correct score"),
            market("corners","Corners. Total"),
            market("cards","Total cards")
        )
        assertEquals(input, matchDetailFilter211(input,"all",""))
        assertEquals(listOf("total_goals","first_half_total","cards"),
            matchDetailFilter211(input,"total","").map { it.key })
        assertEquals(listOf("first_half_total"),
            matchDetailFilter211(input,"halves","").map { it.key })
        assertEquals(listOf("correct_score"),
            matchDetailFilter211(input,"correct","").map { it.key })
        assertEquals(listOf("corners"),
            matchDetailFilter211(input,"corners","").map { it.key })
        assertEquals(listOf("cards"), matchDetailFilter211(input,"cards","").map { it.key })
        assertTrue(matchDetailFilter211(input,"all","unrelated").isEmpty())
    }
}
