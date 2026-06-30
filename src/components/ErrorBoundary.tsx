import { Component, ErrorInfo, ReactNode } from "react";
import { toast } from "sonner";

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.group("%c[ErrorBoundary]", "color:#f87171;font-weight:bold");
    console.error(error);
    console.error("componentStack:", info.componentStack);
    console.groupEnd();
    try { toast.error("Something broke on this page", { description: error.message?.slice(0, 200) }); } catch { /* toast not ready */ }
  }
  reset = () => this.setState({ error: null });
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-lg w-full rounded-lg border border-destructive/40 bg-card p-6 space-y-4">
            <h1 className="text-lg font-semibold text-destructive">Page crashed</h1>
            <pre className="text-xs whitespace-pre-wrap text-muted-foreground max-h-64 overflow-auto">
              {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack?.split("\n").slice(0, 8).join("\n")}
            </pre>
            <div className="flex gap-2">
              <button onClick={this.reset} className="px-3 py-1.5 text-sm rounded bg-accent text-accent-foreground">Try again</button>
              <button onClick={() => (window.location.href = "/dashboard")} className="px-3 py-1.5 text-sm rounded border border-border">Dashboard</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
