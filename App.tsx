
import React, { useState, useEffect } from 'react';
// FIX: Corrected Firebase import path.
import { onAuthStateChanged, User } from '@firebase/auth';
import { auth } from './firebase/config';
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
import Calendar from './pages/Calendar';
import CRM from './pages/CRM';
import Enrollments from './pages/Enrollments';
import Attendance from './pages/Attendance';
import Activities from './pages/Activities';
import ActivityLog from './pages/ActivityLog';
import NotificationScheduler from './components/NotificationScheduler';
import { requestNotificationPermission } from './services/fcmService';

export type Page = 'Dashboard' | 'Clients' | 'Suppliers' | 'Calendar' | 'CRM' | 'Finance' | 'Settings' | 'Profile' | 'Enrollments' | 'Attendance' | 'Activities' | 'ActivityLog';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
  const [pageParams, setPageParams] = useState<any>(null); // Stato per passare parametri alle pagine
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
      
      // Se l'utente è loggato, richiediamo il permesso per le notifiche push server-side
      if (currentUser) {
          requestNotificationPermission(currentUser.uid);
      }
    });
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Funzione di navigazione centralizzata che supporta parametri
  const handleNavigation = (page: Page, params?: any) => {
      setCurrentPage(page);
      setPageParams(params || null);
  };

  const renderContent = () => {
    if (!user) return null; // Should not happen if user is logged in
    switch (currentPage) {
      case 'Dashboard':
        return <Dashboard setCurrentPage={handleNavigation} />;
      case 'Enrollments':
        return <Enrollments initialParams={pageParams} />;
      case 'Attendance':
        return <Attendance />;
      case 'Activities':
        return <Activities />;
      case 'ActivityLog':
        return <ActivityLog />;
      case 'Clients':
        return <Clients />;
      case 'Suppliers':
        return <Suppliers />;
      case 'Calendar':
        return <Calendar />;
      case 'CRM':
        return <CRM />;
      case 'Finance':
        return <Finance initialParams={pageParams} />;
      case 'Settings':
        return <Settings />;
      case 'Profile':
        return <Profile user={user} />;
      default:
        return <Dashboard setCurrentPage={handleNavigation} />;
    }
  };

  if (loadingAuth) {
    return <FullScreenSpinner />;
  }
  
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--md-bg-light)', color: 'var(--md-text-primary)'}}>
      {/* Scheduler locale come fallback per quando il browser è aperto */}
      <NotificationScheduler />
      
      <Sidebar 
        user={user}
        currentPage={currentPage} 
        setCurrentPage={(page) => handleNavigation(page)} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
            user={user} 
            setCurrentPage={(page) => handleNavigation(page)} 
            onNavigate={handleNavigation}
            onMenuClick={() => setIsSidebarOpen(true)} 
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 lg:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
