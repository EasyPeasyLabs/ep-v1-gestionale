import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Tabs } from '../ui/Tabs';
import { PlusIcon, PencilIcon, TrashIcon, StarIcon } from '../icons/Icons';
import { CLIENTE_CLASSE_OPTIONS, CLIENTE_TIPO_OPTIONS, CLIENTE_STATO_OPTIONS, EMPTY_INDIRIZZO, EMPTY_GENITORE, EMPTY_DITTA } from '../../constants';
// FIX: Added ClienteFamiglia to imports
import { Cliente, ClienteTipo, DatiFamiglia, ClienteEnteAzienda, DatiDitta, BambiniEnte, Genitore, Figlio, ClienteFamiglia, Indirizzo } from '../../types';

const getInitialFormData = (): Cliente => ({
    id: '',
    classe: CLIENTE_CLASSE_OPTIONS[0],
    // FIX: Use a specific enum member for the discriminating property 'tipo'
    // to help TypeScript correctly infer the object type within the discriminated union.
    tipo: ClienteTipo.ENTE,
    stato: CLIENTE_STATO_OPTIONS[0],
    rating: 0,
    dati: {
        ragioneSociale: '',
        partitaIva: '',
        indirizzo: { ...EMPTY_INDIRIZZO },
        telefono: '',
        email: '',
        referente: ''
    }
});


const ClienteForm: React.FC<{ cliente: Cliente, onSave: (cliente: Cliente) => void, onCancel: () => void }> = ({ cliente, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Cliente>(cliente);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // FIX: Use type guard in setFormData to ensure correct type for discriminated union
    const handleDittaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            if (prev.tipo === ClienteTipo.ENTE || prev.tipo === ClienteTipo.AZIENDA) {
                return { ...prev, dati: { ...prev.dati, [name]: value } };
            }
            return prev;
        });
    };

    const handleGenitoreChange = (e: React.ChangeEvent<HTMLInputElement>, genitoreKey: 'genitore1' | 'genitore2') => {
        const { name, value } = e.target;
        setFormData(prev => {
            if (prev.tipo !== ClienteTipo.FAMIGLIA) return prev;
            const currentGenitore = prev.dati[genitoreKey] || { ...EMPTY_GENITORE };
            const updatedGenitore = { ...currentGenitore, [name]: value };
            return { ...prev, dati: { ...prev.dati, [genitoreKey]: updatedGenitore } };
        });
    };
    
    const handleIndirizzoChange = (e: React.ChangeEvent<HTMLInputElement>, genitoreKey: 'genitore1' | 'genitore2') => {
        const { name, value } = e.target;
        setFormData(prev => {
            if (prev.tipo !== ClienteTipo.FAMIGLIA) return prev;
            const currentGenitore = prev.dati[genitoreKey] || { ...EMPTY_GENITORE };
            const updatedIndirizzo = { ...(currentGenitore.indirizzo || EMPTY_INDIRIZZO), [name]: value };
            const updatedGenitore = { ...currentGenitore, indirizzo: updatedIndirizzo };
            return { ...prev, dati: { ...prev.dati, [genitoreKey]: updatedGenitore } };
        });
    };
    
    // FIX: Use type guard in setFormData to ensure correct type for discriminated union
    const handleAddFiglio = () => {
        setFormData(prev => {
            if (prev.tipo !== ClienteTipo.FAMIGLIA) return prev;
            const newFigli = [...(prev.dati.figli || []), { nome: '', eta: '' }];
            return { ...prev, dati: { ...prev.dati, figli: newFigli }};
        });
    };

    // FIX: Use type guard in setFormData to ensure correct type for discriminated union
    const handleFiglioChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const { name, value } = e.target;
        setFormData(prev => {
            if (prev.tipo !== ClienteTipo.FAMIGLIA) return prev;
            const newFigli = [...prev.dati.figli];
            newFigli[index] = { ...newFigli[index], [name]: value };
            return { ...prev, dati: { ...prev.dati, figli: newFigli }};
        });
    };
    
    // FIX: Use type guard in setFormData to ensure correct type for discriminated union
    const handleRemoveFiglio = (index: number) => {
        setFormData(prev => {
            if (prev.tipo !== ClienteTipo.FAMIGLIA) return prev;
            const newFigli = prev.dati.figli.filter((_, i) => i !== index);
            return { ...prev, dati: { ...prev.dati, figli: newFigli }};
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const DittaForm: React.FC = () => {
        const dati = (formData as ClienteEnteAzienda).dati;
        return (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input id="ragioneSociale" name="ragioneSociale" label="Ragione Sociale" value={dati.ragioneSociale} onChange={handleDittaChange} required />
                <Input id="partitaIva" name="partitaIva" label="Partita Iva" value={dati.partitaIva} onChange={handleDittaChange} required/>
                <Input id="referente" name="referente" label="Referente" value={dati.referente} onChange={handleDittaChange} />
                <Input id="email" name="email" label="Email" type="email" value={dati.email} onChange={handleDittaChange} />
                <Input id="telefono" name="telefono" label="Telefono" value={dati.telefono} onChange={handleDittaChange} />
            </div>
        );
    };

    const FamigliaForm: React.FC = () => {
        const dati = formData.dati as DatiFamiglia;
        
        const GenitoreTab: React.FC<{ genitore: Partial<Genitore>, genitoreKey: 'genitore1' | 'genitore2'}> = ({ genitore, genitoreKey }) => (
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Input id={`${genitoreKey}-cognome`} name="cognome" label="Cognome" value={genitore.cognome || ''} onChange={e => handleGenitoreChange(e, genitoreKey)} required={genitoreKey === 'genitore1'}/>
                     <Input id={`${genitoreKey}-nome`} name="nome" label="Nome" value={genitore.nome || ''} onChange={e => handleGenitoreChange(e, genitoreKey)} required={genitoreKey === 'genitore1'}/>
                     <Input id={`${genitoreKey}-cf`} name="codiceFiscale" label="Codice Fiscale" value={genitore.codiceFiscale || ''} onChange={e => handleGenitoreChange(e, genitoreKey)} required={genitoreKey === 'genitore1'}/>
                     <Input id={`${genitoreKey}-email`} name="email" label="Email" type="email" value={genitore.email || ''} onChange={e => handleGenitoreChange(e, genitoreKey)} />
                     <Input id={`${genitoreKey}-telefono`} name="telefono" label="Telefono" value={genitore.telefono || ''} onChange={e => handleGenitoreChange(e, genitoreKey)} />
                </div>
                <div className="pt-4">
                    <h4 className="text-md font-medium text-gray-800 dark:text-gray-200">Indirizzo</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <Input id={`${genitoreKey}-via`} name="via" label="Via / Piazza" value={genitore.indirizzo?.via || ''} onChange={e => handleIndirizzoChange(e, genitoreKey)} />
                        <Input id={`${genitoreKey}-civico`} name="civico" label="N. Civico" value={genitore.indirizzo?.civico || ''} onChange={e => handleIndirizzoChange(e, genitoreKey)} />
                        <Input id={`${genitoreKey}-cap`} name="cap" label="CAP" value={genitore.indirizzo?.cap || ''} onChange={e => handleIndirizzoChange(e, genitoreKey)} />
                        <Input id={`${genitoreKey}-citta`} name="citta" label="Città" value={genitore.indirizzo?.citta || ''} onChange={e => handleIndirizzoChange(e, genitoreKey)} />
                        <Input id={`${genitoreKey}-provincia`} name="provincia" label="Provincia" value={genitore.indirizzo?.provincia || ''} onChange={e => handleIndirizzoChange(e, genitoreKey)} />
                    </div>
                </div>
            </div>
        );
        
        return (
            <div>
                 <Tabs tabs={[
                    { label: 'Genitore 1 (Obbligatorio)', content: <GenitoreTab genitore={dati.genitore1} genitoreKey="genitore1" /> },
                    { label: 'Genitore 2', content: <GenitoreTab genitore={dati.genitore2 || {}} genitoreKey="genitore2" /> }
                 ]}/>

                <div className="mt-6">
                    <h4 className="text-lg font-medium mb-2">Figli</h4>
                    {dati.figli?.map((figlio, index) => (
                        <div key={index} className="flex items-end gap-4 mb-2 p-2 border rounded-md">
                            <Input id={`figlio-nome-${index}`} name="nome" label="Nome Figlio" value={figlio.nome} onChange={e => handleFiglioChange(e as React.ChangeEvent<HTMLInputElement>, index)} />
                            <Input id={`figlio-eta-${index}`} name="eta" label="Età (anni/mesi)" value={figlio.eta} onChange={e => handleFiglioChange(e as React.ChangeEvent<HTMLInputElement>, index)} />
                             <Button variant="danger" type="button" onClick={() => handleRemoveFiglio(index)}>
                                <TrashIcon />
                             </Button>
                        </div>
                    ))}
                    <Button type="button" variant="secondary" onClick={handleAddFiglio} icon={<PlusIcon />}>Aggiungi Figlio</Button>
                </div>
            </div>
        );
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select id="classe" name="classe" label="Classe" options={CLIENTE_CLASSE_OPTIONS} value={formData.classe} onChange={handleChange} />
                    {/* FIX: Replaced onChange logic to correctly handle discriminated union state update */}
                    <Select id="tipo" name="tipo" label="Tipo" options={CLIENTE_TIPO_OPTIONS} value={formData.tipo} onChange={(e) => {
                        const newTipo = e.target.value as ClienteTipo;
                        setFormData(prev => {
                            if (prev.tipo === newTipo) return prev;

                            const commonProps = {
                                id: prev.id,
                                classe: prev.classe,
                                stato: prev.stato,
                                rating: prev.rating,
                            };

                            if (newTipo === ClienteTipo.FAMIGLIA) {
                                const newCliente: ClienteFamiglia = {
                                    ...commonProps,
                                    tipo: newTipo,
                                    dati: { genitore1: {...EMPTY_GENITORE}, genitore2: {...EMPTY_GENITORE}, figli: [] }
                                };
                                return newCliente;
                            } else {
                                const newCliente: ClienteEnteAzienda = {
                                    ...commonProps,
                                    tipo: newTipo,
                                    dati: {...EMPTY_DITTA}
                                };
                                return newCliente;
                            }
                        });
                    }} />
                    <Select id="stato" name="stato" label="Stato" options={CLIENTE_STATO_OPTIONS} value={formData.stato} onChange={handleChange} />
                </div>
                 <hr className="my-6 dark:border-gray-600"/>
                {formData.tipo === ClienteTipo.FAMIGLIA ? <FamigliaForm /> : <DittaForm />}
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Cliente</Button>
            </div>
        </form>
    );
};


export const Clienti: React.FC = () => {
    const { clienti, addCliente, updateCliente, deleteCliente } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

    const handleOpenModal = (cliente?: Cliente) => {
        setEditingCliente(cliente || getInitialFormData());
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingCliente(null);
        setIsModalOpen(false);
    };

    const handleSaveCliente = (clienteData: Cliente) => {
        // Rimuovi genitore2 se è vuoto per non salvarlo in Firebase
        const clienteToSave = { ...clienteData };
        if (clienteToSave.tipo === ClienteTipo.FAMIGLIA) {
            const g2 = clienteToSave.dati.genitore2;
            if (g2 && !g2.cognome && !g2.nome && !g2.codiceFiscale) {
                delete clienteToSave.dati.genitore2;
            }
        }

        if (clienteToSave.id) {
            updateCliente(clienteToSave);
        } else {
            // Rimuovo l'id vuoto prima di creare un nuovo documento
            const { id, ...newCliente } = clienteToSave;
            addCliente(newCliente as Omit<Cliente, 'id'>);
        }
        handleCloseModal();
    };
    
    const handleDeleteCliente = (clienteId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questo cliente?')) {
            deleteCliente(clienteId);
        }
    }
    
    const getClienteDisplayName = (cliente: Cliente) => {
        if (cliente.tipo === ClienteTipo.FAMIGLIA) {
            return `Fam. ${cliente.dati.genitore1.cognome} ${cliente.dati.genitore1.nome}`;
        }
        return (cliente.dati as DatiDitta).ragioneSociale;
    };
    
    const StarRatingDisplay: React.FC<{ rating: number }> = ({ rating }) => (
        <div className="flex">
            {[...Array(5)].map((_, i) => (
                <StarIcon key={i} filled={i < rating} />
            ))}
        </div>
    );

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Anagrafica Clienti</h1>
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuovo Cliente</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome / Rag. Sociale</th>
                            <th scope="col" className="px-6 py-3">Tipo</th>
                            <th scope="col" className="px-6 py-3">Stato</th>
                            <th scope="col" className="px-6 py-3">Rating</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clienti.map(cliente => (
                            <tr key={cliente.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    {getClienteDisplayName(cliente)}
                                </th>
                                <td className="px-6 py-4">{cliente.tipo}</td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">{cliente.stato}</span>
                                </td>
                                <td className="px-6 py-4"><StarRatingDisplay rating={cliente.rating} /></td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(cliente)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDeleteCliente(cliente.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingCliente && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingCliente.id ? 'Modifica Cliente' : 'Nuovo Cliente'}>
                    <ClienteForm cliente={editingCliente} onSave={handleSaveCliente} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};