# Event Property Schemas

What data actually gets sent with each event. Derived from the Traits interface in galileo-site and the analyticsData patterns in xe-apollo.

---

## Auto-Injected Properties

These are added by the tracking layer, not by individual components.

### Web (galileo-site) — Added to every track() call

| Property | Source | Type | Notes |
|----------|--------|------|-------|
| `accountType` | `identifyData.AccountType` | string | "personal" or "corporate". Only if not already set by component. |
| `email` | `identifyData.email` | string | User's email. Only if not already set. |
| `logRocketSessionUrl` | `logRocketSessionUrl` ref | string | LogRocket session replay URL. Always injected. |
| `brand` | `sessionStore.brand` | string | "xe", "jlp" (John Lewis), etc. Falls back to "xe". |
| `flowName` | `context.flowName` | string | Current transfer flow context. Only if set. |

Source: `galileo-site/src/stores/analytics.ts:499-538`

### App (xe-apollo) — Added to every trackEvent() call

| Property | Source | Type | Notes |
|----------|--------|------|-------|
| `xemt` | `ResourceProvider.isXEMT` | boolean | Whether user is XE Money Transfer user. Always set for XE brand. |
| `email` | `httpProvider.getAuthEmail()` | string | Auth email, or `{anonymousId}@placeholder.email` for anonymous users. |

### App Context (xe-apollo) — Attached as Segment options context

| Property | Value | Notes |
|----------|-------|-------|
| `context.app.businessUnit` | From APP_CONFIG | e.g., "xe" |
| `context.app.platform` | "ios" / "android" / "browser" | Detected from cordova |
| `context.app.version` | `${versionNo}:${versionCode}` | e.g., "7.15.0:456" |

---

## Identify Properties (User Profile)

Set when user logs in. These become user properties in Amplitude.

### Web (galileo-site) — trackUser()

Source: `galileo-site/src/stores/analytics.ts:147-226`

| Property | Type | Source | Status |
|----------|------|--------|--------|
| `TBU` | string | customer.trmBusinessUnitId | Active |
| `AccountType` | string | customer.accountType | Active |
| `accountStatus` | string | isDisabled ? "disable" : "active" | Active (note: "disable" not "disabled") |
| `age` | number | Calculated from dateOfBirth | Active |
| `city` | string | profile.city | Active |
| `clientNumber` | string | customer.clientNumber | Active |
| `country` | string | profile.country | Active |
| `dateOfBirth` | string | customer.dateOfBirth | Active |
| `email` | string | customer.email | Active |
| `firstName` | string | profile.firstName | Active |
| `middleName` | string | customer.middleName | Active |
| `lastName` | string | profile.lastName | Active |
| `locale` | string | profile.language | Active |
| `emailMarketingAllowed` | boolean | willReceiveEmailMarketing | Active |
| `phoneCountry` | string | mobilePhone.countryCode | Active |
| `phoneNumber` | string | mobilePhone.number | Active |
| `product` | string | GALILEO_PLATFORM constant | Always "galileo" |
| `region` | string | customer.region | Active |
| `userId` | string | customer.id.toString() | Active |
| `userLanguage` | string | i18n.locale | Active |
| `userLanguageCode` | string | Language tag language part | Active |
| `userLanguageCountryCode` | string | Language tag country part | Active |
| `hasMoneyTransferProfile` | boolean | !!lastName | Active |
| `fxWebCorpMigrated` | boolean | profile.fxWebCorpMigrated | Active |
| `brand` | string | sessionStore.brand | Active |
| `firstTransactionDate` | string | **ALWAYS EMPTY** | Dead — never populated |
| `lastTransactionDate` | string | **ALWAYS EMPTY** | Dead — never populated |
| `transactionCount` | string | **ALWAYS EMPTY** | Dead — never populated |
| `registrationDate` | string | **ALWAYS EMPTY** | Dead — never populated |
| `registrationPlatform` | string | **ALWAYS EMPTY** | Dead — never populated |

**JLP (John Lewis) only** — additional properties if brand is "jlp":
- `johnLewisMoneyMarketingAllowed`
- `johnLewisPartnersMarketingAllowed`
- `waitrosePartnersMarketingAllowed`

### App (xe-apollo) — identifyCustomer()

Source: `xe-apollo/src/providers/analytics/segment.ts:227-296`

All web properties above, PLUS:

| Property | Type | Source | Notes |
|----------|------|--------|-------|
| `expectedSendCurrency` | string | customer.expectedSendCurrency | From onboarding transfer needs |
| `expectedSendAmount` | any | customer.expectedSendAmount | From onboarding transfer needs |
| `expectedAnnualTradingVolume` | any | customer.expectedAnnualTradingVolume | From onboarding |
| `expectedPayoutCurrency` | string | customer.expectedPayoutCurrency | From onboarding |
| `expectedPayoutCountry` | string | customer.expectedPayoutCountry | From onboarding |
| `expectedTransferFrequency` | string | customer.expectedTransferFrequency | From onboarding |
| `registrationMethod` | string | customer.registrationMethod | "email", "eID", etc. |
| `eIDMethod` | string | customer.eIDMethod | eID provider if used |
| `converterCurrencies` | string[] | From local storage | List of converter currencies |
| `converterCurrenciesCombination` | string | Joined with "," | "USD,GBP,EUR" |
| `product` | string | Hardcoded | Always "App" (vs "galileo" on web) |

---

## Event-Specific Property Schemas

### Quote Created / Quote Accessed

The richest event. Sends full pricing matrix across all delivery × payment method combinations.

**Core properties:**

| Property | Type | Description |
|----------|------|-------------|
| `send_amount` | number | Amount user is sending |
| `send_currency` | string | Currency code (USD, GBP, etc.) |
| `payout_amount` | number | Amount recipient gets |
| `payout_currency` | string | Recipient currency |
| `destination_country` | string | Recipient's country |
| `sender_country` | string | Sender's country |
| `payoutMethod` | string | Bank, Cash, Wallet, Home Delivery |
| `paymentMethod` | string | DebitCard, CreditCard, DirectDebit, etc. |

**Availability flags** (boolean):

```
isCashDeliveryAvailable, isBankDepositAvailable, isMobileWalletDeliveryAvailable,
isCreditCardAvailable, isDebitCardAvailable, isDirectDebitAvailable,
isBankTransferAvailable, isOpenBankingAvailable, isInteracAvailable,
isSameCurrency, isFundsOnBalanceAvailable, isBalanceDeliveryAvailable,
isBalanceAvailable, isPeerToPeerDeliveryAvailable
```

**Pricing matrix** — 6 properties per delivery×payment combination (84+ properties total):

Pattern: `{deliveryMethod}Delivery{PaymentMethod}{Metric}`

| Delivery Method | Payment Methods | Metrics |
|----------------|-----------------|---------|
| bankDeposit | BankTransfer, CreditCard, DebitCard, DirectDebit, OpenBanking, Interac, Balance | Fee, MarginFee, TotalFee, PayoutAmount, Rate, SendAmount |
| cashDelivery | CreditCard, DirectDebit, DebitCard, OpenBanking | Fee, MarginFee, TotalFee, PayoutAmount, Rate, SendAmount |
| walletDelivery | CreditCard, DirectDebit, DebitCard, OpenBanking | Fee, MarginFee, TotalFee, PayoutAmount, Rate, SendAmount |
| fundsOnBalance | Balance | Fee, MarginFee, TotalFee, PayoutAmount, Rate, SendAmount |

Example property names:
```
bankDepositDeliveryCreditCardFee
bankDepositDeliveryCreditCardMarginFee
bankDepositDeliveryCreditCardTotalFee
bankDepositDeliveryCreditCardPayoutAmount
bankDepositDeliveryCreditCardRate
bankDepositDeliveryCreditCardSendAmount
```

**Additional quote properties:**
```
fixedAmount, fixedCcy, defaultRate, defaultSettlementMethod,
numberOfDeliveryMethods, isSilentQuote, quoteError
```

Source: `galileo-site/src/models/Analytics/interfaces/Traits.ts:91-220`

### Card Authorisation Events

| Property | Type | Description |
|----------|------|-------------|
| `authorisationType` | string | Type of 3DS auth |
| `cardBrand` | string | Visa, Mastercard, etc. |
| `cardBillingCountry` | string | Billing address country |
| `newCard` | boolean | Is this a newly added card |
| `isSavedEnabled` | boolean | Card save enabled |
| `failure` | string | Failure reason (on failed) |
| `isNew` | boolean | Was card just created |

### Payment Method Events

| Property | Type | Description |
|----------|------|-------------|
| `paymentMethod` | string | DebitCard, CreditCard, bank_transfer, DirectDebit, Interac |
| `old_method` | string | Previous method (on change) |
| `new_method` | string | New method (on change) |
| `display_methods` | string[] | All methods shown to user |
| `paymentMethodStatus` | string | Active, Expired, Invalid |
| `totalCards` | number | Total saved cards |
| `validCards` | number | Valid cards count |
| `invalidCards` | number | Invalid cards count |
| `expiredCards` | number | Expired cards count |
| `totalDdAccounts` | number | Direct debit accounts |
| `verifiedDdAccounts` | number | Verified DD accounts |
| `nonVerifedDdAccounts` | number | Unverified DD accounts (note: typo "Verifed" is in source) |

### Recipient Events

| Property | Type | Description |
|----------|------|-------------|
| `recipientId` | string/number | Recipient ID |
| `recipientBankId` | string/number | Bank ID |
| `recipientBankName` | string | Bank name |
| `recipientCountry` | string | Country |
| `recipientPayoutMethod` | string | Payout method |
| `recipientPaymentMethod` | string | Payment method |
| `globalRecipientName` | string | Global recipient (ATO, None) |
| `walletProvider` | string | Mobile wallet provider |

### Transaction Events

| Property | Type | Description |
|----------|------|-------------|
| `contractNumber` | string | Transaction contract number |
| `transactionId` | string | Transaction ID |
| `transactionStatus` | string | Current status |
| `cancellationReason` | string | Why cancelled |
| `isRiaTransfer` | boolean | Is Ria partner transfer |
| `rateChanged` | boolean | Rate changed since quote |
| `valueDate` | string | Settlement date |

### Error Events

| Property | Type | Description |
|----------|------|-------------|
| `errorCode` | number/string | Error code from API |
| `errorText` | string | User-facing error text |
| `errorDescription` | string | Technical error description |
| `errorDesc` | string | Short error description |
| `errorType` | string | Error category |
| `error` | string | Raw error string |
| `quoteError` | string | Quote-specific error |

**App-specific error properties** (from `fetchExactErrorDetails`):
- `error_message` — Error popup message
- `error_title` — Error popup title
- `errorType` — Parsed `reasonCode` from API response
- `errorDescription` — Parsed `reasonDesc` from API response

### Biometric Verification Events

| Property | Type | Description |
|----------|------|-------------|
| `biometricPlatform` | string | "veriff" or "onfido" |
| `externalSessionId` | string | Provider session ID |
| `biometricStatus` | string | Verification status |
| `category` | string | Verification category |

### Promotion Events

| Property | Type | Description |
|----------|------|-------------|
| `promoCode` | string | Applied promo code |
| `promoName` | string | Promotion name |
| `promoApplied` | boolean | Was promo applied |
| `promoAdded` | boolean | Was promo added |
| `pricingPromoApplied` | boolean | Pricing promo active |
| `pricingPromoName` | string | Pricing promo name |
| `pricingPromoCode` | string | Pricing promo code |
| `fixedAmountInUsd` | number | Fixed promo amount in USD |
| `promosAvailable` | array | Available promotions |

### Balance & Currency Events

| Property | Type | Description |
|----------|------|-------------|
| `totalBalance` | number | Total balance |
| `availableBalance` | number | Available balance |
| `currencyAccount` | string | Currency code |
| `previousCurrency` | string | Before conversion |
| `newCurrency` | string | After conversion |
| `fundCurrency` | string[] | Funded currencies |
| `balanceAddedAmount` | number | Amount added |
| `activatedCurrencyAccounts` | string[] | Active accounts |
| `availableCurrencyAccounts` | string[] | Available accounts |

### Plaid Events (Web)

| Property | Type | Description |
|----------|------|-------------|
| `microdepositType` | string | "Same Day" or "Automated" |
| `paymentVerificationMethod` | string | "Manual" or "Plaid" |
| `bankAccountChosen` | string | Selected bank account |
| `numberOfAccounts` | number | Available accounts |

---

## Segment Location Constants

Used as the `location` property value on web events to identify where in the app the event fired:

| Constant | Value | Used In |
|----------|-------|---------|
| ACTIVITY | "Activity" | Activity views |
| SEND_MONEY | "sendMoney" | Send money flow |
| QUOTE | "Quote" | Quote views |
| RECIPIENT | "Recipients" | Recipient views |
| ACCOUNT | "Account" | Account views |
| SETTINGS | "settings" | Settings views |
| QUICK_TRANSFER | "quick transfer" | Quick transfer |
| HOME | "Home" | Dashboard |
| ADD_FUNDS | "Add funds" | Fund balance |
| EXCHANGE | "Exchange" | Convert balance |

Source: `galileo-site/src/constants/segmentAnalytics.ts:248-280`

---

## Payment Method Type Constants

Used as `paymentMethod` property values:

| Constant | Value | Description |
|----------|-------|-------------|
| DEBIT | "DebitCard" | Debit card |
| CREDIT | "CreditCard" | Credit card |
| STAGED | "bank_transfer" | Bank/wire transfer |
| BANK_ACCOUNT | "DirectDebit" | Direct debit |
| INTERAC | "Interac" | Interac e-Transfer (Canada) |

Source: `galileo-site/src/constants/segmentAnalytics.ts:302-308`

## Payout Method Constants

Used as `payoutMethod` property values:

| Constant | Value | Description |
|----------|-------|-------------|
| BANK_DEPOSIT | "Bank" | Bank deposit |
| OFFICE_PICKUP | "Cash" | Cash pickup |
| HOME_DELIVERY | "Home Delivery" | Home delivery |
| MOBILE_PAYMENT | "Wallet" | Mobile wallet |

Source: `galileo-site/src/constants/segmentAnalytics.ts:310-315`

## Recipient Type Constants

| Constant | Value |
|----------|-------|
| SELF | "Self" |
| INDIVIDUAL | "Individual" |
| BUSINESS | "Business" |

Source: `galileo-site/src/constants/segmentAnalytics.ts:329-333`
