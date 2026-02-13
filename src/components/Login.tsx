import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Mail, Lock, AlertCircle, BookOpen, Eye, EyeOff, Download } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import api from '../services/api';
import { ForgotPassword } from './ForgotPassword';

interface LoginProps {
    onLoginSuccess: (user: any) => void;
    installPrompt?: any;
    onInstallClick?: () => void;
    showInstallOption?: boolean;
}

export function Login({ onLoginSuccess, installPrompt, onInstallClick, showInstallOption }: LoginProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForgotPassword, setShowForgotPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await api.login(email, password);

            if (response && response.success) {
                onLoginSuccess(response.user);
            } else {
                setError(response?.message || 'Login failed. Please check your credentials.');
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#F8FAFC] dark:bg-[#0F172A] relative overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[100px] animate-blob" />
                <div className="absolute top-[20%] right-[-10%] w-[35%] h-[35%] bg-purple-400/20 dark:bg-indigo-600/10 rounded-full blur-[100px] animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-indigo-400/20 dark:bg-blue-600/10 rounded-full blur-[100px] animate-blob animation-delay-4000" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md relative z-10"
            >
                <AnimatePresence mode="wait">
                    {showForgotPassword ? (
                        <motion.div
                            key="forgot-password"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <ForgotPassword onBack={() => setShowForgotPassword(false)} />
                        </motion.div>
                    ) : (
                        <Card key="login" className="backdrop-blur-2xl bg-white/70 dark:bg-slate-900/60 border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
                            {/* Top Decorative Line */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

                            <CardHeader className="text-center space-y-6 pb-2 pt-8">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                    className="mx-auto flex items-center justify-center"
                                >
                                    <img
                                        src="/icon-192x192.png"
                                        alt="GFI Tracker Logo"
                                        className="w-24 h-24 object-contain drop-shadow-md"
                                    />
                                </motion.div>
                                <div className="space-y-1">
                                    <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                                        Welcome Back
                                    </CardTitle>
                                    <CardDescription className="text-base text-gray-500 dark:text-gray-400 font-medium">
                                        Sign in to your GFI Tracker account
                                    </CardDescription>
                                </div>
                            </CardHeader>

                            <CardContent className="p-8 pt-6">
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            className="flex items-center gap-3 p-4 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-300"
                                        >
                                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                            <p className="text-sm font-medium">{error}</p>
                                        </motion.div>
                                    )}

                                    <div className="space-y-2 group">
                                        <label htmlFor="email" className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400">
                                            Email Address
                                        </label>
                                        <div className="relative transform transition-all duration-200 group-focus-within:-translate-y-0.5">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 transition-colors group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 pointer-events-none" />
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder="name@example.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                                disabled={loading}
                                                className="pl-11 h-12 bg-white dark:bg-slate-900/50 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm group-hover:border-blue-300 dark:group-hover:border-slate-600"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2 group">
                                        <div className="flex items-center justify-between ml-1">
                                            <label htmlFor="password" className="text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400">
                                                Password
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setShowForgotPassword(true)}
                                                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                            >
                                                Forgot password?
                                            </button>
                                        </div>
                                        <div className="relative transform transition-all duration-200 group-focus-within:-translate-y-0.5">
                                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 transition-colors group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 pointer-events-none" />
                                            <Input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                disabled={loading}
                                                className="pl-11 pr-10 h-12 bg-white dark:bg-slate-900/50 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm group-hover:border-blue-300 dark:group-hover:border-slate-600"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none"
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="w-5 h-5" />
                                                ) : (
                                                    <Eye className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={loading || !email || !password}
                                        className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 mt-2"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Signing in...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Sign In</span>
                                                <LogIn className="w-5 h-5" />
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                            <div className="px-8 pb-8 pt-0 text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    By signing in, you agree to our Terms of Service and Privacy Policy.
                                </p>
                            </div>
                        </Card>
                    )}
                </AnimatePresence>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-8 text-center space-y-4"
                >
                    {(installPrompt || showInstallOption) && (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Button
                                type="button"
                                onClick={onInstallClick}
                                variant="outline"
                                className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-white/80 dark:hover:bg-slate-900/80 shadow-lg px-6 rounded-full"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Install App
                            </Button>
                        </motion.div>
                    )}

                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Powered by GFI Tracker System
                    </p>
                </motion.div>
            </motion.div>
        </div>
    );
}
