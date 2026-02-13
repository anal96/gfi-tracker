import { useState, useEffect } from 'react';
import { Users, Search, Plus, UserCircle, Edit, Trash2, AlertCircle, ChevronDown, BookOpen, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../services/api';
import { BatchManagement } from './BatchManagement';

interface UserManagementProps {
    user: any;
    isDarkMode?: boolean;
}

interface User {
    id: string;
    _id?: string; // Support MongoDB _id
    name: string;
    email: string;
    role: string;
    avatar?: string;
    status: 'active' | 'inactive';
    subjects?: { _id: string; name: string; }[];
}

export function UserManagement({ user, isDarkMode = false }: UserManagementProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [usersAccordionOpen, setUsersAccordionOpen] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'teacher',
        password: ''
    });
    const [modalError, setModalError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.getUsers();
            if (response && response.success) {
                // Map _id to id if needed
                const mappedUsers = (response.data || []).map((u: any) => ({
                    ...u,
                    id: u.id || u._id
                }));
                setUsers(mappedUsers);
            } else {
                setError(response?.message || 'Failed to load users');
            }
        } catch (err: any) {
            console.error('Error loading users:', err);
            setError(err.message || 'Failed to load users from database');
            setUsers([]); // No mock data fallback - strictly real DB 
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (user?: User) => {
        setModalError(null);
        setShowPassword(false);
        if (user) {
            setCurrentUser(user);
            setFormData({
                name: user.name,
                email: user.email,
                role: user.role,
                password: '' // Don't show password
            });
        } else {
            setCurrentUser(null);
            setFormData({
                name: '',
                email: '',
                role: 'teacher',
                password: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleDeleteClick = (user: User) => {
        setCurrentUser(user);
        setIsDeleteModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalError(null);
        try {
            if (currentUser) {
                // Edit mode
                const dataToUpdate: any = { ...formData };
                if (!dataToUpdate.password) delete dataToUpdate.password; // Don't send empty password

                await api.updateUser(currentUser.id, dataToUpdate);
                // alert('User updated successfully'); // Optional success feedback handling
            } else {
                // Create mode
                await api.createUser(formData);
                // alert('User created successfully');
            }
            setIsModalOpen(false);
            loadUsers();
        } catch (err: any) {
            console.error('Submit error:', err);
            setModalError(err.message || 'Operation failed');
        }
    };

    const handleDeleteConfirm = async () => {
        if (!currentUser) return;
        try {
            await api.deleteUser(currentUser.id);
            setIsDeleteModalOpen(false);
            loadUsers();
            alert('User deleted successfully');
        } catch (err: any) {
            alert(err.message || 'Delete failed');
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
            {/* Page Header */}
            <div className="mb-6 sm:mb-8 mt-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-2">
                    User & Batch Management
                </h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    Manage users and batches in one place
                </p>
            </div>

            {/* Accordion: All Users */}
            <div className="mb-4 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
                <button
                    type="button"
                    onClick={() => setUsersAccordionOpen(!usersAccordionOpen)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-blue-500" />
                        <span className="text-lg font-bold text-black dark:text-white">All Users</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${usersAccordionOpen ? 'rotate-180' : ''}`} />
                </button>
                {usersAccordionOpen && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-slate-700">
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={() => handleOpenModal()}
                                className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                <span className="hidden sm:inline font-semibold">Add User</span>
                            </button>
                        </div>
                        <div className="relative mb-6">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-900 text-black dark:text-white focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <p>{error}</p>
                                <button onClick={loadUsers} className="ml-auto text-sm font-semibold hover:underline">Retry</button>
                            </div>
                        )}
                        <div className="space-y-4 pb-4">
                            <AnimatePresence>
                                {filteredUsers.map((u, index) => (
                                    <motion.div
                                        key={u.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between group hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-base sm:text-lg overflow-hidden">
                                                {u.avatar ? (
                                                    <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    u.name.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-black dark:text-white text-sm sm:text-lg truncate">
                                                    {u.name}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                                    <span>{u.email}</span>
                                                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' :
                                                        u.role === 'verifier' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' :
                                                            'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                                                        }`}>
                                                        {u.role}
                                                    </span>
                                                    {u.role === 'teacher' && u.subjects && u.subjects.length > 0 && (
                                                        <>
                                                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                                            <span className="text-gray-500 dark:text-gray-400" title={u.subjects.map(s => s.name).join(', ')}>
                                                                {u.subjects.length} Subject{u.subjects.length !== 1 ? 's' : ''}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleOpenModal(u)}
                                                className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                            >
                                                <Edit className="w-5 h-5" />
                                            </button>
                                            {u.role !== 'admin' && (
                                                <button
                                                    onClick={() => handleDeleteClick(u)}
                                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {loading && (
                                <div className="text-center py-12">
                                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                    <p className="text-gray-500">Loading users...</p>
                                </div>
                            )}

                            {!loading && filteredUsers.length === 0 && (
                                <div className="text-center py-12 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                                    <UserCircle className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                                    <p className="text-gray-500 dark:text-gray-400">No users found</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Batch Management Section - Self-contained accordion */}
            <BatchManagement
                selectedBatch={selectedBatch}
                onBatchChange={(id) => setSelectedBatch(id)}
                user={user}
            />

            {/* Add/Edit User Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            key="user-modal"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100 dark:border-slate-700"
                        >
                            <h2 className="text-xl font-bold text-black dark:text-white mb-4">
                                {currentUser ? 'Edit User' : 'Add New User'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                                {modalError && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <p>{modalError}</p>
                                    </div>
                                )}
                                {/* Hidden inputs to trick browser autofill */}
                                <input type="text" style={{ display: 'none' }} />
                                <input type="password" style={{ display: 'none' }} />

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-black dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        autoComplete="off"
                                        name="new-user-name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-black dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        autoComplete="off"
                                        name="new-user-email"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-black dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    >
                                        <option value="teacher">Teacher</option>
                                        <option value="verifier">Verifier</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {currentUser ? 'New Password (leave blank to keep)' : 'Password'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required={!currentUser}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-black dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none pr-10"
                                            autoComplete="new-password"
                                            name="new-user-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700"
                                    >
                                        {currentUser ? 'Update User' : 'Create User'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {isDeleteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            key="delete-modal"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-gray-100 dark:border-slate-700 text-center"
                        >
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h2 className="text-xl font-bold text-black dark:text-white mb-2">Delete User?</h2>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">
                                Are you sure you want to delete <span className="font-bold text-black dark:text-white">{currentUser?.name}</span>? This action cannot be undone.
                            </p>

                            <div className="flex justify-center gap-3">
                                <button
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteConfirm}
                                    className="px-4 py-2 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 shadow-lg shadow-red-500/30"
                                >
                                    Delete User
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
