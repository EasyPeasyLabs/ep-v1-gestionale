
import React, { useEffect, useState, useMemo } from 'react';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getLessons, getSchoolClosures } from '../services/calendarService'; 
import { getTransactions } from '../services/financeService';
import { getNotifications } from '../services/notificationService';
import { getUserPreferences, markFocusAsSeen } from '../services/profileService';
import { auth } from '../firebase/config';
import { EnrollmentStatus, Notification, ClientType, ParentClient, Page, Enrollment, SchoolClosure } from '../types';
import Spinner from '../components/Spinner';
import ClockIcon from '../components/icons/ClockIcon';
import ExclamationIcon from '../components/icons/ExclamationIcon';
import ChecklistIcon from '../components/icons/ChecklistIcon';
import ClientsIcon from '../components/icons/ClientsIcon';
import SuppliersIcon from '../components/icons/SuppliersIcon';
import CalendarIcon from '../components/icons/CalendarIcon';
import FocusModeConfigModal from '../components/FocusModeConfigModal';
import FocusModePopup from '../components/FocusModePopup';
import { getItalianHolidays, toLocalISOString } from '../utils/dateUtils';

const calculateFuelRating = (distance: number) => {
    if (distance <= 5) return 5;
    if (distance <= 15) return 4;
    if (distance <= 30) return 3;
    if (distance <= 60) return 2;
    return 1;
};

// Use imported utility instead of redefining to ensure consistency
// const toLocalISOString = (date: Date) => { ... } // Removed redundant definition

const StatCard: React.FC<{ 
    title: string; 
    value: string | React.ReactNode; 
    valueLabel?: string; 
    subtext?: React.ReactNode; 
    onClick?: () => void;
    icon: React.ReactNode;
    isAlert?: boolean;
    headerAction?: React.ReactNode; 
}> = ({ title, value, valueLabel, subtext, onClick, icon, isAlert, headerAction }) => (
  <div 
    className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-4 h-full relative overflow-hidden group ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} 
    onClick={onClick}
  >
    <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-110 shadow-sm
            ${isAlert ? 'bg-amber-400 text-gray-900' : 'bg-indigo-500 text-white'}`}>
            {icon}
        </div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight flex-1">
            {title}
        </p>
        {headerAction && (
            <div onClick={e => e.stopPropagation()}>
                {headerAction}
            </div>
        )}
    </div>
    
    <div className="flex-1 min-w-0 z-10 flex flex-col justify-center">
        <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-black text-gray-900 leading-none">{value}</span>
            {valueLabel && <span className="text-[10px] font-bold text-gray-400 italic">{valueLabel}</span>}
        </div>
        {subtext && (
            <div className={`text-[11px] mt-2 font-bold leading-snug border-t border-gray-50 pt-2 ${isAlert ? 'text-amber-600' : 'text-gray-500'}`}>
                {subtext}
            </div>
        )}
    </div>
  </div>
);

const RatingCard: React.FC<{
    title: string;
    average: number;
    count: number;
    icon: React.ReactNode;
    details: { label: string; value: number }[];
    summary?: string;
}> = ({ title, average, count, icon, details, summary }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                <p className="text-xs text-gray-400">{count} valutazioni</p>
            </div>
            <div className={`p-3 rounded-xl bg-gray-100 text-gray-600`}>
                {icon}
            </div>
        </div>
        
        <div className="flex items-baseline gap-2 mb-6">
            <span className="text-4xl font-bold text-gray-900">{average.toFixed(1)}</span>
            <span className="text-sm text-gray-400">/ 5.0</span>
            <div className="flex ml-2">
                {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className={`w-4 h-4 ${star <= Math.round(average) ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                ))}
            </div>
        </div>

        <div className="space-y-4 flex-1">
            {details.map((d, idx) => (
                <div key={idx}>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500 font-medium">{d.label}</span>
                        <span className="font-bold text-gray-700">{d.value.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                        <div 
                            className="h-2 rounded-full transition-all duration-500" 
                            style={{ 
                                width: `${(d.value / 5) * 100}%`,
                                backgroundColor: d.value >= 4 ? '#10B981' : d.value >= 2.5 ? '#FBBF24' : '#F87171'
                            }}
                        ></div>
                    </div>
                </div>
            ))}
        </div>

        {summary && (
            <div className="mt-6 pt-4 border-t border-gray-100 text-center">
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
    locationAverage: number;
    locationAveragePercent: number;
}

interface DashboardProps {
    setCurrentPage?: (page: Page, params?: any) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setCurrentPage }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'ratings'>('overview');
  const [loading, setLoading] = useState(true);
  
  const [clientsData, setClientsData] = useState<any[]>([]);
  const [suppliersData, setSuppliersData] = useState<any[]>([]);
  const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([]);
  const [manualLessonsData, setManualLessonsData] = useState<any[]>([]);
  const [schoolClosures, setSchoolClosures] = useState<SchoolClosure[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const [top5Tab, setTop5Tab] = useState<'clients' | 'suppliers'>('clients');
  const [weekDays, setWeekDays] = useState<{date: Date, count: number, dayName: string}[]>([]);
  const [saturationYear, setSaturationYear] = useState<number>(new Date().getFullYear());

  const [isFocusConfigOpen, setIsFocusConfigOpen] = useState(false);
  const [showFocusPopup, setShowFocusPopup] = useState(false);

  const daysMap = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];

  // Compute holidays for the current year once
  const holidaysMap = useMemo(() => getItalianHolidays(new Date().getFullYear()), []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [clients, suppliers, enrollments, manualLessons, transactions, notifs, closures] = await Promise.all([
          getClients(),
          getSuppliers(),
          getAllEnrollments(),
          getLessons(),
          getTransactions(),
          getNotifications(),
          getSchoolClosures()
        ]);
        
        setClientsData(clients);
        setSuppliersData(suppliers);
        setAllEnrollments(enrollments);
        setManualLessonsData(manualLessons);
        setNotifications(notifs);
        setSchoolClosures(closures);

        const now = new Date();
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0,0,0,0);

        // Consideriamo anche le Pending perché spesso la lezione si fa prima del saldo
        const activeOrPendingEnrollments = enrollments.filter(e => e.status === EnrollmentStatus.Active || e.status === EnrollmentStatus.Pending);
        
        // --- COSTRUZIONE MAPPE PER FILTRO VALIDITÀ (Replicata dal Calendario) ---
        const locationConfigMap = new Map<string, { days: Set<number>, closedAt?: string }>();
        suppliers.forEach(s => {
            s.locations.forEach((l: any) => {
                const days = new Set<number>(l.availability?.map((a: any) => a.dayOfWeek) || []);
                if (l.name) locationConfigMap.set(l.name.trim(), { days, closedAt: l.closedAt });
            });
        });
        
        const closureSet = new Set(closures.map(c => c.date));

        const daysData = [];
        const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

        for(let i=0; i<7; i++) {
            const currentDay = new Date(startOfWeek);
            currentDay.setDate(startOfWeek.getDate() + i);
            const currentDayStr = toLocalISOString(currentDay);
            const dayOfWeek = currentDay.getDay();

            // Usiamo un Set per contare gli "Slot Occupati" univoci
            const uniqueSlots = new Set<string>();

            // 1. Appuntamenti da Iscrizioni
            activeOrPendingEnrollments.forEach(enr => {
                if(enr.appointments) {
                    enr.appointments.forEach(app => {
                         const appDateObj = new Date(app.date);
                         const appDateStr = toLocalISOString(appDateObj);
                         
                         // Conta solo se la data corrisponde e non è sospesa
                         if(appDateStr === currentDayStr && app.status !== 'Suspended') {
                             
                             // --- FILTRI VALIDITÀ CALENDARIO ---
                             // 1. Chiusura Globale & Festività
                             if (closureSet.has(appDateStr) || holidaysMap[appDateStr]) return;
                             
                             const loc = (app.locationName || enr.locationName || 'N/D').trim();
                             const config = locationConfigMap.get(loc);

                             // 2. Chiusura/Dismissione Sede & Giorno Settimana
                             if (config) {
                                 let isClosedLocation = false;
                                 if (config.closedAt) {
                                     const closingDate = new Date(config.closedAt);
                                     closingDate.setHours(0,0,0,0);
                                     if (appDateObj >= closingDate) isClosedLocation = true;
                                 }
                                 if (isClosedLocation) return;
                                 if (app.status === 'Scheduled' && !config.days.has(dayOfWeek)) return; 
                             }

                             const key = `${app.startTime}_${loc}`;
                             uniqueSlots.add(key);
                         }
                    });
                }
            });

            // 2. Lezioni Manuali (Extra)
            manualLessons.forEach(ml => {
                const mlDateObj = new Date(ml.date);
                const mlDateStr = toLocalISOString(mlDateObj);

                if(mlDateStr === currentDayStr) {
                    if (ml.description && ml.description.startsWith('[SOSPESO]')) return;
                    
                    // Applicare filtri anche a lezioni manuali? (Il calendario le mostra ma "flaggate")
                    // Se la scuola è chiusa (Festa), anche le extra non si fanno solitamente.
                    if (closureSet.has(mlDateStr) || holidaysMap[mlDateStr]) return;
                    
                    // Check chiusura sede permanente
                    const loc = (ml.locationName || 'N/D').trim();
                    const config = locationConfigMap.get(loc);
                    if (config && config.closedAt) {
                         const closingDate = new Date(config.closedAt);
                         closingDate.setHours(0,0,0,0);
                         if (mlDateObj >= closingDate) return;
                    }

                    const key = `${ml.startTime}_${loc}`;
                    uniqueSlots.add(key);
                }
            });

            daysData.push({ date: currentDay, count: uniqueSlots.size, dayName: dayNames[i] });
        }
        setWeekDays(daysData);
        checkFocusModeTrigger();

      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const handleDataUpdate = () => fetchData();
    window.addEventListener('EP_DataUpdated', handleDataUpdate);
    return () => window.removeEventListener('EP_DataUpdated', handleDataUpdate);
  }, [holidaysMap]); // Add dependency

  const checkFocusModeTrigger = async () => {
      try {
          const user = auth.currentUser;
          if (!user) return;

          const prefs = await getUserPreferences(user.uid);
          const config = prefs.focusConfig;
          
          if (!config || !config.enabled) return;

          const now = new Date();
          const todayStr = now.toISOString().split('T')[0];
          const lastSeen = prefs.lastFocusDate;

          if (lastSeen === todayStr) return;

          const currentDay = now.getDay(); 
          if (!config.days.includes(currentDay)) return;

          const [targetHour, targetMinute] = config.time.split(':').map(Number);
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();

          if (currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute)) {
              setShowFocusPopup(true);
          }

      } catch (e) {
          console.error("Error checking focus mode", e);
      }
  };

  const handleDismissFocus = async () => {
      setShowFocusPopup(false);
      const user = auth.currentUser;
      if (user) {
          await markFocusAsSeen(user.uid);
      }
  };

  const advancedMetrics = useMemo(() => {
      const totalCensus = clientsData.length;
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const locationClosureMap = new Map<string, Date | null>();
      suppliersData.forEach(s => {
          s.locations.forEach((l: any) => {
              if (l.closedAt) locationClosureMap.set(l.id, new Date(l.closedAt));
              else locationClosureMap.set(l.id, null);
          });
      });

      const activeClientIds = new Set<string>();
      allEnrollments.forEach(enr => {
          const isValidStatus = enr.status === EnrollmentStatus.Active || enr.status === EnrollmentStatus.Pending;
          const hasSlots = enr.lessonsRemaining > 0;
          
          if (isValidStatus && hasSlots) {
              let isLocValid = true;
              if (enr.locationId && enr.locationId !== 'unassigned') {
                  const closure = locationClosureMap.get(enr.locationId);
                  if (closure && closure <= today) isLocValid = false;
              }
              if (isLocValid) activeClientIds.add(enr.clientId);
          }
      });
      const activeCount = activeClientIds.size;

      const enrollmentsByClient: Record<string, Enrollment[]> = {};
      allEnrollments.forEach(enr => {
          if (!enrollmentsByClient[enr.clientId]) enrollmentsByClient[enr.clientId] = [];
          enrollmentsByClient[enr.clientId].push(enr);
      });

      let enthusiasticCount = 0;
      Object.values(enrollmentsByClient).forEach(list => {
          if (list.length > 1) { 
              const totalDays = list.reduce((acc, curr) => {
                  const start = new Date(curr.startDate).getTime();
                  const end = new Date(curr.endDate).getTime();
                  return acc + ((end - start) / (1000 * 60 * 60 * 24));
              }, 0);
              if (totalDays >= 90) enthusiasticCount++;
          }
      });

      return { totalCensus, activeCount, enthusiasticCount };
  }, [clientsData, allEnrollments, suppliersData]);

  const lessonsMetrics = useMemo(() => {
      const now = new Date();
      
      // Boundaries for strict month filtering
      const currentMonthStr = toLocalISOString(now).substring(0, 7); // YYYY-MM
      const todayStr = toLocalISOString(now);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      const uniqueSlots = new Set<string>();
      const doneSlots = new Set<string>();

      // --- 1. PREPARE LOOKUP MAPS FOR VALIDITY CHECK ---
      const locationConfigMap = new Map<string, { days: Set<number>, closedAt?: string }>();
      suppliersData.forEach(s => {
          s.locations.forEach((l: any) => {
              const days = new Set<number>(l.availability?.map((a: any) => a.dayOfWeek) || []);
              if (l.name) locationConfigMap.set(l.name.trim().toLowerCase(), { days, closedAt: l.closedAt });
          });
      });
      const closureSet = new Set(schoolClosures.map(c => c.date));

      // 2. PROCESS ENROLLMENTS
      allEnrollments.forEach(enr => {
          if (enr.status === EnrollmentStatus.Active || enr.status === EnrollmentStatus.Pending) {
              if (enr.appointments) {
                  enr.appointments.forEach(app => {
                      if (app.status === 'Suspended') return;

                      // Extract date parts strictly
                      const d = new Date(app.date);
                      const appDateStr = toLocalISOString(d); // YYYY-MM-DD

                      // STRICT MONTH FILTER
                      if (!appDateStr.startsWith(currentMonthStr)) return;
                          
                      // --- APPLY VALIDITY FILTERS ---
                      // 1. Global Closure & Holidays
                      if (closureSet.has(appDateStr) || holidaysMap[appDateStr]) return; 

                      const locKeyRaw = (app.locationName || enr.locationName || 'N/D');
                      const locKey = locKeyRaw.trim().toLowerCase();
                      const config = locationConfigMap.get(locKey);
                      
                      // 2. Location Checks
                      if (config) {
                          if (config.closedAt) {
                              const closingDate = new Date(config.closedAt);
                              closingDate.setHours(0,0,0,0);
                              if (d >= closingDate) return;
                          }
                          // Day of week check (only for future scheduled, present ones happened)
                          if (app.status === 'Scheduled' && !config.days.has(d.getDay())) return;
                      }

                      // LOGICA Data_Ora_Sede per unicità slot
                      // Normalizzazione Key: Date_Time_Location(lowercase)
                      const slotKey = `${appDateStr}_${app.startTime}_${locKey}`;
                      
                      uniqueSlots.add(slotKey);

                      let isDone = false;
                      
                      if (app.status === 'Present') {
                          isDone = true;
                      } else if (appDateStr < todayStr) {
                          isDone = true;
                      } else if (appDateStr === todayStr) {
                          const [endH, endM] = app.endTime.split(':').map(Number);
                          const endMinutes = endH * 60 + endM;
                          if (currentMinutes >= endMinutes) {
                              isDone = true;
                          }
                      }

                      if (isDone) {
                          doneSlots.add(slotKey);
                      }
                  });
              }
          }
      });

      // 3. PROCESS MANUAL LESSONS
      manualLessonsData.forEach(ml => {
          if (ml.description && ml.description.startsWith('[SOSPESO]')) return;
          
          // FIX: Ignora lezioni manuali che hanno attendees (sono lezioni di progetto/iscrizione, già contate sopra)
          if (ml.attendees && ml.attendees.length > 0) return;

          const d = new Date(ml.date);
          const mlDateStr = toLocalISOString(d);

          // STRICT MONTH FILTER
          if (!mlDateStr.startsWith(currentMonthStr)) return;
              
          // --- APPLY FILTERS ---
          if (closureSet.has(mlDateStr) || holidaysMap[mlDateStr]) return;
          
          const locKeyRaw = (ml.locationName || 'N/D');
          const locKey = locKeyRaw.trim().toLowerCase();

          const config = locationConfigMap.get(locKey);
          if (config && config.closedAt) {
               const closingDate = new Date(config.closedAt);
               closingDate.setHours(0,0,0,0);
               if (d >= closingDate) return;
          }

          const slotKey = `${mlDateStr}_${ml.startTime}_${locKey}`;
          uniqueSlots.add(slotKey);
          
          let isDone = false;
          
          if (mlDateStr < todayStr) {
              isDone = true;
          } else if (mlDateStr === todayStr) {
              const [endH, endM] = ml.endTime.split(':').map(Number);
              const endMinutes = endH * 60 + endM;
              if (currentMinutes >= endMinutes) {
                  isDone = true;
              }
          }
          
          if (isDone) {
              doneSlots.add(slotKey);
          }
      });

      const totalCount = uniqueSlots.size;
      const doneCount = doneSlots.size;
      const upcomingCount = totalCount - doneCount;
      
      // Label Mese Corrente
      const currentMonthName = now.toLocaleDateString('it-IT', { month: 'long' });
      const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

      return { 
          total: totalCount, 
          done: doneCount, 
          upcoming: upcomingCount,
          monthLabel: `(${capitalizedMonth})`
      };
  }, [allEnrollments, manualLessonsData, suppliersData, schoolClosures, holidaysMap]);

  const supplierMetrics = useMemo(() => {
      const totalCensus = suppliersData.length;
      const relevantSuppliers = suppliersData.filter(s => !s.companyName.toLowerCase().includes('simona puddu'));
      let activeCount = 0;
      let closedCount = 0;
      const now = new Date();

      relevantSuppliers.forEach(s => {
          if (!s.locations || s.locations.length === 0) {
              closedCount++;
              return;
          }
          const hasActiveLocation = s.locations.some((l: any) => {
              if (!l.closedAt) return true; 
              const closeDate = new Date(l.closedAt);
              return closeDate > now; 
          });
          if (hasActiveLocation) activeCount++; else closedCount++;
      });

      return { totalCensus, activeCount, closedCount };
  }, [suppliersData]);

  const locationOccupancy = useMemo(() => {
      const slotsMap: Record<string, LocationOccupancy> = {};
      suppliersData.forEach(s => {
          s.locations.forEach((l: any) => {
              if(l.availability && l.availability.length > 0) {
                  l.availability.forEach((slot: any) => {
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
                          occupancyPercent: 0,
                          locationAverage: 0,
                          locationAveragePercent: 0
                      };
                  });
              }
          });
      });

      const activeOrPending = allEnrollments.filter(e => e.status === EnrollmentStatus.Active || e.status === EnrollmentStatus.Pending);
      activeOrPending.forEach(enr => {
          if(enr.appointments) {
              const processedSlotsForStudent = new Set<string>();
              enr.appointments.forEach(app => {
                  const appDate = new Date(app.date);
                  if (appDate.getFullYear() === saturationYear) {
                      const dayOfWeek = appDate.getDay();
                      const key = `${enr.locationId}-${dayOfWeek}-${app.startTime}`;
                      if (!processedSlotsForStudent.has(key)) {
                          if (slotsMap[key]) {
                              slotsMap[key].occupied += 1;
                          }
                          processedSlotsForStudent.add(key);
                      }
                  }
              });
          }
      });

      const locationStats: Record<string, { totalOccupied: number, slotCount: number }> = {};
      Object.values(slotsMap).forEach(slot => {
          if (!locationStats[slot.locationName]) {
              locationStats[slot.locationName] = { totalOccupied: 0, slotCount: 0 };
          }
          locationStats[slot.locationName].totalOccupied += slot.occupied;
          locationStats[slot.locationName].slotCount += 1;
      });

      const occupancyList = Object.values(slotsMap).map(slot => {
          const percent = slot.capacity > 0 ? Math.round((slot.occupied / slot.capacity) * 100) : 0;
          const stats = locationStats[slot.locationName];
          const avg = stats && stats.slotCount > 0 ? stats.totalOccupied / stats.slotCount : 0;
          const avgPercent = slot.capacity > 0 ? Math.round((avg / slot.capacity) * 100) : 0;
          return { ...slot, occupancyPercent: percent, locationAverage: avg, locationAveragePercent: avgPercent };
      });

      occupancyList.sort((a, b) => {
          const dayA = a.dayIndex === 0 ? 7 : a.dayIndex;
          const dayB = b.dayIndex === 0 ? 7 : b.dayIndex;
          if (dayA !== dayB) return dayA - dayB;
          if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
          return a.locationName.localeCompare(b.locationName);
      });

      return occupancyList;
  }, [allEnrollments, suppliersData, saturationYear]);

  const scrollToAlerts = () => {
      const element = document.getElementById('alerts-section');
      if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  };

  const availableYears = useMemo(() => {
      const cy = new Date().getFullYear();
      return [cy - 1, cy, cy + 1];
  }, []);

  const ratings = useMemo(() => {
      let pCount = 0; let pSums = { availability: 0, complaints: 0, churnRate: 0, distance: 0 };
      let cCount = 0; let cSums = { learning: 0, behavior: 0, attendance: 0, hygiene: 0 };
      let sCount = 0; let sSums = { responsiveness: 0, partnership: 0, negotiation: 0 };
      let lCount = 0; let lSums = { cost: 0, distance: 0, parking: 0, availability: 0, safety: 0, environment: 0, distractions: 0, modifiability: 0, prestige: 0 };

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

      const pAvg = pCount > 0 ? (pSums.availability + pSums.complaints + pSums.churnRate + pSums.distance) / (pCount * 4) : 0;
      const cAvg = cCount > 0 ? (cSums.learning + cSums.behavior + cSums.attendance + cSums.hygiene) / (cCount * 4) : 0;
      const sAvg = sCount > 0 ? (sSums.responsiveness + sSums.partnership + sSums.negotiation) / (sCount * 3) : 0;
      const lAvg = lCount > 0 ? Object.values(lSums).reduce((a, b) => a + b, 0) / (lCount * 9) : 0;

      return {
          parents: { avg: pAvg, count: pCount, details: [ { label: 'Disponibilità', value: pCount ? pSums.availability / pCount : 0 }, { label: 'Atteggiamento', value: pCount ? pSums.complaints / pCount : 0 }, { label: 'Costanza', value: pCount ? pSums.churnRate / pCount : 0 }, { label: 'Mobilità', value: pCount ? pSums.distance / pCount : 0 }, ] },
          children: { avg: cAvg, count: cCount, details: [ { label: 'Apprendimento', value: cCount ? cSums.learning / cCount : 0 }, { label: 'Condotta', value: cCount ? cSums.behavior / cCount : 0 }, { label: 'Assenze', value: cCount ? cSums.attendance / cCount : 0 }, { label: 'Igiene', value: cCount ? cSums.hygiene / cCount : 0 }, ] },
          suppliers: { avg: sAvg, count: sCount, details: [ { label: 'Reattività', value: sCount ? sSums.responsiveness / sCount : 0 }, { label: 'Partnership', value: sCount ? sSums.partnership / sCount : 0 }, { label: 'Flessibilità', value: sCount ? sSums.negotiation / sCount : 0 }, ] },
          locations: { avg: lAvg, count: lCount, details: [ { label: 'Economicità', value: lCount ? lSums.cost / lCount : 0 }, { label: 'Sicurezza', value: lCount ? lSums.safety / lCount : 0 }, { label: 'Ambiente', value: lCount ? lSums.environment / lCount : 0 }, { label: 'Slot', value: lCount ? lSums.availability / lCount : 0 }, { label: 'Vicinanza', value: lCount ? lSums.distance / lCount : 0 }, ] }
      };
  }, [clientsData, suppliersData]);

  const topFiveData = useMemo(() => {
      const parents = clientsData.filter(c => c.clientType === ClientType.Parent).map(c => { const p = c as ParentClient; const r = p.rating || { availability: 0, complaints: 0, churnRate: 0, distance: 0 }; const avg = (r.availability + r.complaints + r.churnRate + r.distance) / 4; return { id: p.id, name: `${p.firstName} ${p.lastName}`, score: avg }; }).sort((a, b) => b.score - a.score).slice(0, 5);
      const suppliers = suppliersData.map(s => { const r = s.rating || { responsiveness: 0, partnership: 0, negotiation: 0 }; let fuelRatingSum = 0; let locCount = 0; if (s.locations && s.locations.length > 0) { s.locations.forEach((l: any) => { fuelRatingSum += calculateFuelRating(l.distance || 0); locCount++; }); } const avgFuelRating = locCount > 0 ? fuelRatingSum / locCount : 0; const divisor = locCount > 0 ? 4 : 3; const sum = r.responsiveness + r.partnership + r.negotiation + avgFuelRating; const avg = sum / divisor; return { id: s.id, name: s.companyName, score: avg }; }).sort((a, b) => b.score - a.score).slice(0, 5);
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
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Dashboard</h2>
            <p className="mt-1 text-gray-500 font-medium">Benvenuta, Ilaria! Ecco una panoramica.</p>
          </div>
          
          <div className="bg-white rounded-xl p-1.5 flex shadow-sm border border-gray-200">
              <button 
                onClick={() => setActiveTab('overview')}
                className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
              >
                Panoramica
              </button>
              <button 
                onClick={() => setActiveTab('ratings')}
                className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'ratings' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
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
              <div className="animate-fade-in space-y-8">
                {/* ROW 1: Premium Stat Cards (Vertical Stack Style) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    
                    {/* CARD 1: CLIENTS */}
                    <StatCard 
                        title="Clienti & Community" 
                        onClick={() => setCurrentPage && setCurrentPage('Clients')}
                        value={advancedMetrics.totalCensus} 
                        valueLabel="(Censiti)"
                        icon={<ClientsIcon />}
                        subtext={
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-100 text-green-600">
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
                                    </span>
                                    <span><strong>{advancedMetrics.activeCount}</strong> Attivi (Iscritti)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-purple-100 text-purple-600">
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                                    </span>
                                    <span><strong>{advancedMetrics.enthusiasticCount}</strong> Entusiasti</span>
                                </div>
                            </div>
                        }
                    />

                    {/* CARD 2: LESSONS (SLOT BASED) */}
                    <StatCard 
                        title="Lezioni Mese" 
                        value={lessonsMetrics.total}
                        valueLabel={lessonsMetrics.monthLabel}
                        onClick={() => setCurrentPage && setCurrentPage('ActivityLog')}
                        icon={<ChecklistIcon />}
                        subtext={
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-100 text-green-600 font-bold text-[8px]">
                                        ✓
                                    </span>
                                    <span><strong>{lessonsMetrics.done}</strong> Fatte (svolte)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 text-gray-400">
                                        <ClockIcon />
                                    </span>
                                    <span><strong>{lessonsMetrics.upcoming}</strong> Da fare</span>
                                </div>
                            </div>
                        }
                    />

                    {/* CARD 3: SUPPLIERS */}
                    <StatCard 
                        title="Fornitori" 
                        value={supplierMetrics.totalCensus} 
                        valueLabel="(censiti)"
                        onClick={() => setCurrentPage && setCurrentPage('Suppliers')}
                        icon={<SuppliersIcon />}
                        subtext={
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-100">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    </span>
                                    <span><strong>{supplierMetrics.activeCount}</strong> Sedi attive</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-red-100">
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    </span>
                                    <span><strong>{supplierMetrics.closedCount}</strong> Sedi chiuse</span>
                                </div>
                            </div>
                        }
                    />

                    {/* CARD 4: ALERTS */}
                    <StatCard 
                        title="Azioni Richieste" 
                        value={notifications.length}
                        subtext={notifications.length > 0 ? "Richiedono attenzione immediata" : "Tutto in perfetto ordine"}
                        onClick={scrollToAlerts}
                        icon={<ExclamationIcon />}
                        isAlert={notifications.length > 0}
                        headerAction={
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsFocusConfigOpen(true); }}
                                className="bg-gray-100 hover:bg-white hover:text-amber-500 text-gray-400 p-1 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                                title="Pianifica Focus Avvisi"
                            >
                                <ClockIcon />
                            </button>
                        }
                    />
                </div>

                {/* ROW 2: 3 Columns - Calendar | Saturation | Alerts */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    
                    {/* COL 1: Calendario Settimanale */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800">Attività Settimanale</h3>
                            <button className="p-2 bg-gray-50 rounded-lg text-indigo-600 hover:bg-gray-100"><CalendarIcon /></button>
                        </div>
                        {(() => {
                            const maxWeekly = Math.max(...weekDays.map(d => d.count), 1);
                            return (
                                <div className="flex justify-between items-end h-48 px-2">
                                    {weekDays.map((day, idx) => {
                                        const isToday = new Date().toDateString() === day.date.toDateString();
                                        const heightPercent = day.count === 0 ? 4 : Math.max(10, (day.count / maxWeekly) * 100);
                                        return (
                                            <div key={idx} className="flex flex-col items-center space-y-2 w-full group cursor-default">
                                                <span className={`text-[10px] font-bold h-4 transition-all duration-300 ${isToday ? 'text-indigo-600' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}>
                                                    {day.count}
                                                </span>
                                                <div className="relative w-full flex justify-center items-end h-32 bg-gray-50 rounded-xl overflow-hidden group-hover:bg-gray-100 transition-colors">
                                                    <div 
                                                        className={`w-4 rounded-full transition-all duration-700 ease-out ${isToday ? 'bg-indigo-600 shadow-lg shadow-indigo-200' : 'bg-gray-300 group-hover:bg-indigo-300'}`}
                                                        style={{ height: `${heightPercent}%`, marginBottom: '8px' }}
                                                    ></div>
                                                </div>
                                                <div className={`text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>{day.dayName}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {/* COL 2: Saturazione Aule */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800">Saturazione</h3>
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                                <select 
                                    value={saturationYear} 
                                    onChange={(e) => setSaturationYear(Number(e.target.value))} 
                                    className="bg-transparent text-xs font-bold text-gray-600 outline-none cursor-pointer px-2"
                                >
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto max-h-80 pr-2 space-y-6 custom-scrollbar">
                            {locationOccupancy.map((slot, idx) => (
                                <div key={idx} className="w-full">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-md" style={{ backgroundColor: slot.color }}>
                                                {slot.dayName}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-800">{slot.locationName}</p>
                                                <p className="text-xs text-gray-400 font-medium">{slot.startTime} - {slot.endTime}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded">{slot.occupied}/{slot.capacity}</span>
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                        {/* Reale */}
                                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden flex">
                                            <div 
                                                className="h-full rounded-full transition-all duration-1000 ease-out" 
                                                style={{ width: `${slot.occupancyPercent}%`, backgroundColor: slot.color }}
                                            ></div>
                                        </div>
                                        {/* Media */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-400 font-bold w-8">AVG</span>
                                            <div className="flex-1 bg-gray-50 rounded-full h-1.5 overflow-hidden">
                                                <div 
                                                    className="h-full rounded-full bg-gray-300 transition-all duration-1000 ease-out" 
                                                    style={{ width: `${slot.locationAveragePercent}%` }}
                                                ></div>
                                            </div>
                                        </div>
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

                    {/* COL 3: Avvisi (Added ID for scrolling) */}
                    <div id="alerts-section" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col scroll-mt-24">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800">Avvisi ({notifications.length})</h3>
                            <button className="text-indigo-600 bg-indigo-50 p-2 rounded-lg hover:bg-indigo-100"><ClockIcon /></button>
                        </div>
                        <div className="flex-grow overflow-y-auto max-h-80 custom-scrollbar pr-1">
                            {notifications.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4 text-3xl shadow-sm">
                                        ✨
                                    </div>
                                    <p className="text-sm font-bold text-gray-800">Tutto in regola!</p>
                                    <p className="text-xs text-gray-400 mt-1">Goditi il caffè.</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {notifications.map((notif, index) => (
                                        <li 
                                            key={index} 
                                            className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                                            onClick={() => setCurrentPage && notif.linkPage && setCurrentPage(notif.linkPage as Page, notif.filterContext)}
                                        >
                                            <div className="flex-shrink-0 mt-1 p-2 bg-gray-50 rounded-xl group-hover:scale-110 transition-transform">
                                                {getNotificationIcon(notif.type)}
                                            </div>
                                            <div className="text-sm text-gray-600 leading-relaxed font-medium">
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
              <div className="animate-fade-in space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <RatingCard 
                        title="Genitori"
                        average={ratings.parents.avg}
                        count={ratings.parents.count}
                        icon={<ClientsIcon />}
                        details={ratings.parents.details}
                    />
                    <RatingCard 
                        title="Allievi"
                        average={ratings.children.avg}
                        count={ratings.children.count}
                        icon={<span className="text-2xl">🎓</span>}
                        details={ratings.children.details}
                    />
                    <RatingCard 
                        title="Fornitori"
                        average={ratings.suppliers.avg}
                        count={ratings.suppliers.count}
                        icon={<SuppliersIcon />}
                        details={ratings.suppliers.details}
                    />
                    <RatingCard 
                        title="Sedi"
                        average={ratings.locations.avg}
                        count={ratings.locations.count}
                        icon={<span className="text-2xl">🏢</span>}
                        details={ratings.locations.details}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col h-96">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800">🏆 Top 5</h3>
                            <div className="flex bg-gray-50 p-1 rounded-xl">
                                <button 
                                    onClick={() => setTop5Tab('clients')} 
                                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${top5Tab === 'clients' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                                >
                                    CLIENTI
                                </button>
                                <button 
                                    onClick={() => setTop5Tab('suppliers')} 
                                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${top5Tab === 'suppliers' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                                >
                                    FORNITORI
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <ul className="space-y-3">
                                {(top5Tab === 'clients' ? topFiveData.parents : topFiveData.suppliers).map((item, idx) => (
                                    <li key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <span className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-gray-200 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-400 border border-gray-200'}`}>
                                                {idx + 1}
                                            </span>
                                            <span className="text-sm text-gray-800 font-bold truncate block" title={item.name}>
                                                {item.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-gray-100 shadow-sm shrink-0">
                                            <span className="text-xs font-bold text-gray-800">{item.score.toFixed(1)}</span>
                                            <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                        </div>
                                    </li>
                                ))}
                                {(top5Tab === 'clients' ? topFiveData.parents : topFiveData.suppliers).length === 0 && (
                                    <li className="text-center text-gray-400 text-xs py-10 italic">
                                        Nessun dato di rating disponibile.
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
              </div>
          )}
        </>
      )}

      {/* MODALS */}
      {isFocusConfigOpen && (
          <FocusModeConfigModal 
              onClose={() => setIsFocusConfigOpen(false)}
              onSave={(cfg) => { console.log('Focus Config Saved', cfg); setIsFocusConfigOpen(false); }}
          />
      )}

      {showFocusPopup && (
          <FocusModePopup 
              notifications={notifications}
              onDismiss={handleDismissFocus}
              onNavigate={(page, params) => {
                  if (setCurrentPage) setCurrentPage(page, params);
              }}
          />
      )}
    </div>
  );
};

export default Dashboard;
