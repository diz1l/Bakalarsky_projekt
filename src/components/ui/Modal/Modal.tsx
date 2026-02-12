import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import s from './Modal.module.scss';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className={s.overlay} onMouseDown={onClose}>
      <div className={clsx(s.modal, s[size])} onMouseDown={(e) => e.stopPropagation()}>
        <div className={s.header}>
          <h2 className={s.title}>{title}</h2>
          <button className={s.close} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className={s.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
