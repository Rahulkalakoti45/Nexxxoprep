import { Component } from 'react'
import { Link } from 'react-router-dom'
import { buttonClass } from './ui/helpers.js'

/**
 * Catches a crash inside one page so the rest of the app (navigation included) keeps working.
 * Keyed on the route by the layout, so moving to another page clears the error.
 */
export default class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[PageErrorBoundary] page crashed', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section role="alert" className="mx-auto mt-6 flex max-w-md flex-col items-center rounded-3xl border border-line-strong bg-surface p-10 text-center shadow-card">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-400/15 text-xl text-rose-300" aria-hidden="true">
          !
        </span>
        <h2 className="mt-5 text-xl font-semibold text-ink">This page hit a problem</h2>
        <p className="mt-2 text-sm text-ink-muted">Your saved work is safe. Reload to try again, or head back home.</p>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={() => window.location.reload()} className={buttonClass({ variant: 'primary' })}>
            Reload
          </button>
          <Link to="/dashboard" className={buttonClass({ variant: 'secondary' })}>
            Home
          </Link>
        </div>
      </section>
    )
  }
}
