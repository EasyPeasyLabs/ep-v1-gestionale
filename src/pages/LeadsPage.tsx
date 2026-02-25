import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
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
  MessageCircle
} from 'lucide-react';

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
    if (!confirm(`Vuoi creare un nuovo studente per ${lead.childName}?`)) return;

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
    <div className="space-y-6 p-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading">Richieste Web</h1>
          <p className="text-gray-500 mt-1">Gestisci le richieste di iscrizione dal sito pubblico</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between gap-4">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Cerca per nome, email o studente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-transparent shadow-sm"
          />
        </div>

        {/* Date & Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          
          <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-200">
            <button 
              onClick={() => setDateFilterType('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateFilterType === 'all' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Tutti
            </button>
            <button 
              onClick={() => setDateFilterType('today')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateFilterType === 'today' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Oggi
            </button>
            <button 
              onClick={() => setDateFilterType('week')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateFilterType === 'week' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Settimana
            </button>
             <button 
              onClick={() => setDateFilterType('month')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateFilterType === 'month' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Mese
            </button>
          </div>

          {dateFilterType === 'month' && (
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="text-sm border-gray-300 rounded-lg focus:ring-brand-blue focus:border-brand-blue"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>{format(new Date(2000, i, 1), 'MMMM', { locale: it })}</option>
              ))}
            </select>
          )}

          <div className="h-8 w-px bg-gray-300 mx-2 hidden md:block"></div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border-gray-300 rounded-lg focus:ring-brand-blue focus:border-brand-blue bg-white"
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
            <div key={lead.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                
                {/* Left: Info */}
                <div className="flex-1 space-y-4">
                  
                  {/* Header Card */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
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
                    <div className="flex items-center gap-2 text-gray-600 group cursor-pointer" onClick={() => openGmail(lead.email)}>
                      <Mail className="w-4 h-4 text-gray-400 group-hover:text-brand-red transition-colors" />
                      <span className="group-hover:text-brand-red group-hover:underline transition-colors">{lead.email}</span>
                    </div>

                    {/* Phone Actionable (WhatsApp) */}
                    <div className="flex items-center gap-2 text-gray-600 group cursor-pointer" onClick={() => openWhatsApp(lead.telefono)}>
                      <Phone className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
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
                <div className="flex flex-row md:flex-col gap-2 justify-end md:border-l md:pl-4 md:border-gray-100 min-w-[160px]">
                  {lead.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleConvertToStudent(lead)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm w-full"
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
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm w-full"
                    >
                      <UserPlus className="w-4 h-4" />
                      Converti
                    </button>
                  )}

                  {lead.status === 'converted' && (
                    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-100 cursor-default w-full">
                      <CheckCircle className="w-4 h-4" />
                      Già Iscritto
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
