# Xe Funnel Definitions

## Core Business Funnels

### 1. Send Money (Primary Revenue Funnel)
The most critical funnel — directly tied to revenue.

**Full funnel steps (all platforms):**
1. `Quote Accessed` — User opens the send money form
2. `Quote Created` — Quote generated with rates/fees for all available payment × delivery method combinations
3. `Quote Confirmed` — User accepts the quote and proceeds (THIS IS THE INTENT SIGNAL)
4. `Payment Method Selected` — User picks how to pay
5. `Transaction Summary Confirmed` — User reviews final details and confirms
6. `Transaction Created` — Transaction submitted (server-side, fires on all platforms)

**Critical context — anonymous vs logged-in:**
- **Mobile (iOS/Android):** Users can access and create quotes **anonymously without logging in**. This is a discovery/engagement feature. The Quote Accessed → Quote Confirmed drop is expected (iOS: ~11%, Android: ~17%) because most mobile users are browsing, not transacting.
- **Web:** Users must be **logged in** before reaching Quote Accessed. Intent is already high. Quote Accessed → Quote Confirmed conversion is ~60%.
- **For fair platform comparison**, start the funnel at **Quote Confirmed** (post-intent). At that point: iOS 78% > Android 74% > Web 70%.

**Two ways to analyze this funnel:**
1. **Quote Engagement funnel** (top of funnel): Quote Accessed → Quote Created → Quote Confirmed — measures how well each platform converts browsers into committed users
2. **Transaction funnel** (post-intent): Quote Confirmed → Payment Method Selected → Transaction Summary Confirmed → Transaction Created — apples-to-apples conversion comparison

**Do NOT use `Quote Calculated`** — that is a low-volume web-only event from the public site price calculator (~1.8k/week), not part of the consumer send money flow.

**End step differences by platform:**
- `Transaction Created` — server-side event, fires for all platforms (use this for cross-platform funnels)
- `Transaction Created - Client Side` — client-side confirmation, fires on iOS/Android only (use for app-specific analysis)

**Charts**: q6zkbdob (all), spm3ef6j (web), q2oqpy5 (Galileo)
**Code**: `galileo-site/src/views/SendMoney/`, `galileo-site/src/views/QuickTransfer.vue`, `xe-apollo/src/pages/check-prices-xe/check-prices-xe.ts`, `xe-apollo/src/pages/send/send-summary-xe/send-summary-xe.ts`, `xe-apollo/src/pages/send/send-finish/send-finish.ts`

### 2. Registration (Growth Funnel)
New user acquisition funnel.

**Steps:**
1. `Registration Started` — User begins signup
2. `Registration Country Selected` — Country/region chosen
3. `Profile Created` — Basic profile info submitted
4. `Account Creation Complete` — Account fully created

**Expected conversion**: 30-50%
**Biggest drop-offs**: Started → Country Selected (friction/abandonment), Profile → Account Creation (verification requirements)
**Charts**: gb4ye0pp, 70249d3 (web personal)
**Code**: `galileo-site/src/views/` (registration views)

### 3. Card Payment
Payment processing via credit/debit card.

**Steps:**
1. `Card Authorisation Started` — 3DS/auth initiated
2. `Card Payment Attempted` — Payment submitted to processor
3. `Card Payment Successful` — Payment confirmed

**Expected conversion**: 70-85%
**Biggest drop-offs**: Auth → Attempted (3DS failures, user abandonment)
**Charts**: qpzm2aad, bwvmoe4 (by platform)
**Code**: `galileo-site/src/views/SendMoney/SendMoneyPayment.vue`

### 4. Bank Transfer / Open Banking
Bank-to-bank payment via open banking.

**Steps:**
1. `Bank Verification Started` — Bank account verification initiated
2. `Bank Verification Completed` — Bank verified
3. `Open Banking Payment Started` — Payment flow initiated
4. `Open Banking Payment Completed` — Payment successful

**Expected conversion**: 50-70%
**Error events**: `Open Banking Payment Failed`
**Charts**: u5j9qyvx, mr3ux21q
**Code**: `galileo-site/src/views/SendMoney/SendMoneyPayment.vue`, `galileo-site/src/views/PlaidOauth.vue`

### 5. Login
User authentication.

**Steps:**
1. `Login Accessed` — Login page viewed
2. `Login Started` — Credentials submitted
3. `Login Completed` — Successfully authenticated

**Expected conversion**: 80-90%
**Error events**: `Login Failed`
**Charts**: zxae107e
**Code**: `galileo-site/src/views/Login.vue`

### 6. Biometric Verification (eKYC)
Identity verification via Veriff/Onfido.

**Steps:**
1. `Biometric Verification Started` — User starts verification
2. `Biometric Verification Submitted` — Documents/selfie submitted
3. `Biometric Verification Completed [client-side]` — Client confirms completion

**Expected conversion**: 60-80%
**Related events**: `Biometric Verification Abandoned`, `Biometric Verification Expired`, `Biometric Verification Exited`
**Code**: `galileo-site/src/views/` (biometric views), xe-apollo providers

### 7. Plaid Bank Linking (US/Canada)
Bank account linking via Plaid.

**Steps:**
1. `Bank Account Selection Started` — Plaid widget opened
2. `Bank Account Selection Completed` — Bank selected
3. `Bank Verification Completed` — Account verified

**Expected conversion**: 50-70%
**Charts**: eqd2vvgg (corporate), xryofusk
**Code**: `galileo-site/src/views/PlaidOauth.vue`

### 8. Recipient Creation
Creating a new transfer recipient.

**Steps:**
1. `Recipient Creation Started` — User starts adding recipient
2. `Recipient Info Added` — Basic info provided
3. `Recipient Bank Details Added` — Bank details entered
4. `Recipient Created` — Recipient saved

**Expected conversion**: 40-65%
**Code**: `galileo-site/src/views/Recipients.vue`

---

## Secondary Funnels

### Corporate Activation
Registration → first transaction for corporate accounts.
**Dashboard**: 53dxojr4

### Add Funds to Balance
`Add Funds Accessed` → `Add Funds Summary Confirmed` → `Add Funds Completed`

### Convert Balance
`Convert Balance Accessed` → `Convert Balance Completed`

### Quick Transfer
`Quick Transfer Accessed` → `Quick Transfer Completed`

### Repeat Transfer
`Repeat Transfer Started` → Transaction Created

---

## How to Query Funnels in Amplitude

```json
{
  "type": "funnels",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "events": [
      { "event_type": "Quote Accessed", "filters": [], "group_by": [] },
      { "event_type": "Quote Created", "filters": [], "group_by": [] },
      { "event_type": "Quote Confirmed", "filters": [], "group_by": [] },
      { "event_type": "Payment Method Selected", "filters": [], "group_by": [] },
      { "event_type": "Transaction Summary Confirmed", "filters": [], "group_by": [] },
      { "event_type": "Transaction Created", "filters": [], "group_by": [] }
    ],
    "countGroup": "User",
    "segments": [{ "conditions": [] }]
  }
}
```

### Segment by Platform
Add to `groupBy` (use `"type": "user"` — platform is a user-level property in Amplitude, NOT an event property):
```json
[{ "type": "user", "value": "platform" }]
```

### Filter by Region/Country
Add to `segments.conditions`:
```json
[{
  "type": "property",
  "group_type": "User",
  "prop_type": "user",
  "prop": "country",
  "op": "is",
  "values": ["United States"]
}]
```
