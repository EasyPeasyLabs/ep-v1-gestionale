
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
import ChecklistIcon from '../components/icons/ChecklistIcon';
import FinanceIcon from '../components/icons/FinanceIcon';
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
          getNotifications()
        ]);
        
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
    <div className="space-y-8">
      <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="mt-1 text-gray-500">Benvenuta, Ilaria! Ecco una panoramica.</p>
          </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner />
        </div>
      ) : (
        <>
          {/* ROW 1: Premium Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
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

          {/* ROW 2: 3 Columns - Calendar | Saturation | Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
            
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

            {/* COL 3: Avvisi */}
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
        </>
      )}
    </div>
  );
};

export default Dashboard;
