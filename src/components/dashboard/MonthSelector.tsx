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
        <div className={cn('flex items-center gap-2', className)} data-testid="month-selector">
            <Button
                variant="outline"
                size="icon"
                onClick={handlePrev}
                disabled={!canGoPrev}
                aria-label="Poprzedni miesiąc"
                data-testid="month-selector-prev"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="min-w-[200px] flex-1" data-testid="month-selector-trigger">
                    <div className="flex items-center gap-2">
                        <SelectValue aria-current={currentOption?.value === value ? 'date' : undefined} />
                    </div>
                </SelectTrigger>
                <SelectContent data-testid="month-selector-content">
                    {options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} data-testid={`month-option-${opt.value}`}>
                            <div className="flex items-center gap-2">
                                {opt.isReadonly && (
                                    <Lock className="h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />
                                )}
                                <span>{opt.label}</span>
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
                data-testid="month-selector-next"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
};
