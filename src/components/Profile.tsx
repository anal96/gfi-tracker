import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, FolderOpen, Users, Sun, Moon, HelpCircle, ChevronRight, LogOut, User, Edit, CheckCircle2, Clock, Target, X, Mail, Instagram, Camera, Download } from 'lucide-react';
import { Subject, Unit } from './TeacherDashboard';

import api from '../services/api';

interface ProfileProps {
  user: any;
  onLogout: () => void;
  onToggleDarkMode?: () => void;
  isDarkMode?: boolean;
  onInstallApp?: () => void;
  hasNativeInstallPrompt?: boolean;
  showInstallOption?: boolean;
}

export function Profile({ user, onLogout, onToggleDarkMode, isDarkMode = false, onInstallApp, hasNativeInstallPrompt, showInstallOption }: ProfileProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    avatar: user?.avatar || ''
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('File size too large. Max 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm({ ...editForm, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Verifier profile should not call teacher dashboard API
    if (user?.role === 'verifier') {
      setLoading(false);
      setSubjects([]);
      return;
    }

    try {
      setLoading(true);
      const response = await api.getTeacherDashboard();
      if (response.success && response.data) {
        setSubjects(response.data.subjects || []);
      }
    } catch (err: any) {
      console.error('Error loading profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const inProgressCount = subjects
    .flatMap(s => s.units)
    .filter(u => u.status === 'in-progress').length;

  const totalUnits = subjects
    .flatMap(s => s.units).length;

  // Handle dark mode toggle
  const handleToggleDarkMode = () => {
    console.log('Toggle dark mode clicked, current state:', isDarkMode);
    if (onToggleDarkMode) {
      onToggleDarkMode();
    } else {
      console.warn('onToggleDarkMode is not provided');
    }
  };

  const accountMenuItems = [
    {
      id: 'edit-profile',
      label: 'Edit Profile',
      icon: Edit,
      iconColor: 'text-blue-400',
      onClick: () => {
        setEditForm({
          name: user?.name || '',
          email: user?.email || '',
          avatar: user?.avatar || ''
        });
        setShowEditModal(true);
        setSaveError(null);
      },
    },

    {
      id: 'light-mode',
      label: isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      icon: isDarkMode ? Sun : Moon,
      iconColor: 'text-yellow-400',
      onClick: handleToggleDarkMode,
    },
    {
      id: 'help',
      label: 'Help & Support',
      icon: HelpCircle,
      iconColor: 'text-blue-400',
      onClick: () => setShowHelpModal(true),
    },
    ...(showInstallOption
      ? [
        {
          id: 'install-app',
          label: 'Install GFI Tracker app',
          icon: Download,
          iconColor: 'text-emerald-500',
          onClick: () => {
            if (onInstallApp) {
              onInstallApp(); // Uses native prompt if available (state or window.deferredPrompt), else shows instructions
            } else {
              const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
              const msg = isIOS
                ? 'To install: tap Share, then "Add to Home Screen".'
                : 'To install: open the browser menu (⋮) and choose "Install GFI Tracker" or "Add to Home Screen".';
              alert(msg);
            }
          },
        },
      ]
      : []),
  ];

  // Calculate additional stats
  const completedUnits = subjects.flatMap((s: Subject) => s.units).filter((u: Unit) => u.status === 'completed').length;
  const pendingUnits = subjects.flatMap((s: Subject) => s.units).filter((u: Unit) => u.status === 'not-started').length;
  const completionRate = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;



  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pb-40 sm:pb-44 pt-4 sm:pt-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pb-40 sm:pb-44 pt-4 sm:pt-6">
      {/* Profile Header Card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-blue-200/40 dark:border-blue-700/40 shadow-lg mb-6"
      >

        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {/* Avatar */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-3xl sm:text-4xl font-bold shadow-xl flex-shrink-0 overflow-hidden"
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </motion.div>

            {/* User Info */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-1 truncate">
                {user.name}
              </h1>
              <p className="text-sm sm:text-base text-black/70 dark:text-slate-400 font-medium mb-3 break-all">
                {user.email}
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-semibold text-black dark:text-blue-200">{user.role === 'admin' ? 'Administrator' : 'Teacher'}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards - Removed */}
      <div className="hidden"></div>

      {/* Account Settings Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
            <User className="w-5 h-5 text-black dark:text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white">Account Settings</h2>
        </div>

        <div className="space-y-3">
          {accountMenuItems.map((item, index) => {
            const Icon = item.icon;
            const isDarkModeToggle = item.id === 'light-mode';

            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + index * 0.05 }}
                onClick={item.onClick}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-between p-4 sm:p-5 bg-white dark:bg-slate-800 rounded-xl border border-blue-200/40 dark:border-blue-700/40 hover:border-blue-300 dark:hover:border-blue-600 transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isDarkModeToggle
                    ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20'
                    : 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20'
                    }`}>
                    {isDarkModeToggle ? (
                      isDarkMode ? <Sun className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" /> : <Moon className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                    ) : (
                      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${item.iconColor}`} />
                    )}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-base sm:text-lg font-semibold text-black dark:text-white truncate">{item.label}</div>
                    {item.subLabel && (
                      <div className="text-xs sm:text-sm text-black/60 dark:text-slate-400 font-medium mt-0.5">{item.subLabel}</div>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-black/40 dark:text-slate-500 flex-shrink-0" />
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Logout Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 mb-8"
      >
        <motion.button
          onClick={onLogout}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-3 p-4 sm:p-5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl text-white font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all"
        >
          <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
          <span>Logout</span>
        </motion.button>
      </motion.div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl border border-blue-200 dark:border-blue-700 shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-black dark:text-white">Edit Profile</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5 text-black dark:text-white" />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSaving(true);
                  setSaveError(null);

                  try {
                    const response = await api.updateProfile(editForm.name, editForm.email, editForm.avatar);
                    if (response.success) {
                      // Update user in parent component
                      if (response.user) {
                        // Reload the page to get updated user data
                        window.location.reload();
                      }
                      setShowEditModal(false);
                    } else {
                      setSaveError(response.message || 'Failed to update profile');
                    }
                  } catch (error: any) {
                    setSaveError(error.message || 'Failed to update profile');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => user.role === 'admin' && setEditForm({ ...editForm, name: e.target.value })}
                    required
                    readOnly={user.role !== 'admin'}
                    className={`w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:border-blue-500 focus:outline-none transition-colors ${user.role !== 'admin' ? 'focus:border-gray-300 dark:focus:border-slate-600' : ''}`}
                    placeholder="Enter your name"
                  />
                  {user.role !== 'admin' && (
                    <p className="text-xs text-red-500 mt-1 ml-1">
                      You cannot edit this field. Contact admin.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => user.role === 'admin' && setEditForm({ ...editForm, email: e.target.value })}
                    required
                    readOnly={user.role !== 'admin'}
                    className={`w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:border-blue-500 focus:outline-none transition-colors ${user.role !== 'admin' ? 'focus:border-gray-300 dark:focus:border-slate-600' : ''}`}
                    placeholder="Enter your email"
                  />
                  {user.role !== 'admin' && (
                    <p className="text-xs text-red-500 mt-1 ml-1">
                      You cannot edit this field. Contact admin.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                    Profile Picture
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 flex-shrink-0">
                      {editForm.avatar ? (
                        <img
                          src={editForm.avatar}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <User className="w-8 h-8" />
                        </div>
                      )}

                      {/* Delete button (only if avatar exists and isn't the initial one from User - logic simplified to just clear) */}
                      {editForm.avatar && (
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, avatar: '' })}
                          className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="flex-1">
                      <input
                        type="file"
                        id="avatar-upload"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="avatar-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 text-black dark:text-white font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors border border-dashed border-gray-300 dark:border-slate-600"
                      >
                        <div className="p-1.5 rounded-lg bg-blue-500/10 dark:bg-blue-400/10">
                          <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span>Upload Photo</span>
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Max 5MB. JPG, PNG, WebP.
                      </p>
                    </div>
                  </div>
                </div>

                {saveError && (
                  <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700">
                    <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    disabled={saving}
                    className="flex-1 px-4 py-3 rounded-xl bg-gray-200 dark:bg-slate-700 text-black dark:text-white font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help & Support Modal */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowHelpModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl border border-blue-200 dark:border-blue-700 shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20">
                    <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-black dark:text-white">Help & Support</h2>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5 text-black dark:text-white" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-400 text-center">
                  Need help? Contact us through any of the following channels:
                </p>

                {/* Email Contact */}
                <motion.a
                  href="mailto:trineo956@gmail.com"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all"
                >
                  <div className="p-3 rounded-lg bg-blue-500/20">
                    <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Email</div>
                    <div className="text-base font-medium text-black dark:text-white">trineo956@gmail.com</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </motion.a>

                {/* Instagram Contact */}
                <motion.a
                  href="https://www.instagram.com/_trineo__?igsh=MXc3eHdnMjlyYzl1eA=="
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 border-2 border-pink-200 dark:border-pink-700 hover:border-pink-400 dark:hover:border-pink-500 transition-all"
                >
                  <div className="p-3 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                    <Instagram className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Instagram</div>
                    <div className="text-base font-medium text-black dark:text-white">@_trineo__</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                </motion.a>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  We'll get back to you as soon as possible!
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
