import { useState, useCallback } from "react";

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info" | "success";
}

interface ConfirmDialogState extends ConfirmOptions {
    isOpen: boolean;
    resolve: ((value: boolean) => void) | null;
}

/**
 * A hook that provides a Promise-based confirm dialog.
 *
 * Usage:
 * ```tsx
 * const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();
 *
 * // In JSX:
 * <ConfirmDialog
 *   isOpen={confirmState.isOpen}
 *   title={confirmState.title}
 *   message={confirmState.message}
 *   variant={confirmState.variant}
 *   onConfirm={handleConfirm}
 *   onCancel={handleCancel}
 * />
 *
 * // To use:
 * const ok = await confirm({ message: "Delete this item?" });
 * if (ok) { ... }
 * ```
 */
export function useConfirmDialog() {
    const [confirmState, setConfirmState] = useState<ConfirmDialogState>({
        isOpen: false,
        message: "",
        resolve: null,
    });

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmState({
                isOpen: true,
                resolve,
                ...options,
            });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        confirmState.resolve?.(true);
        setConfirmState((prev) => ({ ...prev, isOpen: false, resolve: null }));
    }, [confirmState]);

    const handleCancel = useCallback(() => {
        confirmState.resolve?.(false);
        setConfirmState((prev) => ({ ...prev, isOpen: false, resolve: null }));
    }, [confirmState]);

    return {
        confirmState,
        confirm,
        handleConfirm,
        handleCancel,
    };
}
