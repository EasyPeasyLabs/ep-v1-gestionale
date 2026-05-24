
// enrollmentService.ts - Facade per i moduli specializzati
import * as Core from './enrollment/core';
import * as Booking from './enrollment/bookingModule';
import * as Attendance from './enrollment/attendance';
import * as Helpers from './enrollment/helpers';
import * as Sync from './enrollment/sync';
import * as Migration from './enrollment/migration';
import * as Activation from './enrollment/activation';
import * as Maintenance from './enrollment/maintenance';
import * as Closures from './enrollment/closures';

// --- CORE & GETTERS ---
export const getEnrollmentsForClient = Core.getEnrollmentsForClient;
export const getAllEnrollments = Core.getAllEnrollments;
export const addEnrollment = Core.addEnrollment;
export const getActiveLocationForClient = Core.getActiveLocationForClient;
export const getSchoolClosures = Core.getSchoolClosures;

// --- ACTIVATION & LIFECYCLE ---
export const createInstitutionalEnrollment = Activation.createInstitutionalEnrollment;
export const activateEnrollmentWithLocation = Activation.activateEnrollmentWithLocation;
export const updateEnrollment = Activation.updateEnrollment;
export const deleteEnrollment = Activation.deleteEnrollment;

// --- BOOKING ENGINE ---
export const bookStudentIntoCourseLessons = Booking.bookStudentIntoCourseLessons;

// --- ATTENDANCE MANAGEMENT ---
export const registerAbsence = Attendance.registerAbsence;
export const registerPresence = Attendance.registerPresence;
export const resetAppointmentStatus = Attendance.resetAppointmentStatus;
export const deleteAppointment = Attendance.deleteAppointment;
export const toggleAppointmentStatus = Attendance.toggleAppointmentStatus;
export const addRecoveryLessons = Attendance.addRecoveryLessons;

// --- HELPERS ---
export const generateTheoreticalAppointments = Helpers.generateTheoreticalAppointments;

// --- SYNC ENGINE ---
export const syncEnrollmentFromLessonUpdate = Sync.syncEnrollmentFromLessonUpdate;
export const syncEnrollmentFromLessonDeletion = Sync.syncEnrollmentFromLessonDeletion;
export const resyncInstitutionalEnrollment = Sync.resyncInstitutionalEnrollment;

// --- MIGRATION & MAINTENANCE ---
export const recuperoIntegraleDati = Migration.recuperoIntegraleDati;
export const bonificaAppointments = Migration.bonificaAppointments;
export const migrateHistoricalEnrollments = Migration.migrateHistoricalEnrollments;
export const autoFixEnrollments = Migration.autoFixEnrollments;
export const bulkUpdateLocation = Maintenance.bulkUpdateLocation;
export const fixSingleEnrollment = Maintenance.fixSingleEnrollment;

// --- SCHOOL CLOSURE HANDLERS ---
export const suspendLessonsForClosure = Closures.suspendLessonsForClosure;
export const restoreSuspendedLessons = Closures.restoreSuspendedLessons;
export const rescheduleSuspendedLesson = Closures.rescheduleSuspendedLesson;
