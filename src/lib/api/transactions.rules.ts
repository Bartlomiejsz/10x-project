import type { PatchTransactionCommand, UpdateTransactionCommand } from '../../types';

export function shouldRejectAiUpdate(input: {
    is_manual_override?: boolean;
    ai_status?: PatchTransactionCommand['ai_status'] | UpdateTransactionCommand['ai_status'];
    ai_confidence?: PatchTransactionCommand['ai_confidence'] | UpdateTransactionCommand['ai_confidence'];
}): boolean {
    return input.is_manual_override !== true && (input.ai_status !== undefined || input.ai_confidence !== undefined);
}
