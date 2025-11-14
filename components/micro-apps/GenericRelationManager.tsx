import React, { useState, useMemo } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { AlertIcon } from '../icons/Icons';
import { Button } from '../ui/Button';
import { RelazioneTipo } from '../../types';

interface GenericRelationManagerProps {
    relazioneId: string;
}

// Helper to get a display name for any entity object
const getDisplayName = (item: any): string => {
    // Specific check for entities with both name and surname (like Genitori)
    if (item.cognome && item.nome) {
        return `${item.cognome} ${item.nome}`;
    }
    // Fallback for other entities
    return item.nome || item.ragioneSociale || item.tipo || item.id || 'N/D';
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const singularize = (s: string) => {
    if (s === 'sedi') return 'sede';
    if (s.endsWith('i')) return s.slice(0, -1) + 'e';
    return s.endsWith('s') ? s.slice(0, -1) : s;
};

export const GenericRelationManager: React.FC<GenericRelationManagerProps> = ({ relazioneId }) => {
    const allData = useMockData();
    const { relazioni, updateDocumentForRelation } = allData;

    const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

    const relazione = useMemo(() => relazioni.find(r => r.id === relazioneId), [relazioni, relazioneId]);

    const { parentCollection, childCollection, foreignKeyField, isManyToMany } = useMemo(() => {
        if (!relazione) return { parentCollection: [], childCollection: [], foreignKeyField: '', isManyToMany: false };
        
        const isMM = relazione.tipo === RelazioneTipo.MOLTI_A_MOLTI;
        const parentData = (allData as any)[relazione.entitaA] || [];
        const childData = (allData as any)[relazione.entitaB] || [];
        
        return {
            parentCollection: parentData,
            childCollection: childData,
            foreignKeyField: relazione.foreignKeyField,
            isManyToMany: isMM,
        };
    }, [relazione, allData]);

    const selectedParent = useMemo(() => {
        if (!selectedParentId) return null;
        return parentCollection.find((p: any) => p.id === selectedParentId) || null;
    }, [selectedParentId, parentCollection]);

    const { associatedChildren, availableChildren } = useMemo(() => {
        if (!selectedParent) {
            return { associatedChildren: [], availableChildren: [] };
        }
        
        if (isManyToMany) {
            const associatedIds = new Set(selectedParent[foreignKeyField] || []);
            const associated = childCollection.filter((c: any) => associatedIds.has(c.id));
            const available = childCollection.filter((c: any) => !associatedIds.has(c.id));
            return { associatedChildren: associated, availableChildren: available };
        } else { // One-to-Many
            const associated = childCollection.filter((c: any) => c[foreignKeyField] === selectedParent.id);
            const available = childCollection.filter((c: any) => !c[foreignKeyField]); // Only show truly unassociated
            return { associatedChildren: associated, availableChildren: available };
        }

    }, [selectedParent, childCollection, foreignKeyField, isManyToMany]);
    
    const handleAssociate = (child: any) => {
        if (!selectedParent || !relazione) return;
    
        if (isManyToMany) {
            const currentIds = selectedParent[foreignKeyField] || [];
            const newIds = [...new Set([...currentIds, child.id])];
            const updatedParent = { ...selectedParent, [foreignKeyField]: newIds };
            updateDocumentForRelation(relazione.entitaA, updatedParent);
        } else { // One-to-Many
            const updatedChild = { ...child, [foreignKeyField]: selectedParent.id };
            updateDocumentForRelation(relazione.entitaB, updatedChild);
        }
    };
    
    const handleDisassociate = (child: any) => {
        if (!relazione) return;
    
        if (isManyToMany) {
            if (!selectedParent) return;
            const currentIds = selectedParent[foreignKeyField] || [];
            const newIds = currentIds.filter((id: string) => id !== child.id);
            const updatedParent = { ...selectedParent, [foreignKeyField]: newIds };
            updateDocumentForRelation(relazione.entitaA, updatedParent);
        } else { // One-to-Many
            // FIX: Explicitly set the foreign key field to null to ensure its removal from the database,
            // which resolves the issue of disassociations not persisting.
            const updatedChild = { ...child, [foreignKeyField]: null };
            updateDocumentForRelation(relazione.entitaB, updatedChild);
        }
    };

    if (!relazione) {
        return (
            <div className="p-8 text-center text-red-500">
                <AlertIcon className="h-12 w-12 mx-auto mb-4" />
                <h2 className="text-xl font-bold">Errore di Configurazione</h2>
                <p>La relazione con ID "{relazioneId}" non è stata trovata.</p>
            </div>
        );
    }

    const parentLabel = isManyToMany ? capitalize(singularize(relazione.entitaA)) : capitalize(singularize(relazione.entitaA));

    return (
        <div className="p-4 md:p-8 h-full flex flex-col">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">{relazione.nome}</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{relazione.descrizione}</p>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Parent Selection Column */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col">
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700">1. Seleziona {parentLabel}</h2>
                     <div className="overflow-y-auto space-y-2">
                        {parentCollection.map((parent: any) => (
                            <button
                                key={parent.id}
                                onClick={() => setSelectedParentId(parent.id)}
                                className={`w-full text-left p-3 rounded-md transition-colors text-sm ${selectedParentId === parent.id ? 'bg-blue-600 text-white font-semibold' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                            >
                                {getDisplayName(parent)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Children Management Columns */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Associated Children */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700">Associati</h2>
                         <div className="overflow-y-auto space-y-2">
                             {!selectedParentId ? (
                                <p className="text-center text-gray-500 pt-8">Seleziona un elemento a sinistra.</p>
                             ) : associatedChildren.length === 0 ? (
                                <p className="text-center text-gray-500 pt-8">Nessun elemento associato.</p>
                             ) : (
                                associatedChildren.map((child: any) => (
                                    <div key={child.id} className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md flex justify-between items-center text-sm">
                                        <span>{getDisplayName(child)}</span>
                                        <Button size="sm" variant="secondary" onClick={() => handleDisassociate(child)}>Rimuovi</Button>
                                    </div>
                                ))
                             )}
                         </div>
                    </div>
                    {/* Available Children */}
                     <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700">Disponibili</h2>
                         <div className="overflow-y-auto space-y-2">
                            {!selectedParentId ? (
                                <p className="text-center text-gray-500 pt-8">Seleziona un elemento a sinistra.</p>
                             ) : availableChildren.length === 0 ? (
                                <p className="text-center text-gray-500 pt-8">Nessun elemento disponibile.</p>
                             ) : (
                                availableChildren.map((child: any) => (
                                    <div key={child.id} className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md flex justify-between items-center text-sm">
                                        <span>{getDisplayName(child)}</span>
                                        <Button size="sm" variant="primary" onClick={() => handleAssociate(child)}>Aggiungi</Button>
                                    </div>
                                ))
                            )}
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};