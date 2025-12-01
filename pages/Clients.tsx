
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Client, ClientInput, ClientType, ParentClient, InstitutionalClient, Child, ParentRating, ChildRating, Note, Enrollment, EnrollmentStatus } from '../types';
import { getClients, addClient, updateClient, deleteClient, restoreClient, permanentDeleteClient } from '../services/parentService';
import { getAllEnrollments, deleteEnrollment, getEnrollmentsForClient } from '../services/enrollmentService';
import { cleanupEnrollmentFinancials, deleteAutoRentTransactions } from '../services/financeService';
import { importClientsFromExcel } from '../services/importService';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';
import ImportModal from '../components/ImportModal';
import NotesManager from '../components/NotesManager';
import Pagination from '../components/Pagination';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import RestoreIcon from '../components/icons/RestoreIcon';
import UploadIcon from '../components/icons/UploadIcon';
import SearchIcon from '../components/icons/SearchIcon';

// Internal Star Icon
const StarIcon: React.FC<{ filled: boolean; onClick?: () => void; className?: string }> = ({ filled, onClick, className }) => (
    <svg 
        onClick={onClick} 
        xmlns="http://www.w3.org/2000/svg" 
        className={`h-5 w-5 ${filled ? 'text-yellow-400' : 'text-gray-300'} ${onClick ? 'cursor-pointer hover:scale-110 transition-transform' : ''} ${className}`} 
        viewBox="0 0 20 20" 
        fill="currentColor"
    >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
);

const daysOfWeekMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

const getChildRating = (child: Child) => {
    if (!child.rating) return 0;
    const { learning, behavior, attendance, hygiene } = child.rating;
    const sum = learning + behavior + attendance + hygiene;
    return sum > 0 ? (sum / 4).toFixed(1) : 0;
};

const getParentRating = (rating?: ParentRating) => {
    if (!rating) return 0;
    const { availability, complaints, churnRate, distance } = rating;
    const sum = availability + complaints + churnRate + distance;
    return sum > 0 ? (sum / 4).toFixed(1) : 0;
};

const RatingRow: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
    <div className="flex justify-between items-center mb-1 bg-white p-2 rounded border border-gray-100">
        <span className="text-xs text-gray-600 font-medium">{label}</span>
        <div className="flex space-x-1 items-center">
            <span className="text-xs font-bold text-gray-400 mr-2">{value}/5</span>
            {[1,2,3,4,5].map(star => (
                <StarIcon key={star} filled={star <= value} onClick={() => onChange(star)} className="w-4 h-4" />
            ))}
        </div>
    </div>
);

const RatingLegend: React.FC = () => (
    <div className="mt-3 flex items-center justify-end gap-3 text-[10px] text-gray-400 border-t border-dashed border-gray-200 pt-2">
        <div className="flex items-center">
            <span className="font-bold mr-1">1</span> <StarIcon filled={true} className="w-3 h-3 text-yellow-400 mr-1" /> <span>= insufficiente</span>
        </div>
        <div className="flex items-center">
            <span className="font-bold mr-1">5</span> <StarIcon filled={true} className="w-3 h-3 text-yellow-400 mr-1" /> <span>= eccellente</span>
        </div>
    </div>
);

const ClientForm: React.FC<{ client?: Client | null; onSave: (c: ClientInput | Client) => void; onCancel: () => void }> = ({ client, onSave, onCancel }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'children' | 'rating'>('general');
    const [clientType, setClientType] = useState<ClientType>(client?.clientType || ClientType.Parent);
    
    // Common
    const [email, setEmail] = useState(client?.email || '');
    const [phone, setPhone] = useState(client?.phone || '');
    const [address, setAddress] = useState(client?.address || '');
    const [zipCode, setZipCode] = useState(client?.zipCode || '');
    const [city, setCity] = useState(client?.city || '');
    const [province, setProvince] = useState(client?.province || '');

    // Parent
    const [firstName, setFirstName] = useState((client as ParentClient)?.firstName || '');
    const [lastName, setLastName] = useState((client as ParentClient)?.lastName || '');
    const [taxCode, setTaxCode] = useState((client as ParentClient)?.taxCode || '');
    const [children, setChildren] = useState<Child[]>((client as ParentClient)?.children || []);
    
    // Institutional
    const [companyName, setCompanyName] = useState((client as InstitutionalClient)?.companyName || '');
    const [vatNumber, setVatNumber] = useState((client as InstitutionalClient)?.vatNumber || '');
    const [numberOfChildren, setNumberOfChildren] = useState((client as InstitutionalClient)?.numberOfChildren || 0);
    const [ageRange, setAgeRange] = useState((client as InstitutionalClient)?.ageRange || '');

    // Ratings & Notes (For Parent & Children & Institutional)
    // Cast to ParentClient is safe for initial state as BaseClient has notesHistory too
    const [parentRating, setParentRating] = useState<ParentRating>((client as ParentClient)?.rating || { availability: 0, complaints: 0, churnRate: 0, distance: 0 });
    const [notesHistory, setNotesHistory] = useState<Note[]>((client as ParentClient)?.notesHistory || []);
    
    // Temporary child input for adding
    const [newChildName, setNewChildName] = useState('');
    const [newChildAge, setNewChildAge] = useState('');

    const handleAddChild = () => {
        if (newChildName && newChildAge) {
            setChildren([...children, { 
                id: Date.now().toString(), 
                name: newChildName, 
                age: newChildAge,
                rating: { learning: 0, behavior: 0, attendance: 0, hygiene: 0 },
                notesHistory: [],
                tags: []
            }]);
            setNewChildName('');
            setNewChildAge('');
        }
    };

    const handleRemoveChild = (index: number) => {
        setChildren(children.filter((_, i) => i !== index));
    };

    // Child Rating Edit
    const handleChildRatingChange = (index: number, field: keyof ChildRating, value: number) => {
        const updatedChildren = [...children];
        const child = { ...updatedChildren[index] };
        child.rating = { ...child.rating!, [field]: value };
        updatedChildren[index] = child;
        setChildren(updatedChildren);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const common = { email, phone, address, zipCode, city, province, clientType, notesHistory };
        
        if (clientType === ClientType.Parent) {
            const parentData: any = {
                ...common,
                firstName, lastName, taxCode, children,
                rating: parentRating
            };
            if (client?.id) { onSave({ ...parentData, id: client.id }); } else { onSave(parentData); }
        } else {
            const instData: any = {
                ...common,
                companyName, vatNumber, numberOfChildren, ageRange
            };
            if (client?.id) { onSave({ ...instData, id: client.id }); } else { onSave(instData); }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full overflow-hidden">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">{client ? 'Modifica Cliente' : 'Nuovo Cliente'}</h2>
                    {!client && (
                        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
                            <button type="button" onClick={() => setClientType(ClientType.Parent)} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${clientType === ClientType.Parent ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>Genitore</button>
                            <button type="button" onClick={() => setClientType(ClientType.Institutional)} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${clientType === ClientType.Institutional ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>Ente</button>
                        </div>
                    )}
                </div>
                
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
                    <button type="button" onClick={() => setActiveTab('general')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap px-2 ${activeTab === 'general' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>Anagrafica</button>
                    {clientType === ClientType.Parent && (
                        <button type="button" onClick={() => setActiveTab('children')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap px-2 ${activeTab === 'children' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>Figli ({children.length})</button>
                    )}
                    <button type="button" onClick={() => setActiveTab('rating')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap px-2 ${activeTab === 'rating' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>
                        {clientType === ClientType.Parent ? 'Valutazione' : 'Note'}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                {activeTab === 'general' && (
                    <>
                        {clientType === ClientType.Parent ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="md-input-group"><input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="md-input" placeholder=" "/><label className="md-input-label">Nome</label></div>
                                <div className="md-input-group"><input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="md-input" placeholder=" "/><label className="md-input-label">Cognome</label></div>
                                <div className="md-input-group col-span-full"><input type="text" value={taxCode} onChange={e => setTaxCode(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Codice Fiscale</label></div>
                            </div>
                        ) : (
                            <>
                                <div className="md-input-group"><input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="md-input" placeholder=" "/><label className="md-input-label">Ragione Sociale</label></div>
                                <div className="md-input-group"><input type="text" value={vatNumber} onChange={e => setVatNumber(e.target.value)} required className="md-input" placeholder=" "/><label className="md-input-label">P.IVA / C.F.</label></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="md-input-group"><input type="number" value={numberOfChildren} onChange={e => setNumberOfChildren(Number(e.target.value))} className="md-input" placeholder=" "/><label className="md-input-label">N. Bambini</label></div>
                                    <div className="md-input-group"><input type="text" value={ageRange} onChange={e => setAgeRange(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Fascia Età</label></div>
                                </div>
                            </>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="md-input-group"><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Email</label></div>
                            <div className="md-input-group"><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Telefono</label></div>
                        </div>
                        <div className="md-input-group"><input type="text" value={address} onChange={e => setAddress(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Indirizzo</label></div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="md-input-group"><input type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">CAP</label></div>
                            <div className="col-span-2 md-input-group"><input type="text" value={city} onChange={e => setCity(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Città</label></div>
                        </div>
                        <div className="md-input-group"><input type="text" value={province} onChange={e => setProvince(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Provincia</label></div>
                    </>
                )}

                {activeTab === 'children' && clientType === ClientType.Parent && (
                    <div className="space-y-4">
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">Aggiungi Figlio</h4>
                            <div className="flex gap-2">
                                <input type="text" placeholder="Nome" value={newChildName} onChange={e => setNewChildName(e.target.value)} className="md-input flex-1 text-sm" />
                                <input type="text" placeholder="Età" value={newChildAge} onChange={e => setNewChildAge(e.target.value)} className="md-input w-20 text-sm" />
                                <button type="button" onClick={handleAddChild} className="md-btn md-btn-raised md-btn-green px-3"><PlusIcon/></button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {children.map((child, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                                    <div>
                                        <p className="font-bold text-gray-800">{child.name}</p>
                                        <p className="text-xs text-gray-500">{child.age}</p>
                                    </div>
                                    <button type="button" onClick={() => handleRemoveChild(idx)} className="text-red-400 hover:text-red-600"><TrashIcon/></button>
                                </div>
                            ))}
                            {children.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Nessun figlio aggiunto.</p>}
                        </div>
                    </div>
                )}

                {activeTab === 'rating' && (
                    <div className="space-y-6">
                        {/* Parent Specific Ratings */}
                        {clientType === ClientType.Parent && (
                            <>
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                    <h4 className="font-bold text-blue-800 mb-3 text-sm uppercase">Valutazione Genitore</h4>
                                    <RatingRow label="Disponibilità" value={parentRating.availability} onChange={v => setParentRating(p => ({...p, availability: v}))} />
                                    <RatingRow label="Atteggiamento (Lamentele)" value={parentRating.complaints} onChange={v => setParentRating(p => ({...p, complaints: v}))} />
                                    <RatingRow label="Fedeltà (Churn)" value={parentRating.churnRate} onChange={v => setParentRating(p => ({...p, churnRate: v}))} />
                                    <RatingRow label="Vicinanza Sede" value={parentRating.distance} onChange={v => setParentRating(p => ({...p, distance: v}))} />
                                </div>

                                {children.map((child, idx) => (
                                    <div key={child.id} className="bg-green-50 p-4 rounded-lg border border-green-100">
                                        <h4 className="font-bold text-green-800 mb-3 text-sm uppercase">Valutazione: {child.name}</h4>
                                        <RatingRow label="Apprendimento" value={child.rating?.learning || 0} onChange={v => handleChildRatingChange(idx, 'learning', v)} />
                                        <RatingRow label="Condotta" value={child.rating?.behavior || 0} onChange={v => handleChildRatingChange(idx, 'behavior', v)} />
                                        <RatingRow label="Frequenza" value={child.rating?.attendance || 0} onChange={v => handleChildRatingChange(idx, 'attendance', v)} />
                                        <RatingRow label="Igiene/Salute" value={child.rating?.hygiene || 0} onChange={v => handleChildRatingChange(idx, 'hygiene', v)} />
                                    </div>
                                ))}
                                <RatingLegend />
                            </>
                        )}

                        <NotesManager notesHistory={notesHistory} onSave={setNotesHistory} label={`Note ${clientType === ClientType.Parent ? 'Famiglia' : 'Ente'}`} />
                    </div>
                )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva</button>
            </div>
        </form>
    );
};

const Clients: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showTrash, setShowTrash] = useState(false);
    const [sortOrder, setSortOrder] = useState<'name_asc' | 'name_desc' | 'surname_asc' | 'surname_desc'>('surname_asc');
    const [nameFormat, setNameFormat] = useState<'first_last' | 'last_first'>('first_last');
    
    // Extra Filters
    const [filterDay, setFilterDay] = useState<string>('');
    const [filterTime, setFilterTime] = useState<string>('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    
    const [clientToProcess, setClientToProcess] = useState<{id: string, action: 'delete' | 'restore' | 'permanent'} | null>(null);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);

    const fetchClientsData = useCallback(async () => {
        setLoading(true);
        try {
            const [clientsData, enrollmentsData] = await Promise.all([
                getClients(),
                getAllEnrollments()
            ]);
            setClients(clientsData);
            setEnrollments(enrollmentsData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchClientsData(); }, [fetchClientsData]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, showTrash, filterDay, filterTime]);

    const handleOpenModal = (client: Client | null = null) => {
        setEditingClient(client);
        setIsModalOpen(true);
    };

    const handleSaveClient = async (data: ClientInput | Client) => {
        try {
            if ('id' in data) {
                await updateClient(data.id, data);
            } else {
                await addClient(data as ClientInput);
            }
            setIsModalOpen(false);
            fetchClientsData();
        } catch (err) {
            console.error(err);
            alert("Errore durante il salvataggio.");
        }
    };

    const handleActionClick = (id: string, action: 'delete' | 'restore' | 'permanent') => {
        setClientToProcess({ id, action });
    };

    const handleConfirmAction = async () => {
        if (!clientToProcess) return;
        try {
            if (clientToProcess.action === 'delete') {
                // Cascading delete simulation for single client
                const clientId = clientToProcess.id;
                await deleteClient(clientId);
            }
            else if (clientToProcess.action === 'restore') await restoreClient(clientToProcess.id);
            else {
                // Hard Delete: Clean everything
                const clientId = clientToProcess.id;
                // 1. Get Enrollments
                const clientEnrollments = await getEnrollmentsForClient(clientId);
                for (const enr of clientEnrollments) {
                    await cleanupEnrollmentFinancials(enr);
                    await deleteEnrollment(enr.id);
                    // Check auto-rent
                    if (enr.locationId && enr.locationId !== 'unassigned') {
                        // Quick check (locally is faster but less accurate, here we iterate all)
                        await deleteAutoRentTransactions(enr.locationId);
                    }
                }
                // 2. Delete Client
                await permanentDeleteClient(clientId);
            }
            fetchClientsData();
        } catch (err) {
            console.error(err);
        } finally {
            setClientToProcess(null);
        }
    };

    const handleConfirmDeleteAll = async () => {
        setIsDeleteAllModalOpen(false);
        setLoading(true);
        try {
            // Fetch ALL clients (even deleted ones if we want a total nuke, but getClients returns active/soft-deleted)
            const allClients = await getClients();
            
            for (const client of allClients) {
                // Cascading delete for each client
                const clientEnrollments = await getEnrollmentsForClient(client.id);
                for (const enr of clientEnrollments) {
                    await cleanupEnrollmentFinancials(enr);
                    await deleteEnrollment(enr.id);
                    if (enr.locationId && enr.locationId !== 'unassigned') {
                        await deleteAutoRentTransactions(enr.locationId);
                    }
                }
                await permanentDeleteClient(client.id);
            }
            await fetchClientsData();
            alert("Tutti i clienti e i dati correlati sono stati eliminati.");
        } catch (err) {
            console.error("Error deleting all:", err);
            alert("Errore durante l'eliminazione totale.");
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (file: File) => {
        const result = await importClientsFromExcel(file);
        fetchClientsData();
        return result;
    };

    const filteredClients = useMemo(() => {
        let result = clients.filter(c => showTrash ? c.isDeleted : !c.isDeleted);

        result = result.filter(c => {
            const term = (searchTerm || '').toLowerCase();
            
            // 1. Base Search with Safe Checks
            let match = false;
            if (c.clientType === ClientType.Parent) {
                const p = c as ParentClient;
                match = (p.firstName || '').toLowerCase().includes(term) || 
                        (p.lastName || '').toLowerCase().includes(term) || 
                        (p.email || '').toLowerCase().includes(term) ||
                        (p.children || []).some(child => (child.name || '').toLowerCase().includes(term));
            } else {
                const i = c as InstitutionalClient;
                match = (i.companyName || '').toLowerCase().includes(term) || (i.email || '').toLowerCase().includes(term);
            }

            // 2. Search in Enrollments (Location Name, Supplier)
            if (!match && term.length > 0) {
                const clientEnrollments = enrollments.filter(e => e.clientId === c.id);
                match = clientEnrollments.some(e => 
                    (e.locationName || '').toLowerCase().includes(term) ||
                    (e.supplierName || '').toLowerCase().includes(term)
                );
            }

            if (!match) return false;

            // 3. Filter by Day / Time (Cross-check with enrollments)
            if (filterDay !== '' || filterTime !== '') {
                const clientEnrollments = enrollments.filter(e => e.clientId === c.id && (e.status === EnrollmentStatus.Active || e.status === EnrollmentStatus.Pending));
                
                const hasLesson = clientEnrollments.some(enr => {
                    if (!enr.appointments) return false;
                    return enr.appointments.some(app => {
                        const appDate = new Date(app.date);
                        const dayMatch = filterDay === '' || appDate.getDay() === parseInt(filterDay);
                        // Time check: filterTime should be between start and end
                        const timeMatch = filterTime === '' || (filterTime >= app.startTime && filterTime <= app.endTime);
                        return dayMatch && timeMatch;
                    });
                });

                if (!hasLesson) return false;
            }

            return true;
        });

        result.sort((a, b) => {
            let nameA = '', surnameA = '';
            let nameB = '', surnameB = '';

            if (a.clientType === ClientType.Parent) {
                nameA = (a as ParentClient).firstName || '';
                surnameA = (a as ParentClient).lastName || '';
            } else {
                nameA = (a as InstitutionalClient).companyName || '';
                surnameA = (a as InstitutionalClient).companyName || ''; // Fallback
            }

            if (b.clientType === ClientType.Parent) {
                nameB = (b as ParentClient).firstName || '';
                surnameB = (b as ParentClient).lastName || '';
            } else {
                nameB = (b as InstitutionalClient).companyName || '';
                surnameB = (b as InstitutionalClient).companyName || '';
            }

            switch (sortOrder) {
                case 'surname_asc': return surnameA.localeCompare(surnameB);
                case 'surname_desc': return surnameB.localeCompare(surnameA);
                case 'name_asc': return nameA.localeCompare(nameB);
                case 'name_desc': return nameB.localeCompare(nameA);
                default: return 0;
            }
        });

        return result;
    }, [clients, enrollments, showTrash, searchTerm, sortOrder, filterDay, filterTime]);

    // Paginated Data
    const paginatedClients = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredClients.slice(start, start + itemsPerPage);
    }, [filteredClients, currentPage]);

    // Helper to extract location colors for a client
    const getClientLocationColors = (clientId: string) => {
        const activeEnrollments = enrollments.filter(e => e.clientId === clientId && e.status === EnrollmentStatus.Active);
        const colors = new Set<string>();
        activeEnrollments.forEach(e => {
            if (e.locationColor) colors.add(e.locationColor);
        });
        return Array.from(colors);
    };

    return (
        <div>
            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Clienti</h1>
                    <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Gestisci anagrafica, valutazioni e figli.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsDeleteAllModalOpen(true)} className="md-btn md-btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center text-xs font-bold mr-2"><TrashIcon /> Elimina Tutto</button>
                    <button onClick={() => setIsImportModalOpen(true)} className="md-btn md-btn-flat"><UploadIcon /> <span className="ml-2 hidden sm:inline">Importa</span></button>
                    <button onClick={() => setShowTrash(!showTrash)} className={`md-btn ${showTrash ? 'bg-gray-200' : 'md-btn-flat'}`}><TrashIcon /> <span className="ml-2 hidden sm:inline">{showTrash ? 'Attivi' : 'Cestino'}</span></button>
                    {!showTrash && <button onClick={() => handleOpenModal()} className="md-btn md-btn-raised md-btn-green"><PlusIcon /> <span className="ml-2">Nuovo</span></button>}
                </div>
            </div>

            <div className="mb-6 bg-gray-50 p-3 rounded-lg border border-gray-200 flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                    <input type="text" placeholder="Cerca Cliente, Figlio, Sede..." className="block w-full bg-white border rounded-md py-2 pl-10 pr-3 text-sm focus:ring-1 focus:ring-indigo-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                {/* FIX MOBILE: Added flex-wrap to prevent shrinking inputs on small screens */}
                <div className="flex gap-2 w-full lg:w-auto flex-wrap">
                    <select 
                        value={filterDay}
                        onChange={(e) => setFilterDay(e.target.value)}
                        className="flex-1 lg:w-32 block bg-white border rounded-md py-2 px-3 text-sm min-w-[100px]"
                    >
                        <option value="">Giorno...</option>
                        {daysOfWeekMap.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                    <input 
                        type="time" 
                        value={filterTime}
                        onChange={(e) => setFilterTime(e.target.value)}
                        className="flex-1 lg:w-28 block bg-white border rounded-md py-2 px-2 text-sm min-w-[80px]"
                    />
                    <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} className="flex-1 lg:w-40 block bg-white border rounded-md py-2 px-3 text-sm min-w-[130px]">
                        <option value="surname_asc">Cognome (A-Z)</option>
                        <option value="surname_desc">Cognome (Z-A)</option>
                        <option value="name_asc">Nome (A-Z)</option>
                        <option value="name_desc">Nome (Z-A)</option>
                    </select>
                    
                    <button 
                        onClick={() => setNameFormat(prev => prev === 'first_last' ? 'last_first' : 'first_last')}
                        className="flex-1 lg:w-auto bg-white border border-gray-300 rounded-md py-2 px-3 text-sm text-gray-700 hover:bg-gray-50 font-medium whitespace-nowrap shadow-sm min-w-[130px]"
                        title="Cambia formato visualizzazione nome"
                    >
                        {nameFormat === 'first_last' ? 'Nome Cognome' : 'Cognome Nome'}
                    </button>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedClients.map(client => {
                        const isParent = client.clientType === ClientType.Parent;
                        const parentClient = client as ParentClient;
                        const instClient = client as InstitutionalClient;
                        
                        // Safe Checks for Display Name
                        const displayName = isParent 
                            ? (nameFormat === 'first_last' 
                                ? `${parentClient.firstName || ''} ${parentClient.lastName || ''}` 
                                : `${parentClient.lastName || ''} ${parentClient.firstName || ''}`)
                            : instClient.companyName || 'Senza Nome';
                            
                        const parentRatingAvg = isParent ? getParentRating(parentClient.rating) : 0;
                        
                        const locationColors = getClientLocationColors(client.id);

                        return (
                            <div key={client.id} className={`md-card flex flex-col cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden ${showTrash ? 'opacity-75' : ''}`} onClick={() => !showTrash && handleOpenModal(client)}>
                                {/* Left Color Tab */}
                                <div className="absolute left-0 top-0 bottom-0 w-2 flex flex-col">
                                    {locationColors.length > 0 ? (
                                        locationColors.map((color, i) => (
                                            <div key={i} style={{ backgroundColor: color }} className="flex-1" title="Sede Attiva"></div>
                                        ))
                                    ) : (
                                        <div className="flex-1 bg-gray-200"></div>
                                    )}
                                </div>

                                <div className="p-5 pl-6 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-lg font-bold text-gray-800 truncate pr-2 flex-1" title={displayName}>{displayName}</h3>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`text-[10px] uppercase px-2 py-1 rounded font-bold ${isParent ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                                {isParent ? 'Genitore' : 'Ente'}
                                            </span>
                                            {isParent && Number(parentRatingAvg) > 0 && (
                                                <span className="text-[9px] font-bold bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200 flex items-center">
                                                    {parentRatingAvg} <StarIcon filled={true} className="w-2.5 h-2.5 ml-0.5" />
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {isParent && parentClient.children && parentClient.children.length > 0 && (
                                        <div className="mb-3">
                                            <p className="text-xs text-gray-500 mb-1"><strong>Figli:</strong></p>
                                            <div className="flex flex-wrap gap-2">
                                                {parentClient.children.map(child => {
                                                    const cAvg = getChildRating(child);
                                                    return (
                                                        <span key={child.id} className="text-xs bg-gray-50 text-gray-700 px-2 py-1 rounded border border-gray-100 flex items-center shadow-sm">
                                                            {child.name || 'Senza nome'}
                                                            {Number(cAvg) > 0 && (
                                                                <span className="ml-1.5 text-[9px] font-bold text-yellow-600 bg-yellow-50 px-1 rounded border border-yellow-100 flex items-center">
                                                                    {cAvg} <StarIcon filled={true} className="w-2 h-2 ml-0.5" />
                                                                </span>
                                                            )}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="text-sm text-gray-600 space-y-1 mt-auto">
                                        <p className="truncate">📧 {client.email}</p>
                                        <p className="truncate">📞 {client.phone}</p>
                                    </div>
                                </div>

                                <div className="px-5 py-3 border-t border-gray-100 flex justify-end space-x-2 bg-gray-50/50 ml-2">
                                    {showTrash ? (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); handleActionClick(client.id, 'restore'); }} className="md-icon-btn text-green-600 hover:bg-green-50" title="Ripristina"><RestoreIcon /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleActionClick(client.id, 'permanent'); }} className="md-icon-btn text-red-600 hover:bg-red-50" title="Elimina Definitivamente"><TrashIcon /></button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenModal(client); }} className="md-icon-btn edit" aria-label={`Modifica ${displayName}`}><PencilIcon /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleActionClick(client.id, 'delete'); }} className="md-icon-btn delete" aria-label={`Elimina ${displayName}`}><TrashIcon /></button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {filteredClients.length === 0 && <div className="col-span-full text-center py-12 text-gray-500">Nessun cliente trovato.</div>}
                </div>
                
                <Pagination 
                    currentPage={currentPage} 
                    totalItems={filteredClients.length} 
                    itemsPerPage={itemsPerPage} 
                    onPageChange={setCurrentPage} 
                />
                </>
            )}

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)} size="2xl">
                    <ClientForm client={editingClient} onSave={handleSaveClient} onCancel={() => setIsModalOpen(false)} />
                </Modal>
            )}

            {isImportModalOpen && (
                <ImportModal 
                    entityName="Clienti"
                    templateHeaders={['email', 'type', 'firstName', 'lastName', 'taxCode', 'companyName', 'vatNumber', 'phone', 'address', 'zipCode', 'city', 'province']}
                    instructions={[
                        'type: "parent" o "institutional"',
                        'Per parent: compilare firstName, lastName, taxCode',
                        'Per institutional: compilare companyName, vatNumber'
                    ]}
                    onClose={() => setIsImportModalOpen(false)}
                    onImport={handleImport}
                />
            )}

            <ConfirmModal 
                isOpen={!!clientToProcess}
                onClose={() => setClientToProcess(null)}
                onConfirm={handleConfirmAction}
                title={clientToProcess?.action === 'restore' ? "Ripristina" : "Elimina"}
                message={clientToProcess?.action === 'restore' ? "Vuoi ripristinare questo cliente?" : "Sei sicuro di voler eliminare questo cliente? L'eliminazione definitiva cancellerà anche tutte le iscrizioni, lezioni e dati finanziari collegati."}
                isDangerous={clientToProcess?.action !== 'restore'}
            />

            <ConfirmModal 
                isOpen={isDeleteAllModalOpen}
                onClose={() => setIsDeleteAllModalOpen(false)}
                onConfirm={handleConfirmDeleteAll}
                title="ELIMINA TUTTI I CLIENTI"
                message="⚠️ ATTENZIONE: Stai per eliminare TUTTI i clienti dal database. Questa azione eliminerà a cascata anche tutte le Iscrizioni, Lezioni, Transazioni e Fatture collegate. Questa operazione è irreversibile. Confermi?"
                isDangerous={true}
                confirmText="Sì, Elimina TUTTO"
            />
        </div>
    );
};

export default Clients;
