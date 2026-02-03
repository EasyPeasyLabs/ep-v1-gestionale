
import React, { useEffect, useState } from 'react';
import { Page } from '../types';
import type { User } from 'firebase/auth';
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
import ArchiveIcon from './icons/ArchiveIcon'; 
import IdentificationIcon from './icons/IdentificationIcon';
import BellIcon from './icons/BellIcon';
import { getCompanyInfo } from '../services/settingsService';

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

const EuroCoinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 15.536c-1.171 1.952-3.07 1.952-4.242 0-1.172-1.953-1.172-5.119 0-7.072 1.171-1.952 3.07-1.952 4.242 0M8 10.5h4m-4 3h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 10.5a3.5 3.5 0 0 1 3.5 -3.5h1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5a3.5 3.5 0 0 0 3.5 3.5h1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h5" />
  </svg>
);

const BookInfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11h.01M12 14h.01" />
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
      const handleUpdate = () => fetchLogo();
      window.addEventListener('EP_DataUpdated', handleUpdate);
      return () => window.removeEventListener('EP_DataUpdated', handleUpdate);
  }, []);

  useEffect(() => {
      if (currentPage === 'Attendance' || currentPage === 'AttendanceArchive') {
          setExpandedMenu('Presenze');
      } else if (currentPage === 'ActivityLog' || currentPage === 'Homeworks') {
          setExpandedMenu('Registro Elettronico');
      } else if (currentPage === 'Activities' || currentPage === 'Initiatives') {
          setExpandedMenu('Attività');
      }
  }, [currentPage]);

  const navItems: NavItem[] = [
    { page: 'Dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { page: 'Calendar', label: 'Calendario', icon: <CalendarIcon /> },
    { page: 'Enrollments', label: 'Iscrizioni', icon: <ChecklistIcon /> },
    { page: 'EnrollmentArchive', label: 'Archivio Iscrizioni', icon: <ArchiveIcon /> },
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
    { page: 'ClientSituation', label: 'Situazione Clienti', icon: <IdentificationIcon /> },
    { page: 'Suppliers', label: 'Fornitori', icon: <SuppliersIcon /> },
    { 
      label: 'Attività', 
      icon: <SoccerBallIcon />,
      subItems: [
          { page: 'Activities', label: 'Activities' }, 
          { page: 'Initiatives', label: 'Iniziative' } 
      ]
    }, 
    { page: 'Settings', label: 'Impostazioni', icon: <SettingsIcon /> },
    { page: 'NotificationPlanning', label: 'Pianificazione Avvisi', icon: <BellIcon /> },
    { page: 'Manual', label: 'Manuale d\'Uso', icon: <BookInfoIcon /> },
  ];

  const handleNavClick = (page: Page) => {
    setCurrentPage(page);
    setIsOpen(false);
  }

  const toggleSubMenu = (label: string) => {
      setExpandedMenu(prev => prev === label ? null : label);
  }

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/50 z-30 transition-opacity backdrop-blur-sm md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      ></div>

      <nav className={`w-72 bg-white flex-shrink-0 flex flex-col fixed md:relative h-full z-40 transition-transform transform md:translate-x-0 duration-300 ease-in-out border-r border-gray-100 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="h-28 flex items-center justify-center mx-4 mb-2">
          <div className="flex flex-col items-center">
             {logoSrc ? (
                 <img 
                    src={logoSrc} 
                    alt="EP Logo" 
                    className="w-16 h-16 object-contain mb-2" 
                 />
             ) : (
                 <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white font-black text-xl mb-2">ep</div>
             )}
             <div className="text-center">
                <h1 className="text-2xl font-black tracking-wide text-gray-900 leading-none">easypeasy</h1> 
             </div>
          </div>
        </div>

        <ul className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item, idx) => {
            if (item.subItems) {
                const isExpanded = expandedMenu === item.label;
                const isActiveParent = item.subItems.some(sub => sub.page === currentPage);
                return (
                    <li key={`group-${idx}`} className="mb-2">
                        <button
                            onClick={() => toggleSubMenu(item.label)}
                            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 ease-in-out group
                                ${isActiveParent 
                                    ? 'text-gray-900 bg-gray-50' 
                                    : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center">
                                <span className={`mr-4 transition-colors ${isActiveParent ? 'text-[#3C3C52]' : 'text-gray-300 group-hover:text-[#3C3C52]'}`}>
                                    {item.icon}
                                </span>
                                {item.label}
                            </div>
                            <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                <ChevronDownIcon />
                            </span>
                        </button>
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                            <ul className="space-y-1 pl-12 pr-2">
                                {item.subItems.map(sub => {
                                    const isSubActive = currentPage === sub.page;
                                    return (
                                        <li key={sub.page}>
                                            <button
                                                onClick={() => handleNavClick(sub.page)}
                                                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative flex items-center
                                                    ${isSubActive 
                                                        ? 'text-gray-900 font-bold bg-amber-50' 
                                                        : 'text-gray-400 hover:text-gray-900'
                                                    }`}
                                            >
                                                {isSubActive && <span className="absolute -left-1 w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
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
            const isActive = currentPage === item.page;
            return (
                <li key={item.page} className="mb-2 relative">
                  <button
                    onClick={() => item.page && handleNavClick(item.page)}
                    className={`w-full flex items-center px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 ease-in-out relative
                      ${isActive 
                        ? 'text-gray-900 bg-amber-400 shadow-md shadow-amber-200/50' 
                        : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                  >
                    <span className={`mr-4 transition-colors ${isActive ? 'text-gray-900' : 'text-gray-300 group-hover:text-[#3C3C52]'}`}>
                        {item.icon}
                    </span>
                    {item.label}
                  </button>
                </li>
            );
          })}
        </ul>

        <div className="p-6 mt-2">
          <div 
            className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-md transition-all cursor-pointer" 
            onClick={() => handleNavClick('Profile')}
          >
              <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="overflow-hidden flex-1">
                  <p className="font-bold text-sm text-gray-900 truncate">{user.email?.split('@')[0]}</p>
                  <p className="text-[10px] text-gray-400 font-medium">Admin</p>
              </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;
