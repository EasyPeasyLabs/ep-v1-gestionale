
import React, { useState } from 'react';
import { Notification } from '../types';
import Spinner from './Spinner';
import ClockIcon from './icons/ClockIcon';
import ExclamationIcon from './icons/ExclamationIcon';
import { syncDismissedNotifications } from '../services/profileService';

interface NotificationsDropdownProps {
    userId: string;
    notifications: Notification[];
    loading: boolean;
    onNotificationClick: (notification: Notification) => void;
}

const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('it-IT', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
};

const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ userId, notifications, loading, onNotificationClick }) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    
    const handleDismiss = async () => {
        setIsSaving(true);
        let idsToDismiss: string[] = [];
        
        if (selectedIds.length > 0) {
            idsToDismiss = selectedIds;
        } else {
            idsToDismiss = notifications.map(n => n.id);
        }

        try {
            // Save to Firestore via Profile Service
            await syncDismissedNotifications(userId, idsToDismiss);
            
            // Clear selection and refresh UI
            setSelectedIds([]);
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch (e) {
            console.error("Failed to dismiss notifications:", e);
            alert("Errore durante il salvataggio. Riprova.");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // Sort notifications by date descending (newest first)
    const sortedNotifications = [...notifications].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        // FIX MOBILE: Use fixed positioning on mobile to break out of relative parent constraints and ensure visibility.
        // On desktop (sm+), revert to absolute positioning relative to the bell icon.
        <div className="fixed right-2 top-16 mt-1 w-[95vw] max-w-[320px] sm:absolute sm:right-0 sm:left-auto sm:top-full sm:mt-2 sm:w-80 bg-white rounded-md shadow-lg z-50 ring-1 ring-black ring-opacity-5 animate-fade-in-down origin-top-right">
            <div className="px-4 py-2 border-b flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-700">Notifiche</h3>
                {notifications.length > 0 && (
                    <button 
                        onClick={handleDismiss} 
                        disabled={isSaving}
                        className="text-[10px] text-indigo-600 font-bold hover:underline disabled:opacity-50"
                    >
                        {isSaving ? <Spinner /> : (selectedIds.length > 0 ? `Segna letti (${selectedIds.length})` : 'Segna tutti letti')}
                    </button>
                )}
            </div>
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center items-center py-4">
                        <Spinner />
                    </div>
                ) : sortedNotifications.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">Nessuna nuova notifica.</p>
                ) : (
                    <ul>
                        {sortedNotifications.map(notification => (
                            <li key={notification.id} className="border-b last:border-b-0 border-slate-100 relative hover:bg-slate-50 transition-colors">
                                <div className="flex items-center w-full">
                                    <button
                                        onClick={() => onNotificationClick(notification)}
                                        className="flex-1 text-left px-4 py-3 flex items-start space-x-3 min-w-0"
                                    >
                                        <div className="flex-shrink-0 mt-0.5">
                                            {notification.type === 'expiry' || notification.type === 'balance_due' ? 
                                                <span className="text-amber-500"><ClockIcon /></span> : 
                                                <span className="text-red-500"><ExclamationIcon /></span>
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-600 leading-tight break-words font-medium">{notification.message}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">{formatDate(notification.date)}</p>
                                        </div>
                                    </button>
                                    
                                    <div className="pr-4 pl-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                         <input 
                                            type="checkbox" 
                                            checked={selectedIds.includes(notification.id)}
                                            onChange={() => toggleSelection(notification.id)}
                                            className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                                         />
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default NotificationsDropdown;
