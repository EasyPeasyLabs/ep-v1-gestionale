export interface Note {
    id: string;
    date: string;
    content: string;
}

export interface CommunicationTemplate {
    id: string;
    label: string;
    subject: string;
    body: string;
    signature: string;
}

export interface ContractTemplate {
    id: string;
    title: string;
    category: string;
    content: string;
}

export interface SchoolClosure {
    id: string;
    date: string;
    reason: string;
    createdAt: string;
}

export type Page = 'Dashboard' | 'Clients' | 'Suppliers' | 'Finance' | 'Settings' | 'NotificationPlanning' | 'Profile' | 'Calendar' | 'CRM' | 'Enrollments' | 'EnrollmentArchive' | 'Attendance' | 'AttendanceArchive' | 'Activities' | 'ActivityLog' | 'Homeworks' | 'Initiatives' | 'Manual' | 'ClientSituation' | 'Leads' | 'Courses';
