
import React, { useState } from 'react';
import { Note } from '../types';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';

interface NotesManagerProps {
    notesHistory: Note[];
    onSave: (newHistory: Note[]) => void;
    label?: string;
}

const NotesManager: React.FC<NotesManagerProps> = ({ notesHistory, onSave, label = "Storico Note" }) => {
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newContent, setNewContent] = useState('');

    const handleAddNote = () => {
        if (!newContent.trim()) return;

        const newNote: Note = {
            id: Date.now().toString(),
            date: new Date(newDate).toISOString(),
            content: newContent
        };

        // Aggiungi in testa (più recente in alto)
        const updatedHistory = [newNote, ...notesHistory];
        onSave(updatedHistory);
        
        setNewContent('');
        setNewDate(new Date().toISOString().split('T')[0]); // Reset a oggi
    };

    const handleDeleteNote = (id: string) => {
        if (confirm("Vuoi eliminare questa nota?")) {
            const updatedHistory = notesHistory.filter(n => n.id !== id);
            onSave(updatedHistory);
        }
    };

    return (
        <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{label}</label>
            
            {/* Area di Inserimento */}
            <div className="flex gap-2 items-end bg-gray-50 p-2 rounded border border-gray-200">
                <div className="w-32 flex-shrink-0">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Data</label>
                    <input 
                        type="date" 
                        value={newDate} 
                        onChange={e => setNewDate(e.target.value)} 
                        className="w-full p-1.5 border rounded text-xs bg-white focus:border-indigo-500"
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Nota</label>
                    <input 
                        type="text" 
                        value={newContent} 
                        onChange={e => setNewContent(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddNote())}
                        placeholder="Scrivi una nota..." 
                        className="w-full p-1.5 border rounded text-xs bg-white focus:border-indigo-500"
                    />
                </div>
                <button 
                    type="button"
                    onClick={handleAddNote}
                    disabled={!newContent.trim()}
                    className="md-btn md-btn-raised md-btn-green h-8 px-3 flex items-center justify-center disabled:opacity-50"
                    title="Aggiungi Nota"
                >
                    <PlusIcon /> <span className="ml-1 text-xs hidden sm:inline">Aggiungi</span>
                </button>
            </div>

            {/* Lista Storico */}
            <div className="bg-white border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                {notesHistory.length === 0 ? (
                    <p className="text-xs text-gray-400 italic p-3 text-center">Nessuna nota presente nello storico.</p>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {notesHistory.map(note => (
                            <div key={note.id} className="p-2 flex justify-between items-start hover:bg-gray-50 group">
                                <div className="flex-1 pr-2">
                                    <div className="text-[10px] font-bold text-gray-500 mb-0.5">
                                        {new Date(note.date).toLocaleDateString('it-IT')}
                                    </div>
                                    <p className="text-xs text-gray-800 leading-snug">{note.content}</p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Elimina nota"
                                >
                                    <TrashIcon />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotesManager;
