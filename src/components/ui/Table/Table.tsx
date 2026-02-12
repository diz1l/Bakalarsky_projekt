import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import s from './Table.module.scss';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
}

type SortDir = 'asc' | 'desc';

export function Table<T>({ columns, data, keyExtractor, loading, emptyMessage }: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const va = String((a as Record<string, unknown>)[sortKey] ?? '');
        const vb = String((b as Record<string, unknown>)[sortKey] ?? '');
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      })
    : data;

  if (loading) {
    return <div className={s.status}>Loading...</div>;
  }

  if (!data.length) {
    return <div className={s.status}>{emptyMessage || 'No data'}</div>;
  }

  return (
    <div className={s.wrapper}>
      <table className={s.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={clsx(col.sortable && s.sortable)}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                {col.header}
                {col.sortable && sortKey === col.key && (
                  <span className={s.arrow}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={keyExtractor(item)}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render
                    ? col.render(item)
                    : String((item as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
