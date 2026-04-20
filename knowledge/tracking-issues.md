# Tracking Issues & Known Problems

All bugs, TODOs, dead code, naming inconsistencies, and data quality issues found in the actual source code. Each item includes the file:line reference so skills can trace findings to code.

---

## BUGS — Actively Breaking Tracking

### 1. Undefined Event: NEW_PAYMENT_METHOD_COMPLETED

`SEGMENT_EVENTS.NEW_PAYMENT_METHOD_COMPLETED` is used in code but **does not exist** in the SEGMENT_EVENTS object.

- **File**: `galileo-site/src/components/Views/PaymentMethod/MicroDepositModal.vue:255`
- **Impact**: Fires `event: undefined` to Segment/Amplitude. Silent failure — no error thrown, but the event is unqueryable.
- **Fix**: Add the constant to `segmentAnalytics.ts` or replace with an existing constant.

### 2. Duplicate Event String: Bank Verification Completed

Two constants map to the same Amplitude event name:
- `BANK_VERIFICATION_COMPLETED` = `"Bank Verification Completed"`
- `BANK_VERIFICATION_SUCCESS` = `"Bank Verification Completed"`

- **File**: `galileo-site/src/constants/segmentAnalytics.ts:11,14`
- **Impact**: Events from micro-deposit verification and Plaid verification are indistinguishable in Amplitude. Cannot analyze each flow separately.
- **Fix**: Give them different event names or add a distinguishing property (e.g., `verificationMethod: "plaid" | "microdeposit"`).

### 3. Login Event Casing Mismatch Between Platforms

- galileo-site: `LOGIN_FAILED` = `"Login Failed"` (Title Case)
- xe-apollo: `LoginFailed` = `"Login failed"` (lowercase "f")

- **File**: `galileo-site/src/constants/segmentAnalytics.ts:24` vs `xe-apollo/src/model/types/analytics.const.ts:127`
- **Impact**: These appear as TWO DIFFERENT EVENTS in Amplitude. Cross-platform login failure analysis is broken.
- **Fix**: Standardize to `"Login Failed"` in xe-apollo.

### 4. Platform Detection Fallback to iOS

```typescript
if (this.platform.is('ios') || (this.platform.is("cordova") && !this.platform.is("android")))
  platformName = 'ios'
```

- **File**: `xe-apollo/src/providers/analytics/segment.ts:464`
- **Impact**: Any non-iOS, non-Android cordova device (e.g., desktop Electron builds, test environments) is misattributed as iOS.
- **Fix**: Add explicit `unknown` fallback before the iOS check.

---

## DEAD CODE — Never-Populated Properties

### 5. Empty Identify Properties (Both Platforms)

These properties are set in the identify call but ALWAYS contain empty strings:

| Property | Web File:Line | App File:Line |
|----------|--------------|---------------|
| `firstTransactionDate` | `analytics.ts:190` | `segment.ts:281` |
| `lastTransactionDate` | `analytics.ts:191` | `segment.ts:282` |
| `transactionCount` | `analytics.ts:192` | `segment.ts:283` |
| `registrationDate` | `analytics.ts:193` | `segment.ts:285` |
| `registrationPlatform` | `analytics.ts:194` | `segment.ts:286` |

**All marked with `// TODO ?`** — the web code has commented-out logic that would have populated these from transaction history, but it was never implemented.

- **Impact**: Any Amplitude analysis using these user properties (e.g., segmenting by registration date, filtering power users by transaction count) returns nothing. Dashboards relying on these properties show blank.
- **Fix**: Either populate from the API or remove to avoid confusion.

---

## TODO COMMENTS — Developer-Flagged Issues

### xe-apollo analytics.const.ts — Critical TODOs

| Line | Event/Code | TODO Comment | Severity |
|------|-----------|-------------|----------|
| 106 | `IDUpdated` | `// todo need info about this` | Low — event exists but unclear trigger |
| 126 | `LoginSuccessful` | `// CHECK !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!` | **HIGH** — unclear if event name is correct |
| 127 | `LoginFailed` | `// CHECK !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!` | **HIGH** — confirmed casing bug (see #3) |
| 130 | `ProfileStarted` | `// TODO FOR MARKETING !!!!!!!!!!!!!!!!!` | Medium — marketing team needs this event |
| 134 | Registration section | `// TODO !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!` | Medium — entire section flagged |
| 147 | BiometricEnabled | `// TODO !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!` | Medium — biometric enable event incomplete |
| 149 | Forgot Password | `// TODO !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!` | Medium — password recovery tracking incomplete |
| 157 | `NotificationsPreferenceUpdated` | `// TODO !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!` | Low |
| 218 | Verification section | `// TODO !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!` | Medium — verification tracking incomplete |
| 220 | EDD section | `// TODO !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!` | Medium — EDD tracking incomplete |
| 222 | `MethodPaymentEdit` | `// TODO !!!!!!!!!!!!!!!!!!` | Low |
| 223 | `TransferEdit` | `// TODO !!!!!!!!!!!!!!!!!!` | Low |
| 240 | Track Transfer | `// TODO !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!` | Medium |
| 256 | `NotificationsPreferencesUpdated` | `// TODO !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!` | Low — duplicate of line 157 |
| 257 | `PendingTransactionCreated` | `// TODO !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!` | Medium — pending transaction tracking |
| 258 | `PendingTransactionUpdated` | `// TODO !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!` | Medium — pending transaction tracking |

**Total TODO/CHECK markers in xe-apollo analytics const: 16+**

### galileo-site analytics.ts — TODOs

| Line | Context | TODO Comment |
|------|---------|-------------|
| 167 | `accountStatus` | `// TODO do we really get disabled accounts ?` |
| 190-194 | Identify properties | `// TODO ? also empty in mobile app` (×5) |
| 257 | Segment loader | `// TODO copied from Segment like recommended eventually replace by our own loadScript ?` |

### xe-apollo segment.ts — TODOs

| Line | Context | TODO Comment |
|------|---------|-------------|
| 279 | `accountStatus` | `// TODO do we really get disabled accounts ?` (same question as web) |
| 281-286 | Identify properties | `// TODO ?` (×5, same empty properties as web) |

---

## DEAD CONSTANTS — Defined But Never Used in galileo-site

31 constants in `SEGMENT_EVENTS` are defined but never referenced anywhere in `galileo-site/src/`:

### Legacy/Migration (safe to remove)
- `SWITCH_TO_CLASSIC_STARTED` / `SWITCH_TO_CLASSIC_CONFIRMED`
- `LEGACY_SITE_PROMPT_DISPLAYED` / `LEGACY_SITE_INITIATED`
- `NEW_SITE_PROMPT_DISPLAYED`

### Replaced by Other Constants
- `IDENTITY_VERIFICATION_STARTED` → replaced by `BIOMETRIC_VERIFICATION_STARTED`
- `LANGUAGE_UPDATED` → replaced by `LANGUAGE_SELECTED`
- `PICKUP_LOCATION_SELECTED` → replaced by `PAYOUT_LOCATION_SELECTED`
- `DESTINATION_COUNTRY_SELECTED` → replaced by `DESTINATION_COUNTRY_CURRENCY_SELECTION_COMPLETED`

### Fired from xe-apollo Only (not web)
- `PROFILE_CREATED`, `PROFILE_UPDATED`
- `REGISTRATION_STARTED`
- `QUOTE_CALCULATED`
- `RECIPIENT_CREATED`
- `EDD_PERSONAL_INFORMATION_COMPLETED`, `EDD_ID_INFORMATION_COMPLETED`
- `EDD_ID_MOBILE_NUMBER_COMPLETED`, `EDD_RELATIONSHIP_TO_BENEFICARY_COMPLETED`

### Genuinely Unused
- `ACCOUNT_CREATION_COMPLETED`, `ADDRESS_CREATED`, `COUNTRY_CONFIRMED`
- `FORGOT_PASSWORD_STARTED`, `ID_UPDATED`, `NOTIFICATIONS_UPDATED`
- `OTP_HELP_SELECTED`, `PASSWORD_CREATED`, `PHONE_ADDED`, `PHONE_FAILED`
- `SECURITY_METHOD_STARTED`, `BANK_DETAILS_VIEWED`, `REPEAT_PAYMENT_STARTED`
- `NON_SUPPORTED_CARD_BILLING_COUNTRY_ADDED`

**Impact**: Dead constants create false expectations — analysts may think these events fire on web when they don't.

---

## NAMING INCONSISTENCIES

### Cross-Platform Event Name Mismatches

| Web (galileo-site) | App (xe-apollo) | Amplitude Result |
|---|---|---|
| `"Login Failed"` | `"Login failed"` | **2 separate events** — casing differs |
| `"CVV Entered"` | `"CVV entered"` | **2 separate events** — casing differs |
| N/A | `"Recipient  Details  Confirmed"` | Event has **double spaces** in name |
| `"Recipient Created"` | Not in enum | Web-only (but constant unused) |
| N/A | `"Openbanking Transfer Instructions Accepted"` | Web uses `"Bank Transfer Instructions Accepted"` for same flow |

### Typos in Constants

| Constant | Issue | File |
|----------|-------|------|
| `EDD_RELATIONSHIP_TO_BENEFICARY_COMPLETED` | "BENEFICARY" should be "BENEFICIARY" | `galileo-site/segmentAnalytics.ts:125` |
| `nonVerifedDdAccounts` | "Verifed" should be "Verified" | `galileo-site/Traits.ts:299` |
| `KYS_MISSING_INFORMATION_PROMPT_DISPLAYED` | "KYS" should be "KYC" | `galileo-site/segmentAnalytics.ts:120` |
| `RecipientDetailsConfirmed` | Double spaces: `"Recipient  Details  Confirmed"` | `xe-apollo/analytics.const.ts:346` |
| `PlaidCredentialsSubmited` | "Submited" should be "Submitted" | `xe-apollo/analytics.const.ts:379` |
| `EDDRelationshipToBeneficiaryComplete` | "Complete" vs "Completed" (inconsistent with other EDD events) | `xe-apollo/analytics.const.ts:249` |
| `AddFundsSummaryConfirmed` | `"Add Funds Summary confirmed"` — lowercase "confirmed" vs Title Case | `xe-apollo/analytics.const.ts:460` |

### Inconsistent Event Naming Patterns

| Pattern | Examples | Issue |
|---------|---------|-------|
| "Accessed" vs "Started" | `QuoteAccessed` vs `BankVerificationStarted` | Inconsistent for "user enters flow" events |
| "Completed" vs "Success" | `BANK_VERIFICATION_COMPLETED` vs `BANK_VERIFICATION_SUCCESS` | Both map to same string, adding confusion |
| Client-side suffix | `"Biometric Verification Completed [client-side]"` | Only event with bracket suffix |
| Spacing | `"Quote Uncommon CountryCurrency Modal Displayed"` vs `"Quote Uncommon Currency Country Modal Continue"` | Inconsistent compound words |

---

## DATA QUALITY CONCERNS

### Missing Page View Tracking (Web)

The `page()` method exists in the analytics store but usage appears minimal. Most navigation doesn't trigger explicit page views — relying on Amplitude's auto-capture `[Amplitude] Page Viewed` instead.

- **Impact**: Amplitude's auto-capture may miss SPA route changes or capture URLs inconsistently.
- **Recommendation**: Audit whether `page()` is called on router navigation guards.

### Anonymous User Pollution (App)

Before login, all app events fire with `email: "{anonymousId}@placeholder.email"`. Guard added in v7.14.2+ to block `identify()` for placeholder emails, but `trackEvent()` still sends them.

- **File**: `xe-apollo/src/providers/analytics/segment.ts:182-200`
- **Impact**: Amplitude user profiles may have events from anonymous sessions mixed with identified sessions if the user later logs in.

### Commented-Out Transaction History

```typescript
// galileo-site/src/stores/analytics.ts:213-221
/*
firstTransactionDate:
  transactions && transactions.length > 0
    ? transactions[transactions.length - 1].dateCreated
    : '',
lastTransactionDate:
  transactions && transactions.length > 0 ? transactions[0].dateCreated : '',
transactionCount: transactions ? transactions.length : 0,
*/
```

The code to populate transaction history properties was written but deliberately commented out. This suggests it was attempted and reverted — possibly due to performance or data concerns.

### Consent Gate Asymmetry

- **Web**: ALL tracking blocked until cookie consent
- **App**: No consent gate — tracking starts immediately

This means the same user on web and app will have different event coverage. Web sessions that bounce before accepting cookies produce zero analytics data. App sessions always produce data.

- **Impact**: Web conversion rates may appear lower than reality (denominator excludes non-consented users). App rates include all users.

### Hardcoded GTM Key

GTM key `GTM-WNCL796` is hardcoded in `analytics.ts:573,605` instead of using an environment variable.

- **Impact**: Cannot change GTM container without code deploy. Different environments (staging, dev) use production GTM.

---

## SUMMARY TABLE

| Category | Count | Severity |
|----------|-------|----------|
| Active bugs (firing wrong/undefined events) | 4 | High |
| Dead identify properties | 5 | Medium |
| TODO/CHECK comments in tracking code | 16+ | Medium |
| Dead event constants (galileo-site) | 31 | Low |
| Naming inconsistencies (cross-platform) | 5+ | Medium |
| Typos in constants/properties | 7 | Low |
| Data quality concerns | 5 | Medium |
