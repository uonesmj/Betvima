package com.betvima.app.data

import com.betvima.app.ui.walletTransferValidation
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class WalletFinanceTest {
    @Test fun walletMinorParsingNeverUsesFloatingPoint() {
        assertEquals("2000", walletInputMinor("20.00", "USD"))
        assertEquals("150", walletInputMinor("۱٫۵۰", "USD"))
        assertEquals("25000000", walletInputMinor("۲۵٬۰۰۰٬۰۰۰", "IRR"))
        assertNull(walletInputMinor("20.001", "USD"))
        assertNull(walletInputMinor("0", "IRR"))
        assertNull(walletInputMinor("1e4", "USD"))
        assertNull(walletInputMinor("-20", "USD"))
    }

    @Test fun voucherRialConversionFloorsToCents() {
        assertEquals("200", voucherUsdMinor("2500000", "IRR", "1250000"))
        assertEquals("200", voucherUsdMinor("250000", "IRT", "1250000"))
        assertNull(voucherUsdMinor("2500000", "EUR", "1250000"))
        assertNull(voucherUsdMinor("2500000", "IRR", "0"))
    }

    @Test fun allCryptoNetworksExactlyMatchServerAllowedValues() {
        for (coin in walletCoins) {
            for (network in coin.networkOptions) assertTrue(supportedWalletNetwork(coin.code, network))
        }
        assertFalse(supportedWalletNetwork("USDT", "Bitcoin"))
        assertFalse(supportedWalletNetwork("ETH", "Tron (TRC-20)"))
    }

    @Test fun paymentOperationsFailClosedWhenMissingOrDisabled() {
        val empty = parseWalletMethods(JSONObject())
        assertFalse(empty.enabled("deposit", "crypto_usdt"))
        val methods = JSONObject()
            .put("methods", org.json.JSONArray().put(
                JSONObject().put("id","crypto_usdt").put("isAvailable",true)))
            .put("depositsEnabled",true)
            .put("withdrawalsEnabled",false)
            .put("operationsUnavailable",false)
        assertTrue(parseWalletMethods(methods).enabled("deposit","crypto_usdt"))
        assertFalse(parseWalletMethods(methods).enabled("withdrawal","crypto_usdt"))
        assertFalse(parseWalletMethods(methods.put("operationsUnavailable",true))
            .enabled("deposit","crypto_usdt"))
    }

    @Test fun transferNeverBypassesServerAvailabilityOrConfirmedBalance() {
        fun validate(amount: String, enabled: Boolean = true, ledger: String = "ok") =
            walletTransferValidation("withdraw","crypto","USDT","Tron (TRC-20)",
                "USD",amount,"T1234567890","", "2500",ledger,enabled,null,null)
        assertNull(validate("20.00"))
        assertEquals("minimum",validate("19.99"))
        assertEquals("balance",validate("25.01"))
        assertEquals("method",validate("20.00",false))
        assertEquals("ledger",validate("20.00",true,"mismatch"))
    }

    @Test fun voucherRequiresFreshSignedQuoteAndRecipientEmail() {
        val quote = WalletExchangeQuote("1250000",
            Instant.now().toString(), "a".repeat(64))
        assertTrue(quote.valid())
        val valid = walletTransferValidation(
            "withdraw","voucher_uvoucher","USDT","Tron (TRC-20)",
            "IRR","2500000","test@example.com","", "5000000",
            "ok",true,quote,null)
        assertNull(valid)
        assertEquals("email",walletTransferValidation(
            "withdraw","voucher_uvoucher","USDT","Tron (TRC-20)",
            "IRR","2500000","not-an-email","", "5000000",
            "ok",true,quote,null))
        assertEquals("quote",walletTransferValidation(
            "withdraw","voucher_uvoucher","USDT","Tron (TRC-20)",
            "IRR","2500000","test@example.com","", "5000000",
            "ok",true,null,null))
    }
}
