
import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Suppliers from './pages/Suppliers';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import LoginPage from './pages/LoginPage';
import FullScreenSpinner from './components/FullScreenSpinner';

export type Page = 'Dashboard' | 'Clients' | 'Suppliers' | 'Finance' | 'Settings' | 'Profile';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth]);


  const renderContent = () => {
    if (!user) return null; // Should not happen if user is logged in
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
      case 'Profile':
        return <Profile user={user} />;
      default:
        return <Dashboard />;
    }
  };

  if (loadingAuth) {
    return <FullScreenSpinner />;
  }
  
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800">
      <Sidebar 
        user={user}
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} setCurrentPage={setCurrentPage} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 p-4 md:p-6 lg:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;