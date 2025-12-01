import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import Pagination from '../components/Pagination';

// --- Helper per estrarre URL ---
const extractFirstUrl = (text: string): string | null => {
    if (!text) return null;
    const match = text.match(/(https?:\/\/[^\s]+)/g);
    return match ? match[0] : null;
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
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[90vh]">
            <div className="p-6 border-b flex-shrink-0">
                <h3 className="text-xl font-bold">{activity ? 'Modifica Attività' : 'Nuova Attività'}</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="md-input-group">
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="md-input" placeholder=" " />
                    <label className="md-input-label">Titolo Attività</label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="md-input-group">
                        <input type="text" value={category} onChange={e => setCategory(e.target.value)} required className="md-input" placeholder=" " />
                        <label className="md-input-label">Categoria (es. Motoria)</label>
                    </div>
                    <div className="md-input-group">
                        <input type="text" value={theme} onChange={e => setTheme(e.target.value)} className="md-input" placeholder=" " />
                        <label className="md-input-label">Filo Conduttore</label>
                    </div>
                </div>

                <div className="md-input-group">
                    <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} required className="md-input" placeholder="Descrizione dell'attività..." />
                </div>

                <div className="md-input-group">
                    <textarea rows={2} value={materials} onChange={e => setMaterials(e.target.value)} className="md-input" placeholder="Materiali necessari..." />
                </div>

                <div className="md-input-group">
                    <textarea rows={2} value={links} onChange={e => setLinks(e.target.value)} className="md-input" placeholder="Link utili (Youtube, Pinterest...)" />
                </div>
                {detectedLink && (
                    <div className="text-xs text-indigo-600 truncate">
                        <a href={detectedLink} target="_blank" rel="noreferrer" className="hover:underline">Link rilevato: {detectedLink}</a>
                    </div>
                )}

                {/* Attachments Area */}
                <div className="border-t pt-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Allegati (Foto/Video)</label>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                        {attachments.map((url, idx) => (
                            <div key={idx} className="relative group w-16 h-16 border rounded overflow-hidden bg-gray-100">
                                <img src={url} alt="attachment" className="w-full h-full object-cover" />
                                <button 
                                    type="button" 
                                    onClick={() => handleRemoveAttachment(url)}
                                    className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>

                    <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                        {isUploading ? <Spinner /> : <UploadIcon />}
                        <span className="ml-2">{isUploading ? 'Caricamento...' : 'Carica File'}</span>
                        <input type="file" onChange={handleFileUpload} multiple className="hidden" accept="image/*,video/*" />
                    </label>
                </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" disabled={isUploading} className="md-btn md-btn-raised md-btn-primary">Salva</button>
            </div>
        </form>
    );
};

const Activities: React.FC = () => {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 9; // Grid 3x3

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getActivities();
            setActivities(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (data: ActivityInput | Activity) => {
        try {
            if ('id' in data) {
                await updateActivity(data.id, data);
            } else {
                await addActivity(data as ActivityInput);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            alert("Errore salvataggio");
        }
    };

    const handleDelete = async () => {
        if (itemToDelete) {
            await deleteActivity(itemToDelete);
            setItemToDelete(null);
            fetchData();
        }
    };

    // Filter
    const filteredActivities = useMemo(() => {
        return activities.filter(a => 
            a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
            a.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.theme.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [activities, searchTerm]);

    // Pagination
    const paginatedActivities = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredActivities.slice(start, start + itemsPerPage);
    }, [filteredActivities, currentPage]);

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Libreria Attività</h1>
                    <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Archivio idee, materiali e proposte didattiche.</p>
                </div>
                <button onClick={() => { setEditingActivity(null); setIsModalOpen(true); }} className="md-btn md-btn-raised md-btn-green flex items-center">
                    <PlusIcon /><span className="ml-2">Nuova Attività</span>
                </button>
            </div>

            <div className="mb-6 bg-white p-3 rounded-lg border border-gray-200">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                    <input 
                        type="text" 
                        placeholder="Cerca per titolo, categoria o tema..." 
                        className="block w-full bg-gray-50 border border-gray-300 rounded-md py-2 pl-10 pr-3 text-sm focus:ring-1 focus:ring-indigo-500"
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {paginatedActivities.map(act => (
                            <div key={act.id} className="md-card flex flex-col h-full group hover:shadow-lg transition-shadow">
                                {/* Preview Image Header if attachments exist */}
                                {act.attachments && act.attachments.length > 0 ? (
                                    <div className="h-32 w-full bg-gray-100 relative overflow-hidden border-b">
                                        <img src={act.attachments[0]} alt={act.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                        {act.attachments.length > 1 && (
                                            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                                +{act.attachments.length - 1}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-4 bg-indigo-50 border-b border-indigo-100"></div> // Color strip if no image
                                )}

                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{act.category}</span>
                                        {act.theme && <span className="text-[10px] text-gray-500 italic">"{act.theme}"</span>}
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800 mb-2">{act.title}</h3>
                                    <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-1">{act.description}</p>
                                    
                                    <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-auto">
                                        <div className="flex gap-2">
                                            {act.links && <a href={extractFirstUrl(act.links) || '#'} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 text-xs font-medium flex items-center">LINK</a>}
                                            {act.materials && <span className="text-gray-400 text-xs" title={act.materials}>Mat.</span>}
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditingActivity(act); setIsModalOpen(true); }} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><PencilIcon /></button>
                                            <button onClick={() => setItemToDelete(act.id)} className="text-red-600 hover:bg-red-50 p-1 rounded"><TrashIcon /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {filteredActivities.length === 0 && (
                        <div className="text-center py-12 text-gray-500 italic">
                            Nessuna attività trovata. <br/>
                            <span className="text-xs">Crea la prima attività per popolare la libreria.</span>
                        </div>
                    )}

                    <Pagination 
                        currentPage={currentPage} 
                        totalItems={filteredActivities.length} 
                        itemsPerPage={itemsPerPage} 
                        onPageChange={setCurrentPage} 
                    />
                </>
            )}

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)} size="lg">
                    <ActivityForm 
                        activity={editingActivity} 
                        onSave={handleSave} 
                        onCancel={() => setIsModalOpen(false)} 
                    />
                </Modal>
            )}

            <ConfirmModal 
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={handleDelete}
                title="Elimina Attività"
                message="Sei sicuro di voler eliminare questa attività dalla libreria?"
                isDangerous={true}
            />
        </div>
    );
};

export default Activities;