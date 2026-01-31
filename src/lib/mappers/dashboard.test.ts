import {
    type TransactionInput,
    createBudgetMap,
    mapReportToChartItems,
    mapReportToTotal,
    mapTransactionToVM,
} from './dashboard';
import { describe, expect, it } from 'vitest';

import type { BudgetDTO, MonthlyReportDTO, TransactionTypeDTO } from '@/types';

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockReport = (overrides: Partial<MonthlyReportDTO> = {}): MonthlyReportDTO => ({
    month: '2026-01',
    summary: [
        {
            type_id: 1,
            type_name: 'Jedzenie',
            budget: 1000,
            spend: 500,
            transactions_count: 10,
            shares: [],
        },
    ],
    totals: {
        budget: 1000,
        spend: 500,
    },
    ...overrides,
});

const createMockTypes = (): TransactionTypeDTO[] => [
    { id: 1, code: 'food', name: 'Jedzenie', position: 1 },
    { id: 2, code: 'transport', name: 'Transport', position: 2 },
    { id: 3, code: 'entertainment', name: 'Rozrywka', position: 3 },
];

const createMockTransaction = (overrides: Partial<TransactionInput> = {}): TransactionInput => ({
    id: 'tx-123',
    type_id: 1,
    amount: 150,
    description: 'Zakupy w sklepie',
    date: '2026-01-15',
    ai_status: 'success',
    ai_confidence: 0.95,
    is_manual_override: false,
    ...overrides,
});

// =============================================================================
// mapReportToChartItems
// =============================================================================

describe('mapReportToChartItems', () => {
    describe('basic mapping', () => {
        it('should map report summary to chart items with correct structure', () => {
            // Arrange
            const report = createMockReport();
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                typeId: 1,
                typeName: 'Jedzenie',
                spend: 500,
            });
        });

        it('should map multiple summary items', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 1000, spend: 500, transactions_count: 5, shares: [] },
                    { type_id: 2, type_name: 'Transport', budget: 500, spend: 300, transactions_count: 3, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0].typeId).toBe(1);
            expect(result[1].typeId).toBe(2);
        });
    });

    describe('budget resolution', () => {
        it('should prefer budget from map over report budget', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 1000, spend: 500, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>([[1, 2000]]);

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].budget).toBe(2000);
        });

        it('should fall back to report budget when map entry is missing', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 1000, spend: 500, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].budget).toBe(1000);
        });

        it('should fall back to report budget when map entry is null (nullish coalescing)', () => {
            // Arrange
            // Note: null in map is treated as "no override" due to ?? operator
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 1000, spend: 500, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>([[1, null]]);

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert - falls back to report.budget because ?? treats null as falsy
            expect(result[0].budget).toBe(1000);
        });

        it('should handle null budget from both sources', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: null, spend: 500, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].budget).toBeNull();
        });
    });

    describe('percentage calculation', () => {
        it('should calculate correct percentage when budget exists', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 1000, spend: 250, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].percent).toBe(25);
        });

        it('should return 0% when budget is null', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: null, spend: 500, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].percent).toBe(0);
        });

        it('should return 0% when budget is zero', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 0, spend: 500, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>([[1, 0]]);

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].percent).toBe(0);
        });

        it('should handle percentage over 100%', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 100, spend: 150, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].percent).toBe(150);
        });
    });

    describe('status thresholds', () => {
        it('should return "ok" status when spend is below 80%', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 1000, spend: 790, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].status).toBe('ok');
            expect(result[0].percent).toBe(79);
        });

        it('should return "warn" status when spend is exactly 80%', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 1000, spend: 800, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].status).toBe('warn');
        });

        it('should return "warn" status when spend is exactly 100%', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 1000, spend: 1000, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].status).toBe('warn');
        });

        it('should return "over" status when spend exceeds 100%', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 1000, spend: 1001, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].status).toBe('over');
        });

        it('should return "ok" status when budget is null (no threshold applicable)', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: null, spend: 5000, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].status).toBe('ok');
        });
    });

    describe('overAmount calculation', () => {
        it('should calculate overAmount when spend exceeds budget', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 1000, spend: 1250, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].overAmount).toBe(250);
        });

        it('should return 0 overAmount when spend is within budget', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 1000, spend: 500, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].overAmount).toBe(0);
        });

        it('should return 0 overAmount when spend equals budget', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 1000, spend: 1000, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].overAmount).toBe(0);
        });

        it('should handle overAmount when budget is null (full spend is over)', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: null, spend: 500, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].overAmount).toBe(500);
        });
    });

    describe('shares processing', () => {
        it('should map and sort shares by amount descending', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    {
                        type_id: 1,
                        type_name: 'Jedzenie',
                        budget: 1000,
                        spend: 500,
                        transactions_count: 5,
                        shares: [
                            { user_id: 'user-1', spend: 100, transactions_count: 2 },
                            { user_id: 'user-2', spend: 300, transactions_count: 5 },
                            { user_id: 'user-3', spend: 200, transactions_count: 3 },
                        ],
                    },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].shares).toEqual([
                { userId: 'user-2', amount: 300 },
                { userId: 'user-3', amount: 200 },
                { userId: 'user-1', amount: 100 },
            ]);
        });

        it('should filter out shares with zero amount', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    {
                        type_id: 1,
                        type_name: 'Jedzenie',
                        budget: 1000,
                        spend: 500,
                        transactions_count: 5,
                        shares: [
                            { user_id: 'user-1', spend: 100, transactions_count: 2 },
                            { user_id: 'user-2', spend: 0, transactions_count: 0 },
                        ],
                    },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].shares).toEqual([{ userId: 'user-1', amount: 100 }]);
        });

        it('should handle empty shares array', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    { type_id: 1, type_name: 'Jedzenie', budget: 1000, spend: 500, transactions_count: 5, shares: [] },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].shares).toEqual([]);
        });

        it('should handle undefined shares', () => {
            // Arrange
            const report = createMockReport({
                summary: [
                    {
                        type_id: 1,
                        type_name: 'Jedzenie',
                        budget: 1000,
                        spend: 500,
                        transactions_count: 5,
                        shares: undefined as unknown as [],
                    },
                ],
            });
            const budgetMap = new Map<number, number | null>();

            // Act
            const result = mapReportToChartItems(report, budgetMap);

            // Assert
            expect(result[0].shares).toEqual([]);
        });
    });
});

// =============================================================================
// mapReportToTotal
// =============================================================================

describe('mapReportToTotal', () => {
    describe('basic mapping', () => {
        it('should map totals with correct structure', () => {
            // Arrange
            const report = createMockReport({
                totals: { budget: 5000, spend: 2500 },
            });

            // Act
            const result = mapReportToTotal(report);

            // Assert
            expect(result).toEqual({
                budget: 5000,
                spend: 2500,
                percent: 50,
                status: 'ok',
            });
        });
    });

    describe('percentage calculation', () => {
        it('should calculate correct percentage', () => {
            // Arrange
            const report = createMockReport({
                totals: { budget: 1000, spend: 333 },
            });

            // Act
            const result = mapReportToTotal(report);

            // Assert
            expect(result.percent).toBeCloseTo(33.3, 1);
        });

        it('should return 0% when budget is zero', () => {
            // Arrange
            const report = createMockReport({
                totals: { budget: 0, spend: 500 },
            });

            // Act
            const result = mapReportToTotal(report);

            // Assert
            expect(result.percent).toBe(0);
        });

        it('should handle 100% spend', () => {
            // Arrange
            const report = createMockReport({
                totals: { budget: 1000, spend: 1000 },
            });

            // Act
            const result = mapReportToTotal(report);

            // Assert
            expect(result.percent).toBe(100);
        });
    });

    describe('status thresholds', () => {
        it('should return "ok" when below 80%', () => {
            // Arrange
            const report = createMockReport({
                totals: { budget: 1000, spend: 799 },
            });

            // Act
            const result = mapReportToTotal(report);

            // Assert
            expect(result.status).toBe('ok');
        });

        it('should return "warn" at exactly 80%', () => {
            // Arrange
            const report = createMockReport({
                totals: { budget: 1000, spend: 800 },
            });

            // Act
            const result = mapReportToTotal(report);

            // Assert
            expect(result.status).toBe('warn');
        });

        it('should return "warn" at exactly 100%', () => {
            // Arrange
            const report = createMockReport({
                totals: { budget: 1000, spend: 1000 },
            });

            // Act
            const result = mapReportToTotal(report);

            // Assert
            expect(result.status).toBe('warn');
        });

        it('should return "over" above 100%', () => {
            // Arrange
            const report = createMockReport({
                totals: { budget: 1000, spend: 1001 },
            });

            // Act
            const result = mapReportToTotal(report);

            // Assert
            expect(result.status).toBe('over');
        });

        it('should return "ok" when budget is zero', () => {
            // Arrange
            const report = createMockReport({
                totals: { budget: 0, spend: 5000 },
            });

            // Act
            const result = mapReportToTotal(report);

            // Assert
            expect(result.status).toBe('ok');
        });
    });

    describe('edge cases', () => {
        it('should handle both zero budget and spend', () => {
            // Arrange
            const report = createMockReport({
                totals: { budget: 0, spend: 0 },
            });

            // Act
            const result = mapReportToTotal(report);

            // Assert
            expect(result).toEqual({
                budget: 0,
                spend: 0,
                percent: 0,
                status: 'ok',
            });
        });

        it('should handle very large numbers', () => {
            // Arrange
            const report = createMockReport({
                totals: { budget: 1_000_000, spend: 850_000 },
            });

            // Act
            const result = mapReportToTotal(report);

            // Assert
            expect(result.percent).toBe(85);
            expect(result.status).toBe('warn');
        });
    });
});

// =============================================================================
// mapTransactionToVM
// =============================================================================

describe('mapTransactionToVM', () => {
    describe('basic mapping', () => {
        it('should map transaction with correct structure', () => {
            // Arrange
            const transaction = createMockTransaction();
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result).toMatchObject({
                id: 'tx-123',
                amount: 150,
                description: 'Zakupy w sklepie',
                date: '2026-01-15',
                isManual: false,
            });
        });
    });

    describe('type resolution', () => {
        it('should find and attach matching type', () => {
            // Arrange
            const transaction = createMockTransaction({ type_id: 2 });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.type).toEqual({
                id: 2,
                code: 'transport',
                name: 'Transport',
                position: 2,
            });
        });

        it('should use fallback type when type_id not found', () => {
            // Arrange
            const transaction = createMockTransaction({ type_id: 999 });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.type).toEqual({
                id: 999,
                code: 'unknown',
                name: 'Nieznana kategoria',
                position: 0,
            });
        });

        it('should handle empty types array', () => {
            // Arrange
            const transaction = createMockTransaction({ type_id: 1 });
            const types: TransactionTypeDTO[] = [];

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.type.code).toBe('unknown');
        });
    });

    describe('AI confidence levels', () => {
        it('should map confidence >= 0.8 to "high" level', () => {
            // Arrange
            const transaction = createMockTransaction({ ai_confidence: 0.8 });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.ai.level).toBe('high');
        });

        it('should map confidence 0.95 to "high" level', () => {
            // Arrange
            const transaction = createMockTransaction({ ai_confidence: 0.95 });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.ai.level).toBe('high');
        });

        it('should map confidence >= 0.5 and < 0.8 to "medium" level', () => {
            // Arrange
            const transaction = createMockTransaction({ ai_confidence: 0.5 });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.ai.level).toBe('medium');
        });

        it('should map confidence 0.79 to "medium" level', () => {
            // Arrange
            const transaction = createMockTransaction({ ai_confidence: 0.79 });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.ai.level).toBe('medium');
        });

        it('should map confidence < 0.5 to "low" level', () => {
            // Arrange
            const transaction = createMockTransaction({ ai_confidence: 0.49 });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.ai.level).toBe('low');
        });

        it('should map confidence 0 to "low" level', () => {
            // Arrange
            const transaction = createMockTransaction({ ai_confidence: 0 });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.ai.level).toBe('low');
        });

        it('should map null confidence to "low" level', () => {
            // Arrange
            const transaction = createMockTransaction({ ai_confidence: null });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.ai.level).toBe('low');
            expect(result.ai.confidence).toBeNull();
        });
    });

    describe('AI status mapping', () => {
        it('should preserve "success" status', () => {
            // Arrange
            const transaction = createMockTransaction({ ai_status: 'success' });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.ai.status).toBe('success');
        });

        it('should preserve "fallback" status', () => {
            // Arrange
            const transaction = createMockTransaction({ ai_status: 'fallback' });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.ai.status).toBe('fallback');
        });

        it('should preserve "error" status', () => {
            // Arrange
            const transaction = createMockTransaction({ ai_status: 'error' });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.ai.status).toBe('error');
        });

        it('should map null status to "error"', () => {
            // Arrange
            const transaction = createMockTransaction({ ai_status: null });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.ai.status).toBe('error');
        });
    });

    describe('manual override flag', () => {
        it('should map is_manual_override true', () => {
            // Arrange
            const transaction = createMockTransaction({ is_manual_override: true });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.isManual).toBe(true);
        });

        it('should map is_manual_override false', () => {
            // Arrange
            const transaction = createMockTransaction({ is_manual_override: false });
            const types = createMockTypes();

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.isManual).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('should handle transaction with all edge values', () => {
            // Arrange
            const transaction = createMockTransaction({
                type_id: 999,
                amount: 0,
                description: '',
                ai_status: null,
                ai_confidence: null,
                is_manual_override: true,
            });
            const types: TransactionTypeDTO[] = [];

            // Act
            const result = mapTransactionToVM(transaction, types);

            // Assert
            expect(result.amount).toBe(0);
            expect(result.description).toBe('');
            expect(result.type.code).toBe('unknown');
            expect(result.ai.status).toBe('error');
            expect(result.ai.level).toBe('low');
            expect(result.isManual).toBe(true);
        });
    });
});

// =============================================================================
// createBudgetMap
// =============================================================================

describe('createBudgetMap', () => {
    it('should create map from budget array', () => {
        // Arrange
        const budgets: BudgetDTO[] = [
            { id: '1', type_id: 1, month_date: '2026-01-01', amount: 1000, created_at: '', updated_at: '' },
            { id: '2', type_id: 2, month_date: '2026-01-01', amount: 500, created_at: '', updated_at: '' },
        ];

        // Act
        const result = createBudgetMap(budgets);

        // Assert
        expect(result.get(1)).toBe(1000);
        expect(result.get(2)).toBe(500);
        expect(result.size).toBe(2);
    });

    it('should handle null amounts', () => {
        // Arrange
        const budgets: BudgetDTO[] = [
            { id: '1', type_id: 1, month_date: '2026-01-01', amount: null, created_at: '', updated_at: '' },
        ];

        // Act
        const result = createBudgetMap(budgets);

        // Assert
        expect(result.get(1)).toBeNull();
    });

    it('should handle empty array', () => {
        // Arrange
        const budgets: BudgetDTO[] = [];

        // Act
        const result = createBudgetMap(budgets);

        // Assert
        expect(result.size).toBe(0);
    });

    it('should overwrite duplicate type_ids with last value', () => {
        // Arrange
        const budgets: BudgetDTO[] = [
            { id: '1', type_id: 1, month_date: '2026-01-01', amount: 1000, created_at: '', updated_at: '' },
            { id: '2', type_id: 1, month_date: '2026-01-01', amount: 2000, created_at: '', updated_at: '' },
        ];

        // Act
        const result = createBudgetMap(budgets);

        // Assert
        expect(result.get(1)).toBe(2000);
        expect(result.size).toBe(1);
    });
});
