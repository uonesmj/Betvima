package com.betvima.app.ui

import androidx.compose.ui.geometry.Offset
import kotlin.math.PI
import kotlin.math.floor
import kotlin.math.sin
import kotlin.math.sqrt

/** Sampling the actual curved trajectory prevents footsteps from racing when
 * the Bezier parameter moves faster than the spider does on screen. */
internal class SpiderArcPath230(
    private val start: Offset, private val end: Offset,
    private val width: Float, private val height: Float
) {
    private val steps = 48
    private val positions = Array(steps + 1) { i ->
        lossSpiderPoint222(start, end, width, height, i / steps.toFloat())
    }
    private val lengths = FloatArray(steps + 1)
    val length: Float
    init {
        for (i in 1..steps) {
            lengths[i] = lengths[i - 1] +
                (positions[i] - positions[i - 1]).getDistance()
        }
        length = lengths.last().coerceAtLeast(1f)
    }
    fun distanceAt(progress: Float): Float {
        val f = progress.coerceIn(0f, 1f) * steps
        val index = floor(f.toDouble()).toInt().coerceIn(0, steps - 1)
        return lengths[index] + (lengths[index + 1] - lengths[index]) * (f - index)
    }
    fun position(distance: Float): Offset {
        val d = distance.coerceIn(0f, length)
        if (d <= 0f) return positions[0]
        if (d >= length) return positions[steps]
        var low = 0
        var high = steps
        while (high - low > 1) {
            val mid = (low + high) / 2
            if (lengths[mid] < d) low = mid else high = mid
        }
        val v = ((d - lengths[low]) /
            (lengths[high] - lengths[low]).coerceAtLeast(.0001f))
            .coerceIn(0f, 1f)
        return positions[low] * (1f - v) + positions[high] * v
    }
    fun heading(distance: Float): Offset {
        val delta = position(distance + 1.5f) - position(distance - 1.5f)
        return delta / delta.getDistance().coerceAtLeast(.001f)
    }
}

internal const val SPIDER_STEP_LENGTH_DP_230 = 17f
internal const val SPIDER_STANCE_SHARE_230 = .64f
internal const val SPIDER_SIZE_MULTIPLIER_230 = .79f

/** Alternating tetrapod gait, locked toes in card/world coordinates. */
internal fun spiderFoot230(
    leg: Int, distance: Float, path: SpiderArcPath230, dp: Float
): Offset {
    require(leg in 0..7)
    val row = leg % 4
    val side = if (leg < 4) -1f else 1f
    val offsets = floatArrayOf(0f, .5f, 0f, .5f, .5f, 0f, .5f, 0f)
    val phaseOffset = offsets[leg]
    val step = SPIDER_STEP_LENGTH_DP_230 * dp
    val cycle = distance / step + phaseOffset
    val whole = floor(cycle.toDouble()).toInt()
    val phase = cycle - whole
    fun anchor(n: Int): Offset {
        val d = (n - phaseOffset + .32f) * step
        val center = path.position(d)
        val direction = path.heading(d)
        val normal = Offset(-direction.y, direction.x)
        val reach = floatArrayOf(15f, 5f, -7f, -16f)[row] * dp
        val spread = floatArrayOf(18f, 22f, 22f, 18f)[row] * dp
        return center + direction * reach + normal * (side * spread)
    }
    val planted = anchor(whole)
    if (phase <= SPIDER_STANCE_SHARE_230) return planted
    val next = anchor(whole + 1)
    val v = ((phase - SPIDER_STANCE_SHARE_230) /
        (1f - SPIDER_STANCE_SHARE_230)).coerceIn(0f, 1f)
    val eased = v * v * v * (v * (v * 6f - 15f) + 10f)
    val direction = path.heading(distance)
    val normal = Offset(-direction.y, direction.x)
    val lift = sin((v * PI).toDouble()).toFloat() * 2.6f * dp
    return planted * (1f - eased) + next * eased - normal * (side * lift)
}

/** Two-bone inverse kinematics: hips advance while planted feet do not. */
internal fun spiderKnee230(
    hip: Offset, toe: Offset, outward: Offset, dp: Float
): Offset {
    val delta = toe - hip
    val distance = delta.getDistance().coerceAtLeast(.001f)
    val direction = delta / distance
    val upper = 14f * dp
    val lower = 16f * dp
    val reachable = distance.coerceIn(.001f, upper + lower - .01f * dp)
    val projected = ((upper * upper - lower * lower + reachable * reachable) /
        (2f * reachable)).coerceIn(-upper, upper)
    val lift = sqrt((upper * upper - projected * projected).coerceAtLeast(0f))
    val perpendicular = Offset(-direction.y, direction.x)
    val side = if (perpendicular.x * outward.x +
        perpendicular.y * outward.y >= 0f) 1f else -1f
    return hip + direction * projected + perpendicular * (side * lift)
}


/** New top-down anatomical geometry. Planting is measured in card coordinates;
 * all four leg pairs have distinct forward reaches and lateral spreads.
 */
internal const val SPIDER_STEP_LENGTH_DP_231 = 12.5f
internal const val SPIDER_SIZE_MULTIPLIER_231 = .74f

internal fun spiderFoot231(
    leg: Int, distance: Float, path: SpiderArcPath230, dp: Float
): Offset {
    require(leg in 0..7)
    val row = leg % 4
    val side = if (leg < 4) -1f else 1f
    val phases = floatArrayOf(0f, .53f, .22f, .77f, .53f, 0f, .77f, .22f)
    val offset = phases[leg]
    val step = SPIDER_STEP_LENGTH_DP_231 * dp
    val cycle = distance.coerceAtLeast(0f) / step + offset
    val index = floor(cycle.toDouble()).toInt()
    val phase = cycle - index
    fun anchor(n: Int): Offset {
        val d = (n - offset + .38f) * step
        val center = path.position(d)
        val tangent = path.heading(d)
        val normal = Offset(-tangent.y, tangent.x)
        val axial = floatArrayOf(19f, 6.5f, -8f, -20f)[row] * dp
        val spread = floatArrayOf(24f, 31f, 31f, 25f)[row] * dp
        return center + tangent * axial + normal * (side * spread)
    }
    val planted = anchor(index)
    if (phase <= .67f) return planted
    val next = anchor(index + 1)
    val swing = ((phase - .67f) / .33f).coerceIn(0f, 1f)
    val smooth = swing * swing * (3f - 2f * swing)
    // Small projected swing arc, but never pull a foot across the centerline.
    val normal = path.heading(distance).let { Offset(-it.y, it.x) }
    val lift = sin((swing * PI).toDouble()).toFloat() * 1.25f * dp
    return planted * (1f - smooth) + next * smooth -
        normal * (side * lift)
}

/** A consistent, visibly outward-bent femur/tibia rather than the previous
 * fixed 14/16dp bones, which folded across the body when the path curved.
 */
internal fun spiderJoint231(
    hip: Offset, foot: Offset, forward: Offset, sideNormal: Offset,
    row: Int, dp: Float
): Offset {
    val reach = (foot - hip).getDistance()
    val outward = (4.8f + (if (row == 1 || row == 2) 2.1f else 0f)) * dp
    val bend = forward * ((1.5f - row) * 1.7f * dp)
    return hip + (foot - hip) * .48f + sideNormal * outward + bend *
        (reach / (27f * dp)).coerceIn(.70f, 1.40f)
}
