
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase/config';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary'; // Import Safety Feature
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Suppliers from './pages/Suppliers';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import NotificationPlanning from './pages/NotificationPlanning';
import Profile from './pages/Profile';
import LoginPage from './pages/LoginPage';
import FullScreenSpinner from './components/FullScreenSpinner';
import Calendar from './pages/Calendar';
import CRM from './pages/CRM';
import Enrollments from './pages/Enrollments';
import EnrollmentArchive from './pages/EnrollmentArchive'; 
import Attendance from './pages/Attendance';
import AttendanceArchive from './pages/AttendanceArchive';
import Activities from './pages/Activities';
import ActivityLog from './pages/ActivityLog';
import Homeworks from './pages/Homeworks';
import Initiatives from './pages/Initiatives';
import Manual from './pages/Manual';
import ClientSituation from './pages/ClientSituation'; 
import NotificationScheduler from './components/NotificationScheduler';
import { requestNotificationPermission, setupForegroundMessaging } from './services/fcmService';
import { getCompanyInfo } from './services/settingsService';
import { LeadsPage } from './src/pages/LeadsPage';
import EnrollmentPortal from './src/pages/EnrollmentPortal';
import { Page } from './types';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
  const [pageParams, setPageParams] = useState<any>(null); 
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // GUARD CLAUSE: Se Firebase non è inizializzato (es. config mancante), non crashare.
    if (!auth) {
        const msg = 'Firebase Auth non è inizializzato. Controlla le API Key nel file .env o config.ts.';
        console.error('CRITICAL: ' + msg);
        setAuthError(msg);
        setLoadingAuth(false);
        return;
    }

    try {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoadingAuth(false);
          if (currentUser) {
              requestNotificationPermission(currentUser.uid).catch(err => console.warn('Notif Error:', err));
              setupForegroundMessaging();
          }
        }, (error) => {
            console.error("Auth Error: " + error.message);
            setAuthError(error.message);
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    } catch (e: any) {
        console.error("Critical Auth Setup Error: " + e.message);
        setAuthError(e.message);
        setLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
      const updateAppIdentity = async () => {
          if (!user) return;
          try {
              const info = await getCompanyInfo();
              if (info) {
                  document.title = info.denomination || "EasyPeasy Labs";
                  if (info.logoBase64) {
                      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
                  if (!link) {
                      link = document.createElement('link');
                      link.rel = 'icon';
                      document.head.appendChild(link);
                  }
                  link.href = info.logoBase64;
                  }
              }
          } catch (e) {
              console.error("Errore aggiornamento icona app:", e);
          }
      };
      if (user) updateAppIdentity();
      window.addEventListener('EP_DataUpdated', updateAppIdentity);
      return () => window.removeEventListener('EP_DataUpdated', updateAppIdentity);
  }, [user]);

  const handleNavigation = (page: Page, params?: any) => {
      setCurrentPage(page);
      setPageParams(params || null);
  };

  const renderContent = () => {
    if (!user) return null; 
    return (
        <div key={currentPage} className="animate-slide-up h-full">
            {/* Protezione livello pagina */}
            <ErrorBoundary>
                {(() => {
                    switch (currentPage) {
                      case 'Dashboard': return <Dashboard setCurrentPage={handleNavigation} />;
                      case 'Enrollments': return <Enrollments initialParams={pageParams} />;
                      case 'EnrollmentArchive': return <EnrollmentArchive />;
                      case 'Attendance': return <Attendance initialParams={pageParams} />;
                      case 'AttendanceArchive': return <AttendanceArchive />;
                      case 'Activities': return <Activities />;
                      case 'ActivityLog': return <ActivityLog />;
                      case 'Homeworks': return <Homeworks />;
                      case 'Initiatives': return <Initiatives />;
                      case 'Clients': return <Clients initialParams={pageParams} />;
                      case 'ClientSituation': return <ClientSituation initialParams={pageParams} />; 
                      case 'Suppliers': return <Suppliers />;
                      case 'Calendar': return <Calendar />;
                      case 'CRM': return <CRM />;
                      case 'Finance': return <Finance initialParams={pageParams} onNavigate={handleNavigation} />;
                      case 'Settings': return <Settings />;
                      case 'NotificationPlanning': return <NotificationPlanning />;
                      case 'Profile': return <Profile user={user} />;
                      case 'Manual': return <Manual />;
                      case 'Leads': return <LeadsPage />;
                      default: return <Dashboard setCurrentPage={handleNavigation} />;
                    }
                })()}
            </ErrorBoundary>
        </div>
    );
  };

  if (loadingAuth) {
      return <FullScreenSpinner />;
  }

  // PUBLIC ROUTES (No Auth Required)
  if (window.location.pathname === '/iscrizione' || window.location.hash.startsWith('#/iscrizione')) {
    return <EnrollmentPortal />;
  }

  // Visualizzazione Errore Critico di Configurazione
  if (authError) {
      return (
          <div className="flex items-center justify-center h-screen bg-red-50 p-8 text-center">
              <div className="max-w-md bg-white p-8 rounded-2xl shadow-xl border-l-4 border-red-500">
                  <h1 className="text-2xl font-bold text-red-600 mb-4">Errore di Sistema</h1>
                  <p className="text-gray-700 mb-4">Impossibile connettersi ai servizi di autenticazione.</p>
                  <code className="block bg-gray-100 p-4 rounded text-xs text-red-800 font-mono mb-4 text-left overflow-auto">
                      {authError}
                  </code>
                  <button onClick={() => window.location.reload()} className="md-btn md-btn-primary w-full">Riprova</button>
              </div>
          </div>
      );
  }
  
  if (!user) {
      return <LoginPage />;
  }

  return (
    <div className="flex h-screen h-[100dvh] w-full text-gray-800 font-sans overflow-hidden bg-gray-50">
      {/* Protezione Background Services */}
      <ErrorBoundary>
        <NotificationScheduler />
      </ErrorBoundary>

      {/* Protezione Sidebar */}
      <ErrorBoundary>
        <Sidebar user={user} currentPage={currentPage} setCurrentPage={(page) => handleNavigation(page)} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      </ErrorBoundary>

      <div className="flex-1 flex flex-col overflow-hidden relative w-full">
        {/* Protezione Header */}
        <ErrorBoundary>
            <Header user={user} setCurrentPage={(page) => handleNavigation(page)} onNavigate={handleNavigation} onMenuClick={() => setIsSidebarOpen(true)} />
        </ErrorBoundary>
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 scroll-smooth pb-24 md:pb-8 touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;