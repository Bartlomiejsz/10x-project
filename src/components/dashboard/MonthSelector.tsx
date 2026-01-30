import { useCallback } from 'react';

import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { MonthOption } from '@/types/dashboard';

export interface MonthSelectorProps {
    value: string;
    options: MonthOption[];
    onChange: (value: string) => void;
    className?: string;
}

export const MonthSelector = ({ value, options, onChange, className }: MonthSelectorProps) => {
    const currentIndex = options.findIndex((opt) => opt.value === value);
    const currentOption = options[currentIndex];

    const canGoPrev = currentIndex < options.length - 1;
    const canGoNext = currentIndex > 0;

    const handlePrev = useCallback(() => {
        if (canGoPrev) {
            onChange(options[currentIndex + 1].value);
        }
    }, [canGoPrev, currentIndex, options, onChange]);

    const handleNext = useCallback(() => {
        if (canGoNext) {
            onChange(options[currentIndex - 1].value);
        }
    }, [canGoNext, currentIndex, options, onChange]);

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <Button
                variant="outline"
                size="icon"
                onClick={handlePrev}
                disabled={!canGoPrev}
                aria-label="Poprzedni miesiąc"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="min-w-[200px] flex-1">
                    <div className="flex items-center gap-2">
                        {currentOption?.isReadonly && (
                            <Lock className="h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />
                        )}
                        <SelectValue aria-current={currentOption?.value === value ? 'date' : undefined} />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    {options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                                <span>{opt.label}</span>
                                {opt.isReadonly && <span className="text-xs text-slate-500">(tylko podgląd)</span>}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                disabled={!canGoNext}
                aria-label="Następny miesiąc"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
};
