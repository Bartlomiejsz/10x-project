import { TransactionForm, type TransactionFormSubmitValues } from './transaction-form';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import type { TransactionTypeDTO } from '@/types';
import type { TransactionDialogMode, TransactionFormValues } from '@/types/dashboard';

export interface TransactionDialogSubmitPayload {
    mode: TransactionDialogMode;
    transactionId?: string;
    values: TransactionFormSubmitValues;
}

export interface TransactionDialogProps {
    open: boolean;
    mode: TransactionDialogMode;
    types: TransactionTypeDTO[];
    transactionId?: string;
    initial?: Partial<TransactionFormValues>;
    isReadonly?: boolean;
    isSaving?: boolean;
    error?: string | null;
    onClose: () => void;
    onSubmit: (payload: TransactionDialogSubmitPayload) => void;
}

export const TransactionDialog = ({
    open,
    mode,
    types,
    transactionId,
    initial,
    isReadonly,
    isSaving,
    error,
    onClose,
    onSubmit,
}: TransactionDialogProps) => {
    const handleFormSubmit = (values: TransactionFormSubmitValues) => {
        onSubmit({
            mode,
            transactionId,
            values,
        });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? 'Dodaj transakcję' : 'Edytuj transakcję'}</DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Wprowadź szczegóły wydatku dla wybranego miesiąca.'
                            : 'Zmień szczegóły transakcji.'}
                    </DialogDescription>
                </DialogHeader>

                <TransactionForm
                    mode={mode}
                    types={types}
                    transactionId={transactionId}
                    initial={initial}
                    isReadonly={isReadonly}
                    isSaving={isSaving}
                    error={error}
                    isOpen={open}
                    onClose={onClose}
                    onSubmit={handleFormSubmit}
                />
            </DialogContent>
        </Dialog>
    );
};
