
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { type User, signOut } from '@firebase/auth';
import { auth } from '../firebase/config';
import { Page, ClientType, ParentClient, InstitutionalClient, Client } from '../types';
import { Notification } from '../types';
import { getNotifications } from '../services/notificationService';
import { getCompanyInfo } from '../services/settingsService';
import { searchGlobal, GlobalSearchResults } from '../services/globalSearchService';

import SearchIcon from './icons/SearchIcon';
import BellIcon from './icons/BellIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import LogoutIcon from './icons/LogoutIcon';
import ProfileIcon from './icons/ProfileIcon';
import NotificationsDropdown from './NotificationsDropdown';
import MenuIcon from './icons/MenuIcon';
import ClientsIcon from './icons/ClientsIcon';
import ChecklistIcon from './icons/ChecklistIcon';
import EuroCoinIcon from './icons/EuroCoinIcon';
import ClipboardIcon from './icons/ClipboardIcon'; // For Attendance
import IdentificationIcon from './icons/IdentificationIcon'; // For Client Situation

interface HeaderProps {
    user: User;
    setCurrentPage: (page: Page) => void;
    onNavigate?: (page: Page, params?: any) => void;
    onMenuClick: () => void;
}

const getClientName = (c: Client) => c.clientType === ClientType.Parent ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` : (c as InstitutionalClient).companyName;

const Header: React.FC<HeaderProps> = ({ user, setCurrentPage, onNavigate, onMenuClick }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loadingNotifications, setLoadingNotifications] = useState(true);
    const [logoSrc, setLogoSrc] = useState<string>('');

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<GlobalSearchResults | null>(null);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

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
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSearchDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Global Search Logic with Debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchTerm.trim().length >= 2) {
                setIsSearching(true);
                setShowSearchDropdown(true);
                try {
                    const results = await searchGlobal(searchTerm);
                    setSearchResults(results);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setShowSearchDropdown(false);
                setSearchResults(null);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleSearchResultClick = (page: Page, params: any) => {
        if (onNavigate) {
            onNavigate(page, params);
        } else {
            setCurrentPage(page);
        }
        setShowSearchDropdown(false);
        setSearchTerm('');
    };

    // Notifications & Logo
    const fetchAndGenerateNotifications = useCallback(async () => {
        setLoadingNotifications(true);
        try {
            const notifs = await getNotifications();
            setNotifications(notifs);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        } finally {
            setLoadingNotifications(false);
        }
    }, []);

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

    useEffect(() => {
        fetchAndGenerateNotifications();
        fetchLogo();
        const handleDataUpdate = () => {
            fetchAndGenerateNotifications();
            fetchLogo();
        };
        window.addEventListener('EP_DataUpdated', handleDataUpdate);
        return () => {
            window.removeEventListener('EP_DataUpdated', handleDataUpdate);
        };
    }, [fetchAndGenerateNotifications, fetchLogo]);

    const hasNotifications = !loadingNotifications && notifications.length > 0;

  return (
    <header className="h-16 bg-white shadow-sm flex-shrink-0 flex items-center justify-between px-4 md:px-6 lg:px-8 border-b relative z-30" style={{ backgroundColor: 'var(--md-bg-card)', borderColor: 'var(--md-divider)'}}>
      <div className="flex items-center flex-1 mr-4">
        <button onClick={onMenuClick} className="md:hidden mr-4 md-icon-btn" aria-label="Apri menu">
          <MenuIcon />
        </button>
        
        {/* Mobile Logo */}
        <div className="md:hidden flex items-center mr-4">
             {logoSrc ? (
                 <img src={logoSrc} alt="Logo" className="w-8 h-8 object-contain" />
             ) : (
                 <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
             )}
             <span className="ml-2 font-bold text-gray-700 text-sm">EP v1</span>
        </div>

        {/* Global Search Input */}
        <div className="relative hidden md:block w-full max-w-md" ref={searchRef}>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isSearching ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : <SearchIcon />}
          </div>
          <input
            id="header-search"
            name="header-search"
            type="text"
            placeholder="Cerca cliente, iscrizione o fattura..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => { if(searchTerm.length >= 2) setShowSearchDropdown(true); }}
            className="block w-full bg-gray-100 border border-transparent rounded-xl py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-2 focus:border-indigo-500 focus:ring-indigo-200 transition-all"
            autoComplete="off"
          />
          
          {/* Search Results Dropdown */}
          {showSearchDropdown && searchResults && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-down z-50 max-h-[80vh] overflow-y-auto">
                  
                  {/* Empty State */}
                  {Object.values(searchResults).every((arr: any) => arr.length === 0) && (
                      <div className="p-4 text-center text-gray-400 text-sm italic">
                          Nessun risultato trovato per "{searchTerm}".
                      </div>
                  )}

                  {/* 1. Client Situations (High Priority) */}
                  {searchResults.clientSituations.length > 0 && (
                      <div className="border-b border-gray-50 last:border-0">
                          <div className="bg-amber-50/50 px-4 py-2 text-[10px] font-black uppercase text-amber-500 tracking-wider flex items-center gap-2">
                              <IdentificationIcon /> Situazione Clienti
                          </div>
                          {searchResults.clientSituations.map(c => (
                              <button 
                                key={`sit-${c.id}`}
                                onClick={() => handleSearchResultClick('ClientSituation', { clientId: c.id })}
                                className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors flex justify-between items-center group"
                              >
                                  <div>
                                      <p className="text-sm font-bold text-slate-700 group-hover:text-amber-700">{getClientName(c)}</p>
                                      <p className="text-xs text-slate-400">Vai alla scheda completa</p>
                                  </div>
                                  <span className="text-xs text-amber-600">➜</span>
                              </button>
                          ))}
                      </div>
                  )}

                  {/* 2. Attendance (Lessons) */}
                  {searchResults.attendance.length > 0 && (
                      <div className="border-b border-gray-50 last:border-0">
                          <div className="bg-indigo-50/50 px-4 py-2 text-[10px] font-black uppercase text-indigo-500 tracking-wider flex items-center gap-2">
                              <ClipboardIcon /> Registro Presenze
                          </div>
                          {searchResults.attendance.map((att, idx) => (
                              <button 
                                key={`att-${idx}`}
                                onClick={() => handleSearchResultClick('Attendance', { date: att.date })}
                                className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors flex justify-between items-center group"
                              >
                                  <div>
                                      <p className="text-sm font-bold text-slate-700 group-hover:text-indigo-700">Lez: {att.childName}</p>
                                      <p className="text-xs text-slate-400">{new Date(att.date).toLocaleDateString('it-IT')} - {att.startTime}</p>
                                  </div>
                                  <span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase">{att.locationName}</span>
                              </button>
                          ))}
                      </div>
                  )}

                  {/* 3. Clients Results (Registry) */}
                  {searchResults.clients.length > 0 && (
                      <div className="border-b border-gray-50 last:border-0">
                          <div className="bg-gray-50/50 px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                              <ClientsIcon /> Anagrafica
                          </div>
                          {searchResults.clients.map(c => (
                              <button 
                                key={c.id}
                                onClick={() => handleSearchResultClick('Clients', { searchTerm: getClientName(c) })}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex justify-between items-center group"
                              >
                                  <div>
                                      <p className="text-sm font-bold text-slate-700">{getClientName(c)}</p>
                                      <p className="text-xs text-slate-400">{c.email}</p>
                                  </div>
                                  <span className="text-[10px] bg-white border px-2 py-0.5 rounded text-slate-500 uppercase">{c.clientType === 'parent' ? 'Genitore' : 'Ente'}</span>
                              </button>
                          ))}
                      </div>
                  )}

                  {/* 4. Enrollments Results */}
                  {searchResults.enrollments.length > 0 && (
                      <div className="border-b border-gray-50 last:border-0">
                          <div className="bg-gray-50/50 px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                              <ChecklistIcon /> Iscrizioni
                          </div>
                          {searchResults.enrollments.map(e => (
                              <button 
                                key={e.id}
                                onClick={() => handleSearchResultClick('Enrollments', { searchTerm: e.childName })}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex justify-between items-center group"
                              >
                                  <div>
                                      <p className="text-sm font-bold text-slate-700">{e.childName}</p>
                                      <p className="text-xs text-slate-400">{e.subscriptionName} • {e.locationName}</p>
                                  </div>
                                  <div className="text-right">
                                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${e.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{e.status}</span>
                                  </div>
                              </button>
                          ))}
                      </div>
                  )}

                  {/* 5. Financial Results (Invoices & Quotes) */}
                  {(searchResults.invoices.length > 0 || searchResults.quotes.length > 0) && (
                      <div>
                          <div className="bg-gray-50/50 px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                              <EuroCoinIcon /> Documenti
                          </div>
                          {searchResults.invoices.map(i => (
                              <button 
                                key={i.id}
                                onClick={() => handleSearchResultClick('Finance', { tab: 'invoices', searchTerm: i.invoiceNumber })}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex justify-between items-center group"
                              >
                                  <div>
                                      <p className="text-sm font-bold text-slate-700 font-mono">{i.invoiceNumber}</p>
                                      <p className="text-xs text-slate-400">{i.clientName}</p>
                                  </div>
                                  <span className="text-xs font-bold text-slate-600">{i.totalAmount.toFixed(2)}€</span>
                              </button>
                          ))}
                          {searchResults.quotes.map(q => (
                              <button 
                                key={q.id}
                                onClick={() => handleSearchResultClick('Finance', { tab: 'quotes', searchTerm: q.quoteNumber })}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex justify-between items-center group"
                              >
                                  <div>
                                      <p className="text-sm font-bold text-slate-700 font-mono">{q.quoteNumber}</p>
                                      <p className="text-xs text-slate-400">Preventivo - {q.clientName}</p>
                                  </div>
                                  <span className="text-xs font-bold text-slate-600">{q.totalAmount.toFixed(2)}€</span>
                              </button>
                          ))}
                      </div>
                  )}
              </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2 md:space-x-4">
        {/* Notifications Bell */}
        <div className="relative" ref={notificationsRef}>
            <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)} 
                className={`md-icon-btn relative transition-colors duration-300 ${hasNotifications ? '!bg-amber-400 !text-gray-900 hover:!bg-amber-500' : ''}`}
                aria-label="Apri notifiche"
            >
                <BellIcon />
                 {hasNotifications && (
                    <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-xs font-bold text-white rounded-full bg-red-600 border border-white">
                        {notifications.length}
                    </span>
                )}
            </button>
             {notificationsOpen && (
                <NotificationsDropdown
                    notifications={notifications}
                    loading={loadingNotifications}
                    onNotificationClick={(notif) => {
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

        {/* User Profile */}
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center text-sm font-medium" style={{ color: 'var(--md-text-secondary)'}} aria-haspopup="true" aria-expanded={dropdownOpen}>
                <span className="truncate max-w-[100px] md:max-w-none hidden md:block">{user.email}</span>
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