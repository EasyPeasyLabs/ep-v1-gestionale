
import React, { ReactNode } from 'react';

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  size?: 'md' | 'lg' | 'xl' | '2xl';
}

const Modal: React.FC<ModalProps> = ({ children, onClose, size = 'md' }) => {
  
  const sizeClasses = {
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fade-in"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* 
         FIX MOBILE: 
         1. max-h-[95dvh] usa la viewport dinamica per evitare problemi con la barra indirizzi mobile.
         2. w-full m-2 assicura margine su schermi piccolissimi.
         3. p-0 rimuove padding esterno, delegandolo ai figli per gestire header/footer sticky.
      */}
      <div 
        className={`md-card w-full m-2 sm:m-4 ${sizeClasses[size]} flex flex-col max-h-[95dvh] h-full sm:h-auto overflow-hidden shadow-2xl bg-white rounded-lg`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
