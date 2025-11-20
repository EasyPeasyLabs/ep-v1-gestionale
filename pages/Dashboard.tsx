
import React, { useEffect, useState } from 'react';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getLessons } from '../services/calendarService'; 
import { getTransactions } from '../services/financeService';
import { getNotifications } from '../services/notificationService';
import { EnrollmentStatus, Notification, TransactionType, TransactionStatus } from '../types';
import Spinner from '../components/Spinner';
import ClockIcon from '../components/icons/ClockIcon';
import ExclamationIcon from '../components/icons/ExclamationIcon';
import ChecklistIcon from '../components/icons/ChecklistIcon'; // Per action_required
import FinanceIcon from '../components/icons/FinanceIcon'; // Per payment_required (alternativa)
import { Page } from '../App';

const StatCard: React.FC<{ title: string; value: string | React.ReactNode; subtext?: string; onClick?: () => void }> = ({ title, value, subtext, onClick }) => (
  <div 
    className={`md-card p-6 ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`} 
    onClick={onClick}
  >
    <h3 className="text-sm font-medium" style={{ color: 'var(--md-text-secondary)'}}>{title}</h3>
    <div className="text-3xl font-semibold mt-2" style={{ color: 'var(--md-text-primary)'}}>{value}</div>
    {subtext && (
      <p className="text-sm mt-2 text-gray-500">
        {subtext}
      </p>
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
  const [loading, setLoading] = useState(true);
  const [clientCount, setClientCount] = useState(0);
  const [activeClientCount, setActiveClientCount] = useState(0);
  const [supplierCount, setSupplierCount] = useState(0);
  const [activeSupplierCount, setActiveSupplierCount] = useState(0);
  const [lessonsThisMonth, setLessonsThisMonth] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
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
          getNotifications() // Centralized notifications
        ]);
        
        setClientCount(clients.length);
        setSupplierCount(suppliers.length);
        setNotifications(notifs);

        // 1. Calcolo Clienti e Fornitori Attivi
        // Includiamo sia Active che Pending perchè occupano posti
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
        // Conta lezioni da iscrizioni (solo attive per l'erogazione effettiva)
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
        // Conta lezioni manuali
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
                // Inizializza gli slot disponibili basandosi sulla disponibilità definita
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

        // Calcola occupazione per ogni slot
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
        // In un'app reale rifarebbe il fetch. Qui per semplicità ricarichiamo tutto.
        fetchData();
    };
    window.addEventListener('EP_DataUpdated', handleDataUpdate);
    return () => window.removeEventListener('EP_DataUpdated', handleDataUpdate);
  }, []);

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
    <div>
      <h1 className="text-3xl font-bold" style={{ color: 'var(--md-text-primary)'}}>Dashboard</h1>
      <p className="mt-1" style={{ color: 'var(--md-text-secondary)'}}>Benvenuta, Ilaria! Ecco una panoramica della tua attività.</p>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner />
        </div>
      ) : (
        <>
          {/* ROW 1: Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
            <StatCard 
                title="Clienti" 
                onClick={() => setCurrentPage && setCurrentPage('Enrollments')}
                subtext="Clicca per gestire le iscrizioni"
                value={
                    <div className="flex items-baseline">
                        <span>{clientCount}</span>
                        <span className="ml-3 text-sm font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full relative -top-1">
                            {activeClientCount} Attivi
                        </span>
                    </div>
                } 
            />
            <StatCard 
                title="Lezioni Erogate" 
                value={
                    <div className="flex items-baseline">
                        <span>{lessonsThisMonth}</span>
                        <span className="ml-3 text-sm font-medium text-gray-500 relative -top-1">
                            mese in corso
                        </span>
                    </div>
                } 
            />
            <StatCard 
                title="Fornitori" 
                value={
                    <div className="flex items-baseline">
                        <span>{supplierCount}</span>
                        <span className="ml-3 text-sm font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full relative -top-1">
                            {activeSupplierCount} Attivi
                        </span>
                    </div>
                } 
            />
            <StatCard title="Tasso di Rinnovo" value="N/D" />
          </div>

          {/* ROW 2: 3 Columns - Calendar | Saturation | Alerts */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COL 1: Calendario Settimanale */}
            <div className="md-card p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--md-text-primary)'}}>Calendario Settimanale</h2>
                <div className="flex justify-between items-end h-32 pb-2">
                    {weekDays.map((day, idx) => {
                        const isToday = new Date().toDateString() === day.date.toDateString();
                        return (
                            <div key={idx} className="flex flex-col items-center space-y-2 w-full">
                                <div className={`text-xs font-medium ${isToday ? 'text-indigo-600' : 'text-gray-500'}`}>{day.dayName}</div>
                                <div className="relative w-full flex justify-center items-end h-20">
                                    <div 
                                        className={`w-6 rounded-t-md transition-all duration-500 ${isToday ? 'bg-indigo-50' : 'bg-indigo-200'}`}
                                        style={{ height: `${Math.min((day.count / 10) * 100, 100)}%`, minHeight: day.count > 0 ? '10%' : '4px' }}
                                    ></div>
                                </div>
                                <div className="font-bold text-sm">{day.count}</div>
                            </div>
                        );
                    })}
                </div>
                <p className="text-xs text-center text-gray-400 mt-2">Lezioni per giorno (settimana corrente)</p>
            </div>

            {/* COL 2: Saturazione */}
            <div className="md-card p-6 flex flex-col">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--md-text-primary)'}}>Saturazione</h2>
                
                <div className="flex-1 overflow-y-auto max-h-96 pr-2 space-y-5">
                    {locationOccupancy.map((slot, idx) => (
                        <div key={idx} className="w-full">
                            <div className="flex items-center mb-1">
                                <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: slot.color }}></div>
                                <span className="font-bold text-sm text-gray-700 mr-2">{slot.dayName}</span>
                                <span className="text-xs font-medium text-gray-500 truncate flex-1">{slot.locationName} ({slot.startTime}-{slot.endTime})</span>
                            </div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-lg font-bold" style={{ color: slot.occupancyPercent > 90 ? '#e11d48' : slot.color }}>
                                    {slot.occupancyPercent}%
                                </span>
                                <span className="text-xs font-medium text-gray-500">
                                    {slot.occupied} / {slot.capacity} occupati
                                </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                                <div 
                                    className="h-2 rounded-full transition-all duration-500" 
                                    style={{ width: `${slot.occupancyPercent}%`, backgroundColor: slot.color }}
                                ></div>
                            </div>
                        </div>
                    ))}
                    {locationOccupancy.length === 0 && (
                            <p className="text-xs text-gray-400 italic text-center mt-4">
                                Nessuna disponibilità configurata o nessuna iscrizione.
                            </p>
                    )}
                </div>
            </div>

            {/* COL 3: Avvisi */}
            <div className="md-card p-6 flex flex-col">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--md-text-primary)'}}>Avvisi ({notifications.length})</h2>
                <div className="flex-grow overflow-y-auto max-h-64">
                    {notifications.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                             <p className="text-sm italic" style={{ color: 'var(--md-text-secondary)'}}>Nessuna notifica da leggere.</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {notifications.map((notif, index) => (
                                <li 
                                    key={index} 
                                    className="flex items-start space-x-3 p-2 rounded hover:bg-gray-50 border-b border-gray-100 last:border-0 cursor-pointer"
                                    onClick={() => setCurrentPage && notif.linkPage && setCurrentPage(notif.linkPage as Page)}
                                >
                                    <div className="flex-shrink-0 mt-0.5">
                                        {getNotificationIcon(notif.type)}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                        {notif.message}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
