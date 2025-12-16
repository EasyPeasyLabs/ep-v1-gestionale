
import React, { useState, useEffect, useRef, useCallback } from 'react';
// FIX: Corrected Firebase import path.
import { User, signOut } from '@firebase/auth';
import { auth } from '../firebase/config';
import { Page } from '../App';
import { Notification } from '../types';
import { getNotifications } from '../services/notificationService';
import { getCompanyInfo } from '../services/settingsService';

import SearchIcon from './icons/SearchIcon';
import BellIcon from './icons/BellIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import LogoutIcon from './icons/LogoutIcon';
import ProfileIcon from './icons/ProfileIcon';
import NotificationsDropdown from './NotificationsDropdown';
import MenuIcon from './icons/MenuIcon';


interface HeaderProps {
    user: User;
    setCurrentPage: (page: Page) => void;
    onNavigate?: (page: Page, params?: any) => void;
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, setCurrentPage, onNavigate, onMenuClick }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loadingNotifications, setLoadingNotifications] = useState(true);
    const [logoSrc, setLogoSrc] = useState<string>('');

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

    // Funzione centralizzata per le notifiche
    const fetchAndGenerateNotifications = useCallback(async () => {
        setLoadingNotifications(true);
        try {
            const notifs = await getNotifications(user.uid);
            setNotifications(notifs);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        } finally {
            setLoadingNotifications(false);
        }
    }, []);

    // Fetch logo function
    const fetchLogo = useCallback(async () => {
        try {
            const info = await getCompanyInfo();
            if (info.logoBase64) {
                setLogoSrc(info.logoBase64);
            }
        } catch (e) {
            console.error("Header: Error loading logo", e);
        }
    }, []);

    // Effect iniziale e listener per eventi globali
    useEffect(() => {
        fetchAndGenerateNotifications();
        fetchLogo();

        // Ascolta l'evento personalizzato per aggiornare le notifiche e il logo quando i dati cambiano altrove
        const handleDataUpdate = () => {
            fetchAndGenerateNotifications();
            fetchLogo();
        };

        window.addEventListener('EP_DataUpdated', handleDataUpdate);

        return () => {
            window.removeEventListener('EP_DataUpdated', handleDataUpdate);
        };
    }, [fetchAndGenerateNotifications, fetchLogo]);


  return (
    <header className="h-16 bg-white shadow-sm flex-shrink-0 flex items-center justify-between px-4 md:px-6 lg:px-8 border-b" style={{ backgroundColor: 'var(--md-bg-card)', borderColor: 'var(--md-divider)'}}>
      <div className="flex items-center">
        <button onClick={onMenuClick} className="md:hidden mr-4 md-icon-btn" aria-label="Apri menu">
          <MenuIcon />
        </button>
        
        {/* Mobile Logo - Visible only on small screens when Sidebar is hidden */}
        <div className="md:hidden flex items-center mr-4">
             {logoSrc ? (
                 <img src={logoSrc} alt="Logo" className="w-8 h-8 object-contain" />
             ) : (
                 <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
             )}
             <span className="ml-2 font-bold text-gray-700 text-sm">EP v1</span>
        </div>

        <div className="relative hidden md:block w-full max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon />
          </div>
          <input
            id="header-search"
            name="header-search"
            type="text"
            placeholder="Cerca..."
            className="block w-full bg-gray-100 border border-transparent rounded-md py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="flex items-center space-x-2 md:space-x-4">
        <div className="relative" ref={notificationsRef}>
            <button onClick={() => setNotificationsOpen(!notificationsOpen)} className="md-icon-btn relative" aria-label="Apri notifiche">
                <BellIcon />
                 {!loadingNotifications && notifications.length > 0 && (
                    <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-xs font-bold text-white rounded-full" style={{backgroundColor: 'var(--md-red)'}}>{notifications.length}</span>
                )}
            </button>
             {notificationsOpen && (
                <NotificationsDropdown
                    notifications={notifications}
                    loading={loadingNotifications}
                    onNotificationClick={(notif) => {
                        // Navigazione intelligente
                        const targetPage = (notif.linkPage as Page) || 'Finance';
                        
                        if (onNavigate) {
                            onNavigate(targetPage, notif.filterContext);
                        } else {
                            setCurrentPage(targetPage);
                        }
                        setNotificationsOpen(false);
                    }}
                />
            )}
        </div>
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center text-sm font-medium" style={{ color: 'var(--md-text-secondary)'}} aria-haspopup="true" aria-expanded={dropdownOpen}>
                <span className="truncate max-w-[100px] md:max-w-none">{user.email}</span>
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
