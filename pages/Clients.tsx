import React, { useState, useEffect, useCallback } from 'react';
import { Client, ClientInput, ClientType, ParentClient, InstitutionalClient, Child, Enrollment, SubscriptionType, ScheduledClass, EnrollmentInput, EnrollmentStatus, TransactionType, TransactionCategory, PaymentMethod } from '../types';
import { getClients, addClient, updateClient, deleteClient } from '../services/parentService';
import { getEnrollmentsForClient, addEnrollment } from '../services/enrollmentService';
import { getSubscriptionTypes } from '../services/settingsService';
import { getScheduledClasses } from '../services/calendarService';
import { addTransaction } from '../services/financeService';
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
import { importClientsFromExcel } from '../services/importService';

const EnrollmentForm: React.FC<{
    parent: ParentClient;
    onSave: (enrollment: EnrollmentInput, subType: SubscriptionType, child: Child) => void;
    onCancel: () => void;
}> = ({ parent, onSave, onCancel }) => {
    const [childId, setChildId] = useState('');
    const [subscriptionTypeId, setSubscriptionTypeId] = useState('');
    const [scheduledClassId, setScheduledClassId] = useState('');

    const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
    const [scheduledClasses, setScheduledClasses] = useState<ScheduledClass[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [subs, classes] = await Promise.all([
                getSubscriptionTypes(),
                getScheduledClasses()
            ]);
            setSubscriptionTypes(subs);
            setScheduledClasses(classes);
            if (parent.children.length > 0) setChildId(parent.children[0].id);
            if (subs.length > 0) setSubscriptionTypeId(subs[0].id);
            if (classes.length > 0) setScheduledClassId(classes[0].id);
            setLoading(false);
        };
        fetchData();
    }, [parent.children]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const selectedChild = parent.children.find(c => c.id === childId);
        const selectedSub = subscriptionTypes.find(s => s.id === subscriptionTypeId);
        
        if (!selectedChild || !selectedSub) return;
        
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + selectedSub.durationInDays);

        const newEnrollment: EnrollmentInput = {
            clientId: parent.id,
            childId,
            childName: selectedChild.name,
            subscriptionTypeId,
            subscriptionName: selectedSub.name,
            scheduledClassId,
            lessonsTotal: selectedSub.lessons,
            lessonsRemaining: selectedSub.lessons,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            status: EnrollmentStatus.Active,
        };
        onSave(newEnrollment, selectedSub, selectedChild);
    };

    if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-bold mb-4">Nuova Iscrizione</h2>
            <div className="space-y-4">
                <div className="md-input-group">
                    <select id="child" value={childId} onChange={e => setChildId(e.target.value)} required className="md-input">
                        {parent.children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
                    </select>
                    <label htmlFor="child" className="md-input-label !top-0 !text-xs !text-gray-500">Figlio</label>
                </div>
                <div className="md-input-group">
                    <select id="sub-type" value={subscriptionTypeId} onChange={e => setSubscriptionTypeId(e.target.value)} required className="md-input">
                        {subscriptionTypes.map(sub => <option key={sub.id} value={sub.id}>{sub.name} ({sub.lessons} lezioni, {sub.price}€)</option>)}
                    </select>
                    <label htmlFor="sub-type" className="md-input-label !top-0 !text-xs !text-gray-500">Pacchetto Abbonamento</label>
                </div>
                <div className="md-input-group">
                    <select id="class" value={scheduledClassId} onChange={e => setScheduledClassId(e.target.value)} required className="md-input">
                       {scheduledClasses.map(c => <option key={c.id} value={c.id}>{c.dayOfWeek} {c.startTime}-{c.endTime} @ {c.locationName}</option>)}
                    </select>
                    <label htmlFor="class" className="md-input-label !top-0 !text-xs !text-gray-500">Lezione</label>
                </div>
            </div>
             <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green">Iscrivi</button>
            </div>
        </form>
    );
};


const ClientDetail: React.FC<{ client: Client; onBack: () => void; onEdit: (client: Client) => void; }> = ({ client, onBack, onEdit }) => {
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
    
    const fetchEnrollments = useCallback(async () => {
        if(client.clientType === ClientType.Parent) {
            setLoading(true);
            const data = await getEnrollmentsForClient(client.id);
            setEnrollments(data);
            setLoading(false);
        }
    }, [client.id, client.clientType]);

    useEffect(() => {
        fetchEnrollments();
    }, [fetchEnrollments]);

    const handleSaveEnrollment = async (enrollment: EnrollmentInput, subType: SubscriptionType, child: Child) => {
        const newEnrollmentId = await addEnrollment(enrollment);
        await addTransaction({
            date: new Date().toISOString(),
            description: `Iscrizione ${child.name} - Pacchetto ${subType.name}`,
            amount: subType.price,
            type: TransactionType.Income,
            category: TransactionCategory.Sales,
            paymentMethod: PaymentMethod.Other,
            relatedDocumentId: newEnrollmentId,
        });
        setIsEnrollModalOpen(false);
        fetchEnrollments();
    };


    return (
        <div className="md-card p-6 animate-fade-in">
            <div className="flex justify-between items-start">
                <button onClick={onBack} className="text-sm font-medium mb-4" style={{ color: 'var(--md-primary)'}}>&larr; Torna alla lista</button>
                 <button onClick={() => onEdit(client)} className="md-icon-btn edit" aria-label="Modifica cliente">
                    <PencilIcon />
                </button>
            </div>
            {client.clientType === ClientType.Parent ? (
                <>
                    <div className="flex items-start">
                        <img src={client.avatarUrl} alt={`${client.firstName} ${client.lastName}`} className="w-24 h-24 rounded-full mr-6"/>
                        <div>
                            <h2 className="text-2xl font-bold">{client.firstName} {client.lastName}</h2>
                            <p style={{ color: 'var(--md-text-secondary)'}}>{client.email} | {client.phone}</p>
                            <p className="text-sm mt-1" style={{ color: 'var(--md-text-secondary)'}}>CF: {client.taxCode}</p>
                        </div>
                    </div>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-lg font-semibold">Figli</h3>
                            {client.children.length > 0 ? client.children.map(child => (
                                    <div key={child.id} className="mt-2 p-3 border rounded-lg" style={{ borderColor: 'var(--md-divider)'}}>
                                        <p className="font-semibold">{child.name}, {child.age}</p>
                                    </div>
                                ))
                             : (
                            <p className="text-sm mt-4" style={{ color: 'var(--md-text-secondary)'}}>Nessun figlio registrato.</p>
                            )}
                        </div>
                        <div>
                             <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Iscrizioni</h3>
                                <button onClick={() => setIsEnrollModalOpen(true)} className="md-btn md-btn-flat md-btn-primary text-sm">
                                    <PlusIcon/> <span className="ml-1">Iscrivi</span>
                                </button>
                             </div>
                              {loading ? <div className="mt-4"><Spinner/></div> :
                                enrollments.length > 0 ? enrollments.map(enr => (
                                    <div key={enr.id} className="mt-2 p-3 border rounded-lg" style={{ borderColor: 'var(--md-divider)'}}>
                                        <p className="font-semibold">{enr.childName} - {enr.subscriptionName}</p>
                                        <p className="text-sm" style={{ color: 'var(--md-text-secondary)'}}>Lezioni Rimanenti: {enr.lessonsRemaining}/{enr.lessonsTotal}</p>
                                        <p className="text-xs" style={{ color: 'var(--md-text-secondary)'}}>Scadenza: {new Date(enr.endDate).toLocaleDateString()}</p>
                                    </div>
                                ))
                             : (
                            <p className="text-sm mt-4" style={{ color: 'var(--md-text-secondary)'}}>Nessuna iscrizione attiva.</p>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div>
                    <h2 className="text-2xl font-bold">{client.companyName}</h2>
                    <p style={{ color: 'var(--md-text-secondary)'}}>{client.email} | {client.phone}</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--md-text-secondary)'}}>P.IVA: {client.vatNumber}</p>
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold">Dettagli Contratto</h3>
                        <div className="mt-4 p-4 border rounded-lg" style={{ borderColor: 'var(--md-divider)'}}>
                            <p>Numero Bambini: <span className="font-medium">{client.numberOfChildren}</span></p>
                            <p>Fascia d'età: <span className="font-medium">{client.ageRange}</span></p>
                        </div>
                    </div>
                </div>
            )}
             {isEnrollModalOpen && client.clientType === ClientType.Parent && (
                <Modal onClose={() => setIsEnrollModalOpen(false)}>
                    <EnrollmentForm parent={client} onSave={handleSaveEnrollment} onCancel={() => setIsEnrollModalOpen(false)} />
                </Modal>
            )}
        </div>
    );
};

const ClientForm: React.FC<{ client?: Client | null; onSave: (clientData: ClientInput | Client) => void; onCancel: () => void; }> = ({ client, onSave, onCancel }) => {
    const [clientType, setClientType] = useState<ClientType | null>(client?.clientType || null);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [zipCode, setZipCode] = useState('');
    const [city, setCity] = useState('');
    const [province, setProvince] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [taxCode, setTaxCode] = useState('');
    const [children, setChildren] = useState<Child[]>([]);
    const [newChildName, setNewChildName] = useState('');
    const [newChildAge, setNewChildAge] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [vatNumber, setVatNumber] = useState('');

    useEffect(() => {
        if (client) {
            setEmail(client.email); setPhone(client.phone); setAddress(client.address);
            setZipCode(client.zipCode); setCity(client.city); setProvince(client.province);
            if (client.clientType === ClientType.Parent) {
                setFirstName(client.firstName); setLastName(client.lastName);
                setTaxCode(client.taxCode); setChildren(client.children || []);
            } else {
                setCompanyName(client.companyName); setVatNumber(client.vatNumber);
            }
        }
    }, [client]);

    const handleAddChild = () => {
        if (newChildName && newChildAge) {
            setChildren([...children, { id: Date.now().toString(), name: newChildName, age: newChildAge }]);
            setNewChildName(''); setNewChildAge('');
        }
    };

    const handleRemoveChild = (id: string) => {
        setChildren(children.filter(child => child.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const baseData = { address, zipCode, city, province, email, phone };
        let clientData: ClientInput | Omit<ParentClient, 'id'> | Omit<InstitutionalClient, 'id'>;
        if (clientType === ClientType.Parent) {
            clientData = { ...baseData, clientType, firstName, lastName, taxCode, avatarUrl: (client as ParentClient)?.avatarUrl || `https://i.pravatar.cc/150?u=${email}`, children };
        } else if (clientType === ClientType.Institutional) {
            clientData = { ...baseData, clientType, companyName, vatNumber, numberOfChildren: (client as InstitutionalClient)?.numberOfChildren || 0, ageRange: (client as InstitutionalClient)?.ageRange || '' };
        } else { return; }

        if (client?.id) { onSave({ ...clientData, id: client.id } as Client); } 
        else { onSave(clientData as ClientInput); }
    };
    
    if (!clientType) {
        return (
             <div>
                <h2 className="text-xl font-bold mb-6 text-center">Seleziona Tipo Cliente</h2>
                <div className="flex justify-center space-x-4">
                    <button onClick={() => setClientType(ClientType.Parent)} className="flex flex-col items-center justify-center p-6 border rounded-lg w-40 h-40 hover:bg-indigo-50 transition-colors" style={{borderColor: 'var(--md-divider)'}}>
                        <ClientsIcon/> <span className="mt-2 font-medium">Genitore</span>
                    </button>
                    <button onClick={() => setClientType(ClientType.Institutional)} className="flex flex-col items-center justify-center p-6 border rounded-lg w-40 h-40 hover:bg-indigo-50 transition-colors" style={{borderColor: 'var(--md-divider)'}}>
                       <SuppliersIcon /> <span className="mt-2 font-medium">Istituzionale</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="animate-fade-in">
            <h2 className="text-xl font-bold mb-4">{client ? 'Modifica Cliente' : 'Nuovo Cliente'} - <span style={{color: 'var(--md-primary)'}}>{clientType === ClientType.Parent ? 'Genitore' : 'Istituzionale'}</span></h2>
            <div className="space-y-3">
                {clientType === ClientType.Parent ? (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="md-input-group"><input id="firstName" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="firstName" className="md-input-label">Nome</label></div>
                           <div className="md-input-group"><input id="lastName" type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="lastName" className="md-input-label">Cognome</label></div>
                        </div>
                        <div className="md-input-group"><input id="taxCode" type="text" value={taxCode} onChange={e => setTaxCode(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="taxCode" className="md-input-label">Codice Fiscale</label></div>
                    </>
                ) : (
                     <>
                        <div className="md-input-group"><input id="companyName" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="companyName" className="md-input-label">Ragione Sociale</label></div>
                        <div className="md-input-group"><input id="vatNumber" type="text" value={vatNumber} onChange={e => setVatNumber(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="vatNumber" className="md-input-label">P.IVA / Codice Fiscale</label></div>
                    </>
                )}
                 <hr className="my-4" style={{borderColor: 'var(--md-divider)'}}/>
                <div className="grid grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="email" className="md-input-label">Email</label></div>
                    <div className="md-input-group"><input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="phone" className="md-input-label">Telefono</label></div>
                </div>
                <div className="md-input-group"><input id="address" type="text" value={address} onChange={e => setAddress(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="address" className="md-input-label">Indirizzo</label></div>
                 <div className="grid grid-cols-3 gap-4">
                    <div className="md-input-group"><input id="zipCode" type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="zipCode" className="md-input-label">CAP</label></div>
                    <div className="col-span-2 md-input-group"><input id="city" type="text" value={city} onChange={e => setCity(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="city" className="md-input-label">Città</label></div>
                </div>
                 <div className="md-input-group"><input id="province" type="text" value={province} onChange={e => setProvince(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="province" className="md-input-label">Provincia</label></div>
                
                 {clientType === ClientType.Parent && (
                    <div className="pt-4 border-t mt-4" style={{borderColor: 'var(--md-divider)'}}>
                        <h3 className="text-md font-semibold">Figli</h3>
                        {children.map((child) => (
                            <div key={child.id} className="flex items-center justify-between p-2 mt-2 bg-gray-50 rounded-md">
                                <p className="text-sm">{child.name} - {child.age}</p>
                                <button type="button" onClick={() => handleRemoveChild(child.id)} className="md-icon-btn delete" aria-label={`Rimuovi ${child.name}`}><TrashIcon /></button>
                            </div>
                        ))}
                        <div className="flex items-end space-x-2 mt-3">
                            <div className="flex-grow md-input-group"><input id="newChildName" type="text" value={newChildName} onChange={e => setNewChildName(e.target.value)} placeholder=" " className="md-input"/><label htmlFor="newChildName" className="md-input-label">Nome Figlio</label></div>
                            <div className="flex-grow md-input-group"><input id="newChildAge" type="text" value={newChildAge} onChange={e => setNewChildAge(e.target.value)} placeholder=" " className="md-input"/><label htmlFor="newChildAge" className="md-input-label">Età (es. 3 anni)</label></div>
                            <button type="button" onClick={handleAddChild} className="md-btn md-btn-raised md-btn-primary h-10 w-10 !p-0"><PlusIcon/></button>
                        </div>
                    </div>
                )}
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green">Salva</button>
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
  
  const handleBackToList = () => {
    setSelectedClient(null);
    fetchClients();
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
    const result = await importClientsFromExcel(file);
    fetchClients();
    return result;
  };

  if (selectedClient) {
    return <ClientDetail client={selectedClient} onBack={handleBackToList} onEdit={() => handleOpenModal(selectedClient)} />;
  }

  return (
    <div>
        <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Clienti</h1>
              <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Gestisci le anagrafiche di genitori e clienti istituzionali.</p>
            </div>
             <div className="flex items-center space-x-2">
                <button onClick={() => setIsImportModalOpen(true)} className="md-btn md-btn-flat">
                    <UploadIcon />
                    <span className="ml-2">Importa Excel</span>
                </button>
                <button onClick={() => handleOpenModal()} className="md-btn md-btn-raised md-btn-green">
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
                templateHeaders={[
                    'type', 'email', 'firstName', 'lastName', 'taxCode', 
                    'companyName', 'vatNumber', 'phone', 'address', 
                    'zipCode', 'city', 'province'
                ]}
                instructions={[
                    'La prima riga del primo foglio deve contenere le intestazioni delle colonne.',
                    'Il campo "email" è la chiave unica per l\'aggiornamento di record esistenti.',
                    'Il campo "type" deve essere "parent" o "institutional". Compila i campi relativi al tipo scelto.'
                ]}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImport}
            />
        )}


        <div className="mt-8 md-card p-6">
          <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
              <input type="text" placeholder="Cerca cliente..." className="block w-full max-w-sm bg-gray-50 border rounded-md py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-1" style={{borderColor: 'var(--md-divider)'}}/>
          </div>
          <div className="overflow-x-auto">
            {loading ? <div className="flex justify-center items-center py-8"><Spinner /></div> : 
             error ? <p className="text-center text-red-500 py-8">{error}</p> :
            <table className="w-full text-left">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--md-divider)'}}>
                  <th className="p-4 font-medium" style={{ color: 'var(--md-text-secondary)'}}>Nome / Ragione Sociale</th>
                  <th className="p-4 font-medium" style={{ color: 'var(--md-text-secondary)'}}>Tipo</th>
                  <th className="p-4 font-medium" style={{ color: 'var(--md-text-secondary)'}}>Contatti</th>
                  <th className="p-4 font-medium" style={{ color: 'var(--md-text-secondary)'}}>Figli</th>
                  <th className="p-4 font-medium" style={{ color: 'var(--md-text-secondary)'}}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client.id} className="border-b hover:bg-gray-50" style={{ borderColor: 'var(--md-divider)'}}>
                    <td className="p-4">
                      <div className="flex items-center">
                        {client.clientType === ClientType.Parent && <img src={client.avatarUrl} alt={client.firstName} className="w-10 h-10 rounded-full mr-3"/>}
                        <span className="font-medium">{client.clientType === ClientType.Parent ? `${client.firstName} ${client.lastName}` : client.companyName}</span>
                      </div>
                    </td>
                     <td className="p-4">
                        <span className={`md-badge ${client.clientType === ClientType.Parent ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                            {client.clientType === ClientType.Parent ? 'Genitore' : 'Istituzionale'}
                        </span>
                     </td>
                    <td className="p-4 text-sm" style={{ color: 'var(--md-text-secondary)'}}>
                      <div>{client.email}</div>
                      <div>{client.phone}</div>
                    </td>
                    <td className="p-4 text-sm" style={{ color: 'var(--md-text-secondary)'}}>
                        {client.clientType === ClientType.Parent ? client.children.length : 'N/A'}
                    </td>
                    <td className="p-4">
                        <div className="flex items-center space-x-2">
                            <button onClick={() => setSelectedClient(client)} className="md-btn md-btn-flat md-btn-primary text-sm">Dettagli</button>
                            <button onClick={() => handleOpenModal(client)} className="md-icon-btn edit" aria-label="Modifica cliente"><PencilIcon /></button>
                            <button onClick={() => handleDeleteClient(client.id)} className="md-icon-btn delete" aria-label="Elimina cliente"><TrashIcon /></button>
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