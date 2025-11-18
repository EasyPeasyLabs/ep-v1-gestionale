import React from 'react';
import Modal from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Conferma", 
  cancelText = "Annulla", 
  isDangerous = false 
}) => {
  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} size="md">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex justify-end space-x-3">
        <button 
            onClick={onClose} 
            className="md-btn md-btn-flat"
        >
          {cancelText}
        </button>
        <button 
          onClick={() => {
            onConfirm();
            onClose();
          }} 
          className={`md-btn md-btn-raised ${isDangerous ? 'md-btn-red' : 'md-btn-primary'}`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;