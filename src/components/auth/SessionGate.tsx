import type { ReactNode } from 'react';

import { Loader2, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

type SessionGateStatus = 'loading' | 'ready' | 'error';

interface SessionGateProps {
    status?: SessionGateStatus;
    message?: string;
    retryLabel?: string;
    onRetry?: () => void;
    children: ReactNode;
    className?: string;
}

/**
 * SessionGate renderuje odpowiedni stan UI bez logiki sieciowej.
 * Integracja z Supabase zostanie dodana na dalszym etapie.
 */
export function SessionGate({
    status = 'loading',
    message = 'Sprawdzamy Twoją sesję...',
    retryLabel = 'Spróbuj ponownie',
    onRetry,
    children,
    className,
}: SessionGateProps) {
    if (status === 'loading') {
        return (
            <div
                role="status"
                aria-live="polite"
                className={cn(
                    'flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/70 p-8 text-center shadow-sm',
                    className
                )}
            >
                <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">{message}</p>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div
                role="alert"
                aria-live="assertive"
                className={cn(
                    'flex flex-col gap-4 rounded-xl border border-destructive/40 bg-destructive/10 p-6 shadow-sm',
                    className
                )}
            >
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <ShieldAlert className="size-4" aria-hidden />
                    <span>Problem z odświeżeniem sesji</span>
                </div>
                <p className="text-sm text-muted-foreground">{message}</p>
                {onRetry ? (
                    <Button type="button" variant="outline" size="sm" onClick={onRetry} className="self-start">
                        {retryLabel}
                    </Button>
                ) : null}
            </div>
        );
    }

    return <>{children}</>;
}
