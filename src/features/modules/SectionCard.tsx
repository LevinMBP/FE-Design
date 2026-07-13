import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PlannedSection } from './plannedSections'
import './SectionCard.css'

/** A sub-feature tile. Links to its route when `to` is set, else "coming soon". */
function SectionCard({ section }: { section: PlannedSection }) {
  const Icon = section.icon

  const inner = (
    <>
      <span className="section-card__icon">
        <Icon size={20} />
      </span>
      <span className="section-card__title">{section.label}</span>
      <span className="section-card__desc">{section.desc}</span>
      {section.to ? (
        <ArrowRight size={17} className="section-card__arrow" />
      ) : (
        <span className="section-card__soon">Coming soon</span>
      )}
    </>
  )

  if (section.to) {
    return (
      <Link to={section.to} className="section-card section-card--link">
        {inner}
      </Link>
    )
  }

  return (
    <div className="section-card" aria-disabled="true">
      {inner}
    </div>
  )
}

export default SectionCard
