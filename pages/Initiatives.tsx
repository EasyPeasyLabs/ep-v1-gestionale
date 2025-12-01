
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Initiative, InitiativeInput, Book, BookInput, BookLoan, Supplier, Enrollment, EnrollmentStatus } from '../types';
import { getInitiatives, addInitiative, updateInitiative, deleteInitiative, getBooks, addBook, updateBook, deleteBook, getActiveLoans, checkOutBook, checkInBook } from '../services/initiativeService';
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

// --- SUB-COMPONENTS ---

// 1. Initiative Form (Standard CRUD)
const InitiativeForm: React.FC<{ 
    initiative?: Initiative | null;
    suppliers: Supplier[];
    onSave: (data: InitiativeInput | Initiative) => void; 
    onCancel: () => void 
}> = ({ initiative, suppliers, onSave, onCancel }) => {
    const [name, setName] = useState(initiative?.name || '');
    const [description, setDescription] = useState(initiative?.description || '');
    const [materials, setMaterials] = useState(initiative?.materials || '');
    const [selectedLocIds, setSelectedLocIds] = useState<string[]>(initiative?.targetLocationIds || []);

    const allLocations = useMemo(() => {
        const locs: {id: string, name: string}[] = [];
        suppliers.forEach(s => s.locations.forEach(l => locs.push({id: l.id, name: l.name})));
        return locs.sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const toggleLocation = (id: string) => {
        setSelectedLocIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const locNames = selectedLocIds.map(id => allLocations.find(l => l.id === id)?.name || '').filter(Boolean);
        
        const data: InitiativeInput = {
            name, 
            description, 
            type: 'standard',
            materials,
            targetLocationIds: selectedLocIds,
            targetLocationNames: locNames
        };
        if(initiative?.id) onSave({...data, id: initiative.id}); else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 border-b"><h3 className="text-xl font-bold">{initiative ? 'Modifica Iniziativa' : 'Nuova Iniziativa'}</h3></div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="md-input-group"><input type="text" value={name} onChange={e => setName(e.target.value)} required className="md-input" placeholder=" " /><label className="md-input-label">Nome Iniziativa</label></div>
                <div className="md-input-group"><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="md-input" placeholder="Descrizione..." /></div>
                <div className="md-input-group"><textarea rows={3} value={materials} onChange={e => setMaterials(e.target.value)} className="md-input" placeholder="Materiali necessari (lista)..." /></div>
                
                <div className="border-t pt-2">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Destinatari (Recinti)</label>
                    <div className="max-h-40 overflow-y-auto border rounded p-2 grid grid-cols-2 gap-2">
                        {allLocations.map(l => (
                            <label key={l.id} className="flex items-center gap-2 text-sm p-1 hover:bg-gray-50">
                                <input type="checkbox" checked={selectedLocIds.includes(l.id)} onChange={() => toggleLocation(l.id)} className="rounded text-indigo-600"/>
                                <span>{l.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50"><button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button><button type="submit" className="md-btn md-btn-raised md-btn-primary">Salva</button></div>
        </form>
    );
};

// 2. Book Manager (Peek-a-Book)
const BookManager: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'loans' | 'checkout' | 'inventory'>('loans');
    const [books, setBooks] = useState<Book[]>([]);
    const [loans, setLoans] = useState<BookLoan[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(false);

    // Checkout State
    const [selLocationId, setSelLocationId] = useState('');
    const [selStudentId, setSelStudentId] = useState('');
    const [selBookId, setSelBookId] = useState('');
    
    // Inventory State
    const [newBookTitle, setNewBookTitle] = useState('');
    const [invSearch, setInvSearch] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [b, l, s, e] = await Promise.all([getBooks(), getActiveLoans(), getSuppliers(), getAllEnrollments()]);
            setBooks(b);
            setLoans(l);
            setSuppliers(s);
            setEnrollments(e.filter(en => en.status === EnrollmentStatus.Active));
        } catch(e) { console.error(e); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Computed Options
    const locations = useMemo(() => {
        const locs: {id: string, name: string, color: string}[] = [];
        suppliers.forEach(s => s.locations.forEach(l => locs.push({id: l.id, name: l.name, color: l.color})));
        return locs.sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const studentsInLocation = useMemo(() => {
        if(!selLocationId) return [];
        return enrollments.filter(e => e.locationId === selLocationId).map(e => ({id: e.childId, name: e.childName, clientId: e.clientId}));
    }, [selLocationId, enrollments]);

    const availableBooks = useMemo(() => books.filter(b => b.isAvailable).sort((a,b) => a.title.localeCompare(b.title)), [books]);

    // Actions
    const handleCheckout = async () => {
        if(!selLocationId || !selStudentId || !selBookId) return alert("Compila tutti i campi.");
        const book = books.find(b => b.id === selBookId);
        const loc = locations.find(l => l.id === selLocationId);
        const stud = studentsInLocation.find(s => s.id === selStudentId);
        
        if(!book || !loc || !stud) return;

        setLoading(true);
        await checkOutBook({
            bookId: book.id, bookTitle: book.title,
            studentId: stud.id, studentName: stud.name,
            locationId: loc.id, locationName: loc.name, locationColor: loc.color,
            borrowDate: new Date().toISOString(),
            status: 'active'
        });
        await fetchData();
        setSelBookId('');
        setActiveTab('loans');
    };

    const handleReturn = async (loan: BookLoan) => {
        if(confirm(`Restituire "${loan.bookTitle}" da ${loan.studentName}?`)) {
            setLoading(true);
            await checkInBook(loan.id, loan.bookId);
            await fetchData();
        }
    };

    const handleAddBook = async () => {
        if(!newBookTitle.trim()) return;
        setLoading(true);
        await addBook({ title: newBookTitle, isAvailable: true });
        setNewBookTitle('');
        await fetchData();
    };

    const handleDeleteBook = async (id: string) => {
        if(confirm("Eliminare questo libro dall'inventario?")) {
            setLoading(true);
            await deleteBook(id);
            await fetchData();
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
            {/* Header / Tabs */}
            <div className="bg-amber-50 border-b border-amber-100 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-amber-900 flex items-center gap-2">
                        📖 Peek-a-Boo(k)
                    </h3>
                    <p className="text-xs text-amber-700">Sistema Prestito Libri</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 border border-amber-200 shadow-sm">
                    <button onClick={() => setActiveTab('loans')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'loans' ? 'bg-amber-100 text-amber-800' : 'text-gray-500'}`}>Prestiti Attivi ({loans.length})</button>
                    <button onClick={() => setActiveTab('checkout')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'checkout' ? 'bg-amber-100 text-amber-800' : 'text-gray-500'}`}>Nuovo Prestito</button>
                    <button onClick={() => setActiveTab('inventory')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'inventory' ? 'bg-amber-100 text-amber-800' : 'text-gray-500'}`}>Inventario ({books.length})</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 relative">
                {loading && <div className="absolute inset-0 bg-white/50 flex justify-center items-center z-10"><Spinner /></div>}

                {activeTab === 'loans' && (
                    <div className="space-y-2">
                        {loans.length === 0 ? <p className="text-center text-gray-400 italic mt-10">Nessun libro in prestito.</p> :
                        loans.map(loan => (
                            <div key={loan.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg hover:shadow-sm">
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">{loan.bookTitle}</p>
                                    <div className="flex items-center gap-2 text-xs mt-1">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 flex items-center gap-1">
                                            👤 {loan.studentName}
                                        </span>
                                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 flex items-center gap-1">
                                            📍 {loan.locationName}
                                        </span>
                                        <span className="text-gray-400">Dal: {new Date(loan.borrowDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <button onClick={() => handleReturn(loan)} className="md-btn md-btn-sm bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
                                    Restituisci
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'checkout' && (
                    <div className="max-w-md mx-auto space-y-4 pt-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">1. Dove siamo? (Recinto)</label>
                            <select value={selLocationId} onChange={e => { setSelLocationId(e.target.value); setSelStudentId(''); }} className="md-input bg-gray-50">
                                <option value="">Seleziona Sede...</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div className={`transition-opacity ${!selLocationId ? 'opacity-50 pointer-events-none' : ''}`}>
                            <label className="block text-xs font-bold text-gray-500 mb-1">2. Chi prende il libro?</label>
                            <select value={selStudentId} onChange={e => setSelStudentId(e.target.value)} className="md-input bg-gray-50">
                                <option value="">Seleziona Allievo...</option>
                                {studentsInLocation.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className={`transition-opacity ${!selStudentId ? 'opacity-50 pointer-events-none' : ''}`}>
                            <label className="block text-xs font-bold text-gray-500 mb-1">3. Quale libro?</label>
                            <select value={selBookId} onChange={e => setSelBookId(e.target.value)} className="md-input bg-gray-50">
                                <option value="">Seleziona Libro Disponibile...</option>
                                {availableBooks.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                            </select>
                        </div>
                        <button onClick={handleCheckout} disabled={!selBookId} className="w-full md-btn md-btn-raised md-btn-primary mt-4 disabled:opacity-50">
                            Registra Prestito
                        </button>
                    </div>
                )}

                {activeTab === 'inventory' && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input type="text" value={newBookTitle} onChange={e => setNewBookTitle(e.target.value)} placeholder="Titolo nuovo libro..." className="flex-1 md-input" />
                            <button onClick={handleAddBook} disabled={!newBookTitle} className="md-btn md-btn-raised md-btn-green"><PlusIcon/></button>
                        </div>
                        <input type="text" value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Cerca nell'inventario..." className="w-full p-2 border rounded text-xs bg-gray-50" />
                        <div className="space-y-1 max-h-80 overflow-y-auto">
                            {books.filter(b => b.title.toLowerCase().includes(invSearch.toLowerCase())).map(b => (
                                <div key={b.id} className="flex justify-between items-center p-2 hover:bg-gray-50 border-b border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${b.isAvailable ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        <span className={`text-sm ${!b.isAvailable ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{b.title}</span>
                                    </div>
                                    <button onClick={() => handleDeleteBook(b.id)} className="text-gray-300 hover:text-red-500"><TrashIcon/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


const Initiatives: React.FC = () => {
    const [initiatives, setInitiatives] = useState<Initiative[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingInit, setEditingInit] = useState<Initiative | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [inits, sups] = await Promise.all([getInitiatives(), getSuppliers()]);
            // Ensure Peek-a-Boo exists locally for display if not in DB (though it should be treated as special)
            // Strategy: We will render Peek-a-Boo separately at top, and others below.
            // If Peek-a-Boo is stored in DB for config, we merge. 
            // For now, Peek-a-Boo is hardcoded as a UI block, while custom initiatives are DB driven.
            setInitiatives(inits.filter(i => i.type !== 'peek-a-book')); // Filter out if existing to avoid dupes in list
            setSuppliers(sups);
        } catch(e) { console.error(e); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (data: InitiativeInput | Initiative) => {
        if('id' in data) await updateInitiative(data.id, data);
        else await addInitiative(data);
        setIsModalOpen(false);
        fetchData();
    };

    const handleDelete = async () => {
        if(deleteId) {
            await deleteInitiative(deleteId);
            setDeleteId(null);
            fetchData();
        }
    };

    return (
        <div className="space-y-8 pb-10">
            <div>
                <h1 className="text-3xl font-bold">Iniziative</h1>
                <p className="mt-1 text-gray-500">Gestione progetti speciali e biblioteca.</p>
            </div>

            {/* PEEK-A-BOOK SECTION */}
            <section>
                <BookManager />
            </section>

            {/* OTHER INITIATIVES SECTION */}
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Altre Iniziative</h2>
                    <button onClick={() => { setEditingInit(null); setIsModalOpen(true); }} className="md-btn md-btn-sm md-btn-raised md-btn-primary flex items-center">
                        <PlusIcon /><span className="ml-2">Nuova Iniziativa</span>
                    </button>
                </div>

                {loading ? <Spinner /> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {initiatives.map(init => (
                            <div key={init.id} className="md-card p-5 flex flex-col hover:shadow-md transition-shadow">
                                <h3 className="font-bold text-lg text-gray-800 mb-2">{init.name}</h3>
                                <p className="text-sm text-gray-600 mb-4 flex-1">{init.description}</p>
                                
                                <div className="space-y-2 mb-4">
                                    <div className="bg-gray-50 p-2 rounded text-xs">
                                        <span className="font-bold block text-gray-500 mb-1">MATERIALI</span>
                                        <p className="line-clamp-2">{init.materials || 'Nessuno specificato'}</p>
                                    </div>
                                    <div className="bg-indigo-50 p-2 rounded text-xs text-indigo-700">
                                        <span className="font-bold block mb-1">DESTINATARI</span>
                                        <p className="line-clamp-2">{init.targetLocationNames?.join(', ') || 'Nessun recinto selezionato'}</p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                                    <button onClick={() => { setEditingInit(init); setIsModalOpen(true); }} className="md-icon-btn edit"><PencilIcon /></button>
                                    <button onClick={() => setDeleteId(init.id)} className="md-icon-btn delete"><TrashIcon /></button>
                                </div>
                            </div>
                        ))}
                        {initiatives.length === 0 && <p className="col-span-full text-center text-gray-400 italic py-8">Nessuna altra iniziativa attiva.</p>}
                    </div>
                )}
            </section>

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)} size="lg">
                    <InitiativeForm initiative={editingInit} suppliers={suppliers} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
                </Modal>
            )}

            <ConfirmModal 
                isOpen={!!deleteId} 
                onClose={() => setDeleteId(null)} 
                onConfirm={handleDelete}
                title="Elimina Iniziativa" 
                message="Sei sicuro?" 
                isDangerous={true} 
            />
        </div>
    );
};

export default Initiatives;
