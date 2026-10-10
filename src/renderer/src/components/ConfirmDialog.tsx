import { useEffect } from 'react';
import { useT } from '../i18n';

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useT();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog dialog-sm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="dialog-header">
          <h2 id="confirm-title" className="dialog-title">
            {title}
          </h2>
        </div>
        <div className="dialog-body">
          <p className="muted" style={{ margin: 0 }}>
            {body}
          </p>
        </div>
        <div className="dialog-footer">
          {/* Focus starts on the safe choice. */}
          <button type="button" className="btn btn-ghost" autoFocus onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
