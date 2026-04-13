import React, { useState, useEffect, useMemo } from 'react';
import { Enrollment, Client, Course, ClientType, EnrollmentStatus, ParentClient, InstitutionalClient, Location, Supplier, SubscriptionType } from '../types';
import { getOpenCourses, getLocations } from '../services/courseService';
import { getSuppliers } from '../services/supplierService';
import { getSubscriptionTypes } from '../services/settingsService';
import { addEnrollment, activateEnrollmentWithLocation } from '../services/enrollmentService';
import { db } from '../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import Modal from './Modal';
import Spinner from './Spinner';
import toast from 'react-hot-toast';

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
    const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
    const [loading, setLoading] = useState(false);
    const [renewalStartDate, setRenewalStartDate] = useState(new Date().toISOString().split('T')[0]);

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
            getSubscriptionTypes().then(setSubscriptionTypes).catch(console.error);
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
        const filtered = allEnrollments.filter(e => 
            e.clientId === selectedClientId && 
            (e.status === EnrollmentStatus.Active || e.status === EnrollmentStatus.Completed || e.status === EnrollmentStatus.Expired)
        );
        
        const latestByChild: Record<string, Enrollment> = {};
        filtered.forEach(e => {
            const key = e.childId || e.childName || 'default';
            if (!latestByChild[key] || new Date(e.endDate) > new Date(latestByChild[key].endDate)) {
                latestByChild[key] = e;
            }
        });
        
        return Object.values(latestByChild).sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
    }, [selectedClientId, allEnrollments]);

    // Derived Data for Course Tab
    const courseEnrollments = useMemo(() => {
        if (!selectedCourseId) return [];
        const course = courses.find(c => c.id === selectedCourseId);
        if (!course) return [];

        const filtered = allEnrollments.filter(e => {
            // 1. Direct link
            if (e.courseId === selectedCourseId) return true;

            // 2. Fuzzy match for manual enrollments
            if (!e.courseId || e.courseId === 'manual') {
                const enrDate = e.appointments?.[0]?.date ? new Date(e.appointments[0].date) : (e.startDate ? new Date(e.startDate) : null);
                if (!enrDate) return false;

                const matchLocation = e.locationId === course.locationId;
                const matchDay = enrDate.getDay() === course.dayOfWeek;
                
                const enrTime = e.appointments?.[0]?.startTime || '00:00';
                const matchTime = enrTime === course.startTime;

                return matchLocation && matchDay && matchTime;
            }

            return false;
        }).filter(e => e.status === EnrollmentStatus.Active || e.status === EnrollmentStatus.Completed || e.status === EnrollmentStatus.Expired);

        const latestByClientChild: Record<string, Enrollment> = {};
        filtered.forEach(e => {
            const key = `${e.clientId}_${e.childId || e.childName || 'default'}`;
            if (!latestByClientChild[key] || new Date(e.endDate) > new Date(latestByClientChild[key].endDate)) {
                latestByClientChild[key] = e;
            }
        });

        return Object.values(latestByClientChild).sort((a, b) => a.childName.localeCompare(b.childName));
    }, [selectedCourseId, allEnrollments, courses]);

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
        let course = courses.find(c => c.id === enrollment.courseId);
        
        // If it's a manual enrollment, we try to find a matching course or use the enrollment's own details
        if (!course && (enrollment.courseId === 'manual' || !enrollment.courseId)) {
            // Try to find a course that matches the location and day
            const enrDate = enrollment.appointments?.[0]?.date ? new Date(enrollment.appointments[0].date) : (enrollment.startDate ? new Date(enrollment.startDate) : null);
            if (enrDate) {
                course = courses.find(c => c.locationId === enrollment.locationId && c.dayOfWeek === enrDate.getDay());
            }
        }

        // Manual Start Date from state
        const newStartDate = new Date(renewalStartDate);
        if (isNaN(newStartDate.getTime())) throw new Error("Data di inizio rinnovo non valida");
        
        // Calculate Automatic End Date based on Subscription Duration
        const subType = subscriptionTypes.find(st => st.id === enrollment.subscriptionTypeId);
        const duration = subType?.durationInDays || 30; // Default to 30 if not found
        
        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + duration - 1);

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
            courseId: course?.id || enrollment.courseId,
            lessonsTotal: enrollment.lessonsTotal,
            lessonsRemaining: enrollment.lessonsTotal,
            labCount: enrollment.labCount,
            sgCount: enrollment.sgCount,
            evtCount: enrollment.evtCount,
            readCount: enrollment.readCount,
            labRemaining: enrollment.labCount,
            sgRemaining: enrollment.sgCount,
            evtRemaining: enrollment.evtCount,
            readRemaining: enrollment.readCount,
            startDate: newStartDate.toISOString(),
            endDate: newEndDate.toISOString(), 
            status: EnrollmentStatus.Active,
            isRenewal: true,
            previousEnrollmentId: enrollment.id,
            createdAt: new Date().toISOString()
        };

        const newId = await addEnrollment(newEnrollmentData);
        
        // If we have a course (direct or fuzzy matched), use its details for activation
        if (course) {
            const location = locations.find(l => l.id === course.locationId);
            const supplier = suppliers.find(s => s.id === location?.supplierId);
            
            await activateEnrollmentWithLocation(
                newId,
                location?.supplierId || enrollment.supplierId || 'unassigned',
                supplier?.companyName || enrollment.supplierName || '', 
                course.locationId,
                location?.name || enrollment.locationName || 'Sede',
                location?.color || enrollment.locationColor || '#ccc',
                course.dayOfWeek,
                course.startTime,
                course.endTime
            );
        } else {
            // Fallback for purely manual renewal without a matching course
            const startTime = enrollment.appointments?.[0]?.startTime || '16:00';
            const endTime = enrollment.appointments?.[0]?.endTime || '18:00';
            const dayOfWeek = new Date(newStartDate).getDay();
            
            await activateEnrollmentWithLocation(
                newId,
                enrollment.supplierId || 'unassigned',
                enrollment.supplierName || '',
                enrollment.locationId || 'unassigned',
                enrollment.locationName || 'Sede',
                enrollment.locationColor || '#ccc',
                dayOfWeek,
                startTime,
                endTime
            );
        }

        // Force the calculated End Date (respecting the subscription duration)
        await updateDoc(doc(db, 'enrollments', newId), {
            endDate: newEndDate.toISOString()
        });
    };

    const handleRenewSingle = async (enrollment: Enrollment) => {
        setLoading(true);
        try {
            await processRenewal(enrollment);
            toast.success("Rinnovo completato con successo.");
            onRefresh();
            onClose();
        } catch (e) {
            toast.error("Errore durante il rinnovo: " + (e instanceof Error ? e.message : String(e)));
        } finally {
            setLoading(false);
        }
    };

    const handleRenewBatch = async () => {
        if (selectedEnrollmentIds.length === 0) return toast.error("Seleziona almeno un'iscrizione.");
        
        setLoading(true);
        try {
            const toRenew = courseEnrollments.filter(e => selectedEnrollmentIds.includes(e.id));
            for (const enr of toRenew) {
                await processRenewal(enr);
            }
            toast.success("Rinnovi completati con successo.");
            setSelectedEnrollmentIds([]);
            onRefresh();
            onClose();
        } catch (e) {
            toast.error("Errore durante i rinnovi: " + (e instanceof Error ? e.message : String(e)));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} size="lg">
            <div className="flex flex-col h-full max-h-[90dvh] overflow-hidden">
                {/* Header Fissato */}
                <div className="p-6 border-b bg-gray-50 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-2xl font-bold text-gray-800">Rinnovo Iscrizioni</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Area Scrollabile */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {/* Data Inizio Rinnovo */}
                    <div className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <p className="text-indigo-900 font-bold">Data Inizio Rinnovo</p>
                            <p className="text-xs text-indigo-700">Tutti i rinnovi inizieranno in questa data. La scadenza sarà calcolata automaticamente.</p>
                        </div>
                        <input 
                            type="date" 
                            className="md-input border-indigo-200 focus:ring-indigo-500" 
                            value={renewalStartDate}
                            onChange={e => setRenewalStartDate(e.target.value)}
                        />
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
                                                    <p className="text-sm text-gray-600">
                                                        {e.courseId && e.courseId !== 'manual' ? 'Corso: ' : 'Manuale: '}
                                                        {location?.name || e.locationName || 'Sede Sconosciuta'}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                            e.status === EnrollmentStatus.Active ? 'bg-green-100 text-green-700' :
                                                            e.status === EnrollmentStatus.Completed ? 'bg-blue-100 text-blue-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {e.status}
                                                        </span>
                                                        <p className="text-xs text-gray-500">Scadenza: {new Date(e.endDate).toLocaleDateString('it-IT')}</p>
                                                    </div>
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
        </div>
    </Modal>
);
};

export default RenewalModal;
