
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
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 animate-fade-in"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className={`md-card p-6 w-full m-4 ${sizeClasses[size]} flex flex-col max-h-[90vh] overflow-hidden shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
