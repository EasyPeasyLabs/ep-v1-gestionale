
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
import AttendanceArchive from './pages/AttendanceArchive';
import Activities from './pages/Activities';
import ActivityLog from './pages/ActivityLog';
import Homeworks from './pages/Homeworks';
import Initiatives from './pages/Initiatives';
import NotificationScheduler from './components/NotificationScheduler';
import { requestNotificationPermission } from './services/fcmService';
import { getCompanyInfo } from './services/settingsService';

export type Page = 'Dashboard' | 'Clients' | 'Suppliers' | 'Calendar' | 'CRM' | 'Finance' | 'Settings' | 'Profile' | 'Enrollments' | 'Attendance' | 'AttendanceArchive' | 'Activities' | 'ActivityLog' | 'Homeworks' | 'Initiatives';

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

  // Gestione Icona Dinamica PWA e Favicon basata sul logo aziendale
  useEffect(() => {
      const updateAppIdentity = async () => {
          try {
              const info = await getCompanyInfo();
              if (info && info.logoBase64) {
                  // 1. Aggiorna Favicon
                  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
                  if (!link) {
                      link = document.createElement('link');
                      link.rel = 'icon';
                      document.head.appendChild(link);
                  }
                  link.href = info.logoBase64;

                  // 2. Aggiorna Apple Touch Icon (iOS)
                  let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
                  if (!appleLink) {
                      appleLink = document.createElement('link');
                      appleLink.rel = 'apple-touch-icon';
                      document.head.appendChild(appleLink);
                  }
                  appleLink.href = info.logoBase64;

                  // 3. Genera Manifest Dinamico per installazione PWA
                  // Questo sovrascrive il manifest.json statico permettendo di usare il logo e il nome personalizzati
                  const manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
                  if (manifestLink) {
                      const dynamicManifest = {
                          short_name: "EP v1",
                          name: "EP v1",
                          gcm_sender_id: "103953800507",
                          start_url: ".",
                          display: "standalone",
                          theme_color: "#757575", 
                          background_color: "#f5f5f5",
                          icons: [
                              {
                                  src: info.logoBase64,
                                  type: "image/png",
                                  sizes: "192x192",
                                  purpose: "any maskable"
                              },
                              {
                                  src: info.logoBase64,
                                  type: "image/png",
                                  sizes: "512x512",
                                  purpose: "any maskable"
                              }
                          ]
                      };
                      const stringManifest = JSON.stringify(dynamicManifest);
                      const blob = new Blob([stringManifest], {type: 'application/json'});
                      const manifestURL = URL.createObjectURL(blob);
                      manifestLink.href = manifestURL;
                  }
              }
          } catch (e) {
              console.error("Errore aggiornamento icona app:", e);
          }
      };

      updateAppIdentity();
      
      // Ascolta aggiornamenti dalle impostazioni
      window.addEventListener('EP_DataUpdated', updateAppIdentity);
      return () => window.removeEventListener('EP_DataUpdated', updateAppIdentity);
  }, []);

  // Funzione di navigazione centralizzata che supporta parametri
  const handleNavigation = (page: Page, params?: any) => {
      // DEBUG LISTENER 3: Cambio stato pagina
      console.log('[DEBUG 3] App: handleNavigation verso', page);
      setCurrentPage(page);
      setPageParams(params || null);
  };

  const renderContent = () => {
    if (!user) return null; // Should not happen if user is logged in
    
    // DEBUG LISTENER 4: Rendering content
    console.log('[DEBUG 4] App: rendering content per', currentPage);

    // Use a key to force remounting and trigger the animation
    return (
        <div key={currentPage} className="animate-slide-up h-full">
            {(() => {
                switch (currentPage) {
                  case 'Dashboard':
                    return <Dashboard setCurrentPage={handleNavigation} />;
                  case 'Enrollments':
                    return <Enrollments initialParams={pageParams} />;
                  case 'Attendance':
                    return <Attendance />;
                  case 'AttendanceArchive':
                    return <AttendanceArchive />;
                  case 'Activities':
                    return <Activities />;
                  case 'ActivityLog':
                    return <ActivityLog />;
                  case 'Homeworks':
                    return <Homeworks />;
                  case 'Initiatives':
                    return <Initiatives />;
                  case 'Clients':
                    return <Clients />;
                  case 'Suppliers':
                    return <Suppliers />;
                  case 'Calendar':
                    return <Calendar />;
                  case 'CRM':
                    return <CRM />;
                  case 'Finance':
                    return <Finance initialParams={pageParams} onNavigate={handleNavigation} />;
                  case 'Settings':
                    return <Settings />;
                  case 'Profile':
                    return <Profile user={user} />;
                  default:
                    return <Dashboard setCurrentPage={handleNavigation} />;
                }
            })()}
        </div>
    );
  };

  if (loadingAuth) {
    return <FullScreenSpinner />;
  }
  
  if (!user) {
    return <LoginPage />;
  }

  return (
    // FIX MOBILE: Use h-[100dvh] for dynamic viewport height (avoids address bar cutoff)
    <div className="flex h-screen h-[100dvh] w-full bg-slate-50 text-gray-900 font-sans overflow-hidden">
      {/* Scheduler locale come fallback per quando il browser è aperto */}
      <NotificationScheduler />
      
      <Sidebar 
        user={user}
        currentPage={currentPage} 
        setCurrentPage={(page) => handleNavigation(page)} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      <div className="flex-1 flex flex-col overflow-hidden relative w-full">
        <Header 
            user={user} 
            setCurrentPage={(page) => handleNavigation(page)} 
            onNavigate={handleNavigation}
            onMenuClick={() => setIsSidebarOpen(true)} 
        />
        {/* FIX MOBILE: Added padding-bottom (pb-24) for mobile to prevent content being hidden behind bottom bars. Added touch-scrolling support. */}
        <main 
            className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 scroll-smooth pb-24 md:pb-8 touch-pan-y" 
            style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
