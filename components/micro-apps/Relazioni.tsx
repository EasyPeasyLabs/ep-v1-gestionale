import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon, LinkIcon } from '../icons/Icons';
import { RelazioneDef, RelazioneTipo } from '../../types';
import { EMPTY_RELAZIONE_DEF, RELAZIONE_TIPO_OPTIONS, ANAGRAFICHE_ENTITIES } from '../../constants';

// --- Helper Functions and Components ---

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const singularize = (s: string) => {
    if (s === 'sedi') return 'sede';
    if (s.endsWith('i')) return s.slice(0, -1) + 'e'; // plurali in i -> e (genitori -> genitore)
    return s.endsWith('s') ? s.slice(0, -1) : s; // basic
};


const RelazioneForm: React.FC<{
    relazione: RelazioneDef | Omit<RelazioneDef, 'id'>,
    onSave: (rel: RelazioneDef | Omit<RelazioneDef, 'id'>) => void,
    onCancel: () => void,
}> = ({ relazione, onSave, onCancel }) => {
    const [formData, setFormData] = useState(relazione);

    const handleEntitaChange = (e: React.ChangeEvent<HTMLSelectElement>, entita: 'entitaA' | 'entitaB') => {
        const { value } = e.target;
        const otherEntitaKey = entita === 'entitaA' ? 'entitaB' : 'entitaA';
        const otherEntitaValue = formData[otherEntitaKey];
        
        if (value === otherEntitaValue) {
            alert("Non puoi mettere in relazione un'entità con se stessa.");
            return;
        }

        const newFormData = { ...formData, [entita]: value };

        // Auto-suggest foreignKeyField
        if (formData.tipo === RelazioneTipo.UNO_A_MOLTI && entita === 'entitaA') {
            newFormData.foreignKeyField = `${singularize(value)}Id`;
        } else if (formData.tipo === RelazioneTipo.MOLTI_A_MOLTI && entita === 'entitaB') {
            newFormData.foreignKeyField = `${value}Ids`;
        }

        setFormData(newFormData);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const newState = { ...formData, [name]: value };

        // When relationship TYPE changes, auto-suggest a new foreign key
        if (name === 'tipo') {
            if (value === RelazioneTipo.MOLTI_A_MOLTI && newState.entitaB) {
                newState.foreignKeyField = `${newState.entitaB}Ids`;
            } else if (value === RelazioneTipo.UNO_A_MOLTI && newState.entitaA) {
                newState.foreignKeyField = `${singularize(newState.entitaA)}Id`;
            }
        }
        
        setFormData(newState);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const entitaOptions = ANAGRAFICHE_ENTITIES.map(e => ({ value: e, label: capitalize(e) }));

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Input id="nome" name="nome" label="Nome Relazione (App)" value={formData.nome} onChange={handleChange} placeholder="Es. Assegna Figli a Genitori" required />
            <Input id="descrizione" name="descrizione" label="Descrizione" value={formData.descrizione} onChange={handleChange} placeholder="A cosa serve questa relazione?" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <Select id="entitaA" name="entitaA" label={formData.tipo === RelazioneTipo.MOLTI_A_MOLTI ? "Entità A (Contenitore)" : "Entità 'UNO'"} value={formData.entitaA} onChange={e => handleEntitaChange(e, 'entitaA')} required>
                    <option value="">Seleziona...</option>
                    {entitaOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </Select>
                 <Select id="entitaB" name="entitaB" label={formData.tipo === RelazioneTipo.MOLTI_A_MOLTI ? "Entità B (Contenuti)" : "Entità 'MOLTI'"} value={formData.entitaB} onChange={e => handleEntitaChange(e, 'entitaB')} required>
                    <option value="">Seleziona...</option>
                    {entitaOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </Select>
            </div>
            
            <div className="flex justify-center items-center gap-4 p-4 border-2 border-dashed dark:border-gray-600 rounded-lg">
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md font-semibold">{formData.entitaA ? capitalize(formData.entitaA) : 'Entità A'}</div>
                <div className="text-center">
                    <div className="text-sm font-bold">{formData.tipo}</div>
                    <div className="text-2xl text-gray-400">&longleftrightarrow;</div>
                </div>
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md font-semibold">{formData.entitaB ? capitalize(formData.entitaB) : 'Entità B'}</div>
            </div>

            <Select id="tipo" name="tipo" label="Tipo di Relazione" options={RELAZIONE_TIPO_OPTIONS} value={formData.tipo} onChange={handleChange} required />
            
            {formData.tipo === RelazioneTipo.UNO_A_MOLTI && (
                <div>
                     <Input id="foreignKeyField" name="foreignKeyField" label="Campo Chiave Esterna (in Entità B)" value={formData.foreignKeyField} onChange={handleChange} required />
                     <p className="text-xs text-gray-500 mt-1">Questo campo verrà usato in <strong>{capitalize(formData.entitaB)}</strong> per collegarsi a <strong>{capitalize(formData.entitaA)}</strong>.</p>
                </div>
            )}
             {formData.tipo === RelazioneTipo.MOLTI_A_MOLTI && (
                <div>
                     <Input id="foreignKeyField" name="foreignKeyField" label="Campo Array di ID (in Entità A)" value={formData.foreignKeyField} onChange={handleChange} required />
                     <p className="text-xs text-gray-500 mt-1">Questo campo array in <strong>{capitalize(formData.entitaA)}</strong> conterrà gli ID di <strong>{capitalize(formData.entitaB)}</strong>.</p>
                </div>
            )}
            
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                <Button type="submit" variant="primary">Salva Relazione</Button>
            </div>
        </form>
    );
};


// --- Main Component ---
export const Relazioni: React.FC = () => {
    const { relazioni, addRelazione, updateRelazione, deleteRelazione } = useMockData();
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingRelazione, setEditingRelazione] = useState<RelazioneDef | Omit<RelazioneDef, 'id'> | null>(null);

    const handleOpenFormModal = (rel?: RelazioneDef) => {
        setEditingRelazione(rel || EMPTY_RELAZIONE_DEF);
        setIsFormModalOpen(true);
    };

    const handleCloseFormModal = () => {
        setEditingRelazione(null);
        setIsFormModalOpen(false);
    };

    const handleSave = (rel: RelazioneDef | Omit<RelazioneDef, 'id'>) => {
        if ('id' in rel && rel.id) {
            updateRelazione(rel as RelazioneDef);
        } else {
            addRelazione(rel as Omit<RelazioneDef, 'id'>);
        }
        handleCloseFormModal();
    };

    const handleDelete = (relId: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questa definizione di relazione?")) {
            deleteRelazione(relId);
        }
    };
    
    const handleToggleMicroApp = (rel: RelazioneDef) => {
        updateRelazione({ ...rel, microAppGenerated: !rel.microAppGenerated });
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Gestione Relazioni</h1>
                <Button onClick={() => handleOpenFormModal()} icon={<PlusIcon />}>
                    Nuova Relazione
                </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relazioni.map(rel => (
                    <div key={rel.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col justify-between">
                        <div>
                            <h2 className="text-xl font-bold mb-2">{rel.nome}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{rel.descrizione}</p>
                            <div className="flex justify-center items-center gap-4 p-4 border-2 border-dashed dark:border-gray-600 rounded-lg text-center mb-4">
                                <span className="font-semibold">{capitalize(rel.entitaA)}</span>
                                <LinkIcon className="h-5 w-5 text-gray-400" />
                                <span className="font-semibold">{capitalize(rel.entitaB)}</span>
                            </div>
                            <div className="text-xs font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                <p><strong>Tipo:</strong> {rel.tipo}</p>
                                <p><strong>FK:</strong> {rel.foreignKeyField}</p>
                            </div>
                        </div>
                        <div className="mt-6 pt-4 border-t dark:border-gray-700 flex flex-col gap-2">
                             <Button 
                                onClick={() => handleToggleMicroApp(rel)} 
                                variant={rel.microAppGenerated ? 'secondary' : 'primary'}
                             >
                                {rel.microAppGenerated ? 'Disattiva Micro-App' : 'Attiva Micro-App'}
                            </Button>
                            <div className="flex justify-end gap-2">
                                <Button onClick={() => handleOpenFormModal(rel)} variant="secondary"><PencilIcon /></Button>
                                <Button onClick={() => handleDelete(rel.id)} variant="danger"><TrashIcon /></Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {relazioni.length === 0 && (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                    <p>Nessuna relazione definita.</p>
                    <p>Crea la tua prima relazione per collegare le anagrafiche.</p>
                </div>
            )}

            {isFormModalOpen && editingRelazione && (
                <Modal isOpen={isFormModalOpen} onClose={handleCloseFormModal} title={('id' in editingRelazione && editingRelazione.id) ? 'Modifica Relazione' : 'Nuova Relazione'}>
                    <RelazioneForm relazione={editingRelazione} onSave={handleSave} onCancel={handleCloseFormModal} />
                </Modal>
            )}
        </div>
    );
};