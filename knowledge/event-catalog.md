# Xe Event Catalog

Complete catalog of all events tracked across the Xe platform. Cross-references code constants, source files, and Amplitude event names.

## galileo-site Events (SEGMENT_EVENTS)

Source: `galileo-site/src/constants/segmentAnalytics.ts`
Tracking method: `analyticsStore.track({ event: SEGMENT_EVENTS.XXX, traits: {...} })`
Analytics store: `galileo-site/src/stores/analytics.ts`

### Registration & Onboarding

| Constant | Event Name | Key Files | Trigger |
|----------|-----------|-----------|---------|
| REGISTRATION_STARTED | Registration Started | Views (registration) | User begins signup flow |
| PROFILE_CREATED | Profile Created | Views (registration) | Basic profile submitted |
| ACCOUNT_CREATION_COMPLETED | Account Creation Completed (Client-side) | Views (registration) | Account fully created |
| COUNTRY_CONFIRMED | Country Confirmed | Views (registration) | Country selected during reg |
| PASSWORD_CREATED | Password Created | Views (registration) | Password set during reg |
| PHONE_ADDED | Phone Added | Views (registration) | Phone number verified |
| PHONE_FAILED | Phone Failed | Views (registration) | Phone verification failed |
| PHONE_UPDATED | Phone Updated | Views (account) | Phone number changed |
| TERMS_AND_CONDITIONS_ACCEPTED | Terms and Conditions Accepted | Views | User accepts T&C |
| ONBOARDING_FEEDBACK_SUBMITTED | Onboarding Feedback Submitted | Views | Post-onboarding feedback |

### Login & Authentication

| Constant | Event Name | Key Files | Trigger |
|----------|-----------|-----------|---------|
| LOGIN_FAILED | Login Failed | src/views/Login.vue | Failed login attempt |
| FORGOT_PASSWORD_STARTED | Password Recovery Started | src/views/Login.vue | User initiates password reset |
| REMEMBER_DEVICE_SELECTED | Remember Device Selected | Views (login) | User opts to remember device |
| SECURITY_METHOD_STARTED | Security Method Started | Views (login) | 2FA/security step initiated |
| OTP_HELP_SELECTED | OTP Help Selected | Views (login) | User needs OTP help |
| SIGNOUT_CONFIRMED | Sign out confirmed | Views (account) | User confirms sign out |
| SIGNOUT_EVERYWHERE_MODAL_DISPLAYED | Sign out everywhere modal displayed | Views (account) | Sign out all sessions modal |
| SIGNOUT_EVERYWHERE_CANCELED | Sign out canceled | Views (account) | User cancels sign out |

### Quote & Send Money

| Constant | Event Name | Key Files | Trigger |
|----------|-----------|-----------|---------|
| QUOTE_ACCESSED | Quote Accessed | src/views/SendMoney/, QuickTransfer.vue | User opens send money form. Fires on ALL platforms. On mobile, includes anonymous (not logged in) users. |
| QUOTE_CALCULATED | Quote Calculated | src/views/SendMoney/ | **LOW VOLUME, WEB ONLY (~1.8k/week).** Public site price calculator event. NOT part of the consumer send money funnel. Do not use in funnel analysis. |
| QUOTE_CREATED | Quote Created | src/views/SendMoney/, xe-apollo check-prices-xe.ts | Quote generated with rates/fees for all payment × delivery methods. Fires on ALL platforms (iOS 56k, Android 28k, Web 12k/week). **This is the correct step 2 in the send money funnel, not Quote Calculated.** |
| QUOTE_CONFIRMED | Quote Confirmed | src/views/SendMoney/, QuickTransfer.vue, xe-apollo check-prices-xe.ts | User accepts the quote and proceeds. **This is the intent signal.** On mobile, this is where anonymous browsers become committed users. For fair cross-platform comparison, start funnels here. |
| QUOTE_CANCELLED | Quote Cancelled | src/views/SendMoney/ | User cancels quote |
| QUOTE_ERROR | Quote Error | src/views/SendMoney/, xe-apollo check-prices-xe.ts | Error during quote calculation |
| QUOTE_PAYOUT_METHOD_SELECTED | Quote Payout Method Selected | src/views/SendMoney/ | Payout method chosen in quote |
| QUOTE_PAYMENT_METHOD_CHANGED | Quote Payment Method Changed | src/views/SendMoney/ | Payment method changed mid-quote |
| QUOTE_DUPLICATED_WARNING_DISPLAYED | Duplicate Quote Warning Displayed | src/views/SendMoney/ | Duplicate transaction warning |
| QUICK_TRANSFER_ACCESSED | Quick Transfer Accessed | src/views/QuickTransfer.vue | Quick transfer page opened |
| QUICK_TRANSFER_COMPLETED | Quick Transfer Completed | src/views/QuickTransfer.vue | Quick transfer completed |
| DESTINATION_COUNTRY_SELECTED | Destination Country Selected | src/views/SendMoney/ | Recipient country chosen |
| REVIEW_TRANSFER | Review Transfer | src/views/SendMoney/ | User reviews transfer details |
| TRANSACTION_SUMMARY_CONFIRMED | Transaction Summary Confirmed | src/views/SendMoney/ | Final confirmation before submit |
| TRANSACTION_EDIT | Transaction Edit | src/views/SendMoney/ | User edits transaction |
| TRANSACTION_CANCELLED | Transaction Cancelled | src/views/SendMoney/ | User cancels transaction |
| REPEAT_TRANSFER_STARTED | Repeat Transfer Started | src/views/ | User initiates repeat transfer |
| REPEAT_PAYMENT_STARTED | Repeat Payment Started | src/views/ | Repeat payment initiated |
| SCHEDULE_PAYMENT_ACCESSED | Schedule Payment Accessed | src/views/ | Scheduled payment page opened |
| SCHEDULE_PAYMENT_COMPLETED | Schedule Payment Completed | src/views/ | Scheduled payment created |

### Payment Methods

| Constant | Event Name | Key Files | Trigger |
|----------|-----------|-----------|---------|
| PAYMENT_METHOD_SELECTED | Payment Method Selected | src/views/SendMoney/SendMoneyPayment.vue | User picks payment method |
| NEW_PAYMENT_METHOD_STARTED | New Payment Method Started | src/views/AccountPaymentMethods.vue | User begins adding payment |
| NEW_PAYMENT_METHOD_ADDED | New Payment Method Added | src/views/AccountPaymentMethods.vue | Payment method saved |
| PAYMENT_METHOD_DELETED | Payment Method Deleted | src/views/AccountPaymentMethods.vue | Payment method removed |
| PAYMENT_METHOD_UPDATED | Payment Method Updated | src/views/AccountPaymentMethods.vue | Payment method updated |
| PAYMENT_METHODS_ACCESSED | Payment Methods Accessed | src/views/AccountPaymentMethods.vue | Payment methods page opened |
| PAYMENT_FAILED | Payment Failed | src/views/SendMoney/SendMoneyPayment.vue | Payment processing failed |
| CARD_AUTHORISATION_STARTED | Card Authorisation Started | src/views/SendMoney/SendMoneyPayment.vue | 3DS/card auth initiated |
| CARD_AUTHORISATION_COMPLETED | Card Authorisation Completed | src/views/SendMoney/SendMoneyPayment.vue | Card auth succeeded |
| CARD_AUTHORISATION_FAILED | Card Authorisation Failed | src/views/SendMoney/SendMoneyPayment.vue | Card auth rejected |
| CVV_ENTERED | CVV Entered | src/views/SendMoney/SendMoneyPayment.vue | User enters CVV |
| BANK_VERIFICATION_STARTED | Bank Verification Started | src/views/ | Bank verification initiated |
| BANK_VERIFICATION_COMPLETED | Bank Verification Completed | src/views/ | Bank verification done |
| BANK_ACCOUNT_SELECTION_STARTED | Bank Account Selection Started | src/views/PlaidOauth.vue | Plaid widget opened |
| BANK_ACCOUNT_SELECTION_COMPLETED | Bank Account Selection Completed | src/views/PlaidOauth.vue | Bank selected in Plaid |
| OPEN_BANKING_INFO_PAGE_DISPLAYED | Open Banking Info Page Displayed | src/views/SendMoney/ | OB info page shown |
| CHANGE_PAYMENT_METHOD_TRIGGERED | Change Payment Method Triggered | src/views/SendMoney/ | User changes payment method |
| WALLET_PROVIDER_SELECTED | Wallet Provider Selected | src/views/ | Mobile wallet selected |

### Recipients

| Constant | Event Name | Key Files | Trigger |
|----------|-----------|-----------|---------|
| RECIPIENT_ACCESSED | Recipients Accessed | src/views/Recipients.vue | Recipients list opened |
| RECIPIENT_STARTED | Recipient Creation Started | src/views/Recipients.vue | User starts adding recipient |
| RECIPIENT_INFO_ADDED | Recipient Info Added | src/views/Recipients.vue | Recipient basic info entered |
| RECIPIENT_BANK_DETAILS_ADDED | Recipient Bank Details Added | src/views/Recipients.vue | Bank details entered |
| RECIPIENT_CREATED | Recipient Created | src/views/Recipients.vue | Recipient saved |
| RECIPIENT_SELECTED | Recipient Selected | src/views/Recipients.vue | Existing recipient chosen |
| RECIPIENT_TYPE_SELECTED | Recipient Type Selected | src/views/Recipients.vue | Self/Individual/Business chosen |

### Identity Verification (eKYC)

| Constant | Event Name | Key Files | Trigger |
|----------|-----------|-----------|---------|
| BIOMETRIC_VERIFICATION_STARTED | Biometric Verification Started | Views | Veriff/Onfido flow started |
| BIOMETRIC_VERIFICATION_SUBMITTED | Biometric Verification Submitted | Views | Documents/selfie submitted |
| BIOMETRIC_VERIFICATION_COMPLETED | Biometric Verification Completed [client-side] | Views | Client-side completion |
| BIOMETRIC_VERIFICATION_EXITED | Biometric Verification Exited | Views | User exits verification |
| BIOMETRIC_CONSENT_PROVIDED | Biometric Consent Provided | Views | User consents to biometric |
| IDENTITY_VERIFICATION_STARTED | Identity Verification Started | Views | ID verification initiated |
| KYC_REFRESH_REQUIRED | KYC Refresh Required | Views | KYC refresh triggered |
| KYC_REFRESH_COMPLETED | KYC Refresh Completed | Views | KYC refresh done |

### EDD (Enhanced Due Diligence)

| Constant | Event Name | Key Files | Trigger |
|----------|-----------|-----------|---------|
| EDD_TRANSFER_REASON_PROOF_COMPLETED | EDD Transfer Reason Proof Completed | Views | Transfer reason proof provided |
| EDD_PERSONAL_INFORMATION_COMPLETED | EDD Personal Information Completed | Views | Personal info for EDD |
| EDD_ID_INFORMATION_COMPLETED | EDD ID Information Completed | Views | ID info for EDD |
| EDD_SOURCE_OF_FUNDS_COMPLETED | EDD Source of Funds Completed | Views | Source of funds provided |
| EDD_PROOF_OF_ADDRESS_COMPLETED | EDD Proof Of Address Completed | Views | Address proof uploaded |
| EDD_CERTIFIED_PROOF_OF_IDENTITY_COMPLETED | EDD Proof Of Identity Completed | Views | ID proof uploaded |
| EDD_RELATIONSHIP_TO_BENEFICARY_COMPLETED | EDD Relationship To Beneficary Completed | Views | Beneficiary relationship stated |

### Account Settings

| Constant | Event Name | Key Files | Trigger |
|----------|-----------|-----------|---------|
| SETTINGS_ACCESSED | Settings Accessed | src/views/AccountSettings/ | Settings page opened |
| CHANGE_EMAIL_STARTED | Change Email Started | src/views/AccountSettings/ | Email change initiated |
| CHANGE_PASSWORD_STARTED | Change Password Started | src/views/AccountSettings/ | Password change initiated |
| CHANGE_PHONE_NUMBER_STARTED | Change Phone Number Started | src/views/AccountSettings/ | Phone change initiated |
| CHANGE_PERSONAL_ADDRESS_STARTED | Change Personal Address Started | src/views/AccountSettings/ | Address change initiated |
| CHANGE_OCCUPATION_STARTED | Change Occupation Started | src/views/AccountSettings/ | Occupation change initiated |
| CHANGE_NAME_STARTED | Change Name Started | src/views/AccountSettings/ | Name change initiated |
| PROFILE_UPDATED | Profile Updated | Views | Profile info updated |
| MARKETING_CONSENT_EMAIL_SEND | Marketing Consent email send | Views | Marketing consent changed |

### Balance & Currency Operations

| Constant | Event Name | Key Files | Trigger |
|----------|-----------|-----------|---------|
| FUND_BALANCE_ACCESSED | Fund Balance Accessed | Views | Fund balance page opened |
| FUND_BALANCE_COMPLETED | Fund Balance Completed | Views | Balance funded |
| CONVERT_BALANCE_ACCESSED | Convert Balance Accessed | Views | Currency conversion page |
| CONVERT_BALANCE_COMPLETED | Convert Balance Completed | Views | Balance converted |
| ADD_FUNDS_ACCESSED | Add Funds Accessed | Views | Add funds page opened |
| ADD_FUNDS_COMPLETED | Add Funds Completed | Views | Funds added |
| ADD_FUNDS_SUMMARY_CONFIRMED | Add Funds Summary Confirmed | Views | Add funds confirmed |
| CURRENCY_ACCOUNT_ACTIVATION_STARTED | Currency Account Activation Started | Views | New currency account |
| CURRENCY_ACCOUNT_ACTIVATION_COMPLETED | Currency Account Activation Completed | Views | Currency account active |

### Promotions & Referrals

| Constant | Event Name | Key Files | Trigger |
|----------|-----------|-----------|---------|
| PROMOTIONS_ACCESSED | Promotions Accessed | Views | Promotions page opened |
| PROMO_CODE_ADDED | Promo Code Added | Views | Promo code applied |
| PROMOTION_SELECTED | Promotion Selected | Views | Promotion chosen |
| PROMOTION_REMOVED | Promotion Removed | Views | Promotion removed |
| REFER_A_FRIEND_CLICKED | Refer a Friend Clicked | Views | RAF link clicked |
| REFER_A_FRIEND_CODE_SHARED | Refer a Friend Code Shared | Views | Referral code shared |

### Navigation & Activity

| Constant | Event Name | Key Files | Trigger |
|----------|-----------|-----------|---------|
| ACTIVITY_ACCESSED | Activity Accessed | src/views/Activity.vue | Transaction history opened |
| TRANSFER_DETAILS_ACCESSED | Transfer Details Accessed | Views | Transfer detail viewed |
| TRANSFER_DETAILS_SHARED | Transfer Details Shared | Views | Transfer receipt shared |
| RECEIPT_VIEWED | Receipt Viewed | Views | Transaction receipt viewed |
| MORE_MENU | More Menu Accessed | Views | More menu opened |

### Error Events

| Constant | Event Name | Key Files | Trigger |
|----------|-----------|-----------|---------|
| SOMETHING_WENT_WRONG | Something Went Wrong | Multiple views | Generic error displayed |
| TRANSACTION_FAILED | Transaction Failed | SendMoney views | Transaction processing failed |
| CONFIG_ISSUE_DETECTED | Config issue detected | Views | Configuration error |

### Corporate-Specific

| Constant | Event Name | Key Files | Trigger |
|----------|-----------|-----------|---------|
| AUTH_SIGNATORY_SUBMITTED | Auth Signatory Submitted | src/corporate/ | Authorized signatory added |
| MULTIPLE_PAYMENTS_ACCESSED | Multiple Payments Accessed | src/corporate/ | Mass payment page |
| MULTIPLE_PAYMENTS_COMPLETED | Multiple Payments Completed | src/corporate/ | Mass payment done |
| USER_ROLES_CHANGE_ROLE | User Role Changed | src/corporate/ | User role modified |
| USER_ROLES_DELETED_ROLE | User Removed | src/corporate/ | User removed from org |
| LIQUIDITY_MANAGER_CHANGED | Liquidity Manager Changed | src/corporate/ | LM settings changed |
| FORWARD_TO_RECIPIENT_ACCESSED | Forward to Recipient Accessed | src/corporate/ | Forward contract page |

---

## xe-apollo Events (Mobile App — AnalyticsEventType Enum)

Source: `xe-apollo/src/model/types/analytics.const.ts`
Tracking method: `this.analytics.trackEvent({ eventName: AnalyticsEventType.XXX, analyticsData: {...} })`
Total events in enum: **470+**

### Mobile-Only Events (NOT in galileo-site)

| Enum Constant | Event Name | Category |
|---|---|---|
| BiometricsFailed | Biometrics Failed | Auth |
| BiometricsEnabled | Biometrics Enabled | Auth |
| TwoFARequired | 2FA Required | Auth |
| TwoFASuccessful | 2FA Successful | Auth |
| TwoFASMSCodeEntered | 2FA SMS Code Entered | Auth |
| TwoFASetupStarted | 2FA Setup Started | Auth |
| TwoFAStarted | 2FA Started | Auth |
| TwoFACodeEntered | 2FA Code Entered | Auth |
| TwoFASelectionCompleted | 2FA Selection Completed | Auth |
| AccountLinkingStarted | Account Linking Started | Registration |
| AccountLinkingCompleted | Account Linking Completed | Registration |
| AccountLinkingFailed | Account Linking Failed | Registration |
| AccountRegistrationStarted | Account Registration Started | Registration |
| AccountRegistrationCredentialsSubmitted | Account Registration Credentials Submitted | Registration |
| AccountRegistrationFailed | Account Registration Failed | Registration |
| AccountTypeSelected | Account Type Selected | Registration |
| AccountCreated | Account Created | Registration |
| EmailVerificationStarted | Email Verification Started | Registration |
| EmailVerified | Email Verified | Registration |
| PersonalDetailsCompleted | Personal Details Completed | Registration |
| PhoneNumberCompleted | Phone Number Completed | Registration |
| PhoneVerificationStarted | Phone Verification Started | Registration |
| PhoneVerificationCompleted | Phone Verification Completed | Registration |
| MTRegistrationStarted | MT Registration Started | Registration |
| RegistrationMethodSelectorPageDisplayed | Registration Method Selector Page Displayed | Registration |
| RegistrationMethodSelected | Registration Method Selected | Registration |
| LoginSuccessful | Login Successful | Login |
| PasswordRecoveryStarted | Password Recovery Started | Login |
| PasswordRecoveryCompleted | Password Recovery Completed | Login |
| PasswordRecoveryFailed | Password Recovery Failed | Login |
| QuoteCreated | Quote Created | Send Money |
| QuoteUpdateFailed | Quote Update Failed | Send Money |
| TransactionCreatedClient | Transaction Created - Client Side | Send Money |
| TransactionEditConfirmed | Transaction Edit Confirmed | Send Money |
| DuplicateTransactionDetected | Duplicate Transaction Detected | Send Money |
| DraftTransferResumed | Draft Transfer Resumed | Send Money |
| OpenbankingTransferInstructionsAccepted | Openbanking Transfer Instructions Accepted | Payment |
| OpenbankingQuoteExpired | Openbanking Quote Expired | Payment |
| OpenbankingDraftTransfer | Openbanking Draft Transfer | Payment |
| OpenbankingDeeplinkRedirect | Openbanking Deeplink Redirect | Payment |
| ApplePayModalTriggered | Apple Pay Modal Triggered | Payment |
| ApplePayPaymentAttempted | Apple Pay Payment Attempted | Payment |
| ApplePayModalSuccess | Apple Pay Modal Success | Payment |
| ApplePayModalFailed | Apple Pay Modal Failed | Payment |
| GooglePayModalTriggered | Google Pay Modal Triggered | Payment |
| GooglePayPaymentAttempted | Google Pay Payment Attempted | Payment |
| GooglePayModalSuccess | Google Pay Modal Success | Payment |
| GooglePayModalFailed | Google Pay Modal Failed | Payment |
| PlaidOAuthOpened | Plaid OAuth Opened | Plaid |
| PlaidOpened | Plaid Opened | Plaid |
| PlaidError | Plaid Error | Plaid |
| PlaidInstitutionSelected | Plaid Institution Selected | Plaid |
| PlaidExit | Plaid Exit | Plaid |
| OnfidoVerificationCompleted | Onfido Verification Completed | KYC |
| OnfidoVerificationStarted | Onfido Verification Started | KYC |
| eIDRegistrationStarted | eID Registration Started | KYC |
| eIDUserRegistrationCompleted | eID User Registration Completed | KYC |
| RateAlertCreated | Rate Alert Created | Features |
| RateAlertDeleted | Rate Alert Deleted | Features |
| RateAlertTriggered | Rate Alert Triggered | Features |
| RateAlertCreationStarted | Rate Alert Creation Started | Features |
| WidgetShowAdd | Widget Show Add | Features |
| WidgetAdded | Widget Added | Features |
| WidgetSendMoney | Widget Send Money | Features |
| eSimSetupStarted | eSim Setup Started | Features |
| eSimSetupCompleted | eSim Setup Completed | Features |
| eSimSetupFailed | eSim Setup Failed | Features |
| TopBanksAccessed | Top Banks Accessed | Recipients |
| TopBankSelected | Top Bank Selected | Recipients |
| BankLookupAccessed | Bank Lookup Accessed | Recipients |
| CaptchaChallengeStarted | Captcha Challenge Started | Security |
| CaptchaChallengeFailed | Captcha Challenge Failed | Security |
| RootedDeviceDetected | Rooted Device Detected | Security |
| ForceUpdatePopUpPresented | Force Update Pop Up Presented | App |
| ForceUpdateSelected | Force Update Selected | App |
| InAppReviewPrompted | InApp Review Prompted | App |
| ErrorPopup | Error Popup | Error |
| SomethingWentWrong | Something Went Wrong | Error |
| ChatWidgetAccessed | Chat Widget Accessed | Support |
| ChatWidgetClosed | Chat Widget Closed | Support |

### Cross-Platform Events (in BOTH galileo-site and xe-apollo)

These events share the same name and are fired from both codebases:

| Event Name | galileo-site Constant | xe-apollo Constant |
|---|---|---|
| Registration Started | REGISTRATION_STARTED | RegistrationStarted |
| Login Failed | LOGIN_FAILED | LoginFailed |
| Profile Created | PROFILE_CREATED | ProfileCreated |
| Profile Updated | PROFILE_UPDATED | ProfileUpdated |
| Quote Accessed | QUOTE_ACCESSED | QuoteAccessed |
| Quote Confirmed | QUOTE_CONFIRMED | QuoteConfirmed |
| Quote Error | QUOTE_ERROR | QuoteError |
| Payment Method Selected | PAYMENT_METHOD_SELECTED | PaymentMethodSelected |
| Transaction Summary Confirmed | TRANSACTION_SUMMARY_CONFIRMED | TransactionSummaryConfirmed |
| Transaction Created | (server-side) | TransactionCreated |
| Transaction Failed | TRANSACTION_FAILED | TransactionFailed |
| Recipient Creation Started | RECIPIENT_STARTED | RecipientCreationStarted |
| Recipient Info Added | RECIPIENT_INFO_ADDED | RecipientInfoAdded |
| Recipient Bank Details Added | RECIPIENT_BANK_DETAILS_ADDED | RecipientBankDetailsAdded |
| Recipient Created | RECIPIENT_CREATED | (not explicit) |
| Recipient Selected | RECIPIENT_SELECTED | RecipientSelected |
| Biometric Verification Started | BIOMETRIC_VERIFICATION_STARTED | BiometricVerificationStarted |
| Biometric Verification Completed [client-side] | BIOMETRIC_VERIFICATION_COMPLETED | BiometricVerificationCompletedClientSide |
| Card Authorisation Started | CARD_AUTHORISATION_STARTED | CardAuthorisationStarted |
| Card Authorisation Failed | CARD_AUTHORISATION_FAILED | CardAuthorisationFailed |
| Bank Verification Started | BANK_VERIFICATION_STARTED | BankVerificationStarted |
| Bank Verification Completed | BANK_VERIFICATION_COMPLETED | BankVerificationCompleted |
| Something Went Wrong | SOMETHING_WENT_WRONG | SomethingWentWrong |
| Settings Accessed | SETTINGS_ACCESSED | SettingsAccessed |
| Repeat Transfer Started | REPEAT_TRANSFER_STARTED | RepeatTransferStarted |
| Add Funds Accessed | ADD_FUNDS_ACCESSED | AddFundsAccessed |
| Add Funds Completed | ADD_FUNDS_COMPLETED | AddFundsCompleted |

---

## Amplitude-Only Events (Not in galileo-site code)

These events appear in Amplitude but are not fired from galileo-site `SEGMENT_EVENTS`:

### Server-Side Events
| Event | Source | Description |
|-------|--------|-------------|
| Account Approved | Backend | Account approved after review |
| Account Approved with STP | Backend | Straight-through processing approval |
| Account Closed | Backend | Account closed |
| Account Restricted | Backend | Account restricted |
| Transaction Created | Backend | Transaction submitted to processing |
| Transaction Completed | Backend | Transaction fully processed |
| Transaction Status Updated | Backend | Status change notification |
| Payment Completed | Backend | Payment confirmed |
| Disbursement Sent | Backend | Money sent to recipient |
| Fraud Check Completed/Referred/Started | Backend | Fraud screening |
| PEP SAN Check Completed/Started | Backend | Sanctions screening |
| Risk Assessment Completed | Backend | Risk evaluation |
| eKYC Results Received | Backend | Verification results from provider |
| eKYC Started | Backend | Verification initiated |

### Mobile App Events (xe-apollo)
| Event | Source | Description |
|-------|--------|-------------|
| Application Installed | AppsFlyer | App installed |
| Application Opened | Firebase/Segment | App opened |
| Install Attributed | AppsFlyer | Install attributed to campaign |
| af_mt_profile_created | AppsFlyer | MT profile via AppsFlyer |

### Third-Party Events
| Event | Source | Description |
|-------|--------|-------------|
| [Iterable] emailBounce | Iterable | Email bounced |
| [Iterable] emailSend | Iterable | Email sent |
| [Iterable] emailSubscribe | Iterable | Email subscription |
| [Iterable] inAppSend | Iterable | In-app message sent |
| [Iterable] pushSend | Iterable | Push notification sent |
| [Amplitude] Page Viewed | Amplitude auto-track | Page view auto-captured |

### XECD Events (Currency Data Product)
| Event | Source | Description |
|-------|--------|-------------|
| XECD API Request | XECD platform | API call made |
| XECD Action - Button Clicked | XECD platform | UI action |
| XECD Agreement Updated | XECD platform | Agreement change |
| XECD Free Trial * | XECD platform | Free trial events |
| XECD Registration * | XECD platform | Registration events |
| XECD Billing * | XECD platform | Billing events |

---

## BUG: Undefined Event

`SEGMENT_EVENTS.NEW_PAYMENT_METHOD_COMPLETED` is referenced at `galileo-site/src/components/Views/PaymentMethod/MicroDepositModal.vue:255` but **does not exist** in `SEGMENT_EVENTS`. This fires `event: undefined` at runtime — a silent tracking failure.

## Duplicate Event String

`BANK_VERIFICATION_COMPLETED` and `BANK_VERIFICATION_SUCCESS` both map to `"Bank Verification Completed"`. They fire from different contexts (micro-deposit vs Plaid) but appear as the same event in Amplitude — impossible to distinguish.

## Unused Events in galileo-site (31 dead constants)

These are defined in `SEGMENT_EVENTS` but never referenced anywhere in `src/`:

| Constant | Event String | Likely Reason |
|----------|-------------|---------------|
| ACCOUNT_CREATION_COMPLETED | Account Creation Completed (Client-side) | Server-side only now |
| ADDRESS_CREATED | Address Created | Replaced by ADDRESS_UPDATED |
| COUNTRY_CONFIRMED | Country Confirmed | Not used in web flow |
| DESTINATION_COUNTRY_SELECTED | Destination Country Selected | Replaced by DESTINATION_COUNTRY_CURRENCY_SELECTION_COMPLETED |
| FORGOT_PASSWORD_STARTED | Password Recovery Started | Password recovery tracked differently |
| ID_UPDATED | ID Updated | Unused |
| IDENTITY_VERIFICATION_STARTED | Identity Verification Started | BIOMETRIC_VERIFICATION_STARTED used instead |
| LANGUAGE_UPDATED | Language Updated | LANGUAGE_SELECTED used instead |
| NOTIFICATIONS_UPDATED | Notifications Updated | Unused |
| OTP_HELP_SELECTED | OTP Help Selected | Unused |
| PASSWORD_CREATED | Password Created | Unused |
| PHONE_ADDED | Phone Added | Unused |
| PHONE_FAILED | Phone Failed | Unused |
| PICKUP_LOCATION_SELECTED | Pick Up Location Selected | PAYOUT_LOCATION_SELECTED used instead |
| PROFILE_CREATED | Profile Created | Fired from xe-apollo only |
| PROFILE_UPDATED | Profile Updated | Fired from xe-apollo only |
| QUOTE_CALCULATED | Quote Calculated | Fired from xe-apollo only (web uses QUOTE_CREATED) |
| RECIPIENT_CREATED | Recipient Created | RECIPIENT_INFO_ADDED used instead |
| REGISTRATION_STARTED | Registration Started | Fired from xe-apollo only |
| SECURITY_METHOD_STARTED | Security Method Started | Unused |
| BANK_DETAILS_VIEWED | Bank Details Viewed | Unused |
| REPEAT_PAYMENT_STARTED | Repeat Payment Started | Unused |
| SWITCH_TO_CLASSIC_STARTED | Switch to Classic Started | Legacy migration — no longer relevant |
| SWITCH_TO_CLASSIC_CONFIRMED | Switch to Classic Confirmed | Legacy migration — no longer relevant |
| LEGACY_SITE_PROMPT_DISPLAYED | Legacy Site Prompt Displayed | Legacy migration — no longer relevant |
| LEGACY_SITE_INITIATED | Legacy Site Initiated | Legacy migration — no longer relevant |
| NON_SUPPORTED_CARD_BILLING_COUNTRY_ADDED | Non Supported Card Billing Country Added | Unused |
| EDD_PERSONAL_INFORMATION_COMPLETED | EDD Personal Information Completed | Fired from xe-apollo only |
| EDD_ID_INFORMATION_COMPLETED | EDD ID Information Completed | Fired from xe-apollo only |
| EDD_ID_MOBILE_NUMBER_COMPLETED | EDD ID Mobile Number Completed | Fired from xe-apollo only |
| EDD_RELATIONSHIP_TO_BENEFICARY_COMPLETED | EDD Relationship To Beneficary Completed | Fired from xe-apollo only |

## Known Naming Issues

| Issue | Events | Recommendation |
|-------|--------|----------------|
| Double space | "Promo  Added" vs "Promo Added" | Two separate constants exist — standardize |
| Client-side suffix | "Biometric Verification Completed [client-side]" | Distinguishes from server-side event |
| Inconsistent casing | Most events use Title Case | Maintain Title Case convention |
| Typo in constant | EDD_RELATIONSHIP_TO_BENEFICARY (should be BENEFICIARY) | Code constant has typo, but event name in Amplitude is correct |
| Duplicate string | BANK_VERIFICATION_COMPLETED = BANK_VERIFICATION_SUCCESS = "Bank Verification Completed" | Can't distinguish micro-deposit vs Plaid in Amplitude |
| Undefined reference | NEW_PAYMENT_METHOD_COMPLETED used but not defined | Bug — fires undefined event |
