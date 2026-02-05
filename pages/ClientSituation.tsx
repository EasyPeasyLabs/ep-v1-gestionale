
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Client, ClientType, ParentClient, InstitutionalClient, Enrollment, Transaction, Invoice, Supplier, EnrollmentStatus, TransactionType } from '../types';
import { getClients } from '../services/parentService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getTransactions, getInvoices } from '../services/financeService';
import { getSuppliers } from '../services/supplierService';
import Spinner from '../components/Spinner';
import SearchIcon from '../components/icons/SearchIcon';
import IdentificationIcon from '../components/icons/IdentificationIcon';
import DownloadIcon from '../components/icons/DownloadIcon';
import PrinterIcon from '../components/icons/PrinterIcon';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable'; // Side-effect import to patch jsPDF prototype
import { getCompanyInfo } from '../services/settingsService';

const getClientName = (c: Client) => c.clientType === ClientType.Parent ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` : (c as InstitutionalClient).companyName;

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
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    
    // Selected Context
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [cData, eData, tData, iData, sData] = await Promise.all([
                getClients(),
                getAllEnrollments(),
                getTransactions(),
                getInvoices(),
                getSuppliers()
            ]);
            setClients(cData);
            setEnrollments(eData);
            setTransactions(tData);
            setInvoices(iData);
            setSuppliers(sData);
        } catch (e) {
            console.error(e);
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
        suppliers.forEach(s => s.locations.forEach(l => locs.add(l.name)));
        // Also add legacy locations from enrollments
        enrollments.forEach(e => {
            if (e.locationName && e.locationName !== 'Sede Non Definita') locs.add(e.locationName);
        });
        return Array.from(locs).sort();
    }, [suppliers, enrollments]);

    const filteredClients = useMemo(() => {
        return clients.filter(c => {
            const name = getClientName(c).toLowerCase();
            const term = searchTerm.toLowerCase();
            let match = name.includes(term);
            
            // Search in children
            if (!match && c.clientType === ClientType.Parent) {
                match = (c as ParentClient).children.some(child => child.name.toLowerCase().includes(term));
            }

            // Location Filter (Indirect)
            if (match && filterLocation) {
                // Check if client has enrollment in this location
                const hasLoc = enrollments.some(e => e.clientId === c.id && e.locationName === filterLocation);
                if (!hasLoc) match = false;
            }

            return match;
        }).sort((a,b) => {
            const nA = getClientName(a);
            const nB = getClientName(b);
            return sortOrder === 'asc' ? nA.localeCompare(nB) : nB.localeCompare(nA);
        });
    }, [clients, searchTerm, filterLocation, sortOrder, enrollments]);

    // Derived Data for Selected Client
    const clientFinancials = useMemo(() => {
        if (!selectedClient) return null;
        
        const clientEnrollments = enrollments.filter(e => e.clientId === selectedClient.id).sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        
        // Group by Enrollment ID for structured view
        const rows = clientEnrollments.map(enr => {
            const linkedInvoices = invoices.filter(i => i.relatedEnrollmentId === enr.id && !i.isDeleted);
            const linkedTrans = transactions.filter(t => t.relatedEnrollmentId === enr.id && !t.isDeleted);
            
            return {
                enrollment: enr,
                invoices: linkedInvoices,
                transactions: linkedTrans
            };
        });

        // Orphans (General Payments/Invoices not linked)
        const orphanInvoices = invoices.filter(i => i.clientId === selectedClient.id && !i.relatedEnrollmentId && !i.isDeleted);
        const orphanTrans = transactions.filter(t => t.clientName === getClientName(selectedClient) && !t.relatedEnrollmentId && !t.isDeleted); // Weak link by name

        return { rows, orphanInvoices, orphanTrans };
    }, [selectedClient, enrollments, invoices, transactions]);

    const handleSelectClient = (c: Client) => {
        setSelectedClient(c);
    };

    // --- BULK EXPORT LOGIC ---
    const generateBulkFinancialData = () => {
        return filteredClients.map(client => {
            const name = getClientName(client);
            
            // 1. Enrollments
            const clientEnrs = enrollments.filter(e => e.clientId === client.id);
            const totalDue = clientEnrs.reduce((acc, e) => acc + (Number(e.price) || 0), 0);
            const enrIds = new Set(clientEnrs.map(e => e.id));

            // 2. Transactions (Paid)
            // Linked to Enrollment
            const linkedTrans = transactions.filter(t => 
                !t.isDeleted && 
                t.type === TransactionType.Income && 
                t.relatedEnrollmentId && 
                enrIds.has(t.relatedEnrollmentId)
            );
            
            // Orphans
            const orphanTrans = transactions.filter(t => 
                !t.isDeleted && 
                t.type === TransactionType.Income && 
                !t.relatedEnrollmentId && 
                t.clientName === name
            );

            const totalPaid = linkedTrans.reduce((s,t) => s + t.amount, 0) + orphanTrans.reduce((s,t) => s + t.amount, 0);
            
            // Orphans count (Invoices + Trans)
            const orphanInvoicesCount = invoices.filter(i => i.clientId === client.id && !i.relatedEnrollmentId && !i.isDeleted).length;
            const orphanTransCount = orphanTrans.length;
            
            return {
                client,
                name,
                type: client.clientType === ClientType.Parent ? 'Genitore' : 'Ente',
                enrollmentCount: clientEnrs.length,
                totalDue,
                totalPaid,
                balance: totalDue - totalPaid,
                orphansCount: orphanInvoicesCount + orphanTransCount,
                phone: client.phone || ''
            };
        });
    };

    const handleExportExcel = () => {
        if (filteredClients.length === 0) return alert("Nessun dato da esportare.");
        setGeneratingReport(true);
        
        setTimeout(() => {
            try {
                const data = generateBulkFinancialData();
                const rows = data.map(d => ({
                    "Cliente": d.name,
                    "Tipo": d.type,
                    "Telefono": d.phone,
                    "N. Iscrizioni": d.enrollmentCount,
                    "Totale Dovuto": d.totalDue,
                    "Totale Pagato": d.totalPaid,
                    "Saldo": d.balance,
                    "Note": d.orphansCount > 0 ? `${d.orphansCount} elementi orfani` : d.balance > 0.1 ? 'Scoperto' : 'In Regola'
                }));

                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Situazione Clienti");
                XLSX.writeFile(wb, `Report_Situazione_Clienti_${new Date().toISOString().split('T')[0]}.xlsx`);
            } catch (e) {
                console.error(e);
                alert("Errore esportazione Excel.");
            } finally {
                setGeneratingReport(false);
            }
        }, 100);
    };

    const handleExportPDF = async () => {
        if (filteredClients.length === 0) return alert("Nessun dato da esportare.");
        setGeneratingReport(true);

        try {
            const companyInfo = await getCompanyInfo();
            const data = generateBulkFinancialData();
            const doc = new jsPDF();

            // Header
            doc.setFontSize(18);
            doc.text("Report Situazione Clienti", 14, 20);
            doc.setFontSize(10);
            doc.text(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, 14, 26);
            if (filterLocation) {
                doc.text(`Filtro Sede: ${filterLocation}`, 14, 32);
            }
            if (companyInfo?.name) {
                doc.setFontSize(9);
                doc.text(companyInfo.name, 195, 20, { align: 'right' });
            }

            const tableRows = data.map(d => [
                d.name,
                d.enrollmentCount,
                `${d.totalDue.toFixed(2)}€`,
                `${d.totalPaid.toFixed(2)}€`,
                `${d.balance.toFixed(2)}€`
            ]);

            // Totals
            const totalGap = data.reduce((sum, d) => sum + (d.balance > 0 ? d.balance : 0), 0);

            // Use autoTable via 'any' casting on doc because we used side-effect import
            (doc as any).autoTable({
                startY: 40,
                head: [['Cliente', 'Iscrizioni', 'Dovuto', 'Pagato', 'Saldo']],
                body: tableRows,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: [60, 60, 82] },
                columnStyles: {
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                    4: { halign: 'right', fontStyle: 'bold' }
                },
                didParseCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 4) {
                        const raw = data.cell.raw;
                        // Use String() for safe casting to avoid TS18047
                        if (raw !== null && raw !== undefined) {
                            const val = parseFloat(String(raw).replace('€', ''));
                            if (val > 0.1) {
                                data.cell.styles.textColor = [220, 38, 38]; // Red
                            } else {
                                data.cell.styles.textColor = [22, 163, 74]; // Green
                            }
                        }
                    }
                }
            });

            const finalY = (doc as any).lastAutoTable.finalY + 10;
            doc.setFontSize(10);
            doc.text(`Totale Scoperto Lista: ${totalGap.toFixed(2)}€`, 14, finalY);

            doc.save(`Report_Situazione_Clienti_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (e) {
            console.error(e);
            alert("Errore generazione PDF.");
        } finally {
            setGeneratingReport(false);
        }
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

            {/* HEADER FILTERS OR NAVIGATION (STICKY) */}
            <div className="md-card p-4 bg-white sticky top-0 z-30 shadow-md border-b border-indigo-100 transition-all">
                {!selectedClient ? (
                    /* STATE A: SEARCH MODE */
                    <div className="flex flex-col md:flex-row gap-4 animate-fade-in items-center">
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
                        <select 
                            value={filterLocation} 
                            onChange={e => setFilterLocation(e.target.value)} 
                            className="md-input w-full md:w-64"
                        >
                            <option value="">Tutte le Sedi</option>
                            {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <div className="flex bg-gray-100 p-1 rounded-lg flex-shrink-0">
                            <button onClick={() => setSortOrder('asc')} className={`px-3 py-2 text-xs font-bold rounded-md ${sortOrder === 'asc' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>A-Z</button>
                            <button onClick={() => setSortOrder('desc')} className={`px-3 py-2 text-xs font-bold rounded-md ${sortOrder === 'desc' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Z-A</button>
                        </div>
                        
                        {/* EXPORT BUTTONS */}
                        <div className="flex gap-2 pl-2 border-l border-gray-200">
                            <button 
                                onClick={handleExportExcel} 
                                disabled={filteredClients.length === 0 || generatingReport}
                                className="md-btn md-btn-flat hover:bg-green-50 text-gray-500 hover:text-green-700 p-2" 
                                title="Esporta Excel"
                            >
                                {generatingReport ? <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div> : <DownloadIcon />}
                                <span className="sr-only md:not-sr-only md:ml-2 text-xs font-bold hidden lg:inline">Excel</span>
                            </button>
                            <button 
                                onClick={handleExportPDF} 
                                disabled={filteredClients.length === 0 || generatingReport}
                                className="md-btn md-btn-flat hover:bg-red-50 text-gray-500 hover:text-red-700 p-2" 
                                title="Stampa Report PDF"
                            >
                                {generatingReport ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div> : <PrinterIcon />}
                                <span className="sr-only md:not-sr-only md:ml-2 text-xs font-bold hidden lg:inline">PDF</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    /* STATE B: NAVIGATION MODE (Inside Details) */
                    <div className="flex items-center justify-between animate-slide-up">
                        <button 
                            onClick={() => setSelectedClient(null)} 
                            className="flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors"
                        >
                            <span>←</span> Torna alla lista
                        </button>
                        <div className="text-right">
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Scheda Cliente</p>
                            <h2 className="text-lg font-black text-slate-800 leading-none truncate max-w-[200px] md:max-w-md">
                                {getClientName(selectedClient)}
                            </h2>
                        </div>
                    </div>
                )}
            </div>

            {!selectedClient ? (
                /* SEARCH RESULTS LIST */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                    {filteredClients.map(client => (
                        <div 
                            key={client.id} 
                            onClick={() => handleSelectClient(client)}
                            className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md cursor-pointer hover:border-indigo-300 transition-all group"
                        >
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-gray-800 text-lg group-hover:text-indigo-700">{getClientName(client)}</h3>
                                <span className={`text-[10px] uppercase px-2 py-1 rounded font-bold ${client.clientType === ClientType.Parent ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                    {client.clientType === ClientType.Parent ? 'Genitore' : 'Ente'}
                                </span>
                            </div>
                            {client.clientType === ClientType.Parent && (client as ParentClient).children.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {(client as ParentClient).children.map(c => (
                                        <span key={c.id} className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded border border-gray-100">{c.name}</span>
                                    ))}
                                </div>
                            )}
                            <div className="mt-3 text-xs text-gray-400">
                                {client.phone && <span>📞 {client.phone}</span>}
                            </div>
                        </div>
                    ))}
                    {filteredClients.length === 0 && (
                        <div className="col-span-full text-center py-10 text-gray-400 italic">
                            Nessun cliente trovato.
                        </div>
                    )}
                </div>
            ) : (
                /* CLIENT DETAIL VIEW */
                <div className="space-y-6 animate-slide-up">
                    
                    {/* BODY: 3 COLUMNS */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* LEFT: Anagrafica */}
                        <div className="md-card p-6 bg-white border-l-4 border-indigo-500">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-tight">Anagrafica</h3>
                            <div className="space-y-3 text-sm">
                                <div><label className="text-xs text-gray-400 uppercase font-bold">Nome / Ragione Sociale</label><p className="font-bold text-gray-900">{getClientName(selectedClient)}</p></div>
                                <div><label className="text-xs text-gray-400 uppercase font-bold">CF / P.IVA</label><p className="font-mono text-gray-700">{selectedClient.clientType === ClientType.Parent ? (selectedClient as ParentClient).taxCode : (selectedClient as InstitutionalClient).vatNumber}</p></div>
                                <div><label className="text-xs text-gray-400 uppercase font-bold">Contatti</label><p className="text-indigo-600">{selectedClient.email}</p><p>{selectedClient.phone}</p></div>
                                <div><label className="text-xs text-gray-400 uppercase font-bold">Indirizzo</label><p className="text-gray-600">{selectedClient.address}, {selectedClient.city}</p></div>
                            </div>
                        </div>

                        {/* CENTER: Children / Refs */}
                        <div className="md-card p-6 bg-white border-l-4 border-amber-400">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-tight">
                                {selectedClient.clientType === ClientType.Parent ? 'Figli & Allievi' : 'Dettagli Ente'}
                            </h3>
                            {selectedClient.clientType === ClientType.Parent ? (
                                <div className="space-y-3">
                                    {(selectedClient as ParentClient).children.map(child => (
                                        <div key={child.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-gray-800">{child.name}</span>
                                                <span className="text-xs bg-white px-2 py-0.5 rounded border text-gray-500">{child.age}</span>
                                            </div>
                                            {child.notes && <p className="text-xs text-gray-500 italic">"{child.notes}"</p>}
                                        </div>
                                    ))}
                                    {(selectedClient as ParentClient).children.length === 0 && <p className="text-gray-400 italic text-sm">Nessun figlio registrato.</p>}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <p className="text-sm"><strong>Num. Bambini:</strong> {(selectedClient as InstitutionalClient).numberOfChildren}</p>
                                        <p className="text-sm"><strong>Fascia Età:</strong> {(selectedClient as InstitutionalClient).ageRange}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Status */}
                        <div className="md-card p-6 bg-white border-l-4 border-green-500">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-tight">Stato Attuale</h3>
                            {(() => {
                                const lastEnr = clientFinancials?.rows[0]?.enrollment;
                                if (lastEnr) {
                                    const isActive = lastEnr.status === EnrollmentStatus.Active;
                                    return (
                                        <div className="space-y-4">
                                            <div className={`p-3 rounded-xl border-2 text-center ${isActive ? 'bg-green-50 border-green-200 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                                <p className="text-xs font-black uppercase tracking-widest mb-1">STATUS</p>
                                                <p className="text-xl font-black">{isActive ? 'ATTIVO' : 'INATTIVO'}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 uppercase font-bold">Ultima Sede</label>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: lastEnr.locationColor || '#ccc' }}></span>
                                                    <span className="font-bold text-gray-800">{lastEnr.locationName}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 uppercase font-bold">Ultimo Pacchetto</label>
                                                <p className="font-medium text-gray-700">{lastEnr.subscriptionName}</p>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    return <p className="text-gray-400 italic text-sm">Nessuna iscrizione recente.</p>;
                                }
                            })()}
                        </div>
                    </div>

                    {/* FOOTER: SPLIT VIEW (Enrollments vs Finance) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                            
                            {/* LEFT: Enrollment History */}
                            <div className="p-0">
                                <div className="bg-gray-50 p-4 border-b border-gray-100 font-bold text-gray-700 text-sm uppercase tracking-wide">
                                    Storico Iscrizioni
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {clientFinancials?.rows.length === 0 && <p className="p-4 text-gray-400 italic text-sm">Nessuna iscrizione.</p>}
                                    {clientFinancials?.rows.map((row, idx) => (
                                        <div key={idx} className="p-4 h-32 flex flex-col justify-center"> {/* Fixed height for alignment */}
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-gray-800 text-sm">{row.enrollment.subscriptionName}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${row.enrollment.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>{row.enrollment.status}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 mb-1">
                                                {new Date(row.enrollment.startDate).toLocaleDateString()} - {new Date(row.enrollment.endDate).toLocaleDateString()}
                                            </div>
                                            <div className="text-xs text-indigo-600 font-medium">
                                                {row.enrollment.childName} • {row.enrollment.locationName}
                                            </div>
                                            <div className="mt-1 text-xs font-mono text-gray-400">
                                                Prezzo: {Number(row.enrollment.price).toFixed(2)}€
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* RIGHT: Payment History (Aligned) */}
                            <div className="p-0">
                                <div className="bg-gray-50 p-4 border-b border-gray-100 font-bold text-gray-700 text-sm uppercase tracking-wide">
                                    Storico Pagamenti Correlati
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {clientFinancials?.rows.map((row, idx) => {
                                        const paidTotal = row.transactions.reduce((acc, t) => acc + t.amount, 0);
                                        const dueTotal = Number(row.enrollment.price);
                                        const isCovered = paidTotal >= dueTotal - 0.1; // Tolerance

                                        return (
                                            <div key={idx} className="p-4 h-32 overflow-y-auto custom-scrollbar bg-slate-50/30"> {/* Fixed height match */}
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className={`text-[10px] font-black uppercase ${isCovered ? 'text-green-600' : 'text-red-500'}`}>
                                                        {isCovered ? 'SALDATO' : `DA SALDARE (${(dueTotal - paidTotal).toFixed(2)}€)`}
                                                    </span>
                                                    <span className="font-mono font-bold text-xs">Tot. Pagato: {paidTotal.toFixed(2)}€</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {row.transactions.map(t => (
                                                        <div key={t.id} className="flex justify-between text-[10px] text-gray-600 border-b border-gray-100 pb-0.5 last:border-0">
                                                            <span>{new Date(t.date).toLocaleDateString()} ({t.paymentMethod})</span>
                                                            <span className="font-mono font-bold">{t.amount.toFixed(2)}€</span>
                                                        </div>
                                                    ))}
                                                    {row.transactions.length === 0 && <p className="text-[10px] italic text-gray-400">Nessun pagamento registrato.</p>}
                                                </div>
                                                {row.invoices.length > 0 && (
                                                    <div className="mt-1 pt-1 border-t border-dashed border-gray-200">
                                                        <p className="text-[9px] text-gray-400 uppercase font-bold">Fatture:</p>
                                                        {row.invoices.map(inv => (
                                                            <span key={inv.id} className="text-[10px] text-indigo-500 mr-2 block">{inv.invoiceNumber} ({inv.totalAmount.toFixed(2)}€)</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {clientFinancials?.rows.length === 0 && <div className="p-4 text-gray-400 italic text-sm">Nessuno storico.</div>}
                                </div>
                            </div>

                        </div>
                        
                        {/* ORPHANS SECTION (If any) */}
                        {clientFinancials && (clientFinancials.orphanTrans.length > 0 || clientFinancials.orphanInvoices.length > 0) && (
                            <div className="bg-amber-50 border-t border-amber-200 p-4">
                                <h4 className="text-xs font-bold text-amber-800 uppercase mb-2">Elementi Orfani (Non collegati a iscrizioni)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase">Transazioni</p>
                                        {clientFinancials.orphanTrans.map(t => (
                                            <div key={t.id} className="text-xs flex justify-between bg-white p-1 rounded mb-1 border border-amber-100">
                                                <span>{new Date(t.date).toLocaleDateString()} - {t.description}</span>
                                                <span className="font-mono">{t.amount.toFixed(2)}€</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase">Fatture</p>
                                        {clientFinancials.orphanInvoices.map(i => (
                                            <div key={i.id} className="text-xs flex justify-between bg-white p-1 rounded mb-1 border border-amber-100">
                                                <span>{i.invoiceNumber} ({new Date(i.issueDate).toLocaleDateString()})</span>
                                                <span className="font-mono">{i.totalAmount.toFixed(2)}€</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientSituation;
