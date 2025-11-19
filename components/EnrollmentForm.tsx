
import React, { useState, useEffect } from 'react';
import { ParentClient, Child, EnrollmentInput, EnrollmentStatus, SubscriptionType, Supplier, AvailabilitySlot, Appointment, Enrollment } from '../types';
import { getSubscriptionTypes } from '../services/settingsService';
import { getSuppliers } from '../services/supplierService';
import Spinner from './Spinner';

const daysOfWeekMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

interface EnrollmentFormProps {
    parent: ParentClient;
    existingEnrollment?: Enrollment; // Opzionale, per la modifica
    // Modificato: onSave ora accetta un array di iscrizioni per supportare l'inserimento multiplo
    onSave: (enrollments: EnrollmentInput[]) => void;
    onCancel: () => void;
}

const EnrollmentForm: React.FC<EnrollmentFormProps> = ({ parent, existingEnrollment, onSave, onCancel }) => {
    // State per selezione multipla figli
    const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
    
    const [subscriptionTypeId, setSubscriptionTypeId] = useState(existingEnrollment?.subscriptionTypeId || '');
    const [supplierId, setSupplierId] = useState(existingEnrollment?.supplierId || '');
    const [locationId, setLocationId] = useState(existingEnrollment?.locationId || '');
    const [startDateInput, setStartDateInput] = useState(existingEnrollment ? existingEnrollment.startDate.split('T')[0] : new Date().toISOString().split('T')[0]); 
    const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false); // Per simulare il dropdown custom

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

            if (!existingEnrollment) {
                // Valori default solo se nuova iscrizione
                // Seleziona di default il primo figlio se presente
                if (parent.children.length > 0) {
                    setSelectedChildIds([parent.children[0].id]);
                }
                if (subs.length > 0) setSubscriptionTypeId(subs[0].id);
                if (suppliersData.length > 0) {
                    setSupplierId(suppliersData[0].id);
                    if (suppliersData[0].locations.length > 0) {
                        setLocationId(suppliersData[0].locations[0].id);
                    }
                }
            } else {
                // Se modifica, impostiamo l'ID del figlio esistente
                setSelectedChildIds([existingEnrollment.childId]);

                // Se modifica, tentiamo di pre-selezionare lo slot corretto (logica euristica)
                // Si basa sul primo appuntamento per capire giorno e ora
                if(existingEnrollment.appointments && existingEnrollment.appointments.length > 0) {
                    const firstApp = existingEnrollment.appointments[0];
                    const appDate = new Date(firstApp.date);
                    const appDay = appDate.getDay();
                    const appStart = firstApp.startTime;
                    
                    // Dobbiamo trovare questo slot nella location corrente (se i dati sono caricati)
                    // Questo viene fatto nel render o in un effect successivo, ma qui suppliersData è appena arrivato.
                    const supplier = suppliersData.find(s => s.id === existingEnrollment.supplierId);
                    const location = supplier?.locations.find(l => l.id === existingEnrollment.locationId);
                    if(location && location.availability) {
                        const slotIdx = location.availability.findIndex(slot => slot.dayOfWeek === appDay && slot.startTime === appStart);
                        if(slotIdx >= 0) setSelectedSlotIndex(slotIdx);
                    }
                }
            }
            setLoading(false);
        };
        fetchData();
    }, [parent.children, existingEnrollment]);

    const handleSupplierChange = (newSupplierId: string) => {
        setSupplierId(newSupplierId);
        const newSupplier = suppliers.find(s => s.id === newSupplierId);
        if (newSupplier && newSupplier.locations.length > 0) {
            setLocationId(newSupplier.locations[0].id);
            setSelectedSlotIndex(null); 
        } else {
            setLocationId('');
            setSelectedSlotIndex(null);
        }
    };

    const handleLocationChange = (newLocationId: string) => {
        setLocationId(newLocationId);
        setSelectedSlotIndex(null);
    };

    const toggleChildSelection = (childId: string) => {
        // Se siamo in modifica, non permettiamo di cambiare il figlio o selezionarne multipli
        if (existingEnrollment) return;

        setSelectedChildIds(prev => {
            if (prev.includes(childId)) {
                return prev.filter(id => id !== childId);
            } else {
                return [...prev, childId];
            }
        });
    };

    // Helper per generare le date delle lezioni
    const generateAppointments = (startDate: Date, slot: AvailabilitySlot, numLessons: number, locName: string, locColor: string, childName: string): Appointment[] => {
        const appointments: Appointment[] = [];
        let currentDate = new Date(startDate);
        let lessonsScheduled = 0;

        // Trova la prima data utile che corrisponde al giorno della settimana
        while (currentDate.getDay() !== slot.dayOfWeek) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Se la data trovata è precedente alla data di input (caso limite), aggiungi 7 giorni
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
        
        if (selectedChildIds.length === 0) {
            alert("Seleziona almeno un figlio.");
            return;
        }

        const selectedSub = subscriptionTypes.find(s => s.id === subscriptionTypeId);
        const selectedSupplier = suppliers.find(s => s.id === supplierId);
        const selectedLocation = selectedSupplier?.locations.find(l => l.id === locationId);
        
        if (!selectedSub || !selectedSupplier || !selectedLocation) return;
        
        if (selectedSlotIndex === null) {
            alert("Per favore seleziona un orario disponibile per le lezioni.");
            return;
        }
        const selectedSlot = selectedLocation.availability ? selectedLocation.availability[selectedSlotIndex] : null;
        if (!selectedSlot) return;

        const enrollmentsToSave: EnrollmentInput[] = [];

        // Ciclo su tutti i figli selezionati per creare N iscrizioni
        selectedChildIds.forEach(childId => {
            const childObj = parent.children.find(c => c.id === childId);
            if (!childObj) return;

            const startObj = new Date(startDateInput);
            // Rigeneriamo gli appuntamenti per ogni figlio per avere ID univoci e nome corretto
            const appointments = generateAppointments(
                startObj, 
                selectedSlot, 
                selectedSub.lessons, 
                selectedLocation.name, 
                selectedLocation.color,
                childObj.name
            );
            
            const startDate = appointments.length > 0 ? appointments[0].date : startObj.toISOString();
            const endDate = appointments.length > 0 ? appointments[appointments.length - 1].date : startObj.toISOString();

            const newEnrollment: EnrollmentInput = {
                clientId: parent.id,
                childId: childObj.id,
                childName: childObj.name,
                subscriptionTypeId,
                subscriptionName: selectedSub.name,
                price: selectedSub.price,
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
                status: existingEnrollment ? existingEnrollment.status : EnrollmentStatus.Pending, 
            };
            
            if (existingEnrollment) {
                 // Se siamo in modifica, sovrascriviamo l'ID
                 (newEnrollment as any).id = existingEnrollment.id;
            }

            enrollmentsToSave.push(newEnrollment);
        });

        onSave(enrollmentsToSave);
    };

    const selectedSupplier = suppliers.find(s => s.id === supplierId);
    const selectedLocation = selectedSupplier?.locations.find(l => l.id === locationId);

    if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[85vh]">
            <h2 className="text-xl font-bold mb-4 flex-shrink-0 border-b pb-3">{existingEnrollment ? 'Modifica Iscrizione' : 'Nuova Iscrizione'}</h2>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                
                {/* Selettore Multiplo Figli */}
                <div className="md-input-group relative">
                    <label className="block text-xs text-gray-500 absolute top-0 left-0">Figli (Seleziona uno o più)</label>
                    
                    <div 
                        className="md-input cursor-pointer flex justify-between items-center mt-2"
                        onClick={() => !existingEnrollment && setIsDropdownOpen(!isDropdownOpen)}
                    >
                        <span className="truncate">
                            {selectedChildIds.length === 0 
                                ? "Seleziona figli..." 
                                : selectedChildIds.map(id => parent.children.find(c => c.id === id)?.name).join(', ')}
                        </span>
                        {!existingEnrollment && (
                            <svg className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        )}
                    </div>

                    {/* Dropdown personalizzato con Checkbox */}
                    {(isDropdownOpen || existingEnrollment) && (
                         <div className={`${existingEnrollment ? 'block mt-2' : 'absolute z-10 w-full bg-white shadow-lg border rounded-md mt-1 max-h-48 overflow-y-auto'}`}>
                            {parent.children.map(child => (
                                <label key={child.id} className={`flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer ${existingEnrollment ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedChildIds.includes(child.id)}
                                        onChange={() => toggleChildSelection(child.id)}
                                        disabled={!!existingEnrollment} // Disabilita in modifica
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-3"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-700">{child.name}</span>
                                        <span className="text-xs text-gray-500">{child.age}</span>
                                    </div>
                                </label>
                            ))}
                            {parent.children.length === 0 && (
                                <div className="px-4 py-2 text-sm text-gray-500 italic">Nessun figlio registrato in anagrafica.</div>
                            )}
                        </div>
                    )}
                    {isDropdownOpen && !existingEnrollment && (
                        <div className="fixed inset-0 z-0" onClick={() => setIsDropdownOpen(false)}></div>
                    )}
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
                                 <p className="text-sm text-red-500">Questa sede non ha orari definiti.</p>
                             )}
                         </div>
                    </div>
                )}
                
                <div className="bg-blue-50 p-3 rounded-md mt-2">
                    <p className="text-xs text-blue-800">
                        L'iscrizione sarà salvata come <strong>Transitoria (In attesa di pagamento)</strong>. I posti verranno comunque impegnati.
                    </p>
                    {selectedChildIds.length > 1 && (
                         <p className="text-xs text-blue-800 mt-1 font-semibold">
                            Verranno create {selectedChildIds.length} iscrizioni separate, una per ogni figlio selezionato.
                        </p>
                    )}
                </div>
            </div>

             <div className="mt-4 pt-4 border-t flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green" disabled={selectedSlotIndex === null || selectedChildIds.length === 0}>
                    {existingEnrollment ? 'Salva Modifiche' : `Conferma Iscrizione (${selectedChildIds.length})`}
                </button>
            </div>
        </form>
    );
};

export default EnrollmentForm;
