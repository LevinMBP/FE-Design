import BrandMark from '../BrandMark'
import './SplashLoader.css'

/** Full-screen branded loader shown while the session is being restored. */
function SplashLoader() {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash__logo">
        <BrandMark size={48} />
      </div>
      <span className="splash__brand">Venturo</span>

      <div className="splash__bar">
        <span className="splash__bar-fill" />
      </div>

      <span className="sr-only">Loading, restoring your session</span>
    </div>
  )
}

export default SplashLoader
