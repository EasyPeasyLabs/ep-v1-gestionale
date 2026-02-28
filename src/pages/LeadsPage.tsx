import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { format, isSameDay, isSameMonth, isSameYear, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Users, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  UserPlus,
  MessageCircle,
  Link,
  Send,
  Trash2
} from 'lucide-react';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { deleteEnrollment } from '../../services/enrollmentService';
import { cleanupEnrollmentFinancials } from '../../services/financeService';
import { Enrollment } from '../../types';

interface Lead {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  childName: string;
  childAge: string;
  selectedLocation: string;
  selectedSlot: string;
  notes?: string;
  status: 'pending' | 'contacted' | 'converted' | 'rejected';
  createdAt: string;
  source: string;
}

export const LeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date Filters
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [dateFilterType, setDateFilterType] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');

  const [selectedLeadForLink, setSelectedLeadForLink] = useState<Lead | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  // Confirm Modal State
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDangerous?: boolean;
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDangerous: false,
    confirmText: 'Conferma'
  });

  const openConfirmModal = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    isDangerous = false,
    confirmText = 'Conferma'
  ) => {
    setConfirmModalState({
      isOpen: true,
      title,
      message,
      onConfirm,
      isDangerous,
      confirmText
    });
  };

  const closeConfirmModal = () => {
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
  };

  const generateEnrollmentLink = (leadId: string) => {
    const baseUrl = window.location.origin;
    // Use hash routing to avoid 404 on direct links in SPA
    return `${baseUrl}/#/iscrizione?id=${leadId}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Link copiato negli appunti!");
  };

  const sendLinkWhatsApp = (lead: Lead) => {
    const link = generateEnrollmentLink(lead.id);
    const message = `*Easy Peasy Labs*\n\nCiao ${lead.nome}, siamo felici del tuo interesse!\n\nPer completare l'iscrizione e bloccare il tuo posto, compila questo modulo:\n\n${link}`;
    const cleanPhone = lead.telefono.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const sendLinkEmail = (lead: Lead) => {
    const link = generateEnrollmentLink(lead.id);
    const subject = "Completa la tua iscrizione - EasyPeasy Lab";
    const body = `Easy Peasy Labs\n\nCiao ${lead.nome}, siamo felici del tuo interesse!\n\nPer completare l'iscrizione e bloccare il tuo posto, compila questo modulo:\n\n${link}`;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${lead.email}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    const q = query(
      collection(db, 'incoming_leads'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Lead[];
      setLeads(leadsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (leadId: string, newStatus: Lead['status']) => {
    try {
      await updateDoc(doc(db, 'incoming_leads', leadId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Errore nell'aggiornamento dello stato");
    }
  };

  const handleConvertToStudent = async (lead: Lead) => {
    openConfirmModal(
      "Creazione Studente",
      `Vuoi creare un nuovo studente per ${lead.childName}?`,
      async () => {
        try {
          // 1. Crea Studente
          const studentData = {
            firstName: lead.childName,
            lastName: lead.cognome, // Assumiamo cognome genitore = cognome figlio per ora
            dateOfBirth: '', // Da chiedere
            fiscalCode: '',
            gender: 'M', // Default, da cambiare
            address: '',
            city: '',
            parentFirstName: lead.nome,
            parentLastName: lead.cognome,
            parentEmail: lead.email,
            parentPhone: lead.telefono,
            preferredLocation: lead.selectedLocation || '',
            preferredSlot: lead.selectedSlot || '',
            status: 'Active',
            createdAt: serverTimestamp(),
            source: 'web_lead'
          };

          const studentRef = await addDoc(collection(db, 'students'), studentData);

          // 2. Aggiorna Lead come convertito
          await updateDoc(doc(db, 'incoming_leads', lead.id), {
            status: 'converted',
            convertedStudentId: studentRef.id,
            convertedAt: new Date().toISOString()
          });

          alert(`Studente creato con successo! ID: ${studentRef.id}`);
        } catch (error) {
          console.error("Error converting lead:", error);
          alert("Errore nella conversione del lead");
        }
      }
    );
  };

  const handleDeleteEnrollmentFromLead = (lead: Lead) => {
    openConfirmModal(
      "Eliminazione Iscrizione",
      `ATTENZIONE: Stai per eliminare l'iscrizione collegata a ${lead.childName || 'questo studente'}.\n\nQuesta azione eliminerà:\n- L'iscrizione dall'Archivio\n- I dati finanziari collegati\n- Riporterà questa richiesta allo stato 'Nuovo'\n\nSei sicuro di voler procedere?`,
      async () => {
        setLoading(true);
        try {
          let targetEnrollment: Enrollment | null = null;

          // Only attempt lookup if email is present
          if (lead.email) {
            try {
              // 1. Find Client by Email
              const clientsRef = collection(db, 'clients');
              const qClients = query(clientsRef, where('email', '==', lead.email));
              const clientSnap = await getDocs(qClients);

              if (!clientSnap.empty) {
                const clientDoc = clientSnap.docs[0];
                const clientId = clientDoc.id;

                // 2. Find Enrollment by ClientID and ChildName
                const enrollmentsRef = collection(db, 'enrollments');
                const qEnr = query(enrollmentsRef, where('clientId', '==', clientId));
                const enrSnap = await getDocs(qEnr);
                
                // Case-insensitive match for child name
                for (const docSnap of enrSnap.docs) {
                  const data = docSnap.data() as Enrollment;
                  if (data.childName && lead.childName && 
                      data.childName.trim().toLowerCase() === lead.childName.trim().toLowerCase()) {
                    targetEnrollment = { ...data, id: docSnap.id };
                    break;
                  }
                }
              }
            } catch (lookupError) {
              console.warn("Error looking up enrollment (proceeding to force revert check):", lookupError);
              // Swallow error and proceed with targetEnrollment = null
            }
          }

          if (!targetEnrollment) {
            // Enrollment or Client not found - Prompt for Force Revert
            // We need to close loading first to show another modal or confirm
            setLoading(false);
            
            // Use a slight timeout to ensure UI updates
            setTimeout(() => {
                openConfirmModal(
                    "Iscrizione Non Trovata",
                    "Iscrizione non trovata (probabilmente già eliminata dall'Archivio o Cliente mancante). Vuoi forzare il ripristino della richiesta allo stato 'Nuovo'?",
                    async () => {
                        try {
                            await updateDoc(doc(db, 'incoming_leads', lead.id), {
                                status: 'pending',
                                convertedStudentId: null,
                                convertedAt: null
                            });
                            alert("Richiesta ripristinata con successo (Forzatura).");
                        } catch (err) {
                            console.error(err);
                            alert("Errore nel ripristino forzato.");
                        }
                    },
                    true, // isDangerous
                    "Forza Ripristino"
                );
            }, 100);
            return;
          }

          // 3. Delete Enrollment & Financials (Normal Flow)
          await cleanupEnrollmentFinancials(targetEnrollment);
          await deleteEnrollment(targetEnrollment.id);

          // 4. Update Lead Status
          await updateDoc(doc(db, 'incoming_leads', lead.id), {
            status: 'pending',
            convertedStudentId: null,
            convertedAt: null
          });

          alert("Iscrizione eliminata e richiesta ripristinata con successo.");
        } catch (error) {
          console.error("Error deleting enrollment from lead:", error);
          alert("Errore durante l'eliminazione dell'iscrizione.");
        } finally {
          setLoading(false);
        }
      },
      true // isDangerous
    );
  };

  const handleDeleteLead = (lead: Lead) => {
    openConfirmModal(
      "Eliminazione Definitiva",
      `ATTENZIONE: Stai per eliminare DEFINITIVAMENTE la richiesta di ${lead.nome} ${lead.cognome}.\n\nQuesta azione è irreversibile.\nSei sicuro?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'incoming_leads', lead.id));
          alert("Richiesta eliminata definitivamente.");
        } catch (error) {
          console.error("Error deleting lead:", error);
          alert("Errore durante l'eliminazione della richiesta.");
        }
      },
      true
    );
  };

  const filteredLeads = leads.filter(lead => {
    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
    const matchesSearch = 
      lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.cognome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.childName.toLowerCase().includes(searchTerm.toLowerCase());

    // Date Filtering
    let matchesDate = true;
    if (lead.createdAt) {
      const leadDate = parseISO(lead.createdAt);
      const now = new Date();

      switch (dateFilterType) {
        case 'today':
          matchesDate = isSameDay(leadDate, now);
          break;
        case 'week':
          matchesDate = isWithinInterval(leadDate, {
            start: startOfWeek(now, { weekStartsOn: 1 }),
            end: endOfWeek(now, { weekStartsOn: 1 })
          });
          break;
        case 'month':
          matchesDate = isSameMonth(leadDate, new Date(selectedYear, selectedMonth));
          break;
        case 'year':
          matchesDate = isSameYear(leadDate, new Date(selectedYear, 0, 1));
          break;
        default:
          matchesDate = true;
      }
    }

    return matchesStatus && matchesSearch && matchesDate;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'contacted': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'converted': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Nuovo';
      case 'contacted': return 'In Lavorazione';
      case 'converted': return 'Iscritto';
      case 'rejected': return 'Scartato';
      default: return status;
    }
  };

  const openGmail = (email: string) => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}`;
    window.open(url, '_blank');
  };

  const openWhatsApp = (phone: string) => {
    // Remove non-numeric chars
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}`;
    window.open(url, '_blank');
  };

  // Helper per pulire le note tecniche
  const shouldShowNotes = (notes?: string) => {
    if (!notes) return false;
    // Nascondi note tecniche generate automaticamente
    if (notes.includes("Selected Slot:") || notes.includes("Lead from Public Landing Page")) return false;
    return true;
  };

  return (
    <div className="space-y-6 p-4 md:p-6 pb-24 md:pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading">Richieste Web</h1>
          <p className="text-gray-500 mt-1">Gestisci le richieste di iscrizione dal sito pubblico</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
        
        {/* Search */}
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Cerca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-600 focus:border-transparent shadow-sm"
          />
        </div>

        {/* Date & Status Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          
          <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-200 overflow-x-auto max-w-full scrollbar-hide">
            <button 
              onClick={() => setDateFilterType('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${dateFilterType === 'all' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Tutti
            </button>
            <button 
              onClick={() => setDateFilterType('today')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${dateFilterType === 'today' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Oggi
            </button>
            <button 
              onClick={() => setDateFilterType('week')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${dateFilterType === 'week' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Settimana
            </button>
             <button 
              onClick={() => setDateFilterType('month')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${dateFilterType === 'month' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Mese
            </button>
          </div>

          {dateFilterType === 'month' && (
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="text-sm border-gray-300 rounded-lg focus:ring-cyan-600 focus:border-cyan-600"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>{format(new Date(2000, i, 1), 'MMMM', { locale: it })}</option>
              ))}
            </select>
          )}

          <div className="h-8 w-px bg-gray-300 mx-2 hidden md:block"></div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-gray-400 hidden md:block" />
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full md:w-auto text-sm border-gray-300 rounded-lg focus:ring-cyan-600 focus:border-cyan-600 bg-white"
            >
              <option value="all">Tutti gli stati</option>
              <option value="pending">Nuovi</option>
              <option value="contacted">In Lavorazione</option>
              <option value="converted">Iscritti</option>
              <option value="rejected">Scartati</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Caricamento richieste...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nessuna richiesta trovata con i filtri attuali</p>
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <div key={lead.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5 hover:shadow-md transition-shadow duration-200">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                
                {/* Left: Info */}
                <div className="flex-1 space-y-4">
                  
                  {/* Header Card */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(lead.status)}`}>
                          {getStatusLabel(lead.status)}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {lead.createdAt ? format(new Date(lead.createdAt), 'd MMM yyyy, HH:mm', { locale: it }) : 'Data N/D'}
                        </span>
                      </div>
                      
                      {/* Nome Genitore (Principale) */}
                      <h3 className="text-xl font-bold text-gray-900 font-heading leading-tight">
                        {lead.nome} {lead.cognome}
                      </h3>
                      
                      {/* Nome Figlio (Secondario) */}
                      <p className="text-sm text-gray-500 mt-1">
                        per <span className="font-medium text-gray-700">{lead.childName}</span> ({lead.childAge} anni)
                      </p>
                    </div>
                  </div>

                  {/* Dettagli Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-sm border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-medium">{lead.selectedLocation || 'Sede non specificata'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span>{lead.selectedSlot || 'Orario non specificato'}</span>
                    </div>
                    
                    {/* Email Actionable */}
                    <div className="flex items-center gap-2 text-gray-600 group cursor-pointer break-all" onClick={() => openGmail(lead.email)}>
                      <Mail className="w-4 h-4 text-gray-400 group-hover:text-red-600 transition-colors flex-shrink-0" />
                      <span className="group-hover:text-red-600 group-hover:underline transition-colors">{lead.email}</span>
                    </div>

                    {/* Phone Actionable (WhatsApp) */}
                    <div className="flex items-center gap-2 text-gray-600 group cursor-pointer" onClick={() => openWhatsApp(lead.telefono)}>
                      <Phone className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors flex-shrink-0" />
                      <span className="group-hover:text-green-600 group-hover:underline transition-colors">{lead.telefono}</span>
                      <MessageCircle className="w-3 h-3 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                    </div>
                  </div>
                  
                  {/* Note (Solo se rilevanti) */}
                  {shouldShowNotes(lead.notes) && (
                    <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800 border border-yellow-100 mt-2">
                      <span className="font-semibold">Note:</span> {lead.notes}
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="grid grid-cols-1 gap-2 mt-4 md:mt-0 md:flex md:flex-col md:justify-end md:border-l md:pl-4 md:border-gray-100 min-w-[160px]">
                  {(lead.status === 'pending' || lead.status === 'contacted') && (
                    <button 
                      onClick={() => { setSelectedLeadForLink(lead); setIsLinkModalOpen(true); }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-bold shadow-sm w-full"
                    >
                      <Send className="w-4 h-4" />
                      Invia Modulo
                    </button>
                  )}
                  {lead.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleConvertToStudent(lead)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium shadow-sm w-full"
                      >
                        <UserPlus className="w-4 h-4" />
                        Iscrivi
                      </button>
                      <button 
                        onClick={() => handleStatusChange(lead.id, 'contacted')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium w-full"
                      >
                        <CheckCircle className="w-4 h-4 text-blue-500" />
                        Contattato
                      </button>
                      <button 
                        onClick={() => handleStatusChange(lead.id, 'rejected')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors text-sm font-medium w-full"
                      >
                        <XCircle className="w-4 h-4" />
                        Scarta
                      </button>
                    </>
                  )}
                  
                  {lead.status === 'contacted' && (
                    <button 
                      onClick={() => handleConvertToStudent(lead)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium shadow-sm w-full"
                    >
                      <UserPlus className="w-4 h-4" />
                      Converti
                    </button>
                  )}

                  {lead.status === 'converted' && (
                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-100 cursor-default w-full">
                        <CheckCircle className="w-4 h-4" />
                        Già Iscritto
                      </div>
                      <button 
                        onClick={() => handleDeleteEnrollmentFromLead(lead)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-xs font-medium w-full"
                        title="Elimina Iscrizione e Ripristina Lead"
                      >
                        <Trash2 className="w-3 h-3" />
                        Elimina Iscrizione
                      </button>
                    </div>
                  )}

                  {lead.status === 'rejected' && (
                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-100 cursor-default w-full">
                        <XCircle className="w-4 h-4" />
                        Scartato
                      </div>
                      <button 
                        onClick={() => handleDeleteLead(lead)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-xs font-medium w-full"
                        title="Elimina Definitivamente"
                      >
                        <Trash2 className="w-3 h-3" />
                        Elimina Definitivamente
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal for sending link */}
      {isLinkModalOpen && selectedLeadForLink && (
        <Modal onClose={() => setIsLinkModalOpen(false)} size="md">
          <div className="p-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Link className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Invia Modulo Iscrizione</h3>
              <p className="text-sm text-gray-500 mt-1">
                Invia il link personalizzato a {selectedLeadForLink.nome} per completare l'iscrizione.
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Link Diretto</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={generateEnrollmentLink(selectedLeadForLink.id)} 
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
                <button 
                  onClick={() => copyToClipboard(generateEnrollmentLink(selectedLeadForLink.id))}
                  className="bg-gray-200 hover:bg-gray-300 p-2 rounded-lg transition-colors"
                  title="Copia link"
                >
                  <Link className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => sendLinkWhatsApp(selectedLeadForLink)}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-green-50 border border-green-100 rounded-2xl hover:bg-green-100 transition-colors group"
              >
                <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-green-700">WhatsApp</span>
              </button>

              <button 
                onClick={() => sendLinkEmail(selectedLeadForLink)}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl hover:bg-red-100 transition-colors group"
              >
                <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Mail className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-red-700">Email</span>
              </button>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setIsLinkModalOpen(false)}
                className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModalState.onConfirm}
        title={confirmModalState.title}
        message={confirmModalState.message}
        isDangerous={confirmModalState.isDangerous}
        confirmText={confirmModalState.confirmText}
      />
    </div>
  );
};
