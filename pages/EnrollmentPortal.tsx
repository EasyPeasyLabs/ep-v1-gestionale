
import React, { useState, useEffect } from 'react';
import CheckIcon from '../components/icons/CheckIcon';
import EuroCoinIcon from '../components/icons/EuroCoinIcon';
import MapPinIcon from '../components/icons/SuppliersIcon';
import ClockIcon from '../components/icons/ClockIcon';
import ProfileIcon from '../components/icons/ProfileIcon';
import IdentificationIcon from '../components/icons/IdentificationIcon';
import ChevronDownIcon from '../components/icons/ChevronDownIcon';
import ExclamationIcon from '../components/icons/ExclamationIcon';
import HelpIcon from '../components/icons/HelpIcon';
import CalendarIcon from '../components/icons/CalendarIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import ClipboardIcon from '../components/icons/ClipboardIcon';

// Icon Wrappers to support className
const IconWrap = ({ Icon, className }: { Icon: any, className?: string }) => (
  <div className={className}><Icon /></div>
);

const CheckCircle = (props: any) => <IconWrap Icon={CheckIcon} {...props} />;
const CreditCard = (props: any) => <IconWrap Icon={EuroCoinIcon} {...props} />;
const MapPin = ({ className }: any) => <span className={className}>📍</span>;
const Clock = (props: any) => <IconWrap Icon={ClockIcon} {...props} />;
const User = (props: any) => <IconWrap Icon={ProfileIcon} {...props} />;
const Baby = (props: any) => <IconWrap Icon={IdentificationIcon} {...props} />;
const ChevronRight = ({ className }: any) => <span className={className}>→</span>;
const ChevronLeft = ({ className }: any) => <span className={className}>←</span>;
const AlertCircle = (props: any) => <IconWrap Icon={ExclamationIcon} {...props} />;
const Info = (props: any) => <IconWrap Icon={HelpIcon} {...props} />;
const ExternalLink = ({ className }: any) => <span className={className}>🔗</span>;
const Copy = (props: any) => <IconWrap Icon={ClipboardIcon} {...props} />;
const Calendar = (props: any) => <IconWrap Icon={CalendarIcon} {...props} />;
const Sparkles = (props: any) => <IconWrap Icon={SparklesIcon} {...props} />;
import BanknotesIcon from '../components/icons/BanknotesIcon';
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
} from '../types';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

// Native Date Helpers to replace date-fns
const parseISO = (str: string) => new Date(str);
const format = (date: Date, fmt: string) => {
  const d = new Date(date);
  if (fmt === "EEEE d MMMM" || fmt === "d MMMM") {
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  return d.toLocaleDateString('it-IT');
};

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeString = (val: any) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
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
  relatedEnrollmentId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatSlotToString = (slot: any): string => {
  if (!slot) return '';
  if (typeof slot === 'string') return slot;

  // Se è l'oggetto descritto nell'errore {bundleName, dayOfWeek, startTime, endTime...}
  const daysMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const day = daysMap[slot.dayOfWeek || 0] || '';
  const time = (slot.startTime && slot.endTime) ? `${slot.startTime} - ${slot.endTime}` : '';

  if (day && time) return `${day}, ${time}`;
  if (slot.bundleName) return slot.bundleName;

  return JSON.stringify(slot); // Fallback estremo per debug, ma ora gestito come stringa
};

const calculateAgeString = (dob: string): string => {
  if (!dob) return '';
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();

  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) {
    years--;
    months += 12;
  }

  if (now.getDate() < birth.getDate()) {
    months--;
    if (months < 0) {
      months += 12;
    }
  }

  if (years < 0) return '0 mesi';

  let result = `${years} anni`;
  if (months > 0) result += ` + ${months} mesi`;
  return result;
};

const getNextOccurrence = (dayName: string): string => {
  const days = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const targetDay = days.indexOf(dayName.toLowerCase().trim());
  if (targetDay === -1) return '';

  const now = new Date();
  const result = new Date(now);

  // Calculate days until next occurrence
  const currentDay = now.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil <= 0) daysUntil += 7; // Always at least 1 day in the future (or next week if same day)

  result.setDate(now.getDate() + daysUntil);
  return result.toISOString();
};

const EnrollmentPortal: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [lead, setLead] = useState<Lead | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
  const [locations, setLocations] = useState<{ id: string, name: string, address: string, city: string, color: string, slots: { time: string, type: SlotType }[] }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [existingEnrollment, setExistingEnrollment] = useState<any | null>(null);

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
  const [showOtherSubscriptions, setShowOtherSubscriptions] = useState(false);

  // Bundle slots accorpati (es. [{type:'LAB', startTime:'10:00', endTime:'11:00'}, {type:'SG',...}])
  const [selectedBundleSlots, setSelectedBundleSlots] = useState<{ type: string, startTime: string, endTime: string }[]>([]);

  useEffect(() => {
    // Extract ID from either search params or hash params (for SPA compatibility)
    const searchParams = new URLSearchParams(window.location.search);
    let leadId = searchParams.get('id');

    if (!leadId && window.location.hash.includes('?')) {
      const hashPart = window.location.hash.split('?')[1];
      const hashParams = new URLSearchParams(hashPart);
      leadId = hashParams.get('id');
    }

    if (!leadId && window.location.pathname.startsWith('/i/')) {
      leadId = window.location.pathname.split('/i/')[1];
    }

    if (!leadId && (window as any).__ENROLLMENT_ID__) { // eslint-disable-line @typescript-eslint/no-explicit-any
      leadId = (window as any).__ENROLLMENT_ID__; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    if (!leadId) {
      setError("Link non valido. Contatta la segreteria.");
      setLoading(false);
      return;
    }

    // Initialize lead state with the ID from URL to ensure it's available for functions
    setLead({ id: leadId } as any);

    const fetchData = async () => {
      try {
        const getEnrollmentData = httpsCallable(functions, 'getEnrollmentData');
        const result = await getEnrollmentData({ leadId });
        const data = result.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any

        if (data.existingEnrollment) {
          setExistingEnrollment(data.existingEnrollment);
          setLoading(false);
          return;
        }

        const leadData = data.lead as Lead;
        const company = data.company;
        const subs = data.subscriptions;
        const suppliers = data.suppliers;

        setLead(leadData);
        setCompanyInfo(company);
        setSubscriptionTypes(subs);

        // Extract locations from suppliers
        const daysMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
        const locs: { id: string, name: string, address: string, city: string, color: string, slots: { time: string, type: SlotType }[] }[] = [];
        suppliers.forEach((s: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          s.locations.forEach((l: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
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
                  .filter((a: any) => a.isPubliclyVisible !== false) // eslint-disable-line @typescript-eslint/no-explicit-any
                  .map((a: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
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
        const normalizedSlotString = formatSlotToString(leadData.selectedSlot);

        // --- CHIRURGICAL MATCHING LOGIC ---
        let matchedLocationId = '';
        let matchedLocationName = '';
        let matchedSlotTime = '';
        let preselectedSubId = '';

        // 1. Match Location (Fuzzy & Deep)
        const leadLocRaw = String(leadData.selectedLocation || '');
        const leadLocNormalized = normalizeString(leadLocRaw);

        const matchedLoc = locs.find(l => {
          const locNameNorm = normalizeString(l.name);
          const locIdNorm = normalizeString(l.id);
          // Check for exact match, ID match, or containment in both directions
          return locNameNorm === leadLocNormalized ||
            locIdNorm === leadLocNormalized ||
            (leadLocNormalized.length > 2 && locNameNorm.includes(leadLocNormalized)) ||
            (locNameNorm.length > 2 && leadLocNormalized.includes(locNameNorm));
        });

        if (matchedLoc) {
          matchedLocationId = matchedLoc.id;
          matchedLocationName = matchedLoc.name;

          // 2. Match Slot within Location (Time-only matching)
          const extractTimeDigits = (s: string) => s.replace(/\D/g, '');
          const leadTimeDigits = extractTimeDigits(normalizedSlotString);

          const matchedSlot = matchedLoc.slots.find(s => {
            const dbSlotTime = String(s.time || '');
            const dbTimeDigits = extractTimeDigits(dbSlotTime);
            return dbTimeDigits !== '' && (dbTimeDigits.includes(leadTimeDigits) || leadTimeDigits.includes(dbTimeDigits));
          });

          if (matchedSlot) {
            matchedSlotTime = matchedSlot.time;
          } else {
            // Fallback: use the raw string if location matched but slot didn't exactly
            matchedSlotTime = normalizedSlotString;
          }
        }

        // 3. Match Bundle (Subscription) - ID Prioritized (Infallible ID from Project B)
        if (leadData.selectedSlot && typeof leadData.selectedSlot === 'object') {
          preselectedSubId = (leadData.selectedSlot as any).bundleId || (leadData.selectedSlot as any).subscriptionId || '';
        }

        // Validation & Name Fallback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subExists = preselectedSubId ? subs.find((s: any) => s.id === preselectedSubId) : null;

        if (!subExists && normalizedSlotString) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const matchedSub = subs.find((s: any) =>
            s.statusConfig?.status === 'active' && (
              normalizeString(s.name).includes(normalizeString(normalizedSlotString)) ||
              normalizeString(normalizedSlotString).includes(normalizeString(s.name)) ||
              (s.publicName && normalizeString(s.publicName).includes(normalizeString(normalizedSlotString)))
            )
          );
          if (matchedSub) preselectedSubId = matchedSub.id;
        } else if (subExists) {
          preselectedSubId = subExists.id;
        }

        // Estrai gli slot inclusi nel bundle (es. LAB + SG) se disponibili
        if (leadData.selectedSlot && typeof leadData.selectedSlot === 'object') {
          const bundleSlots = (leadData.selectedSlot as any).includedSlots;
          if (Array.isArray(bundleSlots) && bundleSlots.length > 0) {
            setSelectedBundleSlots(bundleSlots);
          }
        }

        setFormData(prev => ({
          ...prev,
          parentFirstName: leadData.nome || '',
          parentLastName: leadData.cognome || '',
          parentEmail: leadData.email || '',
          parentPhone: leadData.telefono || '',
          childName: leadData.childName || '',
          childAge: String(leadData.childAge || ''),
          selectedLocationId: matchedLocationId,
          selectedLocationName: matchedLocationName || leadLocRaw,
          selectedSlot: matchedSlotTime || normalizedSlotString,
          selectedSubscriptionId: preselectedSubId
        }));

      } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error(err);
        setError(`Errore: ${err.message || "Sconosciuto"} (${err.code || "Nessun codice"})`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleProcessEnrollment = async (method: PaymentMethod | 'Cash') => {
    if (!lead) return;
    setIsProcessing(true);
    try {
      const sub = subscriptionTypes.find(s => s.id === formData.selectedSubscriptionId);
      const isCash = method === 'Cash';

      const clientData = {
        clientType: ClientType.Parent,
        firstName: formData.parentFirstName,
        lastName: formData.parentLastName,
        email: formData.parentEmail,
        phone: formData.parentPhone,
        taxCode: formData.parentFiscalCode,
        address: formData.parentAddress,
        city: formData.parentCity,
        zipCode: formData.parentZip,
        province: formData.parentProvince,
        children: [{
          id: '', // Will be set by server
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
        createdAt: new Date().toISOString(),
        source: 'portal'
      };

      // Estrazione orari dal bundle o dallo slot selezionato
      let startTime = '';
      let endTime = '';
      
      if (selectedBundleSlots.length > 0) {
          startTime = selectedBundleSlots[0].startTime;
          endTime = selectedBundleSlots[0].endTime;
      } else if (formData.selectedSlot.includes(',')) {
          // Formato: "Lunedì, 17:00 - 18:00"
          const timePart = formData.selectedSlot.split(',')[1]?.trim();
          if (timePart && timePart.includes('-')) {
              [startTime, endTime] = timePart.split('-').map(s => s.trim());
          }
      }

      const enrollmentData = {
        clientId: '', // Will be set by server
        clientName: `${formData.parentFirstName} ${formData.parentLastName}`,
        childId: '', // Will be set by server
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
        status: isCash ? EnrollmentStatus.Pending : EnrollmentStatus.Active,
        startDate: '', // Will be set by server
        endDate: '', // Will be set by server
        appointments: [{
          lessonId: '', // Will be set by server
          date: '', // Will be set by server
          startTime: startTime,
          endTime: endTime,
          locationId: formData.selectedLocationId || 'unassigned',
          locationName: formData.selectedLocationName || 'Sede Preferita',
          locationColor: '#3C3C52',
          childName: child.name,
          status: 'Scheduled'
        }],
        createdAt: new Date().toISOString(),
        source: 'portal'
      };

      const transactionData = {
        date: new Date().toISOString(),
        description: `${isCash ? 'Prenotazione Sede' : 'Incasso Online'} - ${formData.childName} - ${sub?.name}`,
        amount: sub?.price || 0,
        type: TransactionType.Income,
        category: TransactionCategory.Vendite,
        paymentMethod: isCash ? PaymentMethod.Cash : method as PaymentMethod,
        status: isCash ? TransactionStatus.Pending : TransactionStatus.Completed,
        relatedEnrollmentId: '', // Will be set by server
        allocationId: formData.selectedLocationId,
        allocationName: formData.selectedLocationName,
        createdAt: new Date().toISOString()
      };

      let invoiceData = null;
      if (method === PaymentMethod.BankTransfer) {
        invoiceData = {
          clientId: '', // Will be set by server
          clientName: `${formData.parentFirstName} ${formData.parentLastName}`,
          issueDate: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          status: DocumentStatus.Paid,
          paymentMethod: PaymentMethod.BankTransfer,
          relatedEnrollmentId: '', // Will be set by server
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
      }

      const processEnrollmentFunction = httpsCallable(functions, 'processEnrollment');
      await processEnrollmentFunction({
        leadId: lead.id,
        clientData,
        enrollmentData,
        transactionData,
        invoiceData
      });

      if (method === PaymentMethod.PayPal && companyInfo?.paypal) {
        const paypalLink = companyInfo.paypal.startsWith('http') ? companyInfo.paypal : `https://${companyInfo.paypal}`;
        window.open(paypalLink, '_blank');
      }

      setSuccessMode(isCash ? 'booking' : 'paid');
      setIsSuccess(true);
      setShowBookingModal(false);
    } catch (err: any) {
      console.error(err);
      alert(`Errore durante l'iscrizione: ${err.message || "Sconosciuto"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Spinner /></div>;

  // Summary View for Existing Enrollments
  if (existingEnrollment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-2xl text-center border border-green-100 animate-fade-in">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">
            Iscrizione Già Completata!
          </h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Hai già completato l'iscrizione per {existingEnrollment.childName}.
            Ecco il riepilogo dei dettagli:
          </p>

          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 text-left space-y-4 mb-8">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Sede</p>
                <p className="font-bold text-gray-800">{existingEnrollment.locationName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Orario</p>
                <p className="font-bold text-gray-800">
                  {existingEnrollment.appointments?.[0] ?
                    `${format(parseISO(existingEnrollment.appointments[0].date), 'EEEE')} ${existingEnrollment.appointments[0].startTime} - ${existingEnrollment.appointments[0].endTime}`
                    : 'Orario da definire'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Inizio Corso</p>
                <p className="font-bold text-gray-800">
                  {existingEnrollment.startDate ? format(parseISO(existingEnrollment.startDate), 'd MMMM yyyy') : 'Data da definire'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Importo Abbonamento</p>
                <p className="font-bold text-gray-800">€ {existingEnrollment.price}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button onClick={() => window.location.href = 'https://www.instagram.com/easypeasylabs'} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">Seguici su Instagram</button>
          </div>
        </div>
      </div>
    );
  }

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center border border-red-100">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ops!</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        {/* Removed dangerous button */}
      </div>
    </div>
  );

  if (isSuccess) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 3s infinite ease-in-out;
        }
      `}</style>
      <div className="max-w-md w-full bg-white p-10 rounded-[40px] shadow-2xl text-center border border-green-100 animate-fade-in">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <CheckCircle className="w-14 h-14" />
        </div>
        <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">
          {successMode === 'booking' ? 'Richiesta Inviata!' : 'Iscrizione Attiva!'}
        </h2>
        <div className="space-y-4 mb-10">
          <p className="text-xl text-gray-600 font-medium leading-relaxed">
            {successMode === 'booking'
              ? 'Abbiamo ricevuto la tua richiesta. Riceverai a breve una mail di conferma.'
              : 'Grazie! Il pagamento è stato ricevuto. Riceverai a breve la mail di riepilogo.'}
          </p>
          <p className="text-2xl font-black text-indigo-600 uppercase tracking-widest">
            Ci vediamo in sede!
          </p>
        </div>
        <div className="space-y-4">
          <button
            onClick={() => window.location.href = 'https://sites.google.com/view/easypeasylabs/home'}
            className="w-full bg-gray-900 text-white font-black py-5 rounded-[24px] shadow-xl hover:bg-gray-800 transition-all uppercase tracking-[0.2em] text-sm"
          >
            Ho capito
          </button>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Verrai reindirizzato al sito ufficiale</p>
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
                        onChange={e => setFormData({ ...formData, parentFiscalCode: e.target.value.toUpperCase() })}
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
                          onChange={e => setFormData({ ...formData, parentAddress: e.target.value.toUpperCase() })}
                          placeholder="VIA ROMA 1"
                          className={`w-full bg-white border-2 rounded-xl px-4 py-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all uppercase font-medium ${!formData.parentAddress ? 'border-blue-300' : 'border-gray-200'}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">CAP <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={formData.parentZip}
                          onChange={e => setFormData({ ...formData, parentZip: e.target.value })}
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
                          onChange={e => setFormData({ ...formData, parentCity: e.target.value.toUpperCase() })}
                          placeholder="ROMA"
                          className={`w-full bg-white border-2 rounded-xl px-4 py-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all uppercase font-medium ${!formData.parentCity ? 'border-blue-300' : 'border-gray-200'}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Provincia <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={formData.parentProvince}
                          onChange={e => setFormData({ ...formData, parentProvince: e.target.value.toUpperCase().substring(0, 2) })}
                          placeholder="RM"
                          maxLength={2}
                          className={`w-full bg-white border-2 rounded-xl px-4 py-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all uppercase font-medium ${!formData.parentProvince ? 'border-blue-300' : 'border-gray-200'}`}
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
                        onChange={e => {
                          const dob = e.target.value;
                          const calculatedAge = calculateAgeString(dob);
                          setFormData({
                            ...formData,
                            childDateOfBirth: dob,
                            childAge: calculatedAge || formData.childAge
                          });
                        }}
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
                  <h2 className="text-xl font-black uppercase tracking-tight tracking-widest">Sede e Orario</h2>
                </div>

                {formData.selectedLocationId && formData.selectedSlot ? (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-[32px] p-8">
                    <h3 className="text-sm font-black text-amber-800 uppercase mb-6 tracking-widest">Scelte confermate</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                        <MapPin className="w-6 h-6 text-amber-500" />
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sede</p>
                          <p className="font-bold text-gray-800 text-lg">{formData.selectedLocationName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                        <Clock className="w-6 h-6 text-amber-500" />
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Orario</p>
                          {selectedBundleSlots.length > 0 ? (
                            <div className="space-y-1 mt-1">
                              {selectedBundleSlots.map((s, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-black rounded uppercase">{s.type}</span>
                                  <span className="font-bold text-gray-800 text-sm">{s.startTime} – {s.endTime}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="font-bold text-gray-800 text-lg">{formData.selectedSlot}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-amber-100 p-4 rounded-2xl border border-amber-200 shadow-sm md:col-span-2">
                        <Calendar className="w-6 h-6 text-amber-600" />
                        <div>
                          <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Prima Lezione Utile</p>
                          <p className="font-black text-amber-900 text-xl capitalize">
                            {(() => {
                              const slotDay = (formData.selectedSlot || '').split(',')[0].trim();
                              const firstLessonDate = getNextOccurrence(slotDay);
                              return firstLessonDate ? format(parseISO(firstLessonDate), 'EEEE d MMMM') : 'da definire';
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-amber-600 mt-6 font-bold uppercase tracking-widest">
                      Opzioni già confermate durante la prenotazione.
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
                                onClick={() => setFormData({ ...formData, selectedLocationId: loc.id, selectedLocationName: loc.name, selectedSlot: '' })}
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
                            )
                          })}
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
                                      onClick={() => setFormData({ ...formData, selectedSlot: slot.time })}
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
                                  )
                                })}
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
                  <h2 className="text-xl font-black uppercase tracking-tight tracking-widest">Riepilogo Abbonamento</h2>
                </div>

                {/* Logic to determine what to show */}
                {(() => {
                  const preSelectedId = formData.selectedSubscriptionId;
                  const sub = subscriptionTypes.find(s => s.id === preSelectedId);

                  // FALLBACK
                  const shouldForceList = !sub && !!preSelectedId;
                  const isListView = showOtherSubscriptions || !preSelectedId || shouldForceList;

                  if (!isListView && sub) {
                    const nameParts = sub.name.split('.');
                    const shortName = sub.publicName || (nameParts.length > 1 ? nameParts[nameParts.length - 1].toUpperCase() : sub.name.toUpperCase());

                    // First lesson logic
                    const slotDay = (formData.selectedSlot || '').split(',')[0].trim();
                    const firstLessonDate = getNextOccurrence(slotDay);
                    const formattedFirstLesson = firstLessonDate ? format(parseISO(firstLessonDate), 'EEEE d MMMM') : 'da definire';

                    return (
                      <div className="space-y-10">
                        {/* HERO AMBER BOX */}
                        <div className="bg-amber-400 border-4 border-amber-500 rounded-[40px] p-10 shadow-2xl relative overflow-hidden transform hover:scale-[1.02] transition-transform duration-500">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 -mr-32 -mt-32 rounded-full"></div>

                          <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10 text-center md:text-left">
                            <div className="space-y-6 flex-1">
                              <span className="bg-white/30 text-gray-900 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em]">Selezione Confermata</span>
                              <h3 className="text-5xl font-black text-gray-900 leading-none break-words uppercase">{shortName}</h3>
                              {selectedBundleSlots.length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                  {selectedBundleSlots.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/40 uppercase text-gray-900">{s.type}</span>
                                      <span className="font-bold text-gray-900/80 text-sm">{s.startTime} – {s.endTime}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="space-y-2">
                                <p className="text-gray-900/80 font-bold text-xl uppercase tracking-tight">Prima Lezione Utile:</p>
                                <p className="text-3xl font-black text-gray-900 capitalize">{formattedFirstLesson}</p>
                              </div>
                            </div>

                            <div className="flex flex-col items-center justify-center bg-white p-8 rounded-[32px] shadow-xl min-w-[200px]">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Prezzo Totale</p>
                              <div className="text-center">
                                <p className="text-6xl font-black text-gray-900 leading-none">
                                  {sub.price >= 77 ? sub.price + 2 : sub.price}€
                                </p>
                                {sub.price >= 77 && (
                                  <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-tighter italic">
                                    Include 2€ bollo virtuale
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* SECONDARY CHANGE BUTTON */}
                        <div className="flex justify-center">
                          <button
                            onClick={() => setShowOtherSubscriptions(true)}
                            className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest hover:text-indigo-800 transition-colors bg-white px-8 py-4 rounded-2xl border-2 border-dashed border-indigo-100 hover:border-indigo-300 shadow-sm"
                          >
                            <Sparkles className="w-5 h-5" /> Vedi altri Abbonamenti o Cambia Idea
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // LIST VIEW (Selezione manuale o Fallback)
                  return (
                    <div className="space-y-6 animate-slide-up">
                      <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">
                          {shouldForceList ? 'Abbonamento precedente non disponibile. Scegline uno nuovo:' : 'Seleziona un Abbonamento:'}
                        </h3>
                        {showOtherSubscriptions && preSelectedId && (
                          <button
                            onClick={() => setShowOtherSubscriptions(false)}
                            className="text-[10px] font-bold text-indigo-600 hover:underline uppercase self-start"
                          >
                            ← Torna alla selezione originale
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(() => {
                          const ageStr = String(formData.childAge || '');
                          const ageMatch = ageStr.match(/\d+/);
                          const ageNum = ageMatch ? parseInt(ageMatch[0]) : 0;

                          const isKid = ageNum > 0 && ageNum < 18;
                          const slotStr = String(formData.selectedSlot || '');
                          const dayName = slotStr.split(',')[0].trim().split(' ')[0].trim();
                          const daysMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
                          const dayIndex = daysMap.findIndex(d => d.toLowerCase() === (dayName || '').toLowerCase());

                          // 1. Primo tentativo: Filtro completo
                          let filtered = subscriptionTypes.filter(sub => {
                            if (sub.statusConfig?.status !== 'active' || sub.isPubliclyVisible === false) return false;
                            if (sub.target === 'kid' && !isKid && ageNum > 0) return false;
                            if (sub.target === 'adult' && isKid) return false;
                            if (dayIndex !== -1 && sub.allowedDays && sub.allowedDays.length > 0) {
                              if (!sub.allowedDays.includes(dayIndex)) return false;
                            }
                            return true;
                          });

                          // 2. Secondo tentativo: Fallback
                          if (filtered.length === 0) {
                            filtered = subscriptionTypes.filter(sub => {
                              if (sub.statusConfig?.status !== 'active' || sub.isPubliclyVisible === false) return false;
                              if (sub.target === 'kid' && !isKid && ageNum > 0) return false;
                              if (sub.target === 'adult' && isKid) return false;
                              return true;
                            });
                          }

                          // 3. Terzo tentativo: Emergenza
                          if (filtered.length === 0) {
                            filtered = subscriptionTypes.filter(sub => sub.statusConfig?.status === 'active');
                          }

                          if (filtered.length === 0) {
                            return (
                              <div className="col-span-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-8 text-center">
                                <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500 font-medium">Nessun abbonamento disponibile. Contatta la segreteria.</p>
                              </div>
                            );
                          }

                          return filtered.map(sub => {
                            const nameParts = sub.name.split('.');
                            const shortName = sub.publicName || (nameParts.length > 1 ? nameParts[nameParts.length - 1].toUpperCase() : sub.name.toUpperCase());
                            const isSelected = formData.selectedSubscriptionId === sub.id;

                            // LOGICA MESI E BOLLO
                            const monthsCount = Math.round(sub.durationInDays / 30);
                            const labelMesi = monthsCount === 1 ? '1 MESE' : `${monthsCount} MESI`;
                            const needsStamp = sub.price >= 77;
                            const totalPrice = needsStamp ? sub.price + 2 : sub.price;

                            return (
                              <button
                                key={sub.id}
                                onClick={() => {
                                  setFormData({ ...formData, selectedSubscriptionId: sub.id });
                                  setShowOtherSubscriptions(false);
                                }}
                                className={`relative w-full p-6 rounded-3xl border-2 text-left transition-all flex flex-col justify-between group ${isSelected ? 'border-blue-900 bg-blue-50 ring-4 ring-blue-900/10' : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-lg'}`}
                              >
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start">
                                    <h3 className={`font-black text-xl tracking-tight leading-tight ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                      {shortName}
                                    </h3>
                                    <div className="text-right">
                                      <span className="bg-amber-400 text-gray-900 px-3 py-1 rounded-lg text-lg font-black shadow-sm group-hover:scale-110 transition-transform block">
                                        {totalPrice}€
                                      </span>
                                      {needsStamp && (
                                        <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-tighter leading-none">
                                          Listino {sub.price}€ + 2€ bollo
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-500 font-bold uppercase tracking-tighter">
                                    {sub.lessons} lezioni • Validità {labelMesi}
                                  </p>
                                </div>
                                <div className="mt-6 flex justify-between items-end w-full">
                                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                                    {sub.target === 'kid' ? 'Bambini' : 'Adulti'}
                                  </span>
                                  {isSelected && <CheckCircle className="w-5 h-5 text-blue-900" />}
                                </div>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* STEP 4: RIEPILOGO E AZIONE */}
            {step === 4 && (
              <div className="space-y-8 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-widest">Riepilogo Finale</h2>
                </div>

                <div className="bg-gray-50 rounded-[32px] p-8 space-y-6 border border-gray-100 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sede</span>
                      <p className="font-bold text-lg text-gray-800">{formData.selectedLocationName}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Giorno e Orario</span>
                      {selectedBundleSlots.length > 0 ? (
                        <div className="space-y-1">
                          {selectedBundleSlots.map((s, i) => (
                            <p key={i} className="font-bold text-gray-800 flex items-center gap-2">
                              <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-black uppercase">{s.type}</span>
                              {s.startTime} – {s.endTime}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="font-bold text-lg text-gray-800">{formData.selectedSlot}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Abbonamento Scelto</span>
                      <p className="font-bold text-lg text-blue-900 uppercase">
                        {subscriptionTypes.find(s => s.id === formData.selectedSubscriptionId)?.name.split('.').pop() || 'Abbonamento'}
                      </p>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                        {(() => {
                          const sub = subscriptionTypes.find(s => s.id === formData.selectedSubscriptionId);
                          if (!sub) return '';
                          const months = Math.round(sub.durationInDays / 30);
                          return `${sub.lessons} lezioni • ${months === 1 ? '1 MESE' : `${months} MESI`}`;
                        })()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data Prima Lezione</span>
                      <p className="font-bold text-lg text-amber-600 capitalize">
                        {(() => {
                          const slotDay = (formData.selectedSlot || '').split(',')[0].trim();
                          const firstLessonDate = getNextOccurrence(slotDay);
                          return firstLessonDate ? format(parseISO(firstLessonDate), 'EEEE d MMMM') : 'da definire';
                        })()}
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-200 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-400 uppercase tracking-widest leading-none">Totale da pagare</span>
                      {(() => {
                        const basePrice = subscriptionTypes.find(s => s.id === formData.selectedSubscriptionId)?.price || 0;
                        if (basePrice >= 77) {
                          return <span className="text-[10px] font-bold text-amber-600 uppercase mt-1">Include 2€ bollo virtuale</span>;
                        }
                        return null;
                      })()}
                    </div>
                    <span className="text-5xl font-black text-gray-900">
                      {(() => {
                        const basePrice = subscriptionTypes.find(s => s.id === formData.selectedSubscriptionId)?.price || 0;
                        const totalPrice = basePrice >= 77 ? basePrice + 2 : basePrice;
                        return `${totalPrice}€`;
                      })()}
                    </span>
                  </div>
                </div>

                {/* HIGH VISIBILITY RED ALERT */}
                <div className="bg-red-50 border-2 border-red-500 rounded-[32px] p-8 shadow-lg flex gap-6 items-start animate-pulse-subtle">
                  <div className="w-12 h-12 bg-red-500 text-white rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-red-600 font-black uppercase tracking-widest text-sm">Regolamento Assenze</h3>
                    <p className="text-sm text-red-800 leading-relaxed font-bold">
                      Le lezioni perse <span className="underline">NON sono recuperabili</span> e <span className="underline">NON sono previsti rimborsi</span> sulle quote pagate.
                      L'iscrizione impegna il posto per l'intera durata dell'abbonamento.
                    </p>
                  </div>
                </div>

                {/* STEP 4 ACTION */}
                <div className="pt-4">
                  <button
                    onClick={() => setShowBookingModal(true)}
                    disabled={isProcessing}
                    className="w-full bg-indigo-600 text-white font-black py-6 rounded-[32px] shadow-2xl hover:bg-indigo-700 transition-all uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 animate-pulse-subtle"
                  >
                    Ok, procedo all'iscrizione <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            {step < 4 && (
              <div className="mt-12 flex justify-between items-center">
                {step > 1 ? (
                  <button onClick={handleBack} className="flex items-center gap-2 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-[10px] tracking-widest">
                    <ChevronLeft className="w-4 h-4" /> Indietro
                  </button>
                ) : <div></div>}

                <button
                  onClick={handleNext}
                  disabled={
                    (step === 1 && (!formData.parentFirstName || !formData.parentLastName || !formData.parentFiscalCode)) ||
                    (step === 2 && (!formData.selectedLocationId || !formData.selectedSlot)) ||
                    (step === 3 && !formData.selectedSubscriptionId)
                  }
                  className="bg-gray-900 text-white px-10 py-4 rounded-2xl font-black flex items-center gap-2 shadow-lg hover:bg-gray-800 transition-all disabled:opacity-20 uppercase text-xs tracking-widest"
                >
                  Avanti <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* UNIFIED PAYMENT MODAL (Step 13) */}
      {showBookingModal && (
        <Modal onClose={() => !isProcessing && setShowBookingModal(false)} size="lg">
          <div className="max-h-[85vh] overflow-y-auto p-6 md:p-12 space-y-8 scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="text-center space-y-2 sticky top-0 bg-white z-10 pb-4 border-b border-gray-50 -mx-6 md:-mx-12 px-6 md:px-12">
              <h3 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tight">Metodo di Pagamento</h3>
              <p className="text-xs md:text-sm text-gray-500 font-medium">Seleziona come desideri saldare l'iscrizione</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Option 1: Cash */}
              <button
                onClick={() => handleProcessEnrollment('Cash')}
                disabled={isProcessing}
                className="group flex items-center justify-between p-6 bg-white border-2 border-gray-100 rounded-[32px] hover:border-amber-400 hover:bg-amber-50 transition-all text-left shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center group-hover:bg-amber-400 group-hover:text-white transition-colors">
                    <BanknotesIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 uppercase text-sm tracking-widest">Pago in contanti</h4>
                    <p className="text-xs text-gray-500 font-medium mt-1">Saldatura direttamente in sede alla prima lezione</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-gray-300 group-hover:text-amber-500 transition-colors" />
              </button>

              {/* Option 2: Bank Transfer */}
              <button
                onClick={() => setFormData({ ...formData, paymentMethod: PaymentMethod.BankTransfer })}
                disabled={isProcessing}
                className={`group flex flex-col p-6 bg-white border-2 rounded-[32px] transition-all text-left shadow-sm hover:shadow-md ${formData.paymentMethod === PaymentMethod.BankTransfer ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100 hover:border-indigo-200'}`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${formData.paymentMethod === PaymentMethod.BankTransfer ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                      <Info className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 uppercase text-sm tracking-widest">Pago con bonifico</h4>
                      <p className="text-xs text-gray-500 font-medium mt-1">Esegui il bonifico ora tramite la tua app bancaria</p>
                    </div>
                  </div>
                  {formData.paymentMethod === PaymentMethod.BankTransfer && <CheckCircle className="w-6 h-6 text-indigo-600" />}
                </div>

                {formData.paymentMethod === PaymentMethod.BankTransfer && (
                  <div className="mt-8 space-y-6 animate-fade-in border-t border-indigo-200 pt-6">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">IBAN per il bonifico</p>
                      <div className="bg-white p-4 rounded-2xl flex justify-between items-center border border-indigo-100">
                        <p className="font-mono text-base md:text-lg font-bold text-gray-800 tracking-wider">
                          IT68G36772223000EM001966427
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText('IT68G36772223000EM001966427'); alert("IBAN copiato!"); }}
                          className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-600"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 text-center bg-amber-400/10 p-4 rounded-2xl border border-amber-400/20">
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em]">Causale Obbligatoria</p>
                      <p className="font-black text-gray-900 text-xs">
                        ISCRIZIONE {formData.childName.toUpperCase()} - {formData.selectedLocationName.toUpperCase()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleProcessEnrollment(PaymentMethod.BankTransfer); }}
                      className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs"
                    >
                      Ho effettuato il bonifico
                    </button>
                  </div>
                )}
              </button>

              {/* Option 3: PayPal */}
              <button
                onClick={() => handleProcessEnrollment(PaymentMethod.PayPal)}
                disabled={isProcessing}
                className="group flex items-center justify-between p-6 bg-white border-2 border-gray-100 rounded-[32px] hover:border-blue-500 hover:bg-blue-50 transition-all text-left shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-[#0070BA]/10 text-[#0070BA] rounded-2xl flex items-center justify-center group-hover:bg-[#0070BA] group-hover:text-white transition-colors">
                    <ExternalLink className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 uppercase text-sm tracking-widest">Paga con PayPal</h4>
                    <p className="text-xs text-gray-500 font-medium mt-1">Reindirizzamento immediato al pagamento online</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-gray-300 group-hover:text-blue-500 transition-colors" />
              </button>
            </div>

            <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              Tutte le transazioni sono sicure e crittografate
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EnrollmentPortal;
