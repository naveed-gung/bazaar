import { useRef, useSyncExternalStore } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/components/focus-trap";

/**
 * Promise-based confirm dialog. Mounted once at the root (`ConfirmDialogHost`);
 * anywhere in the tree calls `const ok = await confirmDialog({...})`. Traps
 * focus, closes on Escape, and returns focus to the trigger element.
 * Destructive actions keep the `.btn-danger` + two-step-confirm convention.
 * Swiss: a flat ruled `.panel` over a plain ink-alpha overlay — no blur.
 */

export type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PendingConfirm = ConfirmOptions & { resolve: (confirmed: boolean) => void };

let pending: PendingConfirm | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function settle(confirmed: boolean) {
  const current = pending;
  pending = null;
  emit();
  current?.resolve(confirmed);
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    pending = { ...options, resolve };
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Renders the active confirmation. Mount once, near the end of the root layout. */
export function ConfirmDialogHost() {
  // Module-level state exists on the server too, so one getter serves both.
  const getSnapshot = () => pending;
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, current !== null, () => settle(false));

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-foreground/50 p-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={current.body ? "confirm-dialog-body" : undefined}
        className="panel w-full max-w-md"
      >
        <div className="p-6">
          <span
            className={cn(
              "grid h-11 w-11 place-items-center border",
              current.destructive
                ? "border-destructive/40 text-destructive"
                : "border-border text-accent",
            )}
            aria-hidden="true"
          >
            <TriangleAlert className="h-5 w-5" />
          </span>
          <h2
            id="confirm-dialog-title"
            className="font-display mt-4 text-lg font-semibold uppercase tracking-tight"
          >
            {current.title}
          </h2>
          {current.body && (
            <p
              id="confirm-dialog-body"
              className="mt-2 text-sm leading-relaxed text-muted-foreground"
            >
              {current.body}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" className="btn btn-quiet" onClick={() => settle(false)}>
              {current.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              className={cn(current.destructive ? "btn btn-danger" : "btn btn-primary")}
              onClick={() => settle(true)}
            >
              {current.confirmLabel ?? "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
