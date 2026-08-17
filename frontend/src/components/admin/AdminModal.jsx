import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useConfirmLeave, useUnsavedBeforeUnload } from '../../hooks/useConfirmLeave';

const WIDTH_CLASS = {
  sm: 'max-w-lg',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-4xl',
};

const AdminModalCloseContext = createContext(null);
const AdminModalDirtyContext = createContext(null);

/** Close the current admin modal (asks first when there are unsaved changes). */
export function useAdminModalClose() {
  return useContext(AdminModalCloseContext);
}

/** Child forms call this so Escape / X / overlay know the form has unsaved edits. */
export function useRegisterModalDirty(isDirty) {
  const setChildDirty = useContext(AdminModalDirtyContext);
  useEffect(() => {
    if (!setChildDirty) return undefined;
    setChildDirty(Boolean(isDirty));
    return () => setChildDirty(false);
  }, [isDirty, setChildDirty]);
}

export function AdminModalCancel({ className = 'btn-outline text-sm', children = 'Cancel' }) {
  const requestClose = useAdminModalClose();
  return (
    <button type="button" onClick={() => requestClose?.()} className={className}>
      {children}
    </button>
  );
}

/**
 * Centered modal for admin view/edit flows triggered by icon buttons.
 * Pass isDirty so Escape, overlay click, X, and Cancel ask before discarding edits.
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
  /** When false, body does not scroll — child forms should use their own scroll region + pinned footer. */
  bodyScroll = true,
  /** When true, closing asks "Exit without saving?" */
  isDirty = false,
}) {
  const confirmLeave = useConfirmLeave();
  const confirmingRef = useRef(false);
  const [childDirty, setChildDirty] = useState(false);
  const dirty = Boolean(isDirty || childDirty);

  useEffect(() => {
    if (!open) setChildDirty(false);
  }, [open]);

  const requestClose = useCallback(async () => {
    if (confirmingRef.current) return;
    if (dirty) {
      confirmingRef.current = true;
      try {
        const ok = await confirmLeave();
        if (!ok) return;
      } finally {
        confirmingRef.current = false;
      }
    }
    onClose?.();
  }, [dirty, confirmLeave, onClose]);

  useUnsavedBeforeUnload(open && dirty);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, requestClose]);

  if (!open) return null;

  const widthClass = WIDTH_CLASS[size] || WIDTH_CLASS.sm;
  const bodyClasses = bodyScroll
    ? `flex-1 min-h-0 overflow-y-auto ${padding ? 'p-6' : ''} ${bodyClassName}`.trim()
    : `flex-1 min-h-0 overflow-hidden flex flex-col ${padding ? 'p-6' : ''} ${bodyClassName}`.trim();

  return createPortal(
    <AdminModalDirtyContext.Provider value={setChildDirty}>
      <AdminModalCloseContext.Provider value={requestClose}>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
        onClick={requestClose}
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
              <h2 id="admin-modal-title" className="font-serif text-xl text-aegean-800">
                {title}
              </h2>
              {description && <p className="text-sm text-aegean-600 mt-1">{description}</p>}
            </div>
            <button
              type="button"
              onClick={requestClose}
              className="p-2 hover:bg-aegean-50 rounded-lg shrink-0 text-aegean-600"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          <div className={bodyClasses}>{children}</div>
        </div>
      </div>
      </AdminModalCloseContext.Provider>
    </AdminModalDirtyContext.Provider>,
    document.body
  );
}
