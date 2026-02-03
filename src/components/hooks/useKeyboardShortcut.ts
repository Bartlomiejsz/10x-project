import { useCallback, useEffect } from 'react';

export interface KeyboardShortcut {
    /** Key to listen for (e.g., 'Enter', 'Escape', 's') */
    key: string;
    /** Require Ctrl key (Windows/Linux) */
    ctrlKey?: boolean;
    /** Require Meta key (Mac Command) */
    metaKey?: boolean;
    /** Require Shift key */
    shiftKey?: boolean;
    /** Require Alt key */
    altKey?: boolean;
}

export interface UseKeyboardShortcutOptions {
    /** Whether the shortcut is active (default: true) */
    enabled?: boolean;
    /** Prevent default browser behavior (default: true) */
    preventDefault?: boolean;
}

/**
 * Hook for handling keyboard shortcuts with modifier keys support.
 *
 * @param shortcut - The key combination to listen for
 * @param callback - Function to call when shortcut is triggered
 * @param options - Additional configuration options
 *
 * @example
 * // Ctrl/Cmd + Enter to submit
 * useKeyboardShortcut(
 *   { key: 'Enter', ctrlKey: true, metaKey: true },
 *   handleSubmit,
 *   { enabled: isFormOpen }
 * );
 */
export function useKeyboardShortcut(
    shortcut: KeyboardShortcut,
    callback: () => void,
    options: UseKeyboardShortcutOptions = {}
): void {
    const { enabled = true, preventDefault = true } = options;

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            const { key, ctrlKey = false, metaKey = false, shiftKey = false, altKey = false } = shortcut;

            // Check if the pressed key matches
            if (event.key !== key) return;

            // For Ctrl/Meta shortcuts, allow either modifier (cross-platform support)
            const requiresCtrlOrMeta = ctrlKey || metaKey;
            const hasCtrlOrMeta = event.ctrlKey || event.metaKey;

            if (requiresCtrlOrMeta && !hasCtrlOrMeta) return;
            if (!requiresCtrlOrMeta && hasCtrlOrMeta) return;

            // Check other modifiers exactly
            if (shiftKey !== event.shiftKey) return;
            if (altKey !== event.altKey) return;

            if (preventDefault) {
                event.preventDefault();
            }

            callback();
        },
        [shortcut, callback, preventDefault]
    );

    useEffect(() => {
        if (!enabled) return;

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [enabled, handleKeyDown]);
}
