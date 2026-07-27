import { useState } from 'react'
import { Button, Checkbox } from 'antd'
import { Plus } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { MODULES, type ModuleId } from '../modules/modules'
import { selectRbac, togglePositionModule } from './rbac/rbacSlice'
import { recordAuditEvent } from './mockAuditLog'
import AddPositionModal from './AddPositionModal'
import './admin.css'

function PositionsPage() {
  const rbac = useAppSelector(selectRbac)
  const dispatch = useAppDispatch()
  const [addOpen, setAddOpen] = useState(false)

  const onToggle = (positionId: string, moduleId: ModuleId, positionName: string, moduleName: string) => {
    dispatch(togglePositionModule({ positionId, moduleId }))
    recordAuditEvent({ module: 'admin', action: 'Changed position access', target: positionName, details: moduleName })
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Positions</h1>
          <p>Job positions and the modules they grant. A user's position access adds to their roles.</p>
        </div>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
          Add position
        </Button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-matrix">
          <thead>
            <tr>
              <th>Position</th>
              {MODULES.map((m) => (
                <th key={m.id}>{m.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rbac.positions.map((position) => (
              <tr key={position.id}>
                <td>
                  {position.name}
                  {position.description && (
                    <div className="admin-matrix__role-desc">{position.description}</div>
                  )}
                </td>
                {MODULES.map((m) => (
                  <td key={m.id}>
                    <Checkbox
                      checked={(rbac.positionPermissions[position.id] ?? []).includes(m.id)}
                      onChange={() => onToggle(position.id, m.id, position.name, m.name)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddPositionModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}

export default PositionsPage
