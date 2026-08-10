import { Button, Popconfirm, Tag, Tooltip } from 'antd'
import type { ColumnType } from 'antd/es/table'
import { RotateCcw, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import { isDeleted, type SoftDeletable } from '../softDelete'

/**
 * Table pieces every soft-deletable list reuses, so the delete/restore affordance
 * looks and behaves the same across modules.
 */

/** Dims deleted rows so they read as recoverable history, not live data. */
export const deletedRowClassName = (record: SoftDeletable) =>
  isDeleted(record) ? 'row--deleted' : ''

/** "Deleted" column — only worth adding when the current scope can contain deleted rows. */
export function deletedColumn<T extends SoftDeletable>(): ColumnType<T> {
  return {
    title: 'Deleted',
    key: 'deletedAt',
    align: 'center',
    sorter: (a, b) => (a.deletedAt ?? '').localeCompare(b.deletedAt ?? ''),
    render: (_, record) =>
      isDeleted(record) ? (
        <Tooltip
          title={`${dayjs(record.deletedAt).format('MMM D, YYYY h:mm A')}${
            record.deletedBy ? ` · by ${record.deletedBy}` : ''
          }`}
        >
          <Tag color="error">{dayjs(record.deletedAt).format('MMM D, YYYY')}</Tag>
        </Tooltip>
      ) : (
        <Tag color="green">Live</Tag>
      ),
  }
}

export interface SoftDeleteActionsOptions<T> {
  /** Singular noun used in the confirm copy, e.g. "customer". */
  entityLabel: string
  /** Human label for a row, used in the confirm copy. */
  describe: (record: T) => string
  onDelete: (record: T) => void
  onRestore: (record: T) => void
  /** Restore is admin-only; non-admins can still see that the record was deleted. */
  canRestore: boolean
  /** Id of the row with an in-flight mutation, so only that button spins. */
  pendingId?: string | null
}

/** Row actions column: Delete on live rows, Restore on deleted ones. */
export function softDeleteActionsColumn<T extends SoftDeletable & { id: string }>({
  entityLabel,
  describe,
  onDelete,
  onRestore,
  canRestore,
  pendingId,
}: SoftDeleteActionsOptions<T>): ColumnType<T> {
  return {
    title: '',
    key: 'actions',
    align: 'right',
    width: 110,
    render: (_, record) => {
      const pending = pendingId === record.id
      if (isDeleted(record)) {
        if (!canRestore) return null
        return (
          <Popconfirm
            title={`Restore this ${entityLabel}?`}
            description={`${describe(record)} will show up in ${entityLabel} lists again.`}
            okText="Restore"
            onConfirm={() => onRestore(record)}
          >
            <Button size="small" icon={<RotateCcw size={14} />} loading={pending}>
              Restore
            </Button>
          </Popconfirm>
        )
      }
      return (
        <Popconfirm
          title={`Delete this ${entityLabel}?`}
          description={
            <span>
              {describe(record)} will be hidden from lists.
              <br />
              Existing records that reference it are unaffected.
            </span>
          }
          okText="Delete"
          okButtonProps={{ danger: true }}
          onConfirm={() => onDelete(record)}
        >
          <Button size="small" danger type="text" icon={<Trash2 size={15} />} loading={pending} />
        </Popconfirm>
      )
    },
  }
}

/** Convenience wrapper when a page wants both columns appended in the usual order. */
export function softDeleteColumns<T extends SoftDeletable & { id: string }>(
  showDeletedColumn: boolean,
  actions: SoftDeleteActionsOptions<T>,
): ColumnType<T>[] {
  return [
    ...(showDeletedColumn ? [deletedColumn<T>()] : []),
    softDeleteActionsColumn<T>(actions),
  ]
}
