import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="alert alert-danger" style={{ margin: '2rem', padding: '2rem' }}>
          <h4>Ops! Qualcosa è andato storto</h4>
          <p>Si è verificato un errore imprevisto. Prova a ricaricare la pagina.</p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                Dettagli errore (solo in sviluppo)
              </summary>
              <pre style={{ 
                background: 'var(--bg-3)', 
                padding: '1rem', 
                borderRadius: 'var(--radius-sm)',
                overflow: 'auto',
                maxHeight: '300px'
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo && (
                  <>
                    {'\n\n'}
                    {this.state.errorInfo.componentStack}
                  </>
                )}
              </pre>
            </details>
          )}
          <button 
            className="btn btn-primary mt-3" 
            onClick={this.handleReset}
          >
            Riprova
          </button>
          <button 
            className="btn btn-secondary mt-3 ms-2" 
            onClick={() => window.location.reload()}
          >
            Ricarica pagina
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary





