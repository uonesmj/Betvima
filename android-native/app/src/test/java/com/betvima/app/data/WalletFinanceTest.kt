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

    @Test fun voucherMinimumMatchesLiveUwalletRialsWithoutRoundingBelowOneFifty() {
        val rate = "2527062.20000000"
        assertEquals("3790594", voucherMinimumWalletMinor("150", "IRR", rate))
        assertEquals("379060", voucherMinimumWalletMinor("150", "IRT", rate))
        assertEquals(java.math.BigInteger("3790600"),
            voucherRialsFromWalletMinor("379060", "IRT"))
        assertEquals("150", voucherUsdMinor("3790594", "IRR", rate))
        assertEquals("149", voucherUsdMinor("3790593", "IRR", rate))
        assertEquals("150", voucherUsdMinor("379060", "IRT", rate))
        assertEquals("150", voucherUsdMinor(voucherWalletMinorFromRials(
            "۳٬۷۹۰٬۶۰۰", "IRT")!!, "IRT", rate))
        assertEquals("3790594", voucherWalletMinorFromRials("3,790,594", "IRR"))
        assertNull(voucherWalletMinorFromRials("3790594", "IRT"))
        assertNull(voucherMinimumWalletMinor("150", "IRT", "0"))
    }

    @Test fun voucherDisplayedMaximumDoesNotExceedConfiguredProviderUsdLimit() {
        val rate = "2527062.20000000"
        val walletIrrMax = voucherMaximumWalletMinor("1000", "IRR", rate)!!
        assertEquals("1000", voucherUsdMinor(walletIrrMax, "IRR", rate))
        assertEquals("1000", voucherUsdMinor(walletIrrMax, "IRR", rate))
        assertEquals("25270622", walletIrrMax)
    }

    @Test fun voucherTomanAccountsOnlyAcceptRialInputsWithoutSilentFactorTen() {
        val quote = WalletExchangeQuote("2527062.20000000",
            Instant.now().toString(), "a".repeat(64))
        val valid = walletTransferValidation(
            "withdraw","voucher_hotvoucher","USDT","Tron (TRC-20)",
            "IRT","۳٬۷۹۰٬۶۰۰","test@example.com","", "400000",
            "ok",true,quote,null)
        assertNull(valid)
        val nonDivisible = walletTransferValidation(
            "withdraw","voucher_hotvoucher","USDT","Tron (TRC-20)",
            "IRT","3790594","test@example.com","", "400000",
            "ok",true,quote,null)
        assertEquals("amount", nonDivisible)
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

    @Test fun providerRangeIsAppliedWithoutInventingDefaults() {
        val payload = JSONObject().put("methods", org.json.JSONArray().put(
            JSONObject()
                .put("id", "voucher_uvoucher")
                .put("nameEn", "U-Voucher")
                .put("nameFa", "یو ووچر")
                .put("isAvailable", true)
                .put("minAmountMinor", "150")
                .put("maxAmountMinor", "25000")
                .put("feeBps", 100)
                .put("fixedFeeMinor", "15")
        )).put("depositsEnabled", true).put("withdrawalsEnabled", true)
            .put("operationsUnavailable", false)
        val methods = parseWalletMethods(payload)
        val m = methods.method("voucher_uvoucher")!!
        assertEquals("یو ووچر", m.name)
        assertEquals(100, m.feeBps)
        assertEquals("15", m.fixedFeeMinor)
        assertFalse(methods.amountAllowed("voucher_uvoucher", "149"))
        assertTrue(methods.amountAllowed("voucher_uvoucher", "150"))
        assertTrue(methods.amountAllowed("voucher_uvoucher", "25000"))
        assertFalse(methods.amountAllowed("voucher_uvoucher", "25001"))
        assertFalse(methods.amountAllowed("unknown", "200"))
    }

    @Test fun cryptoMethodLimitsCannotBeIgnoredAtSubmit() {
        fun validate(value: String, min: String, max: String) =
            walletTransferValidation(
                "deposit", "crypto", "USDT", "Tron (TRC-20)",
                "USD", value, "", "", "0", "ok", true,
                null, null, min, max
            )
        assertEquals("method_limit", validate("20.00", "3000", "10000"))
        assertNull(validate("30.00", "3000", "10000"))
        assertEquals("method_limit", validate("120.00", "3000", "10000"))
        assertEquals("minimum", validate("19.99", "0", "0"))
    }
}
