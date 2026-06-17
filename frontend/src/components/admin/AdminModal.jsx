import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const WIDTH_CLASS = {
  sm: 'max-w-lg',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-4xl',
};

/**
 * Centered modal for admin view/edit flows triggered by icon buttons.
 */
export default function AdminModal({
  open,
  onClose,
  title,
  description,
  size = 'sm',
  children,
  bodyClassName = '',
  padding = true,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthClass = WIDTH_CLASS[size] || WIDTH_CLASS.sm;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`bg-white w-full ${widthClass} max-h-[90vh] rounded-2xl shadow-xl flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
      >
        <div className="bg-white border-b border-aegean-100 px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl shrink-0">
          <div className="min-w-0">
            <h2 id="admin-modal-title" className="text-xl font-serif text-aegean-800">
              {title}
            </h2>
            {description && <p className="text-sm text-aegean-600 mt-1">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-aegean-50 rounded-lg shrink-0 text-aegean-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className={`flex-1 min-h-0 overflow-y-auto ${padding ? 'p-6' : ''} ${bodyClassName}`.trim()}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
