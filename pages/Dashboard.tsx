
import React, { useEffect, useState, useMemo } from 'react';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getLessons } from '../services/calendarService'; 
import { getTransactions } from '../services/financeService';
import { getNotifications } from '../services/notificationService';
import { EnrollmentStatus, Notification, ClientType, ParentClient } from '../types';
import Spinner from '../components/Spinner';
import ClockIcon from '../components/icons/ClockIcon';
import ExclamationIcon from '../components/icons/ExclamationIcon';
import ChecklistIcon from '../components/icons/ChecklistIcon';
import { Page } from '../App';
import ClientsIcon from '../components/icons/ClientsIcon';
import SuppliersIcon from '../components/icons/SuppliersIcon';

// Premium Stat Card 2.0
const StatCard: React.FC<{ 
    title: string; 
    value: string | React.ReactNode; 
    subtext?: string; 
    onClick?: () => void;
    icon: React.ReactNode;
    colorClass?: string; // bg-color + text-color classes for icon bubble
}> = ({ title, value, subtext, onClick, icon, colorClass = 'bg-gray-100 text-gray-600' }) => (
  <div 
    className={`md-card p-6 flex flex-col justify-between h-full relative overflow-hidden ${onClick ? 'cursor-pointer hover:translate-y-[-2px] transition-transform' : ''}`} 
    onClick={onClick}
  >
    <div className="flex justify-between items-start z-10">
        <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
            <div className="text-3xl font-bold mt-3 text-gray-800 tracking-tight">{value}</div>
        </div>
        <div className={`p-3 rounded-xl ${colorClass} shadow-sm`}>
            {icon}
        </div>
    </div>
    {subtext && (
      <div className="text-xs font-medium text-gray-400 mt-4 pt-3 border-t border-gray-50 z-10">
        {subtext}
      </div>
    )}
    {/* Background decoration */}
    <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-5 ${colorClass.split(' ')[0]}`}></div>
  </div>
);

// Rating Card Component
const RatingCard: React.FC<{
    title: string;
    average: number;
    count: number;
    icon: React.ReactNode;
    details: { label: string; value: number }[];
    colorClass: string;
    summary?: string;
}> = ({ title, average, count, icon, details, colorClass, summary }) => (
    <div className="md-card p-6 flex flex-col h-full border-t-4" style={{ borderColor: 'var(--md-divider)' }}>
        <div className="flex justify-between items-start mb-4">
            <div>
                <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                <p className="text-xs text-gray-500">{count} valutazioni</p>
            </div>
            <div className={`p-2 rounded-lg ${colorClass} opacity-80`}>
                {icon}
            </div>
        </div>
        
        <div className="flex items-baseline gap-2 mb-6">
            <span className="text-4xl font-bold text-gray-900">{average.toFixed(1)}</span>
            <span className="text-sm text-gray-400">/ 5.0</span>
            <div className="flex ml-2">
                {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className={`w-4 h-4 ${star <= Math.round(average) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                ))}
            </div>
        </div>

        <div className="space-y-3 flex-1">
            {details.map((d, idx) => (
                <div key={idx}>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 font-medium">{d.label}</span>
                        <span className="font-bold text-gray-800">{d.value.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div 
                            className="h-1.5 rounded-full transition-all duration-500" 
                            style={{ 
                                width: `${(d.value / 5) * 100}%`,
                                backgroundColor: d.value >= 4 ? '#4ade80' : d.value >= 2.5 ? '#facc15' : '#f87171'
                            }}
                        ></div>
                    </div>
                </div>
            ))}
        </div>

        {summary && (
            <div className="mt-5 pt-3 border-t border-gray-100 text-center">
                <p className="text-sm font-medium italic text-gray-500">"{summary}"</p>
            </div>
        )}
    </div>
);

interface LocationOccupancy {
    key: string;
    locationName: string;
    dayName: string;
    dayIndex: number;
    startTime: string;
    endTime: string;
    color: string;
    capacity: number;
    occupied: number;
    occupancyPercent: number;
}

interface DashboardProps {
    setCurrentPage?: (page: Page) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setCurrentPage }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'ratings'>('overview');
  const [loading, setLoading] = useState(true);
  const [clientsData, setClientsData] = useState<any[]>([]);
  const [suppliersData, setSuppliersData] = useState<any[]>([]);
  
  const [clientCount, setClientCount] = useState(0);
  const [activeClientCount, setActiveClientCount] = useState(0);
  const [supplierCount, setSupplierCount] = useState(0);
  const [activeSupplierCount, setActiveSupplierCount] = useState(0);
  const [lessonsThisMonth, setLessonsThisMonth] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Top 5 Tab State
  const [top5Tab, setTop5Tab] = useState<'clients' | 'suppliers'>('clients');
  
  // Weekly Calendar Data
  const [weekDays, setWeekDays] = useState<{date: Date, count: number, dayName: string}[]>([]);
  
  // Occupazione Sedi Dettagliata
  const [locationOccupancy, setLocationOccupancy] = useState<LocationOccupancy[]>([]);

  const daysMap = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [clients, suppliers, enrollments, manualLessons, transactions, notifs] = await Promise.all([
          getClients(),
          getSuppliers(),
          getAllEnrollments(),
          getLessons(),
          getTransactions(),
          getNotifications()
        ]);
        
        setClientsData(clients);
        setSuppliersData(suppliers);
        setClientCount(clients.length);
        setSupplierCount(suppliers.length);
        setNotifications(notifs);

        // 1. Calcolo Clienti e Fornitori Attivi
        const activeOrPendingEnrollments = enrollments.filter(e => e.status === EnrollmentStatus.Active || e.status === EnrollmentStatus.Pending);
        
        const activeClientIds = new Set(activeOrPendingEnrollments.map(e => e.clientId));
        setActiveClientCount(activeClientIds.size);

        const activeSupplierIds = new Set(activeOrPendingEnrollments.map(e => e.supplierId));
        setActiveSupplierCount(activeSupplierIds.size);

        // 2. Calcolo Lezioni Erogate (Mese Corrente)
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        let lessonsCount = 0;
        enrollments.filter(e => e.status === EnrollmentStatus.Active).forEach(enr => {
            if(enr.appointments) {
                enr.appointments.forEach(app => {
                    const d = new Date(app.date);
                    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                        lessonsCount++;
                    }
                });
            }
        });
        manualLessons.forEach(ml => {
            const d = new Date(ml.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                lessonsCount++;
            }
        });
        setLessonsThisMonth(lessonsCount);

        // 3. Calcolo Occupazione Dettagliata (Saturazione)
        const slotsMap: Record<string, LocationOccupancy> = {};

        suppliers.forEach(s => {
            s.locations.forEach(l => {
                if(l.availability && l.availability.length > 0) {
                    l.availability.forEach(slot => {
                        const key = `${l.id}-${slot.dayOfWeek}-${slot.startTime}`;
                        slotsMap[key] = {
                            key,
                            locationName: l.name,
                            dayIndex: slot.dayOfWeek,
                            dayName: daysMap[slot.dayOfWeek].substring(0, 3), 
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                            color: l.color || '#ccc',
                            capacity: l.capacity || 0,
                            occupied: 0,
                            occupancyPercent: 0
                        };
                    });
                }
            });
        });

        activeOrPendingEnrollments.forEach(enr => {
            if(enr.appointments && enr.appointments.length > 0) {
                const firstApp = enr.appointments[0];
                const firstDate = new Date(firstApp.date);
                const dayOfWeek = firstDate.getDay();
                const startTime = firstApp.startTime;
                
                const key = `${enr.locationId}-${dayOfWeek}-${startTime}`;
                
                if(slotsMap[key]) {
                    slotsMap[key].occupied += 1;
                }
            }
        });

        const occupancyList = Object.values(slotsMap).map(slot => {
            const percent = slot.capacity > 0 ? Math.round((slot.occupied / slot.capacity) * 100) : 0;
            return { ...slot, occupancyPercent: percent };
        });

        occupancyList.sort((a, b) => {
            const dayA = a.dayIndex === 0 ? 7 : a.dayIndex;
            const dayB = b.dayIndex === 0 ? 7 : b.dayIndex;
            if (dayA !== dayB) return dayA - dayB;
            if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
            return a.locationName.localeCompare(b.locationName);
        });

        setLocationOccupancy(occupancyList);


        // 4. Calendario Settimanale
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); 
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0,0,0,0);

        const daysData = [];
        const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

        for(let i=0; i<7; i++) {
            const currentDay = new Date(startOfWeek);
            currentDay.setDate(startOfWeek.getDate() + i);
            
            let dayLessonCount = 0;
            
            activeOrPendingEnrollments.forEach(enr => {
                if(enr.appointments) {
                    enr.appointments.forEach(app => {
                         if(new Date(app.date).toDateString() === currentDay.toDateString()) {
                             dayLessonCount++;
                         }
                    });
                }
            });
            
            manualLessons.forEach(ml => {
                if(new Date(ml.date).toDateString() === currentDay.toDateString()) {
                    dayLessonCount++;
                }
            });

            daysData.push({
                date: currentDay,
                count: dayLessonCount,
                dayName: dayNames[i]
            });
        }
        setWeekDays(daysData);

      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    
    const handleDataUpdate = () => {
        fetchData();
    };
    window.addEventListener('EP_DataUpdated', handleDataUpdate);
    return () => window.removeEventListener('EP_DataUpdated', handleDataUpdate);
  }, []);

  // --- Rating Calculations ---
  const ratings = useMemo(() => {
      // Parents
      let pCount = 0;
      let pSums = { availability: 0, complaints: 0, churnRate: 0, distance: 0 };
      
      // Children
      let cCount = 0;
      let cSums = { learning: 0, behavior: 0, attendance: 0, hygiene: 0 };

      // Suppliers
      let sCount = 0;
      let sSums = { responsiveness: 0, partnership: 0, negotiation: 0 };

      // Locations
      let lCount = 0;
      let lSums = { cost: 0, distance: 0, parking: 0, availability: 0, safety: 0, environment: 0, distractions: 0, modifiability: 0, prestige: 0 };

      clientsData.forEach(client => {
          if (client.clientType === ClientType.Parent) {
              const p = client as ParentClient;
              if (p.rating && (p.rating.availability + p.rating.complaints > 0)) {
                  pCount++;
                  pSums.availability += p.rating.availability;
                  pSums.complaints += p.rating.complaints;
                  pSums.churnRate += p.rating.churnRate;
                  pSums.distance += p.rating.distance;
              }
              
              if (p.children) {
                  p.children.forEach(child => {
                      if (child.rating && (child.rating.learning + child.rating.behavior > 0)) {
                          cCount++;
                          cSums.learning += child.rating.learning;
                          cSums.behavior += child.rating.behavior;
                          cSums.attendance += child.rating.attendance;
                          cSums.hygiene += child.rating.hygiene;
                      }
                  });
              }
          }
      });

      suppliersData.forEach(supplier => {
          if (supplier.rating && (supplier.rating.responsiveness + supplier.rating.partnership > 0)) {
              sCount++;
              sSums.responsiveness += supplier.rating.responsiveness;
              sSums.partnership += supplier.rating.partnership;
              sSums.negotiation += supplier.rating.negotiation;
          }
          if (supplier.locations) {
              supplier.locations.forEach((loc: any) => {
                  if (loc.rating && (loc.rating.cost + loc.rating.safety > 0)) {
                      lCount++;
                      lSums.cost += loc.rating.cost;
                      lSums.distance += loc.rating.distance;
                      lSums.parking += loc.rating.parking;
                      lSums.availability += loc.rating.availability;
                      lSums.safety += loc.rating.safety;
                      lSums.environment += loc.rating.environment;
                      lSums.distractions += loc.rating.distractions;
                      lSums.modifiability += loc.rating.modifiability;
                      lSums.prestige += loc.rating.prestige;
                  }
              });
          }
      });

      // Averages
      const pAvg = pCount > 0 ? (pSums.availability + pSums.complaints + pSums.churnRate + pSums.distance) / (pCount * 4) : 0;
      const cAvg = cCount > 0 ? (cSums.learning + cSums.behavior + cSums.attendance + cSums.hygiene) / (cCount * 4) : 0;
      const sAvg = sCount > 0 ? (sSums.responsiveness + sSums.partnership + sSums.negotiation) / (sCount * 3) : 0;
      const lAvg = lCount > 0 ? Object.values(lSums).reduce((a, b) => a + b, 0) / (lCount * 9) : 0;

      // Summaries Logic
      let pSummary = "";
      if (pCount > 0) {
          const avgComplaints = pSums.complaints / pCount;
          const avgChurn = pSums.churnRate / pCount;
          if (avgComplaints < 3) pSummary = "Genitori esigenti, gestire con cura.";
          else if (avgChurn > 4) pSummary = "Clientela altamente fidelizzata.";
          else pSummary = "Rapporto con i genitori stabile.";
      }

      let cSummary = "";
      if (cCount > 0) {
          const avgLearning = cSums.learning / cCount;
          const avgAttendance = cSums.attendance / cCount;
          const avgBehavior = cSums.behavior / cCount;
          
          if (avgLearning > 3.5 && avgAttendance < 3) cSummary = "Bravi ma con troppe assenze.";
          else if (avgBehavior < 3) cSummary = "Richiesta attenzione disciplinare.";
          else if (avgLearning > 4) cSummary = "Gruppo allievi eccellente.";
          else cSummary = "Classe con buon potenziale.";
      }

      let sSummary = "";
      if (sCount > 0) {
          const avgNegotiation = sSums.negotiation / sCount;
          const avgResponse = sSums.responsiveness / sCount;
          
          if (avgNegotiation < 2.5) sSummary = "Prezzi rigidi, poco trattabili.";
          else if (avgResponse > 4) sSummary = "Partner strategici e reattivi.";
          else sSummary = "Fornitori affidabili.";
      }

      let lSummary = "";
      if (lCount > 0) {
          const avgEnv = lSums.environment / lCount;
          const avgCost = lSums.cost / lCount; // 1=Expensive, 5=Cheap
          
          if (avgEnv > 3.5 && avgCost < 2.5) lSummary = "Sedi belle ma costose.";
          else if (avgCost > 4) lSummary = "Sedi molto economiche.";
          else if (avgEnv < 3) lSummary = "Ambienti da migliorare.";
          else lSummary = "Location adeguate alle attività.";
      }

      return {
          parents: {
              avg: pAvg,
              count: pCount,
              details: [
                  { label: 'Disponibilità variazioni', value: pCount ? pSums.availability / pCount : 0 },
                  { label: 'Atteggiamento', value: pCount ? pSums.complaints / pCount : 0 },
                  { label: 'Costanza Iscrizioni', value: pCount ? pSums.churnRate / pCount : 0 },
                  { label: 'Mobilità', value: pCount ? pSums.distance / pCount : 0 },
              ],
              summary: pSummary
          },
          children: {
              avg: cAvg,
              count: cCount,
              details: [
                  { label: 'Apprendimento', value: cCount ? cSums.learning / cCount : 0 },
                  { label: 'Condotta', value: cCount ? cSums.behavior / cCount : 0 },
                  { label: 'Assenze', value: cCount ? cSums.attendance / cCount : 0 },
                  { label: 'Igiene/Salute', value: cCount ? cSums.hygiene / cCount : 0 },
              ],
              summary: cSummary
          },
          suppliers: {
              avg: sAvg,
              count: sCount,
              details: [
                  { label: 'Reattività', value: sCount ? sSums.responsiveness / sCount : 0 },
                  { label: 'Partnership', value: sCount ? sSums.partnership / sCount : 0 },
                  { label: 'Flessibilità', value: sCount ? sSums.negotiation / sCount : 0 },
              ],
              summary: sSummary
          },
          locations: {
              avg: lAvg,
              count: lCount,
              details: [
                  { label: 'Economicità', value: lCount ? lSums.cost / lCount : 0 },
                  { label: 'Sicurezza (Norma)', value: lCount ? lSums.safety / lCount : 0 },
                  { label: 'Ambiente/Luce', value: lCount ? lSums.environment / lCount : 0 },
                  { label: 'Disponibilità Slot', value: lCount ? lSums.availability / lCount : 0 },
                  { label: 'Vicinanza', value: lCount ? lSums.distance / lCount : 0 },
              ],
              summary: lSummary
          }
      };
  }, [clientsData, suppliersData]);

  // --- Top 5 Calculation ---
  const topFiveData = useMemo(() => {
      // Parents
      const parents = clientsData
          .filter(c => c.clientType === ClientType.Parent)
          .map(c => {
              const p = c as ParentClient;
              const r = p.rating || { availability: 0, complaints: 0, churnRate: 0, distance: 0 };
              const avg = (r.availability + r.complaints + r.churnRate + r.distance) / 4;
              return { id: p.id, name: `${p.firstName} ${p.lastName}`, score: avg };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

      // Suppliers
      const suppliers = suppliersData
          .map(s => {
              const r = s.rating || { responsiveness: 0, partnership: 0, negotiation: 0 };
              const avg = (r.responsiveness + r.partnership + r.negotiation) / 3;
              return { id: s.id, name: s.companyName, score: avg };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

      return { parents, suppliers };
  }, [clientsData, suppliersData]);

  const getNotificationIcon = (type: Notification['type']) => {
      switch (type) {
          case 'expiry': return <span className="text-amber-500"><ClockIcon /></span>;
          case 'low_lessons': return <span className="text-indigo-500"><ExclamationIcon /></span>;
          case 'payment_required': return <span className="text-red-500"><ExclamationIcon /></span>;
          case 'action_required': return <span className="text-blue-500"><ChecklistIcon /></span>;
          default: return <span className="text-gray-500"><ClockIcon /></span>;
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="mt-1 text-gray-500">Benvenuta, Ilaria! Ecco una panoramica.</p>
          </div>
          
          <div className="bg-white rounded-lg p-1 flex border border-gray-200 shadow-sm">
              <button 
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'overview' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Panoramica
              </button>
              <button 
                onClick={() => setActiveTab('ratings')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'ratings' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Qualità & Rating
              </button>
          </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner />
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
              <div className="animate-fade-in space-y-6">
                {/* ROW 1: Premium Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                        title="Clienti" 
                        onClick={() => setCurrentPage && setCurrentPage('Enrollments')}
                        subtext="Gestisci Iscrizioni"
                        value={
                            <div className="flex items-baseline gap-2">
                                <span>{clientCount}</span>
                                {activeClientCount > 0 && (
                                    <span className="text-sm font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-lg">
                                        {activeClientCount} Attivi
                                    </span>
                                )}
                            </div>
                        } 
                        icon={<ClientsIcon />}
                        colorClass="bg-blue-50 text-blue-600"
                    />
                    <StatCard 
                        title="Lezioni (Mese)" 
                        value={lessonsThisMonth}
                        subtext="Totale erogato questo mese"
                        onClick={() => setCurrentPage && setCurrentPage('ActivityLog')}
                        icon={<ChecklistIcon />}
                        colorClass="bg-emerald-50 text-emerald-600"
                    />
                    <StatCard 
                        title="Fornitori" 
                        value={
                            <div className="flex items-baseline gap-2">
                                <span>{supplierCount}</span>
                                {activeSupplierCount > 0 && (
                                    <span className="text-sm font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">
                                        {activeSupplierCount} Attivi
                                    </span>
                                )}
                            </div>
                        } 
                        icon={<SuppliersIcon />}
                        colorClass="bg-indigo-50 text-indigo-600"
                    />
                    <StatCard 
                        title="Azioni Richieste" 
                        value={notifications.length}
                        subtext={notifications.length > 0 ? "Richiedono attenzione" : "Tutto in ordine"}
                        onClick={() => {
                            // Scroll to alerts or open notifs
                        }}
                        icon={<ExclamationIcon />}
                        colorClass={notifications.length > 0 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-400"}
                    />
                </div>

                {/* ROW 2: 4 Columns - Calendar | Saturation | Top 5 | Alerts */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    
                    {/* COL 1: Calendario Settimanale */}
                    <div className="md-card p-6 border-t-4 border-indigo-500">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            Questa Settimana
                        </h2>
                        <div className="flex justify-between items-end h-40 pb-2 px-2">
                            {weekDays.map((day, idx) => {
                                const isToday = new Date().toDateString() === day.date.toDateString();
                                return (
                                    <div key={idx} className="flex flex-col items-center space-y-2 w-full group cursor-default">
                                        <div className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>{day.dayName}</div>
                                        <div className="relative w-full flex justify-center items-end h-28">
                                            <div 
                                                className={`w-3 sm:w-4 rounded-t-full transition-all duration-500 ${isToday ? 'bg-indigo-500 shadow-lg shadow-indigo-200' : 'bg-indigo-100 group-hover:bg-indigo-200'}`}
                                                style={{ height: `${Math.max(10, Math.min((day.count / 8) * 100, 100))}%` }}
                                            ></div>
                                        </div>
                                        <div className={`font-bold text-sm ${isToday ? 'text-indigo-700' : 'text-gray-600'}`}>{day.count}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* COL 2: Saturazione */}
                    <div className="md-card p-6 flex flex-col border-t-4 border-pink-500">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            Saturazione Aule
                        </h2>
                        
                        <div className="flex-1 overflow-y-auto max-h-80 pr-2 space-y-5 custom-scrollbar">
                            {locationOccupancy.map((slot, idx) => (
                                <div key={idx} className="w-full group">
                                    <div className="flex items-center mb-1.5 justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: slot.color }}>
                                                {slot.dayName}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-700">{slot.locationName}</span>
                                                <span className="text-[10px] text-gray-400">{slot.startTime} - {slot.endTime}</span>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold px-2 py-1 rounded bg-gray-50 text-gray-600">
                                            {slot.occupied}/{slot.capacity}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="h-2 rounded-full transition-all duration-1000 ease-out" 
                                            style={{ width: `${slot.occupancyPercent}%`, backgroundColor: slot.color }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                            {locationOccupancy.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                        <p className="text-sm italic">Nessun dato di occupazione.</p>
                                    </div>
                            )}
                        </div>
                    </div>

                    {/* COL 3: Top 5 Ranking */}
                    <div className="md-card p-6 flex flex-col border-t-4 border-yellow-400">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                🏆 Top 5
                            </h2>
                            <div className="flex bg-gray-100 p-0.5 rounded-lg">
                                <button 
                                    onClick={() => setTop5Tab('clients')} 
                                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${top5Tab === 'clients' ? 'bg-white text-yellow-600 shadow-sm' : 'text-gray-400'}`}
                                >
                                    CLIENTI
                                </button>
                                <button 
                                    onClick={() => setTop5Tab('suppliers')} 
                                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${top5Tab === 'suppliers' ? 'bg-white text-yellow-600 shadow-sm' : 'text-gray-400'}`}
                                >
                                    FORNITORI
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto max-h-80 pr-1 custom-scrollbar">
                            <ul className="space-y-2">
                                {(top5Tab === 'clients' ? topFiveData.parents : topFiveData.suppliers).map((item, idx) => (
                                    <li key={item.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-200' : idx === 1 ? 'bg-gray-100 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-transparent text-gray-400'}`}>
                                                {idx + 1}
                                            </span>
                                            <span className="text-sm text-gray-700 font-medium truncate block" title={item.name}>
                                                {item.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 bg-yellow-50 px-1.5 py-0.5 rounded-md border border-yellow-100 shrink-0">
                                            <span className="text-xs font-bold text-yellow-700">{item.score.toFixed(1)}</span>
                                            <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                        </div>
                                    </li>
                                ))}
                                {(top5Tab === 'clients' ? topFiveData.parents : topFiveData.suppliers).length === 0 && (
                                    <li className="text-center text-gray-400 text-xs py-4 italic">
                                        Nessun dato di rating disponibile.
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {/* COL 4: Avvisi */}
                    <div className="md-card p-6 flex flex-col border-t-4 border-amber-500">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            Avvisi & Scadenze
                        </h2>
                        <div className="flex-grow overflow-y-auto max-h-80 custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center">
                                    <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                                        <span className="text-2xl">✨</span>
                                    </div>
                                    <p className="text-sm font-medium text-green-800">Tutto in regola!</p>
                                    <p className="text-xs text-green-600 mt-1">Nessuna scadenza imminente.</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {notifications.map((notif, index) => (
                                        <li 
                                            key={index} 
                                            className="flex items-start space-x-3 p-3 rounded-xl bg-gray-50 hover:bg-white hover:shadow-md transition-all border border-gray-100 cursor-pointer group"
                                            onClick={() => setCurrentPage && notif.linkPage && setCurrentPage(notif.linkPage as Page)}
                                        >
                                            <div className="flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                                                {getNotificationIcon(notif.type)}
                                            </div>
                                            <div className="text-sm text-gray-700 leading-relaxed">
                                                {notif.message}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
              </div>
          )}

          {activeTab === 'ratings' && (
              <div className="animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <RatingCard 
                        title="Genitori"
                        average={ratings.parents.avg}
                        count={ratings.parents.count}
                        icon={<ClientsIcon />}
                        details={ratings.parents.details}
                        colorClass="bg-blue-50 text-blue-600"
                        summary={ratings.parents.summary}
                    />
                    <RatingCard 
                        title="Allievi"
                        average={ratings.children.avg}
                        count={ratings.children.count}
                        icon={<span className="text-2xl">🎓</span>}
                        details={ratings.children.details}
                        colorClass="bg-emerald-50 text-emerald-600"
                        summary={ratings.children.summary}
                    />
                    <RatingCard 
                        title="Fornitori"
                        average={ratings.suppliers.avg}
                        count={ratings.suppliers.count}
                        icon={<SuppliersIcon />}
                        details={ratings.suppliers.details}
                        colorClass="bg-indigo-50 text-indigo-600"
                        summary={ratings.suppliers.summary}
                    />
                    <RatingCard 
                        title="Sedi"
                        average={ratings.locations.avg}
                        count={ratings.locations.count}
                        icon={<span className="text-2xl">🏢</span>}
                        details={ratings.locations.details}
                        colorClass="bg-pink-50 text-pink-600"
                        summary={ratings.locations.summary}
                    />
                </div>
                <div className="text-center text-xs text-gray-400 flex justify-center items-center gap-2">
                    <span className="font-bold">Legenda:</span> 1 Stella = Pessimo / 5 Stelle = Ottimo
                </div>
              </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
