import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage, fieldErrors } from '@/shared/lib/errors';
import { useToast } from '@/shared/ui';

/**
 * useAction wraps a mutation: success toast, cache invalidation, and errors kept for the
 * form (per field) or shown as a toast when no field matches.
 */
export function useAction<A, R>(
  fn: (arg: A) => Promise<R>,
  opts: { success?: string | ((r: R) => string); invalidate?: readonly unknown[][]; onSuccess?: (r: R, arg: A) => void; toastErrors?: boolean } = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  const [fields, setFields] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: fn,
    onMutate: () => setFields({}),
    onSuccess: (r, arg) => {
      opts.invalidate?.forEach((key) => void qc.invalidateQueries({ queryKey: key }));
      if (opts.success) toast('success', typeof opts.success === 'function' ? opts.success(r) : opts.success);
      opts.onSuccess?.(r, arg);
    },
    onError: (err) => {
      const f = fieldErrors(err);
      setFields(f);
      if (opts.toastErrors !== false || Object.keys(f).length === 0) toast('error', 'Gagal', errorMessage(err));
    },
  });
  return { ...m, fields, setFields };
}

/** usePaging keeps page + filters together; changing a filter returns to page 1. */
export function usePaging<F extends Record<string, string>>(initial: F, perPage = 20) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<F>(initial);
  const setFilter = <K extends keyof F>(k: K, v: F[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  return { page, setPage, filters, setFilter, perPage, query: { ...filters, page, per_page: perPage } };
}
