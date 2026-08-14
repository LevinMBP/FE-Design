import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  MailCheck,
  RefreshCw,
} from 'lucide-react'
import {
  useResendVerificationMutation,
  useVerifyEmailMutation,
} from '../authApi'
import BrandMark from '../../../shared/components/BrandMark'
import type { VerifyEmailResult } from '../types'
import './VerifyEmailPage.css'

/** What the card is currently showing. */
type Screen =
  | { kind: 'verifying' }
  | { kind: 'missing-token' }
  | { kind: 'failed' }
  | { kind: 'result'; result: VerifyEmailResult }

/**
 * Email confirmation landing page. The link in the email points here with the
 * token either as `?token=…` or as the last path segment, so both shapes work:
 *   /verify-email?token=abc123
 *   /verify-email/abc123
 * The token is redeemed once on mount and each outcome gets its own screen.
 */
function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const { token: pathToken } = useParams<{ token?: string }>()
  const token = (pathToken ?? searchParams.get('token') ?? '').trim()

  const [verifyEmail] = useVerifyEmailMutation()
  const [resend, { isLoading: resending }] = useResendVerificationMutation()

  const [screen, setScreen] = useState<Screen>(() =>
    token ? { kind: 'verifying' } : { kind: 'missing-token' },
  )
  const [resendState, setResendState] = useState<'idle' | 'sent' | 'error'>('idle')
  const [attempt, setAttempt] = useState(0)

  // Redeeming is a one-shot side effect: guard against StrictMode's double
  // mount so we never burn the token twice. `attempt` is part of the key so an
  // explicit retry still gets through.
  const redeemedRef = useRef<string | null>(null)

  useEffect(() => {
    const key = `${token}#${attempt}`
    if (!token || redeemedRef.current === key) return
    redeemedRef.current = key

    let cancelled = false
    setScreen({ kind: 'verifying' })

    verifyEmail({ token })
      .unwrap()
      .then((result) => {
        if (!cancelled) setScreen({ kind: 'result', result })
      })
      .catch(() => {
        if (!cancelled) setScreen({ kind: 'failed' })
      })

    return () => {
      cancelled = true
    }
  }, [token, attempt, verifyEmail])

  const onResend = async () => {
    setResendState('idle')
    try {
      await resend({ token }).unwrap()
      setResendState('sent')
    } catch {
      setResendState('error')
    }
  }

  /** Bumping the attempt re-runs the redeem effect above. */
  const retry = () => setAttempt((n) => n + 1)

  return (
    <div className="verify-page">
      <div className="verify-card">
        <div className="verify-card__brand">
          <BrandMark size={26} />
          <span>Venturo</span>
        </div>

        {screen.kind === 'verifying' && (
          <VerifyingState />
        )}

        {screen.kind === 'missing-token' && (
          <CardBody
            tone="danger"
            icon={<AlertCircle size={26} />}
            title="Confirmation link is incomplete"
            message="This link is missing its confirmation token. Open the most recent
              email we sent you and click the button there, or paste the full URL
              into your browser."
          >
            <Link to="/login" className="verify-btn verify-btn--ghost">
              Back to sign in
            </Link>
          </CardBody>
        )}

        {screen.kind === 'failed' && (
          <CardBody
            tone="danger"
            icon={<AlertCircle size={26} />}
            title="We couldn't reach the server"
            message="Something went wrong while confirming your email. Check your
              connection and try again."
          >
            <button type="button" className="verify-btn" onClick={retry}>
              <RefreshCw size={17} />
              Try again
            </button>
            <Link to="/login" className="verify-btn verify-btn--ghost">
              Back to sign in
            </Link>
          </CardBody>
        )}

        {screen.kind === 'result' && screen.result.status === 'verified' && (
          <CardBody
            tone="success"
            icon={<CheckCircle2 size={26} />}
            title="Email confirmed"
            message={
              <>
                <strong>{screen.result.email}</strong> is now verified. You can
                sign in and start using your dashboard.
              </>
            }
          >
            <Link to="/login" className="verify-btn">
              Continue to sign in
              <ArrowRight size={17} />
            </Link>
          </CardBody>
        )}

        {screen.kind === 'result' && screen.result.status === 'already-verified' && (
          <CardBody
            tone="brand"
            icon={<MailCheck size={26} />}
            title="Already confirmed"
            message={
              <>
                <strong>{screen.result.email}</strong> was confirmed earlier, so
                there's nothing left to do. Confirmation links can only be used
                once.
              </>
            }
          >
            <Link to="/login" className="verify-btn">
              Continue to sign in
              <ArrowRight size={17} />
            </Link>
          </CardBody>
        )}

        {screen.kind === 'result' && screen.result.status === 'expired' && (
          <CardBody
            tone="warning"
            icon={<Clock size={26} />}
            title="This link has expired"
            message={
              <>
                Confirmation links stay valid for 24 hours. We can send a fresh
                one to <strong>{screen.result.email}</strong>.
              </>
            }
          >
            <button
              type="button"
              className="verify-btn"
              onClick={onResend}
              disabled={resending || resendState === 'sent'}
            >
              {resending && <Loader2 size={17} className="verify-spin" />}
              {resending
                ? 'Sending…'
                : resendState === 'sent'
                  ? 'Link sent'
                  : 'Send a new link'}
            </button>
            <Link to="/login" className="verify-btn verify-btn--ghost">
              Back to sign in
            </Link>

            {resendState === 'sent' && (
              <p className="verify-note verify-note--success">
                A new confirmation link is on its way. It may take a minute to
                arrive — remember to check your spam folder.
              </p>
            )}
            {resendState === 'error' && (
              <p className="verify-note verify-note--danger">
                We couldn't send a new link. Please try again in a moment.
              </p>
            )}
          </CardBody>
        )}

        {screen.kind === 'result' && screen.result.status === 'invalid' && (
          <CardBody
            tone="danger"
            icon={<AlertCircle size={26} />}
            title="This link isn't valid"
            message="The confirmation link is malformed or has already been replaced by
              a newer one. Sign in to have another link sent to your inbox."
          >
            <Link to="/login" className="verify-btn">
              Back to sign in
              <ArrowRight size={17} />
            </Link>
          </CardBody>
        )}

        <p className="verify-help">
          Need a hand? <a href="mailto:support@venturo.app">Contact support</a>
        </p>

        {/* Mock-DB helper — remove once real confirmation emails are wired up. */}
        <div className="verify-demo">
          <strong>Demo tokens</strong>
          <span>
            ?token=demo-valid-token · demo-expired-token · demo-used-token
          </span>
        </div>
      </div>
    </div>
  )
}

function VerifyingState() {
  return (
    <div className="verify-body">
      <span className="verify-icon verify-icon--brand">
        <Loader2 size={26} className="verify-spin" />
      </span>
      <h1>Confirming your email…</h1>
      <p>This only takes a moment. Please don't close this tab.</p>
    </div>
  )
}

interface CardBodyProps {
  tone: 'success' | 'warning' | 'danger' | 'brand'
  icon: React.ReactNode
  title: string
  message: React.ReactNode
  children?: React.ReactNode
}

function CardBody({ tone, icon, title, message, children }: CardBodyProps) {
  return (
    <div className="verify-body">
      <span className={`verify-icon verify-icon--${tone}`}>{icon}</span>
      <h1>{title}</h1>
      <p>{message}</p>
      {children && <div className="verify-actions">{children}</div>}
    </div>
  )
}

export default VerifyEmailPage
