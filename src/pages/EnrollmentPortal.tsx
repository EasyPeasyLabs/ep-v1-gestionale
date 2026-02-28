
import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { 
  CheckCircle, 
  CreditCard, 
  MapPin, 
  Clock, 
  User, 
  Baby, 
  ChevronRight, 
  ChevronLeft,
  AlertCircle,
  Info,
  ExternalLink,
  Copy
} from 'lucide-react';
import { 
  SubscriptionType, 
  CompanyInfo, 
  PaymentMethod,
  DocumentStatus,
  TransactionType,
  TransactionCategory,
  TransactionStatus,
  ClientType,
  EnrollmentStatus,
  SlotType
} from '../../types';
import { getSubscriptionTypes, getCompanyInfo } from '../../services/settingsService';
import { getSuppliers } from '../../services/supplierService';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import { isItalianHoliday } from '../../utils/dateUtils';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const normalizeString = (str?: string) => {
  if (!str) return '';
  return str.toLowerCase().replace(/\s+/g, '').trim();
};

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
  status: string;
}

const EnrollmentPortal: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [lead, setLead] = useState<Lead | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
  const [locations, setLocations] = useState<{id: string, name: string, address: string, city: string, color: string, slots: {time: string, type: SlotType}[]}[]>([]);
  
  // Form State
  const [formData, setFormData] = useState({
    parentFirstName: '',
    parentLastName: '',
    parentEmail: '',
    parentPhone: '',
    parentFiscalCode: '',
    parentAddress: '',
    parentCity: '',
    parentZip: '',
    parentProvince: '',
    childName: '',
    childAge: '',
    childDateOfBirth: '',
    selectedLocationId: '',
    selectedLocationName: '',
    selectedSlot: '',
    selectedSubscriptionId: '',
    paymentMethod: PaymentMethod.BankTransfer as PaymentMethod
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMode, setSuccessMode] = useState<'booking' | 'paid'>('booking');
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const [showAllOptions, setShowAllOptions] = useState(false);

  useEffect(() => {
    // Extract ID from either search params or hash params (for SPA compatibility)
    const searchParams = new URLSearchParams(window.location.search);
    let leadId = searchParams.get('id');
    
    if (!leadId && window.location.hash.includes('?')) {
      const hashPart = window.location.hash.split('?')[1];
      const hashParams = new URLSearchParams(hashPart);
      leadId = hashParams.get('id');
    }

    if (!leadId) {
      setError("Link non valido. Contatta la segreteria.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [leadSnap, company, subs, suppliers] = await Promise.all([
          getDoc(doc(db, 'incoming_leads', leadId)),
          getCompanyInfo(),
          getSubscriptionTypes(),
          getSuppliers()
        ]);

        if (!leadSnap.exists()) {
          setError("Richiesta non trovata. Il link potrebbe essere scaduto.");
          return;
        }

        const leadData = { id: leadSnap.id, ...leadSnap.data() } as Lead;
        setLead(leadData);
        setCompanyInfo(company);
        setSubscriptionTypes(subs);

        // Extract locations from suppliers
        const daysMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
        const locs: {id: string, name: string, address: string, city: string, color: string, slots: {time: string, type: SlotType}[]}[] = [];
        suppliers.forEach(s => {
          s.locations.forEach(l => {
            // Filter out closed or hidden locations
            if (!l.closedAt && l.isPubliclyVisible !== false) {
              locs.push({
                id: l.id,
                name: l.name,
                address: l.address || '',
                city: l.city || '',
                color: l.color,
                // Filter out hidden slots
                slots: (l.availability || [])
                  .filter(a => a.isPubliclyVisible !== false)
                  .map(a => ({
                    time: `${daysMap[a.dayOfWeek || 0]}, ${a.startTime} - ${a.endTime}`,
                    type: a.type || 'LAB'
                  }))
              });
            }
          });
        });
        setLocations(locs);
        document.title = "EasyPeasy Labs";

        // Pre-fill form
        setFormData(prev => ({
          ...prev,
          parentFirstName: leadData.nome || '',
          parentLastName: leadData.cognome || '',
          parentEmail: leadData.email || '',
          parentPhone: leadData.telefono || '',
          childName: leadData.childName || '',
          childAge: leadData.childAge || '',
          selectedLocationName: leadData.selectedLocation || '',
          selectedSlot: leadData.selectedSlot || ''
        }));

        // Try to match location name to ID
        const leadLocNormalized = normalizeString(leadData.selectedLocation);
        const matchedLoc = locs.find(l => {
          const locNameNorm = normalizeString(l.name);
          const locIdNorm = normalizeString(l.id);
          return locNameNorm === leadLocNormalized || 
                 locIdNorm === leadLocNormalized ||
                 leadLocNormalized.includes(locNameNorm) ||
                 locNameNorm.includes(leadLocNormalized);
        });
        
        if (matchedLoc) {
          setFormData(prev => ({ ...prev, selectedLocationId: matchedLoc.id, selectedLocationName: matchedLoc.name }));
          
          // Try to match slot time
          // leadData.selectedSlot might be "Lunedì 16:30 - 18:00" or just "16:30 - 18:00"
          const slotToMatch = normalizeString(leadData.selectedSlot);
          const matchedSlot = matchedLoc.slots.find(s => {
            const sTime = normalizeString(s.time);
            return slotToMatch.includes(sTime) || sTime.includes(slotToMatch);
          });
          
          if (matchedSlot) {
            setFormData(prev => ({ ...prev, selectedSlot: matchedSlot.time }));
          }
        }

      } catch (err) {
        console.error(err);
        setError("Errore nel caricamento dei dati.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleBooking = async () => {
    if (!lead) return;
    setIsProcessing(true);
    try {
      // 1. Create Client
      const clientData = {
        clientType: ClientType.Parent,
        firstName: formData.parentFirstName,
        lastName: formData.parentLastName,
        email: formData.parentEmail,
        phone: formData.parentPhone,
        taxCode: formData.parentFiscalCode,
        address: `${formData.parentAddress}, ${formData.parentZip} ${formData.parentCity} (${formData.parentProvince})`,
        city: formData.parentCity,
        children: [{
          id: generateUUID(),
          name: formData.childName,
          age: formData.childAge,
          dateOfBirth: formData.childDateOfBirth,
          notes: '',
          notesHistory: [],
          tags: [],
          rating: { learning: 0, behavior: 0, attendance: 0, hygiene: 0 }
        }],
        status: 'Active',
        notesHistory: [],
        tags: [],
        rating: { availability: 0, complaints: 0, churnRate: 0, distance: 0 },
        createdAt: new Date().toISOString()
      };
      const clientRef = await addDoc(collection(db, 'clients'), clientData);

      // 2. Create Enrollment (Pending)
      const sub = subscriptionTypes.find(s => s.id === formData.selectedSubscriptionId);
      
      const calculateEnrollmentDates = (selectedSlot: string, lessonsTotal: number) => {
        const parts = selectedSlot.split(',');
        const dayName = parts[0].trim();
        const timePart = parts.length > 1 ? parts[1].trim() : '16:30 - 18:00';
        const timeParts = timePart.split('-');
        const startTime = timeParts[0].trim();
        const endTime = timeParts.length > 1 ? timeParts[1].trim() : '18:00';

        const daysMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
        const targetDay = daysMap.findIndex(d => d.toLowerCase() === dayName.toLowerCase());
        
        const now = new Date();
        let startDate = new Date(now);
        
        if (targetDay !== -1) {
          const currentDay = startDate.getDay();
          let distance = targetDay - currentDay;
          if (distance < 0) {
            distance += 7;
          }
          startDate.setDate(startDate.getDate() + distance);
        }
        
        // Se la startDate calcolata è un giorno festivo, cerchiamo il prossimo giorno utile
        while (isItalianHoliday(startDate)) {
            startDate.setDate(startDate.getDate() + 7);
        }

        startDate.setHours(0, 0, 0, 0);
        
        let endDate = new Date(startDate);
        let validSlots = 1; // La startDate conta come primo slot
        let loops = 0;
        
        // Calcoliamo la endDate aggiungendo settimane e saltando le festività
        while (validSlots < (lessonsTotal || 1) && loops < 100) {
            endDate.setDate(endDate.getDate() + 7);
            if (!isItalianHoliday(endDate)) {
                validSlots++;
            }
            loops++;
        }
        
        endDate.setHours(23, 59, 59, 999);
        
        return {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          firstLessonDate: startDate.toISOString(),
          startTime,
          endTime
        };
      };

      const dates = calculateEnrollmentDates(formData.selectedSlot, sub?.lessons || 0);

      const enrollmentData = {
        clientId: clientRef.id,
        clientName: `${formData.parentFirstName} ${formData.parentLastName}`,
        childId: clientData.children[0].id,
        childName: formData.childName,
        subscriptionTypeId: formData.selectedSubscriptionId,
        subscriptionName: sub?.name || 'Abbonamento',
        locationId: formData.selectedLocationId || 'unassigned',
        locationName: formData.selectedLocationName || 'Sede Preferita',
        price: sub?.price || 0,
        lessonsTotal: sub?.lessons || 0,
        lessonsRemaining: sub?.lessons || 0,
        labCount: sub?.labCount || 0,
        sgCount: sub?.sgCount || 0,
        evtCount: sub?.evtCount || 0,
        labRemaining: sub?.labCount || 0,
        sgRemaining: sub?.sgCount || 0,
        evtRemaining: sub?.evtCount || 0,
        status: EnrollmentStatus.Pending,
        startDate: dates.startDate,
        endDate: dates.endDate,
        appointments: [{
          lessonId: generateUUID(),
          date: dates.firstLessonDate,
          startTime: dates.startTime,
          endTime: dates.endTime,
          locationId: formData.selectedLocationId || 'unassigned',
          locationName: formData.selectedLocationName || 'Sede Preferita',
          locationColor: '#6366f1',
          childName: formData.childName,
          status: 'Scheduled'
        }],
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'enrollments'), enrollmentData);

      // 3. Update Lead
      await updateDoc(doc(db, 'incoming_leads', lead.id), {
        status: 'converted',
        convertedAt: new Date().toISOString()
      });

      setSuccessMode('booking');
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Errore durante la prenotazione.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (!lead) return;
    setIsProcessing(true);
    try {
      // 1. Create Client
      const clientData = {
        clientType: ClientType.Parent,
        firstName: formData.parentFirstName,
        lastName: formData.parentLastName,
        email: formData.parentEmail,
        phone: formData.parentPhone,
        taxCode: formData.parentFiscalCode,
        address: `${formData.parentAddress}, ${formData.parentZip} ${formData.parentCity} (${formData.parentProvince})`,
        city: formData.parentCity,
        children: [{
          id: generateUUID(),
          name: formData.childName,
          age: formData.childAge,
          dateOfBirth: formData.childDateOfBirth,
          notes: '',
          notesHistory: [],
          tags: [],
          rating: { learning: 0, behavior: 0, attendance: 0, hygiene: 0 }
        }],
        status: 'Active',
        notesHistory: [],
        tags: [],
        rating: { availability: 0, complaints: 0, churnRate: 0, distance: 0 },
        createdAt: new Date().toISOString()
      };
      const clientRef = await addDoc(collection(db, 'clients'), clientData);

      // 2. Create Enrollment (Active)
      const sub = subscriptionTypes.find(s => s.id === formData.selectedSubscriptionId);
      
      const calculateEnrollmentDates = (selectedSlot: string, lessonsTotal: number) => {
        const parts = selectedSlot.split(',');
        const dayName = parts[0].trim();
        const timePart = parts.length > 1 ? parts[1].trim() : '16:30 - 18:00';
        const timeParts = timePart.split('-');
        const startTime = timeParts[0].trim();
        const endTime = timeParts.length > 1 ? timeParts[1].trim() : '18:00';

        const daysMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
        const targetDay = daysMap.findIndex(d => d.toLowerCase() === dayName.toLowerCase());
        
        const now = new Date();
        let startDate = new Date(now);
        
        if (targetDay !== -1) {
          const currentDay = startDate.getDay();
          let distance = targetDay - currentDay;
          if (distance < 0) {
            distance += 7;
          }
          startDate.setDate(startDate.getDate() + distance);
        }
        
        // Se la startDate calcolata è un giorno festivo, cerchiamo il prossimo giorno utile
        while (isItalianHoliday(startDate)) {
            startDate.setDate(startDate.getDate() + 7);
        }

        startDate.setHours(0, 0, 0, 0);
        
        let endDate = new Date(startDate);
        let validSlots = 1; // La startDate conta come primo slot
        let loops = 0;
        
        // Calcoliamo la endDate aggiungendo settimane e saltando le festività
        while (validSlots < (lessonsTotal || 1) && loops < 100) {
            endDate.setDate(endDate.getDate() + 7);
            if (!isItalianHoliday(endDate)) {
                validSlots++;
            }
            loops++;
        }
        
        endDate.setHours(23, 59, 59, 999);
        
        return {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          firstLessonDate: startDate.toISOString(),
          startTime,
          endTime
        };
      };

      const dates = calculateEnrollmentDates(formData.selectedSlot, sub?.lessons || 0);

      const enrollmentData = {
        clientId: clientRef.id,
        clientName: `${formData.parentFirstName} ${formData.parentLastName}`,
        childId: clientData.children[0].id,
        childName: formData.childName,
        subscriptionTypeId: formData.selectedSubscriptionId,
        subscriptionName: sub?.name || 'Abbonamento',
        locationId: formData.selectedLocationId || 'unassigned',
        locationName: formData.selectedLocationName || 'Sede Preferita',
        price: sub?.price || 0,
        lessonsTotal: sub?.lessons || 0,
        lessonsRemaining: sub?.lessons || 0,
        labCount: sub?.labCount || 0,
        sgCount: sub?.sgCount || 0,
        evtCount: sub?.evtCount || 0,
        labRemaining: sub?.labCount || 0,
        sgRemaining: sub?.sgCount || 0,
        evtRemaining: sub?.evtCount || 0,
        status: EnrollmentStatus.Active,
        startDate: dates.startDate,
        endDate: dates.endDate,
        appointments: [{
          lessonId: generateUUID(),
          date: dates.firstLessonDate,
          startTime: dates.startTime,
          endTime: dates.endTime,
          locationId: formData.selectedLocationId || 'unassigned',
          locationName: formData.selectedLocationName || 'Sede Preferita',
          locationColor: '#6366f1',
          childName: formData.childName,
          status: 'Scheduled'
        }],
        createdAt: new Date().toISOString()
      };
      const enrRef = await addDoc(collection(db, 'enrollments'), enrollmentData);

      // 3. Create Transaction
      const transactionData = {
        date: new Date().toISOString(),
        description: `Incasso Online - ${formData.childName} - ${sub?.name}`,
        amount: sub?.price || 0,
        type: TransactionType.Income,
        category: TransactionCategory.Vendite,
        paymentMethod: formData.paymentMethod,
        status: TransactionStatus.Completed,
        relatedEnrollmentId: enrRef.id,
        allocationId: formData.selectedLocationId,
        allocationName: formData.selectedLocationName,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'transactions'), transactionData);

      // 4. Create Invoice (if Bank Transfer)
      if (formData.paymentMethod === PaymentMethod.BankTransfer) {
        const invoiceData = {
          clientId: clientRef.id,
          clientName: `${formData.parentFirstName} ${formData.parentLastName}`,
          issueDate: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          status: DocumentStatus.PendingSDI,
          paymentMethod: formData.paymentMethod,
          relatedEnrollmentId: enrRef.id,
          items: [{
            description: `Iscrizione ${formData.childName} - ${sub?.name}`,
            quantity: 1,
            price: sub?.price || 0
          }],
          totalAmount: sub?.price || 0,
          isGhost: false,
          isDeleted: false,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'invoices'), invoiceData);
      }

      // 5. Update Lead
      await updateDoc(doc(db, 'incoming_leads', lead.id), {
        status: 'converted',
        convertedAt: new Date().toISOString()
      });

      setSuccessMode('paid');
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Errore durante il pagamento.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Spinner /></div>;
  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center border border-red-100">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ops!</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <button onClick={() => window.location.href = '/'} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">Torna alla Home</button>
      </div>
    </div>
  );

  if (isSuccess) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-2xl text-center border border-green-100 animate-fade-in">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-4">
          {successMode === 'booking' ? 'Prenotazione Inviata!' : 'Iscrizione Completata!'}
        </h2>
        <p className="text-gray-600 mb-8 leading-relaxed">
          {successMode === 'booking' 
            ? 'Abbiamo ricevuto la tua richiesta. Ti contatteremo a breve per confermare il posto e darti il benvenuto!' 
            : 'Grazie! Il pagamento è stato ricevuto e l\'iscrizione è attiva. Ti aspettiamo in sede!'}
        </p>
        <div className="space-y-3">
          <button onClick={() => window.location.href = 'https://www.instagram.com/easypeasylabs'} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">Seguici su Instagram</button>
          <p className="text-xs text-gray-400">Riceverai una mail di riepilogo a breve.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20">
      {/* Hero Header */}
      <div className="bg-[#012169] text-white pt-12 pb-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400 rounded-full blur-3xl opacity-20 -mr-32 -mt-32"></div>
        <div className="max-w-2xl mx-auto relative z-10">
          <img src="/lemon_logo_150px.png" alt="Logo" className="h-16 mb-8 mx-auto" />
          <h1 className="text-4xl font-black text-center mb-2 tracking-tight">Completa Iscrizione</h1>
          <p className="text-blue-200 text-center font-medium">Pochi passi per entrare nel mondo EasyPeasy Lab</p>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="max-w-2xl mx-auto -mt-12 px-4">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          
          {/* Progress Bar */}
          <div className="flex h-1.5 bg-gray-100">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`flex-1 transition-all duration-500 ${step >= i ? 'bg-amber-400' : 'bg-transparent'}`}></div>
            ))}
          </div>

          <div className="p-8">
            
            {/* STEP 1: DATI ANAGRAFICI */}
            {step === 1 && (
              <div className="space-y-8 animate-fade-in">
                
                {/* Dati Genitore (Read Only) */}
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-700 uppercase tracking-tight">Dati Verificati</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70 pointer-events-none select-none">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nome</label>
                      <div className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-600 flex justify-between items-center">
                        {formData.parentFirstName} <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Cognome</label>
                      <div className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-600 flex justify-between items-center">
                        {formData.parentLastName} <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Email</label>
                      <div className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-600 flex justify-between items-center">
                        {formData.parentEmail} <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Telefono</label>
                      <div className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-600 flex justify-between items-center">
                        {formData.parentPhone} <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dati Mancanti (Mandatory) */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-900 rounded-lg flex items-center justify-center">
                      <Info className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-blue-900 uppercase tracking-tight">Completa i Dati Mancanti</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Codice Fiscale Genitore <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={formData.parentFiscalCode} 
                        onChange={e => setFormData({...formData, parentFiscalCode: e.target.value.toUpperCase()})} 
                        placeholder="RSSMRA80A01H501Z" 
                        className={`w-full bg-white border-2 rounded-xl px-4 py-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all uppercase font-medium ${!formData.parentFiscalCode ? 'border-blue-300' : 'border-gray-200'}`} 
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Indirizzo (Via e Civico) <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          value={formData.parentAddress} 
                          onChange={e => setFormData({...formData, parentAddress: e.target.value})} 
                          placeholder="Via Roma 1"
                          className={`w-full bg-white border-2 rounded-xl px-4 py-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all ${!formData.parentAddress ? 'border-blue-300' : 'border-gray-200'}`} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">CAP <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          value={formData.parentZip} 
                          onChange={e => setFormData({...formData, parentZip: e.target.value})} 
                          placeholder="00100"
                          className={`w-full bg-white border-2 rounded-xl px-4 py-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all ${!formData.parentZip ? 'border-blue-300' : 'border-gray-200'}`} 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Città <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          value={formData.parentCity} 
                          onChange={e => setFormData({...formData, parentCity: e.target.value})} 
                          className={`w-full bg-white border-2 rounded-xl px-4 py-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all ${!formData.parentCity ? 'border-blue-300' : 'border-gray-200'}`} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Provincia <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          value={formData.parentProvince} 
                          onChange={e => setFormData({...formData, parentProvince: e.target.value.toUpperCase()})} 
                          placeholder="RM"
                          maxLength={2}
                          className={`w-full bg-white border-2 rounded-xl px-4 py-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all uppercase ${!formData.parentProvince ? 'border-blue-300' : 'border-gray-200'}`} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 mt-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                      <Baby className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-indigo-900 uppercase tracking-tight">Dati Allievo</h2>
                  </div>
                  
                  {/* Child Read Only */}
                  <div className="mb-4 opacity-70 pointer-events-none select-none">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nome Allievo</label>
                    <div className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-600 flex justify-between items-center">
                      {formData.childName} <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Data di Nascita <span className="text-red-500">*</span></label>
                      <input 
                        type="date" 
                        value={formData.childDateOfBirth} 
                        onChange={e => setFormData({...formData, childDateOfBirth: e.target.value})} 
                        className={`w-full bg-white border-2 rounded-xl px-4 py-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all ${!formData.childDateOfBirth ? 'border-blue-300' : 'border-gray-200'}`} 
                      />
                    </div>
                    <div className="space-y-1 opacity-70 pointer-events-none select-none">
                      <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Età (stimata)</label>
                      <input type="text" value={formData.childAge} readOnly className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-500" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: SEDE E ORARIO */}
            {step === 2 && (
              <div className="space-y-8 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Sede e Orario</h2>
                </div>

                {lead?.selectedLocation && lead?.selectedSlot && formData.selectedLocationId && formData.selectedSlot ? (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6">
                    <h3 className="text-sm font-black text-amber-800 uppercase mb-4">Scelte confermate</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-amber-100">
                        <MapPin className="w-5 h-5 text-amber-500" />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Sede</p>
                          <p className="font-bold text-gray-800">{formData.selectedLocationName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-amber-100">
                        <Clock className="w-5 h-5 text-amber-500" />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Orario</p>
                          <p className="font-bold text-gray-800">{formData.selectedSlot}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-amber-600 mt-4 font-medium">
                      Queste opzioni sono state selezionate durante la tua richiesta iniziale e non possono essere modificate.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <label className="text-xs font-black text-gray-400 uppercase">Seleziona la Sede</label>
                        {lead?.selectedLocation && (
                          <button 
                            onClick={() => setShowAllOptions(!showAllOptions)}
                            className="text-[10px] font-bold text-indigo-600 hover:underline uppercase"
                          >
                            {showAllOptions ? 'Mostra solo preferenza' : 'Mostra tutte le sedi'}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {locations
                          .filter(loc => {
                            if (showAllOptions || !lead?.selectedLocation) return true;
                            const leadLocNormalized = normalizeString(lead.selectedLocation);
                            const locNameNorm = normalizeString(loc.name);
                            return locNameNorm === leadLocNormalized || normalizeString(loc.id) === leadLocNormalized || leadLocNormalized.includes(locNameNorm) || locNameNorm.includes(leadLocNormalized);
                          })
                          .map(loc => {
                            const isPreferred = lead?.selectedLocation && (
                              normalizeString(loc.name) === normalizeString(lead.selectedLocation) || 
                              normalizeString(loc.id) === normalizeString(lead.selectedLocation) ||
                              normalizeString(lead.selectedLocation).includes(normalizeString(loc.name)) ||
                              normalizeString(loc.name).includes(normalizeString(lead.selectedLocation))
                            );
                            return (
                          <button 
                            key={loc.id}
                            onClick={() => setFormData({...formData, selectedLocationId: loc.id, selectedLocationName: loc.name, selectedSlot: ''})}
                            className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col gap-2 ${formData.selectedLocationId === loc.id ? 'border-amber-400 bg-amber-50 ring-4 ring-amber-400/10' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: loc.color }}></div>
                              <span className="font-black text-gray-800 text-lg">{loc.name}</span>
                            </div>
                            {(loc.address || loc.city) && (
                              <div className="text-sm text-gray-600">
                                {loc.address}{loc.city ? `, ${loc.city}` : ''}
                              </div>
                            )}
                            {(loc.address || loc.city) && (
                              <div className="mt-2">
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.name} ${loc.address} ${loc.city}`)}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                                >
                                  <MapPin className="w-3 h-3" /> Mostra sulla mappa
                                </a>
                              </div>
                            )}
                            {isPreferred && !showAllOptions && (
                              <span className="inline-block px-2 py-1 bg-indigo-100 text-[10px] text-indigo-600 font-bold rounded mt-1 uppercase self-start">Sede Preferita</span>
                            )}
                          </button>
                        )})}
                      </div>
                    </div>

                    {formData.selectedLocationId && (
                      <div className="space-y-6 animate-slide-up mt-8">
                        {['LAB', 'SG', 'EVT'].map(type => {
                          const typeSlots = locations.find(l => l.id === formData.selectedLocationId)?.slots.filter(s => s.type === type);
                          if (!typeSlots || typeSlots.length === 0) return null;
                          
                          // Filter slots if preference exists and we are not showing all
                          const filteredSlots = typeSlots.filter(slot => {
                            if (showAllOptions || !lead?.selectedSlot) return true;
                            const slotNorm = normalizeString(slot.time);
                            const leadSlotNorm = normalizeString(lead.selectedSlot);
                            return leadSlotNorm.includes(slotNorm) || slotNorm.includes(leadSlotNorm);
                          });

                          if (filteredSlots.length === 0 && !showAllOptions) return null;

                          const typeLabel = type === 'LAB' ? 'Laboratorio' : type === 'SG' ? 'Spazio Gioco' : 'Evento Speciale';
                          const typeColor = type === 'LAB' ? 'bg-blue-100 text-blue-800' : type === 'SG' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800';

                          return (
                            <div key={type} className="space-y-3">
                              <label className={`text-[10px] font-black uppercase tracking-widest ${type === 'LAB' ? 'text-blue-600' : type === 'SG' ? 'text-orange-600' : 'text-purple-600'}`}>{typeLabel}i</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {(showAllOptions ? typeSlots : filteredSlots).map(slot => {
                                  const isPreferred = lead?.selectedSlot && (
                                    normalizeString(lead.selectedSlot).includes(normalizeString(slot.time)) ||
                                    normalizeString(slot.time).includes(normalizeString(lead.selectedSlot))
                                  );
                                  return (
                                  <button 
                                    key={slot.time}
                                    onClick={() => setFormData({...formData, selectedSlot: slot.time})}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col gap-2 ${formData.selectedSlot === slot.time ? 'border-indigo-600 bg-indigo-50 ring-4 ring-indigo-600/10' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                                  >
                                    <div className="flex justify-between items-start w-full">
                                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${typeColor}`}>
                                        {type}
                                      </span>
                                      {isPreferred && (
                                        <CheckCircle className="w-5 h-5 text-indigo-600" />
                                      )}
                                    </div>
                                    <div className="font-bold text-gray-800 text-sm">
                                      {typeLabel}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600 font-medium mt-1">
                                      <Clock className="w-4 h-4" />
                                      {slot.time}
                                    </div>
                                  </button>
                                )})}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* STEP 3: ABBONAMENTO */}
            {step === 3 && (
              <div className="space-y-8 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Scegli Abbonamento</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {subscriptionTypes
                    .filter(sub => sub.statusConfig?.status === 'active' && sub.isPubliclyVisible !== false)
                    .map(sub => {
                      // Smart Name Parsing
                      const nameParts = sub.name.split('.');
                      const shortName = nameParts.length > 1 ? nameParts[nameParts.length - 1].toUpperCase() : sub.name.toUpperCase();
                      
                      const breakdown = [
                        (sub.labCount || 0) > 0 ? `${sub.labCount} Lab` : null,
                        (sub.sgCount || 0) > 0 ? `${sub.sgCount} SG` : null,
                        (sub.evtCount || 0) > 0 ? `${sub.evtCount} Evt` : null
                      ].filter(Boolean).join(' + ');

                      const defaultDescription = breakdown 
                        ? `${breakdown} (${sub.lessons} totali) • Validità ${Math.round(sub.durationInDays / 30)} mesi`
                        : `${sub.lessons} lezioni totali • Validità ${Math.round(sub.durationInDays / 30)} mesi`;
                      
                      const description = sub.description || defaultDescription;

                      return (
                        <button 
                          key={sub.id}
                          onClick={() => setFormData({...formData, selectedSubscriptionId: sub.id})}
                          className={`relative w-full p-6 rounded-3xl border-2 text-left transition-all flex flex-col justify-between h-full min-h-[160px] group ${formData.selectedSubscriptionId === sub.id ? 'border-blue-900 bg-blue-50 ring-4 ring-blue-900/10' : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-lg'}`}
                        >
                          <div className="space-y-2">
                            <h3 className={`font-black text-xl tracking-tight ${formData.selectedSubscriptionId === sub.id ? 'text-blue-900' : 'text-gray-900'}`}>
                              {shortName}
                            </h3>
                            <p className="text-sm text-gray-500 font-medium whitespace-pre-line">{description}</p>
                          </div>
                          
                          <div className="mt-6 flex justify-between items-end w-full">
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${formData.selectedSubscriptionId === sub.id ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                              {sub.target === 'kid' ? 'Bambini' : 'Adulti'}
                            </span>
                            <span className="bg-amber-400 text-gray-900 px-4 py-2 rounded-xl text-xl font-black shadow-sm transform group-hover:scale-105 transition-transform">
                              {sub.price}€
                            </span>
                          </div>

                          {formData.selectedSubscriptionId === sub.id && (
                            <div className="absolute top-4 right-4 text-blue-900">
                              <CheckCircle className="w-6 h-6 fill-blue-100" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* STEP 4: RIEPILOGO E AZIONE */}
            {step === 4 && (
              <div className="space-y-8 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Riepilogo</h2>
                </div>

                <div className="bg-gray-50 rounded-3xl p-6 space-y-4 border border-gray-100">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                    <span className="text-xs font-black text-gray-400 uppercase">Allievo</span>
                    <span className="font-bold">{formData.childName}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                    <span className="text-xs font-black text-gray-400 uppercase">Sede</span>
                    <span className="font-bold">{formData.selectedLocationName}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                    <span className="text-xs font-black text-gray-400 uppercase">Orario</span>
                    <span className="font-bold">{formData.selectedSlot}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs font-black text-gray-400 uppercase">Totale</span>
                    <span className="text-3xl font-black text-blue-900">
                      {subscriptionTypes.find(s => s.id === formData.selectedSubscriptionId)?.price}€
                    </span>
                  </div>
                </div>

                {/* High Visibility Alert */}
                <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-xl shadow-sm flex gap-4 items-start">
                  <AlertCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
                  <div className="space-y-1">
                    <h3 className="text-red-800 font-black uppercase tracking-tight text-sm">Attenzione: Regolamento Assenze</h3>
                    <p className="text-sm text-red-700 leading-relaxed font-medium">
                      Le lezioni perse <strong>NON sono recuperabili</strong> e <strong>NON sono previsti rimborsi</strong> sulle quote pagate. 
                      L'iscrizione impegna il posto per l'intera durata dell'abbonamento.
                    </p>
                  </div>
                </div>

                {!showPaymentDetails ? (
                  <div className="grid grid-cols-1 gap-4">
                    <button 
                      onClick={() => setShowBookingModal(true)}
                      disabled={isProcessing}
                      className="w-full bg-white border-2 border-blue-900 text-blue-900 font-black py-4 rounded-2xl hover:bg-blue-50 transition-all uppercase tracking-widest text-sm shadow-sm"
                    >
                      Prenota Iscrizione (Paga in Sede)
                    </button>
                    <button 
                      onClick={() => setShowPaymentDetails(true)}
                      className="w-full bg-blue-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-800 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                    >
                      Paga Ora <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 animate-slide-up">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-400 uppercase">Metodo di Pagamento</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => setFormData({...formData, paymentMethod: PaymentMethod.BankTransfer})}
                          className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${formData.paymentMethod === PaymentMethod.BankTransfer ? 'border-blue-900 bg-blue-50' : 'border-gray-100 bg-white'}`}
                        >
                          <Info className={`w-6 h-6 ${formData.paymentMethod === PaymentMethod.BankTransfer ? 'text-blue-900' : 'text-gray-400'}`} />
                          <span className={`text-xs font-bold ${formData.paymentMethod === PaymentMethod.BankTransfer ? 'text-blue-900' : 'text-gray-500'}`}>Bonifico</span>
                        </button>
                        <button 
                          onClick={() => setFormData({...formData, paymentMethod: PaymentMethod.PayPal})}
                          className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${formData.paymentMethod === PaymentMethod.PayPal ? 'border-blue-900 bg-blue-50' : 'border-gray-100 bg-white'}`}
                        >
                          <ExternalLink className={`w-6 h-6 ${formData.paymentMethod === PaymentMethod.PayPal ? 'text-blue-900' : 'text-gray-400'}`} />
                          <span className={`text-xs font-bold ${formData.paymentMethod === PaymentMethod.PayPal ? 'text-blue-900' : 'text-gray-500'}`}>PayPal</span>
                        </button>
                      </div>
                    </div>

                    {/* Payment Info Box */}
                    <div className="bg-white border-2 border-blue-100 rounded-3xl p-6 shadow-sm">
                      {formData.paymentMethod === PaymentMethod.BankTransfer ? (
                        <div className="space-y-6">
                          <h4 className="font-black text-blue-900 uppercase text-sm border-b border-gray-100 pb-2">Dati per il Bonifico</h4>
                          
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-gray-400 uppercase">IBAN</p>
                            <div className="bg-gray-50 p-4 rounded-xl relative group border border-gray-200 flex justify-between items-center">
                              <p className="font-mono text-lg font-bold text-gray-800 tracking-wider overflow-x-auto whitespace-nowrap scrollbar-hide">
                                {companyInfo?.iban || 'IBAN NON DISPONIBILE'}
                              </p>
                              <button 
                                onClick={() => { navigator.clipboard.writeText(companyInfo?.iban || ''); alert("IBAN copiato!"); }}
                                className="text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition-colors"
                              >
                                <Copy className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-gray-400 uppercase">Causale (Obbligatoria)</p>
                            <div className="bg-amber-50 border-2 border-amber-200 border-dashed p-4 rounded-xl text-center">
                              <p className="font-bold text-amber-900 text-sm leading-relaxed">
                                Iscrizione {formData.childName.toUpperCase()} - Sede {formData.selectedLocationName.toUpperCase()} - {subscriptionTypes.find(s => s.id === formData.selectedSubscriptionId)?.name.split('.').pop()?.toUpperCase()}
                              </p>
                            </div>
                            <p className="text-[10px] text-gray-500 italic text-center">
                              Copia esattamente questa causale per garantire la registrazione immediata.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <h4 className="font-black text-blue-900 uppercase text-sm">Link PayPal</h4>
                          <a 
                            href={companyInfo?.paypal ? (companyInfo.paypal.startsWith('http') ? companyInfo.paypal : `https://${companyInfo.paypal}`) : '#'} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-between bg-[#0070BA] text-white p-4 rounded-xl font-bold hover:bg-[#003087] transition-colors shadow-md"
                          >
                            <span>Paga con PayPal</span>
                            <ExternalLink className="w-5 h-5" />
                          </a>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={handlePayment}
                      disabled={isProcessing}
                      className="w-full bg-blue-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-800 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                    >
                      {isProcessing ? <Spinner /> : <><CreditCard className="w-5 h-5" /> Conferma e Paga</>}
                    </button>
                    <button onClick={() => setShowPaymentDetails(false)} className="w-full text-gray-400 text-xs font-bold uppercase tracking-widest hover:text-gray-600">Indietro</button>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            {!showPaymentDetails && step < 4 && (
              <div className="mt-12 flex justify-between items-center">
                {step > 1 ? (
                  <button onClick={handleBack} className="flex items-center gap-2 text-gray-400 font-bold hover:text-gray-600 transition-colors">
                    <ChevronLeft className="w-5 h-5" /> Indietro
                  </button>
                ) : <div></div>}
                
                <button 
                  onClick={handleNext}
                  disabled={
                    (step === 1 && (!formData.parentFirstName || !formData.parentLastName || !formData.parentFiscalCode)) ||
                    (step === 2 && (!formData.selectedLocationId || !formData.selectedSlot)) ||
                    (step === 3 && !formData.selectedSubscriptionId)
                  }
                  className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-30 disabled:grayscale"
                >
                  Avanti <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center space-y-4">
          <p className="text-xs text-gray-400 font-medium">
            Hai bisogno di aiuto? Contattaci al <span className="text-blue-900 font-bold">{companyInfo?.phone}</span>
          </p>
          <div className="flex justify-center gap-4">
            <div className="w-8 h-8 bg-white rounded-full shadow-sm flex items-center justify-center border border-gray-100">
              <Info className="w-4 h-4 text-gray-400" />
            </div>
            <div className="w-8 h-8 bg-white rounded-full shadow-sm flex items-center justify-center border border-gray-100">
              <CreditCard className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Booking Confirmation Modal */}
      {showBookingModal && (
        <Modal onClose={() => setShowBookingModal(false)} size="md">
          <div className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tight">Conferma Prenotazione</h3>
              <p className="text-gray-600 leading-relaxed">
                Posto bloccato con successo! Ti aspettiamo in sede il <strong>{formData.selectedSlot.split(' ')[0] || 'giorno stabilito'}</strong>. 
                <br/><br/>
                Potrai saldare la quota di <strong className="text-blue-900 text-lg">{subscriptionTypes.find(s => s.id === formData.selectedSubscriptionId)?.price}€</strong> direttamente in contanti prima dell'inizio della lezione.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button 
                onClick={handleBooking}
                disabled={isProcessing}
                className="w-full bg-blue-900 text-white font-black py-4 rounded-xl shadow-lg hover:bg-blue-800 transition-all uppercase tracking-widest text-sm"
              >
                {isProcessing ? <Spinner /> : 'Ho capito, Procedi'}
              </button>
              <button 
                onClick={() => setShowBookingModal(false)}
                className="w-full text-gray-400 font-bold py-2 hover:text-gray-600 transition-colors uppercase text-xs tracking-widest"
              >
                Annulla
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EnrollmentPortal;
