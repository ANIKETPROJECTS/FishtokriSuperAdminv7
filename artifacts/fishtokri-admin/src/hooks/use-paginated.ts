import { useEffect, useMemo, useState } from "react";

export interface PaginatedResult<T> {
  page: number;
  pages: number;
  total: number;
  pageItems: T[];
  setPage: (page: number) => void;
}

export function usePaginated<T>(items: T[], pageSize: number = 20, resetKey: unknown = null): PaginatedResult<T> {
  const [page, setPage] = useState(1);

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [pages, page]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { page, pages, total, pageItems, setPage };
}
