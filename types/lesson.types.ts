import { AppointmentStatus } from './attendance.types';
import { SlotType } from './course.types';

export interface LessonAttendee {
    clientId: string;
    childId: string;
    childName: string;
    enrollmentId?: string;
    status?: AppointmentStatus | string;
    recoveryId?: string;
}

export interface Lesson {
    id: string;
    courseId?: string;
    date: string;
    startTime: string;
    endTime: string;
    locationName: string;
    locationId?: string;
    locationColor: string;
    description: string;
    childName?: string; // Legacy
    clientId?: string; // Legacy
    attendees?: LessonAttendee[];
    slotType?: SlotType;
    maxCapacity?: number;
}

export type LessonInput = Omit<Lesson, 'id'>;
