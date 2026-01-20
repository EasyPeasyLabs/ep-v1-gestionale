
import * as XLSX from 'xlsx';
import { Transaction, Invoice, Enrollment, Client, ClientType, ParentClient, InstitutionalClient } from '../types';

export const exportTransactionsToExcel = (transactions: Transaction[], invoices: Invoice[]) => {
    const dataToExport = transactions.filter(t => !t.isDeleted).map(t => {
        // Logica sicura per recuperare il numero fattura
        // Transaction non ha 'invoiceNumber', lo cerchiamo nelle fatture collegate
        const relatedInvoice = t.relatedDocumentId ? invoices.find(i => i.id === t.relatedDocumentId) : null;
        
        return {
            ID: t.id,
            Data: new Date(t.date).toLocaleDateString('it-IT'),
            Tipo: t.type === 'income' ? 'Entrata' : 'Uscita',
            Categoria: t.category,
            Descrizione: t.description,
            Importo: t.amount,
            Metodo: t.paymentMethod,
            Stato: t.status,
            'Cliente/Soggetto': t.clientName || '',
            'N. Fattura': relatedInvoice ? relatedInvoice.invoiceNumber : '', // Fix TS error
            'Sede': t.allocationName || ''
        };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transazioni");
    XLSX.writeFile(wb, `Transazioni_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportInvoicesToExcel = (invoices: Invoice[]) => {
    const data = invoices.filter(i => !i.isDeleted && !i.isGhost).map(i => ({
        Numero: i.invoiceNumber,
        Data: new Date(i.issueDate).toLocaleDateString(),
        Cliente: i.clientName,
        Totale: i.totalAmount,
        Stato: i.status,
        SDI: i.sdiId || i.sdiCode || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fatture");
    XLSX.writeFile(wb, `Fatture_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportEnrollmentsToExcel = (enrollments: Enrollment[], clients: Client[]) => {
    // Deprecated simple export, kept for compatibility if needed elsewhere
    const data = enrollments.map(e => {
        const client = clients.find(c => c.id === e.clientId);
        let parentName = '';
        if (client) {
            if (client.clientType === ClientType.Parent) {
                const p = client as ParentClient;
                parentName = `${p.firstName} ${p.lastName}`;
            } else {
                parentName = (client as InstitutionalClient).companyName || '';
            }
        }

        return {
            'Stato': e.status === 'Pending' ? 'In Attesa' : e.status === 'Active' ? 'Attivo' : e.status === 'Completed' ? 'Completato' : 'Scaduto',
            'Allievo': e.childName,
            'Genitore/Cliente': parentName,
            'Pacchetto': e.subscriptionName,
            'Prezzo': e.price,
            'Sede': e.locationName,
            'Fornitore': e.supplierName,
            'Data Inizio': new Date(e.startDate).toLocaleDateString('it-IT'),
            'Data Fine': new Date(e.endDate).toLocaleDateString('it-IT'),
            'Lezioni Totali': e.lessonsTotal,
            'Lezioni Rimanenti': e.lessonsRemaining
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Iscrizioni");
    XLSX.writeFile(wb, `Iscrizioni_Storico_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// --- NEW ADVANCED EXPORT ---
export interface AdvancedEnrollmentExportData {
    studentName: string;
    parentName: string;
    locationNames: string; // Colonna Sede / Recinto
    startDate: string;
    endDate: string;
    price: number;
    totalSlots: number;
    presentCount: number;
    absentCount: number;
    paidAmount: number;
    paymentRefs: string; // Stringa concatenata
}

export const exportAdvancedEnrollmentReport = (data: AdvancedEnrollmentExportData[]) => {
    // 1. Ordinamento: Cronologico Crescente -> Alfabetico Cognome (approssimato sul nome genitore)
    data.sort((a, b) => {
        const dateA = new Date(a.startDate).getTime();
        const dateB = new Date(b.startDate).getTime();
        
        if (dateA !== dateB) {
            return dateA - dateB; // Cronologico Crescente
        }
        return a.parentName.localeCompare(b.parentName); // Alfabetico A-Z
    });

    // 2. Mappatura colonne Excel
    const rows = data.map(item => ({
        "Allievo": item.studentName,
        "Tutore / Ente": item.parentName,
        "Sede / Recinto": item.locationNames, // Inserito secondo richiesta
        "Data Inizio": new Date(item.startDate).toLocaleDateString('it-IT'),
        "Data Fine": new Date(item.endDate).toLocaleDateString('it-IT'),
        "Prezzo Totale": item.price,
        "Slot Totali": item.totalSlots,
        "Presenze / Assenze": `${item.presentCount} / ${item.absentCount}`,
        "Incassato / Ric.": item.paidAmount,
        "Rif. Pagamenti": item.paymentRefs
    }));

    // 3. Creazione Foglio
    const ws = XLSX.utils.json_to_sheet(rows);

    // Impostazioni larghezza colonne (approssimative)
    ws['!cols'] = [
        { wch: 20 }, // Allievo
        { wch: 25 }, // Tutore
        { wch: 25 }, // Sede / Recinto (più larga per gestire lo storico cambi)
        { wch: 12 }, // Inizio
        { wch: 12 }, // Fine
        { wch: 10 }, // Prezzo
        { wch: 10 }, // Slot
        { wch: 15 }, // Pres/Ass
        { wch: 12 }, // Incassato
        { wch: 40 }, // Rif
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report Iscrizioni");

    // Salvataggio
    XLSX.writeFile(wb, `Report_Iscrizioni_Avanzato_${new Date().toISOString().split('T')[0]}.xlsx`);
};
