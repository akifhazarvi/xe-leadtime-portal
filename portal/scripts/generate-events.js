#!/usr/bin/env node

/**
 * Event Documentation Generator
 * Scans galileo-site and xe-apollo codebases to extract all analytics events,
 * their code locations, properties, and cross-references them into a single JSON file.
 *
 * Usage:
 *   node generate-events.js --galileo ../galileo-site --apollo ../xe-apollo --output ../data/events.json
 */

const fs = require('fs');
const path = require('path');

// --- CLI Args ---
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const GALILEO_ROOT = path.resolve(getArg('galileo', path.join(__dirname, '..', '..', '..', 'galileo-site')));
const APOLLO_ROOT = path.resolve(getArg('apollo', path.join(__dirname, '..', '..', '..', 'xe-apollo')));
const OUTPUT_PATH = path.resolve(getArg('output', path.join(__dirname, '..', 'data', 'events.json')));
const ANNOTATIONS_PATH = path.resolve(getArg('annotations', path.join(__dirname, '..', 'manual-annotations.json')));
const CONFIG_ROOT = path.resolve(path.join(__dirname, '..', '..', 'config'));

console.log(`Galileo: ${GALILEO_ROOT}`);
console.log(`Apollo:  ${APOLLO_ROOT}`);
console.log(`Output:  ${OUTPUT_PATH}`);

// --- Step 1: Parse event constants ---

function parseGalileoEvents() {
  const filePath = path.join(GALILEO_ROOT, 'src/constants/segmentAnalytics.ts');
  if (!fs.existsSync(filePath)) {
    console.error(`Galileo events file not found: ${filePath}`);
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const events = {};

  // Match: CONSTANT_NAME: 'Event Name' or CONSTANT_NAME: "Event Name"
  // Also handle multi-line values
  const regex = /(\w+):\s*['"]([^'"]+)['"]/g;
  let match;

  // Only parse inside SEGMENT_EVENTS block
  const segmentBlock = content.match(/export const SEGMENT_EVENTS\s*=\s*\{([\s\S]*?)\n\}/);
  if (!segmentBlock) {
    console.error('Could not find SEGMENT_EVENTS block');
    return {};
  }

  const block = segmentBlock[1];
  while ((match = regex.exec(block)) !== null) {
    const [, constant, eventName] = match;
    events[constant] = eventName;
  }

  // Also parse supporting constants
  const locations = {};
  const locBlock = content.match(/export const SEGMENT_LOCATIONS\s*=\s*\{([\s\S]*?)\n\}/);
  if (locBlock) {
    while ((match = regex.exec(locBlock[1])) !== null) {
      locations[match[1]] = match[2];
    }
  }

  const paymentTypes = {};
  const payBlock = content.match(/export const SEGMENT_PAYMENT_METHOD_TYPES\s*=\s*\{([\s\S]*?)\n\}/);
  if (payBlock) {
    regex.lastIndex = 0;
    while ((match = regex.exec(payBlock[1])) !== null) {
      paymentTypes[match[1]] = match[2];
    }
  }

  console.log(`  Parsed ${Object.keys(events).length} galileo events`);
  return { events, locations, paymentTypes };
}

function parseApolloEvents() {
  const filePath = path.join(APOLLO_ROOT, 'src/model/types/analytics.const.ts');
  if (!fs.existsSync(filePath)) {
    console.error(`Apollo events file not found: ${filePath}`);
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const events = {};

  // Match enum members: MemberName = 'Event Name'
  const regex = /(\w+)\s*=\s*['"]([^'"]+)['"]/g;
  let match;

  // Parse AnalyticsEventType enum
  const enumBlock = content.match(/export enum AnalyticsEventType\s*\{([\s\S]*?)\n\}/);
  if (!enumBlock) {
    console.error('Could not find AnalyticsEventType enum');
    return {};
  }

  while ((match = regex.exec(enumBlock[1])) !== null) {
    const [, member, eventName] = match;
    events[member] = eventName;
  }

  // Also parse TealiumEventType
  const tealiumEvents = {};
  const tealBlock = content.match(/export enum TealiumEventType\s*\{([\s\S]*?)\n\}/);
  if (tealBlock) {
    regex.lastIndex = 0;
    while ((match = regex.exec(tealBlock[1])) !== null) {
      tealiumEvents[match[1]] = match[2];
    }
  }

  console.log(`  Parsed ${Object.keys(events).length} apollo events`);
  return { events, tealiumEvents };
}

// --- Step 2: Cross-reference platforms ---

function crossReference(galileoEvents, apolloEvents) {
  const allEvents = new Map(); // eventName -> { ... }

  // Index galileo events by event string
  const galileoByName = new Map();
  for (const [constant, name] of Object.entries(galileoEvents)) {
    galileoByName.set(name, constant);
  }

  // Index apollo events by event string
  const apolloByName = new Map();
  for (const [member, name] of Object.entries(apolloEvents)) {
    apolloByName.set(name, member);
  }

  // Merge
  const allNames = new Set([...galileoByName.keys(), ...apolloByName.keys()]);

  for (const name of allNames) {
    const inGalileo = galileoByName.has(name);
    const inApollo = apolloByName.has(name);

    let source;
    const platforms = [];
    if (inGalileo && inApollo) {
      source = 'cross_platform';
      platforms.push('Web', 'iOS', 'Android');
    } else if (inGalileo) {
      source = 'web_only';
      platforms.push('Web');
    } else {
      source = 'mobile_only';
      platforms.push('iOS', 'Android');
    }

    allEvents.set(name, {
      name,
      source,
      platforms,
      constants: {
        web: inGalileo ? `SEGMENT_EVENTS.${galileoByName.get(name)}` : null,
        app: inApollo ? `AnalyticsEventType.${apolloByName.get(name)}` : null,
      },
      _galileoConstant: inGalileo ? galileoByName.get(name) : null,
      _apolloMember: inApollo ? apolloByName.get(name) : null,
    });
  }

  const crossPlatform = [...allEvents.values()].filter(e => e.source === 'cross_platform').length;
  const webOnly = [...allEvents.values()].filter(e => e.source === 'web_only').length;
  const mobileOnly = [...allEvents.values()].filter(e => e.source === 'mobile_only').length;
  console.log(`  Cross-platform: ${crossPlatform}, Web-only: ${webOnly}, Mobile-only: ${mobileOnly}`);

  return allEvents;
}

// --- Step 3: Find code locations ---

function walkDir(dir, extensions, relativeTo) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      results.push(...walkDir(fullPath, extensions, relativeTo));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function findCodeLocations(allEvents, galileoRoot, apolloRoot) {
  console.log('  Scanning galileo-site for code locations...');
  const galileoFiles = walkDir(path.join(galileoRoot, 'src'), ['.ts', '.vue'], galileoRoot);
  console.log(`    Found ${galileoFiles.length} files to scan`);

  console.log('  Scanning xe-apollo for code locations...');
  const apolloFiles = walkDir(path.join(apolloRoot, 'src'), ['.ts'], apolloRoot);
  console.log(`    Found ${apolloFiles.length} files to scan`);

  // Build search index: file -> content + lines
  function scanFiles(files, rootDir) {
    const index = [];
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const relPath = path.relative(rootDir, filePath);
        index.push({ relPath, content, lines: content.split('\n') });
      } catch (e) { /* skip unreadable */ }
    }
    return index;
  }

  const galileoIndex = scanFiles(galileoFiles, galileoRoot);
  const apolloIndex = scanFiles(apolloFiles, apolloRoot);

  for (const [name, event] of allEvents) {
    event.codeLocations = { galileo: [], apollo: [] };

    // Search galileo
    if (event._galileoConstant) {
      const searchTerm = `SEGMENT_EVENTS.${event._galileoConstant}`;
      const constFile = 'src/constants/segmentAnalytics.ts';

      for (const { relPath, content, lines } of galileoIndex) {
        if (relPath === constFile) continue; // Skip the definition file
        const idx = content.indexOf(searchTerm);
        if (idx === -1) continue;

        // Find all occurrences
        let searchFrom = 0;
        while (true) {
          const pos = content.indexOf(searchTerm, searchFrom);
          if (pos === -1) break;

          const lineNum = content.substring(0, pos).split('\n').length;
          const context = extractContext(lines, lineNum - 1);

          event.codeLocations.galileo.push({
            file: relPath,
            line: lineNum,
            context,
          });
          searchFrom = pos + searchTerm.length;
        }
      }
    }

    // Search apollo
    if (event._apolloMember) {
      const searchTerm = `AnalyticsEventType.${event._apolloMember}`;
      const constFile = 'src/model/types/analytics.const.ts';

      for (const { relPath, content, lines } of apolloIndex) {
        if (relPath === constFile) continue;
        const idx = content.indexOf(searchTerm);
        if (idx === -1) continue;

        let searchFrom = 0;
        while (true) {
          const pos = content.indexOf(searchTerm, searchFrom);
          if (pos === -1) break;

          const lineNum = content.substring(0, pos).split('\n').length;
          const context = extractContext(lines, lineNum - 1);

          event.codeLocations.apollo.push({
            file: relPath,
            line: lineNum,
            context,
          });
          searchFrom = pos + searchTerm.length;
        }
      }
    }
  }

  const withLocations = [...allEvents.values()].filter(
    e => e.codeLocations.galileo.length > 0 || e.codeLocations.apollo.length > 0
  ).length;
  const withoutLocations = allEvents.size - withLocations;
  console.log(`  Events with code locations: ${withLocations}, without: ${withoutLocations}`);
}

function extractContext(lines, lineIdx) {
  // Look at surrounding lines to find the function/method name
  const start = Math.max(0, lineIdx - 10);
  const surrounding = lines.slice(start, lineIdx + 1).join('\n');

  // Try to find function/method name
  const funcMatch = surrounding.match(/(?:async\s+)?(?:function\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/);
  const methodMatch = surrounding.match(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/);
  const arrowMatch = surrounding.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);

  const funcName = funcMatch?.[1] || methodMatch?.[1] || arrowMatch?.[1] || '';

  // Get the actual line content (trimmed)
  const lineContent = lines[lineIdx]?.trim() || '';

  if (funcName) {
    return `${funcName}() — ${lineContent.substring(0, 80)}`;
  }
  return lineContent.substring(0, 100);
}

// --- Step 4: Extract properties from track() calls ---

function extractProperties(allEvents, galileoRoot, apolloRoot) {
  console.log('  Extracting properties from track() calls...');

  for (const [name, event] of allEvents) {
    event.properties = [];
    const propNames = new Set();

    // Extract from galileo locations
    for (const loc of event.codeLocations.galileo) {
      const filePath = path.join(galileoRoot, loc.file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const startLine = Math.max(0, loc.line - 5);
        const endLine = Math.min(lines.length, loc.line + 35);
        const block = lines.slice(startLine, endLine).join('\n');

        // Find traits object
        const traitsMatch = block.match(/traits:\s*\{([\s\S]*?)\}/);
        if (traitsMatch) {
          extractPropsFromObject(traitsMatch[1], propNames, event.properties, event.platforms);
        }
      } catch (e) { /* skip */ }
    }

    // Extract from apollo locations
    for (const loc of event.codeLocations.apollo) {
      const filePath = path.join(apolloRoot, loc.file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const startLine = Math.max(0, loc.line - 5);
        const endLine = Math.min(lines.length, loc.line + 35);
        const block = lines.slice(startLine, endLine).join('\n');

        // Find analyticsData object
        const dataMatch = block.match(/analyticsData:\s*\{([\s\S]*?)\}/);
        if (dataMatch) {
          extractPropsFromObject(dataMatch[1], propNames, event.properties, event.platforms);
        }
      } catch (e) { /* skip */ }
    }
  }

  const withProps = [...allEvents.values()].filter(e => e.properties.length > 0).length;
  console.log(`  Events with extracted properties: ${withProps}`);
}

function extractPropsFromObject(objStr, seen, propsArray, platforms) {
  // Match property names in object literal: propName: value or 'propName': value
  const propRegex = /['"]?(\w+)['"]?\s*:/g;
  let match;
  while ((match = propRegex.exec(objStr)) !== null) {
    const propName = match[1];
    // Skip spread operators and common non-property patterns
    if (propName === 'event' || propName === 'eventName' || propName === 'traits' ||
        propName === 'analyticsData' || propName === 'type' || seen.has(propName)) continue;

    seen.add(propName);

    // Try to infer type from the value
    const afterColon = objStr.substring(match.index + match[0].length, match.index + match[0].length + 100).trim();
    const type = inferType(afterColon);

    propsArray.push({
      name: propName,
      type,
      description: '',
      example: inferExample(propName, type),
      source: 'explicit',
      platforms,
    });
  }
}

function inferType(valueStr) {
  if (valueStr.startsWith("'") || valueStr.startsWith('"') || valueStr.startsWith('`')) return 'string';
  if (valueStr.startsWith('true') || valueStr.startsWith('false')) return 'boolean';
  if (/^\d/.test(valueStr)) return 'number';
  if (valueStr.startsWith('[')) return 'array';
  if (valueStr.startsWith('{')) return 'object';
  // Check for known patterns
  if (valueStr.includes('toString()')) return 'string';
  if (valueStr.includes('.length')) return 'number';
  if (valueStr.includes('getAmount') || valueStr.includes('amount') || valueStr.includes('Amount')) return 'number';
  if (valueStr.includes('country') || valueStr.includes('Country')) return 'string';
  if (valueStr.includes('currency') || valueStr.includes('Currency')) return 'string';
  if (valueStr.includes('email') || valueStr.includes('Email')) return 'string';
  if (valueStr.includes('is') || valueStr.includes('has') || valueStr.includes('did')) return 'boolean';
  return 'string'; // default
}

function inferExample(propName, type) {
  // Generate realistic example values based on property name patterns
  const examples = {
    'email': 'user@example.com',
    'sender_country': 'GB', 'senderCountry': 'GB', 'country': 'GB',
    'destination_country': 'IN', 'destinationCountry': 'IN',
    'send_currency': 'GBP', 'sendCurrency': 'GBP', 'currencyFrom': 'GBP',
    'payout_currency': 'INR', 'payoutCurrency': 'INR', 'currencyTo': 'INR',
    'send_amount': 500, 'sendAmount': 500, 'amountFrom': 500,
    'payout_amount': 52450, 'payoutAmount': 52450, 'amountTo': 52450,
    'payoutMethod': 'Bank', 'paymentMethod': 'DebitCard', 'sendMethod': 'DebitCard',
    'location': 'sendMoney', 'screenLocation': 'sendMoney',
    'brand': 'xe',
    'accountType': 'Personal', 'AccountType': 'Personal',
    'paymentType': 'DebitCard',
    'errorCode': 'QUOTE070', 'errorDescription': 'Quote expired',
    'error': 'Payment authorization failed',
    'walletProvider': 'M-Pesa',
    'promoCode': 'SAVE10', 'promoApplied': false, 'promoName': 'Welcome Offer',
    'logRocketSessionUrl': 'https://app.logrocket.com/...',
    'xemt': true,
    'flowName': 'Send money flow',
    'isRiaTransfer': false,
    'sameCurrency': false,
    'rateChanged': false,
    'userType': 'Personal',
    'rate': 104.9,
    'totalAmountPaid': 503.99,
    'feeUSD': 3.99,
    'contractNumber': 'XE-12345678',
    'transactionId': 'txn-abc-123',
    'transactionStatus': 'completed',
    'recipientId': 'rec-456',
    'recipientCountry': 'IN',
    'numberOfRecipients': 1,
    'cardBrand': 'Visa',
    'authorisationType': '3DS',
  };

  if (examples[propName] !== undefined) return examples[propName];
  if (type === 'boolean') return true;
  if (type === 'number') return 1;
  if (type === 'array') return [];
  return '';
}

// --- Step 5: Categorize events ---

function categorizeEvents(allEvents) {
  const categoryRules = [
    { id: 'send_money', name: 'Quote & Send Money', match: /quote|transfer|transaction|send.money|quick.transfer|repeat|schedule|forward|duplicate|convert.*fund|add.*fund|fund.*balance|convert.*balance/i },
    { id: 'registration', name: 'Registration & Onboarding', match: /registr|account.*creat|profile.*creat|onboard|account.*type|email.*verif|personal.*detail|phone.*number.*compl/i },
    { id: 'login', name: 'Login & Authentication', match: /login|sign.?in|sign.?out|password|2fa|two.?fa|mfa|security.*method|captcha|biometric.*enable|biometric.*reactivat/i },
    { id: 'payment', name: 'Payment Methods', match: /payment|card.*auth|cvv|bank.*verif|bank.*account|open.?banking|apple.pay|google.pay|interac|plaid|micro.?deposit|new.*card/i },
    { id: 'recipient', name: 'Recipients', match: /recipient|bank.*lookup|bank.*detail|ifsc|top.bank|wallet.*provider|wallet.*detail|payout.*location|pick.?up|agent/i },
    { id: 'kyc', name: 'Identity Verification', match: /biometric|veriff|onfido|kyc|ekyc|edd|identity.*verif|upload.*doc/i },
    { id: 'account', name: 'Account & Settings', match: /settings|change.*email|change.*password|change.*phone|change.*name|change.*address|change.*occupation|profile.*updat|address.*creat|address.*updat|notification|marketing|language|id.*updat/i },
    { id: 'balance', name: 'Balance & Currency', match: /balance|currency.*account|add.*funds|convert.*funds|fund.*balance|exchange/i },
    { id: 'promo', name: 'Promotions & Referrals', match: /promo|refer|promotion/i },
    { id: 'rate_alert', name: 'Rate Alerts', match: /rate.*alert/i },
    { id: 'navigation', name: 'Navigation & Activity', match: /accessed|menu|activity|receipt|transfer.*detail|track.*transfer|default.*landing/i },
    { id: 'error', name: 'Error Events', match: /error|failed|went.wrong|popup|config.*issue/i },
    { id: 'corporate', name: 'Corporate', match: /corporate|multiple.*payment|user.*role|liquidity|auth.*signatory|britline/i },
    { id: 'mobile_features', name: 'Mobile Features', match: /widget|esim|force.*update|in.?app.*review|carousel|rooted|chat|deeplink|logrocket|sikhona|ria.*my|notification.*discrepancy/i },
    { id: 'eid', name: 'eID & Digital Identity', match: /eid/i },
  ];

  for (const [name, event] of allEvents) {
    let matched = false;
    for (const rule of categoryRules) {
      if (rule.match.test(name)) {
        event.category = rule.id;
        matched = true;
        break;
      }
    }
    if (!matched) {
      event.category = 'other';
    }
  }

  // Count per category
  const counts = {};
  for (const event of allEvents.values()) {
    counts[event.category] = (counts[event.category] || 0) + 1;
  }
  console.log('  Categories:', JSON.stringify(counts));
}

// --- Step 6: Enrich with funnel data ---

function enrichWithFunnels(allEvents, configRoot) {
  const funnelsPath = path.join(configRoot, 'funnels.json');
  if (!fs.existsSync(funnelsPath)) {
    console.log('  No funnels.json found, skipping funnel enrichment');
    return {};
  }

  const funnelsConfig = JSON.parse(fs.readFileSync(funnelsPath, 'utf8'));
  const funnels = {};

  for (const [key, funnel] of Object.entries(funnelsConfig.funnels)) {
    const steps = funnel.steps.map(s => s.event);
    funnels[key] = { name: funnel.name, steps };

    // Assign funnel membership and flow context
    for (let i = 0; i < steps.length; i++) {
      const eventName = steps[i];
      const event = allEvents.get(eventName);
      if (!event) continue;

      if (!event.funnels) event.funnels = [];
      if (!event.funnels.includes(key)) event.funnels.push(key);

      if (!event.flow) event.flow = { previous: [], next: [] };
      if (i > 0 && !event.flow.previous.includes(steps[i - 1])) {
        event.flow.previous.push(steps[i - 1]);
      }
      if (i < steps.length - 1 && !event.flow.next.includes(steps[i + 1])) {
        event.flow.next.push(steps[i + 1]);
      }
    }
  }

  return funnels;
}

// --- Step 7: Merge manual annotations ---

function mergeAnnotations(allEvents, annotationsPath) {
  if (!fs.existsSync(annotationsPath)) {
    console.log('  No manual-annotations.json found, skipping');
    return;
  }

  const annotations = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));
  let merged = 0;

  for (const [eventName, annotation] of Object.entries(annotations)) {
    const event = allEvents.get(eventName);
    if (!event) continue;

    // Merge fields (annotation takes precedence)
    if (annotation.trigger) event.trigger = annotation.trigger;
    if (annotation.notes) event.notes = annotation.notes;
    if (annotation.issues) event.issues = annotation.issues;
    if (annotation.intelligence) event.intelligence = annotation.intelligence;
    if (annotation.samplePayload) event.samplePayload = annotation.samplePayload;
    if (annotation.category) event.category = annotation.category;

    // Merge properties (annotation adds/overrides by name)
    if (annotation.properties) {
      for (const prop of annotation.properties) {
        const existing = event.properties.find(p => p.name === prop.name);
        if (existing) {
          Object.assign(existing, prop);
        } else {
          event.properties.push(prop);
        }
      }
    }

    merged++;
  }

  console.log(`  Merged annotations for ${merged} events`);
}

// --- Step 7b: Merge BE-only events from Amplitude ---

function mergeBEEvents(allEvents) {
  const bePath = path.join(__dirname, '..', 'data', 'be-events.json');
  if (!fs.existsSync(bePath)) {
    console.log('  No be-events.json found, skipping BE event injection');
    return;
  }

  const beEvents = JSON.parse(fs.readFileSync(bePath, 'utf8'));
  let added = 0;

  for (const [name, event] of Object.entries(beEvents)) {
    if (!allEvents.has(name)) {
      allEvents.set(name, event);
      added++;
    }
  }

  console.log(`  Added ${added} backend-only events from Amplitude`);
}

// --- Step 8: Build final output ---

function buildOutput(allEvents, funnels) {
  const categories = [
    { id: 'send_money', name: 'Quote & Send Money' },
    { id: 'registration', name: 'Registration & Onboarding' },
    { id: 'login', name: 'Login & Authentication' },
    { id: 'payment', name: 'Payment Methods' },
    { id: 'recipient', name: 'Recipients' },
    { id: 'kyc', name: 'Identity Verification' },
    { id: 'account', name: 'Account & Settings' },
    { id: 'balance', name: 'Balance & Currency' },
    { id: 'promo', name: 'Promotions & Referrals' },
    { id: 'rate_alert', name: 'Rate Alerts' },
    { id: 'navigation', name: 'Navigation & Activity' },
    { id: 'error', name: 'Error Events' },
    { id: 'corporate', name: 'Corporate' },
    { id: 'mobile_features', name: 'Mobile Features' },
    { id: 'eid', name: 'eID & Digital Identity' },
    { id: 'third_party', name: 'Third-Party (Iterable, HubSpot, XECD)' },
    { id: 'other', name: 'Other' },
  ];

  // Count events per category
  for (const cat of categories) {
    cat.eventCount = [...allEvents.values()].filter(e => e.category === cat.id).length;
  }

  // Clean up internal fields
  const events = {};
  for (const [name, event] of allEvents) {
    delete event._galileoConstant;
    delete event._apolloMember;

    // Ensure all fields exist
    if (!event.trigger) event.trigger = '';
    if (!event.notes) event.notes = '';
    if (!event.issues) event.issues = [];
    if (!event.funnels) event.funnels = [];
    if (!event.flow) event.flow = { previous: [], next: [] };
    if (!event.intelligence) event.intelligence = null;
    if (!event.samplePayload) {
      // Auto-generate sample from properties
      if (event.properties.length > 0) {
        const sample = { event: name, properties: {} };
        for (const prop of event.properties) {
          if (prop.example !== undefined && prop.example !== '') {
            sample.properties[prop.name] = prop.example;
          }
        }
        event.samplePayload = sample;
      } else {
        event.samplePayload = null;
      }
    }

    events[name] = event;
  }

  const crossPlatform = Object.values(events).filter(e => e.source === 'cross_platform').length;
  const webOnly = Object.values(events).filter(e => e.source === 'web_only').length;
  const mobileOnly = Object.values(events).filter(e => e.source === 'mobile_only').length;
  const serverSide = Object.values(events).filter(e => e.source === 'server_side').length;
  const thirdParty = Object.values(events).filter(e => e.source === 'third_party').length;
  const appsflyer = Object.values(events).filter(e => e.source === 'appsflyer').length;
  const withIntelligence = Object.values(events).filter(e => e.intelligence).length;

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      totalEvents: Object.keys(events).length,
      crossPlatform,
      webOnly,
      mobileOnly,
      serverSide,
      thirdParty,
      appsflyer,
      withIntelligence,
      withCodeLocations: Object.values(events).filter(
        e => e.codeLocations && (e.codeLocations.galileo?.length > 0 || e.codeLocations.apollo?.length > 0)
      ).length,
    },
    categories: categories.filter(c => c.eventCount > 0),
    funnels,
    autoProperties: {
      web: [
        { name: 'accountType', type: 'string', description: 'User account type (Personal/Corporate)', example: 'Personal' },
        { name: 'email', type: 'string', description: 'User email address', example: 'user@example.com' },
        { name: 'logRocketSessionUrl', type: 'string', description: 'LogRocket session replay URL', example: 'https://app.logrocket.com/...' },
        { name: 'brand', type: 'string', description: 'Product brand (xe, jlp, etc.)', example: 'xe' },
        { name: 'flowName', type: 'string', description: 'Current transfer flow context', example: 'Send money flow' },
      ],
      mobile: [
        { name: 'xemt', type: 'boolean', description: 'Is XE Money Transfer user', example: true },
        { name: 'email', type: 'string', description: 'Auth email or anonymous placeholder', example: 'user@example.com' },
      ],
    },
    events,
  };
}

// --- Main ---

console.log('\n=== Xe Event Documentation Generator ===\n');

console.log('Step 1: Parsing event constants...');
const galileo = parseGalileoEvents();
const apollo = parseApolloEvents();

console.log('\nStep 2: Cross-referencing platforms...');
const allEvents = crossReference(galileo.events, apollo.events);

console.log('\nStep 3: Finding code locations...');
findCodeLocations(allEvents, GALILEO_ROOT, APOLLO_ROOT);

console.log('\nStep 4: Extracting properties...');
extractProperties(allEvents, GALILEO_ROOT, APOLLO_ROOT);

console.log('\nStep 5: Categorizing events...');
categorizeEvents(allEvents);

console.log('\nStep 6: Enriching with funnel data...');
const funnels = enrichWithFunnels(allEvents, CONFIG_ROOT);

console.log('\nStep 7: Merging manual annotations...');
mergeAnnotations(allEvents, ANNOTATIONS_PATH);

console.log('\nStep 7b: Merging BE-only events...');
mergeBEEvents(allEvents);

// Re-categorize to include BE events
console.log('\nStep 7c: Re-categorizing with BE events...');
categorizeEvents(allEvents);

console.log('\nStep 8: Building output...');
const output = buildOutput(allEvents, funnels);

// Write output
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
console.log(`\nDone! Written to ${OUTPUT_PATH}`);
console.log(`  Total events: ${output.meta.totalEvents}`);
console.log(`  Cross-platform: ${output.meta.crossPlatform}`);
console.log(`  Web-only: ${output.meta.webOnly}`);
console.log(`  Mobile-only: ${output.meta.mobileOnly}`);
console.log(`  With code locations: ${output.meta.withCodeLocations}`);
console.log(`  With intelligence: ${output.meta.withIntelligence}`);
