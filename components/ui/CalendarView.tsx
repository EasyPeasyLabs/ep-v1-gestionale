import React, { useState } from 'react';

type CalendarEvent = {
    id: string;
    title: string;
    start: Date;
    end: Date;
    color: string;
    data?: any;
};

interface CalendarViewProps {
    events: CalendarEvent[];
    onEventClick?: (event: CalendarEvent) => void;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export const CalendarView: React.FC<CalendarViewProps> = ({ events, onEventClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(startOfMonth);
    const startDayOfWeek = (startOfMonth.getDay() + 6) % 7; // 0 (Lun) - 6 (Dom)
    startDate.setDate(startDate.getDate() - startDayOfWeek);

    const endDate = new Date(endOfMonth);
    const endDayOfWeek = (endOfMonth.getDay() + 6) % 7;
    endDate.setDate(endDate.getDate() + (6 - endDayOfWeek));

    const calendarDays = [];
    let date = new Date(startDate);
    while (date <= endDate) {
        calendarDays.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    
    const eventsByDate = new Map<string, CalendarEvent[]>();
    events.forEach(event => {
        const dateKey = event.start.toISOString().split('T')[0];
        if (!eventsByDate.has(dateKey)) {
            eventsByDate.set(dateKey, []);
        }
        eventsByDate.get(dateKey)?.push(event);
    });

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">&lt;</button>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                    {currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={() => changeMonth(1)} className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">&gt;</button>
            </div>
            
            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {WEEKDAYS.map(day => (
                    <div key={day} className="text-center font-semibold py-2 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300">{day}</div>
                ))}

                {calendarDays.map((day, index) => {
                    const dateKey = day.toISOString().split('T')[0];
                    const dayEvents = eventsByDate.get(dateKey) || [];
                    const isToday = day.toDateString() === new Date().toDateString();
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();

                    return (
                        <div key={index} className={`relative min-h-[120px] bg-white dark:bg-gray-800 p-2 ${!isCurrentMonth ? 'opacity-50' : ''}`}>
                             <time dateTime={dateKey} className={`absolute top-2 right-2 text-xs font-semibold ${isToday ? 'bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center' : 'text-gray-500'}`}>
                                {day.getDate()}
                            </time>
                            <div className="space-y-1 mt-6">
                                {dayEvents.map(event => (
                                    <button 
                                        key={event.id}
                                        onClick={() => onEventClick?.(event)}
                                        className="w-full text-left text-xs p-1 rounded-md overflow-hidden truncate"
                                        style={{ backgroundColor: `${event.color}33`, borderLeft: `3px solid ${event.color}`}}
                                    >
                                        <span className="font-semibold text-gray-800 dark:text-white">{event.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};