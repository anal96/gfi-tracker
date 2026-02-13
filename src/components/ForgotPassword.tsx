import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import api from '../services/api';

interface ForgotPasswordProps {
    onBack: () => void;
}

type Step = 'email' | 'otp' | 'password' | 'success';

export function ForgotPassword({ onBack }: ForgotPasswordProps) {
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await api.forgotPassword(email);
            setStep('otp');
        } catch (err: any) {
            setError(err.message || 'Failed to send OTP. Please check your email.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await api.verifyOtp(email, otp);
            setStep('password');
        } catch (err: any) {
            setError(err.message || 'Invalid OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            await api.resetPassword(email, otp, password);
            setStep('success');
        } catch (err: any) {
            setError(err.message || 'Failed to reset password.');
        } finally {
            setLoading(false);
        }
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 1000 : -1000,
            opacity: 0,
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 1000 : -1000,
            opacity: 0,
        }),
    };

    return (
        <Card className="backdrop-blur-2xl bg-white/70 dark:bg-slate-900/60 border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5 w-full max-w-md mx-auto">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

            <CardHeader className="text-center space-y-2 pb-2 pt-8">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4"
                >
                    <KeyRound className="w-8 h-8 text-white" strokeWidth={1.5} />
                </motion.div>

                <CardTitle className="text-2xl font-bold bg-gradient-to-br from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    {step === 'email' && 'Forgot Password?'}
                    {step === 'otp' && 'Verify OTP'}
                    {step === 'password' && 'Reset Password'}
                    {step === 'success' && 'Password Reset!'}
                </CardTitle>
                <CardDescription className="text-gray-500 dark:text-gray-400">
                    {step === 'email' && 'Enter your email to receive a verification code'}
                    {step === 'otp' && `Enter the 6-digit code sent to ${email}`}
                    {step === 'password' && 'Create a strong new password for your account'}
                    {step === 'success' && 'Your password has been successfully updated'}
                </CardDescription>
            </CardHeader>

            <CardContent className="p-8 pt-6">
                <AnimatePresence mode="wait">
                    {step === 'email' && (
                        <motion.form
                            key="email-form"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            onSubmit={handleSendOtp}
                            className="space-y-4"
                        >
                            {error && <p className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-900/10 p-2 rounded-lg">{error}</p>}

                            <div className="space-y-2">
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        type="email"
                                        placeholder="Enter your email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="pl-11 h-12 rounded-xl bg-white dark:bg-slate-900/50 dark:text-gray-100 border-gray-200 dark:border-gray-700 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" onClick={onBack} className="flex-1 h-12 rounded-xl">
                                    Back
                                </Button>
                                <Button type="submit" disabled={loading} className="flex-[2] h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                                    {loading ? 'Sending...' : 'Send OTP'}
                                    {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                                </Button>
                            </div>
                        </motion.form>
                    )}

                    {step === 'otp' && (
                        <motion.form
                            key="otp-form"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            onSubmit={handleVerifyOtp}
                            className="space-y-4"
                        >
                            {error && <p className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-900/10 p-2 rounded-lg">{error}</p>}

                            <div className="space-y-2">
                                <div className="relative">
                                    <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        type="text"
                                        placeholder="Enter 6-digit OTP"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        required
                                        maxLength={6}
                                        className="pl-11 h-12 rounded-xl bg-white dark:bg-slate-900/50 dark:text-gray-100 tracking-widest text-lg font-mono text-center border-gray-200 dark:border-gray-700 focus:ring-blue-500"
                                        autoComplete="one-time-code"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" onClick={() => setStep('email')} className="flex-1 h-12 rounded-xl dark:border-gray-700 dark:text-gray-200 dark:hover:bg-slate-800">
                                    Back
                                </Button>
                                <Button type="submit" disabled={loading || otp.length !== 6} className="flex-[2] h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                                    {loading ? 'Verifying...' : 'Verify OTP'}
                                    {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                                </Button>
                            </div>
                        </motion.form>
                    )}

                    {step === 'password' && (
                        <motion.form
                            key="password-form"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            onSubmit={handleResetPassword}
                            className="space-y-4"
                        >
                            {error && <p className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-900/10 p-2 rounded-lg">{error}</p>}

                            <div className="space-y-3">
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        type="password"
                                        placeholder="New Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="pl-11 h-12 rounded-xl bg-white dark:bg-slate-900/50 dark:text-gray-100 border-gray-200 dark:border-gray-700 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        type="password"
                                        placeholder="Confirm Password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="pl-11 h-12 rounded-xl bg-white dark:bg-slate-900/50 dark:text-gray-100 border-gray-200 dark:border-gray-700 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white mt-2">
                                {loading ? 'Resetting...' : 'Reset Password'}
                                {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                            </Button>
                        </motion.form>
                    )}

                    {step === 'success' && (
                        <motion.div
                            key="success-message"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center space-y-6"
                        >
                            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
                            </div>

                            <Button onClick={onBack} className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white">
                                Back to Login
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
