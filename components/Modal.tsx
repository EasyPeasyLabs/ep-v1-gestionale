
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
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  const modalContent = (
    <div 
      className="fixed inset-0 bg-slate-900/60 z-[100] flex justify-center items-center p-4 animate-fade-in backdrop-blur-sm"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* 
         FIX MOBILE & SCROLLING: 
         - max-h-[90dvh]: Limits height to 90% viewport (gestisce barra indirizzi mobile)
         - h-fit: Adapts to content, but respects max-h
         - w-full: Occupa larghezza disponibile
         - overflow-hidden: Ensures border-radius works and clips content
      */}
      <div 
        className={`relative w-full ${sizeClasses[size]} bg-white rounded-xl shadow-2xl flex flex-col max-h-[90dvh] h-fit overflow-hidden md-card border-0`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  // Renderizza tramite Portal al body per evitare problemi di stacking context/overflow dei genitori
  if (!mounted) return null;
  return createPortal(modalContent, document.body);
};

export default Modal;
