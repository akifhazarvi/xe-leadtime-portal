const fs = require('fs');
const path = require('path');
const dn = new Intl.DisplayNames(['en'], { type: 'region' });
const req = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'portal/data/recipient-requirements.json'), 'utf8'));
const codes = new Set(Object.values(req.corridors).map(c => c.country));
const names = {};
for (const c of [...codes].sort()) { try { names[c] = dn.of(c) || c; } catch { names[c] = c; } }
fs.writeFileSync(path.join(__dirname, '..', 'portal/data/country-names.json'), JSON.stringify(names, null, 2));
console.log(`wrote ${Object.keys(names).length} country names`);
