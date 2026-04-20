# Xe KPI Definitions

## Primary KPIs

### Transactions Created
- **What**: Total money transfer transactions created
- **Why it matters**: Direct revenue proxy — each transaction generates fee revenue
- **Amplitude event**: `Transaction Created`
- **Chart**: f7zaeg0
- **Alert**: Drop > 10% week-over-week
- **Owner**: Product team
- **Segments to check when investigating dips**:
  - Platform (web vs mobile web vs app)
  - Country / region (NAM, EMEA, APAC)
  - Account type (consumer vs corporate)
  - Payment method type
- **Related events**: `Transaction Created - Client Side`, `First Time Transaction Created`
- **Upstream dependencies**: Send Money funnel must be healthy

### Active Users (DAU/WAU/MAU)
- **What**: Unique users performing any active event
- **Why it matters**: Engagement health — declining active users = churn signal
- **Amplitude event**: `_active` (meta event)
- **Chart**: cvmn241
- **Alert**: Drop > 5% week-over-week
- **Owner**: Product team
- **Segments**: Platform, country

### MT Profile Created
- **What**: Users completing money transfer profile setup
- **Why it matters**: Profile creation is the gateway to sending money — no profile = no transaction
- **Amplitude event**: `MT Profile Created`
- **Chart**: wo2ytol
- **Alert**: Drop > 15% week-over-week
- **Owner**: Growth team
- **Upstream**: Registration funnel → Profile creation

### 0-Day Conversions
- **What**: Users who register AND create their first transaction on the same day
- **Why it matters**: Measures onboarding quality — higher = smoother first-time experience
- **Chart**: tfmh89d
- **Alert**: Drop > 10% week-over-week
- **Owner**: Growth team
- **Composite metric**: Must be queried from existing chart, not a single event

### Payment Method Added Conversion
- **What**: Funnel conversion rate for adding a payment method
- **Why it matters**: Payment method is a prerequisite for transactions — friction here blocks revenue
- **Amplitude event**: `New Payment Method Added`
- **Chart**: 57ornik
- **Alert**: Drop > 10% week-over-week
- **Owner**: Payments team

---

## Secondary KPIs

### Registration Conversion Rate
- **What**: End-to-end registration funnel conversion (Started → Account Created)
- **Chart**: gb4ye0pp
- **Owner**: Growth team

### Send Money Conversion Rate
- **What**: Quote-to-transaction conversion
- **Chart**: q6zkbdob
- **Owner**: Product team

### Card Payment Success Rate
- **What**: % of card payments that succeed
- **Chart**: bwvmoe4
- **Owner**: Payments team

### eKYC Pass Rate
- **What**: % of biometric verifications that pass
- **Dashboard**: 77n87qhw (eKYC Results and Rates per Region)
- **Owner**: Compliance/Product

---

## Error KPIs (Monitor for Spikes)

| Error Event | Severity | Normal Range | Investigate If |
|---|---|---|---|
| Something Went Wrong | High | < 1% of sessions | > 2% of sessions |
| Quote Error | High | < 0.5% of quotes | > 1% of quotes |
| Payment Failed | Critical | Varies by method | > 10% above baseline |
| Card Authorisation Failed | High | 10-20% of attempts | > 25% |
| Login Failed | Medium | 5-15% of attempts | > 20% |
| Open Banking Payment Failed | High | 5-15% of attempts | > 20% |
| Transaction Failed | Critical | < 2% | > 5% |

---

## How to Query KPIs in Amplitude

### Weekly Trend (Last 90 Days)
```json
{
  "name": "Transactions Created - Weekly Trend",
  "type": "eventsSegmentation",
  "app": "295336",
  "params": {
    "range": "Last 90 Days",
    "events": [{ "event_type": "Transaction Created", "filters": [], "group_by": [] }],
    "metric": "totals",
    "countGroup": "User",
    "groupBy": [],
    "interval": 7,
    "segments": [{ "conditions": [] }]
  }
}
```

### Grouped by Platform
```json
{
  "name": "Active Users by Platform",
  "type": "eventsSegmentation",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "events": [{ "event_type": "_active", "filters": [], "group_by": [] }],
    "metric": "uniques",
    "countGroup": "User",
    "groupBy": [{ "type": "user", "value": "platform" }],
    "interval": 7,
    "segments": [{ "conditions": [] }]
  }
}
```

---

## Key Dashboards for KPI Monitoring

| Dashboard | ID | Focus |
|---|---|---|
| App Dashboard (Official) | 03voyrq | Overall Apollo app performance |
| Consumer Platforms (Official) | exzgz73 | Consumer platforms overview |
| Xe Consumer Conversion | 5vkt8c97 | Conversion metrics |
| NAM KPIs | rzsgfl3q | North America metrics |
| EMEA Topline | idrgrhkv | Europe/Middle East metrics |
| Growth Metrics Corporate | zwpsuzaj | Corporate growth |
| Conversion Dashboard | 64p6st9b | Cross-funnel conversion |
