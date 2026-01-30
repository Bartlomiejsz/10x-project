import { type ReactNode, useCallback } from 'react';

import { OAuthButtons } from '@/components/auth/OAuthButtons';

const GOOGLE_OAUTH_PATH = '/auth/oauth/google';

interface GoogleOAuthButtonsProps {
    buttonLabel?: string;
    helperText?: ReactNode;
    disabled?: boolean;
}

const buildOAuthRequestUrl = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    return new URL(GOOGLE_OAUTH_PATH, window.location.origin).toString();
};

export function GoogleOAuthButtons(props: GoogleOAuthButtonsProps) {
    const handleGoogleClick = useCallback(() => {
        const targetUrl = buildOAuthRequestUrl();

        if (!targetUrl) {
            throw new Error('generic');
        }

        window.location.assign(targetUrl);
    }, []);

    return <OAuthButtons {...props} onGoogleClick={handleGoogleClick} />;
}

export type { GoogleOAuthButtonsProps };
