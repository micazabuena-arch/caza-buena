import { useEffect, useMemo, useState } from 'react';
import { filterAdminList } from '../utils/adminListFilter';
import { usePagination } from './usePagination';

/**
 * Filter state + filtered rows for admin lists.
 * Pass stable searchFields / getDate / matchStatus (module-level) so memoization stays cheap.
 */
export function useAdminListFilter(items, options = {}) {
  const { searchFields = [], getDate, extraFilter, matchStatus } = options;
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');

  const filtered = useMemo(
    () =>
      filterAdminList(items, {
        search,
        searchFields,
        dateFrom,
        dateTo,
        getDate,
        status,
        extraFilter,
        matchStatus,
      }),
    [items, search, searchFields, dateFrom, dateTo, getDate, status, extraFilter, matchStatus]
  );

  return {
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    status,
    setStatus,
    filtered,
    filterKey: `${search}|${dateFrom}|${dateTo}|${status}`,
  };
}

/** Filter + pagination, resetting to page 1 when the user changes filters. */
export function useFilteredPagination(items, filterOptions = {}, extraResetKey = '') {
  const listFilter = useAdminListFilter(items, filterOptions);
  const pagination = usePagination(listFilter.filtered);

  const setPage = pagination.setPage;

  useEffect(() => {
    setPage(1);
  }, [listFilter.filterKey, extraResetKey, setPage]);

  return { ...listFilter, ...pagination };
}
