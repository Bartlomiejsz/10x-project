import { type ReactNode, useCallback, useState } from 'react';

import { Loader2, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

interface OAuthButtonsProps {
    onGoogleClick?: () => Promise<void> | void;
    buttonLabel?: string;
    helperText?: ReactNode;
    disabled?: boolean;
}

type FriendlyErrorKey = 'network' | 'cancelled' | 'generic';

const errorMessages: Record<FriendlyErrorKey, string> = {
    network: 'Problem z połączeniem, spróbuj ponownie.',
    cancelled: 'Logowanie przerwane. Spróbuj jeszcze raz.',
    generic: 'Coś poszło nie tak. Odśwież stronę i spróbuj ponownie.',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function OAuthButtons({
    onGoogleClick,
    buttonLabel = 'Kontynuuj z Google',
    helperText,
    disabled = false,
}: OAuthButtonsProps) {
    const [internalLoading, setInternalLoading] = useState(false);
    const [inlineError, setInlineError] = useState<string | null>(null);

    const isLoading = internalLoading;

    const handleGoogleClick = useCallback(async () => {
        if (disabled || isLoading) {
            return;
        }

        setInlineError(null);
        setInternalLoading(true);

        try {
            if (onGoogleClick) {
                await onGoogleClick();
            } else {
                await sleep(600);
                throw new Error('not-implemented');
            }
        } catch (error) {
            const message =
                error instanceof Error && error.message === 'cancelled'
                    ? errorMessages.cancelled
                    : error instanceof Error && error.message === 'network'
                      ? errorMessages.network
                      : errorMessages.generic;
            setInlineError(message);
        } finally {
            setInternalLoading(false);
        }
    }, [disabled, isLoading, onGoogleClick]);

    return (
        <div className="flex flex-col gap-3" aria-live="polite" aria-busy={isLoading}>
            <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full border-input bg-background/80"
                disabled={disabled || isLoading}
                onClick={handleGoogleClick}
            >
                {isLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <GoogleGlyph aria-hidden />}
                <span>{buttonLabel}</span>
            </Button>
            {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
            {inlineError ? (
                <p
                    className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                    role="alert"
                >
                    <ShieldAlert className="size-4" aria-hidden />
                    <span>{inlineError}</span>
                </p>
            ) : null}
        </div>
    );
}

function GoogleGlyph(props: React.ComponentProps<'svg'>) {
    return (
        <svg viewBox="0 0 24 24" className={cn('size-5', props.className)} {...props}>
            <title>Google</title>
            <path
                fill="#EA4335"
                d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3 2.3c1.8-1.7 2.8-4.1 2.8-6.9 0-.7-.1-1.4-.2-2H12z"
            />
            <path
                fill="#34A853"
                d="M5.3 14.3l-.8.6-2.4 1.9C4 19.8 7.7 22 12 22c3 0 5.5-1 7.3-2.7l-3-2.3c-.8.5-1.9.8-3.3.8-2.6 0-4.8-1.7-5.6-4z"
            />
            <path
                fill="#4A90E2"
                d="M2.1 6.2A9.97 9.97 0 0 0 2 12c0 1.8.5 3.5 1.5 5l3.3-2.5C6.3 13.6 6 12.8 6 12s.3-1.6.8-2.2z"
            />
            <path
                fill="#FBBC05"
                d="M12 4.8c1.6 0 3 .6 4.1 1.7l3-3C17.5 1.3 14.9 0 12 0 7.7 0 4 2.2 2.2 5.8l3.6 2.8C7.2 6.5 9.4 4.8 12 4.8z"
            />
        </svg>
    );
}
