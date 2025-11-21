
import React, { useState, useEffect, useCallback } from 'react';
import { Client, ClientInput, ClientType, ParentClient, InstitutionalClient, Child, Enrollment, ParentRating, ChildRating } from '../types';
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

// Internal Star Icon
const StarIcon: React.FC<{ filled: boolean; onClick?: () => void; className?: string }> = ({ filled, onClick, className }) => (
    <svg 
        onClick={onClick} 
        xmlns="http://www.w3.org/2000/svg" 
        className={`h-5 w-5 ${filled ? 'text-yellow-400' : 'text-gray-300'} ${onClick ? 'cursor-pointer hover:scale-110 transition-transform' : ''} ${className}`} 
        viewBox="0 0 20 20" 
        fill="currentColor"
    >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
);

// Helper for rating row
const RatingRow: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
    <div className="flex justify-between items-center mb-1 bg-white p-2 rounded border border-gray-100">
        <span className="text-xs text-gray-600 font-medium">{label}</span>
        <div className="flex space-x-1 items-center">
            <span className="text-xs font-bold text-gray-400 mr-2">{value}/5</span>
            {[1,2,3,4,5].map(star => (
                <StarIcon key={star} filled={star <= value} onClick={() => onChange(star)} className="w-4 h-4" />
            ))}
        </div>
    </div>
);

// Child Editor Component (Nested Form)
const ChildEditor: React.FC<{ 
    child: Child | null; 
    onSave: (child: Child) => void; 
    onCancel: () => void; 
}> = ({ child, onSave, onCancel }) => {
    const [name, setName] = useState(child?.name || '');
    const [age, setAge] = useState(child?.age || '');
    const [notes, setNotes] = useState(child?.notes || '');
    const [tags, setTags] = useState<string[]>(child?.tags || []);
    const [tagInput, setTagInput] = useState('');
    const [rating, setRating] = useState<ChildRating>(child?.rating || {
        learning: 0, behavior: 0, attendance: 0, hygiene: 0
    });
    const [activeTab, setActiveTab] = useState<'info' | 'rating'>('info');

    const handleAddTag = () => {
        if (tagInput.trim()) {
            if (!tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tag: string) => setTags(tags.filter(t => t !== tag));

    const handleRatingChange = (field: keyof ChildRating, value: number) => {
        setRating(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({
            id: child?.id || Date.now().toString(),
            name,
            age,
            notes,
            tags,
            rating
        });
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b bg-indigo-50 flex justify-between items-center">
                <h3 className="font-bold text-indigo-900">{child ? 'Modifica Figlio' : 'Nuovo Figlio'}</h3>
                <div className="flex space-x-1">
                    <button onClick={() => setActiveTab('info')} className={`px-3 py-1 text-xs rounded-md ${activeTab === 'info' ? 'bg-white text-indigo-600 font-bold shadow-sm' : 'text-indigo-600 hover:bg-indigo-100'}`}>Dati</button>
                    <button onClick={() => setActiveTab('rating')} className={`px-3 py-1 text-xs rounded-md ${activeTab === 'rating' ? 'bg-white text-indigo-600 font-bold shadow-sm' : 'text-indigo-600 hover:bg-indigo-100'}`}>Rating</button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeTab === 'info' && (
                    <>
                        <div className="md-input-group"><input type="text" value={name} onChange={e => setName(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Nome</label></div>
                        <div className="md-input-group"><input type="text" value={age} onChange={e => setAge(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Età</label></div>
                        
                        {/* Tags */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tag</label>
                            <div className="flex gap-2 mb-2">
                                <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} placeholder="Es. #Timido" className="md-input flex-1" />
                                <button type="button" onClick={handleAddTag} className="md-btn md-btn-flat bg-gray-100 text-gray-600"><PlusIcon/></button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {tags.map(tag => (
                                    <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                        {tag}
                                        <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1 text-indigo-900 font-bold">&times;</button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'rating' && (
                    <>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
                            <h4 className="font-bold text-gray-800 mb-3 text-xs uppercase tracking-wide">Valutazione Figlio</h4>
                            <div className="space-y-1">
                                <RatingRow label="1. Reattività Apprendimento" value={rating.learning} onChange={(v) => handleRatingChange('learning', v)} />
                                <RatingRow label="2. Buona Condotta" value={rating.behavior} onChange={(v) => handleRatingChange('behavior', v)} />
                                <RatingRow label="3. Tasso Assenza (Affidabilità)" value={rating.attendance} onChange={(v) => handleRatingChange('attendance', v)} />
                                <RatingRow label="4. Assenza Problemi Igienici/Disturbi" value={rating.hygiene} onChange={(v) => handleRatingChange('hygiene', v)} />
                            </div>
                        </div>
                        <div className="md-input-group">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Note (Markdown)</label>
                            <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 border rounded-md bg-white text-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="- Note sul bambino..."></textarea>
                        </div>
                    </>
                )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3">
                <button onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Indietro</button>
                <button onClick={handleSave} className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva Figlio</button>
            </div>
        </div>
    );
};

const ClientForm: React.FC<{ 
    client?: Client | null; 
    onSave: (client: ClientInput | Client) => void; 
    onCancel: () => void; 
}> = ({ client, onSave, onCancel }) => {
    const [activeTab, setActiveTab] = useState<'info' | 'rating'>('info');
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
    
    // Enterprise Fields (Parent)
    const [notes, setNotes] = useState((client as ParentClient)?.notes || '');
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>((client as ParentClient)?.tags || []);
    const [rating, setRating] = useState<ParentRating>((client as ParentClient)?.rating || {
        availability: 0,
        complaints: 0,
        churnRate: 0,
        distance: 0
    });

    // Institutional fields
    const [companyName, setCompanyName] = useState((client as InstitutionalClient)?.companyName || '');
    const [vatNumber, setVatNumber] = useState((client as InstitutionalClient)?.vatNumber || '');

    // Child Editing State
    const [editingChildId, setEditingChildId] = useState<string | null>(null);
    const [isAddingChild, setIsAddingChild] = useState(false);

    const handleSaveChild = (child: Child) => {
        if (editingChildId) {
            setChildren(children.map(c => c.id === editingChildId ? child : c));
            setEditingChildId(null);
        } else {
            setChildren([...children, child]);
            setIsAddingChild(false);
        }
    };

    const handleRemoveChild = (childId: string) => {
        setChildren(children.filter(c => c.id !== childId));
    };

    const handleAddTag = () => {
        if (tagInput.trim()) {
            if (!tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tag: string) => setTags(tags.filter(t => t !== tag));

    const handleRatingChange = (field: keyof ParentRating, value: number) => {
        setRating(prev => ({ ...prev, [field]: value }));
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
                children,
                notes,
                tags,
                rating
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

    // Helper to calculate average child rating
    const getChildRatingAvg = (r?: ChildRating) => {
        if (!r) return 0;
        const sum = r.learning + r.behavior + r.attendance + r.hygiene;
        return sum > 0 ? (sum / 4).toFixed(1) : 0;
    };

    // Render Child Editor Overlay
    if (isAddingChild || editingChildId) {
        const childToEdit = editingChildId ? children.find(c => c.id === editingChildId) || null : null;
        return <ChildEditor 
            child={childToEdit} 
            onSave={handleSaveChild} 
            onCancel={() => { setIsAddingChild(false); setEditingChildId(null); }} 
        />;
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-3">{client ? 'Modifica Cliente' : 'Nuovo Cliente'}</h2>
                
                {clientType === ClientType.Parent && (
                    <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                        <button type="button" onClick={() => setActiveTab('info')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'info' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>Anagrafica</button>
                        <button type="button" onClick={() => setActiveTab('rating')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'rating' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>Valutazione & Note</button>
                    </div>
                )}
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

                {activeTab === 'info' && (
                    <div className="space-y-4 animate-fade-in">
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
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-md font-semibold text-indigo-700">Gestione Figli</h3>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsAddingChild(true)}
                                        className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1 rounded text-xs font-bold flex items-center"
                                    >
                                        <PlusIcon /> Aggiungi
                                    </button>
                                </div>

                                {/* Children List */}
                                <div className="space-y-2">
                                    {children.map(child => {
                                        const avg = getChildRatingAvg(child.rating);
                                        return (
                                            <div key={child.id} className="flex justify-between items-center bg-white border border-gray-200 p-2 rounded shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                                        {child.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{child.name}</p>
                                                        <p className="text-xs text-gray-500">{child.age}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {Number(avg) > 0 && (
                                                        <span className="text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded font-bold border border-yellow-100 flex items-center">
                                                            {avg} <StarIcon filled={true} className="w-3 h-3 ml-0.5" />
                                                        </span>
                                                    )}
                                                    <button type="button" onClick={() => setEditingChildId(child.id)} className="md-icon-btn edit text-blue-500"><PencilIcon /></button>
                                                    <button type="button" onClick={() => handleRemoveChild(child.id)} className="md-icon-btn delete text-red-500"><TrashIcon /></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {children.length === 0 && (
                                        <p className="text-sm text-gray-400 italic text-center py-2">Nessun figlio registrato.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'rating' && clientType === ClientType.Parent && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Rating Section */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h4 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide border-b pb-1 border-gray-200">Affidabilità Genitore</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                                <RatingRow label="1. Disponibilità oraria/giornaliera" value={rating.availability} onChange={(v) => handleRatingChange('availability', v)} />
                                <RatingRow label="2. Predisposizione alle lamentele" value={rating.complaints} onChange={(v) => handleRatingChange('complaints', v)} />
                                <RatingRow label="3. Tasso abbandoni/ritorni" value={rating.churnRate} onChange={(v) => handleRatingChange('churnRate', v)} />
                                <RatingRow label="4. Distanza dalla sede scelta" value={rating.distance} onChange={(v) => handleRatingChange('distance', v)} />
                            </div>
                        </div>

                        {/* Tags Section */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tag Genitore</label>
                            <div className="flex gap-2 mb-2">
                                <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} placeholder="Es. #PagamentoPuntuale" className="md-input flex-1" />
                                <button type="button" onClick={handleAddTag} className="md-btn md-btn-flat bg-gray-100 text-gray-600"><PlusIcon/></button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {tags.map(tag => (
                                    <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                        {tag}
                                        <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1 text-indigo-900 font-bold">&times;</button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Notes Section */}
                        <div className="md-input-group">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Note Genitore (Markdown)</label>
                            <textarea rows={6} value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 border rounded-md bg-white text-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="- Scrivi qui le tue note..."></textarea>
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
    // Helper to calculate average child rating
    const getChildRatingAvg = (r?: ChildRating) => {
        if (!r) return 0;
        const sum = r.learning + r.behavior + r.attendance + r.hygiene;
        return sum > 0 ? (sum / 4).toFixed(1) : 0;
    };

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
                    <>
                    <div className="md-card p-6 mb-6">
                        <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">Figli Registrati</h4>
                        <div className="grid grid-cols-1 gap-4">
                            {(client as ParentClient).children && (client as ParentClient).children.length > 0 ? (
                                (client as ParentClient).children.map((child) => {
                                    const avg = getChildRatingAvg(child.rating);
                                    return (
                                        <div key={child.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold mr-3 text-lg">
                                                        {child.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-800 text-lg">{child.name}</p>
                                                        <p className="text-xs text-gray-500">{child.age}</p>
                                                    </div>
                                                </div>
                                                {Number(avg) > 0 && (
                                                    <div className="bg-white px-3 py-1 rounded border border-yellow-100 shadow-sm flex items-center">
                                                        <span className="font-bold text-yellow-700 mr-1">{avg}</span>
                                                        <StarIcon filled={true} className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Child Details */}
                                            <div className="mt-3 pl-14">
                                                {/* Child Ratings */}
                                                {child.rating && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                                        <div className="text-xs text-gray-600 bg-white p-1.5 rounded border border-gray-100">Apprend: <strong>{child.rating.learning}/5</strong></div>
                                                        <div className="text-xs text-gray-600 bg-white p-1.5 rounded border border-gray-100">Condotta: <strong>{child.rating.behavior}/5</strong></div>
                                                        <div className="text-xs text-gray-600 bg-white p-1.5 rounded border border-gray-100">Presenza: <strong>{child.rating.attendance}/5</strong></div>
                                                        <div className="text-xs text-gray-600 bg-white p-1.5 rounded border border-gray-100">Igiene: <strong>{child.rating.hygiene}/5</strong></div>
                                                    </div>
                                                )}

                                                {/* Child Tags */}
                                                {child.tags && child.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {child.tags.map(tag => (
                                                            <span key={tag} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Child Notes */}
                                                {child.notes && (
                                                    <p className="text-xs text-gray-600 italic bg-yellow-50 p-2 rounded border border-yellow-100">
                                                        "{child.notes}"
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-gray-400 italic text-sm">Nessun figlio registrato.</p>
                            )}
                        </div>
                    </div>

                    <div className="md-card p-6 mb-6">
                        <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">Affidabilità & Note Genitore</h4>
                        
                        {(client as ParentClient).tags && (client as ParentClient).tags!.length > 0 && (
                            <div className="mb-4">
                                <div className="flex flex-wrap gap-2">
                                    {(client as ParentClient).tags!.map(tag => (
                                        <span key={tag} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-semibold">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(client as ParentClient).rating && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-50 p-4 rounded-lg">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Disponibilità</span>
                                    <div className="flex items-center"><span className="text-xs font-bold mr-1">{(client as ParentClient).rating!.availability}/5</span> <StarIcon filled={true} className="w-3 h-3 text-yellow-500" /></div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Predisposizione Lamentele</span>
                                    <div className="flex items-center"><span className="text-xs font-bold mr-1">{(client as ParentClient).rating!.complaints}/5</span> <StarIcon filled={true} className="w-3 h-3 text-yellow-500" /></div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Abbandoni/Ritorni</span>
                                    <div className="flex items-center"><span className="text-xs font-bold mr-1">{(client as ParentClient).rating!.churnRate}/5</span> <StarIcon filled={true} className="w-3 h-3 text-yellow-500" /></div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Distanza Sede</span>
                                    <div className="flex items-center"><span className="text-xs font-bold mr-1">{(client as ParentClient).rating!.distance}/5</span> <StarIcon filled={true} className="w-3 h-3 text-yellow-500" /></div>
                                </div>
                            </div>
                        )}

                        {(client as ParentClient).notes && (
                            <div className="bg-yellow-50 p-4 rounded border border-yellow-100 text-sm text-gray-700 whitespace-pre-wrap">
                                {(client as ParentClient).notes}
                            </div>
                        )}
                    </div>
                    </>
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
                        
                        {/* Tags display in card */}
                        {client.clientType === ClientType.Parent && (client as ParentClient).tags && (client as ParentClient).tags!.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2 mb-2">
                                {(client as ParentClient).tags!.slice(0, 3).map(tag => (
                                    <span key={tag} className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full border border-indigo-100">
                                        #{tag}
                                    </span>
                                ))}
                                {(client as ParentClient).tags!.length > 3 && <span className="text-[9px] text-gray-400">...</span>}
                            </div>
                        )}
                        
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
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
