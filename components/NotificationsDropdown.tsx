
import React from 'react';
import { Notification } from '../types';
import Spinner from './Spinner';
import ClockIcon from './icons/ClockIcon';
import ExclamationIcon from './icons/ExclamationIcon';

interface NotificationsDropdownProps {
    notifications: Notification[];
    loading: boolean;
    onNotificationClick: (notification: Notification) => void;
}

const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ notifications, loading, onNotificationClick }) => {
    
    const handleDismissAll = () => {
        const currentIgnored = JSON.parse(localStorage.getItem('ep_ignored_notifications') || '[]');
        const newIds = notifications.map(n => n.id);
        localStorage.setItem('ep_ignored_notifications', JSON.stringify([...currentIgnored, ...newIds]));
        // Triggera evento per aggiornare (trucchetto per refreshare Header)
        window.dispatchEvent(new Event('EP_DataUpdated'));
    };

    return (
        // FIX MOBILE: Use fixed positioning on mobile to break out of relative parent constraints and ensure visibility.
        // On desktop (sm+), revert to absolute positioning relative to the bell icon.
        <div className="fixed right-2 top-16 mt-1 w-[95vw] max-w-[320px] sm:absolute sm:right-0 sm:left-auto sm:top-full sm:mt-2 sm:w-80 bg-white rounded-md shadow-lg z-50 ring-1 ring-black ring-opacity-5 animate-fade-in-down origin-top-right">
            <div className="px-4 py-2 border-b flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-700">Notifiche</h3>
                {notifications.length > 0 && (
                    <button onClick={handleDismissAll} className="text-[10px] text-indigo-600 font-bold hover:underline">
                        Segna tutti letti
                    </button>
                )}
            </div>
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center items-center py-4">
                        <Spinner />
                    </div>
                ) : notifications.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">Nessuna nuova notifica.</p>
                ) : (
                    <ul>
                        {notifications.map(notification => (
                            <li key={notification.id}>
                                <button
                                    onClick={() => onNotificationClick(notification)}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b last:border-b-0 border-slate-100"
                                >
                                    <div className="flex items-start space-x-3">
                                        <div className="flex-shrink-0 mt-0.5">
                                            {notification.type === 'expiry' || notification.type === 'balance_due' ? 
                                                <span className="text-amber-500"><ClockIcon /></span> : 
                                                <span className="text-red-500"><ExclamationIcon /></span>
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-600 leading-tight break-words">{notification.message}</p>
                                        </div>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default NotificationsDropdown;
