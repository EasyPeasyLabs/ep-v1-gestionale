import fs from 'fs';

const lines = fs.readFileSync('services/enrollmentService.ts', 'utf8').split('\n');

const imports = lines.slice(0, 12).join('\n'); // take first 12 lines
const bookingBlock = lines.slice(12, 100).join('\n');

const newContent = `${imports}
${bookingBlock}
`;

fs.writeFileSync('services/enrollment/bookingModule.ts', newContent);

const updatedEnrollmentService = [
    ...lines.slice(0, 12),
    ...lines.slice(100)
].join('\n');

fs.writeFileSync('services/enrollmentService.ts', updatedEnrollmentService);
fs.appendFileSync('services/enrollmentService.ts', "\nexport * from './enrollment/bookingModule';\n");

console.log('Split booking completed!');
