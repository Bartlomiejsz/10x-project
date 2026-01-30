import type { PaginatedResponse, TransactionTypeDTO } from '../types';

export interface ConfidenceVM {
    status: 'success' | 'fallback' | 'error';
    confidence?: number | null;
    level: 'high' | 'medium' | 'low';
}

export interface MonthParam {
    value: string; // YYYY-MM
    date: Date;
}

export interface ReadonlyFlags {
    isReadonly: boolean;
    canEditBudgets: boolean;
    canEditTransactions: boolean;
}

export interface ChartItemVM {
    typeId: number;
    typeName: string;
    budget: number | null;
    spend: number;
    percent: number;
    status: 'ok' | 'warn' | 'over';
    overAmount: number;
    shares?: { userId: string; amount: number }[];
}

export interface TotalProgressVM {
    budget: number;
    spend: number;
    percent: number;
    status: 'ok' | 'warn' | 'over';
}

export interface TransactionListItemVM {
    id: string;
    type: TransactionTypeDTO;
    amount: number;
    description: string;
    date: string;
    ai: ConfidenceVM;
    isManual: boolean;
}

export interface TransactionFilterVM {
    q?: string;
    typeId?: number;
    sort: 'date.desc' | 'date.asc' | 'amount.desc' | 'amount.asc';
}

export interface TransactionFormValues {
    amount: string;
    description: string;
    date: string;
    type_id: number;
    is_manual_override?: boolean;
}

export interface MonthOption {
    value: string;
    label: string;
    isReadonly: boolean;
}

export type TransactionDialogMode = 'create' | 'edit';

export interface TransactionDialogState {
    isOpen: boolean;
    mode: TransactionDialogMode;
    transactionId?: string;
}

export interface DashboardDataVM {
    chart: ChartItemVM[];
    total: TotalProgressVM;
    transactions: PaginatedResponse<TransactionListItemVM>;
    month: MonthParam;
    readonly: ReadonlyFlags;
}
