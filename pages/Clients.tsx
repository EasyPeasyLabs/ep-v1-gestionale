import React, { useState, useEffect, useCallback } from 'react';
import { Client, ClientInput, ClientType, SubscriptionStatus, ParentClient, InstitutionalClient, Child } from '../types';
import { getClients, addClient, updateClient, deleteClient } from '../services/parentService';
import PlusIcon from '../components/icons/PlusIcon';
import SearchIcon from '../components/icons/SearchIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import ClientsIcon from '../components/icons/ClientsIcon';
import SuppliersIcon from '../components/icons/SuppliersIcon';
import UploadIcon from '../components/icons/UploadIcon';
import ImportModal from '../components/ImportModal';
import { importClientsFromCSV } from '../services/importService';


const getStatusBadge = (status: SubscriptionStatus) => {
  switch (status) {
    case SubscriptionStatus.Active:
      return 'bg-green-100 text-green-800';
    case SubscriptionStatus.Expired:
      return 'bg-red-100 text-red-800';
    case SubscriptionStatus.Inactive:
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
};

const ClientDetail: React.FC<{ client: Client; onBack: () => void }> = ({ client, onBack }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-md animate-fade-in">
            <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm mb-4">&larr; Torna alla lista</button>
            {client.clientType === ClientType.Parent ? (
                // Parent Detail View
                <>
                    <div className="flex items-start">
                        <img src={client.avatarUrl} alt={`${client.firstName} ${client.lastName}`} className="w-24 h-24 rounded-full mr-6"/>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">{client.firstName} {client.lastName}</h2>
                            <p className="text-slate-500">{client.email}</p>
                            <p className="text-slate-500">{client.phone}</p>
                            <p className="text-slate-500 text-sm mt-1">CF: {client.taxCode}</p>
                        </div>
                    </div>
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold text-slate-700">Figli Iscritti</h3>
                        {client.children.length > 0 ? client.children.map(child => (
                                <div key={child.id} className="mt-4 p-4 border border-slate-200 rounded-lg">
                                    <p className="font-semibold">{child.name}, {child.age}</p>
                                </div>
                            ))
                         : (
                        <p className="text-slate-500 text-sm mt-4">Nessun figlio registrato per questo genitore.</p>
                        )}
                    </div>
                </>
            ) : (
                // Institutional Detail View
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{client.companyName}</h2>
                    <p className="text-slate-500">{client.email} | {client.phone}</p>
                    <p className="text-slate-500 text-sm mt-1">P.IVA: {client.vatNumber}</p>
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold text-slate-700">Dettagli Contratto</h3>
                        <div className="mt-4 p-4 border border-slate-200 rounded-lg">
                            <p>Numero Bambini: <span className="font-medium">{client.numberOfChildren}</span></p>
                            <p>Fascia d'età: <span className="font-medium">{client.ageRange}</span></p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ClientForm: React.FC<{ client?: Client | null; onSave: (clientData: ClientInput | Client) => void; onCancel: () => void; }> = ({ client, onSave, onCancel }) => {
    const [clientType, setClientType] = useState<ClientType | null>(client?.clientType || null);

    // Common fields
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [zipCode, setZipCode] = useState('');
    const [city, setCity] = useState('');
    const [province, setProvince] = useState('');

    // Parent fields
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [taxCode, setTaxCode] = useState('');
    const [children, setChildren] = useState<Child[]>([]);
    const [newChildName, setNewChildName] = useState('');
    const [newChildAge, setNewChildAge] = useState('');
    
    // Institutional fields
    const [companyName, setCompanyName] = useState('');
    const [vatNumber, setVatNumber] = useState('');

    useEffect(() => {
        if (client) {
            setEmail(client.email);
            setPhone(client.phone);
            setAddress(client.address);
            setZipCode(client.zipCode);
            setCity(client.city);
            setProvince(client.province);
            if (client.clientType === ClientType.Parent) {
                setFirstName(client.firstName);
                setLastName(client.lastName);
                setTaxCode(client.taxCode);
                setChildren(client.children || []);
            } else {
                setCompanyName(client.companyName);
                setVatNumber(client.vatNumber);
            }
        }
    }, [client]);

    const handleAddChild = () => {
        if (newChildName && newChildAge) {
            setChildren([...children, { id: Date.now().toString(), name: newChildName, age: newChildAge }]);
            setNewChildName('');
            setNewChildAge('');
        }
    };

    const handleRemoveChild = (id: string) => {
        setChildren(children.filter(child => child.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let clientData: ClientInput | Client;

        const baseData = {
            address, zipCode, city, province, email, phone,
        };

        if (clientType === ClientType.Parent) {
            clientData = {
                ...baseData,
                clientType: ClientType.Parent,
                firstName,
                lastName,
                taxCode,
                avatarUrl: (client as ParentClient)?.avatarUrl || `https://i.pravatar.cc/150?u=${email}`,
                children: children,
                subscriptions: (client as ParentClient)?.subscriptions || [],
            };
        } else if (clientType === ClientType.Institutional) {
            clientData = {
                ...baseData,
                clientType: ClientType.Institutional,
                companyName,
                vatNumber,
                numberOfChildren: (client as InstitutionalClient)?.numberOfChildren || 0,
                ageRange: (client as InstitutionalClient)?.ageRange || '',
            };
        } else {
            return; // Should not happen
        }

        if (client?.id) {
            onSave({ ...clientData, id: client.id });
        } else {
            onSave(clientData as ClientInput);
        }
    };
    
    if (!clientType) {
        return (
             <div>
                <h2 className="text-xl font-bold mb-6 text-center">Seleziona Tipo Cliente</h2>
                <div className="flex justify-center space-x-4">
                    <button onClick={() => setClientType(ClientType.Parent)} className="flex flex-col items-center justify-center p-6 border rounded-lg w-40 h-40 hover:bg-indigo-50 hover:border-indigo-500 transition-colors">
                        <ClientsIcon/>
                        <span className="mt-2 font-medium">Genitore</span>
                    </button>
                    <button onClick={() => setClientType(ClientType.Institutional)} className="flex flex-col items-center justify-center p-6 border rounded-lg w-40 h-40 hover:bg-indigo-50 hover:border-indigo-500 transition-colors">
                       <SuppliersIcon />
                        <span className="mt-2 font-medium">Istituzionale</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="animate-fade-in">
            <h2 className="text-xl font-bold mb-4">{client ? 'Modifica Cliente' : 'Nuovo Cliente'} - <span className="text-indigo-600">{clientType === ClientType.Parent ? 'Genitore' : 'Istituzionale'}</span></h2>
            <div className="space-y-3">
                {clientType === ClientType.Parent ? (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                           <div>
                                <label className="block text-sm font-medium text-slate-700">Nome</label>
                                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Cognome</label>
                                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Codice Fiscale</label>
                            <input type="text" value={taxCode} onChange={e => setTaxCode(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                        </div>
                    </>
                ) : (
                     <>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Ragione Sociale</label>
                            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700">P.IVA / Codice Fiscale</label>
                            <input type="text" value={vatNumber} onChange={e => setVatNumber(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                        </div>
                    </>
                )}
                 <hr className="my-4"/>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Telefono</label>
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Indirizzo</label>
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                </div>
                 <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">CAP</label>
                        <input type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                    </div>
                     <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700">Città</label>
                        <input type="text" value={city} onChange={e => setCity(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Provincia</label>
                    <input type="text" value={province} onChange={e => setProvince(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                </div>
                
                 {clientType === ClientType.Parent && (
                    <div className="pt-4 border-t mt-4">
                        <h3 className="text-md font-semibold text-slate-700">Figli</h3>
                        {children.map((child) => (
                            <div key={child.id} className="flex items-center justify-between p-2 mt-2 bg-slate-50 rounded-md">
                                <p className="text-sm">{child.name} - {child.age}</p>
                                <button type="button" onClick={() => handleRemoveChild(child.id)} className="text-red-500 hover:text-red-700">
                                    <TrashIcon />
                                </button>
                            </div>
                        ))}
                        <div className="flex items-end space-x-2 mt-3">
                            <div className="flex-grow">
                                <label className="block text-sm font-medium text-slate-700">Nome Figlio</label>
                                <input type="text" value={newChildName} onChange={e => setNewChildName(e.target.value)} placeholder="Nome" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"/>
                            </div>
                            <div className="flex-grow">
                                <label className="block text-sm font-medium text-slate-700">Età</label>
                                <input type="text" value={newChildAge} onChange={e => setNewChildAge(e.target.value)} placeholder="Es. 3 anni" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"/>
                            </div>
                            <button type="button" onClick={handleAddChild} className="bg-indigo-500 text-white p-2 rounded-md hover:bg-indigo-600"><PlusIcon/></button>
                        </div>
                    </div>
                )}
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    Annulla
                </button>
                <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    Salva
                </button>
            </div>
        </form>
    );
};


const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const clientsData = await getClients();
      setClients(clientsData);
      setError(null);
    } catch (err) {
      setError("Impossibile caricare i clienti.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleOpenModal = (client: Client | null = null) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingClient(null);
    setIsModalOpen(false);
  };

  const handleSaveClient = async (clientData: ClientInput | Client) => {
    try {
      if ('id' in clientData) {
        await updateClient(clientData.id, clientData);
      } else {
        await addClient(clientData);
      }
      handleCloseModal();
      fetchClients();
    } catch (err) {
      console.error("Errore nel salvataggio del cliente:", err);
      setError("Salvataggio fallito.");
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (window.confirm("Sei sicuro di voler eliminare questo cliente?")) {
      try {
        await deleteClient(id);
        fetchClients();
      } catch (err) {
        console.error("Errore nell'eliminazione del cliente:", err);
        setError("Eliminazione fallita.");
      }
    }
  };

  const handleImport = async (file: File) => {
    const result = await importClientsFromCSV(file);
    fetchClients(); // Refresh the list after import
    return result;
  };


  if (selectedClient) {
    return <ClientDetail client={selectedClient} onBack={() => setSelectedClient(null)} />;
  }

  return (
    <div>
        <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Clienti</h1>
              <p className="mt-1 text-slate-500">Gestisci le anagrafiche di genitori e clienti istituzionali.</p>
            </div>
             <div className="flex items-center space-x-2">
                <button onClick={() => setIsImportModalOpen(true)} className="flex items-center bg-white text-slate-700 px-4 py-2 rounded-lg shadow-sm border border-slate-300 hover:bg-slate-50 transition-colors">
                    <UploadIcon />
                    <span className="ml-2">Importa CSV</span>
                </button>
                <button onClick={() => handleOpenModal()} className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors">
                    <PlusIcon />
                    <span className="ml-2">Aggiungi Cliente</span>
                </button>
            </div>
        </div>

        {isModalOpen && (
            <Modal onClose={handleCloseModal} size="xl">
                <ClientForm client={editingClient} onSave={handleSaveClient} onCancel={handleCloseModal} />
            </Modal>
        )}
        
        {isImportModalOpen && (
            <ImportModal 
                entityName="Clienti"
                templateCsvContent={'type,email,firstName,lastName,taxCode,companyName,vatNumber,phone,address,zipCode,city,province\nparent,mario.rossi@email.com,Mario,Rossi,RSSMRA80A01H501U,,,,0123456789,"Via Roma 1","20100","Milano",MI\ninstitutional,info@asiloarcobaleno.it,,,,Asilo Arcobaleno,12345678901,0987654321,"Viale Garibaldi 5","00100","Roma",RM'}
                instructions={[
                    'La prima riga deve contenere le intestazioni delle colonne.',
                    'Il separatore dei campi deve essere la virgola (,).',
                    'Il campo "email" è la chiave unica per l\'aggiornamento.',
                    'Il campo "type" deve essere "parent" o "institutional".'
                ]}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImport}
            />
        )}


        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon />
              </div>
              <input type="text" placeholder="Cerca cliente..." className="block w-full max-w-sm bg-slate-50 border border-slate-200 rounded-md py-2 pl-10 pr-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
          </div>
          <div className="overflow-x-auto">
            {loading ? <div className="flex justify-center items-center py-8"><Spinner /></div> : 
             error ? <p className="text-center text-red-500 py-8">{error}</p> :
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500">
                  <th className="p-4">Nome / Ragione Sociale</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Contatti</th>
                  <th className="p-4">Figli</th>
                  <th className="p-4">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center">
                        {client.clientType === ClientType.Parent && <img src={client.avatarUrl} alt={client.firstName} className="w-10 h-10 rounded-full mr-3"/>}
                        <span className="font-medium text-slate-800">
                            {client.clientType === ClientType.Parent ? `${client.firstName} ${client.lastName}` : client.companyName}
                        </span>
                      </div>
                    </td>
                     <td className="p-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${client.clientType === ClientType.Parent ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                            {client.clientType === ClientType.Parent ? 'Genitore' : 'Istituzionale'}
                        </span>
                     </td>
                    <td className="p-4 text-sm text-slate-600">
                      <div>{client.email}</div>
                      <div>{client.phone}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                        {client.clientType === ClientType.Parent ? client.children.length : 'N/A'}
                    </td>
                    <td className="p-4">
                        <div className="flex items-center space-x-4">
                            <button onClick={() => setSelectedClient(client)} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">
                                Dettagli
                            </button>
                            <button onClick={() => handleOpenModal(client)} className="text-slate-500 hover:text-slate-700">
                                <PencilIcon />
                            </button>
                            <button onClick={() => handleDeleteClient(client.id)} className="text-red-500 hover:text-red-700">
                                <TrashIcon />
                            </button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            }
          </div>
        </div>
    </div>
  );
};

export default Clients;