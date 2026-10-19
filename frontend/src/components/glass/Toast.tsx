import { cn } from '@/lib/utils/cn';

export interface ToastProps {
  /** Message to show; nothing renders when empty. */
  message: string | null;
  className?: string;
}

/** Glass capsule toast, fixed at the bottom centre (glass layer `.toast`). State lives in the caller. */
export function Toast({ message, className }: ToastProps) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={cn(
        'glass-strong fixed bottom-[calc(24px+env(safe-area-inset-bottom,0px))] left-1/2 z-[80] max-w-[calc(100vw-32px)] -translate-x-1/2',
        'rounded-capsule px-5 py-3 font-medium text-ink',
        className,
      )}
    >
      {message}
    </div>
  );
}
