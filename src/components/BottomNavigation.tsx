import { Home, BookOpen, TrendingUp, User, Users, BarChart3, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavigationProps {
  currentView: 'teacher' | 'admin' | 'verifier' | 'profile' | 'progress' | 'schedule' | 'subjects' | 'team';
  onViewChange: (view: 'teacher' | 'admin' | 'verifier' | 'profile' | 'progress' | 'schedule' | 'subjects' | 'team') => void;
  user: any;
}

export function BottomNavigation({ currentView, onViewChange, user }: BottomNavigationProps) {
  if (!user) return null;

  const isAdmin = user?.role === 'admin';
  const isVerifier = user?.role === 'verifier';

  const navItems = [
    {
      id: isVerifier ? 'verifier' : isAdmin ? 'admin' : 'teacher',
      label: 'Home',
      icon: Home,
      show: true,
    },
    {
      id: 'subjects',
      label: isAdmin ? 'Analytics' : isVerifier ? 'Approval' : 'Calendar',
      icon: isAdmin ? BarChart3 : Calendar,
      show: true,
    },
    {
      id: 'schedule',
      label: isVerifier ? 'Assign' : isAdmin ? 'Users' : 'Subjects',
      icon: isVerifier ? BookOpen : isAdmin ? Users : BookOpen,
      show: true,
    },
    {
      id: 'progress',
      label: 'Profile',
      icon: User,
      show: true,
    },
  ];

  const visibleItems = navItems.filter(item => item.show);

  if (visibleItems.length === 0) return null;

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-[100] backdrop-blur-xl bg-white/50 dark:bg-slate-900/60 border-t border-blue-200/50 dark:border-slate-800/50"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          height: 'calc(64px + env(safe-area-inset-bottom, 20px))' // Fixed height + safe area
        }}
      >
        <div className="w-full h-full flex flex-col justify-start">
          <div className="flex items-center justify-around h-16 px-2">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              // For Home button, check role - use appropriate view
              let viewId = item.id;
              if (item.id === 'teacher' || item.id === 'admin' || item.id === 'verifier') {
                viewId = isVerifier ? 'verifier' : isAdmin ? 'admin' : 'teacher';
              }
              const isActive = currentView === viewId;

              return (
                <motion.button
                  key={item.id}
                  onClick={() => {
                    let targetView = item.id;
                    if (item.id === 'teacher' || item.id === 'admin' || item.id === 'verifier') {
                      targetView = isVerifier ? 'verifier' : isAdmin ? 'admin' : 'teacher';
                    }
                    onViewChange(targetView as any);
                  }}
                  whileTap={{ scale: 0.9 }}
                  className="flex flex-col items-center justify-center w-full h-16 relative"
                >
                  <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-transparent'}`}>
                    <Icon
                      className={`w-6 h-6 transition-colors ${isActive
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 dark:text-slate-400'
                        }`}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </div>

                  <span className={`text-[10px] font-medium mt-0.5 transition-colors ${isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                    }`}>
                    {item.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
