import fs from 'fs';

const aCode = fs.readFileSync('services/enrollment/attendance.ts', 'utf8').split('\n').filter(l => !l.startsWith('import '));
const bCode = fs.readFileSync('services/enrollment/bookingModule.ts', 'utf8').split('\n').filter(l => !l.startsWith('import '));
const cCode = fs.readFileSync('services/enrollment/core.ts', 'utf8').split('\n').filter(l => !l.startsWith('import '));

const eService = fs.readFileSync('services/enrollmentService.ts', 'utf8').split('\n');

const imports = [
    "import { db } from '../firebase/config';",
    "import { collection, getDocs, getDocsFromServer, addDoc, where, query, DocumentData, QueryDocumentSnapshot, doc, updateDoc, getDoc, getDocFromServer, writeBatch, arrayUnion } from 'firebase/firestore';",
    "import { Enrollment, EnrollmentInput, Appointment, AppointmentStatus, EnrollmentStatus, Quote, ClientType, Lesson, DocumentStatus, LessonInput, SchoolClosure, LessonAttendee, Course, SubscriptionType } from '../types';",
    "import { isItalianHoliday } from '../utils/dateUtils';",
    "import { getSchoolClosures } from './calendarService';",
    "import { getLocations, getAllCourses } from './courseService';",
    "import { getSuppliers } from './supplierService';"
];

const mainCode = eService.slice(13).filter(l => !l.startsWith('export * from'));

const combined = [
    ...imports,
    ...bCode,
    ...cCode,
    ...aCode,
    ...mainCode
].join('\n');

fs.writeFileSync('services/enrollmentService.ts', combined);
console.log('Restored');
