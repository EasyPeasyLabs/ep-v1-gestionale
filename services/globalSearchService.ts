
import { getClients } from './parentService';
import { getAllEnrollments } from './enrollmentService';
import { getInvoices, getQuotes } from './financeService';
import { Client, Enrollment, Invoice, Quote, ClientType, ParentClient, InstitutionalClient } from '../types';

export interface GlobalSearchResults {
    clients: Client[];
    enrollments: Enrollment[];
    invoices: Invoice[];
    quotes: Quote[];
    attendance: { 
        lessonId: string; 
        date: string; 
        childName: string; 
        startTime: string; 
        locationName: string; 
    }[];
    clientSituations: Client[];
}

export const searchGlobal = async (term: string): Promise<GlobalSearchResults> => {
    if (!term || term.trim().length < 2) {
        return { clients: [], enrollments: [], invoices: [], quotes: [], attendance: [], clientSituations: [] };
    }

    const lowerTerm = term.toLowerCase().trim();

    try {
        const [allClients, allEnrollments, allInvoices, allQuotes] = await Promise.all([
            getClients(),
            getAllEnrollments(),
            getInvoices(),
            getQuotes()
        ]);

        // 1. Filtra Clienti (Anagrafica)
        const clients = allClients.filter(c => {
            if (c.clientType === ClientType.Parent) {
                const p = c as ParentClient;
                const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
                const reverseName = `${p.lastName || ''} ${p.firstName || ''}`.toLowerCase();
                return fullName.includes(lowerTerm) ||
                       reverseName.includes(lowerTerm) ||
                       (p.email || '').toLowerCase().includes(lowerTerm) ||
                       p.children.some(child => child.name.toLowerCase().includes(lowerTerm));
            } else {
                const i = c as InstitutionalClient;
                return (i.companyName || '').toLowerCase().includes(lowerTerm) ||
                       (i.email || '').toLowerCase().includes(lowerTerm);
            }
        }).slice(0, 5);

        // 2. Filtra Iscrizioni (Search extended to Location & Status)
        const enrollments = allEnrollments.filter(e =>
            (e.childName || '').toLowerCase().includes(lowerTerm) ||
            (e.subscriptionName || '').toLowerCase().includes(lowerTerm) ||
            (e.locationName || '').toLowerCase().includes(lowerTerm)
        ).slice(0, 5);

        // 3. Filtra Fatture
        const invoices = allInvoices.filter(i =>
            !i.isDeleted &&
            ((i.invoiceNumber || '').toLowerCase().includes(lowerTerm) ||
             (i.clientName || '').toLowerCase().includes(lowerTerm) ||
             String(i.totalAmount).includes(lowerTerm))
        ).slice(0, 5);

        // 4. Filtra Preventivi
        const quotes = allQuotes.filter(q =>
            !q.isDeleted &&
            ((q.quoteNumber || '').toLowerCase().includes(lowerTerm) ||
             (q.clientName || '').toLowerCase().includes(lowerTerm))
        ).slice(0, 5);

        // 5. Filtra Presenze (Lezioni/Appuntamenti)
        const attendanceMatches: any[] = [];
        // Ottimizzazione: Cerca solo se il termine non è numerico puro (evita match su ID o prezzi) o se sembra una data
        if (isNaN(Number(lowerTerm)) || lowerTerm.includes('/') || lowerTerm.includes('-')) {
            for (const enr of allEnrollments) {
                if (enr.appointments && enr.appointments.length > 0) {
                    for (const app of enr.appointments) {
                        const dateStr = new Date(app.date).toLocaleDateString('it-IT');
                        const timeStr = app.startTime;
                        // Match su Nome Bambino, Data (es. 12/05) o Orario
                        if (
                            app.childName.toLowerCase().includes(lowerTerm) || 
                            dateStr.includes(lowerTerm) ||
                            timeStr.includes(lowerTerm)
                        ) {
                            attendanceMatches.push({
                                lessonId: app.lessonId,
                                date: app.date,
                                childName: app.childName,
                                startTime: app.startTime,
                                locationName: app.locationName
                            });
                        }
                        if (attendanceMatches.length >= 5) break; 
                    }
                }
                if (attendanceMatches.length >= 5) break;
            }
        }

        // 6. Situazione Clienti (Stessi match dei clienti, ma con intenzione diversa)
        // Usiamo la stessa lista filtrata dei clienti
        const clientSituations = [...clients];

        return { clients, enrollments, invoices, quotes, attendance: attendanceMatches, clientSituations };

    } catch (error) {
        console.error("Global search error:", error);
        return { clients: [], enrollments: [], invoices: [], quotes: [], attendance: [], clientSituations: [] };
    }
};
