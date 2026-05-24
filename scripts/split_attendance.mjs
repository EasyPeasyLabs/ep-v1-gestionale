import fs from 'fs';

const lines = fs.readFileSync('services/enrollmentService.ts', 'utf8').split('\n');

const imports = lines.slice(0, 12).join('\n'); // take first 12 lines
const attendanceBlock = lines.slice(1031, 1562).join('\n');

const newContent = `${imports}
${attendanceBlock}
`;

fs.mkdirSync('services/enrollment', { recursive: true });
fs.writeFileSync('services/enrollment/attendance.ts', newContent);

const updatedEnrollmentService = [
    ...lines.slice(0, 1031),
    ...lines.slice(1562)
].join('\n');

fs.writeFileSync('services/enrollmentService.ts', updatedEnrollmentService);
fs.appendFileSync('services/enrollmentService.ts', "\nexport * from './enrollment/attendance';\n");

console.log('Split completed!');
