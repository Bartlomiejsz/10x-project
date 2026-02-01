import { type RefObject, useEffect } from 'react';

export interface UseClickOutsideOptions {
    /**
     * Selectors for elements that should NOT trigger onClose when clicked.
     * If clicked on these elements (within the container), onClose won't be called.
     */
    allowedSelectors?: string[];
    /** Also close on Escape key press (default: true) */
    closeOnEscape?: boolean;
    /**
     * If true, clicking inside the container but outside allowed elements will also trigger onClose.
     * If false (default), only clicks truly outside the container trigger onClose.
     */
    closeOnInsideClickOutsideAllowed?: boolean;
}

/**
 * Hook that triggers a callback when clicking outside of a referenced element,
 * with support for allowed inner elements and Escape key handling.
 *
 * @param ref - Reference to the container element
 * @param onClose - Callback to execute on outside click
 * @param enabled - Whether the hook is active (useful for conditional behavior)
 * @param options - Additional configuration options
 */
export function useClickOutside(
    ref: RefObject<HTMLElement | null>,
    onClose: () => void,
    enabled = true,
    options: UseClickOutsideOptions = {}
): void {
    const { allowedSelectors = [], closeOnEscape = true, closeOnInsideClickOutsideAllowed = false } = options;

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        const handlePointerDown = (e: MouseEvent | TouchEvent) => {
            const container = ref.current;
            if (!container) return;

            const target = e.target;
            if (!(target instanceof Node)) return;

            // Click outside the container - always close
            if (!container.contains(target)) {
                onClose();
                return;
            }

            // Click inside container
            if (!closeOnInsideClickOutsideAllowed) {
                return; // Don't close for inside clicks
            }

            // Check if click is on any allowed element
            for (const selector of allowedSelectors) {
                const element = container.querySelector(selector);
                if (element && element.contains(target)) {
                    return; // Click on allowed element - don't close
                }
            }

            // Click inside container but not on allowed elements - close
            onClose();
        };

        if (closeOnEscape) {
            document.addEventListener('keydown', handleKeyDown);
        }
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown, { passive: true });

        return () => {
            if (closeOnEscape) {
                document.removeEventListener('keydown', handleKeyDown);
            }
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    }, [ref, onClose, enabled, allowedSelectors, closeOnEscape, closeOnInsideClickOutsideAllowed]);
}
