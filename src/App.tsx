import { useState, useEffect } from 'react';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { VerifierDashboard } from './components/VerifierDashboard';
import { Login } from './components/Login';
import { BottomNavigation } from './components/BottomNavigation';
import { Profile } from './components/Profile';
import { StudyDashboard } from './components/StudyDashboard';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ExamPage } from './components/ExamPage';
import { AssignPage } from './components/AssignPage';
import { UserManagement } from './components/UserManagement';
import { NotificationsPage } from './components/NotificationsPage';
import { Moon, Sun, Users, BookOpen, Download, X, LogOut, User, Share, PlusSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from './services/api';
import { DashboardProvider } from './context/DashboardContext';

export default function App() {
  // Initialize dark mode from localStorage or system preference
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    let initialDarkMode = false;
    if (stored !== null) {
      initialDarkMode = stored === 'true';
    } else {
      // Check system preference
      initialDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    // Apply class immediately to prevent flash
    if (initialDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return initialDarkMode;
  });
  // Hydrate user from cache immediately so app shows instantly (WhatsApp-style)
  const [user, setUser] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('cachedUser');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed._id) return parsed;
      }
    } catch (_) { }
    return null;
  });
  const [loading, setLoading] = useState(!user); // No loading if we have cached user
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Calculate default view based on user role - must be before conditional returns
  const isAdmin = user?.role === 'admin';
  const isVerifier = user?.role === 'verifier';
  const defaultView = isAdmin ? 'admin' : isVerifier ? 'verifier' : 'teacher';
  const [view, setView] = useState<'teacher' | 'admin' | 'verifier' | 'profile' | 'progress' | 'schedule' | 'subjects' | 'team' | 'notifications' | 'exam'>(defaultView);

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Apply grey mode class on mount and when it changes, and save to localStorage
  useEffect(() => {
    // Update localStorage
    localStorage.setItem('darkMode', isDarkMode.toString());
    // Update document class for dark mode and grey mode styling
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.add('grey-mode');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.remove('grey-mode');
    }
  }, [isDarkMode]);

  // Update view when user changes
  useEffect(() => {
    if (user) {
      const newDefaultView = user.role === 'admin' ? 'admin' : user.role === 'verifier' ? 'verifier' : 'teacher';
      setView(newDefaultView);
    }
  }, [user]);

  const checkAuth = async () => {
    // If we have cached user, app is already visible (loading=false). Revalidate in background.
    try {
      const response = await api.getCurrentUser();
      if (response && response.success) {
        setUser(response.user);
        localStorage.setItem('cachedUser', JSON.stringify(response.user));
        setLoading(false);
        return;
      }
      setUser((prev: any) => (prev ? prev : null));
    } catch (networkError: any) {
      if (networkError.message && (networkError.message.includes('Unauthorized') || networkError.message.includes('401'))) {
        localStorage.removeItem('cachedUser');
        setUser(null);
      } else if (user) {
        console.log('✅ Using cached user (offline/unreachable)');
      }
    } finally {
      setLoading(false);
    }
  };

  // Re-sync when network returns
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network restored - syncing data...');
      checkAuth();
      // Optional: Trigger a global refresh or toast
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
    localStorage.setItem('cachedUser', JSON.stringify(userData));
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    localStorage.removeItem('cachedUser');
  };

  // Service Worker Management - Handled by vite-plugin-pwa in main.tsx


  // Handle PWA Install Prompt
  useEffect(() => {
    // if (!user) return; // User check removed to allow install prompt on landing

    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      console.log('✅ App is already installed - install prompt not needed');
      return;
    }

    // Helper to check dismissal status dynamically
    const shouldShowBanner = () => {
      const dismissed = localStorage.getItem('pwa-install-dismissed-v2');
      if (!dismissed) return true;
      const daysSinceDismissed = (Date.now() - parseInt(dismissed, 10)) / (1000 * 60 * 60 * 24);
      return daysSinceDismissed >= 7;
    };

    // Initial check for logging/cleanup
    const dismissed = localStorage.getItem('pwa-install-dismissed-v2');
    if (dismissed) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissed, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        console.log('⏭️ Install prompt was dismissed recently, not showing again');
        console.log('💡 Clear localStorage "pwa-install-dismissed-v2" to test again');
      } else {
        localStorage.removeItem('pwa-install-dismissed-v2');
      }
    }

    const showBannerDelay = 1500;
    let installPromptTimeout: NodeJS.Timeout;

    const scheduleBanner = () => {
      if (!shouldShowBanner()) return;
      clearTimeout(installPromptTimeout);
      installPromptTimeout = setTimeout(() => {
        if (!shouldShowBanner()) return;
        setShowInstallPrompt(true);
        console.log('✅ Showing install prompt banner');
      }, showBannerDelay);
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('📱 beforeinstallprompt event fired!');
      e.preventDefault();
      const installEvent = e as any;
      setDeferredPrompt(installEvent);
      (window as any).deferredPrompt = installEvent;
      scheduleBanner();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS Support: Force banner display since beforeinstallprompt doesn't fire
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS && !isStandalone && shouldShowBanner()) {
      console.log('🍎 iOS detected: Scheduling install banner manually');
      scheduleBanner();
    }

    // Use prompt captured in index.html (event can fire before React mounts)
    if ((window as any).deferredPrompt && shouldShowBanner()) {
      console.log('📱 Using deferred prompt from page load');
      setDeferredPrompt((window as any).deferredPrompt);
      scheduleBanner();
    }

    // Poll for deferred prompt (Chrome often fires beforeinstallprompt a few seconds after load)
    const pollInterval = setInterval(() => {
      if ((window as any).deferredPrompt) {
        setDeferredPrompt((prev: any) => {
          if (prev) return prev;
          console.log('📱 Deferred prompt picked up from poll');
          return (window as any).deferredPrompt;
        });
        scheduleBanner();
      }
    }, 2000);
    const pollStop = setTimeout(() => clearInterval(pollInterval), 20000);

    // Comprehensive PWA installability check
    const checkInstallability = async () => {
      console.log('🔍 Checking PWA installability...');

      // Check manifest
      try {
        const manifestRes = await fetch('/manifest.json');
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          console.log('✅ manifest.json is accessible:', manifest);

          // Check icons
          if (manifest.icons && manifest.icons.length > 0) {
            for (const icon of manifest.icons) {
              try {
                const iconRes = await fetch(icon.src);
                if (iconRes.ok) {
                  console.log(`✅ Icon exists: ${icon.src}`);
                } else {
                  console.error(`❌ Icon missing: ${icon.src} (Status: ${iconRes.status})`);
                }
              } catch (err) {
                console.error(`❌ Icon not accessible: ${icon.src}`, err);
              }
            }
          } else {
            console.warn('⚠️ No icons defined in manifest.json');
          }
        } else {
          console.error('❌ manifest.json not accessible:', manifestRes.status);
        }
      } catch (err) {
        console.error('❌ Could not fetch manifest.json:', err);
      }

      // Check service worker
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          if (registrations.length > 0) {
            console.log(`✅ Service Worker registered: ${registrations.length} registration(s)`);
          } else {
            console.warn('⚠️ No service worker registered');
          }
        } catch (err) {
          console.error('❌ Error checking service worker:', err);
        }
      }

      // Check HTTPS/localhost
      const isSecure = window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      if (isSecure) {
        console.log('✅ Running on secure context (HTTPS/localhost)');
      } else {
        console.warn('⚠️ Not running on HTTPS or localhost - install prompt may not work');
      }

      console.log('💡 If install prompt doesn\'t appear, check the issues above');
    };

    checkInstallability();

    return () => {
      if (installPromptTimeout) clearTimeout(installPromptTimeout);
      clearInterval(pollInterval);
      clearTimeout(pollStop);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []); // Run once on mount

  const getInstallInstructions = () => {
    if (typeof navigator === 'undefined') return 'Use your browser menu to install this app.';
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) {
      return 'To install: tap the Share button (square with arrow) at the bottom, then scroll and tap "Add to Home Screen".';
    }
    if (/Android/.test(ua)) {
      return 'To install: tap the menu (⋮) at the top right, then tap "Install app" or "Add to Home screen".';
    }
    // Chrome / Edge desktop
    return 'To install: click the install icon (⊕ or computer with plus) in the address bar, or open the menu (⋮) → "Install GFI Tracker".';
  };

  const handleInstallClick = async () => {
    const promptToUse = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPrompt : null);
    if (!promptToUse) {
      console.log('❌ No deferred prompt available');
      // If iOS, show custom instructions modal
      if ((/iPad|iPhone|iPod/.test(navigator.userAgent)) && !(window as any).MSStream) {
        setShowIOSInstructions(true);
      } else {
        alert(getInstallInstructions());
      }
      return;
    }
    if (!deferredPrompt && promptToUse) setDeferredPrompt(promptToUse);

    try {
      console.log('📱 Showing install prompt...');
      promptToUse.prompt();
      const { outcome } = await promptToUse.userChoice;

      if (outcome === 'accepted') {
        console.log('✅ User accepted the install prompt');
        // Mark as dismissed/installed so it doesn't pop up again immediately if they stay in browser
        localStorage.setItem('pwa-install-dismissed-v2', Date.now().toString());
      } else {
        localStorage.setItem('pwa-install-dismissed-v2', Date.now().toString());
      }
    } catch (error) {
      console.error('❌ Error showing install prompt:', error);
      alert(getInstallInstructions());
    }

    setDeferredPrompt(null);
    if ((window as any).deferredPrompt) {
      (window as any).deferredPrompt = null;
    }
    setShowInstallPrompt(false);
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
    // Store dismissal timestamp (don't show again for 7 days)
    localStorage.setItem('pwa-install-dismissed-v2', Date.now().toString());
  };

  // Show login if not authenticated
  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Prevent teachers from accessing admin/verifier view
  const canAccessView = (viewType: 'teacher' | 'admin' | 'verifier') => {
    if (viewType === 'admin' && !isAdmin) return false;
    if (viewType === 'verifier' && !isVerifier && !isAdmin) return false;
    return true;
  };

  return (
    <div className="min-h-screen transition-colors duration-500 overflow-x-hidden relative">
      {/* Fixed Background Layer to prevent white edges on scroll/overscroll */}
      <div className="fixed inset-0 z-[-1] w-full min-w-[100vw] bg-white dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallPrompt && (
          <motion.div
            initial={{ y: -100, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: -100, opacity: 0, x: "-50%" }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-4 left-1/2 z-[9999] w-full max-w-md px-4"
          >
            <div className="backdrop-blur-xl bg-white dark:bg-slate-800/95 rounded-2xl p-4 sm:p-5 shadow-2xl border-2 border-blue-300 dark:border-blue-600">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Download className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-black dark:text-white text-base sm:text-lg mb-1">
                    Install GFI Tracker
                  </h3>
                  <p className="text-sm text-black/80 dark:text-gray-300 mb-3 leading-relaxed">
                    Install our app for quick access and offline support
                  </p>
                  <div className="flex gap-2">
                    <motion.button
                      onClick={handleInstallClick}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:shadow-lg transition-all"
                    >
                      Install
                    </motion.button>
                    <motion.button
                      onClick={handleDismissInstall}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-700 text-black dark:text-white text-sm font-semibold hover:bg-blue-50 dark:hover:bg-gray-600 transition-all border border-gray-200 dark:border-gray-600"
                    >
                      Not Now
                    </motion.button>
                  </div>
                </div>
                <motion.button
                  onClick={handleDismissInstall}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors flex-shrink-0 mt-1"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Install Instructions Modal */}
      <AnimatePresence>
        {showIOSInstructions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowIOSInstructions(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-gray-200 dark:border-slate-700 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 opacity-80" />

              <button
                onClick={() => setShowIOSInstructions(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
                  <Download className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Install GFI Tracker
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 px-4">
                  Install this application on your home screen for quick and easy access.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-700">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400">
                    <Share className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      1. Tap the Share button
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Located in the bottom navigation bar
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-700">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-600 flex items-center justify-center flex-shrink-0 text-gray-600 dark:text-gray-300">
                    <PlusSquare className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      2. Add to Home Screen
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Scroll down and tap 'Add to Home Screen'
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <div className="animate-bounce text-blue-500 dark:text-blue-400">
                  <Download className="w-6 h-6 rotate-180" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Main Content - Mobile App Style (No Top Nav) */}
      {!user ? (
        <Login
          onLoginSuccess={handleLoginSuccess}
          installPrompt={deferredPrompt}
          onInstallClick={handleInstallClick}
          showInstallOption={
            typeof window !== 'undefined' &&
            !(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true || document.referrer.includes('android-app://'))
          }
        />
      ) : (
        <DashboardProvider user={user}>
          <main className="pt-2 pb-24 sm:pb-28 min-h-screen relative z-10">
            {view === 'teacher' && !isVerifier ? (
              <TeacherDashboard user={user} isDarkMode={isDarkMode} onNavigate={(page) => setView(page as any)} />
            ) : view === 'admin' && isAdmin ? (
              <AdminDashboard
                user={user}
                isDarkMode={isDarkMode}
                onNavigate={(page) => setView(page as any)}
              />
            ) : view === 'verifier' && (isVerifier || isAdmin) ? (
              <VerifierDashboard user={user} isDarkMode={isDarkMode} showApprovalsContent={false} isHomePage={true} onNavigate={(page) => setView(page as any)} />
            ) : view === 'subjects' ? (
              isVerifier ? (
                <VerifierDashboard user={user} isDarkMode={isDarkMode} defaultTab="approvals" showApprovalsContent={true} onNavigate={(page) => setView(page as any)} />
              ) : isAdmin ? (
                <AnalyticsDashboard user={user} isDarkMode={isDarkMode} />
              ) : (
                <StudyDashboard user={user} isDarkMode={isDarkMode} />
              )
            ) : view === 'schedule' ? (
              isVerifier ? (
                <VerifierDashboard user={user} isDarkMode={isDarkMode} defaultTab="assign" showApprovalsContent={false} isHomePage={false} onNavigate={(page) => setView(page as any)} />
              ) : isAdmin ? (
                <UserManagement user={user} isDarkMode={isDarkMode} />
              ) : (
                <AssignPage user={user} isDarkMode={isDarkMode} />
              )
            ) : view === 'progress' ? (
              <Profile
                user={user}
                onLogout={handleLogout}
                onToggleDarkMode={() => {
                  console.log('Dark mode toggle clicked, current:', isDarkMode);
                  const newValue = !isDarkMode;
                  console.log('Setting dark mode to:', newValue);
                  setIsDarkMode(newValue);
                }}
                isDarkMode={isDarkMode}
                onInstallApp={handleInstallClick}
                hasNativeInstallPrompt={!!deferredPrompt}
                showInstallOption={
                  typeof window !== 'undefined' &&
                  !(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true || document.referrer.includes('android-app://'))
                }
              />
            ) : view === 'team' ? (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
                <div className="relative overflow-hidden backdrop-blur-xl bg-transparent dark:bg-blue-900/90 rounded-2xl md:rounded-3xl p-6 md:p-8 border border-blue-200 dark:border-blue-700 shadow-xl shadow-blue-500/10">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-blue-500/20 rounded-full blur-2xl -z-0" />
                  <div className="relative z-10">
                    <h2 className="text-2xl md:text-3xl font-bold text-black mb-6">Team</h2>
                    <p className="text-black">Team collaboration features coming soon.</p>
                  </div>
                </div>
              </div>
            ) : view === 'notifications' ? (
              <NotificationsPage
                user={user}
                onBack={() => setView(isAdmin ? 'admin' : isVerifier ? 'verifier' : 'teacher')}
                isDarkMode={isDarkMode}
              />
            ) : view === 'exam' ? (
              <ExamPage
                user={user}
                isDarkMode={isDarkMode}
                onBack={() => setView(isAdmin ? 'admin' : isVerifier ? 'verifier' : 'teacher')} // Go back to dashboard
              />
            ) : isVerifier ? (
              // Fallback for verifiers - show verifier dashboard
              <VerifierDashboard user={user} isDarkMode={isDarkMode} showApprovalsContent={false} isHomePage={true} onNavigate={(page) => setView(page as any)} />
            ) : (
              // Fallback for teachers/admins - show teacher dashboard
              <TeacherDashboard user={user} isDarkMode={isDarkMode} onNavigate={(page) => setView(page as any)} />
            )}
          </main>

          {/* Bottom Navigation - Mobile App Style */}
          {user && (
            <BottomNavigation
              currentView={view as any}
              onViewChange={setView}
              user={user}
            />
          )}
        </DashboardProvider>
      )}
    </div>
  );
}