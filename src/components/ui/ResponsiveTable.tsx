import type { ReactNode } from 'react';

import { classNames } from '@/components/ui/classNames';
import { useI18n } from '@/i18n';

interface ResponsiveTableColumn {
  isRowHeader?: boolean;
  key: string;
  label: string;
}

interface ResponsiveTableRow {
  cells: Record<string, ReactNode>;
  key: string;
}

interface ResponsiveTableProps {
  caption: string;
  className?: string;
  columns: readonly ResponsiveTableColumn[];
  emptyMessage?: string;
  rows: readonly ResponsiveTableRow[];
  scrollRegionLabel?: string;
}

/**
 * A data table that becomes labelled records on narrow screens. Both views
 * remain in the DOM only at their intended breakpoint to avoid duplicate
 * announcements for assistive technologies.
 */
export function ResponsiveTable({
  caption,
  className,
  columns,
  emptyMessage,
  rows,
  scrollRegionLabel,
}: ResponsiveTableProps) {
  const { t } = useI18n();
  const resolvedEmptyMessage = emptyMessage ?? t('common.noData');

  return (
    <div className={classNames('ui-responsive-table', className)}>
      <div
        aria-label={scrollRegionLabel ?? caption}
        className="ui-responsive-table__desktop"
        role="region"
        tabIndex={0}
      >
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="ui-responsive-table__empty"
                  colSpan={columns.length}
                >
                  {resolvedEmptyMessage}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.key}>
                {columns.map((column) =>
                  column.isRowHeader ? (
                    <th key={column.key} scope="row">
                      {row.cells[column.key]}
                    </th>
                  ) : (
                    <td key={column.key}>{row.cells[column.key]}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        aria-label={caption}
        className="ui-responsive-table__mobile"
        role="list"
      >
        {rows.length === 0 ? (
          <p className="ui-responsive-table__empty" role="listitem">
            {resolvedEmptyMessage}
          </p>
        ) : null}
        {rows.map((row) => (
          <dl
            className="ui-responsive-table__record"
            key={row.key}
            role="listitem"
          >
            {columns.map((column) => (
              <div className="ui-responsive-table__field" key={column.key}>
                <dt>{column.label}</dt>
                <dd>{row.cells[column.key]}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </div>
  );
}
