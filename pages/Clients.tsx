
import React, { useState, useEffect, useCallback } from 'react';
import { Parent, ParentInput, Child, Subscription, SubscriptionStatus } from '../types';
import { getParents, addParent, updateParent, deleteParent } from '../services/parentService';
import PlusIcon from '../components/icons/PlusIcon';
import SearchIcon from '../components/icons/SearchIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';

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

const ClientDetail: React.FC<{ parent: Parent; onBack: () => void }> = ({ parent, onBack }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-md animate-fade-in">
            <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm mb-4">&larr; Torna alla lista</button>
            <div className="flex items-start">
                <img src={parent.avatarUrl} alt={parent.name} className="w-24 h-24 rounded-full mr-6"/>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{parent.name}</h2>
                    <p className="text-slate-500">{parent.email}</p>
                    <p className="text-slate-500">{parent.phone}</p>
                </div>
            </div>
            
            <div className="mt-6">
                <h3 className="text-lg font-semibold text-slate-700">Figli e Iscrizioni</h3>
                {parent.children.length > 0 ? parent.children.map(child => {
                    const subscription = parent.subscriptions.find(s => s.id === child.subscriptionId);
                    return (
                        <div key={child.id} className="mt-4 p-4 border border-slate-200 rounded-lg">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">{child.name}, {child.age} anni</p>
                                    <p className="text-sm text-slate-500">{subscription?.packageName}</p>
                                </div>
                                {subscription && (
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(subscription.status)}`}>
                                        {subscription.status}
                                    </span>
                                )}
                            </div>
                            {subscription && (
                                <div className="mt-3 text-sm">
                                    <p>Lezioni rimanenti: <span className="font-medium">{subscription.lessonsRemaining}/{subscription.lessonsTotal}</span></p>
                                    <div className="w-full bg-slate-200 rounded-full h-2.5 mt-1">
                                        <div className="bg-indigo-600 h-2.5 rounded-full" style={{width: `${(subscription.lessonsRemaining/subscription.lessonsTotal)*100}%`}}></div>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Scadenza: {new Date(subscription.endDate).toLocaleDateString('it-IT')}</p>
                                </div>
                            )}
                        </div>
                    );
                }) : (
                  <p className="text-slate-500 text-sm mt-4">Nessun figlio iscritto per questo genitore.</p>
                )}
            </div>
        </div>
    );
};

const ParentForm: React.FC<{ parent?: Parent | null; onSave: (parent: ParentInput | Parent) => void; onCancel: () => void; }> = ({ parent, onSave, onCancel }) => {
    const [name, setName] = useState(parent?.name || '');
    const [email, setEmail] = useState(parent?.email || '');
    const [phone, setPhone] = useState(parent?.phone || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parentData = {
            name,
            email,
            phone,
            avatarUrl: parent?.avatarUrl || `https://i.pravatar.cc/150?u=${email}`,
            children: parent?.children || [],
            subscriptions: parent?.subscriptions || [],
        };
        if (parent?.id) {
            onSave({ ...parentData, id: parent.id });
        } else {
            onSave(parentData);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-bold mb-4">{parent ? 'Modifica Cliente' : 'Nuovo Cliente'}</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Nome Completo</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Telefono</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                </div>
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
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);

  const fetchParents = useCallback(async () => {
    try {
      setLoading(true);
      const parentsData = await getParents();
      setParents(parentsData);
      setError(null);
    } catch (err) {
      setError("Impossibile caricare i clienti.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  const handleOpenModal = (parent: Parent | null = null) => {
    setEditingParent(parent);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingParent(null);
    setIsModalOpen(false);
  };

  const handleSaveParent = async (parentData: ParentInput | Parent) => {
    try {
      if ('id' in parentData) {
        await updateParent(parentData.id, parentData);
      } else {
        await addParent(parentData);
      }
      handleCloseModal();
      fetchParents();
    } catch (err) {
      console.error("Errore nel salvataggio del cliente:", err);
      setError("Salvataggio fallito.");
    }
  };

  const handleDeleteParent = async (id: string) => {
    if (window.confirm("Sei sicuro di voler eliminare questo cliente?")) {
      try {
        await deleteParent(id);
        fetchParents();
      } catch (err) {
        console.error("Errore nell'eliminazione del cliente:", err);
        setError("Eliminazione fallita.");
      }
    }
  };


  if (selectedParent) {
    return <ClientDetail parent={selectedParent} onBack={() => setSelectedParent(null)} />;
  }

  return (
    <div>
        <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Clienti</h1>
              <p className="mt-1 text-slate-500">Gestisci le anagrafiche di genitori e figli.</p>
            </div>
            <button onClick={() => handleOpenModal()} className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors">
                <PlusIcon />
                <span className="ml-2">Aggiungi Cliente</span>
            </button>
        </div>

        {isModalOpen && (
            <Modal onClose={handleCloseModal}>
                <ParentForm parent={editingParent} onSave={handleSaveParent} onCancel={handleCloseModal} />
            </Modal>
        )}

        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon />
              </div>
              <input type="text" placeholder="Cerca cliente per nome o email..." className="block w-full max-w-sm bg-slate-50 border border-slate-200 rounded-md py-2 pl-10 pr-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
          </div>
          <div className="overflow-x-auto">
            {loading ? <div className="flex justify-center items-center py-8"><Spinner /></div> : 
             error ? <p className="text-center text-red-500 py-8">{error}</p> :
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500">
                  <th className="p-4">Nome</th>
                  <th className="p-4">Contatti</th>
                  <th className="p-4">Figli Iscritti</th>
                  <th className="p-4">Stato Iscrizioni</th>
                  <th className="p-4">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {parents.map(parent => (
                  <tr key={parent.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center">
                        <img src={parent.avatarUrl} alt={parent.name} className="w-10 h-10 rounded-full mr-3"/>
                        <span className="font-medium text-slate-800">{parent.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      <div>{parent.email}</div>
                      <div>{parent.phone}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{parent.children.length}</td>
                    <td className="p-4">
                        <div className="flex items-center space-x-2">
                           {parent.subscriptions.map(sub => (
                             <span key={sub.id} className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(sub.status)}`}>
                               {sub.packageName.substring(0,1)}
                             </span>
                           ))}
                        </div>
                    </td>
                    <td className="p-4">
                        <div className="flex items-center space-x-4">
                            <button onClick={() => setSelectedParent(parent)} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">
                                Dettagli
                            </button>
                            <button onClick={() => handleOpenModal(parent)} className="text-slate-500 hover:text-slate-700">
                                <PencilIcon />
                            </button>
                            <button onClick={() => handleDeleteParent(parent.id)} className="text-red-500 hover:text-red-700">
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
