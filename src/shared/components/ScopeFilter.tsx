import { Segmented } from 'antd'
import type { ListScope } from '../softDelete'

const OPTIONS: { label: string; value: ListScope }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Deleted', value: 'deleted' },
  { label: 'All', value: 'all' },
]

/**
 * Active / Deleted / All switch that sits above a list table. Lets someone find
 * a record they deleted without leaving the page they're already on.
 */
function ScopeFilter({
  value,
  onChange,
}: {
  value: ListScope
  onChange: (scope: ListScope) => void
}) {
  return (
    <Segmented<ListScope>
      value={value}
      onChange={onChange}
      options={OPTIONS}
      style={{ marginBottom: 12 }}
    />
  )
}

export default ScopeFilter
