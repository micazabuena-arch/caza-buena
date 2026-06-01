import ButtonSpinner from './ButtonSpinner';

const variants = {
  primary: 'btn-primary',
  outline: 'btn-outline',
};

/**
 * Submit / action button with a visible loader while processing.
 */
export default function SubmitButton({
  loading = false,
  children,
  loadingLabel,
  variant = 'primary',
  className = '',
  disabled,
  type = 'submit',
  ...props
}) {
  const isDisabled = disabled || loading;
  const spinnerVariant = variant === 'outline' ? 'primary' : 'white';

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      className={`${variants[variant] ?? variants.primary} inline-flex items-center justify-center gap-2 min-h-[2.75rem] disabled:opacity-60 disabled:pointer-events-none ${loading ? 'cursor-wait' : ''} ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <>
          <ButtonSpinner variant={spinnerVariant} />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
