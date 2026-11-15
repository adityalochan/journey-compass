import { Component, type ReactNode } from "react";

interface Props { fallback: ReactNode; children: ReactNode }

/** Catches a crash in one part of the page (e.g. the 3D globe) so the rest of the site keeps working. */
export default class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error("Section failed to render:", error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
