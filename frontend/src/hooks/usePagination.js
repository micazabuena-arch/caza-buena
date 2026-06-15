import { useCallback, useEffect, useMemo, useState } from 'react';

export const PAGE_SIZE = 10;

export function usePagination(items, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);

  const totalItems = items?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return (items ?? []).slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const goToPage = useCallback(
    (next) => {
      setPage((current) => {
        const max = Math.max(1, Math.ceil((items?.length ?? 0) / pageSize) || 1);
        return Math.min(Math.max(1, next), max);
      });
    },
    [items, pageSize]
  );

  return {
    page,
    setPage: goToPage,
    pageItems,
    totalPages,
    totalItems,
    pageSize,
    from: totalItems === 0 ? 0 : (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, totalItems),
  };
}
