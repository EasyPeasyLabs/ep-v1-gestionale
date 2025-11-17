
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Suppliers from './pages/Suppliers';
import Finance from './pages/Finance';
import Settings from './pages/Settings';

export type Page = 'Dashboard' | 'Clients' | 'Suppliers' | 'Finance' | 'Settings';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('Dashboard');

  const renderContent = () => {
    switch (currentPage) {
      case 'Dashboard':
        return <Dashboard />;
      case 'Clients':
        return <Clients />;
      case 'Suppliers':
        return <Suppliers />;
      case 'Finance':
        return <Finance />;
      case 'Settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 p-4 md:p-6 lg:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
