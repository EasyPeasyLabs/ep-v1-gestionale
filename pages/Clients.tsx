
import React, { useState, useEffect, useCallback } from 'react';
import { Client, ClientInput, ClientType, ParentClient, InstitutionalClient, Child, Enrollment, SubscriptionType, Lesson, EnrollmentInput, EnrollmentStatus, TransactionType, TransactionCategory, PaymentMethod, Appointment, Supplier, AvailabilitySlot } from '../types';
import { getClients, addClient, updateClient, deleteClient } from '../services/parentService';
import { getEnrollmentsForClient, addEnrollment, deleteEnrollment, getAllEnrollments } from '../services/enrollmentService';
import { getSubscriptionTypes } from '../services/settingsService';
import { getSuppliers } from '../services/supplierService'; // Changed import
import { addTransaction } from '../services/financeService';
import PlusIcon from '../components/icons/PlusIcon';
import SearchIcon from '../components/icons/SearchIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';
import ClientsIcon from '../components/icons/ClientsIcon';
import SuppliersIcon from '../components/icons/SuppliersIcon';
import UploadIcon from '../components/icons/UploadIcon';
import ImportModal from '../components/ImportModal';
import { importClientsFromExcel } from '../services/importService';
import ChevronDownIcon from '../components/icons/ChevronDownIcon';

const daysOfWeekMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

const EnrollmentForm: React.FC<{
    parent: ParentClient;
    onSave: (enrollment: EnrollmentInput, subType: SubscriptionType, child: Child) => void;
    onCancel: () => void;
}> = ({ parent, onSave, onCancel }) => {
    const [childId, setChildId] = useState('');
    const [subscriptionTypeId, setSubscriptionTypeId] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [startDateInput, setStartDateInput] = useState(new Date().toISOString().split('T')[0]); // Default oggi
    const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

    const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [subs, suppliersData] = await Promise.all([
                getSubscriptionTypes(),
                getSuppliers()
            ]);
            setSubscriptionTypes(subs);
            setSuppliers(suppliersData);

            if (parent.children.length > 0) setChildId(parent.children[0].id);
            if (subs.length > 0) setSubscriptionTypeId(subs[0].id);
            if (suppliersData.length > 0) {
                setSupplierId(suppliersData[0].id);
                if (suppliersData[0].locations.length > 0) {
                    setLocationId(suppliersData[0].locations[0].id);
                }
            }
            setLoading(false);
        };
        fetchData();
    }, [parent.children]);

    const handleSupplierChange = (newSupplierId: string) => {
        setSupplierId(newSupplierId);
        const newSupplier = suppliers.find(s => s.id === newSupplierId);
        if (newSupplier && newSupplier.locations.length > 0) {
            setLocationId(newSupplier.locations[0].id);
            setSelectedSlotIndex(null); // Reset slot on supplier/location change
        } else {
            setLocationId('');
            setSelectedSlotIndex(null);
        }
    };

    const handleLocationChange = (newLocationId: string) => {
        setLocationId(newLocationId);
        setSelectedSlotIndex(null);
    };

    // Helper per generare le date delle lezioni
    const generateAppointments = (startDate: Date, slot: AvailabilitySlot, numLessons: number, locName: string, locColor: string, childName: string): Appointment[] => {
        const appointments: Appointment[] = [];
        let currentDate = new Date(startDate);
        let lessonsScheduled = 0;

        // Trova la prima data utile che corrisponde al giorno della settimana
        // Attenzione: se la data di partenza è già il giorno giusto, inizia da lì, altrimenti avanza
        while (currentDate.getDay() !== slot.dayOfWeek) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Se la data trovata è precedente alla data di input (caso limite), aggiungi 7 giorni (non dovrebbe accadere col loop sopra se partiamo da startDate)
        if (currentDate < startDate) {
             currentDate.setDate(currentDate.getDate() + 7);
        }

        while (lessonsScheduled < numLessons) {
            appointments.push({
                lessonId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                date: currentDate.toISOString(),
                startTime: slot.startTime,
                endTime: slot.endTime,
                locationName: locName,
                locationColor: locColor,
                childName: childName
            });
            // Avanza di una settimana
            currentDate.setDate(currentDate.getDate() + 7);
            lessonsScheduled++;
        }
        return appointments;
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const selectedChild = parent.children.find(c => c.id === childId);
        const selectedSub = subscriptionTypes.find(s => s.id === subscriptionTypeId);
        const selectedSupplier = suppliers.find(s => s.id === supplierId);
        const selectedLocation = selectedSupplier?.locations.find(l => l.id === locationId);
        
        if (!selectedChild || !selectedSub || !selectedSupplier || !selectedLocation) return;
        
        if (selectedSlotIndex === null) {
            alert("Per favore seleziona un orario disponibile per le lezioni.");
            return;
        }
        const selectedSlot = selectedLocation.availability ? selectedLocation.availability[selectedSlotIndex] : null;
        if (!selectedSlot) return;

        // Calcolo appuntamenti usando la data selezionata dall'utente
        const startObj = new Date(startDateInput);
        const appointments = generateAppointments(
            startObj, 
            selectedSlot, 
            selectedSub.lessons, 
            selectedLocation.name, 
            selectedLocation.color,
            selectedChild.name
        );
        
        // La data di inizio è la data della prima lezione effettiva (o quella impostata se coincide), la fine è l'ultima
        const startDate = appointments.length > 0 ? appointments[0].date : startObj.toISOString();
        const endDate = appointments.length > 0 ? appointments[appointments.length - 1].date : startObj.toISOString();

        const newEnrollment: EnrollmentInput = {
            clientId: parent.id,
            childId,
            childName: selectedChild.name,
            subscriptionTypeId,
            subscriptionName: selectedSub.name,
            supplierId: selectedSupplier.id,
            supplierName: selectedSupplier.companyName,
            locationId: selectedLocation.id,
            locationName: selectedLocation.name,
            locationColor: selectedLocation.color,
            appointments: appointments,
            lessonsTotal: selectedSub.lessons,
            lessonsRemaining: selectedSub.lessons,
            startDate: startDate,
            endDate: endDate,
            status: EnrollmentStatus.Active,
        };
        onSave(newEnrollment, selectedSub, selectedChild);
    };

    const selectedSupplier = suppliers.find(s => s.id === supplierId);
    const selectedLocation = selectedSupplier?.locations.find(l => l.id === locationId);

    if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[85vh]">
            <h2 className="text-xl font-bold mb-4 flex-shrink-0 border-b pb-3">Nuova Iscrizione</h2>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                <div className="md-input-group">
                    <select id="child" value={childId} onChange={e => setChildId(e.target.value)} required className="md-input">
                        {parent.children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
                    </select>
                    <label htmlFor="child" className="md-input-label !top-0 !text-xs !text-gray-500">Figlio</label>
                </div>
                
                <div className="md-input-group">
                    <select id="sub-type" value={subscriptionTypeId} onChange={e => setSubscriptionTypeId(e.target.value)} required className="md-input">
                        {subscriptionTypes.map(sub => <option key={sub.id} value={sub.id}>{sub.name} ({sub.lessons} lezioni, {sub.price}€)</option>)}
                    </select>
                    <label htmlFor="sub-type" className="md-input-label !top-0 !text-xs !text-gray-500">Pacchetto Abbonamento</label>
                </div>

                <div className="md-input-group">
                    <select id="supplier" value={supplierId} onChange={e => handleSupplierChange(e.target.value)} required className="md-input">
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.companyName}</option>)}
                    </select>
                    <label htmlFor="supplier" className="md-input-label !top-0 !text-xs !text-gray-500">Fornitore (Scuola/Palestra)</label>
                </div>

                <div className="md-input-group">
                    <select id="location" value={locationId} onChange={e => handleLocationChange(e.target.value)} required disabled={!selectedSupplier || selectedSupplier.locations.length === 0} className="md-input">
                         {!selectedSupplier?.locations.length && <option value="">Nessuna sede disponibile</option>}
                        {selectedSupplier?.locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.city})</option>)}
                    </select>
                    <label htmlFor="location" className="md-input-label !top-0 !text-xs !text-gray-500">Sede (Aula)</label>
                </div>
                
                <div className="md-input-group">
                    <input 
                        id="startDate" 
                        type="date" 
                        value={startDateInput} 
                        onChange={e => setStartDateInput(e.target.value)} 
                        required 
                        className="md-input" 
                    />
                    <label htmlFor="startDate" className="md-input-label !top-0 !text-xs !text-gray-500">Data Inizio Iscrizione</label>
                </div>

                {selectedLocation && (
                    <div className="mt-4">
                         <label className="block text-sm font-medium text-gray-700 mb-2">Orari Disponibili per {selectedLocation.name}</label>
                         <div className="space-y-2">
                             {selectedLocation.availability && selectedLocation.availability.length > 0 ? (
                                 selectedLocation.availability.map((slot, idx) => (
                                     <label key={idx} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${selectedSlotIndex === idx ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                                         <input 
                                             type="radio" 
                                             name="availabilitySlot" 
                                             value={idx} 
                                             checked={selectedSlotIndex === idx}
                                             onChange={() => setSelectedSlotIndex(idx)}
                                             className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                         />
                                         <div className="ml-3">
                                             <span className="block text-sm font-medium text-gray-900">
                                                 {daysOfWeekMap[slot.dayOfWeek]}
                                             </span>
                                             <span className="block text-sm text-gray-500">
                                                 {slot.startTime} - {slot.endTime}
                                             </span>
                                         </div>
                                     </label>
                                 ))
                             ) : (
                                 <p className="text-sm text-red-500">Questa sede non ha orari definiti. Aggiungi disponibilità nella scheda Fornitori.</p>
                             )}
                         </div>
                    </div>
                )}
                
                <div className="bg-indigo-50 p-3 rounded-md mt-2">
                    <p className="text-xs text-indigo-800">
                        Selezionando l'orario e la data di inizio, verranno generate automaticamente le lezioni previste dal pacchetto a partire da tale data.
                    </p>
                </div>
            </div>

             <div className="mt-4 pt-4 border-t flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green" disabled={selectedSlotIndex === null}>Iscrivi</button>
            </div>
        </form>
    );
};


const ClientDetail: React.FC<{ client: Client; onBack: () => void; onEdit: (client: Client) => void; avatarColor?: string }> = ({ client, onBack, onEdit, avatarColor }) => {
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
    const [enrollmentToDelete, setEnrollmentToDelete] = useState<string | null>(null);
    const [expandedEnrollmentId, setExpandedEnrollmentId] = useState<string | null>(null);
    
    // Usa il colore passato dalle props o fallback a default
    const displayColor = avatarColor || '#e0e7ff'; // Indigo-100 default
    // Calcola un colore del testo leggibile
    const isDarkColor = (color: string) => {
        // Semplice euristica: se non è il default chiaro, assumiamo sia un colore saturo/scuro della sede
        return color !== '#e0e7ff' && color !== '#fef3c7';
    };
    const textColor = isDarkColor(displayColor) ? '#ffffff' : '#311B92';

    const fetchEnrollments = useCallback(async (showLoading = true) => {
        if(client.clientType === ClientType.Parent) {
            if(showLoading) setLoading(true);
            try {
                const data = await getEnrollmentsForClient(client.id);
                setEnrollments(data);
            } catch (error) {
                console.error("Error fetching enrollments:", error);
            } finally {
                if(showLoading) setLoading(false);
            }
        }
    }, [client.id, client.clientType]);

    useEffect(() => {
        fetchEnrollments();
    }, [fetchEnrollments]);

    const handleSaveEnrollment = async (enrollment: EnrollmentInput, subType: SubscriptionType, child: Child) => {
        try {
            const newEnrollmentId = await addEnrollment(enrollment);
            await addTransaction({
                date: new Date().toISOString(),
                description: `Iscrizione ${child.name} - Pacchetto ${subType.name}`,
                amount: subType.price,
                type: TransactionType.Income,
                category: TransactionCategory.Sales,
                paymentMethod: PaymentMethod.Other,
                relatedDocumentId: newEnrollmentId,
            });
            setIsEnrollModalOpen(false);
            fetchEnrollments();
            // Trigger update for notifications (e.g. low lessons resolved)
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch (error) {
            console.error("Errore nel salvataggio iscrizione:", error);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setEnrollmentToDelete(id);
    };

    const handleConfirmDelete = async () => {
        if (enrollmentToDelete) {
            const id = enrollmentToDelete;
            try {
                // Aggiornamento ottimistico
                setEnrollments(prev => prev.filter(enr => enr.id !== id));
                await deleteEnrollment(id);
                fetchEnrollments(false); // Sincronizzazione silenziosa
                // Trigger update for notifications (if we deleted the enrollment causing the notification)
                window.dispatchEvent(new Event('EP_DataUpdated'));
            } catch (error) {
                console.error("Errore durante eliminazione:", error);
                fetchEnrollments(false); // Ripristino in caso di errore
            }
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedEnrollmentId(prev => prev === id ? null : id);
    };

    return (
        <div className="md-card p-6 animate-fade-in h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-start flex-shrink-0">
                <button onClick={onBack} className="text-sm font-medium mb-4" style={{ color: 'var(--md-primary)'}}>&larr; Torna alla lista</button>
                 <button onClick={() => onEdit(client)} className="md-icon-btn edit" aria-label="Modifica cliente">
                    <PencilIcon />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
            {client.clientType === ClientType.Parent ? (
                <>
                    <div className="flex flex-col sm:flex-row items-start">
                        <div className="w-24 h-24 rounded-full mr-6 flex items-center justify-center mb-4 sm:mb-0 shadow-sm border border-gray-100" 
                             style={{ minWidth: '6rem', backgroundColor: displayColor }}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" style={{ color: textColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{client.firstName} {client.lastName}</h2>
                            <p style={{ color: 'var(--md-text-secondary)'}} className="break-all">{client.email} | {client.phone}</p>
                            <p className="text-sm mt-1" style={{ color: 'var(--md-text-secondary)'}}>CF: {client.taxCode}</p>
                        </div>
                    </div>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-lg font-semibold">Figli</h3>
                            {client.children.length > 0 ? client.children.map(child => (
                                    <div key={child.id} className="mt-2 p-3 border rounded-lg" style={{ borderColor: 'var(--md-divider)'}}>
                                        <p className="font-semibold">{child.name}, {child.age}</p>
                                    </div>
                                ))
                             : (
                            <p className="text-sm mt-4" style={{ color: 'var(--md-text-secondary)'}}>Nessun figlio registrato.</p>
                            )}
                        </div>
                        <div>
                             <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Pacchetti Attivi</h3>
                                <button onClick={() => setIsEnrollModalOpen(true)} className="md-btn md-btn-flat md-btn-primary text-sm">
                                    <PlusIcon/> <span className="ml-1">Iscrivi</span>
                                </button>
                             </div>
                              {loading ? <div className="mt-4"><Spinner/></div> :
                                enrollments.length > 0 ? enrollments.map(enr => (
                                    <div key={enr.id} className="mt-2 border rounded-lg shadow-sm" style={{ borderColor: 'var(--md-divider)', borderLeftWidth: '4px', borderLeftColor: enr.locationColor || '#ccc' }}>
                                        <div className="p-3 flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(enr.id)}>
                                            <div className="flex-1">
                                                <p className="font-semibold text-indigo-800">{enr.childName} - {enr.subscriptionName}</p>
                                                <p className="text-xs text-gray-500 mt-0.5 font-bold" style={{ color: enr.locationColor || 'gray' }}>Presso: {enr.locationName}</p>
                                                <div className="flex items-center text-sm text-gray-600 mt-1 space-x-4">
                                                    <span>Ingressi: {enr.lessonsTotal - enr.lessonsRemaining}/{enr.lessonsTotal}</span>
                                                    <span className={enr.lessonsRemaining <= 2 ? 'text-red-500 font-bold' : ''}>Residui: {enr.lessonsRemaining}</span>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1">Scadenza: {new Date(enr.endDate).toLocaleDateString()}</p>
                                            </div>
                                            <div className="flex items-center">
                                                <button 
                                                    type="button"
                                                    onClick={(e) => handleDeleteClick(e, enr.id)} 
                                                    className="md-icon-btn delete mr-1"
                                                    aria-label="Elimina iscrizione"
                                                >
                                                    <TrashIcon />
                                                </button>
                                                <div className={`transform transition-transform duration-200 ${expandedEnrollmentId === enr.id ? 'rotate-180' : ''}`}>
                                                    <ChevronDownIcon />
                                                </div>
                                            </div>
                                        </div>
                                        {expandedEnrollmentId === enr.id && (
                                            <div className="px-3 pb-3 border-t bg-gray-50 rounded-b-lg" style={{ borderColor: 'var(--md-divider)'}}>
                                                <p className="text-xs font-semibold text-gray-500 mt-2 uppercase tracking-wide">Lezioni Programmate</p>
                                                {enr.appointments && enr.appointments.length > 0 ? (
                                                    <ul className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                                                        {enr.appointments.map((app, idx) => (
                                                            <li key={idx} className="text-sm flex justify-between bg-white p-2 rounded shadow-sm border-l-2" style={{borderLeftColor: app.locationColor}}>
                                                                <span>{new Date(app.date).toLocaleDateString()} <span className="text-gray-500">({app.startTime}-{app.endTime})</span></span>
                                                                <span className="text-xs text-gray-400">{app.locationName}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-sm text-gray-500 mt-2 italic">
                                                        Nessuna lezione programmata specificatamente.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                             : (
                            <p className="text-sm mt-4" style={{ color: 'var(--md-text-secondary)'}}>Nessuna iscrizione attiva.</p>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col sm:flex-row items-start">
                     <div className="w-24 h-24 rounded-full mr-6 flex items-center justify-center bg-amber-100 mb-4 sm:mb-0" style={{ minWidth: '6rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" style={{ color: '#E65100' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">{client.companyName}</h2>
                        <p style={{ color: 'var(--md-text-secondary)'}} className="break-all">{client.email} | {client.phone}</p>
                        <p className="text-sm mt-1" style={{ color: 'var(--md-text-secondary)'}}>P.IVA: {client.vatNumber}</p>
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold">Dettagli Contratto</h3>
                            <div className="mt-4 p-4 border rounded-lg" style={{ borderColor: 'var(--md-divider)'}}>
                                <p>Numero Bambini: <span className="font-medium">{client.numberOfChildren}</span></p>
                                <p>Fascia d'età: <span className="font-medium">{client.ageRange}</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>
             {isEnrollModalOpen && client.clientType === ClientType.Parent && (
                <Modal onClose={() => setIsEnrollModalOpen(false)}>
                    <EnrollmentForm parent={client} onSave={handleSaveEnrollment} onCancel={() => setIsEnrollModalOpen(false)} />
                </Modal>
            )}

            <ConfirmModal 
                isOpen={!!enrollmentToDelete}
                onClose={() => setEnrollmentToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Elimina Iscrizione"
                message="Sei sicuro di voler eliminare questa iscrizione? Tutte le lezioni programmate verranno cancellate."
                isDangerous={true}
            />
        </div>
    );
};

const ChildFormModal: React.FC<{
    child?: Child;
    onSave: (child: Child) => void;
    onCancel: () => void;
}> = ({ child, onSave, onCancel }) => {
    const [name, setName] = useState(child?.name || '');
    const [age, setAge] = useState(child?.age || '');

    const handleSave = () => {
        onSave({ id: child?.id || Date.now().toString(), name, age });
    };

    return (
        <div className="flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4 flex-shrink-0">{child ? 'Modifica Dati Figlio' : 'Aggiungi Figlio'}</h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                <div className="md-input-group">
                    <input id="childName" type="text" value={name} onChange={e => setName(e.target.value)} required className="md-input" placeholder=" " />
                    <label htmlFor="childName" className="md-input-label">Nome Figlio</label>
                </div>
                <div className="md-input-group">
                    <input id="childAge" type="text" value={age} onChange={e => setAge(e.target.value)} required className="md-input" placeholder=" " />
                    <label htmlFor="childAge" className="md-input-label">Età (es. 3 anni)</label>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="button" onClick={handleSave} className="md-btn md-btn-raised md-btn-green">Salva</button>
            </div>
        </div>
    );
};


const ClientForm: React.FC<{ client?: Client | null; onSave: (clientData: ClientInput | Client) => void; onCancel: () => void; }> = ({ client, onSave, onCancel }) => {
    const [clientType, setClientType] = useState<ClientType | null>(client?.clientType || null);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [zipCode, setZipCode] = useState('');
    const [city, setCity] = useState('');
    const [province, setProvince] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [taxCode, setTaxCode] = useState('');
    const [children, setChildren] = useState<Child[]>([]);
    const [companyName, setCompanyName] = useState('');
    const [vatNumber, setVatNumber] = useState('');

    const [isChildModalOpen, setIsChildModalOpen] = useState(false);
    const [editingChild, setEditingChild] = useState<Child | null>(null);

    useEffect(() => {
        if (client) {
            setEmail(client.email); setPhone(client.phone); setAddress(client.address);
            setZipCode(client.zipCode); setCity(client.city); setProvince(client.province);
            if (client.clientType === ClientType.Parent) {
                setFirstName(client.firstName); setLastName(client.lastName);
                setTaxCode(client.taxCode); setChildren(client.children || []);
            } else {
                setCompanyName(client.companyName); setVatNumber(client.vatNumber);
            }
        }
    }, [client]);

    const handleSaveChild = (child: Child) => {
        const existingIndex = children.findIndex(c => c.id === child.id);
        if (existingIndex > -1) {
            const updatedChildren = [...children];
            updatedChildren[existingIndex] = child;
            setChildren(updatedChildren);
        } else {
            setChildren([...children, child]);
        }
        setIsChildModalOpen(false);
        setEditingChild(null);
    };

    const handleEditChild = (child: Child) => {
        setEditingChild(child);
        setIsChildModalOpen(true);
    };

    const handleRemoveChild = (id: string) => {
        setChildren(children.filter(child => child.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const baseData = { address, zipCode, city, province, email, phone };
        let clientData: Omit<ParentClient, 'id'> | Omit<InstitutionalClient, 'id'>;
        if (clientType === ClientType.Parent) {
            clientData = { ...baseData, clientType, firstName, lastName, taxCode, children };
        } else if (clientType === ClientType.Institutional) {
            clientData = { ...baseData, clientType, companyName, vatNumber, numberOfChildren: (client as InstitutionalClient)?.numberOfChildren || 0, ageRange: (client as InstitutionalClient)?.ageRange || '' };
        } else { return; }

        if (client?.id) { onSave({ ...clientData, id: client.id } as Client); } 
        else { onSave(clientData as ClientInput); }
    };
    
    if (!clientType) {
        return (
             <div>
                <h2 className="text-xl font-bold mb-6 text-center">Seleziona Tipo Cliente</h2>
                <div className="flex justify-center space-x-4">
                    <button onClick={() => setClientType(ClientType.Parent)} className="flex flex-col items-center justify-center p-6 border rounded-lg w-40 h-40 hover:bg-indigo-50 transition-colors" style={{borderColor: 'var(--md-divider)'}}>
                        <ClientsIcon/> <span className="mt-2 font-medium">Genitore</span>
                    </button>
                    <button onClick={() => setClientType(ClientType.Institutional)} className="flex flex-col items-center justify-center p-6 border rounded-lg w-40 h-40 hover:bg-indigo-50 transition-colors" style={{borderColor: 'var(--md-divider)'}}>
                       <SuppliersIcon /> <span className="mt-2 font-medium">Istituzionale</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="animate-fade-in flex flex-col h-full max-h-[85vh]">
            <div className="flex flex-wrap gap-2 justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-xl font-bold">{client ? 'Modifica Cliente' : 'Nuovo Cliente'} - <span style={{color: 'var(--md-primary)'}}>{clientType === ClientType.Parent ? 'Genitore' : 'Istituzionale'}</span></h2>
                {clientType === ClientType.Parent && (
                     <button type="button" onClick={() => { setEditingChild(null); setIsChildModalOpen(true); }} className="md-btn md-btn-flat md-btn-primary text-sm flex-shrink-0">
                        <PlusIcon/> <span className="ml-1 hidden sm:inline">Aggiungi Figlio</span>
                    </button>
                )}
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {clientType === ClientType.Parent ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div className="md-input-group"><input id="firstName" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="firstName" className="md-input-label">Nome</label></div>
                           <div className="md-input-group"><input id="lastName" type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="lastName" className="md-input-label">Cognome</label></div>
                        </div>
                        <div className="md-input-group"><input id="taxCode" type="text" value={taxCode} onChange={e => setTaxCode(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="taxCode" className="md-input-label">Codice Fiscale</label></div>
                    </>
                ) : (
                     <>
                        <div className="md-input-group"><input id="companyName" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="companyName" className="md-input-label">Ragione Sociale</label></div>
                        <div className="md-input-group"><input id="vatNumber" type="text" value={vatNumber} onChange={e => setVatNumber(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="vatNumber" className="md-input-label">P.IVA / Codice Fiscale</label></div>
                    </>
                )}
                 <hr className="my-4" style={{borderColor: 'var(--md-divider)'}}/>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="email" className="md-input-label">Email</label></div>
                    <div className="md-input-group"><input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="phone" className="md-input-label">Telefono</label></div>
                </div>
                <div className="md-input-group"><input id="address" type="text" value={address} onChange={e => setAddress(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="address" className="md-input-label">Indirizzo</label></div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="md-input-group"><input id="zipCode" type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="zipCode" className="md-input-label">CAP</label></div>
                    <div className="col-span-2 md-input-group"><input id="city" type="text" value={city} onChange={e => setCity(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="city" className="md-input-label">Città</label></div>
                </div>
                 <div className="md-input-group"><input id="province" type="text" value={province} onChange={e => setProvince(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="province" className="md-input-label">Provincia</label></div>
                
                 {clientType === ClientType.Parent && (
                    <div className="pt-4 border-t mt-4" style={{borderColor: 'var(--md-divider)'}}>
                         <div className="flex justify-between items-center">
                            <h3 className="text-md font-semibold">Figli</h3>
                        </div>
                        {children.length > 0 ? children.map((child) => (
                            <div key={child.id} className="flex items-center justify-between p-2 mt-2 bg-gray-50 rounded-md">
                                <p className="text-sm">{child.name} - {child.age}</p>
                                <div>
                                    <button type="button" onClick={() => handleEditChild(child)} className="md-icon-btn edit" aria-label={`Modifica ${child.name}`}><PencilIcon /></button>
                                    <button type="button" onClick={() => handleRemoveChild(child.id)} className="md-icon-btn delete" aria-label={`Rimuovi ${child.name}`}><TrashIcon /></button>
                                </div>
                            </div>
                        )) : <p className="text-sm text-center py-4" style={{color: 'var(--md-text-secondary)'}}>Nessun figlio aggiunto.</p>}
                    </div>
                )}
            </div>

            <div className="mt-4 pt-4 border-t flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green">Salva</button>
            </div>
            {isChildModalOpen && (
                <Modal onClose={() => setIsChildModalOpen(false)}>
                    <ChildFormModal child={editingChild} onSave={handleSaveChild} onCancel={() => setIsChildModalOpen(false)} />
                </Modal>
            )}
        </form>
    );
};


const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientEnrollmentColors, setClientEnrollmentColors] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const clientsData = await getClients();
      setClients(clientsData);
      
      // Fetch active enrollments to map colors
      const activeEnrollments = await getAllEnrollments();
      const colorMap = new Map<string, string>();
      
      // Map client ID to the color of their most recent active enrollment location
      activeEnrollments.forEach(enr => {
          if (enr.locationColor) {
              // This simple logic overwrites if multiple, effectively taking the "last" one processed.
              // For a more complex logic (e.g. primary color), we'd need more rules.
              colorMap.set(enr.clientId, enr.locationColor);
          }
      });
      setClientEnrollmentColors(colorMap);

      setError(null);
    } catch (err) {
      setError("Impossibile caricare i clienti.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
    
    // Re-fetch data if updated elsewhere (e.g. enrollment added)
    const handleDataUpdate = () => {
        fetchClients();
    };
    window.addEventListener('EP_DataUpdated', handleDataUpdate);
    return () => window.removeEventListener('EP_DataUpdated', handleDataUpdate);
  }, [fetchClients]);

  const handleOpenModal = (client: Client | null = null) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingClient(null);
    setIsModalOpen(false);
  };
  
  const handleBackToList = () => {
    setSelectedClient(null);
    fetchClients();
  };


  const handleSaveClient = async (clientData: ClientInput | Client) => {
    try {
      if ('id' in clientData) {
        const { id, ...dataToUpdate } = clientData;
        await updateClient(id, dataToUpdate);
      } else {
        await addClient(clientData);
      }
      handleCloseModal();
      if(selectedClient) {
          const reloadedClient = { ...clientData, id: selectedClient.id } as Client;
          setSelectedClient(reloadedClient);
      }
      fetchClients();
    } catch (err) {
      console.error("Errore nel salvataggio del cliente:", err);
      setError("Salvataggio fallito.");
    }
  };

  const handleDeleteClick = (id: string) => {
      setClientToDelete(id);
  }

  const handleConfirmDelete = async () => {
    if (clientToDelete) {
      try {
        await deleteClient(clientToDelete);
        fetchClients();
      } catch (err) {
        console.error("Errore nell'eliminazione del cliente:", err);
        setError("Eliminazione fallita.");
      } finally {
          setClientToDelete(null);
      }
    }
  };

  const handleImport = async (file: File) => {
    const result = await importClientsFromExcel(file);
    fetchClients();
    return result;
  };

  if (selectedClient) {
    const color = clientEnrollmentColors.get(selectedClient.id);
    return <ClientDetail client={selectedClient} onBack={handleBackToList} onEdit={() => handleOpenModal(selectedClient)} avatarColor={color} />;
  }

  return (
    <div>
        <div className="flex flex-wrap gap-4 justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Clienti</h1>
              <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Gestisci le anagrafiche di genitori e clienti istituzionali.</p>
            </div>
             <div className="flex items-center space-x-2 flex-wrap">
                <button onClick={() => setIsImportModalOpen(true)} className="md-btn md-btn-flat">
                    <UploadIcon />
                    <span className="ml-2">Importa</span>
                </button>
                <button onClick={() => handleOpenModal()} className="md-btn md-btn-raised md-btn-green">
                    <PlusIcon />
                    <span className="ml-2">Aggiungi</span>
                </button>
            </div>
        </div>

        {isModalOpen && (
            <Modal onClose={handleCloseModal} size="xl">
                <ClientForm client={editingClient} onSave={handleSaveClient} onCancel={handleCloseModal} />
            </Modal>
        )}
        
        {isImportModalOpen && (
            <ImportModal 
                entityName="Clienti"
                templateHeaders={[
                    'type', 'email', 'firstName', 'lastName', 'taxCode', 
                    'companyName', 'vatNumber', 'phone', 'address', 
                    'zipCode', 'city', 'province'
                ]}
                instructions={[
                    'La prima riga del primo foglio deve contenere le intestazioni delle colonne.',
                    'Il campo "email" è la chiave unica per l\'aggiornamento di record esistenti.',
                    'Il campo "type" deve essere "parent" o "institutional". Compila i campi relativi al tipo scelto.'
                ]}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImport}
            />
        )}


        <div className="mt-8 md-card p-0 md:p-6">
          <div className="p-4 md:p-0">
              <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                  <input type="text" placeholder="Cerca cliente..." className="block w-full sm:max-w-sm bg-gray-50 border rounded-md py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-1" style={{borderColor: 'var(--md-divider)'}}/>
              </div>
          </div>
          {loading ? <div className="flex justify-center items-center py-8"><Spinner /></div> : 
           error ? <p className="text-center text-red-500 py-8">{error}</p> :
           <>
           {/* Mobile View - Cards */}
           <div className="md:hidden mt-4 space-y-4 px-4 pb-4">
              {clients.map(client => {
                  const avatarColor = clientEnrollmentColors.get(client.id) || (client.clientType === ClientType.Parent ? '#e0e7ff' : '#fef3c7');
                  const iconColor = (client.clientType === ClientType.Parent && !clientEnrollmentColors.get(client.id)) ? '#311B92' : 
                                    (client.clientType === ClientType.Institutional) ? '#E65100' : 
                                    // Se c'è un colore custom, usiamo bianco per l'icona se scuro, o nero se chiaro? Semplifichiamo.
                                    '#444';
                  
                  return (
                <div key={client.id} className="md-card p-4">
                   <div className="flex items-start justify-between">
                      <div className="flex items-start">
                        <div className="w-10 h-10 rounded-full mr-3 flex items-center justify-center shadow-sm border border-gray-100" 
                             style={{minWidth: '2.5rem', backgroundColor: avatarColor}}>
                             {client.clientType === ClientType.Parent ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" style={{color: iconColor}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                             ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" style={{color: iconColor}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                             )}
                        </div>
                           <div>
                              <p className="font-medium">{client.clientType === ClientType.Parent ? `${client.firstName} ${client.lastName}` : client.companyName}</p>
                              <span className={`text-xs md-badge mt-1 ${client.clientType === ClientType.Parent ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                                {client.clientType === ClientType.Parent ? 'Genitore' : 'Istituzionale'}
                              </span>
                           </div>
                        </div>
                         <div className="flex items-center space-x-1">
                            <button onClick={() => handleOpenModal(client)} className="md-icon-btn edit" aria-label="Modifica cliente"><PencilIcon /></button>
                            <button onClick={() => handleDeleteClick(client.id)} className="md-icon-btn delete" aria-label="Elimina cliente"><TrashIcon /></button>
                        </div>
                   </div>
                   <div className="mt-3 pt-3 border-t text-sm space-y-1" style={{ borderColor: 'var(--md-divider)', color: 'var(--md-text-secondary)'}}>
                       <p className="truncate"><strong>Email:</strong> {client.email}</p>
                       <p><strong>Tel:</strong> {client.phone}</p>
                       {client.clientType === ClientType.Parent && <p><strong>Figli:</strong> {client.children.length}</p>}
                   </div>
                   <div className="mt-3 text-right">
                       <button onClick={() => setSelectedClient(client)} className="md-btn md-btn-flat md-btn-primary text-sm">Vedi Dettagli</button>
                   </div>
                </div>
              );
             })}
           </div>
          
           {/* Desktop View - Table */}
           <div className="overflow-x-auto hidden md:block mt-4">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--md-divider)'}}>
                  <th className="p-4 font-medium" style={{ color: 'var(--md-text-secondary)'}}>Nome / Ragione Sociale</th>
                  <th className="p-4 font-medium" style={{ color: 'var(--md-text-secondary)'}}>Tipo</th>
                  <th className="p-4 font-medium" style={{ color: 'var(--md-text-secondary)'}}>Contatti</th>
                  <th className="p-4 font-medium" style={{ color: 'var(--md-text-secondary)'}}>Figli</th>
                  <th className="p-4 font-medium" style={{ color: 'var(--md-text-secondary)'}}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => {
                    const avatarColor = clientEnrollmentColors.get(client.id) || (client.clientType === ClientType.Parent ? '#e0e7ff' : '#fef3c7');
                    const iconColor = (client.clientType === ClientType.Parent && !clientEnrollmentColors.get(client.id)) ? '#311B92' : 
                                    (client.clientType === ClientType.Institutional) ? '#E65100' : 
                                    '#444';
                    return (
                  <tr key={client.id} className="border-b hover:bg-gray-50" style={{ borderColor: 'var(--md-divider)'}}>
                    <td className="p-4">
                      <div className="flex items-center">
                         <div className="w-10 h-10 rounded-full mr-3 flex items-center justify-center shadow-sm border border-gray-100" 
                              style={{minWidth: '2.5rem', backgroundColor: avatarColor}}>
                             {client.clientType === ClientType.Parent ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" style={{color: iconColor}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                             ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" style={{color: iconColor}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                             )}
                         </div>
                        <span className="font-medium">{client.clientType === ClientType.Parent ? `${client.firstName} ${client.lastName}` : client.companyName}</span>
                      </div>
                    </td>
                     <td className="p-4">
                        <span className={`md-badge ${client.clientType === ClientType.Parent ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                            {client.clientType === ClientType.Parent ? 'Genitore' : 'Istituzionale'}
                        </span>
                     </td>
                    <td className="p-4 text-sm" style={{ color: 'var(--md-text-secondary)'}}>
                      <div>{client.email}</div>
                      <div>{client.phone}</div>
                    </td>
                    <td className="p-4 text-sm" style={{ color: 'var(--md-text-secondary)'}}>
                        {client.clientType === ClientType.Parent ? client.children.length : 'N/A'}
                    </td>
                    <td className="p-4">
                        <div className="flex items-center space-x-2">
                            <button onClick={() => setSelectedClient(client)} className="md-btn md-btn-flat md-btn-primary text-sm">Dettagli</button>
                            <button onClick={() => handleOpenModal(client)} className="md-icon-btn edit" aria-label="Modifica cliente"><PencilIcon /></button>
                            <button onClick={() => handleDeleteClick(client.id)} className="md-icon-btn delete" aria-label="Elimina cliente"><TrashIcon /></button>
                        </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
            </div>
           </>
            }
        </div>

        <ConfirmModal 
            isOpen={!!clientToDelete}
            onClose={() => setClientToDelete(null)}
            onConfirm={handleConfirmDelete}
            title="Elimina Cliente"
            message="Sei sicuro di voler eliminare questo cliente? L'azione non può essere annullata."
            isDangerous={true}
        />
    </div>
  );
};

export default Clients;
