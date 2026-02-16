
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Client, ClientType, ParentClient, InstitutionalClient, Enrollment, Transaction, Invoice, Supplier, EnrollmentStatus, TransactionType, CompanyInfo } from '../types';
import { getClients } from '../services/parentService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getTransactions, getInvoices } from '../services/financeService';
import { getSuppliers } from '../services/supplierService';
import { getCompanyInfo } from '../services/settingsService';
import Spinner from '../components/Spinner';
import SearchIcon from '../components/icons/SearchIcon';
import IdentificationIcon from '../components/icons/IdentificationIcon';
import DownloadIcon from '../components/icons/DownloadIcon';
import PrinterIcon from '../components/icons/PrinterIcon';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 

// Defensive Helper
const getClientName = (c?: Client | null): string => {
    if (!c) return 'Cliente Sconosciuto';
    if (c.clientType === ClientType.Parent) {
        const p = c as ParentClient;
        return `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Senza Nome';
    } else {
        const i = c as InstitutionalClient;
        return i.companyName || 'Ente Senza Nome';
    }
};

const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

interface ClientSituationProps {
    initialParams?: {
        clientId?: string;
    };
}

const ClientSituation: React.FC<ClientSituationProps> = ({ initialParams }) => {
    const [loading, setLoading] = useState(true);
    const [generatingReport, setGeneratingReport] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterBalanceStatus, setFilterBalanceStatus] = useState<'all' | 'balanced' | 'debt' | 'surplus'>('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    
    // Selected Context
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [cData, eData, tData, iData, sData, infoData] = await Promise.all([
                getClients(),
                getAllEnrollments(),
                getTransactions(),
                getInvoices(),
                getSuppliers(),
                getCompanyInfo()
            ]);
            setClients(cData || []);
            setEnrollments(eData || []);
            setTransactions(tData || []);
            setInvoices(iData || []);
            setSuppliers(sData || []);
            setCompanyInfo(infoData);
        } catch (e) {
            console.error("ClientSituation Error:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Handle deep linking via initialParams
    useEffect(() => {
        if (initialParams?.clientId && clients.length > 0) {
            const found = clients.find(c => c.id === initialParams.clientId);
            if (found) {
                setSelectedClient(found);
            }
        }
    }, [initialParams, clients]);

    // Computed Data
    const availableLocations = useMemo(() => {
        const locs = new Set<string>();
        suppliers.forEach(s => s.locations?.forEach(l => locs.add(l.name)));
        enrollments.forEach(e => {
            if (e.locationName && e.locationName !== 'Sede Non Definita') locs.add(e.locationName);
        });
        return Array.from(locs).sort();
    }, [suppliers, enrollments]);

    const availableYears = useMemo(() => {
        const years = new Set<number>();
        const current = new Date().getFullYear();
        years.add(current);
        enrollments.forEach(e => years.add(new Date(e.startDate).getFullYear()));
        transactions.forEach(t => years.add(new Date(t.date).getFullYear()));
        return Array.from(years).sort((a,b) => b - a);
    }, [enrollments, transactions]);

    const isDateInPeriod = (dateStr: string, y?: string, m?: string) => {
        if (!dateStr) return false;
        if (!y) return true; // No year filter = all history
        const d = new Date(dateStr);
        if (d.getFullYear() !== parseInt(y)) return false;
        if (m && (d.getMonth() + 1) !== parseInt(m)) return false;
        return true;
    };

    // --- AGGREGATION HELPER FOR BULK EXPORT & FILTERING ---
    const getClientFinancialSummary = (client: Client, locFilter?: string, year?: string, month?: string) => {
        // 1. Filter Enrollments based on Location Filter (if active)
        let clientEnrs = enrollments.filter(e => e.clientId === client.id);
        
        if (locFilter) {
            clientEnrs = clientEnrs.filter(e => e.locationName === locFilter);
        }
        
        let totalDue = 0;
        let totalPaid = 0;
        let aggPresences = 0;
        let aggAbsences = 0;
        let aggRecoveries = 0;

        const activeSubscriptions: string[] = [];
        const locations = new Set<string>();

        // 2. Process Filtered Enrollments (DUE & LINKED PAID & ATTENDANCE)
        clientEnrs.forEach(enr => {
            // "Due" Logic: Sum price ONLY if enrollment starts in selected period (Accrual / Competenza)
            const dueInPeriod = isDateInPeriod(enr.startDate, year, month);
            
            if (dueInPeriod) {
                if (enr.status === EnrollmentStatus.Active) {
                    activeSubscriptions.push(enr.subscriptionName);
                    if (enr.locationName && enr.locationName !== 'Sede Non Definita') locations.add(enr.locationName);
                }
                totalDue += (Number(enr.price) || 0);
                // Adjustment follows enrollment period
                totalPaid += Number(enr.adjustmentAmount || 0);
            }
            
            // "Paid" Logic: Sum transactions ONLY if date in selected period (Cash Flow / Cassa)
            const linkedTrans = transactions.filter(t => t.relatedEnrollmentId === enr.id && !t.isDeleted);
            linkedTrans.forEach(t => {
                if (isDateInPeriod(t.date, year, month)) {
                    totalPaid += Number(t.amount);
                }
            });

            // Attendance Logic: Sum based on enrollment filter (simplified, attendance follows enrollment usually)
            // If we have strict date filter for attendance, we should check appointment dates.
            if (enr.appointments) {
                enr.appointments.forEach(app => {
                    // Check if appointment is in filtered period (if filters active)
                    // If no filters (year/month), count everything.
                    if (isDateInPeriod(app.date, year, month)) {
                        if (app.status === 'Present') aggPresences++;
                        else if (app.status === 'Absent') aggAbsences++;
                        if (app.lessonId && app.lessonId.startsWith('REC-')) aggRecoveries++;
                    }
                });
            }
        });

        // 3. Process Orphans (UNLINKED PAID)
        const clientNameStr = getClientName(client);
        const orphanTrans = transactions.filter(t => 
            t.clientName === clientNameStr && 
            !t.relatedEnrollmentId && 
            !t.isDeleted &&
            (!locFilter || t.allocationName === locFilter)
        );

        orphanTrans.forEach(t => {
            if (isDateInPeriod(t.date, year, month)) {
                totalPaid += Number(t.amount);
            }
        });

        const balance = totalDue - totalPaid;

        return {
            name: getClientName(client),
            type: client.clientType === ClientType.Parent ? 'Genitore' : 'Ente',
            email: client.email,
            phone: client.phone,
            locations: Array.from(locations).join(', '),
            subscriptions: activeSubscriptions.join(', '),
            totalDue,
            totalPaid,
            balance,
            aggPresences,
            aggAbsences,
            aggRecoveries
        };
    };

    // Calculate counts for the filter buttons
    const statusCounts = useMemo(() => {
        let countBalanced = 0;
        let countDebt = 0;
        let countSurplus = 0;

        // Iterate all clients to apply base filters (Search + Location) WITHOUT Balance Status
        clients.forEach(c => {
            const name = getClientName(c).toLowerCase();
            const term = (searchTerm || '').toLowerCase();
            let match = name.includes(term);
            
            // Search in children
            if (!match && c.clientType === ClientType.Parent) {
                const children = (c as ParentClient).children || [];
                match = children.some(child => (child.name || '').toLowerCase().includes(term));
            }

            // Location Filter (Indirect)
            if (match && filterLocation) {
                const hasLoc = enrollments.some(e => e.clientId === c.id && e.locationName === filterLocation);
                if (!hasLoc) match = false;
            }

            if (match) {
                // Calculate financial status
                const summary = getClientFinancialSummary(c, filterLocation, filterYear, filterMonth);
                
                if (Math.abs(summary.balance) < 0.01) {
                    countBalanced++;
                } else if (summary.balance > 0.01) {
                    countDebt++;
                } else {
                    countSurplus++;
                }
            }
        });

        return { countBalanced, countDebt, countSurplus };
    }, [clients, searchTerm, filterLocation, enrollments, transactions, filterYear, filterMonth]);

    const filteredClients = useMemo(() => {
        return clients.filter(c => {
            const name = getClientName(c).toLowerCase();
            const term = (searchTerm || '').toLowerCase();
            let match = name.includes(term);
            
            // Search in children
            if (!match && c.clientType === ClientType.Parent) {
                const children = (c as ParentClient).children || [];
                match = children.some(child => (child.name || '').toLowerCase().includes(term));
            }

            // Location Filter (Indirect)
            if (match && filterLocation) {
                const hasLoc = enrollments.some(e => e.clientId === c.id && e.locationName === filterLocation);
                if (!hasLoc) match = false;
            }

            // Balance Status Filter
            if (match && filterBalanceStatus !== 'all') {
                const summary = getClientFinancialSummary(c, filterLocation, filterYear, filterMonth);
                if (filterBalanceStatus === 'balanced') {
                    if (Math.abs(summary.balance) >= 0.01) match = false;
                } else if (filterBalanceStatus === 'debt') {
                    if (summary.balance <= 0.01) match = false;
                } else if (filterBalanceStatus === 'surplus') {
                    if (summary.balance >= -0.01) match = false;
                }
            }

            return match;
        }).sort((a,b) => {
            const nA = getClientName(a);
            const nB = getClientName(b);
            return sortOrder === 'asc' ? nA.localeCompare(nB) : nB.localeCompare(nA);
        });
    }, [clients, searchTerm, filterLocation, sortOrder, enrollments, transactions, filterYear, filterMonth, filterBalanceStatus]);

    // Derived Data for Selected Client (Visual Detail View)
    const clientFinancials = useMemo(() => {
        if (!selectedClient) return null;
        
        let clientEnrollments = enrollments
            .filter(e => e.clientId === selectedClient.id)
            .sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        
        // Group by Enrollment ID for structured view
        const rows = clientEnrollments.map(enr => {
            const linkedInvoices = invoices.filter(i => 
                i.relatedEnrollmentId === enr.id && 
                !i.isDeleted &&
                isDateInPeriod(i.issueDate, filterYear, filterMonth)
            );
            const linkedTrans = transactions.filter(t => 
                t.relatedEnrollmentId === enr.id && 
                !t.isDeleted &&
                isDateInPeriod(t.date, filterYear, filterMonth)
            );

            // Calculate Attendance Stats for this enrollment
            let presences = 0;
            let absences = 0;
            let recoveries = 0;

            if (enr.appointments) {
                enr.appointments.forEach(app => {
                    if (app.status === 'Present') presences++;
                    else if (app.status === 'Absent') absences++;
                    
                    if (app.lessonId && app.lessonId.startsWith('REC-')) {
                        recoveries++;
                    }
                });
            }
            
            return {
                enrollment: enr,
                invoices: linkedInvoices,
                transactions: linkedTrans,
                stats: { presences, absences, recoveries }
            };
        });

        // Filter Rows for Visuals: Show if Enrollment in Period OR has Activity in Period
        const visibleRows = rows.filter(row => {
            const enrInPeriod = isDateInPeriod(row.enrollment.startDate, filterYear, filterMonth);
            const hasActivity = row.transactions.length > 0 || row.invoices.length > 0;
            return enrInPeriod || hasActivity;
        });

        // Orphans (General Payments/Invoices not linked)
        const orphanInvoices = invoices.filter(i => 
            i.clientId === selectedClient.id && 
            !i.relatedEnrollmentId && 
            !i.isDeleted &&
            isDateInPeriod(i.issueDate, filterYear, filterMonth)
        );
        const clientNameStr = getClientName(selectedClient);
        const orphanTrans = transactions.filter(t => 
            t.clientName === clientNameStr && 
            !t.relatedEnrollmentId && 
            !t.isDeleted &&
            isDateInPeriod(t.date, filterYear, filterMonth)
        ); 

        return { rows: visibleRows, orphanInvoices, orphanTrans };
    }, [selectedClient, enrollments, invoices, transactions, filterYear, filterMonth]);

    const handleSelectClient = (c: Client) => {
        setSelectedClient(c);
    };

    // Calculate Grand Totals for UI (Visible List)
    const grandTotals = useMemo(() => {
        let grandDue = 0;
        let grandPaid = 0;
        let grandGap = 0;
        let grandSurplus = 0;

        filteredClients.forEach(c => {
            const data = getClientFinancialSummary(c, filterLocation, filterYear, filterMonth);
            grandDue += data.totalDue;
            grandPaid += data.totalPaid;
            if (data.balance > 0.01) grandGap += data.balance;
            if (data.balance < -0.01) grandSurplus += Math.abs(data.balance);
        });

        return { grandDue, grandPaid, grandGap, grandSurplus };
    }, [filteredClients, filterLocation, filterYear, filterMonth, enrollments, transactions]);

    // --- SINGLE CLIENT EXPORTS ---
    const handleSingleClientExcel = () => {
        if (!selectedClient || !clientFinancials) return;
        
        // 1. Riepilogo
        const summary = getClientFinancialSummary(selectedClient, filterLocation, filterYear, filterMonth);
        const summaryRows = [{
            "Cliente": summary.name,
            "Tipo": summary.type,
            "Email": summary.email,
            "Telefono": summary.phone,
            "Sedi": summary.locations,
            "Totale Dovuto": summary.totalDue,
            "Totale Pagato": summary.totalPaid,
            "Saldo": summary.balance,
            "Presenze Tot": summary.aggPresences,
            "Assenze Tot": summary.aggAbsences
        }];

        // 2. Dettaglio Movimenti
        const detailRows: any[] = [];
        
        clientFinancials.rows.forEach(row => {
            // Header Iscrizione
            detailRows.push({
                "Contesto": `ISCRIZIONE: ${row.enrollment.subscriptionName}`,
                "Data": new Date(row.enrollment.startDate).toLocaleDateString(),
                "Dettaglio": `Prezzo: ${row.enrollment.price}€ - Allievo: ${row.enrollment.childName}`,
                "Importo": -row.enrollment.price,
                "Note": `Presenze: ${row.stats.presences} | Assenze: ${row.stats.absences}`
            });

            // Fatture
            row.invoices.forEach(inv => {
                detailRows.push({
                    "Contesto": "FATTURA",
                    "Data": new Date(inv.issueDate).toLocaleDateString(),
                    "Dettaglio": `N. ${inv.invoiceNumber}`,
                    "Importo": 0, // Fattura è documento, non movimento cassa, ma mettiamo 0 per non alterare saldo cassa o ripetiamo importo?
                    // Per chiarezza finanziaria, qui mostriamo i documenti.
                    "Note": `Stato: ${inv.status}`
                });
            });

            // Transazioni
            row.transactions.forEach(trs => {
                detailRows.push({
                    "Contesto": "PAGAMENTO (Cassa)",
                    "Data": new Date(trs.date).toLocaleDateString(),
                    "Dettaglio": trs.description,
                    "Importo": trs.amount,
                    "Note": trs.paymentMethod
                });
            });
        });

        // Orfani
        clientFinancials.orphanTrans.forEach(t => {
            detailRows.push({
                "Contesto": "PAGAMENTO NON ASSEGNATO",
                "Data": new Date(t.date).toLocaleDateString(),
                "Dettaglio": t.description,
                "Importo": t.amount,
                "Note": "Orfano"
            });
        });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Riepilogo");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Dettaglio Movimenti");
        XLSX.writeFile(wb, `Scheda_${getClientName(selectedClient).replace(/\s+/g, '_')}.xlsx`);
    };

    const handleSingleClientPDF = async () => {
        if (!selectedClient || !clientFinancials) return;
        setGeneratingReport(true);
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const doc = new jsPDF();
            const summary = getClientFinancialSummary(selectedClient, filterLocation, filterYear, filterMonth);

            // 1. Header
            if (companyInfo?.logoBase64) {
                try {
                    doc.addImage(companyInfo.logoBase64, 'PNG', 14, 10, 25, 25);
                } catch(e) {}
            }
            
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text("Estratto Conto Cliente", 195, 20, { align: 'right' });
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Data: ${new Date().toLocaleDateString()}`, 195, 26, { align: 'right' });

            // 2. Client Info Box
            doc.setDrawColor(200);
            doc.setFillColor(250, 250, 255);
            doc.roundedRect(14, 40, 182, 35, 3, 3, 'FD');
            
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text(getClientName(selectedClient), 20, 50);
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(selectedClient.address || '', 20, 56);
            doc.text(`${selectedClient.zipCode} ${selectedClient.city} (${selectedClient.province})`, 20, 61);
            doc.text(`Email: ${selectedClient.email}`, 20, 68);
            doc.text(`Tel: ${selectedClient.phone}`, 100, 68);

            // 3. Status Badges
            // Financial Badge
            const balColor = summary.balance > 0.01 ? [220, 50, 50] : [50, 150, 50]; // Red/Green
            doc.setFillColor(balColor[0] as any, balColor[1] as any, balColor[2] as any);
            doc.roundedRect(140, 45, 50, 18, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.text("SALDO ATTUALE", 165, 50, { align: 'center' });
            doc.setFontSize(12);
            doc.text(`${summary.balance > 0.01 ? '-' : '+'}${Math.abs(summary.balance).toFixed(2)}€`, 165, 58, { align: 'center' });
            
            doc.setTextColor(0,0,0); // Reset

            let currentY = 85;

            // 4. Enrollments Tables
            clientFinancials.rows.forEach((row, index) => {
                // Enrollment Header
                doc.setFontSize(11);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(60, 60, 82);
                doc.text(`${index + 1}. ${row.enrollment.subscriptionName}`, 14, currentY);
                doc.setFontSize(9);
                doc.setFont("helvetica", "normal");
                doc.text(`Allievo: ${row.enrollment.childName} | Prezzo: ${row.enrollment.price}€`, 14, currentY + 5);
                
                // Attendance Mini-Stats line
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text(`Didattica: ${row.stats.presences} Presenze | ${row.stats.absences} Assenze | ${row.stats.recoveries} Recuperi`, 14, currentY + 10);

                currentY += 14;

                const tableData: any[] = [];
                row.invoices.forEach(inv => tableData.push(['Fattura', inv.invoiceNumber, new Date(inv.issueDate).toLocaleDateString(), `${inv.totalAmount.toFixed(2)}€`]));
                row.transactions.forEach(trs => tableData.push(['Pagamento', trs.description, new Date(trs.date).toLocaleDateString(), `${trs.amount.toFixed(2)}€`]));

                if (tableData.length > 0) {
                    autoTable(doc, {
                        startY: currentY,
                        head: [['Tipo', 'Riferimento', 'Data', 'Importo']],
                        body: tableData,
                        theme: 'grid',
                        headStyles: { fillColor: [240, 240, 245], textColor: [50, 50, 60], fontStyle: 'bold' },
                        styles: { fontSize: 8 },
                        columnStyles: { 3: { halign: 'right' } },
                        margin: { left: 14, right: 14 }
                    });
                    currentY = (doc as any).lastAutoTable.finalY + 15;
                } else {
                    doc.setFontSize(8);
                    doc.setTextColor(150, 150, 150);
                    doc.text("(Nessun movimento registrato)", 14, currentY);
                    currentY += 15;
                }

                // Page break check
                if (currentY > 250) {
                    doc.addPage();
                    currentY = 20;
                }
            });

            // Orphans Section
            if (clientFinancials.orphanTrans.length > 0) {
                doc.setFontSize(11);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(200, 100, 0);
                doc.text("Movimenti Non Assegnati (Orfani)", 14, currentY);
                currentY += 6;

                const orphanData = clientFinancials.orphanTrans.map(t => ['Cassa', t.description, new Date(t.date).toLocaleDateString(), `${t.amount.toFixed(2)}€`]);
                autoTable(doc, {
                    startY: currentY,
                    head: [['Tipo', 'Descrizione', 'Data', 'Importo']],
                    body: orphanData,
                    theme: 'striped',
                    styles: { fontSize: 8 },
                    margin: { left: 14, right: 14 }
                });
            }

            doc.save(`Scheda_${getClientName(selectedClient).replace(/\s+/g, '_')}.pdf`);

        } catch (e) {
            console.error(e);
            alert("Errore generazione PDF");
        } finally {
            setGeneratingReport(false);
        }
    };

    // --- BULK EXPORT HANDLERS (EXISTING) ---
    const handleExportExcel = async () => {
        if (filteredClients.length === 0) return alert("Nessun dato da esportare.");
        setGeneratingReport(true);
        await new Promise(resolve => setTimeout(resolve, 50)); 

        try {
            const rows = filteredClients.map(c => {
                const data = getClientFinancialSummary(c, filterLocation, filterYear, filterMonth);
                return {
                    "Cliente": data.name,
                    "Tipo": data.type,
                    "Email": data.email,
                    "Telefono": data.phone,
                    "Sedi Attive": data.locations,
                    "Totale Presenze": data.aggPresences,
                    "Totale Assenze": data.aggAbsences,
                    "Totale Recuperi": data.aggRecoveries,
                    "Totale Dovuto": data.totalDue,
                    "Totale Pagato": data.totalPaid,
                    "Saldo/Gap": data.balance
                };
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            const sheetName = filterYear ? `Sit. ${filterYear}${filterMonth ? `-${filterMonth}` : ''}` : "Storico Completo";
            XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); 
            XLSX.writeFile(wb, `Report_Situazione_Clienti_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (e) {
            console.error(e);
            alert("Errore durante l'export Excel");
        } finally {
            setGeneratingReport(false);
        }
    };

    const handleExportPDF = async () => {
        if (filteredClients.length === 0) return alert("Nessun dato da esportare.");
        setGeneratingReport(true);
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            // Use landscape for more columns
            const doc = new jsPDF({ orientation: 'landscape' });
            
            // Header Logo
            if (companyInfo?.logoBase64) {
               try {
                   const imgData = companyInfo.logoBase64;
                   doc.addImage(imgData, 'PNG', 14, 10, 30, 30); 
               } catch(e) { console.warn("Logo error", e); }
            }
            
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            // Show Location prominently if filtered
            if (filterLocation) {
                doc.text(filterLocation.toUpperCase(), 50, 20);
                doc.setFontSize(14);
                doc.setFont("helvetica", "normal");
                doc.text("Report Situazione Clienti", 50, 28);
            } else {
                doc.text("Report Situazione Clienti", 50, 20);
            }
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Data Report: ${new Date().toLocaleDateString()}`, 50, 34);
            
            let filterText = "";
            if (filterYear) filterText += `Anno: ${filterYear}  `;
            if (filterMonth) filterText += `Mese: ${months[parseInt(filterMonth)-1]}  `;
            if (searchTerm) filterText += `Cerca: "${searchTerm}"`;
            
            if (filterText) {
                doc.setFontSize(12);
                doc.setTextColor(50, 50, 150); // Blueish for filters
                doc.text(`${filterText}`, 50, 40);
                doc.setTextColor(0,0,0); // Reset
            }

            // --- AGGREGATE TOTALS FOR PDF ---
            let pdfDue = 0;
            let pdfPaid = 0;
            let pdfGap = 0;
            let pdfSurplus = 0;

            const tableRows = filteredClients.map(c => {
                const data = getClientFinancialSummary(c, filterLocation, filterYear, filterMonth);
                
                pdfDue += data.totalDue;
                pdfPaid += data.totalPaid;
                if (data.balance > 0.01) pdfGap += data.balance;
                if (data.balance < -0.01) pdfSurplus += Math.abs(data.balance);

                return [
                    data.name,
                    data.type === 'Genitore' ? 'Gen.' : 'Ente', // Shorten
                    data.locations || '-',
                    data.aggPresences, // New
                    data.aggAbsences, // New
                    data.aggRecoveries, // New
                    `- ${data.totalDue.toFixed(2)}€`, 
                    `+ ${data.totalPaid.toFixed(2)}€`,
                    data.balance 
                ];
            });

            autoTable(doc, {
                startY: 50,
                head: [['Cliente', 'Tipo', 'Sedi', 'Pres.', 'Ass.', 'Rec.', 'Dovuto', 'Pagato', 'Saldo']],
                body: tableRows,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [60, 60, 82], fontSize: 9, fontStyle: 'bold', halign: 'center' },
                columnStyles: {
                    0: { fontStyle: 'bold' },
                    3: { halign: 'center', cellWidth: 15 }, // Pres
                    4: { halign: 'center', cellWidth: 15 }, // Ass
                    5: { halign: 'center', cellWidth: 15 }, // Rec
                    6: { halign: 'right' },
                    7: { halign: 'right' },
                    8: { halign: 'right', fontStyle: 'bold' }
                },
                didParseCell: (data: any) => {
                    if (data.section === 'body') {
                        // Dovuto (Green)
                        if (data.column.index === 6) data.cell.styles.textColor = [50, 150, 50];
                        // Pagato (Green)
                        if (data.column.index === 7) data.cell.styles.textColor = [50, 150, 50];
                        // Saldo
                        if (data.column.index === 8) {
                            const val = parseFloat(data.cell.raw);
                            if (val > 0.01) {
                                data.cell.text = `- ${val.toFixed(2)}€`;
                                data.cell.styles.textColor = [220, 50, 50]; // Red
                            } else if (val < -0.01) {
                                data.cell.text = `+ ${Math.abs(val).toFixed(2)}€`;
                                data.cell.styles.textColor = [0, 180, 200]; // Cyan
                            } else {
                                data.cell.text = "OK";
                                data.cell.styles.textColor = [150, 150, 150]; // Gray
                            }
                        }
                    }
                }
            });

            const finalY = (doc as any).lastAutoTable.finalY + 10;
            doc.setFontSize(10);
            
            // A. Totale Dovuto
            doc.setTextColor(50, 150, 50);
            doc.text(`A. Totale Dovuto: -${pdfDue.toFixed(2)}€`, 14, finalY);
            
            // B. Totale Coperto
            doc.text(`B. Totale Coperto: +${pdfPaid.toFixed(2)}€`, 14, finalY + 6);
            
            // C. Totale Scoperto
            doc.setTextColor(220, 50, 50);
            doc.text(`C. Totale Scoperto (Gap): -${pdfGap.toFixed(2)}€`, 14, finalY + 12);
            
            // D. Totale Differenze
            doc.setTextColor(0, 180, 200);
            doc.text(`D. Totale Differenze (Surplus): +${pdfSurplus.toFixed(2)}€`, 14, finalY + 18);

            const locStr = filterLocation ? filterLocation.replace(/\s+/g, '') : 'Global';
            const yearStr = filterYear || 'Storico';
            const monthStr = filterMonth ? months[parseInt(filterMonth)-1] : 'All';
            const filename = `Situaz.Clienti_${locStr}_${yearStr}_${monthStr}.pdf`;

            doc.save(filename);

        } catch (e) {
            console.error(e);
            alert("Errore durante l'export PDF");
        } finally {
            setGeneratingReport(false);
        }
    };

    const toggleBalanceFilter = (status: 'balanced' | 'debt' | 'surplus') => {
        setFilterBalanceStatus(prev => prev === status ? 'all' : status);
    };

    if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <IdentificationIcon /> Situazione Clienti
                    </h1>
                    <p className="mt-1 text-gray-500">Scheda completa anagrafica e finanziaria.</p>
                </div>
            </div>

            {/* HEADER FILTERS */}
            <div className="md-card p-4 bg-white sticky top-0 z-30 shadow-md border-b border-indigo-100 transition-all">
                {!selectedClient ? (
                    <div className="flex flex-col gap-3 animate-fade-in">
                        <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center">
                            <div className="relative flex-1 w-full">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                                <input 
                                    type="text" 
                                    placeholder="Cerca per nome, figlio, azienda..." 
                                    className="md-input pl-10" 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)} 
                                />
                            </div>
                            <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-1 xl:pb-0">
                                <select 
                                    value={filterLocation} 
                                    onChange={e => setFilterLocation(e.target.value)} 
                                    className="md-input w-40 flex-shrink-0 text-sm"
                                >
                                    <option value="">Tutte le Sedi</option>
                                    {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                                <select 
                                    value={filterYear} 
                                    onChange={e => { setFilterYear(e.target.value); if(!e.target.value) setFilterMonth(''); }} 
                                    className="md-input w-32 flex-shrink-0 text-sm font-bold text-indigo-700 bg-indigo-50 border-indigo-100"
                                >
                                    <option value="">Tutti gli anni</option>
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <select 
                                    value={filterMonth} 
                                    onChange={e => setFilterMonth(e.target.value)} 
                                    disabled={!filterYear}
                                    className={`md-input w-32 flex-shrink-0 text-sm font-bold ${!filterYear ? 'bg-gray-100 text-gray-400' : 'text-indigo-700 bg-indigo-50 border-indigo-100'}`}
                                >
                                    <option value="">Tutto l'anno</option>
                                    {months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        {/* BALANCE STATUS QUICK FILTERS */}
                        <div className="flex flex-wrap gap-2 md:gap-3 justify-start border-t border-slate-50 pt-3 pb-1">
                             <button
                                onClick={() => toggleBalanceFilter('balanced')}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 whitespace-nowrap ${filterBalanceStatus === 'balanced' ? 'bg-green-500 text-white border-green-600 shadow-md' : 'bg-white text-green-600 border-green-200 hover:bg-green-50'}`}
                            >
                                <span className={filterBalanceStatus === 'balanced' ? 'text-white' : 'text-green-500'}>✓</span> 
                                COPERTI <span className={`ml-1 opacity-80 ${filterBalanceStatus === 'balanced' ? 'text-white' : 'text-green-600'}`}>({statusCounts.countBalanced})</span>
                            </button>
                            <button
                                onClick={() => toggleBalanceFilter('debt')}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 whitespace-nowrap ${filterBalanceStatus === 'debt' ? 'bg-red-500 text-white border-red-600 shadow-md' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}
                            >
                                <span className={filterBalanceStatus === 'debt' ? 'text-white' : 'text-red-500'}>⚠</span> 
                                SCOPERTI <span className={`ml-1 opacity-80 ${filterBalanceStatus === 'debt' ? 'text-white' : 'text-red-600'}`}>({statusCounts.countDebt})</span>
                            </button>
                            <button
                                onClick={() => toggleBalanceFilter('surplus')}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 whitespace-nowrap ${filterBalanceStatus === 'surplus' ? 'bg-cyan-500 text-white border-cyan-600 shadow-md' : 'bg-white text-cyan-600 border-cyan-200 hover:bg-cyan-50'}`}
                            >
                                <span className={filterBalanceStatus === 'surplus' ? 'text-white' : 'text-cyan-500'}>+</span> 
                                SURPLUS <span className={`ml-1 opacity-80 ${filterBalanceStatus === 'surplus' ? 'text-white' : 'text-cyan-600'}`}>({statusCounts.countSurplus})</span>
                            </button>
                        </div>
                        
                        {/* BULK EXPORT ACTIONS */}
                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
                            <button 
                                onClick={handleExportExcel} 
                                disabled={generatingReport || filteredClients.length === 0}
                                className="md-btn md-btn-sm md-btn-flat text-green-700 hover:bg-green-50 flex items-center gap-2 border border-green-100"
                            >
                                {generatingReport ? <Spinner /> : <><DownloadIcon /> Export Excel ({filteredClients.length})</>}
                            </button>
                            <button 
                                onClick={handleExportPDF} 
                                disabled={generatingReport || filteredClients.length === 0}
                                className="md-btn md-btn-sm md-btn-flat text-red-700 hover:bg-red-50 flex items-center gap-2 border border-red-100"
                            >
                                {generatingReport ? <Spinner /> : <><PrinterIcon /> Report PDF ({filteredClients.length})</>}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row items-center justify-between gap-3 animate-slide-up">
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <button 
                                onClick={() => setSelectedClient(null)} 
                                className="flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors"
                            >
                                <span>←</span> Torna alla lista
                            </button>
                            
                            {/* SINGLE EXPORT ACTIONS */}
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleSingleClientExcel}
                                    disabled={generatingReport}
                                    className="flex items-center gap-1 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-xs font-bold border border-green-200 hover:bg-green-100"
                                    title="Export Dati (Excel)"
                                >
                                    {generatingReport ? <Spinner /> : <><DownloadIcon /> Export Dati</>}
                                </button>
                                <button 
                                    onClick={handleSingleClientPDF}
                                    disabled={generatingReport}
                                    className="flex items-center gap-1 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-100"
                                    title="Scheda PDF"
                                >
                                    {generatingReport ? <Spinner /> : <><PrinterIcon /> Scheda PDF</>}
                                </button>
                            </div>
                        </div>

                        <div className="text-right w-full md:w-auto">
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Scheda Cliente</p>
                            <h2 className="text-lg font-black text-slate-800 leading-none truncate max-w-[200px] md:max-w-md">
                                {getClientName(selectedClient)}
                            </h2>
                        </div>
                    </div>
                )}
            </div>

            {!selectedClient ? (
                /* LISTA RICERCA CON TOTALI */
                <div className="space-y-6">
                    {/* GRAND TOTALS WIDGET */}
                    {filteredClients.length > 0 && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
                            <div className="bg-white p-3 rounded-xl border border-green-200 shadow-sm flex flex-col items-center">
                                <span className="text-[10px] text-green-600 font-bold uppercase">Totale Dovuto</span>
                                <span className="text-lg font-black text-green-700">-{grandTotals.grandDue.toFixed(2)}€</span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-green-200 shadow-sm flex flex-col items-center">
                                <span className="text-[10px] text-green-600 font-bold uppercase">Totale Coperto</span>
                                <span className="text-lg font-black text-green-700">+{grandTotals.grandPaid.toFixed(2)}€</span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-red-200 shadow-sm flex flex-col items-center">
                                <span className="text-[10px] text-red-500 font-bold uppercase">Totale Scoperto</span>
                                <span className="text-lg font-black text-red-600">-{grandTotals.grandGap.toFixed(2)}€</span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-cyan-200 shadow-sm flex flex-col items-center">
                                <span className="text-[10px] text-cyan-600 font-bold uppercase">Totale Surplus</span>
                                <span className="text-lg font-black text-cyan-600">+{grandTotals.grandSurplus.toFixed(2)}€</span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                        {filteredClients.map(client => {
                            const summary = getClientFinancialSummary(client, filterLocation, filterYear, filterMonth);
                            return (
                                <div 
                                    key={client.id} 
                                    onClick={() => handleSelectClient(client)}
                                    className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md cursor-pointer hover:border-indigo-300 transition-all group flex flex-col h-full"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-gray-800 text-lg group-hover:text-indigo-700 leading-tight">{getClientName(client)}</h3>
                                        <span className={`text-[10px] uppercase px-2 py-1 rounded font-bold ${client.clientType === ClientType.Parent ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                            {client.clientType === ClientType.Parent ? 'Genitore' : 'Ente'}
                                        </span>
                                    </div>
                                    
                                    <div className="mt-auto pt-3 border-t border-dashed border-gray-100 grid grid-cols-3 gap-2 text-center text-xs">
                                        <div>
                                            <span className="block text-[9px] text-gray-400 font-bold uppercase">Dovuto</span>
                                            <span className="font-bold text-green-600">-{summary.totalDue.toFixed(0)}€</span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] text-gray-400 font-bold uppercase">Pagato</span>
                                            <span className="font-bold text-green-600">+{summary.totalPaid.toFixed(0)}€</span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] text-gray-400 font-bold uppercase">Saldo</span>
                                            {summary.balance > 0.01 ? (
                                                <span className="font-black text-red-500">-{summary.balance.toFixed(0)}€</span>
                                            ) : summary.balance < -0.01 ? (
                                                <span className="font-black text-cyan-500">+{Math.abs(summary.balance).toFixed(0)}€</span>
                                            ) : (
                                                <span className="font-black text-gray-400">OK</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredClients.length === 0 && (
                            <div className="col-span-full text-center py-10 text-gray-400 italic">
                                Nessun cliente trovato.
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* DETTAGLIO CLIENTE */
                <div className="space-y-6 animate-slide-up">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 1. Anagrafica */}
                        <div className="md-card p-6 bg-white border-l-4 border-indigo-500">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-tight">Anagrafica</h3>
                            <div className="space-y-3 text-sm">
                                <div><label className="text-xs text-gray-400 uppercase font-bold">Nome</label><p className="font-bold text-gray-900">{getClientName(selectedClient)}</p></div>
                                <div><label className="text-xs text-gray-400 uppercase font-bold">CF / P.IVA</label><p className="font-mono text-gray-700">{selectedClient.clientType === ClientType.Parent ? (selectedClient as ParentClient).taxCode : (selectedClient as InstitutionalClient).vatNumber}</p></div>
                                <div><label className="text-xs text-gray-400 uppercase font-bold">Contatti</label><p className="text-indigo-600">{selectedClient.email}</p><p>{selectedClient.phone}</p></div>
                            </div>
                        </div>

                        {/* 2. Sottoposti / Figli */}
                        <div className="md-card p-6 bg-white border-l-4 border-amber-400">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-tight">
                                {selectedClient.clientType === ClientType.Parent ? 'Figli & Allievi' : 'Dettagli Ente'}
                            </h3>
                            {selectedClient.clientType === ClientType.Parent ? (
                                <div className="space-y-3">
                                    {((selectedClient as ParentClient).children || []).map(child => (
                                        <div key={child.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-gray-800">{child.name}</span>
                                                <span className="text-xs bg-white px-2 py-0.5 rounded border text-gray-500">{child.age}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {((selectedClient as ParentClient).children || []).length === 0 && <p className="text-gray-400 italic text-sm">Nessun figlio registrato.</p>}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <p className="text-sm">Ente Istituzionale</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. Stato Recente */}
                        <div className="md-card p-6 bg-white border-l-4 border-green-500">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-tight">Stato Attuale</h3>
                            {clientFinancials?.rows[0]?.enrollment ? (
                                <div className="space-y-4">
                                    <div className={`p-3 rounded-xl border-2 text-center ${clientFinancials.rows[0].enrollment.status === EnrollmentStatus.Active ? 'bg-green-50 border-green-200 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                        <p className="text-xs font-black uppercase tracking-widest mb-1">STATUS</p>
                                        <p className="text-xl font-black">{clientFinancials.rows[0].enrollment.status === EnrollmentStatus.Active ? 'ATTIVO' : 'INATTIVO'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold">Ultima Sede</label>
                                        <p className="font-bold text-gray-800">{clientFinancials.rows[0].enrollment.locationName || 'N/D'}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-400 italic text-sm">Nessuna iscrizione recente.</p>
                            )}
                        </div>
                    </div>

                    {/* FINANZE & ISCRIZIONI */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        {filterYear && (
                            <div className="bg-amber-50 px-6 py-2 text-xs font-bold text-amber-800 border-b border-amber-100">
                                Filtro Attivo: Mostrando solo movimenti del {filterYear} {filterMonth ? `- Mese ${filterMonth}` : ''}
                            </div>
                        )}
                        {clientFinancials && clientFinancials.rows.map((row, idx) => (
                            <div key={idx} className="border-b last:border-0 border-gray-100">
                                <div className="bg-gray-50 p-3 flex justify-between items-center">
                                    <span className="font-bold text-gray-700">{row.enrollment.subscriptionName}</span>
                                    <span className="text-xs font-mono">{Number(row.enrollment.price).toFixed(2)}€</span>
                                </div>
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Transazioni (Cassa)</p>
                                        {row.transactions.map(t => (
                                            <div key={t.id} className="text-xs flex justify-between mb-1">
                                                <span>{new Date(t.date).toLocaleDateString()}</span>
                                                <span className="font-bold">{t.amount.toFixed(2)}€</span>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* MIDDLE COLUMN: INVOICES + MONITORING */}
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Fatture & Monitoraggio</p>
                                        <div className="space-y-3">
                                            {/* Invoices List */}
                                            {row.invoices.map(i => (
                                                <div key={i.id} className="text-xs flex justify-between mb-1">
                                                    <div>
                                                        <span className="font-mono font-bold mr-2">{i.invoiceNumber}</span>
                                                        <span className="text-gray-400 text-[10px]">{new Date(i.issueDate).toLocaleDateString()}</span>
                                                    </div>
                                                    <span className="font-bold">{i.totalAmount.toFixed(2)}€</span>
                                                </div>
                                            ))}
                                            
                                            {/* Monitoring Badge */}
                                            <div className="flex gap-2 border-t border-dashed border-gray-200 pt-2">
                                                <div className="flex-1 bg-green-50 text-green-700 text-center rounded border border-green-100 p-1">
                                                    <span className="block text-[8px] uppercase font-bold">Presenze</span>
                                                    <span className="text-xs font-black">{row.stats.presences}</span>
                                                </div>
                                                <div className="flex-1 bg-red-50 text-red-700 text-center rounded border border-red-100 p-1">
                                                    <span className="block text-[8px] uppercase font-bold">Assenze</span>
                                                    <span className="text-xs font-black">{row.stats.absences}</span>
                                                </div>
                                                <div className="flex-1 bg-amber-50 text-amber-700 text-center rounded border border-amber-100 p-1">
                                                    <span className="block text-[8px] uppercase font-bold">Recuperi</span>
                                                    <span className="text-xs font-black">{row.stats.recoveries}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* OPTIONAL THIRD COLUMN: NOTES/DETAILS IF NEEDED or SPACING */}
                                </div>
                            </div>
                        ))}
                        {clientFinancials?.rows.length === 0 && <p className="p-6 text-center text-gray-400 italic">Nessuna iscrizione o movimento nel periodo selezionato.</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientSituation;
