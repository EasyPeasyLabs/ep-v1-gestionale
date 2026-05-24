import fs from 'fs';

const lines = fs.readFileSync('services/enrollmentService.ts', 'utf8').split('\n');

const imports = lines.slice(0, 12).join('\n'); // take first 12 lines
const coreBlock = lines.slice(105, 503).join('\n');

const newContent = `${imports}
${coreBlock}
`;

fs.writeFileSync('services/enrollment/core.ts', newContent);

const updatedEnrollmentService = [
    ...lines.slice(0, 105),
    ...lines.slice(503)
].join('\n');

fs.writeFileSync('services/enrollmentService.ts', updatedEnrollmentService);
fs.appendFileSync('services/enrollmentService.ts', "\nexport * from './enrollment/core';\n");

console.log('Split core completed!');
