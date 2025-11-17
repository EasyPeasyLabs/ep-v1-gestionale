import React, { ReactNode } from 'react';

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  size?: 'md' | 'lg' | 'xl' | '2xl';
}

const Modal: React.FC<ModalProps> = ({ children, onClose, size = 'md' }) => {
  
  const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-lg shadow-xl p-6 w-full m-4 ${sizeClasses[size]} flex flex-col max-h-[90vh]`}
        onClick={e => e.stopPropagation()} // Impedisce la chiusura del modale cliccando al suo interno
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;