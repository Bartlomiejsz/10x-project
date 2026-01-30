import type { PropsWithChildren } from 'react';

import DashboardPage from './DashboardPage';

import { DashboardStateProvider } from '@/components/providers/dashboard-state-provider';
import { ToastProvider } from '@/components/providers/toast-provider';

export type DashboardAppProps = PropsWithChildren<{
    initialMonth?: string;
}>;

const DashboardApp = ({ initialMonth, children }: DashboardAppProps) => {
    return (
        <ToastProvider>
            <DashboardStateProvider initialMonth={initialMonth}>{children ?? <DashboardPage />}</DashboardStateProvider>
        </ToastProvider>
    );
};

export default DashboardApp;
