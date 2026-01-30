import { useCallback, useEffect, useMemo, useState } from 'react';

import { computeReadonlyFlags, normalizeMonthParam } from '@/lib/month';

const syncMonthInUrl = (value: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('month', value);
    window.history.replaceState(window.history.state, '', url.toString());
};

export const useMonthParam = (initialMonth?: string) => {
    const [month, setMonthState] = useState(() => normalizeMonthParam(initialMonth));

    const setMonth = useCallback((value: string) => {
        setMonthState((prev) => {
            const normalized = normalizeMonthParam(value);
            if (normalized.value === prev.value) {
                return prev;
            }
            syncMonthInUrl(normalized.value);
            return normalized;
        });
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        const urlMonth = url.searchParams.get('month');

        if (!urlMonth) {
            syncMonthInUrl(month.value);
        }
    }, [month.value]);

    const readonly = useMemo(() => computeReadonlyFlags(month), [month]);

    return {
        month,
        readonly,
        setMonth,
    };
};
