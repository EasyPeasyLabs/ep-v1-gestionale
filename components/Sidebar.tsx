
import React, { useEffect, useState } from 'react';
import { Page } from '../types';
import { User } from 'firebase/auth';
import DashboardIcon from './icons/DashboardIcon';
import ClientsIcon from './icons/ClientsIcon';
import SuppliersIcon from './icons/SuppliersIcon';
import SettingsIcon from './icons/SettingsIcon';
import CalendarIcon from './icons/CalendarIcon';
import CRMIcon from './icons/CRMIcon';
import ChecklistIcon from './icons/ChecklistIcon';
import ClipboardIcon from './icons/ClipboardIcon';
import BookOpenIcon from './icons/BookOpenIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import { getCompanyInfo } from '../services/settingsService';

// Nuova icona Pallone da Calcio per Attività
const SoccerBallIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16l-4-3 1.5-4.5h5l1.5 4.5-4 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 13l-6 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 13l6 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 8.5L5 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 8.5L19 4" />
  </svg>
);

// Nuova icona Moneta Euro per Finanza
const EuroCoinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 15.536c-1.171 1.952-3.07 1.952-4.242 0-1.172-1.953-1.172-5.119 0-7.072 1.171-1.952 3.07-1.952 4.242 0M8 10.5h4m-4 3h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 10.5a3.5 3.5 0 0 1 3.5 -3.5h1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5a3.5 3.5 0 0 0 3.5 3.5h1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h5" />
  </svg>
);

interface NavItem {
    page?: Page;
    label: string;
    icon: React.ReactNode;
    subItems?: { page: Page; label: string }[];
}

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  user: User;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, user, isOpen, setIsOpen }) => {
  const [logoSrc, setLogoSrc] = useState<string>('');
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  useEffect(() => {
      const fetchLogo = async () => {
          try {
              const info = await getCompanyInfo();
              if (info.logoBase64) {
                  setLogoSrc(info.logoBase64);
              }
          } catch (e) {
              console.error("Error loading logo", e);
          }
      };
      fetchLogo();
      
      // Ascolta aggiornamenti del logo dalle impostazioni
      const handleUpdate = () => fetchLogo();
      window.addEventListener('EP_DataUpdated', handleUpdate);
      return () => window.removeEventListener('EP_DataUpdated', handleUpdate);
  }, []);

  // Espandi automaticamente il menu se la pagina corrente è un sottomenu
  useEffect(() => {
      if (currentPage === 'Attendance' || currentPage === 'AttendanceArchive') {
          setExpandedMenu('Presenze');
      } else if (currentPage === 'ActivityLog' || currentPage === 'Homeworks') {
          setExpandedMenu('Registro Elettronico');
      } else if (currentPage === 'Activities' || currentPage === 'Initiatives') {
          setExpandedMenu('Attività');
      }
  }, [currentPage]);

  // Definizione Menu
  const navItems: NavItem[] = [
    { page: 'Dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { page: 'Calendar', label: 'Calendario', icon: <CalendarIcon /> },
    { page: 'Enrollments', label: 'Iscrizioni', icon: <ChecklistIcon /> },
    { 
        label: 'Registro Elettronico', 
        icon: <BookOpenIcon />,
        subItems: [
            { page: 'ActivityLog', label: 'Lezioni' },
            { page: 'Homeworks', label: 'Compiti' }
        ]
    }, 
    { 
      label: 'Presenze', 
      icon: <ClipboardIcon />,
      subItems: [
          { page: 'Attendance', label: 'Registro' },
          { page: 'AttendanceArchive', label: 'Archivio' }
      ]
    },
    { page: 'Finance', label: 'Finanza', icon: <EuroCoinIcon /> },
    { page: 'CRM', label: 'CRM', icon: <CRMIcon /> },
    { page: 'Clients', label: 'Clienti', icon: <ClientsIcon /> },
    { page: 'Suppliers', label: 'Fornitori', icon: <SuppliersIcon /> },
    { 
      label: 'Attività', 
      icon: <SoccerBallIcon />,
      subItems: [
          { page: 'Activities', label: 'Activities' }, // Libreria
          { page: 'Initiatives', label: 'Iniziative' } // Peek-a-Boo & Altro
      ]
    }, 
    { page: 'Settings', label: 'Impostazioni', icon: <SettingsIcon /> },
  ];

  const handleNavClick = (page: Page) => {
    // DEBUG LISTENER 1: Click su elemento menu
    console.log('[DEBUG 1] Sidebar: Click su menu', page);
    setCurrentPage(page);
    setIsOpen(false);
  }

  const toggleSubMenu = (label: string) => {
      // DEBUG LISTENER 2: Click su sottomenu
      console.log('[DEBUG 2] Sidebar: Toggle sottomenu', label);
      setExpandedMenu(prev => prev === label ? null : label);
  }

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className={`fixed inset-0 bg-slate-900/50 z-30 transition-opacity backdrop-blur-sm md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      ></div>

      <nav className={`w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col fixed md:relative h-full z-40 transition-transform transform md:translate-x-0 duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header Logo with Image */}
        <div className="h-20 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
             {logoSrc ? (
                 <img 
                    src={logoSrc} 
                    alt="EP Logo" 
                    className="w-10 h-10 object-contain" 
                 />
             ) : (
                 // Fallback visuale mentre carica
                 <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse"></div>
             )}
             <div>
                <h1 className="text-lg font-bold tracking-tight text-gray-800 leading-tight">EP v1</h1>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Gestionale</p>
             </div>
          </div>
        </div>

        {/* Navigation List */}
        <ul className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item, idx) => {
            
            if (item.subItems) {
                // Render Group Item (Collapsible)
                const isExpanded = expandedMenu === item.label;
                const isActiveParent = item.subItems.some(sub => sub.page === currentPage);

                return (
                    <li key={`group-${idx}`} className="mb-1">
                        <button
                            onClick={() => toggleSubMenu(item.label)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-in-out group
                                ${isActiveParent 
                                    ? 'bg-indigo-50 text-indigo-700' 
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <div className="flex items-center">
                                <span className={`mr-3 transition-colors ${isActiveParent ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                    {item.icon}
                                </span>
                                {item.label}
                            </div>
                            <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                <ChevronDownIcon />
                            </span>
                        </button>
                        
                        {/* Sub Items */}
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-40 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                            <ul className="space-y-1 pl-11 pr-2">
                                {item.subItems.map(sub => {
                                    const isSubActive = currentPage === sub.page;
                                    return (
                                        <li key={sub.page}>
                                            <button
                                                onClick={() => handleNavClick(sub.page)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all
                                                    ${isSubActive 
                                                        ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' 
                                                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {sub.label}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </li>
                );
            }

            // Render Single Item
            const isActive = currentPage === item.page;
            return (
                <li key={item.page}>
                  <button
                    onClick={() => item.page && handleNavClick(item.page)}
                    className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-in-out group relative
                      ${isActive 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <span className={`mr-3 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                        {item.icon}
                    </span>
                    {item.label}
                    
                    {/* Pill Indicator for Active State */}
                    {isActive && <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-indigo-600"></div>}
                  </button>
                </li>
            );
          })}
        </ul>

        {/* Footer Profile */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/30">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer" onClick={() => handleNavClick('Profile')}>
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-200">
                  {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="overflow-hidden flex-1">
                  <p className="font-medium text-xs text-gray-900 truncate" title={user.email || ''}>{user.email}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Admin</p>
              </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;
