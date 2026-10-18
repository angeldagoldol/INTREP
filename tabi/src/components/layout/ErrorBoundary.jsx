import { Component } from 'react';

/**
 * Catches errors thrown while rendering anything below it (a crashing page,
 * a lazy chunk that failed to download) and renders a fallback in its place,
 * so the rest of the app keeps working.
 * - `fallback({ error, reset })` what to show instead; null renders nothing
 * - `onError(error, info)` after the error is caught (log, close, reload…)
 * - `resetKey` any change clears the error and renders the children again
 */
export class ErrorBoundary extends Component {
  state = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error) {
    return { error: error ?? new Error('Unknown error') };
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey };
  }

  componentDidCatch(error, info) {
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return this.props.fallback ? this.props.fallback({ error, reset: this.reset }) : null;
  }
}
