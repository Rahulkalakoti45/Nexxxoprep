import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Temporary diagnostics for interview crash debugging.
    console.error('[Interview ErrorBoundary] runtime error', error, errorInfo)
  }

  handleRestart = () => {
    this.setState({ hasError: false })
    if (this.props.onRestart) this.props.onRestart()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <section className="rounded-2xl border border-red-300/30 bg-surface p-6">
        <h2 className="text-xl font-semibold text-ink">Interview Session Recovered</h2>
        <p className="mt-2 text-ink-soft">
          A runtime issue occurred, but your app is still safe. Restart the interview session to continue.
        </p>
        <button
          type="button"
          onClick={this.handleRestart}
          className="mt-4 rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white hover:bg-brand-400 transition hover:opacity-90"
        >
          Restart Interview
        </button>
      </section>
    )
  }
}

