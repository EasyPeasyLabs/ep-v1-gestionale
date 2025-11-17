
import React, { useState, useEffect, useRef } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { Page } from '../App';
import { Notification, EnrollmentStatus, ClientType, ParentClient, InstitutionalClient } from '../types';
import { getAllEnrollments } from '../services/enrollmentService';
import { getClients } from '../services/parentService';

import SearchIcon from './icons/SearchIcon';
import BellIcon from './icons/BellIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import LogoutIcon from './icons/LogoutIcon';
import ProfileIcon from './icons/ProfileIcon';
import NotificationsDropdown from './NotificationsDropdown';


interface HeaderProps {
    user: User;
    setCurrentPage: (page: Page) => void;
}

const Header: React.FC<HeaderProps> = ({ user, setCurrentPage }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loadingNotifications, setLoadingNotifications] = useState(true);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Errore durante il logout:", error);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setNotificationsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        const generateNotifications = async () => {
            setLoadingNotifications(true);
            try {
                const [enrollments, clients] = await Promise.all([
                    getAllEnrollments(),
                    getClients()
                ]);

                const clientMap = new Map<string, string>();
                clients.forEach(c => {
                    if (c.clientType === ClientType.Parent) {
                        clientMap.set(c.id, `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}`);
                    } else {
                        clientMap.set(c.id, (c as InstitutionalClient).companyName);
                    }
                });

                const newNotifications: Notification[] = [];
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Normalize to start of day
                const sevenDaysFromNow = new Date(today);
                sevenDaysFromNow.setDate(today.getDate() + 7);

                enrollments.forEach(enr => {
                    if (enr.status !== EnrollmentStatus.Active) return;
                    const parentName = clientMap.get(enr.clientId) || 'Cliente';

                    // Check for expiring enrollments
                    const endDate = new Date(enr.endDate);
                    if (endDate >= today && endDate <= sevenDaysFromNow) {
                        const diffTime = endDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        newNotifications.push({
                            id: enr.id,
                            type: 'expiry',
                            message: `L'iscrizione di ${enr.childName} (${parentName}) scade tra ${diffDays} giorni.`,
                            clientId: enr.clientId,
                            date: new Date().toISOString(),
                        });
                    }

                    // Check for low lessons
                    if (enr.lessonsRemaining > 0 && enr.lessonsRemaining <= 2) {
                        newNotifications.push({
                            id: `${enr.id}-lessons`, // Make ID unique
                            type: 'low_lessons',
                            message: `Restano solo ${enr.lessonsRemaining} lezioni per ${enr.childName} (${parentName}).`,
                            clientId: enr.clientId,
                            date: new Date().toISOString(),
                        });
                    }
                });
                
                setNotifications(newNotifications);
            } catch (error) {
                console.error("Failed to fetch data for notifications:", error);
            } finally {
                setLoadingNotifications(false);
            }
        };

        generateNotifications();
    }, []);


  return (
    <header className="h-16 bg-white shadow-sm flex-shrink-0 flex items-center justify-between px-4 md:px-6 lg:px-8 border-b" style={{ backgroundColor: 'var(--md-bg-card)', borderColor: 'var(--md-divider)'}}>
      <div className="relative w-full max-w-xs">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon />
        </div>
        <input
          type="text"
          placeholder="Cerca..."
          className="block w-full bg-gray-100 border border-transparent rounded-md py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative" ref={notificationsRef}>
            <button onClick={() => setNotificationsOpen(!notificationsOpen)} className="md-icon-btn relative">
                <BellIcon />
                 {!loadingNotifications && notifications.length > 0 && (
                    <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-xs font-bold text-white rounded-full" style={{backgroundColor: 'var(--md-red)'}}>{notifications.length}</span>
                )}
            </button>
             {notificationsOpen && (
                <NotificationsDropdown
                    notifications={notifications}
                    loading={loadingNotifications}
                    onNotificationClick={() => {
                        setCurrentPage('Clients');
                        setNotificationsOpen(false);
                    }}
                />
            )}
        </div>
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center text-sm font-medium" style={{ color: 'var(--md-text-secondary)'}}>
                <span className="truncate max-w-24 md:max-w-none">{user.email}</span>
                <ChevronDownIcon />
            </button>
             {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md py-1 z-20 md-card animate-fade-in-down">
                    <button 
                        onClick={() => {
                          setCurrentPage('Profile');
                          setDropdownOpen(false);
                        }}
                        className="w-full flex items-center px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
                        style={{ color: 'var(--md-text-primary)'}}
                    >
                        <ProfileIcon />
                        <span className="ml-2">Il mio Profilo</span>
                    </button>
                    <button 
                        onClick={handleLogout} 
                        className="w-full flex items-center px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
                         style={{ color: 'var(--md-text-primary)'}}
                    >
                        <LogoutIcon />
                        <span className="ml-2">Logout</span>
                    </button>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;