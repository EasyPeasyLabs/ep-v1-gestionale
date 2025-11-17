
import React from 'react';
import { Page } from '../App';
import { User } from 'firebase/auth';
import DashboardIcon from './icons/DashboardIcon';
import ClientsIcon from './icons/ClientsIcon';
import SuppliersIcon from './icons/SuppliersIcon';
import FinanceIcon from './icons/FinanceIcon';
import SettingsIcon from './icons/SettingsIcon';
import CalendarIcon from './icons/CalendarIcon';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  user: User;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, user }) => {
  const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
    { page: 'Dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { page: 'Clients', label: 'Clienti', icon: <ClientsIcon /> },
    { page: 'Suppliers', label: 'Fornitori', icon: <SuppliersIcon /> },
    { page: 'Calendar', label: 'Calendario', icon: <CalendarIcon /> },
    { page: 'Finance', label: 'Finanza', icon: <FinanceIcon /> },
    { page: 'Settings', label: 'Impostazioni', icon: <SettingsIcon /> },
  ];

  return (
    <nav className="w-64 bg-white shadow-lg flex-shrink-0 flex flex-col" style={{ backgroundColor: 'var(--md-bg-card)'}}>
      <div className="h-16 flex items-center justify-center border-b" style={{ borderColor: 'var(--md-divider)'}}>
        <h1 className="text-2xl font-bold tracking-wider" style={{ color: 'var(--md-text-primary)'}}>EP <span style={{ color: 'var(--md-primary)'}}>v.1</span></h1>
      </div>
      <ul className="flex-1 px-4 py-6">
        {navItems.map((item) => (
          item.page !== 'Profile' && (
            <li key={item.page}>
              <button
                onClick={() => setCurrentPage(item.page)}
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
  );
};

export default Sidebar;