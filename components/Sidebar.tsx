
import React from 'react';
import { Page } from '../App';
// FIX: Corrected Firebase import path.
import { User } from '@firebase/auth';
import DashboardIcon from './icons/DashboardIcon';
import ClientsIcon from './icons/ClientsIcon';
import SuppliersIcon from './icons/SuppliersIcon';
import SettingsIcon from './icons/SettingsIcon';
import CalendarIcon from './icons/CalendarIcon';
import CRMIcon from './icons/CRMIcon';
import ChecklistIcon from './icons/ChecklistIcon';
import ClipboardIcon from './icons/ClipboardIcon';
import BookOpenIcon from './icons/BookOpenIcon';

// Nuova icona Pallone da Calcio per Attività
const SoccerBallIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 15.536c-1.171 1.952-3.07 1.952-4.242 0-1.172-1.953-1.172-5.119 0-7.072 1.171-1.952 3.07-1.952 4.242 0M8 10.5h4m-4 3h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 10.5a3.5 3.5 0 0 1 3.5 -3.5h1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5a3.5 3.5 0 0 0 3.5 3.5h1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h5" />
  </svg>
);

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  user: User;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, user, isOpen, setIsOpen }) => {
  // Definizione Menu
  const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
    { page: 'Dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { page: 'Enrollments', label: 'Iscrizioni', icon: <ChecklistIcon /> },
    { page: 'ActivityLog', label: 'Lezioni', icon: <BookOpenIcon /> }, // Ex Registro Attività
    { page: 'Attendance', label: 'Registro Presenze', icon: <ClipboardIcon /> },
    { page: 'Calendar', label: 'Calendario', icon: <CalendarIcon /> },
    { page: 'Finance', label: 'Finanza', icon: <EuroCoinIcon /> },
    { page: 'CRM', label: 'CRM', icon: <CRMIcon /> },
    { page: 'Clients', label: 'Clienti', icon: <ClientsIcon /> },
    { page: 'Suppliers', label: 'Fornitori', icon: <SuppliersIcon /> },
    { page: 'Activities', label: 'Attività', icon: <SoccerBallIcon /> }, 
    { page: 'Settings', label: 'Impostazioni', icon: <SettingsIcon /> },
  ];

  const handleNavClick = (page: Page) => {
    setCurrentPage(page);
    setIsOpen(false);
  }

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      ></div>

      <nav className={`w-64 bg-white shadow-lg flex-shrink-0 flex flex-col fixed md:relative h-full z-40 transition-transform transform md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ backgroundColor: 'var(--md-bg-card)'}}>
        <div className="h-16 flex items-center px-4 border-b" style={{ borderColor: 'var(--md-divider)'}}>
          <div className="flex items-center gap-3">
             <h1 className="text-xl font-bold tracking-wider" style={{ color: 'var(--md-text-primary)'}}>EP v1</h1>
          </div>
        </div>
        <ul className="flex-1 px-4 py-6 overflow-y-auto">
          {navItems.map((item) => (
            item.page !== 'Profile' && (
              <li key={item.page}>
                <button
                  onClick={() => handleNavClick(item.page)}
                  className={`w-full flex items-center px-4 py-3 my-1 rounded-lg text-left font-medium transition-all duration-200 ease-in-out
                    ${currentPage === item.page ? 'text-white' : 'hover:bg-gray-100'}`}
                  style={currentPage === item.page ? { backgroundColor: 'var(--md-primary)' } : { color: 'var(--md-text-secondary)'}}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </button>
              </li>
            )
          ))}
        </ul>
        <div className="p-4 border-t" style={{ borderColor: 'var(--md-divider)'}}>
          <div className="flex items-center">
              <div className="overflow-hidden">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--md-text-primary)'}}>{user.email}</p>
                  <p className="text-xs" style={{ color: 'var(--md-text-secondary)'}}>Amministratore</p>
              </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;
