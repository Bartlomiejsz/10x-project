import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { ToastMessage } from '@/types';

interface ToastContextValue {
    toasts: ToastMessage[];
    pushToast: (toast: Omit<ToastMessage, 'id'> & { id?: string }) => string;
    dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const createToastId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toastTone = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
    info: 'border-slate-200 bg-white text-slate-900',
} as const;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const pushToast = useCallback((toast: Omit<ToastMessage, 'id'> & { id?: string }) => {
        const id = toast.id ?? createToastId();
        setToasts((prev) => [...prev, { ...toast, id }]);
        return id;
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((message) => message.id !== id));
    }, []);

    const value = useMemo(() => ({ toasts, pushToast, dismissToast }), [toasts, pushToast, dismissToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastArea />
        </ToastContext.Provider>
    );
};

export const useToasts = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToasts must be used within ToastProvider');
    }
    return context;
};

export const ToastArea = () => {
    const { toasts, dismissToast } = useToasts();

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center">
            <div
                aria-live="polite"
                aria-atomic="true"
                className="flex w-full max-w-md flex-col gap-3 px-4 pb-4 sm:px-0"
            >
                {toasts.length === 0 && <p className="sr-only">Brak powiadomień.</p>}
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        role="status"
                        className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg ring-1 ring-black/5 ${toastTone[toast.type]}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-semibold leading-5">{toast.message}</p>
                                {toast.description && (
                                    <p className="text-sm leading-5 text-slate-700">{toast.description}</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => dismissToast(toast.id)}
                                className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                                aria-label="Zamknij powiadomienie"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
