export default function Pagination({ page, totalPages, totalItems, from, to, onPageChange }) {
  if (totalItems <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-aegean-100 bg-aegean-50/50 text-sm text-aegean-600">
      <p>
        Showing {from}–{to} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 rounded-lg border border-aegean-200 bg-white disabled:opacity-40 hover:bg-aegean-50"
        >
          Previous
        </button>
        <span className="px-2 tabular-nums">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-aegean-200 bg-white disabled:opacity-40 hover:bg-aegean-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
