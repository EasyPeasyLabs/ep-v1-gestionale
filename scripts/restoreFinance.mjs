import fs from 'fs';

let text = fs.readFileSync('services/financeService.ts', 'utf8').split('\n');
text.splice(14, 1); // remove the import { ... } from './finance/core';
text.splice(-1, 1); // remove export * from ...
text.splice(-1, 1);

let coreText = fs.readFileSync('services/finance/core.ts', 'utf8').split('\n');
coreText = coreText.slice(7); // remove imports

text.splice(14, 0, ...coreText);

fs.writeFileSync('services/financeService.ts', text.join('\n'));
console.log('Restored finance');
