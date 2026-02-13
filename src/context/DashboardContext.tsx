import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface DashboardData {
    pendingApprovals: any[];
    recentApprovals: any[];
    stats: any;
    inProgressUnits?: any[];
}

interface DashboardContextType {
    data: DashboardData | null;
    loading: boolean;
    error: string | null;
    refreshDashboard: () => Promise<void>;
    updateOptimistic: (newData: Partial<DashboardData>) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children, user }: { children: React.ReactNode; user: any }) {
    // Initialize from cache immediately for "WhatsApp-like" instant load
    const [data, setData] = useState<DashboardData | null>(() => {
        // Don't hydrate if not authorized
        if (!user || (user.role !== 'verifier' && user.role !== 'admin')) return null;

        try {
            const cached = localStorage.getItem('api_cache_/api/verifier/dashboard');
            if (cached) {
                const parsed = JSON.parse(cached);
                // api.js caches { timestamp, data: { success, data: { ... } } }
                // We need the inner data
                console.log('⚡ Hydrating Context from cache...');
                return parsed.data?.data || null;
            }
        } catch (e) {
            console.error('Context cache read failed', e);
        }
        return null;
    });

    const [loading, setLoading] = useState(!data);
    const [error, setError] = useState<string | null>(null);

    const refreshDashboard = async () => {
        // If user is not verifier or admin, don't fetch verifier dashboard
        if (!user || (user.role !== 'verifier' && user.role !== 'admin')) {
            setLoading(false);
            return;
        }

        // Silent update - do not set loading to true if we already have data
        if (!data) setLoading(true);

        try {
            // Check if we need to force refresh (e.g. key schema changes)
            // Always force refresh to ensure badge counts are accurate and not stuck in cache
            const forceRefresh = true;

            const response = await api.getVerifierDashboard(forceRefresh);
            if (response && response.success) {
                setData(response.data);
                setError(null);
            } else {
                if (!data) setError('Failed to load data');
            }
        } catch (err: any) {
            console.error('Context refresh error:', err);
            if (!data) setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Allow components to manually patch data (e.g. after approval) for instant feedback
    const updateOptimistic = (newData: Partial<DashboardData>) => {
        setData(prev => prev ? { ...prev, ...newData } : null);
    };

    // Initial load
    useEffect(() => {
        refreshDashboard();
        // Auto-refresh every 30s
        const interval = setInterval(refreshDashboard, 30000);
        return () => clearInterval(interval);
    }, [user]);

    return (
        <DashboardContext.Provider value={{ data, loading, error, refreshDashboard, updateOptimistic }}>
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboard() {
    const context = useContext(DashboardContext);
    if (context === undefined) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
}
