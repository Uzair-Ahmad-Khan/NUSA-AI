import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

(window as any).__NUSA_MOUNTED__ = true;

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, ErrorBoundaryState> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {hasError: true, message: error?.message || 'Unexpected rendering error'};
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#0b1020',
            color: '#eef3ff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          <img src="./logo.png" alt="NUSA AI" style={{width: 64, height: 64, borderRadius: 14, marginBottom: 16}} />
          <h2 style={{margin: '0 0 8px', fontSize: 22}}>NUSA AI encountered a display error</h2>
          <p style={{margin: '0 0 20px', color: '#9fb0d0', maxWidth: 440, fontSize: 14}}>
            {this.state.message}
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('nusa_user');
              window.location.reload();
            }}
            style={{
              background: 'linear-gradient(135deg, #2b8cff, #7c5cff)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 20px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Reset & Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
