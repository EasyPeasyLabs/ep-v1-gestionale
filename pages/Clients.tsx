
import React, { useState, useEffect, useCallback } from 'react';
import { Client, ClientInput, ClientType, ParentClient, InstitutionalClient, Child, Enrollment } from '../types';
import { getClients, addClient, updateClient, deleteClient, restoreClient, permanentDeleteClient } from '../services/parentService';
import { getAllEnrollments } from '../services/enrollmentService';
import PlusIcon from '../components/icons/PlusIcon';
import SearchIcon from '../components/icons/SearchIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import RestoreIcon from '../components/icons/RestoreIcon';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';
import UploadIcon from '../components/icons/UploadIcon';
import ImportModal from '../components/ImportModal';
import { importClientsFromExcel } from '../services/importService';

// --- Sub-Components ---

const ClientForm: React.FC<{ 
    client?: Client | null; 
    onSave: (client: ClientInput | Client) => void; 
    onCancel: () => void; 
}> = ({ client, onSave, onCancel }) => {
    const [clientType, setClientType] = useState<ClientType>(client?.clientType || ClientType.Parent);
    
    // Common fields
    const [email, setEmail] = useState(client?.email || '');
    const [phone, setPhone] = useState(client?.phone || '');
    const [address, setAddress] = useState(client?.address || '');
    const [zipCode, setZipCode] = useState(client?.zipCode || '');
    const [city, setCity] = useState(client?.city || '');
    const [province, setProvince] = useState(client?.province || '');

    // Parent fields
    const [firstName, setFirstName] = useState((client as ParentClient)?.firstName || '');
    const [lastName, setLastName] = useState((client as ParentClient)?.lastName || '');
    const [taxCode, setTaxCode] = useState((client as ParentClient)?.taxCode || '');
    const [children, setChildren] = useState<Child[]>((client as ParentClient)?.children || []);
    
    // Child input state
    const [newChildName, setNewChildName] = useState('');
    const [newChildAge, setNewChildAge] = useState('');

    // Institutional fields
    const [companyName, setCompanyName] = useState((client as InstitutionalClient)?.companyName || '');
    const [vatNumber, setVatNumber] = useState((client as InstitutionalClient)?.vatNumber || '');

    const handleAddChild = () => {
        if (newChildName.trim()) {
            const newChild: Child = {
                id: Date.now().toString(), // Temp ID
                name: newChildName,
                age: newChildAge
            };
            setChildren([...children, newChild]);
            setNewChildName('');
            setNewChildAge('');
        }
    };

    const handleRemoveChild = (childId: string) => {
        setChildren(children.filter(c => c.id !== childId));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const commonData = { email, phone, address, zipCode, city, province };
        let clientData: ClientInput;

        if (clientType === ClientType.Parent) {
            clientData = {
                ...commonData,
                clientType: ClientType.Parent,
                firstName,
                lastName,
                taxCode,
                children
            };
        } else {
            clientData = {
                ...commonData,
                clientType: ClientType.Institutional,
                companyName,
                vatNumber,
                numberOfChildren: 0, // Default
                ageRange: '' // Default
            };
        }

        if (client?.id) {
            onSave({ ...clientData, id: client.id });
        } else {
            onSave(clientData);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">{client ? 'Modifica Cliente' : 'Nuovo Cliente'}</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                {!client && (
                    <div className="md-input-group">
                         <select value={clientType} onChange={e => setClientType(e.target.value as ClientType)} className="md-input">
                            <option value={ClientType.Parent}>Genitore (Privato)</option>
                            <option value={ClientType.Institutional}>Istituzionale (Scuola/Ente)</option>
                        </select>
                        <label className="md-input-label !top-0 !text-xs !text-gray-500">Tipo Cliente</label>
                    </div>
                )}

                {clientType === ClientType.Parent ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="md-input-group"><input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="md-input" placeholder=" "/><label className="md-input-label">Nome</label></div>
                            <div className="md-input-group"><input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="md-input" placeholder=" "/><label className="md-input-label">Cognome</label></div>
                        </div>
                        <div className="md-input-group"><input type="text" value={taxCode} onChange={e => setTaxCode(e.target.value)} required className="md-input" placeholder=" "/><label className="md-input-label">Codice Fiscale</label></div>
                    </>
                ) : (
                    <>
                        <div className="md-input-group"><input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="md-input" placeholder=" "/><label className="md-input-label">Ragione Sociale</label></div>
                        <div className="md-input-group"><input type="text" value={vatNumber} onChange={e => setVatNumber(e.target.value)} required className="md-input" placeholder=" "/><label className="md-input-label">P.IVA / Codice Fiscale</label></div>
                    </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="md-input-group"><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="md-input" placeholder=" "/><label className="md-input-label">Email</label></div>
                    <div className="md-input-group"><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="md-input" placeholder=" "/><label className="md-input-label">Telefono</label></div>
                </div>

                <div className="md-input-group"><input type="text" value={address} onChange={e => setAddress(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Indirizzo</label></div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="md-input-group"><input type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">CAP</label></div>
                    <div className="col-span-2 md-input-group"><input type="text" value={city} onChange={e => setCity(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Città</label></div>
                </div>
                <div className="md-input-group"><input type="text" value={province} onChange={e => setProvince(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Provincia</label></div>

                {/* Children Management for Parents */}
                {clientType === ClientType.Parent && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                        <h3 className="text-md font-semibold text-indigo-700 mb-3">Gestione Figli</h3>
                        
                        {/* Add Child Inputs */}
                        <div className="flex items-end gap-2 bg-gray-50 p-3 rounded-md mb-3">
                            <div className="flex-1">
                                <label className="text-xs text-gray-500">Nome Figlio</label>
                                <input 
                                    type="text" 
                                    value={newChildName} 
                                    onChange={e => setNewChildName(e.target.value)}
                                    className="w-full border-b border-gray-300 bg-transparent focus:border-indigo-500 outline-none py-1"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs text-gray-500">Età</label>
                                <input 
                                    type="text" 
                                    value={newChildAge} 
                                    onChange={e => setNewChildAge(e.target.value)}
                                    className="w-full border-b border-gray-300 bg-transparent focus:border-indigo-500 outline-none py-1"
                                />
                            </div>
                            <button 
                                type="button" 
                                onClick={handleAddChild}
                                className="bg-indigo-600 text-white p-1.5 rounded shadow hover:bg-indigo-700 transition-colors"
                                title="Aggiungi Figlio"
                            >
                                <PlusIcon />
                            </button>
                        </div>

                        {/* Children List */}
                        <div className="space-y-2">
                            {children.map(child => (
                                <div key={child.id} className="flex justify-between items-center bg-white border border-gray-200 p-2 rounded shadow-sm">
                                    <div>
                                        <p className="font-medium text-sm">{child.name}</p>
                                        <p className="text-xs text-gray-500">{child.age}</p>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveChild(child.id)}
                                        className="text-red-500 hover:bg-red-50 p-1 rounded"
                                        title="Rimuovi"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            ))}
                            {children.length === 0 && (
                                <p className="text-sm text-gray-400 italic text-center">Nessun figlio registrato.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva Cliente</button>
            </div>
        </form>
    );
};

const ClientDetail: React.FC<{ 
    client: Client; 
    onBack: () => void; 
    onEdit: () => void; 
}> = ({ client, onBack, onEdit }) => {
    return (
        <div className="flex flex-col h-full">
             <div className="flex justify-between items-center mb-6 border-b pb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">Dettaglio Cliente</h2>
                <button onClick={onBack} className="md-btn md-btn-flat text-gray-500">
                    X
                </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="md-card p-6 mb-6 border-l-4 border-indigo-500">
                    <h3 className="text-xl font-bold text-indigo-900 mb-1">
                        {client.clientType === ClientType.Parent 
                            ? `${(client as ParentClient).firstName} ${(client as ParentClient).lastName}`
                            : (client as InstitutionalClient).companyName}
                    </h3>
                    <span className="inline-block bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full mb-4">
                        {client.clientType === ClientType.Parent ? 'Genitore' : 'Istituzionale'}
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div>
                            <p className="text-gray-500 uppercase text-xs">Contatti</p>
                            <p className="font-medium mt-1">{client.email}</p>
                            <p className="font-medium">{client.phone}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 uppercase text-xs">Indirizzo</p>
                            <p className="font-medium mt-1">{client.address}</p>
                            <p className="font-medium">{client.zipCode} {client.city} ({client.province})</p>
                        </div>
                        <div>
                            <p className="text-gray-500 uppercase text-xs">
                                {client.clientType === ClientType.Parent ? 'Codice Fiscale' : 'P.IVA / C.F.'}
                            </p>
                            <p className="font-medium mt-1">
                                {client.clientType === ClientType.Parent 
                                    ? (client as ParentClient).taxCode 
                                    : (client as InstitutionalClient).vatNumber}
                            </p>
                        </div>
                    </div>
                </div>

                {client.clientType === ClientType.Parent && (
                    <div className="md-card p-6">
                        <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">Figli Registrati</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(client as ParentClient).children && (client as ParentClient).children.length > 0 ? (
                                (client as ParentClient).children.map((child) => (
                                    <div key={child.id} className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold mr-3">
                                            {child.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800">{child.name}</p>
                                            <p className="text-xs text-gray-500">{child.age}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400 italic text-sm">Nessun figlio registrato.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 pt-4 border-t flex justify-between flex-shrink-0">
                 <button onClick={onBack} className="md-btn md-btn-flat md-btn-sm">Torna alla lista</button>
                 <button onClick={onEdit} className="md-btn md-btn-raised md-btn-primary md-btn-sm">
                    <PencilIcon /> <span className="ml-2">Modifica</span>
                </button>
            </div>
        </div>
    );
};


const Clients: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]); // Nuovo stato per calcolare i colori
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Trash Mode State
    const [showTrash, setShowTrash] = useState(false);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [viewingClient, setViewingClient] = useState<Client | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    
    // Delete/Restore State
    const [clientToProcess, setClientToProcess] = useState<{id: string, action: 'delete' | 'restore' | 'permanent'} | null>(null);
    
    // Search & Sort State
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'name_asc' | 'name_desc'>('name_asc');

    const fetchClientsData = useCallback(async () => {
        try {
            setLoading(true);
            // Fetch sia clienti che iscrizioni per mappare i colori
            const [clientsData, enrollmentsData] = await Promise.all([
                getClients(),
                getAllEnrollments()
            ]);
            setClients(clientsData);
            setEnrollments(enrollmentsData);
            setError(null);
        } catch (err) {
            setError("Impossibile caricare i clienti.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClientsData();
    }, [fetchClientsData]);

    // Handlers
    const handleOpenModal = (client: Client | null = null) => {
        setEditingClient(client);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingClient(null);
        setIsModalOpen(false);
    };

    const handleViewClient = (client: Client) => {
        setViewingClient(client);
    };

    const handleCloseDetail = () => {
        setViewingClient(null);
    };

    const handleEditFromDetail = () => {
        // Close detail and open modal with the client
        const clientToEdit = viewingClient;
        setViewingClient(null);
        handleOpenModal(clientToEdit);
    };

    const handleSaveClient = async (clientData: ClientInput | Client) => {
        try {
            if ('id' in clientData) {
                const { id, ...dataToUpdate } = clientData;
                await updateClient(id, dataToUpdate);
            } else {
                await addClient(clientData as ClientInput);
            }
            handleCloseModal();
            fetchClientsData();
        } catch (err) {
            console.error("Errore salvataggio cliente:", err);
            alert("Errore durante il salvataggio.");
        }
    };

    const handleActionClick = (e: React.MouseEvent, id: string, action: 'delete' | 'restore' | 'permanent') => {
        e.stopPropagation();
        setClientToProcess({ id, action });
    };

    const handleConfirmAction = async () => {
        if (clientToProcess) {
            try {
                if (clientToProcess.action === 'delete') {
                    await deleteClient(clientToProcess.id);
                } else if (clientToProcess.action === 'restore') {
                    await restoreClient(clientToProcess.id);
                } else if (clientToProcess.action === 'permanent') {
                    await permanentDeleteClient(clientToProcess.id);
                }
                fetchClientsData();
            } catch (err) {
                console.error("Errore operazione cliente:", err);
                alert("Errore durante l'operazione.");
            } finally {
                setClientToProcess(null);
            }
        }
    };

    const handleImport = async (file: File) => {
        const result = await importClientsFromExcel(file);
        fetchClientsData();
        return result;
    };

    // Filter Logic
    const filteredClients = clients.filter(client => {
        // 1. Trash Filter
        const isDeleted = client.isDeleted || false;
        if (showTrash && !isDeleted) return false;
        if (!showTrash && isDeleted) return false;

        // 2. Search Filter
        const term = searchTerm.toLowerCase();
        
        // Common fields
        const matchesCommon = 
            client.email.toLowerCase().includes(term) ||
            client.phone.includes(term) ||
            client.address.toLowerCase().includes(term) ||
            client.city.toLowerCase().includes(term) ||
            client.zipCode.includes(term) ||
            client.province.toLowerCase().includes(term);

        if (matchesCommon) return true;

        if (client.clientType === ClientType.Parent) {
            const p = client as ParentClient;
            return (
                p.firstName.toLowerCase().includes(term) ||
                p.lastName.toLowerCase().includes(term) ||
                p.taxCode.toLowerCase().includes(term) ||
                // Search in children names
                (p.children && p.children.some(c => c.name.toLowerCase().includes(term)))
            );
        } else {
            const i = client as InstitutionalClient;
            return (
                i.companyName.toLowerCase().includes(term) ||
                i.vatNumber.toLowerCase().includes(term)
            );
        }
    });

    // Sorting Logic
    filteredClients.sort((a, b) => {
        const nameA = a.clientType === ClientType.Parent 
            ? `${(a as ParentClient).lastName} ${(a as ParentClient).firstName}` 
            : (a as InstitutionalClient).companyName;
        
        const nameB = b.clientType === ClientType.Parent 
            ? `${(b as ParentClient).lastName} ${(b as ParentClient).firstName}` 
            : (b as InstitutionalClient).companyName;

        if (sortOrder === 'name_asc') {
            return nameA.localeCompare(nameB);
        } else {
            return nameB.localeCompare(nameA);
        }
    });

    // Funzione per calcolare lo stile del bordo dell'avatar
    const getAvatarBorderStyle = (client: Client) => {
        // Solo per genitori con figli
        if (client.clientType !== ClientType.Parent) return {};
        const parent = client as ParentClient;
        if (!parent.children || parent.children.length === 0) return {};

        const colors: string[] = [];
        
        parent.children.forEach(child => {
            // Trova iscrizioni per questo figlio
            const childEnrollments = enrollments.filter(e => e.childId === child.id);
            // Ordina per data (la più recente prima)
            childEnrollments.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
            
            // Prendi il colore dell'ultima iscrizione, se esiste
            if (childEnrollments.length > 0 && childEnrollments[0].locationColor) {
                colors.push(childEnrollments[0].locationColor);
            }
        });

        if (colors.length === 0) return {}; // Nessun colore trovato (default)

        // Se c'è un solo colore, bordo solido. AUMENTATO PADDING A 6PX
        if (colors.length === 1) {
            return { background: colors[0], padding: '6px' }; 
        }

        // Se ci sono più colori, conic-gradient
        const step = 100 / colors.length;
        let gradient = 'conic-gradient(';
        colors.forEach((color, index) => {
            gradient += `${color} ${index * step}% ${(index + 1) * step}%,`;
        });
        gradient = gradient.slice(0, -1) + ')'; // rimuovi ultima virgola

        return { background: gradient, padding: '6px' }; // AUMENTATO PADDING A 6PX
    };

    // Render
    if (viewingClient) {
        return (
            <ClientDetail 
                client={viewingClient} 
                onBack={handleCloseDetail} 
                onEdit={handleEditFromDetail} 
            />
        );
    }

    return (
        <div>
            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Clienti</h1>
                    <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Gestisci l'anagrafica e i figli.</p>
                </div>
                <div className="flex space-x-2">
                    <button onClick={() => setIsImportModalOpen(true)} className="md-btn md-btn-flat">
                        <UploadIcon />
                        <span className="ml-2">Importa</span>
                    </button>
                    <button 
                        onClick={() => setShowTrash(!showTrash)} 
                        className={`md-btn ${showTrash ? 'bg-gray-200 text-gray-800' : 'md-btn-flat'}`}
                        title={showTrash ? "Torna alla lista" : "Visualizza Cestino"}
                    >
                        <TrashIcon />
                        <span className="ml-2">{showTrash ? "Lista Attivi" : "Cestino"}</span>
                    </button>
                    {!showTrash && (
                        <button onClick={() => handleOpenModal()} className="md-btn md-btn-raised md-btn-green">
                            <PlusIcon />
                            <span className="ml-2">Nuovo Cliente</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="mb-6">
                {showTrash && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm flex items-center">
                        <TrashIcon />
                        <span className="ml-2 font-bold">MODALITÀ CESTINO:</span> Stai visualizzando i clienti eliminati. Puoi ripristinarli o eliminarli definitivamente.
                    </div>
                )}
                
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            placeholder="Cerca per nome, cognome, azienda, telefono, indirizzo, città..."
                            className="block w-full bg-white border rounded-md py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{borderColor: 'var(--md-divider)'}}
                        />
                    </div>

                    {/* Sort Control */}
                    <div className="w-full md:w-48">
                        <select 
                            value={sortOrder} 
                            onChange={(e) => setSortOrder(e.target.value as any)} 
                            className="block w-full bg-white border rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
                            style={{borderColor: 'var(--md-divider)'}}
                        >
                            <option value="name_asc">Nome (A-Z)</option>
                            <option value="name_desc">Nome (Z-A)</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? <div className="flex justify-center items-center py-12"><Spinner /></div> :
             error ? <p className="text-center text-red-500 py-8">{error}</p> :
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClients.map(client => (
                    <div 
                        key={client.id} 
                        onClick={() => !showTrash && handleViewClient(client)}
                        className={`md-card p-6 hover:shadow-lg transition-all border-t-4 ${showTrash ? 'border-gray-400 opacity-80' : 'border-transparent hover:border-indigo-500 cursor-pointer'}`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center">
                                {/* Avatar Container with Dynamic Border */}
                                <div 
                                    className="w-12 h-12 rounded-full flex items-center justify-center mr-3 flex-shrink-0"
                                    style={getAvatarBorderStyle(client)}
                                >
                                    {/* Inner Avatar - Uses Theme Primary Color */}
                                    <div 
                                        className={`w-full h-full rounded-full flex items-center justify-center text-white font-bold ${showTrash ? 'bg-gray-400' : ''}`}
                                        style={{ backgroundColor: !showTrash ? 'var(--md-primary)' : undefined }}
                                    >
                                        {client.clientType === ClientType.Parent 
                                            ? (client as ParentClient).firstName.charAt(0).toUpperCase()
                                            : (client as InstitutionalClient).companyName.charAt(0).toUpperCase()
                                        }
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 line-clamp-1">
                                        {client.clientType === ClientType.Parent 
                                            ? `${(client as ParentClient).firstName} ${(client as ParentClient).lastName}`
                                            : (client as InstitutionalClient).companyName}
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        {client.clientType === ClientType.Parent ? 'Genitore' : 'Istituzionale'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-4 space-y-1 text-sm text-gray-600">
                             <div className="flex items-center">
                                <span className="w-5 text-center mr-2">✉️</span>
                                <span className="truncate">{client.email}</span>
                            </div>
                            <div className="flex items-center">
                                <span className="w-5 text-center mr-2">📞</span>
                                <span>{client.phone}</span>
                            </div>
                             <div className="flex items-center">
                                <span className="w-5 text-center mr-2">📍</span>
                                <span className="truncate">{client.city}</span>
                            </div>
                        </div>

                        {client.clientType === ClientType.Parent && (
                            <div className="mt-4 pt-3 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-500 mb-2">FIGLI:</p>
                                <div className="flex flex-wrap gap-1">
                                    {(client as ParentClient).children && (client as ParentClient).children.length > 0 ? (
                                        (client as ParentClient).children.slice(0,3).map(c => (
                                            <span key={c.id} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                                                {c.name}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">Nessuno</span>
                                    )}
                                    {(client as ParentClient).children && (client as ParentClient).children.length > 3 && (
                                        <span className="text-xs text-gray-500 pl-1">...</span>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="mt-4 flex justify-end pt-2 space-x-2">
                             {showTrash ? (
                                <>
                                    <button 
                                        onClick={(e) => handleActionClick(e, client.id, 'restore')} 
                                        className="md-icon-btn text-green-600 hover:bg-green-50" 
                                        title="Ripristina Cliente"
                                    >
                                        <RestoreIcon />
                                    </button>
                                    <button 
                                        onClick={(e) => handleActionClick(e, client.id, 'permanent')} 
                                        className="md-icon-btn text-red-600 hover:bg-red-50" 
                                        title="Elimina Definitivamente"
                                    >
                                        <TrashIcon />
                                    </button>
                                </>
                             ) : (
                                <button 
                                    onClick={(e) => handleActionClick(e, client.id, 'delete')} 
                                    className="md-icon-btn delete" 
                                    title="Elimina Cliente"
                                >
                                    <TrashIcon />
                                </button>
                             )}
                        </div>
                    </div>
                ))}
                {filteredClients.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-500">
                        {showTrash ? "Cestino vuoto." : "Nessun cliente trovato che corrisponde alla ricerca."}
                    </div>
                )}
            </div>
            }

            {isModalOpen && (
                <Modal onClose={handleCloseModal} size="lg">
                    <ClientForm 
                        client={editingClient} 
                        onSave={handleSaveClient} 
                        onCancel={handleCloseModal} 
                    />
                </Modal>
            )}

            {isImportModalOpen && (
                <ImportModal 
                    entityName="Clienti"
                    templateHeaders={['type', 'email', 'phone', 'address', 'zipCode', 'city', 'province', 'firstName', 'lastName', 'taxCode', 'companyName', 'vatNumber']}
                    instructions={[
                        "type: 'parent' o 'institutional'",
                        "email: Obbligatorio (chiave unica)",
                        "Campi Genitore: firstName, lastName, taxCode",
                        "Campi Istituzionale: companyName, vatNumber"
                    ]}
                    onClose={() => setIsImportModalOpen(false)}
                    onImport={handleImport}
                />
            )}

            <ConfirmModal 
                isOpen={!!clientToProcess}
                onClose={() => setClientToProcess(null)}
                onConfirm={handleConfirmAction}
                title={clientToProcess?.action === 'restore' ? "Ripristina Cliente" : clientToProcess?.action === 'permanent' ? "Eliminazione Definitiva" : "Sposta nel Cestino"}
                message={clientToProcess?.action === 'restore' 
                    ? "Vuoi ripristinare questo cliente e renderlo nuovamente attivo?" 
                    : clientToProcess?.action === 'permanent' 
                    ? "ATTENZIONE: Questa operazione è irreversibile. Vuoi eliminare definitivamente il cliente e tutti i dati associati?" 
                    : "Sei sicuro di voler spostare questo cliente nel cestino? Potrai ripristinarlo in seguito."}
                isDangerous={clientToProcess?.action !== 'restore'}
                confirmText={clientToProcess?.action === 'restore' ? "Ripristina" : "Elimina"}
            />
        </div>
    );
};

export default Clients;
