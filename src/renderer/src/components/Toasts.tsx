import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useT } from '../i18n';
import { useUi, type Toast } from '../stores/ui';

function ToastView({ toast }: { toast: Toast }) {
  const t = useT();
  const dismiss = useUi((s) => s.dismissToast);

  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismiss]);

  return (
    <div className={`toast toast-${toast.tone}`} role="status">
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            toast.action?.run();
            dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={() => dismiss(toast.id)}>
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <ToastView key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
