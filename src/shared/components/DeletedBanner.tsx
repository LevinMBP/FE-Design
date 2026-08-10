import { Alert, Button, Popconfirm } from 'antd'
import { RotateCcw } from 'lucide-react'
import dayjs from 'dayjs'
import { isDeleted, type SoftDeletable } from '../softDelete'

/**
 * Banner for a detail page whose record has been deleted.
 *
 * Deleted records stay readable by id on purpose — old sales orders and
 * purchases still link to them, and those links must not dead-end. The banner is
 * what tells the reader this record is no longer live.
 *
 * Renders nothing for a live record, so callers can drop it in unconditionally.
 */
function DeletedBanner({
  record,
  entityLabel,
  canRestore,
  onRestore,
  restoring,
}: {
  record: SoftDeletable
  entityLabel: string
  canRestore: boolean
  onRestore: () => void
  restoring?: boolean
}) {
  if (!isDeleted(record)) return null

  const when = dayjs(record.deletedAt).format('MMM D, YYYY [at] h:mm A')
  const who = record.deletedBy ? ` by ${record.deletedBy}` : ''

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      message={`This ${entityLabel} was deleted`}
      description={`Deleted on ${when}${who}. It's hidden from ${entityLabel} lists and pickers, but existing records that reference it are unchanged.`}
      action={
        canRestore ? (
          <Popconfirm
            title={`Restore this ${entityLabel}?`}
            okText="Restore"
            onConfirm={onRestore}
          >
            <Button size="small" icon={<RotateCcw size={14} />} loading={restoring}>
              Restore
            </Button>
          </Popconfirm>
        ) : undefined
      }
    />
  )
}

export default DeletedBanner
