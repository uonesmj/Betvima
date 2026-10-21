package com.betvima.app.ui

/**
 * AnimatedContent keeps both the incoming and outgoing destinations composed during a
 * transition. The shared AppState already describes the incoming destination, so an
 * exiting feature must not receive Feature.NONE and momentarily render FeaturePage's
 * light fallback screen ("BetVima") over the dark native app.
 *
 * Pin the visual feature to the animation destination. This affects presentation only;
 * it never changes the ViewModel, authentication, game sessions, wallet or bet state.
 */
internal fun stateForAnimatedDestination(destination: String, state: AppState): AppState {
    if (!destination.startsWith("feature-")) return state
    val feature = Feature.entries.firstOrNull { "feature-${it.name}" == destination }
        ?: return state
    return if (state.feature == feature) state else state.copy(feature = feature)
}
