'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class AffiliateDashboardErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AFFILIATE_DASHBOARD_ERROR]', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
        <div className="font-black">Affiliate Dashboard Runtime Error</div>
        <pre className="mt-3 whitespace-pre-wrap break-words text-xs">{this.state.error.message}</pre>
        {this.state.error.stack ? (
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-[10px]">
            {this.state.error.stack}
          </pre>
        ) : null}
      </div>
    );
  }
}
