import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { useConfirm } from '../context/ConfirmContext';

export const UNSAVED_LEAVE_OPTIONS = {
  title: 'Exit without saving?',
  message: 'Your changes will be lost if you leave now.',
  confirmLabel: 'Yes, exit',
  cancelLabel: 'Keep editing',
  variant: 'danger',
};

/** Serialize form state so File inputs still count as a change. */
export function serializeFormState(value) {
  return JSON.stringify(value, (_key, val) => {
    if (typeof File !== 'undefined' && val instanceof File) {
      return `file:${val.name}:${val.size}:${val.lastModified}`;
    }
    return val;
  });
}

/**
 * True when `value` differs from the snapshot taken when `active` became true,
 * or when `baselineKey` changes (e.g. after a successful save).
 */
export function useDirtySnapshot(value, active, baselineKey = 0) {
  const baselineRef = useRef(null);
  const wasActiveRef = useRef(false);
  const keyRef = useRef(baselineKey);

  if (active && (!wasActiveRef.current || keyRef.current !== baselineKey)) {
    baselineRef.current = serializeFormState(value);
    keyRef.current = baselineKey;
  }
  if (!active) {
    baselineRef.current = null;
  }
  wasActiveRef.current = active;

  if (!active || baselineRef.current == null) return false;
  return serializeFormState(value) !== baselineRef.current;
}

/** Browser refresh / tab close warning while there are unsaved changes. */
export function useUnsavedBeforeUnload(isDirty) {
  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);
}

/** Shared "exit without saving?" confirm used by modals and full-page editors. */
export function useConfirmLeave() {
  const confirm = useConfirm();
  return useCallback(
    (overrides = {}) => confirm({ ...UNSAVED_LEAVE_OPTIONS, ...overrides }),
    [confirm]
  );
}

/**
 * Blocks in-app navigation (sidebar, Back) while there are unsaved changes.
 */
export function useUnsavedNavigation(isDirty) {
  const confirmLeave = useConfirmLeave();
  const blocker = useBlocker(Boolean(isDirty));
  const askingRef = useRef(false);

  useEffect(() => {
    if (blocker.state !== 'blocked' || askingRef.current) return;
    askingRef.current = true;
    confirmLeave().then((ok) => {
      askingRef.current = false;
      if (blocker.state !== 'blocked') return;
      if (ok) blocker.proceed();
      else blocker.reset();
    });
  }, [blocker, confirmLeave]);

  useUnsavedBeforeUnload(isDirty);
}
