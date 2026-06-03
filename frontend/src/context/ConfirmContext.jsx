import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ConfirmContext = createContext(null);

const defaultState = {
  title: 'Are you sure?',
  message: 'Please confirm before continuing.',
  confirmLabel: 'Yes, continue',
  cancelLabel: 'Cancel',
  variant: 'primary',
};

export function ConfirmProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(defaultState);
  const resolveRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setOptions({ ...defaultState, ...opts });
      setOpen(true);
    });
  }, []);

  const close = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  const isDanger = options.variant === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40"
          role="presentation"
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="font-serif text-xl text-aegean-800">
              {options.title}
            </h2>
            <p id="confirm-message" className="text-sm text-aegean-600 mt-2 leading-relaxed">
              {options.message}
            </p>
            <div className="flex flex-wrap gap-3 mt-6 justify-end">
              <button
                type="button"
                onClick={() => close(false)}
                className="btn-outline text-sm py-2 px-4"
              >
                {options.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`text-sm py-2 px-4 rounded-full font-medium text-white ${
                  isDanger
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-aegean-500 hover:bg-aegean-600'
                }`}
              >
                {options.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
