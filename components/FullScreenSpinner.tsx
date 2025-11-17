
import React from 'react';
import Spinner from './Spinner';

const FullScreenSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-slate-100">
      <div
        className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"
        role="status"
        aria-label="loading"
      >
        <span className="sr-only">Caricamento...</span>
      </div>
    </div>
  );
};

export default FullScreenSpinner;