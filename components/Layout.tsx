
import React, { useState } from 'react';

interface LayoutProps {
    children: React.ReactNode;
    menuItems: { id: string; label: string; icon: React.FC<{ className?: string }> }[];
    activeApp: string;
    setActiveApp: (app: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, menuItems, activeApp, setActiveApp }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const NavLink: React.FC<{ item: any, isSidebar: boolean }> = ({ item, isSidebar }) => (
        <button
            onClick={() => {
                setActiveApp(item.id);
                setSidebarOpen(false);
            }}
            className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                activeApp === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            } ${isSidebar ? 'justify-start' : 'flex-col justify-center text-xs'}`}
        >
            <item.icon className={isSidebar ? 'h-6 w-6 mr-3' : 'h-5 w-5 mb-1'} />
            <span>{item.label}</span>
        </button>
    );

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
            {/* Sidebar for desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 space-y-2">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-6 px-2">EP v.1</div>
                {menuItems.map((item) => <NavLink key={item.id} item={item} isSidebar={true} />)}
            </aside>

            {/* Mobile Sidebar (off-canvas) */}
            <div className={`fixed inset-0 z-30 bg-black bg-opacity-50 transition-opacity md:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setSidebarOpen(false)}></div>
            <aside className={`fixed top-0 left-0 z-40 w-64 h-full bg-white dark:bg-gray-800 p-4 space-y-2 transform transition-transform md:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                 <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-6 px-2">EP v.1</div>
                {menuItems.map((item) => <NavLink key={item.id} item={item} isSidebar={true} />)}
            </aside>


            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 md:justify-end">
                    <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-500 focus:outline-none">
                        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 6H20M4 12H20M4 18H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <div className="font-semibold text-xl">{activeApp}</div>
                </header>
                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                    {children}
                </main>
            </div>
            {/* Bottom Nav for mobile */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around">
                 {menuItems.slice(0, 5).map(item => <NavLink key={item.id} item={item} isSidebar={false} />)}
            </nav>
        </div>
    );
};
