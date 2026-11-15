import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * Si algo falla al renderizar, muestra el error con un botón para recargar,
 * en lugar de dejar la pantalla en negro.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Head Study: error de renderizado', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="fatal" role="alert">
        <h1>Algo salió mal</h1>
        <p>La vista 3D se detuvo por un error. Recargar la página suele resolverlo.</p>
        <pre>{error.message}</pre>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </div>
    );
  }
}
