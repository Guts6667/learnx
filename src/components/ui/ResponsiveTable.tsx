import type { ComponentChildren } from 'preact';

import { classNames } from '@/components/ui/classNames';

export interface ResponsiveTableColumn {
  key: string;
  label: string;
}

export interface ResponsiveTableRow {
  cells: Record<string, ComponentChildren>;
  key: string;
}

interface ResponsiveTableProps {
  caption: string;
  class?: string;
  columns: readonly ResponsiveTableColumn[];
  rows: readonly ResponsiveTableRow[];
}

/**
 * A data table that becomes labelled records on narrow screens. Both views
 * remain in the DOM only at their intended breakpoint to avoid duplicate
 * announcements for assistive technologies.
 */
export function ResponsiveTable({
  caption,
  class: className,
  columns,
  rows,
}: ResponsiveTableProps) {
  return (
    <div class={classNames('ui-responsive-table', className)}>
      <div
        aria-label={`${caption} — tableau défilable`}
        class="ui-responsive-table__desktop"
        role="region"
        tabindex={0}
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
            {rows.map((row) => (
              <tr key={row.key}>
                {columns.map((column) => (
                  <td key={column.key}>{row.cells[column.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div aria-label={caption} class="ui-responsive-table__mobile" role="list">
        {rows.map((row) => (
          <dl class="ui-responsive-table__record" key={row.key} role="listitem">
            {columns.map((column) => (
              <div class="ui-responsive-table__field" key={column.key}>
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
