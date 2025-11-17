
import React from 'react';
import SearchIcon from './icons/SearchIcon';
import BellIcon from './icons/BellIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';

const Header: React.FC = () => {
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
        <div className="flex items-center">
             <img src="https://i.pravatar.cc/150?u=ilaria" alt="Ilaria Tavani" className="w-9 h-9 rounded-full"/>
             <button className="ml-2 flex items-center text-sm font-medium text-slate-600 hover:text-slate-900">
                <span>Ilaria Tavani</span>
                <ChevronDownIcon />
             </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
