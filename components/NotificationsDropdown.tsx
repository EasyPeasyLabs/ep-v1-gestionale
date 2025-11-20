
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
    return (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg z-20 ring-1 ring-black ring-opacity-5 animate-fade-in-down">
            <div className="px-4 py-2 border-b">
                <h3 className="text-sm font-semibold text-slate-700">Notifiche</h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
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
                                            {notification.type === 'expiry' ? 
                                                <span className="text-amber-500"><ClockIcon /></span> : 
                                                <span className="text-red-500"><ExclamationIcon /></span>
                                            }
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-600 leading-tight">{notification.message}</p>
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
