import SectionCard from './SectionCard'
import { getModule, type ModuleId } from './modules'
import type { PlannedSection } from './plannedSections'
import './ModulePage.css'

interface PlaceholderModuleProps {
  moduleId: ModuleId
  sections: PlannedSection[]
}

/** Shell for a module that isn't built out yet — shows its planned sections. */
function PlaceholderModule({ moduleId, sections }: PlaceholderModuleProps) {
  const mod = getModule(moduleId)
  return (
    <div className="module-view">
      <header className="module-page__header">
        <h1>{mod.name}</h1>
        <p>{mod.description}</p>
      </header>
      <div className="section-grid">
        {sections.map((section) => (
          <SectionCard key={section.label} section={section} />
        ))}
      </div>
    </div>
  )
}

export default PlaceholderModule
