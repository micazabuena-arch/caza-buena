/** Consistent icon-only action buttons for admin tables and lists */

import ButtonSpinner from './ButtonSpinner';

const ICON_SIZE = 16;

const buttonClass =
  'inline-flex items-center justify-center w-8 h-8 rounded-lg border border-aegean-200 text-aegean-600 hover:bg-aegean-50 hover:text-aegean-800 transition-colors disabled:opacity-50 disabled:pointer-events-none';

export function IconActionGroup({ children, className = '' }) {
  return <div className={`flex items-center gap-1.5 ${className}`.trim()}>{children}</div>;
}

export default function IconActionButton({
  icon: Icon,
  label,
  onClick,
  href,
  target,
  rel,
  type = 'button',
  disabled = false,
  loading = false,
  className = '',
}) {
  const classes = `${buttonClass} ${className}`.trim();
  const isDisabled = disabled || loading;

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        title={label}
        aria-label={label}
        className={classes}
      >
        <Icon size={ICON_SIZE} strokeWidth={2} />
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      title={label}
      aria-label={label}
      aria-busy={loading}
      className={classes}
    >
      {loading ? <ButtonSpinner className="w-4 h-4" variant="primary" /> : <Icon size={ICON_SIZE} strokeWidth={2} />}
    </button>
  );
}
