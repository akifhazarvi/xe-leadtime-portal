#!/usr/bin/env node
// Processes raw Amplitude data into corridors.json
// Data sourced from Amplitude Project 295336 (Xe [Prod] Web & App) on 2026-03-27
// Methodology: Funnel-based conversion (Quote Confirmed -> Transaction Completed, 7-day window, same users)
// Corridor = TBU Region + sendCurrency -> payoutCurrency

const fs = require('fs');
const path = require('path');

// ── TBU ID -> Region Name ───────────────────────────────────────────────────
const TBU_MAP = {
  '60': 'US', '42': 'UK', '800': 'EU', '150': 'AU', '700': 'CA', '90': 'NZ'
};

// ── Core Funnel Data (Quote Confirmed -> Transaction Completed, 7-day window) ──
// [tbuId, sendCurrency, payoutCurrency, conversion, quoted, avgTime, medianTime, completed]
const funnelRaw = [
  ['60','USD','INR',0.7693,9356,327995,400310,7198],
  ['800','EUR','INR',0.8740,6256,33408,2706,5468],
  ['42','GBP','EUR',0.9007,5589,27784,1259,5034],
  ['60','USD','USD',0.1125,3796,209286,163111,427],
  ['42','GBP','INR',0.8242,2309,15279,1021,1903],
  ['60','USD','EUR',0.6437,1768,249725,273060,1138],
  ['150','AUD','INR',0.8414,1766,39952,1765,1486],
  ['800','EUR','MAD',0.7141,1651,29065,1028,1179],
  ['60','USD','MXN',0.6427,1542,162401,7578,991],
  ['42','GBP','USD',0.8028,1440,51756,13239,1156],
  ['800','GBP','EUR',0.9073,1284,25997,2281,1165],
  ['60','USD','PHP',0.6693,1125,182280,16336,753],
  ['700','CAD','USD',0.7201,1097,248639,271750,790],
  ['42','GBP','NAD',0.9224,1070,13904,936,987],
  ['800','EUR','USD',0.5205,1051,86618,47328,547],
  ['42','GBP','ZAR',0.9239,867,21612,996,801],
  ['60','USD','CAD',0.7552,862,292477,318641,651],
  ['60','USD','GBP',0.7629,793,241732,261945,605],
  ['150','AUD','NZD',0.9155,710,56222,36577,650],
  ['90','NZD','INR',0.8730,701,22905,4798,612],
  ['42','GBP','THB',0.9063,694,18538,1010,629],
  ['60','USD','COP',0.6411,677,139712,1594,434],
  ['150','AUD','USD',0.7255,674,76993,39332,489],
  ['700','CAD','INR',0.6238,622,182410,74393,388],
  ['42','GBP','AUD',0.9058,616,26913,1341,558],
  ['150','GBP','AUD',0.9094,607,34294,2787,552],
  ['(none)','AUD','USD',0,605,0,0,0],
  ['(none)','GBP','EUR',0,550,0,0,0],
  ['42','GBP','PKR',0.7472,542,20113,960,405],
  ['150','AUD','GBP',0.8942,539,42646,3205,482],
  ['150','AUD','THB',0.9028,535,39226,1635,483],
  ['700','CAD','MAD',0.7519,532,123723,11835,400],
  ['42','GBP','PHP',0.7861,519,22709,982,408],
  ['(none)','GBP','USD',0,518,0,0,0],
  ['42','EUR','GBP',0.7265,468,66498,5767,340],
  ['60','USD','XOF',0.7457,460,77975,858,343],
  ['700','CAD','EUR',0.6468,453,222397,214723,293],
  ['60','USD','THB',0.7803,437,237227,280037,341],
  ['150','AUD','EUR',0.8060,433,57238,13670,349],
  ['42','GBP','MAD',0.8626,422,19472,969,364],
  ['150','AUD','PHP',0.8186,419,27495,1540,343],
  ['90','NZD','AUD',0.8243,404,72927,45716,333],
  ['800','USD','EUR',0.2594,401,92937,55839,104],
  ['60','USD','DOP',0.1148,392,91953,1116,45],
  ['800','EUR','THB',0.7732,388,40000,2961,300],
  ['60','USD','NGN',0.1260,381,104425,1343,48],
  ['42','USD','GBP',0.6676,376,75335,19101,251],
  ['60','USD','AUD',0.5440,375,297197,335075,204],
  ['800','EUR','NAD',0.8387,372,33812,1030,312],
  ['700','CAD','XOF',0.5967,367,45265,952,219],
];

// ── Region-Level Summary ────────────────────────────────────────────────────
// [tbuId, quoted, completed, conversion, avgTime, medianTime]
const regionSummary = [
  ['60', 24902, 15298, 0.6143, 261116, 298032],
  ['42', 19165, 16007, 0.8352, 31145, 1335],
  ['800', 17043, 12360, 0.7252, 42128, 2689],
  ['150', 7936, 6572, 0.8281, 49603, 5411],
  ['700', 6272, 4205, 0.6704, 176161, 63081],
  ['90', 2885, 2443, 0.8468, 45405, 8609],
  ['(none)', 3760, 1, 0.0003, 498019, 498019],
];

// ── Weekly Trend Data (completed users per week, last 13 weeks) ─────────────
// Used to calculate WoW and MoM trends per TBU region
const weeklyCompleted = {
  '60':  [4228,5135,4819,4820,5156,5274,4912,4462,4643,5382,5555,5023,4654,2808],
  '42':  [5004,5365,5440,4834,5080,6675,5299,4442,4416,5887,5455,5030,4585,4076],
  '800': [3859,4706,3735,3104,4771,6168,3964,3090,2693,4701,4052,3450,3021,3286],
  '150': [2039,2186,2296,2159,2327,2739,2213,2195,1918,2312,2128,2189,1956,1609],
  '700': [1003,1373,1343,1282,1438,1691,1379,1310,1227,1408,1583,1499,1323,703],
  '90':  [817,749,854,782,959,1027,800,754,722,863,803,764,796,582],
};
// Weeks: Dec22, Dec29, Jan5, Jan12, Jan19, Jan26, Feb2, Feb9, Feb16, Feb23, Mar2, Mar9, Mar16(inc), Mar23(inc)
// Complete weeks: index 0-11 (Dec22 through Mar9)

// ── Quote Errors by Currency Pair (unique users, last 30 days) ──────────────
const quoteErrors = {
  'GBP;GBP':9934,'AUD;AUD':7132,'EUR;EUR':6193,'USD;INR':6121,'USD;USD':5269,
  'GBP;EUR':4329,'EUR;INR':4256,'USD;EUR':3000,'GBP;INR':2482,'EUR;MAD':2334,
  'USD;MXN':2080,'EUR;USD':2015,'GBP;USD':1852,'CAD;CAD':1786,'AUD;INR':1682,
  'CAD;USD':1329,'USD;GBP':1239,'USD;CAD':1135,'AUD;USD':1132,'USD;PHP':1107,
  'USD;AUD':1096,'USD;COP':1071,'NZD;NZD':998,'EUR;GBP':937,'GBP;AUD':886,
  'CAD;INR':831,'USD;NGN':750,'CAD;MAD':686,'GBP;NAD':670,'USD;XOF':655,
  'EUR;COP':641,'GBP;THB':608,'GBP;PKR':598,'NZD;INR':576,'EUR;THB':571,
  'GBP;ZAR':568,'CAD;MXN':536,'CAD;XOF':531,'USD;THB':526,'EUR;XOF':518,
  'CAD;EUR':505,'NZD;AUD':503,'EUR;ETB':497,'AUD;EUR':489,'USD;MAD':489,
  'AUD;NZD':481,'AUD;THB':476,'USD;JPY':472,'AUD;GBP':469,'AUD;PHP':465,
  'USD;GHS':465,'GBP;AED':446,'GBP;MAD':439,'USD;PKR':345,'USD;IDR':322,
  'USD;DOP':250,'EUR;NAD':177,'GBP;PHP':372,'USD;ZAR':314,'USD;AED':284,
  'USD;NZD':206,'NZD;USD':199,'GBP;LKR':192,'USD;ETB':242,'GBP;BWP':177,
};

// ── Demand Volume (Quote Created unique users, last 30 days) ────────────────
const demandVolume = {
  'USD;INR':42686,'GBP;EUR':36622,'USD;EUR':27968,'USD;USD':23348,'EUR;INR':22257,
  'GBP;INR':15347,'EUR;USD':14625,'EUR;EUR':14360,'GBP;USD':13324,'CAD;USD':11651,
  'USD;GBP':10879,'USD;AUD':10700,'USD;CAD':10436,'EUR;MAD':9815,'USD;MXN':9047,
  'AUD;INR':8726,'AUD;USD':8680,'GBP;AUD':8560,'EUR;GBP':8537,'CAD;CAD':8143,
  'USD;PHP':6136,'CAD;INR':5455,'EUR;AUD':4154,'GBP;THB':4148,'CAD;EUR':4141,
  'GBP;PKR':4118,'AUD;EUR':4032,'EUR;THB':3991,'GBP;ZAR':3929,'AUD;NZD':3853,
  'AUD;GBP':3764,'USD;COP':3589,'USD;THB':3530,'NZD;AUD':3354,'GBP;CAD':2953,
  'GBP;AED':2911,'USD;NGN':2897,'NZD;INR':2866,'AUD;THB':2816,'GBP;NAD':2712,
  'USD;PKR':2480,'CAD;MAD':2468,'GBP;PHP':2409,'AUD;PHP':2363,'USD;XOF':2349,
  'USD;MAD':2309,'GBP;NZD':2263,'EUR;XOF':2239,'CAD;MXN':2172,'USD;ZAR':2166,
  'EUR;CAD':2162,'USD;JPY':2030,'GBP;MAD':1994,'EUR;COP':1860,'NZD;NZD':1810,
  'CAD;AUD':1809,'CAD;GBP':1797,'USD;AED':1779,'CAD;XOF':1691,'AUD;IDR':1631,
  'USD;DOP':1608,'EUR;AED':1565,'EUR;PKR':1515,'EUR;PHP':1509,'USD;GHS':1474,
  'USD;NZD':1456,'NZD;USD':1449,'USD;IDR':1409,'AUD;MYR':1333,'USD;MYR':1294,
  'USD;VND':1283,'USD;BRL':1267,'EUR;ETB':1234,'EUR;NAD':951,'USD;ETB':1001,
  'EUR;NAD':951,'GBP;BWP':728,'USD;NAD':598,
};

// ── Helper Functions ────────────────────────────────────────────────────────

function formatMedianTime(seconds) {
  if (seconds === 0) return 'N/A';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} hrs`;
  return `${(seconds / 86400).toFixed(1)} days`;
}

function calcWoW(weekly) {
  // Compare last 2 complete weeks (index 11 vs 10)
  if (!weekly || weekly.length < 12) return 0;
  const recent = weekly[11];
  const prev = weekly[10];
  if (prev === 0) return 0;
  return ((recent - prev) / prev) * 100;
}

function calcMoM(weekly) {
  // Compare 4 complete weeks (index 8-11) vs 4 before (index 4-7)
  if (!weekly || weekly.length < 12) return 0;
  const recent = weekly[8] + weekly[9] + weekly[10] + weekly[11];
  const prev = weekly[4] + weekly[5] + weekly[6] + weekly[7];
  if (prev === 0) return 0;
  return ((recent - prev) / prev) * 100;
}

function getIssues(corridor) {
  const issues = [];
  if (corridor.tbuId === '(none)') {
    issues.push('Broken: No TBU set (anonymous/unregistered users)');
    return issues;
  }
  if (corridor.conversion < 20) issues.push(`Very low conversion: ${corridor.conversion.toFixed(1)}%`);
  else if (corridor.conversion < 50) issues.push(`Low conversion: ${corridor.conversion.toFixed(1)}%`);
  else if (corridor.conversion < 65) issues.push(`Below-average conversion: ${corridor.conversion.toFixed(1)}%`);
  if (corridor.medianTimeSeconds > 86400) issues.push(`Multi-day settlement: ${corridor.medianTimeFormatted}`);
  if (corridor.trend.wow < -10) issues.push(`Declining WoW: ${corridor.trend.wow.toFixed(1)}%`);
  if (corridor.trend.mom < -15) issues.push(`Declining MoM: ${corridor.trend.mom.toFixed(1)}%`);
  return issues;
}

function severityScore(c) {
  let score = 0;
  if (c.conversion < 20) score += 40;
  else if (c.conversion < 50) score += 30;
  else if (c.conversion < 65) score += 20;
  else if (c.conversion < 75) score += 10;
  if (c.medianTimeSeconds > 259200) score += 15; // >3 days
  else if (c.medianTimeSeconds > 86400) score += 10; // >1 day
  if (c.trend.wow < -10) score += 15;
  else if (c.trend.wow < -5) score += 8;
  if (c.trend.mom < -15) score += 15;
  else if (c.trend.mom < -5) score += 8;
  score += c.issues.length * 5;
  return score;
}

// ── Build Corridors ─────────────────────────────────────────────────────────

const corridors = funnelRaw.map(row => {
  const [tbuId, sendCurrency, payoutCurrency, conversion, quoted, avgTime, medianTime, completed] = row;
  const tbuRegion = TBU_MAP[tbuId] || '(none)';
  const currencyKey = `${sendCurrency};${payoutCurrency}`;
  const demand = demandVolume[currencyKey] || 0;

  const weekly = weeklyCompleted[tbuId];
  const wow = calcWoW(weekly);
  const mom = calcMoM(weekly);

  const corridor = {
    id: `${tbuRegion}; ${sendCurrency} \u2192 ${payoutCurrency}`,
    tbuId,
    tbuRegion,
    sendCurrency,
    payoutCurrency,
    quoted,
    completed,
    conversion: parseFloat((conversion * 100).toFixed(1)),
    medianTimeSeconds: medianTime,
    medianTimeFormatted: formatMedianTime(medianTime),
    avgTimeSeconds: avgTime,
    demand,
    trend: {
      wow: parseFloat(wow.toFixed(1)),
      mom: parseFloat(mom.toFixed(1)),
    },
    issues: [],
  };
  corridor.issues = getIssues(corridor);
  corridor.severity = severityScore(corridor);
  return corridor;
});

// Sort by completed (volume) descending
corridors.sort((a, b) => b.completed - a.completed);

// ── Build Region Summary ────────────────────────────────────────────────────

const regions = regionSummary
  .filter(r => r[0] !== '(none)')
  .map(row => {
    const [tbuId, quoted, completed, conversion, avgTime, medianTime] = row;
    const weekly = weeklyCompleted[tbuId];
    return {
      tbuId,
      tbuRegion: TBU_MAP[tbuId],
      quoted,
      completed,
      conversion: parseFloat((conversion * 100).toFixed(1)),
      medianTimeSeconds: medianTime,
      medianTimeFormatted: formatMedianTime(medianTime),
      trend: {
        wow: parseFloat(calcWoW(weekly).toFixed(1)),
        mom: parseFloat(calcMoM(weekly).toFixed(1)),
      },
    };
  })
  .sort((a, b) => b.completed - a.completed);

// ── Load existing mobile web health check data ─────────────────────────────

let mobileWebHealthCheck = null;
const existingPath = path.join(__dirname, '..', 'data', 'corridors.json');
try {
  const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
  if (existing.mobileWebHealthCheck) {
    mobileWebHealthCheck = existing.mobileWebHealthCheck;
  }
} catch (e) {
  console.log('No existing corridors.json found, skipping mobile web health check data');
}

// ── Build Output ────────────────────────────────────────────────────────────

const totalQuoted = corridors.filter(c => c.tbuId !== '(none)').reduce((s, c) => s + c.quoted, 0);
const totalCompleted = corridors.filter(c => c.tbuId !== '(none)').reduce((s, c) => s + c.completed, 0);

const output = {
  metadata: {
    generated: new Date().toISOString().split('T')[0],
    source: 'Amplitude Project 295336 (Xe [Prod] Web & App)',
    period: 'Last 30 Days',
    methodology: 'Funnel: Quote Confirmed -> Transaction Completed (7-day window, same users, ordered)',
    corridorDefinition: 'TBU Region (gp:TBU user property) + sendCurrency -> payoutCurrency',
    filters: 'Consumer only (accountType != Corporate), Transfer only (transactionType = Transfer)',
    totalCorridors: corridors.length,
    totalQuotedUsers: totalQuoted,
    totalCompletedUsers: totalCompleted,
    overallConversion: parseFloat(((totalCompleted / totalQuoted) * 100).toFixed(1)),
  },
  regions,
  corridors,
};

if (mobileWebHealthCheck) {
  output.mobileWebHealthCheck = mobileWebHealthCheck;
}

// ── Write Output ────────────────────────────────────────────────────────────

const outPath = path.join(__dirname, '..', 'data', 'corridors.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Written ${corridors.length} corridors to ${outPath}`);
console.log(`Total: ${totalQuoted} quoted -> ${totalCompleted} completed (${((totalCompleted/totalQuoted)*100).toFixed(1)}%)`);
console.log(`Regions: ${regions.map(r => `${r.tbuRegion}: ${r.conversion}%`).join(', ')}`);

// Also copy to portal/data/corridors.json
const portalCopy = path.join(__dirname, '..', '..', 'data', 'corridors.json');
try {
  fs.mkdirSync(path.dirname(portalCopy), { recursive: true });
  fs.writeFileSync(portalCopy, JSON.stringify(output, null, 2));
  console.log(`Copied to ${portalCopy}`);
} catch (e) {
  console.log(`Could not copy to ${portalCopy}: ${e.message}`);
}
