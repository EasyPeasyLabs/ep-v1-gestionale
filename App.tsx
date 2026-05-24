
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase/config';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary'; // Import Safety Feature
import FullScreenSpinner from './components/FullScreenSpinner';
import NotificationScheduler from './components/NotificationScheduler';
import { getCompanyInfo } from './services/settingsService';
import { Page } from './types';

// Lazy loading the pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Finance = lazy(() => import('./pages/Finance'));
const Settings = lazy(() => import('./pages/Settings'));
const NotificationPlanning = lazy(() => import('./pages/NotificationPlanning'));
const Profile = lazy(() => import('./pages/Profile'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const Calendar = lazy(() => import('./pages/Calendar'));
const CRM = lazy(() => import('./pages/CRM'));
const Enrollments = lazy(() => import('./pages/Enrollments'));
const EnrollmentArchive = lazy(() => import('./pages/EnrollmentArchive')); 
const Attendance = lazy(() => import('./pages/Attendance'));
const AttendanceArchive = lazy(() => import('./pages/AttendanceArchive'));
const Activities = lazy(() => import('./pages/Activities'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));
const Homeworks = lazy(() => import('./pages/Homeworks'));
const Initiatives = lazy(() => import('./pages/Initiatives'));
const Manual = lazy(() => import('./pages/Manual'));
const ClientSituation = lazy(() => import('./pages/ClientSituation')); 
const LeadsPage = lazy(() => import('./pages/LeadsPage').then(module => ({ default: module.LeadsPage })));
const Courses = lazy(() => import('./pages/Courses'));
const EnrollmentPortal = lazy(() => import('./pages/EnrollmentPortal'));

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
  const [pageParams, setPageParams] = useState<Record<string, unknown> | undefined>(undefined); 
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
              // requestNotificationPermission(currentUser.uid).catch(err => console.warn('Notif Error:', err));
              // setupForegroundMessaging();
          }
        }, (error) => {
            console.error("Auth Error: " + error.message);
            setAuthError(error.message);
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    } catch (e: unknown) {
        const error = e as Error;
        console.error("Critical Auth Setup Error: " + error.message);
        setAuthError(error.message);
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

  const handleNavigation = (page: Page, params?: Record<string, unknown>) => {
      setCurrentPage(page);
      setPageParams(params);
  };

  const renderContent = () => {
    if (!user) return null; 
    return (
        <div key={currentPage} className="animate-slide-up h-full">
            {/* Protezione livello pagina */}
            <ErrorBoundary>
                <Suspense fallback={<div className="flex justify-center mt-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ep-blue-600"></div></div>}>
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
                      case 'Courses': return <Courses />;
                      default: return <Dashboard setCurrentPage={handleNavigation} />;
                    }
                })()}
                </Suspense>
            </ErrorBoundary>
        </div>
    );
  };

  if (loadingAuth) {
      return <FullScreenSpinner />;
  }

  // PUBLIC ROUTES (No Auth Required)
  const isEnrollmentRoute = 
    window.location.pathname === '/iscrizione' || 
    window.location.hash.startsWith('#/iscrizione') || 
    window.location.pathname.startsWith('/i/') || 
    (window as Window & typeof globalThis & { __IS_ENROLLMENT_PORTAL__?: boolean }).__IS_ENROLLMENT_PORTAL__;

  if (isEnrollmentRoute) {
    return <Suspense fallback={<FullScreenSpinner />}><EnrollmentPortal /></Suspense>;
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
      return <Suspense fallback={<FullScreenSpinner />}><LoginPage /></Suspense>;
  }

  return (
    <div className="flex h-[100dvh] w-full text-gray-800 font-sans overflow-hidden bg-gray-50">
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