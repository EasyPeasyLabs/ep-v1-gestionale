import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 flex flex-col items-center justify-center h-full min-h-[50vh] text-center bg-red-50 rounded-2xl border-2 border-red-100 m-4 animate-fade-in">
          <div className="text-5xl mb-4">🤕</div>
          <h2 className="text-xl font-black text-red-900 mb-2">Qualcosa è andato storto</h2>
          <p className="text-sm text-red-700 mb-6 max-w-md mx-auto leading-relaxed">
            Si è verificato un errore imprevisto in questa schermata. 
            Il resto dell'applicazione è al sicuro.
          </p>
          
          <div className="bg-white p-4 rounded-xl border border-red-200 mb-6 text-left w-full max-w-lg overflow-auto max-h-32 shadow-inner">
             <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Dettaglio Tecnico:</p>
             <code className="text-xs text-red-600 font-mono block">
                {this.state.error?.message || 'Errore sconosciuto'}
             </code>
          </div>

          <div className="flex gap-4">
            <button
                className="md-btn md-btn-flat text-red-700 hover:bg-red-100"
                onClick={() => window.location.href = '/'}
            >
                Torna alla Home
            </button>
            <button
                className="md-btn md-btn-raised bg-red-600 text-white font-bold shadow-lg hover:bg-red-700"
                onClick={() => {
                    window.location.reload();
                }}
            >
                Riprova
            </button>
          </div>
        </div>
      );
    }

    return this.props.children || null;
  }
}

export default ErrorBoundary;