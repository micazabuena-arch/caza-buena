import { Loader2 } from 'lucide-react';

/** Spinner for buttons — use variant "white" on primary buttons, "primary" on outline/light buttons */
export default function ButtonSpinner({ className = 'w-5 h-5', variant = 'inherit' }) {
  const color =
    variant === 'white' ? 'text-white' : variant === 'primary' ? 'text-aegean-500' : 'text-current';

  return <Loader2 className={`animate-spin shrink-0 ${color} ${className}`} aria-hidden />;
}
