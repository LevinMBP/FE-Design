import { useState } from 'react'
import { Checkbox, Form, Input } from 'antd'
import {
  Mail,
  Lock,
  ArrowRight,
  BarChart3,
  PackageCheck,
  Truck,
  AlertCircle,
} from 'lucide-react'
import { useLoginMutation } from '../authApi'
import BrandMark from '../../../shared/components/BrandMark'
import './LoginPage.css'

interface LoginForm {
  email: string
  password: string
  remember: boolean
}

function LoginPage() {
  const [login, { isLoading: submitting }] = useLoginMutation()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const onFinish = async (values: LoginForm) => {
    setSubmitError(null)
    try {
      await login(values).unwrap()
      // On success the auth slice updates and App swaps to the dashboard.
    } catch (err) {
      setSubmitError(
        typeof err === 'string' ? err : 'Something went wrong. Please try again.',
      )
    }
  }

  return (
    <div className="page">
      {/* ---------- Left: brand / marketing panel ---------- */}
      <aside className="brand-panel">
        <div className="brand-panel__inner">
          <div className="brand-mark">
            <BrandMark size={30} />
            <span>Venturo</span>
          </div>

          <div className="brand-copy">
            <h1>
              Inventory that keeps up
              <br />
              with your business.
            </h1>
            <p>
              Track stock in real time, forecast demand, and fulfill orders
              faster — all from one dashboard.
            </p>
          </div>

          <ul className="brand-features">
            <li>
              <span className="brand-features__icon">
                <PackageCheck size={18} />
              </span>
              Real-time stock levels across every warehouse
            </li>
            <li>
              <span className="brand-features__icon">
                <BarChart3 size={18} />
              </span>
              Demand forecasting &amp; low-stock alerts
            </li>
            <li>
              <span className="brand-features__icon">
                <Truck size={18} />
              </span>
              Automated purchase orders &amp; fulfillment
            </li>
          </ul>

          <p className="brand-footnote">
            Trusted by 4,000+ operations teams worldwide.
          </p>
        </div>
      </aside>

      {/* ---------- Right: login form ---------- */}
      <main className="form-panel">
        <div className="form-card">
          <div className="form-card__mobile-brand">
            <BrandMark size={24} />
            <span>Venturo</span>
          </div>

          <header className="form-header">
            <h2>Welcome back</h2>
            <p>Sign in to your inventory dashboard.</p>
          </header>

          {submitError && (
            <div className="form-alert" role="alert">
              <AlertCircle size={18} />
              <span>{submitError}</span>
            </div>
          )}

          <Form<LoginForm>
            layout="vertical"
            requiredMark={false}
            colon={false}
            initialValues={{ remember: true }}
            onFinish={onFinish}
            className="login-form"
          >
            <Form.Item
              label="Email address"
              name="email"
              rules={[
                { required: true, message: 'Email is required' },
                { type: 'email', message: 'Enter a valid email address' },
              ]}
            >
              <Input
                size="large"
                type="email"
                autoComplete="email"
                prefix={<Mail size={18} className="input__icon" />}
                placeholder="you@company.com"
              />
            </Form.Item>

            <Form.Item
              className="login-password"
              name="password"
              label={
                <div className="field__label-row">
                  <span>Password</span>
                  <a href="#forgot" className="link">
                    Forgot password?
                  </a>
                </div>
              }
              rules={[
                { required: true, message: 'Password is required' },
                { min: 6, message: 'Password must be at least 6 characters' },
              ]}
            >
              <Input.Password
                size="large"
                autoComplete="current-password"
                prefix={<Lock size={18} className="input__icon" />}
                placeholder="••••••••"
              />
            </Form.Item>

            <Form.Item name="remember" valuePropName="checked" className="login-remember">
              <Checkbox>Keep me signed in</Checkbox>
            </Form.Item>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
              {!submitting && <ArrowRight size={18} />}
            </button>
          </Form>

          <div className="divider">
            <span>or continue with</span>
          </div>

          <div className="social-row">
            <button type="button" className="btn-social">
              <GoogleIcon />
              Google
            </button>
            <button type="button" className="btn-social">
              <MicrosoftIcon />
              Microsoft
            </button>
          </div>

          <p className="signup">
            Don&apos;t have an account?{' '}
            <a href="#signup" className="link link--strong">
              Start a free trial
            </a>
          </p>

          {/* Mock-DB helper — remove once real auth is wired up. */}
          <div className="demo-hint">
            <strong>Demo login</strong>
            <span>admin@venturo.app · password123</span>
          </div>
        </div>
      </main>
    </div>
  )
}

/* Brand-colored logos as inline SVG (multi-color, so not from lucide) */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41.6 35.5 44 30.2 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  )
}

export default LoginPage
