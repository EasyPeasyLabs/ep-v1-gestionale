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
    <nav className="w-64 bg-white shadow-lg flex-shrink-0 flex flex-col">
      <div className="h-16 flex items-center justify-center border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 tracking-wider">EP <span className="text-indigo-600">v.1</span></h1>
      </div>
      <ul className="flex-1 px-4 py-6">
        {navItems.map((item) => (
          // Exclude 'Profile' from the main navigation
          item.page !== 'Profile' && (
            <li key={item.page}>
              <button
                onClick={() => setCurrentPage(item.page)}
                className={`w-full flex items-center px-4 py-3 my-1 rounded-lg text-left text-slate-600 font-medium transition-all duration-200 ease-in-out
                  ${currentPage === item.page ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100 hover:text-slate-800'}`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </button>
            </li>
          )
        ))}
      </ul>
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center">
            <img 
              src={user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`} 
              alt={user.email || 'User Avatar'} 
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="ml-3 overflow-hidden">
                <p className="font-semibold text-sm text-slate-700 truncate">{user.email}</p>
                <p className="text-xs text-slate-500">Amministratore</p>
            </div>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;