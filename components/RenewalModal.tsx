import React, { useState, useEffect, useMemo } from 'react';
import { Enrollment, Client, Course, ClientType, EnrollmentStatus, ParentClient, InstitutionalClient, Location, Supplier } from '../types';
import { getOpenCourses, getLocations } from '../services/courseService';
import { getSuppliers } from '../services/supplierService';
import { addEnrollment, activateEnrollmentWithLocation } from '../services/enrollmentService';
import Modal from './Modal';
import Spinner from './Spinner';

interface RenewalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
    allEnrollments: Enrollment[];
    allClients: Client[];
}

const RenewalModal: React.FC<RenewalModalProps> = ({ isOpen, onClose, onRefresh, allEnrollments, allClients }) => {
    const [activeTab, setActiveTab] = useState<'single' | 'course'>('single');
    const [courses, setCourses] = useState<Course[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(false);

    // Single Tab State
    const [searchClient, setSearchClient] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    // Course Tab State
    const [selectedCourseId, setSelectedCourseId] = useState<string>('');
    const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            getOpenCourses().then(setCourses).catch(console.error);
            getLocations().then(setLocations).catch(console.error);
            getSuppliers().then(setSuppliers).catch(console.error);
        }
    }, [isOpen]);

    // Derived Data for Single Tab
    const filteredClients = useMemo(() => {
        if (!searchClient.trim()) return [];
        const term = searchClient.toLowerCase();
        return allClients.filter(c => {
            const name = c.clientType === ClientType.Parent 
                ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}`.toLowerCase() 
                : (c as InstitutionalClient).companyName?.toLowerCase() || '';
            return name.includes(term);
        }).slice(0, 5);
    }, [searchClient, allClients]);

    const clientEnrollments = useMemo(() => {
        if (!selectedClientId) return [];
        return allEnrollments.filter(e => e.clientId === selectedClientId && e.courseId);
    }, [selectedClientId, allEnrollments]);

    // Derived Data for Course Tab
    const courseEnrollments = useMemo(() => {
        if (!selectedCourseId) return [];
        return allEnrollments.filter(e => e.courseId === selectedCourseId && e.status === EnrollmentStatus.Active);
    }, [selectedCourseId, allEnrollments]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedEnrollmentIds(courseEnrollments.map(e => e.id));
        } else {
            setSelectedEnrollmentIds([]);
        }
    };

    const handleToggleEnrollment = (id: string) => {
        setSelectedEnrollmentIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const processRenewal = async (enrollment: Enrollment) => {
        const course = courses.find(c => c.id === enrollment.courseId);
        if (!course) throw new Error("Corso non trovato");
        
        const location = locations.find(l => l.id === course.locationId);
        if (!location) throw new Error("Sede del corso non trovata");

        // Calculate new start date (1 day after current end date)
        const currentEndDate = new Date(enrollment.endDate);
        if (isNaN(currentEndDate.getTime())) throw new Error("Data di fine iscrizione non valida");
        
        const newStartDate = new Date(currentEndDate);
        newStartDate.setDate(newStartDate.getDate() + 1);

        const newEnrollmentData = {
            clientId: enrollment.clientId,
            clientType: enrollment.clientType,
            childId: enrollment.childId,
            childName: enrollment.childName,
            isAdult: enrollment.isAdult,
            isQuoteBased: enrollment.isQuoteBased,
            subscriptionTypeId: enrollment.subscriptionTypeId,
            subscriptionName: enrollment.subscriptionName,
            price: enrollment.price,
            supplierId: enrollment.supplierId,
            supplierName: enrollment.supplierName,
            locationId: enrollment.locationId,
            locationName: enrollment.locationName,
            locationColor: enrollment.locationColor,
            courseId: enrollment.courseId,
            lessonsTotal: enrollment.lessonsTotal,
            lessonsRemaining: enrollment.lessonsTotal,
            startDate: newStartDate.toISOString(),
            endDate: newStartDate.toISOString(), // Will be updated by activate
            status: EnrollmentStatus.Active,
            isRenewal: true,
            previousEnrollmentId: enrollment.id,
            createdAt: new Date().toISOString()
        };

        const newId = await addEnrollment(newEnrollmentData);
        
        const supplier = suppliers.find(s => s.id === location.supplierId);
        
        await activateEnrollmentWithLocation(
            newId,
            location.supplierId || 'unassigned',
            supplier?.companyName || '', 
            course.locationId,
            location.name,
            location.color,
            course.dayOfWeek,
            course.startTime,
            course.endTime
        );
    };

    const handleRenewSingle = async (enrollment: Enrollment) => {
        if (!window.confirm(`Vuoi rinnovare l'iscrizione per ${enrollment.childName}?`)) return;
        setLoading(true);
        try {
            await processRenewal(enrollment);
            alert("Rinnovo completato con successo.");
            onRefresh();
            onClose();
        } catch (e) {
            alert("Errore durante il rinnovo: " + (e instanceof Error ? e.message : String(e)));
        } finally {
            setLoading(false);
        }
    };

    const handleRenewBatch = async () => {
        if (selectedEnrollmentIds.length === 0) return alert("Seleziona almeno un'iscrizione.");
        if (!window.confirm(`Vuoi rinnovare ${selectedEnrollmentIds.length} iscrizioni?`)) return;
        
        setLoading(true);
        try {
            const toRenew = courseEnrollments.filter(e => selectedEnrollmentIds.includes(e.id));
            for (const enr of toRenew) {
                await processRenewal(enr);
            }
            alert("Rinnovi completati con successo.");
            onRefresh();
            onClose();
        } catch (e) {
            alert("Errore durante i rinnovi: " + (e instanceof Error ? e.message : String(e)));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} size="lg">
            <div className="p-6 max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Rinnovo Iscrizioni</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-6">
                    <button 
                        className={`py-2 px-4 font-bold text-sm ${activeTab === 'single' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('single')}
                    >
                        Rinnovo Singolo Cliente
                    </button>
                    <button 
                        className={`py-2 px-4 font-bold text-sm ${activeTab === 'course' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('course')}
                    >
                        Rinnovo Multiplo per Corso
                    </button>
                </div>

                {activeTab === 'single' && (
                    <div>
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Cerca Cliente</label>
                            <input 
                                type="text" 
                                className="md-input w-full" 
                                placeholder="Nome, cognome o azienda..." 
                                value={searchClient}
                                onChange={e => { setSearchClient(e.target.value); setSelectedClientId(''); }}
                            />
                            {searchClient && !selectedClientId && (
                                <ul className="mt-2 border rounded-md shadow-sm bg-white max-h-48 overflow-y-auto">
                                    {filteredClients.map(c => (
                                        <li 
                                            key={c.id} 
                                            className="p-2 hover:bg-indigo-50 cursor-pointer text-sm"
                                            onClick={() => { setSelectedClientId(c.id); setSearchClient(c.clientType === ClientType.Parent ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` : (c as InstitutionalClient).companyName || ''); }}
                                        >
                                            {c.clientType === ClientType.Parent ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` : (c as InstitutionalClient).companyName}
                                        </li>
                                    ))}
                                    {filteredClients.length === 0 && <li className="p-2 text-sm text-gray-500">Nessun cliente trovato.</li>}
                                </ul>
                            )}
                        </div>

                        {selectedClientId && (
                            <div>
                                <h4 className="font-bold text-gray-800 mb-3">Iscrizioni Trovate (associate a un corso)</h4>
                                {clientEnrollments.length === 0 ? (
                                    <p className="text-sm text-gray-500">Nessuna iscrizione rinnovabile trovata per questo cliente.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {clientEnrollments.map(e => {
                                            const course = courses.find(c => c.id === e.courseId);
                                            const location = locations.find(l => l.id === course?.locationId);
                                            return (
                                            <div key={e.id} className="p-4 border rounded-lg flex justify-between items-center bg-gray-50">
                                                <div>
                                                    <p className="font-bold text-gray-800">{e.childName}</p>
                                                    <p className="text-sm text-gray-600">Corso: {location?.name || 'Sconosciuto'}</p>
                                                    <p className="text-xs text-gray-500">Scadenza: {new Date(e.endDate).toLocaleDateString('it-IT')}</p>
                                                </div>
                                                <button 
                                                    onClick={() => handleRenewSingle(e)}
                                                    disabled={loading}
                                                    className="md-btn md-btn-raised md-btn-primary md-btn-sm"
                                                >
                                                    {loading ? <Spinner /> : 'Rinnova'}
                                                </button>
                                            </div>
                                        )})}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'course' && (
                    <div>
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Seleziona Corso</label>
                            <select 
                                className="md-input w-full"
                                value={selectedCourseId}
                                onChange={e => { setSelectedCourseId(e.target.value); setSelectedEnrollmentIds([]); }}
                            >
                                <option value="">-- Seleziona un corso --</option>
                                {courses.map(c => {
                                    const location = locations.find(l => l.id === c.locationId);
                                    const days = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];
                                    return (
                                    <option key={c.id} value={c.id}>{location?.name || 'Sconosciuto'} -&gt; {c.slotType} - {days[c.dayOfWeek]} {c.startTime}</option>
                                )})}
                            </select>
                        </div>

                        {selectedCourseId && (
                            <div>
                                <div className="flex justify-between items-end mb-3">
                                    <h4 className="font-bold text-gray-800">Allievi Iscritti</h4>
                                    <span className="text-sm text-gray-500">{selectedEnrollmentIds.length} selezionati</span>
                                </div>
                                
                                {courseEnrollments.length === 0 ? (
                                    <p className="text-sm text-gray-500">Nessun allievo attivo in questo corso.</p>
                                ) : (
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">
                                                        <input 
                                                            type="checkbox" 
                                                            className="rounded text-indigo-600"
                                                            checked={selectedEnrollmentIds.length === courseEnrollments.length && courseEnrollments.length > 0}
                                                            onChange={handleSelectAll}
                                                        />
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allievo</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scadenza</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {courseEnrollments.map(e => (
                                                    <tr key={e.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3">
                                                            <input 
                                                                type="checkbox" 
                                                                className="rounded text-indigo-600"
                                                                checked={selectedEnrollmentIds.includes(e.id)}
                                                                onChange={() => handleToggleEnrollment(e.id)}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{e.childName}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(e.endDate).toLocaleDateString('it-IT')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="mt-6 flex justify-end">
                                    <button 
                                        onClick={handleRenewBatch}
                                        disabled={loading || selectedEnrollmentIds.length === 0}
                                        className="md-btn md-btn-raised md-btn-primary"
                                    >
                                        {loading ? <Spinner /> : `Rinnova Selezionati (${selectedEnrollmentIds.length})`}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default RenewalModal;
