import fs from 'fs';

const origService = fs.readFileSync('services/enrollmentService.ts', 'utf8').split('\n');

const imports = [
    "import { db } from '../firebase/config';",
    "import { collection, getDocs, getDocsFromServer, addDoc, where, query, DocumentData, QueryDocumentSnapshot, doc, updateDoc, getDoc, getDocFromServer, writeBatch, arrayUnion } from 'firebase/firestore';",
    "import { Enrollment, EnrollmentInput, Appointment, AppointmentStatus, EnrollmentStatus, Quote, ClientType, Lesson, DocumentStatus, LessonInput, SchoolClosure, LessonAttendee, Course, SubscriptionType } from '../types';",
    "import { isItalianHoliday } from '../utils/dateUtils';",
    "import { getSchoolClosures } from './calendarService';",
    "import { getLocations, getAllCourses } from './courseService';",
    "import { getSuppliers } from './supplierService';"
];

const bCode = fs.readFileSync('services/enrollment/bookingModule.ts', 'utf8').split('\n').filter(l => !l.includes('import '));
const cCode = fs.readFileSync('services/enrollment/core.ts', 'utf8').split('\n').filter(l => !l.includes('import '));
const aCode = fs.readFileSync('services/enrollment/attendance.ts', 'utf8').split('\n').filter(l => !l.includes('import '));
const eCode = origService.slice(12, -7).filter(l => !l.includes('import ') || l.includes('import '));

const content = [
    ...imports,
    "const getEnrollmentCollectionRef = () => collection(db, 'enrollments');",
    "const docToEnrollment = (doc: QueryDocumentSnapshot<DocumentData>): Enrollment => { return { id: doc.id, ...doc.data() } as Enrollment; };",
    "export const generateTheoreticalAppointments = " + cCode.join('\n').split('export const generateTheoreticalAppointments =')[1] + " // Wait this is too hacky."
].join('\n');


