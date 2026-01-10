
import React, { useState, useEffect, useMemo } from 'react';
import { getAllEnrollments } from '../services/enrollmentService';
import { getSuppliers } from '../services/supplierService';
import { Enrollment, EnrollmentStatus, Supplier } from '../types';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc } from '@firebase/firestore';
import Spinner from '../components/Spinner';
import SearchIcon from '../components/icons/SearchIcon';
import Pagination from '../components/Pagination';
import PencilIcon from '../components/icons/PencilIcon';
import Modal from '../components/Modal';

// Icona Scambio Sede
const SwitchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
);

interface ArchiveItem {
    id: string; // Composite key: enrollmentId-lessonId
    enrollmentId: string; // Store raw enrollment ID
    date: string;
    childName: string;
    locationName: string;
    locationColor: string;
    startTime: string;
    value: number;
}

// --- MODALE CAMBIO SEDE ---
const ChangeLocationModal: React.FC<{
    enrollmentId: string;
    childName: string;
    currentLocationName: string;
    suppliers: Supplier[];
    onClose: () => void;
    onSave: (enrollmentId: string, newLocationId: string, newLocationName: string, newLocationColor: string, fromDate: string) => Promise<void>;
}> = ({ enrollmentId, childName, currentLocationName, suppliers, onClose, onSave }) => {
    const [selectedLocId, setSelectedLocId] = useState('');
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    // Flatten locations
    const allLocations = useMemo(() => {
        const locs: {id: string, name: string, color: string}[] = [];
        suppliers.forEach(s => s.locations.forEach(l => locs.push({id: l.id, name: l.name, color: l.color})));
        return locs.sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const handleConfirm = async () => {
        if (!selectedLocId || !fromDate) return alert("Seleziona sede e data.");
        const loc = allLocations.find(l => l.id === selectedLocId);
        if (!loc) return;

        setLoading(true);
        await onSave(enrollmentId, loc.id, loc.name, loc.color, fromDate);
        setLoading(false);
        onClose();
    };

    return (
        <Modal onClose={onClose} size="md">
            <div className="p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Cambio Sede: {childName}</h3>
                <p className="text-sm text-gray-500 mb-6">
                    Attualmente in: <strong>{currentLocationName}</strong>. 
                    <br/>La modifica influirà sul registro presenze e sui costi di nolo a partire dalla data selezionata.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Nuova Sede</label>
                        <select 
                            value={selectedLocId} 
                            onChange={e => setSelectedLocId(e.target.value)} 
                            className="md-input bg-white"
                        >
                            <option value="">Seleziona...</option>
                            {allLocations.map(l => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="md-input-group">
                        <input 
                            type="date" 
                            value={fromDate} 
                            onChange={e => setFromDate(e.target.value)} 
                            className="md-input" 
                        />
                        <label className="md-input-label !top-0">A partire dal</label>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={onClose} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                    <button onClick={handleConfirm} disabled={loading || !selectedLocId} className="md-btn md-btn-raised md-btn-primary md-btn-sm">
                        {loading ? 'Salvataggio...' : 'Conferma Cambio'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const AttendanceArchive: React.FC = () => {
    const [items, setItems] = useState<ArchiveItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    
    // Modal State
    const [modalConfig, setModalConfig] = useState<{isOpen: boolean, enrollmentId: string, childName: string, currentLocationName: string} | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const fetchArchive = async () => {
        setLoading(true);
        try {
            const [enrollmentsData, suppliersData] = await Promise.all([
                getAllEnrollments(),
                getSuppliers()
            ]);
            
            setSuppliers(suppliersData);

            const archive: ArchiveItem[] = [];

            enrollmentsData.forEach((enr: Enrollment) => {
                const unitValue = (enr.price || 0) / (enr.lessonsTotal || 1);
                
                if (enr.appointments) {
                    enr.appointments.forEach(app => {
                        if (app.status === 'Present') {
                            archive.push({
                                id: `${enr.id}-${app.lessonId}`,
                                enrollmentId: enr.id,
                                date: app.date,
                                childName: enr.childName,
                                locationName: app.locationName || enr.locationName, // Fallback
                                locationColor: app.locationColor || enr.locationColor || '#ccc',
                                startTime: app.startTime,
                                value: unitValue
                            });
                        }
                    });
                }
            });

            // Sort by date desc
            archive.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setItems(archive);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchArchive();
    }, []);

    // Unique Locations for Filter
    const uniqueLocations = useMemo(() => {
        const locs = new Set<string>();
        suppliers.forEach(s => s.locations.forEach(l => locs.add(l.name)));
        return Array.from(locs).sort();
    }, [suppliers]);

    // Logic for Updating Location
    const handleUpdateLocation = async (enrollmentId: string, newLocationId: string, newLocationName: string, newLocationColor: string, fromDate: string) => {
        try {
            const enrRef = doc(db, 'enrollments', enrollmentId);
            const snap = await getDoc(enrRef);
            
            if (snap.exists()) {
                const enr = snap.data() as Enrollment;
                const fromDateObj = new Date(fromDate);
                fromDateObj.setHours(0,0,0,0);

                // 1. Update Appointments (Present or Future or Scheduled) from date
                const updatedAppointments = (enr.appointments || []).map(app => {
                    const appDate = new Date(app.date);
                    // Update if date matches or is future
                    if (appDate >= fromDateObj) {
                        return {
                            ...app,
                            locationName: newLocationName,
                            locationColor: newLocationColor
                        };
                    }
                    return app;
                });

                // 2. Update Enrollment Main Location 
                // (Assumes the change reflects current status if date is <= now)
                // Even if date is future, updating main location prepares for future rent calc.
                await updateDoc(enrRef, {
                    locationId: newLocationId,
                    locationName: newLocationName,
                    locationColor: newLocationColor,
                    appointments: updatedAppointments
                });

                alert("Sede aggiornata con successo.");
                fetchArchive(); // Refresh list
            }
        } catch (e) {
            console.error(e);
            alert("Errore durante l'aggiornamento della sede.");
        }
    };

    // Reset pagination
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterLocation]);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesSearch = item.childName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  item.locationName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesLocation = filterLocation === '' || item.locationName === filterLocation;
            return matchesSearch && matchesLocation;
        });
    }, [items, searchTerm, filterLocation]);

    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredItems.slice(start, start + itemsPerPage);
    }, [filteredItems, currentPage]);

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Archivio Presenze</h1>
                <p className="mt-1 text-gray-500">Storico degli slot consumati e loro valore.</p>
            </div>

            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                    <input 
                        type="text" 
                        className="block w-full bg-gray-50 border border-gray-300 rounded-lg py-2 pl-10 pr-3 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Cerca bambino..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-64">
                    <select 
                        value={filterLocation} 
                        onChange={(e) => setFilterLocation(e.target.value)} 
                        className="block w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="">Tutte le Sedi</option>
                        {uniqueLocations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold border-b">
                                <tr>
                                    <th className="p-4">Data</th>
                                    <th className="p-4">Bambino</th>
                                    <th className="p-4">Sede (Slot Consumato)</th>
                                    <th className="p-4 text-right">Valore Slot</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedItems.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-mono text-gray-600">
                                            {new Date(item.date).toLocaleDateString()} <span className="text-xs text-gray-400 ml-1">{item.startTime}</span>
                                        </td>
                                        <td className="p-4 font-bold text-gray-800">{item.childName}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                    <span className="w-2 h-2 rounded-full mr-1.5" style={{backgroundColor: item.locationColor}}></span>
                                                    {item.locationName}
                                                </span>
                                                <button 
                                                    onClick={() => setModalConfig({
                                                        isOpen: true, 
                                                        enrollmentId: item.enrollmentId, 
                                                        childName: item.childName, 
                                                        currentLocationName: item.locationName
                                                    })}
                                                    className="text-gray-400 hover:text-indigo-600 p-1 rounded-full hover:bg-indigo-50 transition-colors"
                                                    title="Cambia Sede (Nuova Sede)"
                                                >
                                                    <SwitchIcon />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-green-600 font-bold">
                                            {item.value.toFixed(2)}€
                                        </td>
                                    </tr>
                                ))}
                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-500 italic">Nessuno storico trovato.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <Pagination 
                        currentPage={currentPage} 
                        totalItems={filteredItems.length} 
                        itemsPerPage={itemsPerPage} 
                        onPageChange={setCurrentPage} 
                    />
                </div>
            )}

            {modalConfig && (
                <ChangeLocationModal 
                    enrollmentId={modalConfig.enrollmentId}
                    childName={modalConfig.childName}
                    currentLocationName={modalConfig.currentLocationName}
                    suppliers={suppliers}
                    onClose={() => setModalConfig(null)}
                    onSave={handleUpdateLocation}
                />
            )}
        </div>
    );
};

export default AttendanceArchive;
