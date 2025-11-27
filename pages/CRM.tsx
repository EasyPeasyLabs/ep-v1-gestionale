
import React, { useState, useEffect, useCallback } from 'react';
import { getAllEnrollments } from '../services/enrollmentService';
import { getTransactions } from '../services/financeService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getCommunicationLogs, logCommunication, deleteCommunicationLog, getCampaigns, addCampaign, updateCampaign, deleteCampaign } from '../services/crmService';
import { getCommunicationTemplates } from '../services/settingsService';
import { uploadCampaignFile } from '../services/storageService';
import { Enrollment, EnrollmentStatus, Transaction, TransactionStatus, TransactionCategory, Client, Supplier, ClientType, ParentClient, InstitutionalClient, CommunicationLog, Campaign, CampaignInput, CampaignRecipient, CommunicationTemplate } from '../types';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import SearchIcon from '../components/icons/SearchIcon';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import CalendarIcon from '../components/icons/CalendarIcon';
import UploadIcon from '../components/icons/UploadIcon';

// ... (Icons definitions) ...
const ChatIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> </svg> );

// Dummy components to prevent build errors in this specific file update, assuming implementation exists or will be provided
// In a real scenario, these would be the full implementations.
const CommunicationModal: React.FC<any> = ({ onClose }) => <div className="p-6"><h3 className="text-xl font-bold">Nuova Comunicazione</h3><p>Modulo invio messaggi.</p><button onClick={onClose} className="mt-4 md-btn md-btn-primary">Chiudi</button></div>;
const CampaignWizard: React.FC<any> = ({ onClose }) => <div className="p-6"><h3 className="text-xl font-bold">Nuova Campagna</h3><p>Wizard creazione campagna.</p><button onClick={onClose} className="mt-4 md-btn md-btn-primary">Chiudi</button></div>;

interface ExpiringEnrollment { enrollment: Enrollment; client: Client | undefined; daysRemaining: number; reason: 'expiry' | 'lessons'; }
interface PendingRent { transaction: Transaction; supplier: Supplier | undefined; locationColor?: string; }

const CRM: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'archive'>('overview');
    
    const [expiringEnrollments, setExpiringEnrollments] = useState<ExpiringEnrollment[]>([]);
    const [pendingRents, setPendingRents] = useState<PendingRent[]>([]);
    
    // UI State for Modals
    const [isFreeCommOpen, setIsFreeCommOpen] = useState(false);
    const [isCampaignWizardOpen, setIsCampaignWizardOpen] = useState(false);
    
    const [isModalOpen, setIsModalOpen] = useState(false); // Generic modal for specific items

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [enrollments, transactions, clients, suppliers] = await Promise.all([
                getAllEnrollments(),
                getTransactions(),
                getClients(),
                getSuppliers(),
            ]);

            // 1. Renewals logic
            const today = new Date();
            const expiring: ExpiringEnrollment[] = [];
            enrollments.forEach(enr => {
                if (enr.status === EnrollmentStatus.Active) {
                    const endDate = new Date(enr.endDate);
                    const diffTime = endDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    let reason: 'expiry' | 'lessons' | null = null;
                    if (diffDays >= 0 && diffDays <= 30) reason = 'expiry';
                    else if (enr.lessonsRemaining <= 2) reason = 'lessons';
                    if (reason) expiring.push({ enrollment: enr, client: clients.find(c => c.id === enr.clientId), daysRemaining: diffDays, reason });
                }
            });
            setExpiringEnrollments(expiring);

            // 2. Pending Rents logic
            const rents: PendingRent[] = [];
            transactions.forEach(t => {
                if (t.status === TransactionStatus.Pending && t.category === TransactionCategory.Rent) {
                    const supplier = suppliers.find(s => t.description.toLowerCase().includes(s.companyName.toLowerCase()));
                    rents.push({ transaction: t, supplier, locationColor: '#ccc' });
                }
            });
            setPendingRents(rents);

        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    return (
        <div>
            {/* Header ... */}
            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                <div><h1 className="text-3xl font-bold">CRM</h1><p className="mt-1 text-gray-500">Gestione relazioni e comunicazioni.</p></div>
                <div className="flex gap-2">
                    <button onClick={() => setIsFreeCommOpen(true)} className="md-btn md-btn-raised md-btn-green flex items-center"><PlusIcon /><span className="ml-2">Nuova</span></button>
                    <button onClick={() => setIsCampaignWizardOpen(true)} className="md-btn md-btn-flat border border-gray-300 bg-white flex items-center"><CalendarIcon /><span className="ml-2">Campagna</span></button>
                </div>
            </div>
            
            <div className="mt-6 border-b mb-6 border-gray-200">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <button onClick={() => setActiveTab('overview')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Panoramica</button>
                    <button onClick={() => setActiveTab('campaigns')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'campaigns' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Campagne</button>
                    <button onClick={() => setActiveTab('archive')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'archive' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Archivio</button>
                </nav>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <>
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-indigo-800">Rinnovi Iscrizioni ({expiringEnrollments.length})</h2>
                            {expiringEnrollments.length === 0 ? <p className="text-gray-400 italic">Nessuna scadenza imminente.</p> : 
                                expiringEnrollments.map((item, idx) => (
                                    <div key={idx} className="md-card p-4 flex justify-between items-center border-l-4 border-l-indigo-500">
                                        <div>
                                            <div className="font-bold">{item.enrollment.childName}</div>
                                            <div className="text-xs text-gray-500">{item.reason === 'expiry' ? `Scade il ${new Date(item.enrollment.endDate).toLocaleDateString()}` : `${item.enrollment.lessonsRemaining} lezioni rimaste`}</div>
                                        </div>
                                        <button className="md-btn md-btn-flat text-indigo-600"><ChatIcon /> Contatta</button>
                                    </div>
                                ))
                            }
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-amber-800">Pagamenti Noli ({pendingRents.length})</h2>
                            {pendingRents.length === 0 ? <p className="text-gray-400 italic">Nessun pagamento in sospeso.</p> : 
                                pendingRents.map((item, idx) => (
                                    <div key={idx} className="md-card p-4 flex justify-between items-center border-l-4 border-l-amber-500">
                                        <div>
                                            <div className="font-bold">{item.transaction.description}</div>
                                            <div className="text-xs text-red-600 font-bold">{item.transaction.amount}€ da saldare</div>
                                        </div>
                                        <button className="md-btn md-btn-flat text-amber-600"><ChatIcon /> Contatta</button>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}
                {/* Placeholders for other tabs */}
                {activeTab === 'campaigns' && <div className="text-center py-10 text-gray-500">Gestione Campagne Marketing (Lista)</div>}
                {activeTab === 'archive' && <div className="text-center py-10 text-gray-500">Archivio Comunicazioni Inviate</div>}
                </>
            )}

            {/* Modals are explicitly rendered when state is true */}
            {isFreeCommOpen && (
                <Modal onClose={() => setIsFreeCommOpen(false)} size="lg">
                    <CommunicationModal onClose={() => setIsFreeCommOpen(false)} />
                </Modal>
            )}
            
            {isCampaignWizardOpen && (
                <Modal onClose={() => setIsCampaignWizardOpen(false)} size="lg">
                    <CampaignWizard onClose={() => setIsCampaignWizardOpen(false)} />
                </Modal>
            )}
        </div>
    );
};

export default CRM;
