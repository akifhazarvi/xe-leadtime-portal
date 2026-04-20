# Xe Analytics Architecture

## Data Pipeline

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│  galileo-site   │────▶│   Segment   │────▶│  Amplitude   │
│  (Vue 3 Web)    │     │   (CDP)     │     │  Project:    │
│                 │     │             │     │  295336      │
└─────────────────┘     └─────────────┘     └─────────────┘
                              │
                              ├────▶ Google Tag Manager
                              ├────▶ LogRocket
                              └────▶ Iterable (email)

┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│   xe-apollo     │────▶│   Segment   │────▶│  Amplitude   │
│ (Ionic Mobile)  │     │             │     │  Project:    │
│                 │     └─────────────┘     │  295336 +    │
│                 │────▶ Firebase Analytics  │  295341      │
│                 │────▶ AppsFlyer           └─────────────┘
│                 │────▶ Tealium
└─────────────────┘
```

## galileo-site (Web) — Tracking Implementation

### Stack
- **Framework**: Vue 3 + Pinia + TypeScript
- **Analytics SDK**: Segment JavaScript SDK (analytics.js v4.13.1)
- **Session tracking**: Amplitude session ID extracted from Segment's "Actions Amplitude" integration
- **Consent**: Cookie-based consent system (`xeConsentState`). Two tiers:
  - Essential (analytics: true, compliance: false) → Segment + essential integrations
  - All (analytics: true, compliance: true) → Segment + all integrations including marketing

### How Events Are Tracked
1. Events are defined as string constants in `src/constants/segmentAnalytics.ts` → `SEGMENT_EVENTS`
2. The `useAnalyticsStore()` Pinia store (`src/stores/analytics.ts`) provides:
   - `track({ event, traits })` — tracks a custom event
   - `page(pageName)` — tracks page views
   - `identify({ userId, traits })` — identifies users
3. Components/views import the store and call `analyticsStore.track()` with event name + properties
4. Segment forwards events to Amplitude via the "Actions Amplitude" destination
5. GTM events are sent separately via `gtmTrack()`

### Key Files
- `src/constants/segmentAnalytics.ts` — All event name constants (~170 events)
- `src/stores/analytics.ts` — Analytics store with track/page/identify methods
- `src/models/Analytics/index.d.ts` — TypeScript declarations for window.analytics
- `src/models/Analytics/interfaces/SegmentEvent.ts` — Segment event interface
- `src/constants/trackConsentIntegrations/` — Consent tier configurations

### User Properties (Identify Traits)
Set when user logs in via `trackUser()`:
- TBU, AccountType, accountStatus, age, city, clientNumber, country
- dateOfBirth, email, firstName, middleName, lastName, locale
- emailMarketingAllowed, phoneCountry, phoneNumber
- product (always "galileo"), region, userId, userLanguage
- hasMoneyTransferProfile, fxWebCorpMigrated, brand

## xe-apollo (Mobile App) — Tracking Implementation

### Stack
- **Framework**: Ionic + Angular + TypeScript
- **Analytics Providers**: Segment, Firebase Analytics, AppsFlyer, Tealium
- **Event Interface**: `IAnalyticsEvent { eventName: string; analyticsData?: any; }`

### How Events Are Tracked
1. Events are defined in `AnalyticsEventType` enum in `src/model/types/analytics.const.ts` (**470+ events**)
2. `SegmentProvider` (`src/providers/analytics/segment.ts`) is the main tracking provider:
   - `trackEvent(event: IAnalyticsEvent)` — tracks custom events
   - `trackView(event: IAnalyticsEvent)` — tracks page views
   - `identify(userId, traits)` — identifies users
   - `identifyCustomer(customer)` — identifies logged-in customers
3. Pages call `this.analytics.trackEvent({ eventName: AnalyticsEventType.XXX, analyticsData: {...} })`
4. Events typically fire in Ionic lifecycle hooks: `ionViewDidLoad()`, click handlers, success/failure callbacks
5. Segment API key: `6wYGhQVZ0nOCOYUxRMNU661IQr4ppQ2G` (prod)

### Key Files
- `src/model/types/analytics.const.ts` — **470+ event name constants** (AnalyticsEventType, TealiumEventType, AppsflyerEventType enums)
- `src/providers/analytics/segment.ts` — Main Segment provider (570+ lines)
- `src/providers/analytics/firebase-analytics.ts` — Firebase Analytics provider
- `src/providers/analytics/appsflyer.ts` — AppsFlyer provider (also uses Segment internally)
- `src/providers/analytics/tealium.ts` — Tealium provider (tags.tiqcdn.com)
- `src/model/models/analytics/analytics-event.interface.ts` — `IAnalyticsEvent` interface
- `src/environment/environment.prod.ts` — Production config with API keys

### Provider-Specific Events
- **Segment** → Amplitude (same pipeline as web)
- **Firebase Analytics** → Used for crash reporting and app-specific metrics
- **AppsFlyer** → Attribution, install tracking, specific events (af_login, af_send_money_start, etc.)
- **Tealium** → Tag management with its own event names (TealiumEventType enum)

### Additional Enums
- `TealiumEventType` — Tealium-specific events (registration steps, send money steps, check rates)
- `AppsflyerEventType` — AppsFlyer events (NewOrder, NewRegistration, af_login, af_money_profile_created)
- `AnalyticsEventLocationNames` — Location context values (Sign in, Sign up, Check prices)

## Amplitude Configuration

### Project: Xe [Prod] Web & App (295336)
- **Timezone**: UTC
- **Session timeout**: 30 minutes
- **Currency**: en-us locale

### Platform Property Values
Used to segment data by platform:
- `Web` — Desktop browser
- `Mobile Web` — Mobile browser
- `iOS` — Native iOS app
- `Android` — Native Android app

### Special Amplitude Meta Events
- `_active` — Any active event (for DAU/MAU)
- `_new` — Events from new users
- `_all` — All tracked events
- `_any_revenue_event` — Revenue events

### Custom Properties
Custom properties are prefixed with `gp:` in Amplitude queries:
- `gp:email`, `gp:full name`, `gp:clientNumber`
- `gp:[Experiment] feature-name` — Experiment flags
