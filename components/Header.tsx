
import React, { useState, useEffect, useRef } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { Page } from '../App';
import SearchIcon from './icons/SearchIcon';
import BellIcon from './icons/BellIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import LogoutIcon from './icons/LogoutIcon';
import ProfileIcon from './icons/ProfileIcon';


interface HeaderProps {
    user: User;
    setCurrentPage: (page: Page) => void;
}

const Header: React.FC<HeaderProps> = ({ user, setCurrentPage }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);


  return (
    <header className="h-16 bg-white shadow-sm flex-shrink-0 flex items-center justify-between px-4 md:px-6 lg:px-8 border-b border-slate-200">
      <div className="relative w-full max-w-xs">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon />
        </div>
        <input
          type="text"
          placeholder="Cerca..."
          className="block w-full bg-slate-100 border border-transparent rounded-md py-2 pl-10 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div className="flex items-center space-x-4">
        <button className="p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <BellIcon />
        </button>
        <div className="relative" ref={dropdownRef}>
            <div className="flex items-center">
                <img 
                  src={user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`} 
                  alt={user.email || 'User Avatar'} 
                  className="w-9 h-9 rounded-full object-cover"
                />
                <button onClick={() => setDropdownOpen(!dropdownOpen)} className="ml-2 flex items-center text-sm font-medium text-slate-600 hover:text-slate-900">
                    <span className="truncate max-w-24 md:max-w-none">{user.email}</span>
                    <ChevronDownIcon />
                </button>
            </div>
             {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 ring-1 ring-black ring-opacity-5 animate-fade-in-down">
                    <button 
                        onClick={() => {
                          setCurrentPage('Profile');
                          setDropdownOpen(false);
                        }}
                        className="w-full flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    >
                        <ProfileIcon />
                        <span className="ml-2">Il mio Profilo</span>
                    </button>
                    <button 
                        onClick={handleLogout} 
                        className="w-full flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
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