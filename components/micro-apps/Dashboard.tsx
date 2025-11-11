import React, { useMemo, useState, useEffect } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { ClienteStato, LaboratorioStato } from '../../types';

export const Dashboard: React.FC = () => {
    const { clienti, laboratori, fornitori } = useMockData();
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [currentDate, setCurrentDate] = useState(new Date());

    const activeClientsCount = useMemo(() => {
        return clienti.filter(c => c.stato === ClienteStato.ATTIVO).length;
    }, [clienti]);

    const labsThisWeekCount = useMemo(() => {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const labsInWeek = new Set<string>();

        laboratori.forEach(lab => {
            if (lab.stato === LaboratorioStato.ATTIVO) {
                lab.timeSlots.forEach(slot => {
                    const slotDate = new Date(slot.data);
                    if (slotDate >= startOfWeek && slotDate <= endOfWeek) {
                        labsInWeek.add(lab.id);
                    }
                });
            }
        });

        return labsInWeek.size;
    }, [laboratori]);

    useEffect(() => {
        if (clienti.length > 0 || laboratori.length > 0) {
            const timer = setTimeout(() => {
                 setLastUpdated(new Date().toLocaleString('it-IT'));
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [clienti, laboratori]);

    const getContrastColor = (hexcolor: string | undefined): string => {
        if (!hexcolor) return '#000000';
        hexcolor = hexcolor.replace("#", "");
        if (hexcolor.length === 3) {
            hexcolor = hexcolor.split('').map(char => char + char).join('');
        }
        const r = parseInt(hexcolor.substring(0, 2), 16);
        const g = parseInt(hexcolor.substring(2, 4), 16);
        const b = parseInt(hexcolor.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#FFFFFF';
    };

    const allSedi = useMemo(() => fornitori.flatMap(f => f.sedi), [fornitori]);

    const sedeDetailsMap = useMemo(() => {
        const map = new Map<string, { colore: string }>();
        allSedi.forEach(sede => {
            map.set(sede.id, { colore: sede.colore });
        });
        return map;
    }, [allSedi]);


    const labsByDay = useMemo(() => {
        const labsMap = new Map<string, { codice: string; colore: string; ora: string }[]>();
        
        laboratori.forEach(lab => {
            if (lab.stato === LaboratorioStato.ATTIVO) {
                 const sede = sedeDetailsMap.get(lab.sedeId);
                const colore = sede?.colore || '#A0AEC0';
                
                const codeParts = lab.codice.split('.');
                let ora = '00:00';
                if (codeParts.length === 3 && codeParts[2].length === 4) {
                    ora = `${codeParts[2].substring(0, 2)}:${codeParts[2].substring(2, 4)}`;
                }

                lab.timeSlots.forEach(slot => {
                    const dateKey = slot.data; // YYYY-MM-DD
                    if (!labsMap.has(dateKey)) {
                        labsMap.set(dateKey, []);
                    }
                    labsMap.get(dateKey)?.push({ codice: lab.codice, colore, ora });
                });
            }
        });
        return labsMap;
    }, [laboratori, sedeDetailsMap]);

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay();
        const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

        const calendarDays = [];
        
        for (let i = 0; i < adjustedStartDay; i++) {
            calendarDays.push(<div key={`empty-start-${i}`} className="border-r border-b dark:border-gray-700"></div>);
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const todaysLabs = labsByDay.get(dateKey) || [];

            todaysLabs.sort((a, b) => a.ora.localeCompare(b.ora));
            
            calendarDays.push(
                <div key={day} className="p-2 border-r border-b dark:border-gray-700 min-h-[100px] flex flex-col">
                    <span className="font-semibold">{day}</span>
                    <div className="flex-grow mt-1 space-y-1 overflow-y-auto">
                        {todaysLabs.map((lab, index) => (
                            <div 
                                key={index} 
                                className="text-xs p-1 rounded font-mono"
                                style={{ 
                                    backgroundColor: lab.colore,
                                    color: getContrastColor(lab.colore)
                                }}
                            >
                                {lab.codice}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        
        const totalCells = calendarDays.length;
        const remainingCells = (7 - (totalCells % 7)) % 7;
        for (let i = 0; i < remainingCells; i++) {
             calendarDays.push(<div key={`empty-end-${i}`} className="border-r border-b dark:border-gray-700"></div>);
        }

        return calendarDays;
    };
    
    const changeMonth = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };

    const weekDays = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];


    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Home</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Benvenuto in EP v.1, il tuo sistema gestionale per EasyPeasy Labs.</p>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col">
                    <h2 className="text-xl font-semibold">Laboratori in Settimana</h2>
                     <div className="flex-grow flex flex-col justify-center items-center">
                        <p className="text-5xl font-bold text-blue-600 dark:text-blue-400 my-2">{labsThisWeekCount}</p>
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-1 h-4">
                        {lastUpdated ? `Aggiornato il: ${lastUpdated}` : ''}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col">
                    <h2 className="text-xl font-semibold">Clienti Attivi</h2>
                    <div className="flex-grow flex flex-col justify-center items-center">
                        <p className="text-5xl font-bold text-blue-600 dark:text-blue-400 my-2">{activeClientsCount}</p>
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-1 h-4">
                        {lastUpdated ? `Aggiornato il: ${lastUpdated}` : ''}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold">Promemoria</h2>
                    <ul className="list-disc list-inside mt-2 text-gray-500 dark:text-gray-400">
                        <li>Contattare "Asilo Nido Sole"</li>
                        <li>Ordinare materiali per attività musicale</li>
                    </ul>
                </div>
            </div>

             <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                     <h2 className="text-xl font-semibold">Calendario Laboratori Attivi</h2>
                     <div className="flex items-center gap-2">
                        <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Mese precedente">&lt;</button>
                        <span className="font-semibold w-32 text-center">
                            {currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Mese successivo">&gt;</button>
                     </div>
                </div>
                
                <div className="border-t border-l dark:border-gray-700">
                    <div className="grid grid-cols-7">
                        {weekDays.map(day => (
                            <div key={day} className="text-center font-bold p-2 border-r border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">{day}</div>
                        ))}
                    </div>
                     <div className="grid grid-cols-7">
                         {renderCalendar()}
                     </div>
                </div>
            </div>
        </div>
    );
};