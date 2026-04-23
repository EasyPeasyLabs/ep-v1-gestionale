import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Client, EnrollmentInput, EnrollmentStatus, SubscriptionType, Supplier, Enrollment, PaymentMethod, ClientType, ParentClient, InstitutionalClient, AvailabilitySlot, Appointment, Course, SlotType } from '../types';
import { getSubscriptionTypes } from '../services/settingsService';
import { getSuppliers } from '../services/supplierService';
import { getEnrollmentsForClient } from '../services/enrollmentService';
import { getOpenCourses } from '../services/courseService';
import toast from 'react-hot-toast';
import Spinner from './Spinner';
import SearchIcon from './icons/SearchIcon';
import PlusIcon from './icons/PlusIcon';
import CalendarIcon from './icons/CalendarIcon';
import ClockIcon from './icons/ClockIcon';

interface EnrollmentFormProps {
    clients: Client[]; 
    initialClient?: Client | null; 
    existingEnrollment?: Enrollment; 
    onSave: (enrollments: EnrollmentInput[], options?: { regenerateCalendar: boolean }) => void;
    onCancel: () => void;
}

// Helper Festività
const isItalianHoliday = (date: Date): boolean => {
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    if (d === 1 && m === 1) return true;
    if (d === 6 && m === 1) return true;
    if (d === 25 && m === 4) return true;
    if (d === 1 && m === 5) return true;
    if (d === 2 && m === 6) return true;
    if (d === 15 && m === 8) return true;
    if (d === 1 && m === 11) return true;
    if (d === 8 && m === 12) return true;
    if (d === 25 && m === 12) return true;
    if (d === 26 && m === 12) return true;
    const easterMondays: Record<number, string> = {
        2024: '4-1', 2025: '4-21', 2026: '4-6', 2027: '3-29', 2028: '4-17', 2029: '4-2', 2030: '4-22'
    };
    const lookupKey = `${m}-${d}`;
    if (easterMondays[y] === lookupKey) return true;
    return false;
};

// Helper standard per calcolo date (solo Mode Standard)
const calculateSlotBasedDates = (startStr: string, lessons: number, dayOfWeek?: number): { start: string, end: string } => {
    if (!startStr || lessons <= 0) return { start: startStr, end: startStr };
    
    const currentDate = new Date(startStr);
    currentDate.setHours(12, 0, 0, 0); // Force noon to avoid TZ slippage

    // Align to dayOfWeek if provided
    if (dayOfWeek !== undefined) {
        while (currentDate.getDay() !== dayOfWeek) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
    
    let validSlots = 0;
    let firstDate: string | null = null;
    let lastDate: string = startStr;

    let loops = 0;
    while (validSlots < lessons && loops < 500) {
        if (!isItalianHoliday(currentDate)) {
            const dateStr = currentDate.toISOString().split('T')[0];
            if (!firstDate) firstDate = dateStr;
            lastDate = dateStr;
            validSlots++;
        }
        currentDate.setDate(currentDate.getDate() + 7);
        loops++;
    }

    return { start: firstDate || startStr, end: lastDate };
};

const EnrollmentForm: React.FC<EnrollmentFormProps> = ({ clients, initialClient, existingEnrollment, onSave, onCancel }) => {
    // --- STATE CORE ---
    const [selectedClientId, setSelectedClientId] = useState<string>(initialClient?.id || existingEnrollment?.clientId || '');
    
    // Fallback: Se childId manca nell'iscrizione, cerchiamolo nel client tramite il nome dell'allievo
    const resolvedChildId = useMemo(() => {
        if (existingEnrollment?.childId) return existingEnrollment.childId;
        if (!existingEnrollment?.childName || !selectedClientId) return null;
        
        const client = clients.find(c => c.id === selectedClientId);
        if (client?.clientType === ClientType.Parent) {
            const parent = client as ParentClient;
            const child = parent.children.find(c => c.name === existingEnrollment.childName);
            return child?.id || null;
        }
        return null;
    }, [existingEnrollment, selectedClientId, clients]);

    const [selectedChildIds, setSelectedChildIds] = useState<string[]>(resolvedChildId ? [resolvedChildId] : []);

    useEffect(() => {
        if (resolvedChildId && selectedChildIds.length === 0) {
            setSelectedChildIds([resolvedChildId]);
        }
    }, [resolvedChildId, selectedChildIds]);
    const [isAdultEnrollment, setIsAdultEnrollment] = useState<boolean>(existingEnrollment?.isAdult || false);
    const [subscriptionTypeId, setSubscriptionTypeId] = useState(existingEnrollment?.subscriptionTypeId || '');
    const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<PaymentMethod>(() => {
        // Supporta mapping retroattivo per ID portale (Cash, BankTransfer)
        const raw = (existingEnrollment as any)?.paymentMethod || existingEnrollment?.preferredPaymentMethod;
        if (raw === 'Cash') return PaymentMethod.Cash;
        if (raw === 'BankTransfer') return PaymentMethod.BankTransfer;
        if (raw === 'CreditCard') return PaymentMethod.CreditCard;
        if (raw === 'PayPal') return PaymentMethod.PayPal;
        return raw || PaymentMethod.BankTransfer;
    });
    const [manualPrice, setManualPrice] = useState<string>(existingEnrollment?.price?.toString() || '');
    const [projectName, setProjectName] = useState<string>(existingEnrollment?.childName || '');

    // --- STATE STANDARD MODE ---
    const [startDateInput, setStartDateInput] = useState(existingEnrollment?.startDate?.split('T')[0] || new Date().toISOString().split('T')[0]); 
    const [endDateInput, setEndDateInput] = useState(existingEnrollment?.endDate?.split('T')[0] || '');
    const [targetLocationId, setTargetLocationId] = useState(existingEnrollment?.locationId !== 'unassigned' ? existingEnrollment?.locationId : '');
    
    // Migliorato recupero orari dagli appointments
    const initialStartTime = existingEnrollment?.appointments?.[0]?.startTime || '16:00';
    const initialEndTime = existingEnrollment?.appointments?.[0]?.endTime || '18:00';

    const [startTime, setStartTime] = useState(initialStartTime);
    const [endTime, setEndTime] = useState(initialEndTime);
    const [isEndDateManual, setIsEndDateManual] = useState(false); 

    const [singleSmartSlot, setSingleSmartSlot] = useState('');

    // --- NEW COURSE STATE ---
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourseId, setSelectedCourseId] = useState<string>(existingEnrollment?.courseId || '');
    const [isAgeFilteringActive, setIsAgeFilteringActive] = useState(true);

    // --- CUSTOM BUILDER STATE (RESTORED) ---
    const [singleDate, setSingleDate] = useState('');
    const [singleLocationId, setSingleLocationId] = useState('');
    const [singleStartTime, setSingleStartTime] = useState('16:00');
    const [singleEndTime, setSingleEndTime] = useState('18:00');
    
    const [genLocationId, setGenLocationId] = useState('');
    const [genDayOfWeek, setGenDayOfWeek] = useState(1);
    const [genStartTime, setGenStartTime] = useState('16:00');
    const [genEndTime, setGenEndTime] = useState('18:00');
    const [genCount, setGenCount] = useState(4);
    const [genSmartSlot, setGenSmartSlot] = useState('');
    
    const [customSchedule, setCustomSchedule] = useState<Appointment[]>(existingEnrollment?.appointments || []);

    // Resources
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
    const [loading, setLoading] = useState(true);
    const [isChildDropdownOpen, setIsChildDropdownOpen] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const clientSort = 'surname_asc';
    const [clientHistory, setClientHistory] = useState<Enrollment[]>([]);

    const initialValues = useRef({
        startDate: existingEnrollment?.startDate?.split('T')[0] || '',
        subscriptionId: existingEnrollment?.subscriptionTypeId || '',
        endDate: existingEnrollment?.endDate?.split('T')[0] || '',
        startTime: existingEnrollment?.appointments?.[0]?.startTime || '16:00',
        endTime: existingEnrollment?.appointments?.[0]?.endTime || '18:00'
    });

    const currentClient = clients.find(p => p.id === selectedClientId);
    const isInstitutional = currentClient?.clientType === ClientType.Institutional || existingEnrollment?.clientType === ClientType.Institutional;
    const isCustomMode = isInstitutional || subscriptionTypeId === 'quote-based';

    // Fetch client history
    useEffect(() => {
        if (!selectedClientId) {
            setClientHistory([]);
            return;
        }
        const fetchHistory = async () => {
            try {
                const history = await getEnrollmentsForClient(selectedClientId);
                setClientHistory(history);
            } catch (e) {
                console.error("Error fetching client history:", e);
            }
        };
        fetchHistory();
    }, [selectedClientId]);

    // Helper: Locations Flattened
    const allLocations = useMemo(() => {
        const locs: {id: string, name: string, color: string, supplierId: string, supplierName: string, city?: string}[] = [];
        suppliers.forEach(s => {
            s.locations.forEach(l => {
                locs.push({
                    id: l.id, name: l.name, color: l.color, city: l.city,
                    supplierId: s.id, supplierName: s.companyName
                });
            });
        });

        // Deduplicate by name and city to avoid visual duplicates in dropdowns
        const uniqueMap = new Map<string, {id: string, name: string, color: string, supplierId: string, supplierName: string, city?: string}>();
        locs.forEach(l => {
            const nameKey = (l.name || '').trim().toLowerCase();
            const cityKey = (l.city || '').trim().toLowerCase();
            const key = `${nameKey}_${cityKey}`;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, l);
            }
        });

        return Array.from(uniqueMap.values()).sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    // Auto-select last plan and timeslot based on history and child age
    const hasAutoSelected = useRef(false);
    useEffect(() => {
        if (existingEnrollment || !selectedClientId || selectedChildIds.length === 0 || clientHistory.length === 0) {
            return;
        }

        // Only auto-select once per new enrollment session to avoid overwriting user manual changes
        if (hasAutoSelected.current) return;

        const childId = selectedChildIds[0];
        const childHistory = clientHistory
            .filter(e => e.childId === childId)
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        
        const lastEnrollment = childHistory[0];
        
        let didAutoSelect = false;

        // 1. Auto-select last plan
        if (lastEnrollment && !subscriptionTypeId) {
            setSubscriptionTypeId(lastEnrollment.subscriptionTypeId);
            didAutoSelect = true;
        }

        // 2. Auto-select timeslot based on age and location
        const client = clients.find(c => c.id === selectedClientId);
        if (client && client.clientType === ClientType.Parent) {
            const parent = client as ParentClient;
            const child = parent.children.find(c => c.id === childId);
            if (child) {
                let age = 0;
                if (child.dateOfBirth) {
                    const dob = new Date(child.dateOfBirth);
                    const ageDifMs = Date.now() - dob.getTime();
                    const ageDate = new Date(ageDifMs);
                    age = Math.abs(ageDate.getUTCFullYear() - 1970);
                } else if (child.age) {
                    age = parseInt(child.age);
                }
                
                // Determine location: last attended or currently selected
                const locIdToUse = lastEnrollment ? lastEnrollment.locationId : targetLocationId;
                
                if (locIdToUse && locIdToUse !== 'unassigned') {
                    // Find suitable course based on age and location
                    const suitableCourse = courses.find(c => 
                        c.locationId === locIdToUse && 
                        age >= (c.minAge || 0) && 
                        age <= (c.maxAge || 99) &&
                        c.status === 'open'
                    );
                    
                    if (suitableCourse) {
                        setTargetLocationId(suitableCourse.locationId);
                        setStartTime(suitableCourse.startTime);
                        setEndTime(suitableCourse.endTime);
                        setSelectedCourseId(suitableCourse.id);
                        didAutoSelect = true;
                    }
                }
            }
        }

        if (didAutoSelect) {
            hasAutoSelected.current = true;
        }
    }, [selectedChildIds, clientHistory, clients, selectedClientId, existingEnrollment, courses, subscriptionTypeId, targetLocationId]);

    // Auto-select based on client preferences
    useEffect(() => {
        if (!existingEnrollment && currentClient && !targetLocationId) {
            const prefLoc = currentClient.preferredLocation;
            // No simple mapping for prefSlot anymore as it depends on courses
            if (prefLoc) {
                const matchedLoc = allLocations.find(l => l.name === prefLoc);
                if (matchedLoc) {
                    setTargetLocationId(matchedLoc.id);
                }
            }
        }
    }, [selectedClientId, allLocations, existingEnrollment, currentClient, targetLocationId]);

    // Auto-update timeslot when location changes based on child age
    const prevLocationIdRef = useRef(targetLocationId);
    useEffect(() => {
        if (targetLocationId !== prevLocationIdRef.current) {
            prevLocationIdRef.current = targetLocationId;
            
            if (targetLocationId && targetLocationId !== 'unassigned' && selectedChildIds.length > 0) {
                const childId = selectedChildIds[0];
                const client = clients.find(c => c.id === selectedClientId);
                if (client && client.clientType === ClientType.Parent) {
                    const parent = client as ParentClient;
                    const child = parent.children.find(c => c.id === childId);
                    if (child) {
                        let age = 0;
                        if (child.dateOfBirth) {
                            const dob = new Date(child.dateOfBirth);
                            const ageDifMs = Date.now() - dob.getTime();
                            const ageDate = new Date(ageDifMs);
                            age = Math.abs(ageDate.getUTCFullYear() - 1970);
                        } else if (child.age) {
                            age = parseInt(child.age);
                        }
                        
                        const suitableCourse = courses.find(c => 
                            c.locationId === targetLocationId && 
                            age >= (c.minAge || 0) && 
                            age <= (c.maxAge || 99) &&
                            c.status === 'open'
                        );
                        
                        if (suitableCourse) {
                            setStartTime(suitableCourse.startTime);
                            setEndTime(suitableCourse.endTime);
                            setSelectedCourseId(suitableCourse.id);
                        }
                    }
                }
            }
        }
    }, [targetLocationId, selectedChildIds, clients, selectedClientId, courses]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [subs, supps, openCourses] = await Promise.all([
                    getSubscriptionTypes(), 
                    getSuppliers(),
                    getOpenCourses()
                ]);
                setSubscriptionTypes(subs);
                setSuppliers(supps);
                setCourses(openCourses);
            } catch (e) { 
                console.error(e); 
            } finally { 
                setLoading(false); 
            }
        };
        loadData();
    }, []);

    // RECOVERY MATCHING: Matches course for existing enrollments from portal that missed the courseId link
    useEffect(() => {
        if (existingEnrollment && !selectedCourseId && courses.length > 0 && targetLocationId) {
            const firstAppt = existingEnrollment.appointments?.[0];
            if (firstAppt) {
                // Try matching by slot details
                const apptDate = new Date(firstAppt.date);
                const dayIndex = isNaN(apptDate.getTime()) ? -1 : apptDate.getDay();
                
                const matched = courses.find(c => 
                    c.locationId === targetLocationId && 
                    c.startTime === firstAppt.startTime && 
                    c.endTime === firstAppt.endTime &&
                    (dayIndex === -1 || c.dayOfWeek === dayIndex)
                );
                
                if (matched) {
                    console.log("[Recovery] Auto-matched course:", matched.id);
                    setSelectedCourseId(matched.id);
                }
            }
        }
    }, [existingEnrollment, courses, targetLocationId, selectedCourseId]);

    // Sync price when subscription changes
    useEffect(() => {
        if (!subscriptionTypeId || subscriptionTypeId === 'quote-based') return;
        const sub = subscriptionTypes.find(s => s.id === subscriptionTypeId);
        if (sub) {
            setManualPrice(sub.price.toString());
        }
    }, [subscriptionTypeId, subscriptionTypes]);

    // --- SMART TIME SELECTOR LOGIC ---
    const getSlotsForContext = useCallback((locationId: string, dayOfWeek: number) => {
        if (!locationId) return [];
        // Filter courses for this location and day
        return courses
            .filter(c => c.locationId === locationId && c.dayOfWeek === dayOfWeek)
            .sort((a,b) => a.startTime.localeCompare(b.startTime));
    }, [courses]);

    // Update Single Adder Time when Location or Date changes
    useEffect(() => {
        if (!singleLocationId || !singleDate) {
            setSingleSmartSlot('');
            return;
        }
        const day = new Date(singleDate).getDay();
        const slots = getSlotsForContext(singleLocationId, day);
        if (slots.length > 0) {
            // Auto-select first slot
            setSingleSmartSlot(`${slots[0].startTime}-${slots[0].endTime}`);
            setSingleStartTime(slots[0].startTime);
            setSingleEndTime(slots[0].endTime);
        } else {
            setSingleSmartSlot('manual');
        }
    }, [singleLocationId, singleDate, getSlotsForContext]);

    // Update Generator Time when Location or Day changes
    useEffect(() => {
        if (!genLocationId) {
            setGenSmartSlot('');
            return;
        }
        const slots = getSlotsForContext(genLocationId, genDayOfWeek);
        if (slots.length > 0) {
            setGenSmartSlot(`${slots[0].startTime}-${slots[0].endTime}`);
            setGenStartTime(slots[0].startTime);
            setGenEndTime(slots[0].endTime);
        } else {
            setGenSmartSlot('manual');
        }
    }, [genLocationId, genDayOfWeek, getSlotsForContext]);

    const handleSmartSlotChange = (val: string, setStart: (v: string) => void, setEnd: (v: string) => void, setSlot: (v: string) => void) => {
        setSlot(val);
        if (val !== 'manual' && val !== '') {
            const [s, e] = val.split('-');
            setStart(s);
            setEnd(e);
        }
    };

    // --- CUSTOM BUILDER ACTIONS ---
    const addSingleLesson = () => {
        if (!singleLocationId || !singleDate) return alert("Seleziona data e sede.");
        const loc = allLocations.find(l => l.id === singleLocationId);
        
        const newApp: Appointment = {
            lessonId: `NEW-${Date.now()}`,
            date: new Date(singleDate).toISOString(),
            startTime: singleStartTime,
            endTime: singleEndTime,
            locationId: singleLocationId,
            locationName: loc?.name || 'Sede',
            locationColor: loc?.color || '#ccc',
            childName: projectName || 'Progetto',
            status: 'Scheduled'
        };
        
        setCustomSchedule(prev => [...prev, newApp].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    };

    const runGenerator = () => {
        if (!genLocationId) return alert("Seleziona una sede.");
        const loc = allLocations.find(l => l.id === genLocationId);
        const newApps: Appointment[] = [];
        
        const currentDate = new Date(); // Start from today or logic start
        // Find first occurrence of selected day
        while (currentDate.getDay() !== genDayOfWeek) {
            currentDate.setDate(currentDate.getDate() + 1);
        }

        let added = 0;
        let loops = 0;
        while (added < genCount && loops < 100) { // Safety break
            if (!isItalianHoliday(currentDate)) {
                newApps.push({
                    lessonId: `GEN-${Date.now()}-${added}`,
                    date: currentDate.toISOString(),
                    startTime: genStartTime,
                    endTime: genEndTime,
                    locationId: genLocationId,
                    locationName: loc?.name || 'Sede',
                    locationColor: loc?.color || '#ccc',
                    childName: projectName || 'Progetto',
                    status: 'Scheduled'
                });
                added++;
            }
            currentDate.setDate(currentDate.getDate() + 7);
            loops++;
        }
        
        setCustomSchedule(prev => [...prev, ...newApps].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        toast.success(`Generate ${added} lezioni.`);
    };

    const removeCustomLesson = (idx: number) => {
        setCustomSchedule(prev => prev.filter((_, i) => i !== idx));
    };

    // --- STANDARD LOGIC ---
    // (Existing slot calculation logic for non-institutional)
    const hasHistory = useMemo(() => {
        if (!clientHistory.length) return false;
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        return clientHistory.some(e => e.startDate < currentMonthStart);
    }, [clientHistory]);

    const availableSubscriptions = useMemo(() => {
        const normalizeType = (type: string) => {
            if (!type) return '';
            // Rimuove prefissi K- o A- e converte in UpperCase
            return type.replace(/^[KA]-/, '').toUpperCase();
        };

        const isVisible = (s: SubscriptionType) => {
            const status = s.statusConfig?.status || 'active';
            const isStatusOk = status === 'active' || status === 'promo';
            
            // In manual mode, visibility constraints (public/history) should NOT apply.
            // These are for the end-user portal. The operator must see all active packages.
            return isStatusOk;
        };

        // Age filter logic
        let childrenAgeRange: { min: number, max: number } | null = null;
        if (!isAdultEnrollment && selectedChildIds.length > 0 && currentClient?.clientType === ClientType.Parent) {
            const ages = selectedChildIds.map(id => {
                const child = (currentClient as ParentClient).children.find(c => id === c.id);
                if (!child) return 0;
                if (child.dateOfBirth) {
                    const dob = new Date(child.dateOfBirth);
                    return Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
                }
                return parseInt(child.age) || 0;
            });
            childrenAgeRange = { min: Math.min(...ages), max: Math.max(...ages) };
        }

        const baseSubs = isInstitutional ? subscriptionTypes.filter(isVisible) : subscriptionTypes.filter(s => {
            let matchesTarget = false;
            if (s.target) matchesTarget = isAdultEnrollment ? s.target === 'adult' : s.target === 'kid';
            else { const isAdultName = s.name.startsWith('A -'); matchesTarget = isAdultEnrollment ? isAdultName : !isAdultName; }
            
            // SPECIAL CASE FOR TOKEN BUNDLES: Always visible in manual mode if active, 
            // regardless of target convention, to ensure they can be selected.
            const isTokenBundle = s.tokens && s.tokens.length > 0;
            if (isTokenBundle) matchesTarget = true;

            // Filter by age if subscription specifies it AND filtering is active
            if (isAgeFilteringActive && childrenAgeRange && s.allowedAges) {
                const minAge = s.allowedAges.min;
                const maxAge = s.allowedAges.max;
                if (childrenAgeRange.min < minAge || childrenAgeRange.max > maxAge) {
                    return false;
                }
            }

            return (matchesTarget && isVisible(s)) || (isTokenBundle && isVisible(s));
        });

        // In manual mode, we show all base subscriptions to give the operator maximum flexibility
        // without strict technical token matching that might hide valid options.
        const filteredSubs = baseSubs;

        // --- NEW SORTING LOGIC ---
        // Find last subscription
        const lastEnrollment = clientHistory.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
        const lastSubId = lastEnrollment?.subscriptionTypeId;

        return filteredSubs.sort((a, b) => {
            if (lastSubId) {
                if (a.id === lastSubId && b.id !== lastSubId) return -1;
                if (b.id === lastSubId && a.id !== lastSubId) return 1;
            }
            return a.name.localeCompare(b.name);
        });
    }, [subscriptionTypes, isAdultEnrollment, isInstitutional, hasHistory, selectedChildIds, currentClient, courses, selectedCourseId, clientHistory]);

    const filteredCourses = useMemo(() => {
        if (!isAgeFilteringActive || isAdultEnrollment) return courses;
        
        // Age filter logic for courses
        if (selectedChildIds.length > 0 && currentClient?.clientType === ClientType.Parent) {
            const ages = selectedChildIds.map(id => {
                const child = (currentClient as ParentClient).children.find(c => c.id === id);
                if (!child) return 0;
                if (child.dateOfBirth) {
                    const dob = new Date(child.dateOfBirth);
                    return Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
                }
                return parseInt(child.age) || 0;
            });
            const minChildAge = Math.min(...ages);
            const maxChildAge = Math.max(...ages);

            return courses.filter(c => {
                // Return courses where all children fit in [minAge, maxAge]
                return minChildAge >= c.minAge && maxChildAge <= c.maxAge;
            });
        }
        return courses;
    }, [courses, selectedChildIds, currentClient, isAgeFilteringActive, isAdultEnrollment]);

    const calculatedDates = useMemo(() => {
        const selectedSub = subscriptionTypes.find(s => s.id === subscriptionTypeId);
        if (!selectedSub || !startDateInput || isCustomMode) return null;
        
        const course = courses.find(c => c.id === selectedCourseId);
        return calculateSlotBasedDates(startDateInput, selectedSub.lessons, course?.dayOfWeek);
    }, [subscriptionTypeId, startDateInput, subscriptionTypes, isCustomMode, selectedCourseId, courses]);

    useEffect(() => {
        if (!isEndDateManual && calculatedDates && !isCustomMode) {
            setEndDateInput(calculatedDates.end);
        }
    }, [calculatedDates, isEndDateManual, isCustomMode]);

    const filteredClients = useMemo(() => {
        const result = clients.filter(c => {
            const term = clientSearchTerm.toLowerCase();
            if (c.clientType === ClientType.Parent) {
                const p = c as ParentClient;
                return `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) || p.children.some(ch => ch.name.toLowerCase().includes(term));
            } else {
                return (c as InstitutionalClient).companyName.toLowerCase().includes(term);
            }
        });
        return result.sort((a, b) => {
            const nameA = a.clientType === ClientType.Parent ? (a as ParentClient).lastName : (a as InstitutionalClient).companyName;
            const nameB = b.clientType === ClientType.Parent ? (b as ParentClient).lastName : (b as InstitutionalClient).companyName;
            return clientSort === 'surname_asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
    }, [clients, clientSearchTerm, clientSort]);

    const toggleChildSelection = (childId: string) => {
        setSelectedChildIds(prev => prev.includes(childId) ? prev.filter(id => id !== childId) : [...prev, childId]);
    };

    const [isSaving, setIsSaving] = useState(false);
    
    // ... (existing state)

    // --- SUBMIT ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;
        setIsSaving(true);
        
        if (!selectedClientId) { setIsSaving(false); return alert("Seleziona un cliente."); }
        if (!isInstitutional && !isAdultEnrollment && selectedChildIds.length === 0) { setIsSaving(false); return alert("Seleziona almeno un figlio."); }

        const selectedSub = subscriptionTypes.find(s => s.id === subscriptionTypeId);
        
        let appointmentsPayload: Appointment[] = [];
        let finalStartDate = startDateInput;
        let finalEndDate = endDateInput;
        let finalLessonsTotal = Number(existingEnrollment?.lessonsTotal || selectedSub?.lessons || 0);
        let finalLocationId = targetLocationId || 'unassigned';
        let finalCourseId = selectedCourseId || undefined;
        let finalLocationName = allLocations.find(l => l.id === targetLocationId)?.name || 'Sede Non Definita';
        const finalLocationColor = allLocations.find(l => l.id === targetLocationId)?.color || '#e5e7eb';
        const finalSupplierId = allLocations.find(l => l.id === targetLocationId)?.supplierId || 'unassigned';
        const finalSupplierName = allLocations.find(l => l.id === targetLocationId)?.supplierName || '';

        // --- MODE LOGIC BRANCH ---
        if (isCustomMode) {
            if (customSchedule.length === 0) { setIsSaving(false); return alert("Inserisci almeno una lezione nel calendario."); }
            
            appointmentsPayload = customSchedule;
            // Recalculate bounds from custom schedule
            const sortedDates = customSchedule.map(a => new Date(a.date).getTime()).sort((a,b) => a - b);
            finalStartDate = new Date(sortedDates[0]).toISOString();
            finalEndDate = new Date(sortedDates[sortedDates.length - 1]).toISOString();
            finalLessonsTotal = customSchedule.length;
            
            // For Institutional, location might be mixed, we use a placeholder or the most frequent
            finalLocationId = 'mixed'; 
            finalLocationName = 'Multi-Sede';
            finalCourseId = undefined;
        } else {
            // Standard Mode
            let regenerateCalendar = false;
            const dateChanged = startDateInput !== initialValues.current.startDate;
            const subChanged = subscriptionTypeId !== initialValues.current.subscriptionId;
            const endChanged = endDateInput !== initialValues.current.endDate;
            const timeChanged = startTime !== initialValues.current.startTime || endTime !== initialValues.current.endTime;
            const locationChanged = finalLocationId !== existingEnrollment?.locationId;

            if (existingEnrollment && (dateChanged || subChanged || endChanged || timeChanged || locationChanged)) {
                if(window.confirm("Hai modificato parametri chiave. Rigenerare il calendario?")) regenerateCalendar = true;
            }

            if (regenerateCalendar || !existingEnrollment) {
                const course = courses.find(c => c.id === selectedCourseId);
                
                appointmentsPayload = [{
                    lessonId: 'template', 
                    date: new Date(startDateInput).toISOString(),
                    startTime: course?.startTime || startTime,
                    endTime: course?.endTime || endTime,
                    locationId: course?.locationId || finalLocationId,
                    locationName: allLocations.find(l => l.id === course?.locationId)?.name || finalLocationName,
                    locationColor: allLocations.find(l => l.id === course?.locationId)?.color || finalLocationColor,
                    childName: '', 
                    status: 'Scheduled'
                }];
            } else {
                appointmentsPayload = (existingEnrollment.appointments || []).map(app => ({
                    ...app, startTime, endTime, locationId: finalLocationId, locationName: finalLocationName, locationColor: finalLocationColor
                }));
            }
        }

        // Final overrides from selected course if standard mode
        if (!isCustomMode && selectedCourseId) {
            const course = courses.find(c => c.id === selectedCourseId);
            if (course) {
                finalLocationId = course.locationId;
                finalCourseId = course.id;
                const loc = allLocations.find(l => l.id === course.locationId);
                finalLocationName = loc?.name || 'Sede';
            }
        }

        const enrollmentsToSave: (EnrollmentInput & { id?: string })[] = [];
        const targets = isInstitutional 
            ? [{ id: existingEnrollment?.childId || 'institutional', name: projectName || (currentClient as InstitutionalClient).companyName }]
            : isAdultEnrollment 
                ? [{ id: selectedClientId, name: `${(currentClient as ParentClient).firstName} ${(currentClient as ParentClient).lastName}` }]
                : selectedChildIds.map(id => {
                    const c = (currentClient as ParentClient).children.find(child => child.id === id);
                    return c ? { id: c.id, name: c.name } : null;
                }).filter(Boolean);

        targets.forEach(target => {
            if(!target) return;
            // Function to extract count from tokens array or legacy fields
            const getTokenCount = (sub: SubscriptionType | undefined, type: SlotType) => {
                if (!sub) return 0;
                // Check new tokens array first
                if (sub.tokens && sub.tokens.length > 0) {
                    const token = sub.tokens.find(t => t.type === type);
                    if (token) return token.count;
                }
                // Fallback to legacy fields
                switch(type) {
                    case 'LAB': return sub.labCount || 0;
                    case 'SG': return sub.sgCount || 0;
                    case 'EVT': return sub.evtCount || 0;
                    case 'READ': return sub.readCount || 0;
                    default: return 0;
                }
            };

            const labC = getTokenCount(selectedSub, 'LAB');
            const sgC = getTokenCount(selectedSub, 'SG');
            const evtC = getTokenCount(selectedSub, 'EVT');
            const readC = getTokenCount(selectedSub, 'READ');

            const newEnrollment: EnrollmentInput = {
                clientId: selectedClientId,
                clientType: currentClient?.clientType || ClientType.Parent,
                childId: target.id, 
                childName: target.name, 
                isAdult: isAdultEnrollment,
                isQuoteBased: existingEnrollment?.isQuoteBased || isInstitutional,
                relatedQuoteId: existingEnrollment?.relatedQuoteId || undefined,
                subscriptionTypeId: subscriptionTypeId || 'quote-based',
                subscriptionName: selectedSub?.name || existingEnrollment?.subscriptionName || 'Progetto Istituzionale',
                price: Number(manualPrice) || 0,
                
                supplierId: finalSupplierId,
                supplierName: finalSupplierName,
                locationId: finalLocationId,
                locationName: finalLocationName, 
                locationColor: finalLocationColor, 
                courseId: finalCourseId,
                
                appointments: appointmentsPayload, 
                
                lessonsTotal: finalLessonsTotal,
                lessonsRemaining: isCustomMode ? finalLessonsTotal : Number(existingEnrollment?.lessonsRemaining || selectedSub?.lessons || 0),
                
                labCount: labC || existingEnrollment?.labCount || 0,
                sgCount: sgC || existingEnrollment?.sgCount || 0,
                evtCount: evtC || existingEnrollment?.evtCount || 0,
                readCount: readC || existingEnrollment?.readCount || 0,
                
                labRemaining: isCustomMode ? (labC || 0) : Number(existingEnrollment?.labRemaining ?? labC ?? 0),
                sgRemaining: isCustomMode ? (sgC || 0) : Number(existingEnrollment?.sgRemaining ?? sgC ?? 0),
                evtRemaining: isCustomMode ? (evtC || 0) : Number(existingEnrollment?.evtRemaining ?? evtC ?? 0),
                readRemaining: isCustomMode ? (readC || 0) : Number(existingEnrollment?.readRemaining ?? readC ?? 0),

                startDate: new Date(finalStartDate).toISOString(),
                endDate: new Date(finalEndDate).toISOString(),
                status: existingEnrollment ? existingEnrollment.status : EnrollmentStatus.Pending, 
                preferredPaymentMethod: preferredPaymentMethod,
                adjustmentAmount: existingEnrollment?.adjustmentAmount,
                adjustmentNotes: existingEnrollment?.adjustmentNotes
            };
            if (existingEnrollment) (newEnrollment as Enrollment).id = existingEnrollment.id;
            enrollmentsToSave.push(newEnrollment);
        });

        try {
            await onSave(enrollmentsToSave, { regenerateCalendar: !isCustomMode });
        } catch (e) {
            console.error(e);
            alert("Errore durante il salvataggio.");
            setIsSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full w-full overflow-hidden">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">
                    {existingEnrollment ? 'Modifica Iscrizione' : 'Nuova Iscrizione'}
                </h2>
                {isCustomMode && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black uppercase tracking-widest mt-1 inline-block">Builder Avanzato</span>}
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5">
                {/* 1. SELEZIONE CLIENTE */}
                <div className="space-y-2">
                    {!existingEnrollment && (
                        <div className="bg-gray-50 p-2 rounded border border-gray-200 flex gap-2 items-center">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><SearchIcon /></div>
                                <input type="text" className="w-full pl-8 pr-2 py-1 text-sm border rounded" placeholder="Cerca cliente..." value={clientSearchTerm} onChange={e => setClientSearchTerm(e.target.value)} />
                            </div>
                        </div>
                    )}
                    <div className="md-input-group">
                        <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} required className="md-input font-medium">
                            <option value="" disabled>Seleziona Cliente...</option>
                            {filteredClients.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.clientType === ClientType.Parent ? `${(c as ParentClient).lastName} ${(c as ParentClient).firstName}` : (c as InstitutionalClient).companyName}
                                </option>
                            ))}
                        </select>
                        <label className="md-input-label !top-0 !text-xs">1. Cliente / Ente</label>
                    </div>
                </div>

                {/* LOGICA B2C vs B2B */}
                {!isInstitutional ? (
                    <>
                        {!existingEnrollment && (
                            <div className="flex gap-4 p-3 bg-gray-50 rounded border border-gray-200">
                                <span className="text-xs font-bold text-gray-700 self-center">Target:</span>
                                <label className="flex items-center cursor-pointer"><input type="radio" checked={!isAdultEnrollment} onChange={() => setIsAdultEnrollment(false)} className="mr-2" /><span className="text-sm text-gray-700">Figlio/i</span></label>
                                <label className="flex items-center cursor-pointer"><input type="radio" checked={isAdultEnrollment} onChange={() => setIsAdultEnrollment(true)} className="mr-2" /><span className="text-sm text-gray-700">Genitore</span></label>
                            </div>
                        )}
                        {!isAdultEnrollment && (
                            <div className={`md-input-group relative ${!selectedClientId ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div className="md-input cursor-pointer flex justify-between items-center" onClick={() => setIsChildDropdownOpen(!isChildDropdownOpen)}>
                                    <span className="truncate">{selectedChildIds.length === 0 ? "Seleziona figli..." : (currentClient as ParentClient)?.children.filter(c => selectedChildIds.includes(c.id)).map(c => c.name).join(', ')}</span>
                                </div>
                                <label className="md-input-label !top-0 !text-xs">2. Allievi</label>
                                {isChildDropdownOpen && (currentClient as ParentClient)?.children && (
                                    <div className="absolute z-20 w-full bg-white shadow-xl border rounded-md mt-1 max-h-48 overflow-y-auto">
                                        {(currentClient as ParentClient).children.map(child => (
                                            <label key={child.id} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer">
                                                <input type="checkbox" checked={selectedChildIds.includes(child.id)} onChange={() => toggleChildSelection(child.id)} className="mr-3" />
                                                <span className="text-sm">{child.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <p className="text-xs font-bold text-indigo-800 uppercase mb-1">Dettaglio Progetto (Nome Pubblico)</p>
                        <input 
                            type="text" 
                            value={projectName} 
                            onChange={e => setProjectName(e.target.value)}
                            className="w-full bg-white border border-indigo-200 rounded p-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-300 outline-none" 
                            placeholder="Es: Corso Inglese Estivo"
                        />
                    </div>
                )}

                {/* PACCHETTO, PREZZO & PAGAMENTO */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md-input-group">
                        <select value={subscriptionTypeId} onChange={e => setSubscriptionTypeId(e.target.value)} required className="md-input font-bold">
                            {isInstitutional ? <option value="quote-based">Basato su Preventivo</option> : (
                                <>
                                    <option value="" disabled>Seleziona pacchetto...</option>
                                    {availableSubscriptions.map(sub => {
                                        const totalTokens = sub.tokens?.reduce((acc, t) => acc + t.count, 0) || 0;
                                        const displayLessons = sub.lessons || totalTokens;
                                        const hasTokens = sub.tokens && sub.tokens.length > 0;
                                        
                                        return (
                                            <option key={sub.id} value={sub.id}>
                                                {hasTokens ? '📦 ' : ''}{sub.name} - {sub.price.toFixed(2)}€ ({displayLessons} lez.)
                                            </option>
                                        );
                                    })}
                                </>
                            )}
                        </select>
                        <label className="md-input-label !top-0 !text-xs">3. Piano / Pacchetto</label>
                    </div>
                    
                    <div className="md-input-group">
                        <input 
                            type="number" 
                            value={manualPrice} 
                            onChange={e => setManualPrice(e.target.value)} 
                            className="md-input font-black text-right pr-8"
                            placeholder="0.00"
                        />
                        <span className="absolute right-3 top-3 text-sm text-gray-400 font-bold">€</span>
                        <label className="md-input-label !top-0 !text-xs">Prezzo Pattuito</label>
                    </div>

                    <div className="md-input-group">
                        <select value={preferredPaymentMethod} onChange={e => setPreferredPaymentMethod(e.target.value as PaymentMethod)} className="md-input">
                            {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <label className="md-input-label !top-0 !text-xs">4. Metodo Previsto</label>
                    </div>
                </div>

                {/* CONDITIONAL RENDER: STANDARD vs CUSTOM BUILDER */}
                {!isCustomMode ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md-input-group">
                                <input type="date" value={startDateInput} onChange={e => setStartDateInput(e.target.value)} required className="md-input" />
                                <label className="md-input-label !top-0 !text-xs">5. Data Inizio (Primo Slot)</label>
                            </div>
                            <div className="md-input-group">
                                <input type="date" value={endDateInput} onChange={e => { setEndDateInput(e.target.value); setIsEndDateManual(true); }} required className="md-input" />
                                <label className="md-input-label !top-0 !text-xs">6. Data Fine (Ultimo Slot)</label>
                                {!isEndDateManual && calculatedDates && (
                                    <span className="absolute -bottom-4 right-0 text-[10px] text-indigo-500 font-bold bg-white px-1">
                                        Calcolata su {subscriptionTypes.find(s => s.id === subscriptionTypeId)?.lessons} slot
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ASSEGNAZIONE CORSO (NUOVA ARCHITETTURA) */}
                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mt-2">
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-xs font-bold text-indigo-800 uppercase">7. Selezione Corso (Fessura)</label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="checkbox" checked={isAgeFilteringActive} onChange={e => setIsAgeFilteringActive(e.target.checked)} className="rounded text-indigo-600 w-3 h-3" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Filtra per Età</span>
                                </label>
                            </div>
                            
                            <div className="md-input-group !mb-3">
                                <select 
                                    value={selectedCourseId} 
                                    onChange={e => {
                                        const cId = e.target.value;
                                        setSelectedCourseId(cId);
                                        const c = courses.find(x => x.id === cId);
                                        if (c) {
                                            setStartTime(c.startTime);
                                            setEndTime(c.endTime);
                                            setTargetLocationId(c.locationId);
                                        }
                                    }} 
                                    required={!isCustomMode}
                                    className="md-input bg-white font-bold text-indigo-700"
                                >
                                    <option value="">-- Seleziona un corso disponibile --</option>
                                    {filteredCourses.map(c => {
                                        const loc = allLocations.find(l => l.id === c.locationId);
                                        const days = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
                                        return (
                                            <option key={c.id} value={c.id}>
                                                {days[c.dayOfWeek]} {c.startTime}-{c.endTime} | {loc?.name} ({c.slotType}) | {c.minAge}-{c.maxAge}a
                                            </option>
                                        );
                                    })}
                                </select>
                                <label className="md-input-label !top-0">Punto di Destinazione</label>
                            </div>

                            <div className="flex items-center gap-4 px-2">
                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                    <ClockIcon /> {startTime} - {endTime}
                                </div>
                                {selectedCourseId && (
                                    <div className="text-[10px] font-black uppercase text-indigo-600">
                                        Occupazione: {courses.find(c => c.id === selectedCourseId)?.activeEnrollmentsCount || 0} / {courses.find(c => c.id === selectedCourseId)?.capacity}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    /* CUSTOM SCHEDULE BUILDER (MODE A/B) */
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <CalendarIcon />
                            <h4 className="text-lg font-black text-indigo-900">Pianificatore Progetto</h4>
                        </div>

                        {/* BUILDER AREA */}
                        <div className="bg-white border-2 border-dashed border-indigo-200 rounded-2xl p-4">
                            {/* SECTION 1: ADD SINGLE (MODE A) */}
                            <div className="mb-6">
                                <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Inserimento Puntuale</p>
                                <div className="flex flex-col md:flex-row gap-2 items-end bg-gray-50 p-2 rounded-xl">
                                    <div className="flex-1 w-full">
                                        <label className="text-[10px] text-gray-400 font-bold block mb-1">DATA</label>
                                        <input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)} className="w-full text-xs font-bold p-2 rounded border border-gray-200" />
                                    </div>
                                    <div className="flex-1 w-full">
                                        <label className="text-[10px] text-gray-400 font-bold block mb-1">SEDE</label>
                                        <select value={singleLocationId} onChange={e => setSingleLocationId(e.target.value)} className="w-full text-xs font-bold p-2 rounded border border-gray-200">
                                            <option value="">Seleziona...</option>
                                            {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-[2] w-full">
                                        <label className="text-[10px] text-gray-400 font-bold block mb-1">ORARIO (Smart Select)</label>
                                        <div className="flex gap-2">
                                            <select 
                                                value={singleSmartSlot} 
                                                onChange={e => handleSmartSlotChange(e.target.value, setSingleStartTime, setSingleEndTime, setSingleSmartSlot)} 
                                                className="flex-1 text-xs font-bold p-2 rounded border border-gray-200 bg-white"
                                                disabled={!singleLocationId}
                                            >
                                                <option value="" disabled>-- Seleziona Slot Ufficiale --</option>
                                                {singleLocationId && getSlotsForContext(singleLocationId, new Date(singleDate).getDay()).map((slot: AvailabilitySlot, i: number) => (
                                                    <option key={i} value={`${slot.startTime}-${slot.endTime}`}>
                                                        {slot.startTime} - {slot.endTime}
                                                    </option>
                                                ))}
                                                <option value="manual">Manuale / Custom</option>
                                            </select>
                                            {singleSmartSlot === 'manual' && (
                                                <>
                                                    <input type="time" value={singleStartTime} onChange={e => setSingleStartTime(e.target.value)} className="w-16 text-xs p-1 border rounded" />
                                                    <input type="time" value={singleEndTime} onChange={e => setSingleEndTime(e.target.value)} className="w-16 text-xs p-1 border rounded" />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <button type="button" onClick={addSingleLesson} className="md-btn md-btn-sm md-btn-raised md-btn-primary w-full md:w-auto h-full flex items-center justify-center">
                                        <PlusIcon />
                                    </button>
                                </div>
                            </div>

                            {/* SECTION 2: BULK GENERATOR (MODE B) */}
                            <div className="border-t border-gray-200 pt-4">
                                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <ClockIcon /> Generatore Periodico
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end bg-amber-50 p-3 rounded-xl border border-amber-100">
                                    <div className="col-span-1">
                                        <label className="text-[9px] font-black text-amber-700 uppercase">Giorno</label>
                                        <select value={genDayOfWeek} onChange={e => setGenDayOfWeek(Number(e.target.value))} className="w-full text-xs p-1.5 rounded border border-amber-200 bg-white">
                                            {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map((d,i) => <option key={i} value={i}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[9px] font-black text-amber-700 uppercase">Sede</label>
                                        <select value={genLocationId} onChange={e => setGenLocationId(e.target.value)} className="w-full text-xs p-1.5 rounded border border-amber-200 bg-white">
                                            <option value="">Seleziona...</option>
                                            {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-2 flex gap-1">
                                        <div className="flex-1">
                                            <label className="text-[9px] font-black text-amber-700 uppercase">Orario</label>
                                            <select 
                                                value={genSmartSlot} 
                                                onChange={e => handleSmartSlotChange(e.target.value, setGenStartTime, setGenEndTime, setGenSmartSlot)} 
                                                className="w-full text-xs p-1.5 rounded border border-amber-200 bg-white"
                                                disabled={!genLocationId}
                                            >
                                                <option value="" disabled>Slot...</option>
                                                {genLocationId && getSlotsForContext(genLocationId, genDayOfWeek).map((slot: AvailabilitySlot, i: number) => (
                                                    <option key={i} value={`${slot.startTime}-${slot.endTime}`}>
                                                        {slot.startTime} - {slot.endTime}
                                                    </option>
                                                ))}
                                                <option value="manual">Manuale</option>
                                            </select>
                                        </div>
                                        {genSmartSlot === 'manual' && (
                                            <div className="flex gap-1 items-end">
                                                <input type="time" value={genStartTime} onChange={e => setGenStartTime(e.target.value)} className="w-12 text-xs p-1 rounded border" />
                                                <input type="time" value={genEndTime} onChange={e => setGenEndTime(e.target.value)} className="w-12 text-xs p-1 rounded border" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-1 flex gap-1">
                                        <div className="w-16">
                                            <label className="text-[9px] font-black text-amber-700 uppercase">Quantità</label>
                                            <input type="number" value={genCount} onChange={e => setGenCount(Number(e.target.value))} className="w-full text-xs p-1.5 rounded border border-amber-200 text-center" />
                                        </div>
                                        <button type="button" onClick={runGenerator} className="bg-amber-500 text-white text-xs font-bold px-2 rounded hover:bg-amber-600 flex-1">Genera</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PREVIEW TABLE */}
                        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                                <span className="text-xs font-black text-gray-500 uppercase">Calendario ({customSchedule.length} lezioni)</span>
                                <button type="button" onClick={() => setCustomSchedule([])} className="text-[10px] text-red-500 font-bold hover:underline">Svuota Tutto</button>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                                <table className="w-full text-left text-xs">
                                    <tbody className="divide-y divide-gray-100">
                                        {customSchedule.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400 italic">Nessuna lezione inserita.</td></tr>}
                                        {customSchedule.map((app, idx) => (
                                            <tr key={idx} className="bg-white hover:bg-gray-50">
                                                <td className="p-2 font-mono text-gray-600">{new Date(app.date).toLocaleDateString()}</td>
                                                <td className="p-2 font-bold text-gray-800">{app.startTime} - {app.endTime}</td>
                                                <td className="p-2 text-indigo-600">{app.locationName}</td>
                                                <td className="p-2 text-right">
                                                    <button type="button" onClick={() => removeCustomLesson(idx)} className="text-red-400 hover:text-red-600 px-2 font-bold">×</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm" disabled={isSaving}>Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm" disabled={isSaving}>
                    {isSaving ? <Spinner /> : 'Salva Modifiche'}
                </button>
            </div>
        </form>
    );
};

export default EnrollmentForm;