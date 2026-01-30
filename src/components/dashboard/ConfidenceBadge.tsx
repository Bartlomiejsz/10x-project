import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ConfidenceVM } from '@/types/dashboard';

export interface ConfidenceBadgeProps {
    value: ConfidenceVM;
    className?: string;
}

const getLevelLabel = (level: ConfidenceVM['level']) => {
    switch (level) {
        case 'high':
            return 'Wysoka';
        case 'medium':
            return 'Średnia';
        case 'low':
            return 'Niska';
    }
};

const getStatusLabel = (status: ConfidenceVM['status']) => {
    switch (status) {
        case 'success':
            return 'AI';
        case 'fallback':
            return 'Fallback';
        case 'error':
            return 'Błąd';
    }
};

const getBadgeStyle = (value: ConfidenceVM) => {
    if (value.status === 'error') {
        return 'border-red-200 bg-red-50 text-red-900';
    }

    if (value.status === 'fallback') {
        return 'border-amber-200 bg-amber-50 text-amber-900';
    }

    if (value.level === 'high') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    }

    if (value.level === 'medium') {
        return 'border-slate-200 bg-slate-50 text-slate-900';
    }

    return 'border-slate-200 bg-slate-50 text-slate-900';
};

const getIcon = (value: ConfidenceVM) => {
    if (value.status === 'error') return AlertTriangle;
    if (value.status === 'fallback') return HelpCircle;
    return CheckCircle2;
};

export function ConfidenceBadge({ value, className }: ConfidenceBadgeProps) {
    const Icon = getIcon(value);

    const confidencePercent =
        typeof value.confidence === 'number' && Number.isFinite(value.confidence)
            ? Math.round(value.confidence * 100)
            : undefined;

    const titleParts = [
        `Status: ${getStatusLabel(value.status)}`,
        `Pewność: ${getLevelLabel(value.level)}`,
        confidencePercent !== undefined ? `${confidencePercent}%` : undefined,
    ].filter(Boolean);

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium',
                getBadgeStyle(value),
                className
            )}
            title={titleParts.join(' · ')}
        >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{getStatusLabel(value.status)}</span>
            <span className="text-[11px] opacity-80">{getLevelLabel(value.level)}</span>
        </span>
    );
}
