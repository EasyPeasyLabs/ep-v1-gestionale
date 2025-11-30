
import React, { useState, useEffect, useMemo } from 'react';
import { getAllEnrollments } from '../services/enrollmentService';
import { Enrollment, EnrollmentStatus } from '../types';
import Spinner from '../components/Spinner';
import SearchIcon from '../components/icons/SearchIcon';
import Pagination from '../components/Pagination';

interface ArchiveItem {
    id: string; // unique key
    date: string;
    childName: string;
    locationName: string;
    locationColor: string;
    startTime: string;
    value: number;
}

const AttendanceArchive: React.FC = () => {
    const [items, setItems] = useState<ArchiveItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        const fetchArchive = async () => {
            setLoading(true);
            try {
                const enrollments = await getAllEnrollments();
                const archive: ArchiveItem[] = [];

                enrollments.forEach((enr: Enrollment) => {
                    const unitValue = (enr.price || 0) / (enr.lessonsTotal || 1);
                    
                    if (enr.appointments) {
                        enr.appointments.forEach(app => {
                            if (app.status === 'Present') {
                                archive.push({
                                    id: `${enr.id}-${app.lessonId}`,
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
        fetchArchive();
    }, []);

    // Reset pagination
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const filteredItems = useMemo(() => {
        return items.filter(item => 
            item.childName.toLowerCase().includes(searchTerm.toLowerCase()) || 
            item.locationName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [items, searchTerm]);

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

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
                <div className="relative max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                    <input 
                        type="text" 
                        className="block w-full bg-gray-50 border border-gray-300 rounded-lg py-2 pl-10 pr-3 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Cerca bambino o sede..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
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
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                <span className="w-2 h-2 rounded-full mr-1.5" style={{backgroundColor: item.locationColor}}></span>
                                                {item.locationName}
                                            </span>
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
        </div>
    );
};

export default AttendanceArchive;
