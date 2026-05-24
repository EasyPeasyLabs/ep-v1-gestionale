export enum AppointmentStatus {
    Scheduled = 'Scheduled',
    Present = 'Present',
    Absent = 'Absent',
    Suspended = 'Suspended'
}

export interface Appointment {
    lessonId: string;
    date: string;
    startTime: string;
    endTime: string;
    locationId: string;
    locationName: string;
    locationColor: string;
    childName: string;
    status: AppointmentStatus | string;
    type?: string;
    recoveryId?: string; 
    recoveredLessonId?: string; 
}
