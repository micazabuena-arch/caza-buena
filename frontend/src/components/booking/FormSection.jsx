/** Numbered section wrapper for the booking form */
export default function FormSection({ step, title, description, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-aegean-100 bg-white shadow-md overflow-hidden ${className}`}>
      <div className="bg-aegean-50/70 px-5 py-4 border-b border-aegean-100">
        <div className="flex items-start gap-3">
          {step != null && (
            <span
              className="shrink-0 w-7 h-7 rounded-full bg-aegean-700 text-white text-sm font-medium flex items-center justify-center"
              aria-hidden
            >
              {step}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="font-serif text-lg text-aegean-800 leading-tight">{title}</h3>
            {description && <p className="text-sm text-aegean-600 mt-1">{description}</p>}
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6 space-y-5">{children}</div>
    </section>
  );
}

/** Segmented Yes / No control */
export function YesNoChoice({ name, value, onChange, yesLabel = 'Yes' }) {
  return (
    <div className="inline-flex rounded-lg border border-aegean-200 overflow-hidden bg-white">
      <label
        className={`px-4 py-2 text-sm cursor-pointer transition-colors ${
          !value ? 'bg-aegean-700 text-white' : 'text-aegean-700 hover:bg-aegean-50'
        }`}
      >
        <input
          type="radio"
          name={name}
          checked={!value}
          onChange={() => onChange(false)}
          className="sr-only"
        />
        No
      </label>
      <label
        className={`px-4 py-2 text-sm cursor-pointer transition-colors border-l border-aegean-200 ${
          value ? 'bg-aegean-700 text-white' : 'text-aegean-700 hover:bg-aegean-50'
        }`}
      >
        <input
          type="radio"
          name={name}
          checked={value}
          onChange={() => onChange(true)}
          className="sr-only"
        />
        {yesLabel}
      </label>
    </div>
  );
}
