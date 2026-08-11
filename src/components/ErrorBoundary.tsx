import { Component, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: unknown) => void;
};

type State = {
  hasError: boolean;
};

// React error boundaries only catch errors thrown during render, not native
// crashes that bypass the JS thread entirely — but this app has no boundary
// anywhere, so any render-time error currently takes down the whole app
// instead of just the screen/section that failed.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
