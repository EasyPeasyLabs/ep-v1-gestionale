
import React, { useState, useEffect, useCallback } from 'react';
import { Homework, HomeworkInput, Client, Supplier, ClientType, ParentClient, EnrollmentStatus, Location } from '../types';
import { getHomeworks, addHomework, updateHomework, deleteHomework } from '../services/homeworkService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getAllEnrollments } from '../services/enrollmentService';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import SearchIcon from '../components/icons/SearchIcon';
import Pagination from '../components/Pagination';

// --- Icona Send (Aeroplanino) ---
const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);

// --- Componente Form CRUD Compito ---
const HomeworkForm: React.FC<{
    homework?: Homework | null;
    suppliers: Supplier[]; // Per abbinamento recinto (opzionale)
    onSave: (data: HomeworkInput | Homework) => void;
    onCancel: () => void;
}> = ({ homework, suppliers, onSave, onCancel }) => {
    const [title, setTitle] = useState(homework?.title || '');
    const [description, setDescription] = useState(homework?.description || '');
    const [type, setType] = useState<'textbook' | 'link'>(homework?.type || 'textbook');
    
    // Textbook
    const [textbookName, setTextbookName] = useState(homework?.textbookName || '');
    const [pageNumber, setPageNumber] = useState(homework?.pageNumber || '');
    const [exercises, setExercises] = useState(homework?.exercises || '');
    
    // Link
    const [linkUrl, setLinkUrl] = useState(homework?.linkUrl || '');
    
    // Outcome
    const [expectedOutcome, setExpectedOutcome] = useState(homework?.expectedOutcome || '');

    // Assignment (Opzionale)
    const [assignedDate, setAssignedDate] = useState(homework?.assignedDate || '');
    const [assignedLocationId, setAssignedLocationId] = useState(homework?.assignedLocationId || '');

    const allLocations = React.useMemo(() => {
        const locs: {id: string, name: string}[] = [];
        suppliers.forEach(s => s.locations.forEach(l => locs.push({id: l.id, name: l.name})));
        return locs.sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Trova nome location
        const locName = assignedLocationId ? allLocations.find(l => l.id === assignedLocationId)?.name : '';

        const data: HomeworkInput = {
            title, description, type,
            textbookName, pageNumber, exercises,
            linkUrl, expectedOutcome,
            assignedDate, assignedLocationId, assignedLocationName: locName,
            createdAt: homework?.createdAt || new Date().toISOString()
        };

        if(homework?.id) onSave({ ...data, id: homework.id });
        else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[90vh]">
            <div className="p-6 border-b flex-shrink-0">
                <h3 className="text-xl font-bold">{homework ? 'Modifica Compiti' : 'Crea Lista Compiti'}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                
                {/* 1. Intestazione */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase">1. Intestazione</h4>
                    <div className="md-input-group">
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="md-input" placeholder=" " />
                        <label className="md-input-label">Titolo (es. Unit 3 Review)</label>
                    </div>
                    <div className="md-input-group">
                        <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="md-input" placeholder="Breve descrizione..." />
                    </div>
                </div>

                {/* 2. Corpo */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase">2. Contenuto</h4>
                    
                    <div className="flex gap-4 mb-4">
                        <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition-colors ${type === 'textbook' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white text-gray-600'}`}>
                            <input type="radio" name="type" value="textbook" checked={type === 'textbook'} onChange={() => setType('textbook')} className="hidden" />
                            📖 Manuale
                        </label>
                        <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition-colors ${type === 'link' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white text-gray-600'}`}>
                            <input type="radio" name="type" value="link" checked={type === 'link'} onChange={() => setType('link')} className="hidden" />
                            🔗 Link Multimediale
                        </label>
                    </div>

                    {type === 'textbook' ? (
                        <div className="space-y-3 animate-fade-in">
                            <div className="md-input-group">
                                <input type="text" value={textbookName} onChange={e => setTextbookName(e.target.value)} className="md-input" placeholder=" " />
                                <label className="md-input-label">Nome Manuale (Opzionale)</label>
                            </div>
                            <div className="flex gap-4">
                                <div className="md-input-group w-24">
                                    <input type="text" value={pageNumber} onChange={e => setPageNumber(e.target.value)} required className="md-input" placeholder=" " />
                                    <label className="md-input-label">Pagina</label>
                                </div>
                                <div className="md-input-group flex-1">
                                    <input type="text" value={exercises} onChange={e => setExercises(e.target.value)} required className="md-input" placeholder=" " />
                                    <label className="md-input-label">Esercizi (Num. e Titolo)</label>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="md-input-group animate-fade-in">
                            <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} required className="md-input" placeholder=" " />
                            <label className="md-input-label">Link (es. YouTube URL)</label>
                        </div>
                    )}
                </div>

                {/* 3. Risultato & Abbinamento */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase">3. Obiettivi & Assegnazione</h4>
                    <div className="md-input-group">
                        <textarea rows={2} value={expectedOutcome} onChange={e => setExpectedOutcome(e.target.value)} required className="md-input" placeholder="Cosa impareranno?" />
                        <label className="text-xs text-gray-500 mt-1 block">Risultato atteso / Scopo</label>
                    </div>
                    
                    <div className="pt-2 border-t border-gray-200 mt-2">
                        <p className="text-xs text-gray-400 mb-2 italic">Opzionale: Abbina a una lezione specifica</p>
                        <div className="flex gap-3">
                            <input type="date" value={assignedDate} onChange={e => setAssignedDate(e.target.value)} className="text-sm border rounded p-2 bg-white" />
                            <select value={assignedLocationId} onChange={e => setAssignedLocationId(e.target.value)} className="text-sm border rounded p-2 bg-white flex-1">
                                <option value="">Nessun Recinto</option>
                                {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 flex-shrink-0">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-primary">Salva Compiti</button>
            </div>
        </form>
    );
};

// --- Modale Invio WhatsApp ---
const SendHomeworkModal: React.FC<{
    homework: Homework;
    clients: Client[];
    suppliers: Supplier[];
    onClose: () => void;
}> = ({ homework, clients, suppliers, onClose }) => {
    const [sendMode, setSendMode] = useState<'location' | 'manual'>('location');
    const [selectedLocationId, setSelectedLocationId] = useState<string>(homework.assignedLocationId || '');
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const [filterName, setFilterName] = useState('');

    // Prepara lista clients attivi
    const activeEnrollmentsClients = React.useMemo(() => {
        // Qui dovremmo avere gli enrollments per filtrare davvero per Location. 
        // Per semplicità UI, simuliamo la selezione del "Recinto" filtrando poi lato logica (o qui se passassimo enrollments).
        // Il prompt dice "interi gruppi di contatti Clienti (definiti per 'recinto')".
        // Assumiamo che il filtro avvenga quando recuperiamo gli enrollments attivi nel parent component o qui.
        // Dato che non abbiamo enrollments qui dentro, dobbiamo fare un fetch o passarli.
        // Soluzione: Recuperiamo Enrollments al mount.
        return clients.filter(c => c.clientType === ClientType.Parent);
    }, [clients]);

    // Fetch enrollments inside modal just to filter clients by location
    const [locationClients, setLocationClients] = useState<string[]>([]); // Client IDs in location
    useEffect(() => {
        if (sendMode === 'location' && selectedLocationId) {
            getAllEnrollments().then(enrs => {
                const ids = enrs
                    .filter(e => e.status === EnrollmentStatus.Active && e.locationId === selectedLocationId)
                    .map(e => e.clientId);
                setLocationClients([...new Set(ids)]);
            });
        } else {
            setLocationClients([]);
        }
    }, [sendMode, selectedLocationId]);

    const allLocations = React.useMemo(() => {
        const locs: {id: string, name: string}[] = [];
        suppliers.forEach(s => s.locations.forEach(l => locs.push({id: l.id, name: l.name})));
        return locs.sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const handleSend = () => {
        let targetPhones: string[] = [];

        if (sendMode === 'location') {
            if (!selectedLocationId) return alert("Seleziona un recinto.");
            if (locationClients.length === 0) return alert("Nessun cliente attivo in questo recinto.");
            
            targetPhones = clients
                .filter(c => locationClients.includes(c.id) && c.phone)
                .map(c => c.phone);
        } else {
            if (selectedClientIds.length === 0) return alert("Seleziona almeno un cliente.");
            targetPhones = clients
                .filter(c => selectedClientIds.includes(c.id) && c.phone)
                .map(c => c.phone);
        }

        if (targetPhones.length === 0) return alert("Nessun numero di telefono valido trovato.");

        // Costruzione Messaggio
        let body = `*Compiti per la settimana*\n\n`;
        body += `📌 *${homework.title}*\n`;
        if(homework.description) body += `_${homework.description}_\n`;
        body += `\n`;
        
        if (homework.type === 'textbook') {
            if(homework.textbookName) body += `📚 Manuale: ${homework.textbookName}\n`;
            if(homework.pageNumber) body += `📄 Pagina: ${homework.pageNumber}\n`;
            if(homework.exercises) body += `✏️ Esercizi: ${homework.exercises}\n`;
        } else {
            body += `🔗 Link: ${homework.linkUrl}\n`;
        }
        
        if(homework.expectedOutcome) body += `\n🎯 Obiettivo: ${homework.expectedOutcome}`;

        const encodedMsg = encodeURIComponent(body);

        // Invio Multiplo (Apertura Tab)
        let sentCount = 0;
        targetPhones.forEach(phone => {
            let cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.substring(2);
            if (cleanPhone.length === 10) cleanPhone = '39' + cleanPhone;
            
            if (cleanPhone) {
                window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
                sentCount++;
            }
        });

        alert(`Apertura di ${sentCount} chat WhatsApp avviata.`);
        onClose();
    };

    return (
        <Modal onClose={onClose} size="lg">
            <div className="flex flex-col h-[80vh]">
                <div className="p-6 border-b bg-green-50">
                    <h3 className="text-xl font-bold text-green-900">Invia Compiti su WhatsApp</h3>
                    <p className="text-sm text-green-700 mt-1">Titolo: <strong>{homework.title}</strong></p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Mode Selection */}
                    <div className="flex gap-4">
                        <label className={`flex-1 p-3 border rounded cursor-pointer ${sendMode === 'location' ? 'bg-indigo-50 border-indigo-500 font-bold text-indigo-700' : 'bg-white'}`}>
                            <input type="radio" name="mode" checked={sendMode === 'location'} onChange={() => setSendMode('location')} className="hidden"/>
                            🏢 Per Recinto (Gruppo)
                        </label>
                        <label className={`flex-1 p-3 border rounded cursor-pointer ${sendMode === 'manual' ? 'bg-indigo-50 border-indigo-500 font-bold text-indigo-700' : 'bg-white'}`}>
                            <input type="radio" name="mode" checked={sendMode === 'manual'} onChange={() => setSendMode('manual')} className="hidden"/>
                            👤 Selezione Manuale
                        </label>
                    </div>

                    {sendMode === 'location' ? (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Seleziona Recinto</label>
                            <select value={selectedLocationId} onChange={e => setSelectedLocationId(e.target.value)} className="md-input">
                                <option value="">Seleziona...</option>
                                {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                            {selectedLocationId && (
                                <p className="text-sm text-gray-500 mt-2">
                                    Clienti attivi trovati: <strong>{locationClients.length}</strong>
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col h-64 border rounded">
                            <input 
                                type="text" 
                                placeholder="Cerca cliente..." 
                                className="p-2 border-b text-sm"
                                value={filterName}
                                onChange={e => setFilterName(e.target.value)}
                            />
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {activeEnrollmentsClients
                                    .filter(c => `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}`.toLowerCase().includes(filterName.toLowerCase()))
                                    .map(c => (
                                        <label key={c.id} className="flex items-center gap-2 p-1 hover:bg-gray-50">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedClientIds.includes(c.id)}
                                                onChange={() => {
                                                    setSelectedClientIds(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])
                                                }}
                                            />
                                            <span className="text-sm">{(c as ParentClient).firstName} {(c as ParentClient).lastName}</span>
                                        </label>
                                    ))
                                }
                            </div>
                            <div className="p-2 border-t bg-gray-50 text-xs text-right">
                                Selezionati: {selectedClientIds.length}
                            </div>
                        </div>
                    )}

                    {/* Preview Message */}
                    <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs text-gray-600 whitespace-pre-wrap">
                        <strong>ANTEMPRIMA MESSAGGIO:</strong><br/><br/>
                        *Compiti per la settimana*<br/><br/>
                        📌 *{homework.title}*<br/>
                        _{homework.description || ''}_<br/><br/>
                        {homework.type === 'textbook' ? (
                            <>
                            📚 Manuale: {homework.textbookName || 'N/D'}<br/>
                            📄 Pagina: {homework.pageNumber}<br/>
                            ✏️ Esercizi: {homework.exercises}<br/>
                            </>
                        ) : (
                            <>🔗 Link: {homework.linkUrl}</>
                        )}
                        <br/>
                        🎯 Obiettivo: {homework.expectedOutcome}
                    </div>
                </div>

                <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                    <button onClick={onClose} className="md-btn md-btn-flat">Annulla</button>
                    <button onClick={handleSend} className="md-btn md-btn-raised md-btn-green">Invia WhatsApp</button>
                </div>
            </div>
        </Modal>
    );
};


const Homeworks: React.FC = () => {
    const [homeworks, setHomeworks] = useState<Homework[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    
    const [sendModalHomework, setSendModalHomework] = useState<Homework | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [hwData, supData, cliData] = await Promise.all([
                getHomeworks(),
                getSuppliers(),
                getClients()
            ]);
            setHomeworks(hwData);
            setSuppliers(supData);
            setClients(cliData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (data: HomeworkInput | Homework) => {
        try {
            if ('id' in data) await updateHomework(data.id, data);
            else await addHomework(data as HomeworkInput);
            setIsModalOpen(false);
            fetchData();
        } catch (e) { alert("Errore salvataggio"); }
    };

    const handleDelete = async () => {
        if(deleteId) {
            await deleteHomework(deleteId);
            setDeleteId(null);
            fetchData();
        }
    };

    // Filter & Pagination
    const filteredItems = React.useMemo(() => {
        return homeworks.filter(h => h.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [homeworks, searchTerm]);

    const paginatedItems = React.useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredItems.slice(start, start + itemsPerPage);
    }, [filteredItems, currentPage]);

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Compiti</h1>
                    <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Gestione e invio compiti a casa.</p>
                </div>
                <button onClick={() => { setEditingHomework(null); setIsModalOpen(true); }} className="md-btn md-btn-raised md-btn-green flex items-center">
                    <PlusIcon /><span className="ml-2">Nuova Lista</span>
                </button>
            </div>

            <div className="mb-6 bg-white p-3 rounded-lg border border-gray-200">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                    <input 
                        type="text" 
                        placeholder="Cerca lista compiti..." 
                        className="block w-full bg-gray-50 border border-gray-300 rounded-md py-2 pl-10 pr-3 text-sm focus:ring-1 focus:ring-indigo-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <div className="space-y-6">
                    {paginatedItems.map(hw => (
                        <div key={hw.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row gap-4 hover:shadow-md transition-shadow">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${hw.type === 'textbook' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                        {hw.type === 'textbook' ? 'Manuale' : 'Multimedia'}
                                    </span>
                                    {hw.assignedDate && (
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                                            📅 {new Date(hw.assignedDate).toLocaleDateString()} {hw.assignedLocationName ? `• ${hw.assignedLocationName}` : ''}
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-gray-800">{hw.title}</h3>
                                <p className="text-sm text-gray-500 mb-3">{hw.description}</p>
                                
                                <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {hw.type === 'textbook' ? (
                                        <div>
                                            <p><span className="font-bold text-xs text-gray-400 uppercase">Manuale:</span> {hw.textbookName || '-'}</p>
                                            <p><span className="font-bold text-xs text-gray-400 uppercase">Pagina:</span> {hw.pageNumber}</p>
                                            <p><span className="font-bold text-xs text-gray-400 uppercase">Esercizi:</span> {hw.exercises}</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <span className="font-bold text-xs text-gray-400 uppercase">Link:</span>
                                            <a href={hw.linkUrl} target="_blank" rel="noreferrer" className="block text-indigo-600 truncate hover:underline">{hw.linkUrl}</a>
                                        </div>
                                    )}
                                    <div className="border-t md:border-t-0 md:border-l border-gray-200 pt-2 md:pt-0 md:pl-4">
                                        <span className="font-bold text-xs text-gray-400 uppercase">Obiettivo:</span>
                                        <p className="italic text-gray-600">{hw.expectedOutcome}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex md:flex-col justify-end gap-2 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-4">
                                <button 
                                    onClick={() => setSendModalHomework(hw)}
                                    className="md-btn md-btn-sm bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 flex items-center justify-center gap-1 w-full"
                                >
                                    <SendIcon /> <span className="hidden md:inline">Invia</span>
                                </button>
                                <button onClick={() => { setEditingHomework(hw); setIsModalOpen(true); }} className="md-icon-btn edit bg-gray-50"><PencilIcon /></button>
                                <button onClick={() => setDeleteId(hw.id)} className="md-icon-btn delete bg-gray-50"><TrashIcon /></button>
                            </div>
                        </div>
                    ))}
                    {filteredItems.length === 0 && <p className="text-center text-gray-500 py-10">Nessuna lista compiti trovata.</p>}
                    
                    <Pagination 
                        currentPage={currentPage} 
                        totalItems={filteredItems.length} 
                        itemsPerPage={itemsPerPage} 
                        onPageChange={setCurrentPage} 
                    />
                </div>
            )}

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)} size="lg">
                    <HomeworkForm 
                        homework={editingHomework} 
                        suppliers={suppliers} 
                        onSave={handleSave} 
                        onCancel={() => setIsModalOpen(false)} 
                    />
                </Modal>
            )}

            {sendModalHomework && (
                <SendHomeworkModal 
                    homework={sendModalHomework}
                    clients={clients}
                    suppliers={suppliers}
                    onClose={() => setSendModalHomework(null)}
                />
            )}

            <ConfirmModal 
                isOpen={!!deleteId} 
                onClose={() => setDeleteId(null)} 
                onConfirm={handleDelete}
                title="Elimina Compiti"
                message="Sei sicuro di voler eliminare questa lista? L'operazione è irreversibile."
                isDangerous={true}
            />
        </div>
    );
};

export default Homeworks;
