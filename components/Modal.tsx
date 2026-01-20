
import React, { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  size?: 'md' | 'lg' | 'xl' | '2xl';
}

const Modal: React.FC<ModalProps> = ({ children, onClose, size = 'md' }) => {
  const [mounted, setMounted] = useState(false);

  // Gestione blocco scroll del body quando la modale è aperta
  useEffect(() => {
    setMounted(true);
    // Salva lo stile originale
    const originalOverflow = document.body.style.overflow;
    
    // Blocca lo scroll
    document.body.style.overflow = 'hidden';
    
    // Ripristina alla chiusura
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const sizeClasses = {
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    '2xl': 'max-w-7xl',
  };

  const modalContent = (
    <div 
      className="fixed inset-0 bg-slate-900/60 z-[100] flex justify-center items-center p-2 md:p-4 animate-fade-in backdrop-blur-sm"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className={`relative w-full ${sizeClasses[size]} bg-white rounded-xl shadow-2xl flex flex-col max-h-[95dvh] h-fit overflow-hidden md-card border-0`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
};

export default Modal;
