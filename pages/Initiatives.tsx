
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
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import SparklesIcon from '../components/icons/SparklesIcon';

// --- SUB-COMPONENTS ---

const TagInput: React.FC<{
    label: string;
    value: string[];
    onChange: (tags: string[]) => void;
    suggestions: string[];
}> = ({ label, value, onChange, suggestions }) => {
    const [input, setInput] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const handleAdd = (tag: string) => {
        const trimmed = tag.trim();
        if (trimmed && !value.includes(trimmed)) {
            onChange([...value, trimmed]);
        }
        setInput('');
        setIsOpen(false);
    };

    const handleRemove = (tag: string) => {
        onChange(value.filter(t => t !== tag));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd(input);
        }
    };

    const filteredSuggestions = suggestions.filter(s => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s));

    return (
        <div className="relative mb-4">
            <label className="block text-xs font-bold text-gray-700 mb-1">{label}</label>
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                    {value.map(tag => (
                        <span key={tag} className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shadow-sm">
                            {tag}
                            <button type="button" onClick={() => handleRemove(tag)} className="text-indigo-400 hover:text-indigo-800 focus:outline-none bg-indigo-100 hover:bg-indigo-200 rounded-full w-4 h-4 flex items-center justify-center transition-colors">&times;</button>
                        </span>
                    ))}
                </div>
                <div className="relative">
                    <input 
                        type="text" 
                        value={input} 
                        onChange={e => { setInput(e.target.value); setIsOpen(true); }} 
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsOpen(true)}
                        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow" 
                        placeholder={`Aggiungi ${label.toLowerCase()}... (Invio per creare)`} 
                    />
                    {isOpen && filteredSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-xl mt-1 max-h-48 overflow-y-auto">
                            {filteredSuggestions.map(s => (
                                <div key={s} className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm text-gray-700 border-b border-gray-50 last:border-0" onMouseDown={(e) => { e.preventDefault(); handleAdd(s); }}>
                                    {s}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const BookForm: React.FC<{
    book?: Book | null;
    locations: {id: string, name: string}[];
    allBooks: Book[];
    onSave: (data: BookInput | Book) => void;
    onCancel: () => void;
}> = ({ book, locations, allBooks, onSave, onCancel }) => {
    // 1. AUTO-NUMBERING LOGIC (3 digits)
    const getNextBookNumber = () => {
        if (allBooks.length === 0) return '001';
        const numbers = allBooks.map(b => parseInt(b.bookNumber || '0')).filter(n => !isNaN(n));
        const max = (numbers.length > 0) ? Math.max(...numbers) : 0;
        return String(max + 1).padStart(3, '0');
    };

    const [bookNumber, setBookNumber] = useState(book?.bookNumber || getNextBookNumber());
    const [title, setTitle] = useState(book?.title || '');
    const [authors, setAuthors] = useState(book?.authors || '');
    const [publisher, setPublisher] = useState(book?.publisher || '');
    const [homeLocationId, setHomeLocationId] = useState(book?.homeLocationId || '');
    const [targetTags, setTargetTags] = useState<string[]>(book?.targetTags || []);
    const [categoryTags, setCategoryTags] = useState<string[]>(book?.categoryTags || []);
    const [themeTags, setThemeTags] = useState<string[]>(book?.themeTags || []);

    const [isAILoading, setIsAILoading] = useState(false);

    // AI LOGIC ENGINE
    const handleAISuggest = async () => {
        if (!title) return alert("Inserisci almeno il titolo per ricevere suggerimenti.");
        setIsAILoading(true);
        try {
            const suggestTags = httpsCallable(functions, 'suggestBookTags');
            const result = await suggestTags({ title, authors, publisher });
            const data = result.data as any;
            
            if (data.target) setTargetTags(Array.from(new Set([...targetTags, ...data.target])));
            if (data.category) setCategoryTags(Array.from(new Set([...categoryTags, ...data.category])));
            if (data.theme) setThemeTags(Array.from(new Set([...themeTags, ...data.theme])));
        } catch (e) {
            console.error(e);
            alert("Errore durante il suggerimento AI.");
        } finally {
            setIsAILoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data: BookInput = {
            bookNumber,
            title,
            authors,
            publisher,
            homeLocationId,
            targetTags,
            categoryTags,
            themeTags,
            isAvailable: book ? book.isAvailable : true,
            createdAt: book?.createdAt || new Date().toISOString()
        };
        if (book?.id) onSave({ ...data, id: book.id } as Book);
        else onSave(data);
    };

    // Extract unique tags from allBooks to use as suggestions
    const defaultTargetTags = ['piccolissimi', 'piccoli', 'grandi'];
    const defaultCategoryTags = ['solo testo', 'solo immagini', 'testo & immagini', 'tattile'];
    const defaultThemeTags = ['animali', 'stagioni', 'eventi', 'società'];

    const existingTargetTags = Array.from(new Set([...defaultTargetTags, ...allBooks.flatMap(b => b.targetTags || [])]));
    const existingCategoryTags = Array.from(new Set([...defaultCategoryTags, ...allBooks.flatMap(b => b.categoryTags || [])]));
    const existingThemeTags = Array.from(new Set([...defaultThemeTags, ...allBooks.flatMap(b => b.themeTags || [])]));

    return (
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 bg-gray-50/50">
            <div className="p-4 md:p-6 border-b bg-white flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">{book ? 'Modifica Libro' : 'Nuovo Libro'}</h3>
                <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-lg font-black text-sm border border-amber-200">
                    ID #{bookNumber}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                    {/* Colonna Sinistra: Dati Principali */}
                    <div className="space-y-4 md:space-y-6">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Dati Principali</h4>
                            <button 
                                type="button" 
                                onClick={handleAISuggest} 
                                disabled={isAILoading || !title}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 disabled:opacity-30 transition-all"
                            >
                                <SparklesIcon className={`w-4 h-4 ${isAILoading ? 'animate-spin' : ''}`} />
                                {isAILoading ? 'Analisi AI...' : 'AI Magic Suggest'}
                            </button>
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                            <div className="md-input-group col-span-1">
                                <input type="text" value={bookNumber} onChange={e => setBookNumber(e.target.value)} required className="md-input bg-white text-center font-black" placeholder=" " />
                                <label className="md-input-label">N°</label>
                            </div>
                            <div className="md-input-group col-span-3">
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="md-input bg-white" placeholder=" " />
                                <label className="md-input-label">Titolo</label>
                            </div>
                        </div>

                        <div className="md-input-group"><input type="text" value={authors} onChange={e => setAuthors(e.target.value)} className="md-input bg-white" placeholder=" " /><label className="md-input-label">Autori</label></div>
                        <div className="md-input-group"><input type="text" value={publisher} onChange={e => setPublisher(e.target.value)} className="md-input bg-white" placeholder=" " /><label className="md-input-label">Casa Editrice</label></div>
                        
                        <div className="pt-2">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Sede Base</label>
                            <select value={homeLocationId} onChange={e => setHomeLocationId(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="">Nessuna Sede Base</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Colonna Destra: Classificazione */}
                    <div className="space-y-4 md:space-y-6">
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b pb-2">Classificazione (Tag)</h4>
                        <TagInput label="Destinatari" value={targetTags} onChange={setTargetTags} suggestions={existingTargetTags} />
                        <TagInput label="Categoria" value={categoryTags} onChange={setCategoryTags} suggestions={existingCategoryTags} />
                        <TagInput label="Tema" value={themeTags} onChange={setThemeTags} suggestions={existingThemeTags} />
                    </div>
                </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3 bg-white">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat text-gray-600">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-primary px-6">Salva Libro</button>
            </div>
        </form>
    );
};

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
        if(initiative?.id) onSave({...data, id: initiative.id} as Initiative); else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="p-4 md:p-6 border-b"><h3 className="text-xl font-bold">{initiative ? 'Modifica Iniziativa' : 'Nuova Iniziativa'}</h3></div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                <div className="md-input-group"><input type="text" value={name} onChange={e => setName(e.target.value)} required className="md-input" placeholder=" " /><label className="md-input-label">Nome Iniziativa</label></div>
                <div className="md-input-group"><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="md-input" placeholder="Descrizione..." /></div>
                <div className="md-input-group"><textarea rows={3} value={materials} onChange={e => setMaterials(e.target.value)} className="md-input" placeholder="Materiali necessari (lista)..." /></div>
                
                <div className="border-t pt-2">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Destinatari (Recinti)</label>
                    <div className="max-h-40 overflow-y-auto border rounded p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
    const [invSearch, setInvSearch] = useState('');
    const [filterTarget, setFilterTarget] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterTheme, setFilterTheme] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [sortBy, setSortBy] = useState<'bookNumber' | 'title' | 'authors' | 'publisher'>('title');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const [isBookModalOpen, setIsBookModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState<Book | null>(null);

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

    const allTargetTags = useMemo(() => Array.from(new Set(books.flatMap(b => b.targetTags || []))).sort(), [books]);
    const allCategoryTags = useMemo(() => Array.from(new Set(books.flatMap(b => b.categoryTags || []))).sort(), [books]);
    const allThemeTags = useMemo(() => Array.from(new Set(books.flatMap(b => b.themeTags || []))).sort(), [books]);

    const filteredBooks = useMemo(() => {
        const filtered = books.filter(b => {
            // Text search
            if (invSearch) {
                const term = invSearch.toLowerCase();
                const matchTitle = b.title.toLowerCase().includes(term);
                const matchAuthors = b.authors?.toLowerCase().includes(term);
                const matchPublisher = b.publisher?.toLowerCase().includes(term);
                const matchNumber = b.bookNumber?.toLowerCase().includes(term);
                if (!matchTitle && !matchAuthors && !matchPublisher && !matchNumber) return false;
            }
            
            // Tags
            if (filterTarget && !(b.targetTags || []).includes(filterTarget)) return false;
            if (filterCategory && !(b.categoryTags || []).includes(filterCategory)) return false;
            if (filterTheme && !(b.themeTags || []).includes(filterTheme)) return false;
            
            // Location
            if (filterLocation) {
                // Find if it's currently loaned out
                const activeLoan = loans.find(l => l.bookId === b.id);
                const currentLocationId = activeLoan ? activeLoan.locationId : b.homeLocationId;
                if (currentLocationId !== filterLocation) return false;
            }
            
            return true;
        });
        
        // Sort
        const sorted = [...filtered].sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortBy) {
                case 'bookNumber':
                    aVal = (a.bookNumber || '').toLowerCase();
                    bVal = (b.bookNumber || '').toLowerCase();
                    break;
                case 'title':
                    aVal = a.title.toLowerCase();
                    bVal = b.title.toLowerCase();
                    break;
                case 'authors':
                    aVal = (a.authors || '').toLowerCase();
                    bVal = (b.authors || '').toLowerCase();
                    break;
                case 'publisher':
                    aVal = (a.publisher || '').toLowerCase();
                    bVal = (b.publisher || '').toLowerCase();
                    break;
                default:
                    aVal = a.title.toLowerCase();
                    bVal = b.title.toLowerCase();
            }
            if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        
        return sorted;
    }, [books, loans, invSearch, filterTarget, filterCategory, filterTheme, filterLocation, sortBy, sortDir]);

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

    const handleSaveBook = async (data: BookInput | Book) => {
        setLoading(true);
        if ('id' in data) {
            await updateBook(data.id, data);
        } else {
            await addBook(data);
        }
        setIsBookModalOpen(false);
        await fetchData();
    };

    const handleDeleteBook = async (id: string) => {
        if (loans.some(l => l.bookId === id)) {
            alert("Non puoi eliminare un libro attualmente in prestito. Restituiscilo prima di eliminarlo.");
            return;
        }
        if(confirm("Eliminare questo libro dall'inventario?")) {
            setLoading(true);
            try {
                await deleteBook(id);
                setBooks(prev => prev.filter(b => b.id !== id)); // Optimistic UI update
                await fetchData();
            } catch (error) {
                console.error("Errore durante l'eliminazione del libro:", error);
                alert("Si è verificato un errore durante l'eliminazione.");
                setLoading(false);
            }
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            {/* Header / Tabs */}
            <div className="bg-amber-50 border-b border-amber-100 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-amber-900 flex items-center gap-2">
                        📖 Peek-a-Boo(k)
                    </h3>
                    <p className="text-xs text-amber-700">Sistema Prestito Libri</p>
                </div>
                <div className="w-full sm:w-auto mt-2 sm:mt-0">
                    <div className="grid grid-cols-2 gap-1 bg-white rounded-lg p-1 border border-amber-200 shadow-sm w-full sm:w-80">
                        <button onClick={() => setActiveTab('loans')} className={`px-2 py-2 text-xs font-bold rounded transition-colors ${activeTab === 'loans' ? 'bg-amber-100 text-amber-800' : 'text-gray-500 hover:bg-gray-50'}`}>Prestiti Attivi ({loans.length})</button>
                        <button onClick={() => setActiveTab('checkout')} className={`px-2 py-2 text-xs font-bold rounded transition-colors ${activeTab === 'checkout' ? 'bg-amber-100 text-amber-800' : 'text-gray-500 hover:bg-gray-50'}`}>Nuovo Prestito</button>
                        <button onClick={() => setActiveTab('inventory')} className={`col-span-2 px-3 py-2 text-xs font-bold rounded transition-colors ${activeTab === 'inventory' ? 'bg-amber-100 text-amber-800' : 'text-gray-500 hover:bg-gray-50'}`}>Inventario ({books.length})</button>
                    </div>
                </div>
            </div>

            <div className="p-4 md:p-6 relative">
                {loading && <div className="absolute inset-0 bg-white/50 flex justify-center items-center z-10"><Spinner /></div>}

                {activeTab === 'loans' && (
                    <div className="space-y-3">
                        {loans.length === 0 ? <p className="text-center text-gray-400 italic py-10">Nessun libro in prestito.</p> :
                        loans.map(loan => (
                            <div key={loan.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md transition-shadow gap-4">
                                <div>
                                    <p className="font-bold text-gray-800 text-base">{loan.bookTitle}</p>
                                    <div className="flex flex-wrap items-center gap-2 text-xs mt-2">
                                        <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
                                            👤 {loan.studentName}
                                        </span>
                                        <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
                                            📍 {loan.locationName}
                                        </span>
                                        <span className="text-gray-400 font-medium">Dal: {new Date(loan.borrowDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <button onClick={() => handleReturn(loan)} className="w-full sm:w-auto md-btn md-btn-sm bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 py-2">
                                    Restituisci
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'checkout' && (
                    <div className="max-w-md mx-auto space-y-5 py-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">1. Dove siamo? (Recinto)</label>
                            <select value={selLocationId} onChange={e => { setSelLocationId(e.target.value); setSelStudentId(''); }} className="md-input bg-gray-50">
                                <option value="">Seleziona Sede...</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div className={`transition-all duration-300 ${!selLocationId ? 'opacity-30 pointer-events-none scale-95' : 'opacity-100'}`}>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">2. Chi prende il libro?</label>
                            <select value={selStudentId} onChange={e => setSelStudentId(e.target.value)} className="md-input bg-gray-50">
                                <option value="">Seleziona Allievo...</option>
                                {studentsInLocation.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className={`transition-all duration-300 ${!selStudentId ? 'opacity-30 pointer-events-none scale-95' : 'opacity-100'}`}>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">3. Quale libro?</label>
                            <select value={selBookId} onChange={e => setSelBookId(e.target.value)} className="md-input bg-gray-50">
                                <option value="">Seleziona Libro Disponibile...</option>
                                {availableBooks.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                            </select>
                        </div>
                        <button onClick={handleCheckout} disabled={!selBookId} className="w-full md-btn md-btn-raised md-btn-primary py-3 mt-4 disabled:opacity-50 transition-all">
                            Registra Prestito
                        </button>
                    </div>
                )}

                {activeTab === 'inventory' && (
                    <div className="space-y-6">
                        {/* Box Filtri */}
                        <div className="bg-gray-50 p-4 md:p-6 rounded-xl border border-gray-200 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-gray-700 uppercase text-xs tracking-widest">Filtri Catalogo</h4>
                                <button onClick={() => { setEditingBook(null); setIsBookModalOpen(true); }} className="md-btn md-btn-sm md-btn-raised md-btn-primary flex items-center gap-1.5">
                                    <PlusIcon/> <span className="hidden sm:inline">Nuovo Libro</span><span className="sm:hidden">Nuovo</span>
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                <input type="text" value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Cerca titolo, numero, autore..." className="md-input text-sm" />
                                <select value={filterTarget} onChange={e => setFilterTarget(e.target.value)} className="md-input text-sm">
                                    <option value="">Tutti i Destinatari</option>
                                    {allTargetTags.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="md-input text-sm">
                                    <option value="">Tutte le Categorie</option>
                                    {allCategoryTags.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select value={filterTheme} onChange={e => setFilterTheme(e.target.value)} className="md-input text-sm">
                                    <option value="">Tutti i Temi</option>
                                    {allThemeTags.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="md-input text-sm">
                                    <option value="">Tutte le Ubicazioni</option>
                                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                            
                            {/* Ordinamento */}
                            <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ordina per:</span>
                                <div className="flex gap-2">
                                    <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="md-input text-xs py-1.5">
                                        <option value="bookNumber">Numero</option>
                                        <option value="title">Titolo</option>
                                        <option value="authors">Autore</option>
                                        <option value="publisher">Editore</option>
                                    </select>
                                    <button 
                                        onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors ${sortDir === 'asc' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}
                                    >
                                        {sortDir === 'asc' ? 'A-Z ↑' : 'Z-A ↓'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {/* Box Elenco Libri */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="px-4 py-3 border-b bg-gray-50/50 flex justify-between items-center">
                                <h4 className="font-bold text-gray-700 text-sm">Risultati ({filteredBooks.length})</h4>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {filteredBooks.map(b => {
                                    const activeLoan = loans.find(l => l.bookId === b.id);
                                    const currentLocationName = activeLoan ? activeLoan.locationName : (locations.find(l => l.id === b.homeLocationId)?.name || 'Nessuna Sede Base');
                                    
                                    return (
                                    <div key={b.id} className="p-4 sm:p-5 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${b.isAvailable ? 'bg-green-500' : 'bg-red-500'}`} title={b.isAvailable ? 'Disponibile' : 'In Prestito'}></span>
                                                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-black text-xs">#{b.bookNumber || '---'}</span>
                                                    <h5 className={`font-bold text-lg leading-tight ${!b.isAvailable ? 'text-gray-500' : 'text-gray-900'}`}>{b.title}</h5>
                                                </div>
                                                <div className="text-sm text-gray-500 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                                    {b.authors && <span><span className="font-semibold text-gray-400 uppercase text-[10px] tracking-wider mr-1">Autori:</span> {b.authors}</span>}
                                                    {b.publisher && <span><span className="font-semibold text-gray-400 uppercase text-[10px] tracking-wider mr-1">Ed:</span> {b.publisher}</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button onClick={() => { setEditingBook(b); setIsBookModalOpen(true); }} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><PencilIcon/></button>
                                                <button onClick={() => handleDeleteBook(b.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon/></button>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-4 flex flex-wrap gap-2 items-center">
                                            <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${b.isAvailable ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                                📍 {currentLocationName} {activeLoan ? `(In prestito a ${activeLoan.studentName})` : ''}
                                            </span>
                                            {b.targetTags?.map(t => <span key={t} className="text-[10px] px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-bold uppercase tracking-wider">{t}</span>)}
                                            {b.categoryTags?.map(t => <span key={t} className="text-[10px] px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100 font-bold uppercase tracking-wider">{t}</span>)}
                                            {b.themeTags?.map(t => <span key={t} className="text-[10px] px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 font-bold uppercase tracking-wider">{t}</span>)}
                                        </div>
                                    </div>
                                )})}
                                {filteredBooks.length === 0 && <div className="py-16 text-center">
                                    <p className="text-gray-400 italic">Nessun libro trovato con questi filtri.</p>
                                </div>}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isBookModalOpen && (
                <Modal onClose={() => setIsBookModalOpen(false)} size="lg">
                    <BookForm 
                        book={editingBook} 
                        locations={locations} 
                        allBooks={books} 
                        onSave={handleSaveBook} 
                        onCancel={() => setIsBookModalOpen(false)} 
                    />
                </Modal>
            )}
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
            setInitiatives(inits.filter(i => i.type !== 'peek-a-book'));
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Iniziative</h1>
                    <p className="mt-1 text-gray-500">Gestione progetti speciali e biblioteca.</p>
                </div>
                <button onClick={() => { setEditingInit(null); setIsModalOpen(true); }} className="w-full sm:w-auto md-btn md-btn-sm md-btn-raised md-btn-primary flex items-center justify-center py-2.5 px-5">
                    <PlusIcon /><span className="ml-2">Nuova Iniziativa</span>
                </button>
            </div>

            {/* PEEK-A-BOOK SECTION */}
            <section>
                <BookManager />
            </section>

            {/* OTHER INITIATIVES SECTION */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-800 px-1">Altre Iniziative</h2>
                
                {loading ? <div className="py-20 flex justify-center"><Spinner /></div> : (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm divide-y divide-gray-100">
                        {initiatives.map(init => (
                            <div key={init.id} className="p-5 sm:p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start gap-4 mb-3">
                                    <h3 className="font-bold text-xl text-gray-900 leading-tight">{init.name}</h3>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => { setEditingInit(init); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><PencilIcon /></button>
                                        <button onClick={() => setDeleteId(init.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon /></button>
                                    </div>
                                </div>
                                
                                <p className="text-sm text-gray-600 mb-5 leading-relaxed">{init.description}</p>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <span className="font-bold block text-gray-400 uppercase text-[10px] tracking-widest mb-2">Materiali Necessari</span>
                                        <p className="text-xs text-gray-700 leading-relaxed">{init.materials || 'Nessuno specificato'}</p>
                                    </div>
                                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                        <span className="font-bold block text-indigo-400 uppercase text-[10px] tracking-widest mb-2">Destinatari (Recinti)</span>
                                        <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                                            {init.targetLocationNames?.join(', ') || 'Nessun recinto selezionato'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {initiatives.length === 0 && <div className="py-20 text-center">
                            <p className="text-gray-400 italic">Nessuna altra iniziativa attiva.</p>
                        </div>}
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
