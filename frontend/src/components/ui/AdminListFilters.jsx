const inputClass =
  'border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-aegean-400 outline-none';

/**
 * Shared admin list filters — search, optional check-in dates, optional status.
 */
export default function AdminListFilters({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  showDates = false,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  dateFromLabel = 'Check-in from',
  dateToLabel = 'Check-in to',
  status,
  onStatusChange,
  statusOptions,
  children,
}) {
  return (
    <div className="mb-6 rounded-xl border border-aegean-100 bg-white p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
        <label className="flex-1 min-w-[180px]">
          <span className="block text-xs text-aegean-600 mb-1">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`${inputClass} w-full`}
          />
        </label>
        {showDates && (
          <>
            <label className="sm:w-44">
              <span className="block text-xs text-aegean-600 mb-1">{dateFromLabel}</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className={`${inputClass} w-full`}
              />
            </label>
            <label className="sm:w-44">
              <span className="block text-xs text-aegean-600 mb-1">{dateToLabel}</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className={`${inputClass} w-full`}
              />
            </label>
          </>
        )}
        {statusOptions && (
          <label className="sm:w-52">
            <span className="block text-xs text-aegean-600 mb-1">Status</span>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              className={`${inputClass} w-full`}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {children}
    </div>
  );
}
