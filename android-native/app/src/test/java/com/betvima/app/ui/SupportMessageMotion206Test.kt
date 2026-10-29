package com.betvima.app.ui
import org.junit.Assert.*
import org.junit.Test
class SupportMessageMotion206Test {
  @Test fun nicknamesStayStablePerConversation() {
    val ticket="01234567-89ab-4cde-8f01-234567890abc"
    assertEquals(supportDisplayName206(ticket),supportDisplayName206(ticket))
  }
  @Test fun composerClearanceIsCompact() {
    assertTrue(supportChatBottomClearanceDp(false) >= 38)
    assertTrue(supportChatBottomClearanceDp(true) >= 12)
  }
}
