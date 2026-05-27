
import { db } from '../../firebase/config';
import { 
    doc, 
    getDoc, 
    updateDoc, 
    writeBatch 
} from 'firebase/firestore';
import { 
    Enrollment
} from '../../types';
import { calculateRemainingCounters } from './attendance';
import { activateEnrollmentWithLocation } from './activation';
import { getLocations, getAllCourses } from '../courseService';

export const bulkUpdateLocation = async (
    enrollmentIds: string[], 
    fromDate: string, 
    newLocationId: string, 
    newLocationName: string, 
    newLocationColor: string, 
    newStartTime?: string, 
    newEndTime?: string
): Promise<void> => {
    const batch = writeBatch(db);
    const fromDateObj = new Date(fromDate);
    fromDateObj.setHours(0,0,0,0);
    for (const id of enrollmentIds) {
        const docRef = doc(db, 'enrollments', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const enr = snap.data() as Enrollment;
            const appointments = (enr.appointments || []).map(app => {
                const appDate = new Date(app.date);
                if (appDate >= fromDateObj && app.status !== 'Present' && app.status !== 'Absent') {
                    return {
                        ...app,
                        locationId: newLocationId,
                        locationName: newLocationName,
                        locationColor: newLocationColor,
                        startTime: newStartTime || app.startTime,
                        endTime: newEndTime || app.endTime,
                    };
                }
                return app;
            });
            batch.update(docRef, {
                locationId: newLocationId,
                locationName: newLocationName,
                locationColor: newLocationColor,
                appointments: appointments
            });
        }
    }
    await batch.commit();
};

export const fixSingleEnrollment = async (enr: Enrollment): Promise<boolean> => {
    if (!enr.id || !enr.startDate) return false;
    try {
        const locations = await getLocations();
        const loc = locations.find(l => l.id === enr.locationId);
        if (!loc) return false;

        const courses = await getAllCourses();
        const startDay = new Date(enr.startDate).getDay();
        const matchingCourse = courses.find(c => 
            c.locationId === enr.locationId && 
            c.dayOfWeek === startDay
        );

        if (!matchingCourse) {
            // Fallback: just fix counters/dates based on existing apps
            const ref = doc(db, 'enrollments', enr.id);
            const appointments = [...(enr.appointments || [])];
            appointments.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const counters = calculateRemainingCounters(enr, appointments);
            let startDate = enr.startDate;
            let endDate = enr.endDate;
            if (appointments.length > 0) {
                startDate = appointments[0].date;
                endDate = appointments[appointments.length - 1].date;
            }
            await updateDoc(ref, {
                appointments,
                ...counters,
                startDate,
                endDate
            });
            return true;
        }

        await activateEnrollmentWithLocation(
            enr.id,
            loc.supplierId,
            enr.supplierName || '',
            enr.locationId,
            enr.locationName,
            enr.locationColor,
            new Date(enr.startDate).getDay(),
            matchingCourse.startTime,
            matchingCourse.endTime
        );
        return true;
    } catch (e) {
        console.error("Single fix error:", e);
        return false;
    }
};
