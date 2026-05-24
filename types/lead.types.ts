export interface Lead {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  childName: string;
  childAge: string;
  selectedLocation: string;
  selectedSubscription?: string;
  selectedSlot: unknown;
  address?: string;
  notes?: string;
  status: 'pending' | 'contacted' | 'converted' | 'rejected';
  createdAt: string;
  source: string;
  convertedAt?: string;
  convertedEnrollmentId?: string;
  convertedStudentId?: string;
}
