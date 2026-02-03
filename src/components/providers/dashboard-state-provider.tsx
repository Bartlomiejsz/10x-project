import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useMonthParam } from '../hooks/useMonthParam';

import type {
    DashboardDataVM,
    MonthParam,
    ReadonlyFlags,
    TransactionDialogMode,
    TransactionDialogState,
    TransactionFilterVM,
} from '@/types/dashboard';

export interface DashboardStateContextValue {
    month: MonthParam;
    readonly: ReadonlyFlags;
    setMonth: (value: string) => void;
    filters: TransactionFilterVM;
    updateFilters: (patch: Partial<TransactionFilterVM>) => void;
    resetFilters: () => void;
    dialog: TransactionDialogState;
    openDialog: (mode: TransactionDialogMode, transactionId?: string) => void;
    closeDialog: () => void;
    data?: DashboardDataVM;
}

const DashboardStateContext = createContext<DashboardStateContextValue | undefined>(undefined);

const DEFAULT_FILTERS: TransactionFilterVM = { sort: 'date.desc' };

const cloneDefaultFilters = () => ({ ...DEFAULT_FILTERS });

export const DashboardStateProvider = ({ initialMonth, children }: { initialMonth?: string; children: ReactNode }) => {
    const { month, readonly, setMonth } = useMonthParam(initialMonth);
    const [filters, setFilters] = useState<TransactionFilterVM>(() => cloneDefaultFilters());
    const [dialog, setDialog] = useState<TransactionDialogState>({ isOpen: false, mode: 'create' });

    const updateFilters = useCallback((patch: Partial<TransactionFilterVM>) => {
        setFilters((prev) => ({ ...prev, ...patch }));
    }, []);

    const resetFilters = useCallback(() => setFilters(cloneDefaultFilters()), []);

    const openDialog = useCallback((mode: TransactionDialogMode, transactionId?: string) => {
        setDialog({ isOpen: true, mode, transactionId });
    }, []);

    const closeDialog = useCallback(() => {
        setDialog((prev) => ({ ...prev, isOpen: false, transactionId: undefined }));
    }, []);

    const value = useMemo<DashboardStateContextValue>(
        () => ({
            month,
            readonly,
            setMonth,
            filters,
            updateFilters,
            resetFilters,
            dialog,
            openDialog,
            closeDialog,
            data: undefined,
        }),
        [month, readonly, setMonth, filters, updateFilters, resetFilters, dialog, openDialog, closeDialog]
    );

    return <DashboardStateContext.Provider value={value}>{children}</DashboardStateContext.Provider>;
};

export const useDashboardState = () => {
    const ctx = useContext(DashboardStateContext);

    if (!ctx) {
        throw new Error('useDashboardState must be used within DashboardStateProvider');
    }

    return ctx;
};
