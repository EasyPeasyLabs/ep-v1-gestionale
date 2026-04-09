import * as XLSX from 'xlsx';
import { AdvancedEnrollmentExportData, ClientType, ParentClient, InstitutionalClient } from '../types';

export const exportAdvancedEnrollmentReport = (data: AdvancedEnrollmentExportData[]) => {
    const wsData = data.map(item => {
        let clientName = 'Sconosciuto';
        if (item.client) {
            clientName = item.client.clientType === ClientType.Parent 
                ? `${(item.client as ParentClient).firstName} ${(item.client as ParentClient).lastName}`
                : (item.client as InstitutionalClient).companyName;
        }

        return {
            'ID Iscrizione': item.enrollment.id,
            'Cliente': clientName,
            'Fornitore': item.supplier ? item.supplier.companyName : 'Nessuno',
            'Inizio': item.enrollment.startDate,
            'Fine': item.enrollment.endDate,
            'Prezzo': item.enrollment.price,
            'Stato': item.enrollment.status,
            'Fatture': item.invoices.map((i: any) => i.invoiceNumber).join(', '),
            'Transazioni': item.transactions.map((t: any) => t.id).join(', ')
        };
    });

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Iscrizioni");
    XLSX.writeFile(wb, "Archivio_Iscrizioni.xlsx");
};
