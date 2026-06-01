import ButtonSpinner from './ButtonSpinner';

/** File input styled as a button with loader while uploading */
export default function UploadLabelButton({
  loading = false,
  children,
  loadingLabel = 'Uploading...',
  variant = 'primary',
  className = '',
  inputProps = {},
}) {
  const base = variant === 'outline' ? 'btn-outline' : 'btn-primary';
  const spinnerVariant = variant === 'outline' ? 'primary' : 'white';

  return (
    <label
      className={`${base} cursor-pointer inline-flex items-center justify-center gap-2 min-h-[2.75rem] ${loading ? 'opacity-70 cursor-wait pointer-events-none' : ''} ${className}`.trim()}
      aria-busy={loading}
    >
      {loading && <ButtonSpinner variant={spinnerVariant} />}
      {loading ? loadingLabel : children}
      <input type="file" className="hidden" disabled={loading} {...inputProps} />
    </label>
  );
}
