import fs from 'fs';

// Restore Finance
const fCore = fs.readFileSync('services/finance/core.ts', 'utf8').split('\n');
const fService = fs.readFileSync('services/financeService.ts', 'utf8').split('\n');

const cleanedFCore = fCore.slice(14, -1); // remove imports
const fImports = fService.slice(0, 11).filter(l => !l.includes('./finance/core'));
const fRest = fService.slice(14, -3); // remove imports and final export

const restoredFinance = [...fImports, ...cleanedFCore, ...fRest].join('\n');
fs.writeFileSync('services/financeService.ts', restoredFinance);

// Restore Enrollment
const eBooking = fs.readFileSync('services/enrollment/bookingModule.ts', 'utf8').split('\n');
const eCore = fs.readFileSync('services/enrollment/core.ts', 'utf8').split('\n');
const eAttendance = fs.readFileSync('services/enrollment/attendance.ts', 'utf8').split('\n');
const eService = fs.readFileSync('services/enrollmentService.ts', 'utf8').split('\n');

const cleanedBooking = eBooking.slice(5); 
const cleanedCore = eCore.slice(7); 
const cleanedAttendance = eAttendance.slice(7); 
const eImports = eService.slice(0, 11).filter(l => !l.includes('./enrollment/'));
const eRest = eService.slice(12, -7);

const restoredEnrollment = [
    ...eImports,
    "const getEnrollmentCollectionRef = () => collection(db, 'enrollments');",
    "const docToEnrollment = (doc: QueryDocumentSnapshot<DocumentData>): Enrollment => {",
    "    return { id: doc.id, ...doc.data() } as Enrollment;",
    "};",
    ...cleanedBooking,
    ...cleanedCore,
    ...cleanedAttendance,
    ...eRest
].join('\n');
fs.writeFileSync('services/enrollmentService.ts', restoredEnrollment);
console.log('Restoration completed!');
