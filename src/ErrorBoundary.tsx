import { Component, type ReactNode } from 'react'

/** Shows what went wrong instead of a blank black page if rendering throws. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="boot">
        <p className="boot-title">Something went wrong.</p>
        <p className="boot-sub">{this.state.error.message}</p>
        <p className="boot-sub">Try a hard refresh (Cmd/Ctrl + Shift + R).</p>
      </div>
    )
  }
}
