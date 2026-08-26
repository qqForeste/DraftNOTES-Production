import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('render failed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-page px-4">
        <div className="w-[460px] rounded-card border border-card-border bg-card p-6">
          <h1 className="mb-1 text-lg font-semibold text-text-headline">Something broke</h1>
          <p className="mb-4 text-sm text-text-secondary">
            This page hit an error and stopped rendering. Your notes are saved on the
            server, nothing was lost.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-card bg-accent px-3 py-1.5 text-xs font-medium text-page hover:opacity-90"
            >
              Reload
            </button>
            <a
              href="/"
              className="rounded-card border border-chip-border px-3 py-1.5 text-xs text-text-secondary"
            >
              Back to matches
            </a>
          </div>
          <pre className="mt-4 max-h-32 overflow-auto rounded-card bg-inset p-2 text-[10px] text-text-muted">
            {this.state.error.message}
          </pre>
        </div>
      </div>
    )
  }
}
