# Tracking Pipeline — How Events Actually Flow

Deep reference for how analytics events are fired, enriched, and delivered from code to Amplitude. Derived from reading the actual source code in galileo-site and xe-apollo.

---

## Web Pipeline (galileo-site)

### Initialization Sequence

```
User visits site
  → useAnalyticsStore().init()
    → checkTrackingConsent()           # reads xeConsentState cookie
      → if cookie missing, await trackingConsentPromise  # blocks until user accepts cookie banner
    → if consent.performance: initLogRocket()
    → if consent.compliance: initSegment()
```

**Key insight**: ALL tracking is blocked until the user responds to the cookie banner. Both `track()` and `identify()` await two promises:
1. `analyticsPromise` — resolves when Segment SDK loads
2. `trackingConsentPromise` — resolves when user accepts cookies

### Consent Tiers

| Tier | Cookie Value | What Loads | GTM |
|------|-------------|------------|-----|
| Essential | `{ analytics: true, compliance: false }` | Segment + essential integrations | GTM blocked |
| All | `{ analytics: true, compliance: true }` | Segment + ALL integrations | GTM enabled |

Source: `src/stores/analytics.ts:119-136`

Essential consent blocks GTM only — Segment always loads (with `{ 'Google Tag Manager': false }` in integrations).
All consent loads Segment with empty integrations object (all destinations enabled).

Source files:
- `src/constants/trackConsentIntegrations/essential.const.ts` → `{ integrations: { 'Google Tag Manager': false } }`
- `src/constants/trackConsentIntegrations/all.const.ts` → `{ integrations: {} }`

### The track() Call

```typescript
// src/stores/analytics.ts:499-538
async function track({ event, traits = null }) {
  await analyticsPromise         // wait for Segment SDK
  await trackingConsentPromise   // wait for cookie consent

  const tempTraits = { ...traits }

  // AUTO-INJECTED PROPERTIES (if not already set):
  if (!tempTraits.accountType)        → identifyData.AccountType
  if (!tempTraits.email)              → identifyData.email
  if (!tempTraits.logRocketSessionUrl) → logRocketSessionUrl
  if (!tempTraits.brand)              → sessionStore.brand (or "xe")
  if (!tempTraits.flowName)           → context.flowName

  // Fire to Segment
  window.analytics.track(event, tempTraits, callback)
}
```

**Every web event automatically gets**: `accountType`, `email`, `logRocketSessionUrl`, `brand`, `flowName` — even if the component doesn't set them.

### The page() Call

```typescript
// src/stores/analytics.ts:470-486
async function page(pageName) {
  await analyticsPromise
  await trackingConsentPromise
  // Only sends brand property
  window.analytics.page(pageName, { brand }, callback)
}
```

Page views only carry `brand`. No other auto-properties.

### The identify() Call

```typescript
// src/stores/analytics.ts:488-497
async function identify({ userId, traits }) {
  await analyticsPromise
  await trackingConsentPromise
  window.analytics.identify(userId, traits, callback)
}
```

Called via `trackUser()` when user logs in. Full identify schema documented in event-properties.md.

### Amplitude Session ID Extraction

```typescript
// src/stores/analytics.ts:461-468
function getAmplitudeSessionId(event) {
  const { session_id } = event.event?.integrations['Actions Amplitude'] || {}
  if (!amplitudeSessionId && session_id) {
    setHeader('AmplitudeSessionID', session_id.toString())
    amplitudeSessionId = session_id
  }
}
```

The Amplitude session ID is extracted from Segment's callback and injected as an HTTP header (`AmplitudeSessionID`) on API calls. This links backend events to the same Amplitude session.

### GTM (Google Tag Manager)

Separate from Segment. Fires to `window.dataLayer`:

```typescript
// src/stores/analytics.ts:544-553
async function gtmTrack({ event, variables }) {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event, ...variables })
}
```

GTM key: `GTM-WNCL796` (hardcoded, only fires on xe.com domains).

### LogRocket Integration

- Initialized if `consent.performance` is true
- Session URL captured and injected into EVERY subsequent `track()` call as `logRocketSessionUrl`
- A `LogRocket` event is fired when session URL becomes available
- PII sanitization: 60+ field names sanitized (passwords, tokens, card numbers, names, addresses)
- Onfido API bodies are stripped entirely

Source: `src/stores/analytics.ts:317-458`

### Flow Location Tracking

The `getSegmentEventCurrentLocation()` function determines `location` context based on Vue Router route name:

| Route/Transfer Type | Location Value |
|---|---|
| QuickTransfer | "Quick transfer" |
| ConvertBalance | "Exchange" |
| FundBalance | "Add funds" |
| SchedulePayment | "Schedule payment" |
| SendMoney (default) | "Send money flow" |

Source: `src/stores/analytics.ts:48-76`

---

## Mobile App Pipeline (xe-apollo)

### Initialization Sequence

```
App launches
  → Platform.ready()
    → SegmentProvider.init()
      → Checks cordova availability
      → Segment.start({ context: { app: { businessUnit, platform, version } } })
      → Segment.anonymousId() → stores anonymous ID
      → Generates placeholder email: "{anonymousId}@placeholder.email"
```

**Key difference from web**: No cookie consent gate. Tracking starts immediately on cordova.

### Multi-Provider Architecture

xe-apollo fires to 4 analytics providers simultaneously:

| Provider | File | What It Tracks |
|----------|------|---------------|
| **Segment** | `src/providers/analytics/segment.ts` | All events → Amplitude |
| **Firebase** | `src/providers/analytics/firebase-analytics.ts` | Crash reporting, app metrics |
| **AppsFlyer** | `src/providers/analytics/appsflyer.ts` | Attribution, installs, LTV |
| **Tealium** | `src/providers/analytics/tealium.ts` | Tag management (conditional) |

Segment is the primary pipeline to Amplitude. The others serve different purposes.

### The trackEvent() Call

```typescript
// src/providers/analytics/segment.ts:331-345
async trackEvent(event: IAnalyticsEvent) {
  await this.platform.ready()
  if (this.platform.is('cordova')) {
    this.lastEventName = event.eventName
    if (!event.analyticsData) event.analyticsData = {}
    event.analyticsData = await this.getAnalyticsData(event.analyticsData)
    Segment.track(event.eventName, event.analyticsData, SegmentProvider.getOptions())
    // Also fires to Firebase if provider exists
  }
}
```

### Auto-Enrichment (App)

```typescript
// src/providers/analytics/segment.ts:362-373
async getAnalyticsData(analyticsData) {
  if (APP_CONFIG.appBrand === AppBrand.XE) {
    analyticsData.xemt = ResourceProvider.isXEMT ? true : false
    if (!analyticsData.email) {
      analyticsData.email = httpProvider.getAuthEmail() || SegmentProvider.getAnonymousEmail()
    }
  }
  return analyticsData
}
```

**Every app event automatically gets**: `xemt` flag (is XE Money Transfer user) + `email` (auth email or anonymous placeholder).

### Context Attached to Every Call

```typescript
// src/providers/analytics/segment.ts:471-481
static getOptions() {
  return {
    context: {
      app: {
        businessUnit: APP_CONFIG.analyticsSettings.businessUnit,
        platform: SegmentProvider.getPlatformName(),  // 'ios' | 'android' | 'browser'
        version: `${versionNo}:${versionCode}`        // e.g. "7.15.0:123"
      }
    }
  }
}
```

### Platform Detection

```typescript
// src/providers/analytics/segment.ts:460-468
static getPlatformName() {
  if (!this.platform.is('cordova')) return 'browser'
  if (this.platform.is('ios') || (this.platform.is('cordova') && !this.platform.is('android')))
    return 'ios'
  if (this.platform.is('android')) return 'android'
  return 'unknown'
}
```

**Note**: If cordova is present but platform is neither iOS nor Android, it defaults to 'ios'. This could cause misattribution.

### Event Queue for Pre-Auth Events

```typescript
// src/providers/analytics/segment.ts:375-377
async queueIdentifyEvent(event: IAnalyticsEvent) {
  this.queuedIdentifyEvents.push(event)
}
```

Events fired before `identify()` are queued. After `identify()` completes, all queued events are replayed:

```typescript
// src/providers/analytics/segment.ts:214-217
for (let i = 0; i < this.queuedIdentifyEvents.length; i++) {
  this.trackEvent(this.queuedIdentifyEvents[i])
}
this.queuedIdentifyEvents = []
```

### Anonymous User Handling

- Before login: `userId = ''`, `email = "{anonymousId}@placeholder.email"`
- After login: `userId = profileId`, `email = customer.emailAddress`
- **Critical guard**: `identify()` is blocked if userId contains `@placeholder.email` — this was added to fix a bug in v7.14.2-v7.14.4 where placeholder emails polluted user profiles

Source: `src/providers/analytics/segment.ts:182-200`

### Error Popup Tracking

The `RmtPopupComponent` has a hardwired analytics callback:

```typescript
// src/providers/analytics/segment.ts:59-65
RmtPopupComponent.analyticsErrorCallback = (message, title) => {
  this.trackEvent({
    eventName: AnalyticsEventType.ErrorPopup,
    analyticsData: { email, error_message: message, error_title: title }
  })
}
```

Every error popup shown to the user fires an `Error Popup` event with the error message and title.

### Error Detail Extraction

`SegmentProvider.fetchExactErrorDetails(ex)` parses API error responses for `reasonCode` and `reasonDesc` fields, used when tracking payment/transaction errors.

Source: `src/providers/analytics/segment.ts:405-436`

---

## Key Differences: Web vs App

| Aspect | galileo-site (Web) | xe-apollo (App) |
|--------|-------------------|-----------------|
| **Consent gate** | Blocks ALL tracking until cookie accepted | No consent gate (starts immediately) |
| **SDK** | Segment JS (analytics.js v4.13.1, CDN) | Segment Native Plugin (cordova) |
| **Auto-properties on track()** | accountType, email, logRocketSessionUrl, brand, flowName | xemt, email |
| **User ID** | customer.id (numeric string) | profileId (may differ from customer.id) |
| **Anonymous handling** | Segment manages anonymousId | Custom: `{anonymousId}@placeholder.email` |
| **Session linking** | AmplitudeSessionID header on API calls | Via Segment context.app |
| **Page tracking** | `page(pageName)` with brand only | `trackView(event)` with full analyticsData |
| **Providers** | Segment + GTM | Segment + Firebase + AppsFlyer + Tealium |
| **Error tracking** | SOMETHING_WENT_WRONG event | ErrorPopup callback + SomethingWentWrong |
| **Version** | VITE_VERSION env var | `${versionNo}:${versionCode}` from AppVersion |
| **iOS IDFA** | N/A | Explicit consent prompts |

---

## End-to-End Flow Summary

```
Component fires event
  │
  ├─ Web: analyticsStore.track({ event: SEGMENT_EVENTS.X, traits: {...} })
  │    → await consent + SDK ready
  │    → auto-inject accountType, email, brand, flowName, logRocketSessionUrl
  │    → window.analytics.track(event, traits)
  │    → Segment CDN → Amplitude (295336)
  │    → Also: GTM (if consent=all), LogRocket (if consent=performance)
  │
  └─ App: segmentProvider.trackEvent({ eventName: AnalyticsEventType.X, analyticsData: {...} })
       → await platform.ready()
       → auto-inject xemt, email
       → Segment.track(event, data, { context: { app: { businessUnit, platform, version } } })
       → Segment Native → Amplitude (295336 + 295341)
       → Also: Firebase (crash reporting), AppsFlyer (attribution), Tealium (tags)
```
