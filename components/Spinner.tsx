
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center">
      <div
        className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"
        role="status"
        aria-label="loading"
      >
        <span className="sr-only">Caricamento...</span>
      </div>
    </div>
  );
};

export default Spinner;
