
import React, { useState, useEffect, useCallback } from 'react';
import { Activity, ActivityInput } from '../types';
import { getActivities, addActivity, updateActivity, deleteActivity } from '../services/activityService';
import { uploadActivityAttachment } from '../services/storageService';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import SearchIcon from '../components/icons/SearchIcon';
import UploadIcon from '../components/icons/UploadIcon';

// --- Helper per estrarre URL ---
const extractFirstUrl = (text: string): string | null => {
    if (!text) return null;
    const match = text.match(/(https?:\/\/[^\s]+)/g);
    return match ? match[0] : null;
};

// --- Helper per icona file ---
const FileIcon: React.FC<{ type: string }> = ({ type }) => {
    if (type.includes('image')) return <span>🖼️</span>;
    if (type.includes('video')) return <span>🎥</span>;
    if (type.includes('audio')) return <span>🎵</span>;
    return <span>📄</span>;
};

// --- Componenti Interni ---

const ActivityForm: React.FC<{
    activity?: Activity | null;
    onSave: (data: ActivityInput | Activity) => void;
    onCancel: () => void;
}> = ({ activity, onSave, onCancel }) => {
    const [title, setTitle] = useState(activity?.title || '');
    const [category, setCategory] = useState(activity?.category || '');
    const [theme, setTheme] = useState(activity?.theme || '');
    const [description, setDescription] = useState(activity?.description || '');
    const [materials, setMaterials] = useState(activity?.materials || '');
    const [links, setLinks] = useState(activity?.links || '');
    const [attachments, setAttachments] = useState<string[]>(activity?.attachments || []);
    const [isUploading, setIsUploading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data: ActivityInput = {
            title,
            category,
            theme,
            description,
            materials,
            links,
            attachments,
            createdAt: activity?.createdAt || new Date().toISOString()
        };
        
        if (activity?.id) {
            onSave({ ...data, id: activity.id });
        } else {
            onSave(data);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const newUrls: string[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const url = await uploadActivityAttachment(files[i]);
                newUrls.push(url);
            }
            setAttachments(prev => [...prev, ...newUrls]);
        } catch (error) {
            console.error("Errore caricamento file:", error);
            alert("Errore durante il caricamento dei file.");
        } finally {
            setIsUploading(false);
            // Reset input value to allow re-uploading same file if needed
            e.target.value = '';
        }
    };

    const handleRemoveAttachment = (urlToRemove: string) => {
        setAttachments(prev => prev.filter(url => url !== urlToRemove));
    };

    const detectedLink = extractFirstUrl(links);

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            {/* Header Fixed */}
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">
                    {activity ? 'Modifica Attività' : 'Nuova Attività'}
                </h2>
            </div>
            
            {/* Body Scrollable - min-h-0 è cruciale per nested flex scroll */}
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                <div className="md-input-group">
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="md-input" placeholder=" " />
                    <label className="md-input-label">Titolo</label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="md-input-group">
                        <input type="text" value={category} onChange={e => setCategory(e.target.value)} required className="md-input" placeholder=" " />
                        <label className="md-input-label">Categoria (es. Grammatica, Gioco)</label>
                    </div>
                    <div className="md-input-group">
                        <input type="text" value={theme} onChange={e => setTheme(e.target.value)} className="md-input" placeholder=" " />
                        <label className="md-input-label">Tema / Filo Conduttore</label>
                    </div>
                </div>

                <div className="md-input-group mt-2">
                    <label className="block text-xs text-gray-500 mb-1">Descrizione</label>
                    <textarea 
                        rows={3}
                        value={description} 
                        onChange={e => setDescription(e.target.value)} 
                        className="w-full p-2 border rounded-md text-sm focus:ring-gray-500 focus:border-gray-500 bg-transparent"
                        style={{borderColor: 'var(--md-divider)'}}
                        placeholder="Descrivi brevemente l'attività..."
                    />
                </div>

                <div className="md-input-group">
                    <label className="block text-xs text-gray-500 mb-1">Materiali Necessari</label>
                    <textarea 
                        rows={2}
                        value={materials} 
                        onChange={e => setMaterials(e.target.value)} 
                        className="w-full p-2 border rounded-md text-sm focus:ring-gray-500 focus:border-gray-500 bg-transparent"
                        style={{borderColor: 'var(--md-divider)'}}
                        placeholder="Elenco materiali..."
                    />
                </div>

                <div className="md-input-group">
                    <label className="block text-xs text-gray-500 mb-1">Link Esterni</label>
                    <textarea 
                        rows={2}
                        value={links} 
                        onChange={e => setLinks(e.target.value)} 
                        className="w-full p-2 border rounded-md text-sm focus:ring-gray-500 focus:border-gray-500 bg-transparent"
                        style={{borderColor: 'var(--md-divider)'}}
                        placeholder="URL video, risorse esterne..."
                    />
                    {detectedLink && (
                        <a 
                            href={detectedLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-gray-600 hover:underline hover:text-gray-900 mt-1 inline-flex items-center font-medium"
                        >
                            🔗 Apri collegamento rilevato ↗
                        </a>
                    )}
                </div>

                {/* ALLEGATI MULTIMEDIALI */}
                <div className="md-input-group pt-2 border-t border-dashed border-gray-200">
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Allegati Multimediali</label>
                    
                    <div className="flex items-center gap-3 mb-3">
                        <label className={`cursor-pointer inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors text-sm font-medium ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {isUploading ? <Spinner /> : <UploadIcon />}
                            <span className="ml-2">{isUploading ? 'Caricamento...' : 'Carica File'}</span>
                            <input 
                                type="file" 
                                multiple
                                accept="image/*,video/*,audio/mp3,audio/mpeg"
                                className="hidden" 
                                onChange={handleFileUpload}
                                disabled={isUploading}
                            />
                        </label>
                        <span className="text-[10px] text-gray-400">
                            Supporta: Immagini, Video, MP3
                        </span>
                    </div>

                    {/* Lista Allegati */}
                    {attachments.length > 0 && (
                        <div className="grid grid-cols-1 gap-2">
                            {attachments.map((url, index) => {
                                // Rileva tipo file dall'URL (approssimativo, basato su token o estensione se visibile, 
                                // ma qui Firebase Storage usa token opachi. Usiamo estensione o generico)
                                const isImage = url.includes('.jpg') || url.includes('.png') || url.includes('.jpeg') || url.includes('token='); // Assunzione safe
                                
                                return (
                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-700 hover:text-indigo-600 truncate flex-1">
                                            <span className="text-lg">📎</span>
                                            <span className="truncate">Allegato {index + 1}</span>
                                        </a>
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveAttachment(url)} 
                                            className="ml-2 text-red-400 hover:text-red-600 p-1"
                                            title="Rimuovi"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Fixed */}
            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva Attività</button>
            </div>
        </form>
    );
};

// --- Pagina Principale ---

const Activities: React.FC = () => {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    
    // Delete State
    const [activityToDelete, setActivityToDelete] = useState<string | null>(null);

    // Sort State
    const [sortOrder, setSortOrder] = useState<'created_desc' | 'created_asc' | 'title_asc' | 'title_desc'>('created_desc');

    const fetchActivitiesData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getActivities();
            setActivities(data);
        } catch (err) {
            console.error("Errore caricamento attività:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchActivitiesData();
    }, [fetchActivitiesData]);

    // Handlers
    const handleOpenModal = (activity: Activity | null = null) => {
        setEditingActivity(activity);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingActivity(null);
        setIsModalOpen(false);
    };

    const handleSave = async (data: ActivityInput | Activity) => {
        try {
            if ('id' in data) {
                await updateActivity(data.id, data);
            } else {
                await addActivity(data);
            }
            handleCloseModal();
            fetchActivitiesData();
        } catch (err) {
            console.error("Errore salvataggio:", err);
            alert("Impossibile salvare l'attività.");
        }
    };

    const handleDeleteRequest = (id: string) => {
        setActivityToDelete(id);
    };

    const handleConfirmDelete = async () => {
        if (activityToDelete) {
            try {
                await deleteActivity(activityToDelete);
                fetchActivitiesData();
            } catch (err) {
                console.error("Errore eliminazione:", err);
            } finally {
                setActivityToDelete(null);
            }
        }
    };

    const filteredActivities = activities.filter(act => {
        const term = searchTerm.toLowerCase();
        return (
            act.title.toLowerCase().includes(term) ||
            act.category.toLowerCase().includes(term) ||
            act.theme.toLowerCase().includes(term) ||
            act.description.toLowerCase().includes(term)
        );
    });

    // Sorting
    filteredActivities.sort((a, b) => {
        switch (sortOrder) {
            case 'created_asc':
                return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            case 'created_desc':
                return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            case 'title_asc':
                return a.title.localeCompare(b.title);
            case 'title_desc':
                return b.title.localeCompare(a.title);
            default:
                return 0;
        }
    });

    return (
        <div>
            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Attività</h1>
                    <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>
                        Libreria di idee, materiali e piani didattici.
                    </p>
                </div>
                <button onClick={() => handleOpenModal()} className="md-btn md-btn-raised md-btn-green">
                    <PlusIcon />
                    <span className="ml-2">Nuova Attività</span>
                </button>
            </div>

            <div className="mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon />
                    </div>
                    <input
                        type="text"
                        placeholder="Cerca per titolo, categoria, tema..."
                        className="block w-full bg-white border rounded-md py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:border-gray-500 focus:ring-gray-500 shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{borderColor: 'var(--md-divider)'}}
                    />
                </div>
                
                <div className="w-full md:w-48">
                    <select 
                        value={sortOrder} 
                        onChange={(e) => setSortOrder(e.target.value as any)} 
                        className="block w-full bg-white border rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
                        style={{borderColor: 'var(--md-divider)'}}
                    >
                        <option value="created_desc">Più Recenti</option>
                        <option value="created_asc">Meno Recenti</option>
                        <option value="title_asc">Titolo (A-Z)</option>
                        <option value="title_desc">Titolo (Z-A)</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredActivities.map(act => {
                        const linkUrl = extractFirstUrl(act.links);
                        const hasAttachments = act.attachments && act.attachments.length > 0;
                        
                        return (
                            <div key={act.id} className="md-card flex flex-col h-full hover:shadow-lg transition-shadow relative group border-t-4 border-gray-400">
                                <div className="p-5 flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] uppercase font-bold tracking-wide text-gray-700 bg-gray-200 px-2 py-1 rounded-full">
                                            {act.category}
                                        </span>
                                        {act.createdAt && <span className="text-[9px] text-gray-400">{new Date(act.createdAt).toLocaleDateString()}</span>}
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800 mb-1">{act.title}</h3>
                                    {act.theme && (
                                        <p className="text-xs text-gray-500 italic mb-3">Tema: {act.theme}</p>
                                    )}
                                    <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                                        {act.description || "Nessuna descrizione."}
                                    </p>
                                    
                                    {(act.materials || act.links || hasAttachments) && (
                                        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                                            {act.materials && <p className="truncate">📦 {act.materials}</p>}
                                            {act.links && (
                                                linkUrl ? (
                                                    <a 
                                                        href={linkUrl} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="truncate text-gray-600 hover:underline hover:text-gray-900 flex items-center font-medium"
                                                        onClick={(e) => e.stopPropagation()} 
                                                    >
                                                        🔗 Link Esterno (Apri)
                                                    </a>
                                                ) : (
                                                    <p className="truncate text-gray-600">🔗 Risorse disponibili</p>
                                                )
                                            )}
                                            {hasAttachments && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {act.attachments!.map((url, idx) => (
                                                        <a 
                                                            key={idx} 
                                                            href={url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 hover:bg-indigo-100 flex items-center gap-1"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            📎 File {idx + 1}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 border-t bg-gray-50 flex justify-end space-x-2" style={{borderColor: 'var(--md-divider)'}}>
                                    <button 
                                        onClick={() => handleOpenModal(act)} 
                                        className="md-icon-btn edit"
                                        title="Modifica"
                                    >
                                        <PencilIcon />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteRequest(act.id)} 
                                        className="md-icon-btn delete"
                                        title="Elimina"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {filteredActivities.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500 italic">
                            Nessuna attività trovata.
                        </div>
                    )}
                </div>
            )}

            {isModalOpen && (
                <Modal onClose={handleCloseModal} size="lg">
                    <ActivityForm 
                        activity={editingActivity} 
                        onSave={handleSave} 
                        onCancel={handleCloseModal} 
                    />
                </Modal>
            )}

            <ConfirmModal 
                isOpen={!!activityToDelete}
                onClose={() => setActivityToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Elimina Attività"
                message="Sei sicuro di voler eliminare questa attività dal registro?"
                isDangerous={true}
            />
        </div>
    );
};

export default Activities;
