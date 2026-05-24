import fs from 'fs';

const lines = fs.readFileSync('services/financeService.ts', 'utf8').split('\n');

const imports = lines.slice(0, 14).join('\n'); // take first 14 lines
const coreBlock = lines.slice(14, 94).join('\n');

const newContent = `${imports}
${coreBlock}
`;

fs.mkdirSync('services/finance', { recursive: true });
fs.writeFileSync('services/finance/core.ts', newContent);

const updatedFinanceService = [
    ...lines.slice(0, 14),
    ...lines.slice(94)
].join('\n');

fs.writeFileSync('services/financeService.ts', updatedFinanceService);
fs.appendFileSync('services/financeService.ts', "\nexport * from './finance/core';\n");

console.log('Split finance core completed!');
