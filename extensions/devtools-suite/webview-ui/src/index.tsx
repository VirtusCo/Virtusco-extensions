// Copyright 2026 VirtusCo

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return React.createElement('div', {
        style: { padding: 20, color: '#f44', fontFamily: 'monospace', fontSize: 12 }
      },
        React.createElement('h3', null, 'DevTools Suite render error'),
        React.createElement('pre', null, this.state.error.message),
        React.createElement('pre', { style: { color: '#888', fontSize: 10 } }, this.state.error.stack)
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    React.createElement(ErrorBoundary, null,
      React.createElement(App)
    )
  );
}
