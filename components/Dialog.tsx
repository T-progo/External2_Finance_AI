import { useEffect, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string | React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '7xl';
  footer?: React.ReactNode;
  footerClassName?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  customContent?: boolean;
}

export default function Dialog({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '2xl',
  footer,
  footerClassName = '',
  closeOnBackdrop = true,
  closeOnEscape = true,
  customContent = false,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    dialog.addEventListener('keydown', handleTab as any);
    return () => dialog.removeEventListener('keydown', handleTab as any);
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  const maxWidthClasses: Record<'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '7xl', string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '7xl': 'max-w-7xl',
  };

  if (!isOpen) return null;

  const dialogContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        ref={dialogRef}
        className={`bg-white rounded-lg shadow-xl ${maxWidthClasses[maxWidth]} w-full max-h-[90vh] flex flex-col animate-slideUp`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-start">
              {typeof title === 'string' ? (
                <h2 id="dialog-title" className="text-2xl font-bold text-gray-900">
                  {title}
                </h2>
              ) : (
                <div id="dialog-title" className="flex-1">{title}</div>
              )}
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 text-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-cliente focus:ring-offset-2 rounded ml-4 flex-shrink-0"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {customContent ? (
          children
        ) : (
          <div className={`p-6 ${title ? 'max-h-[calc(90vh-140px)]' : 'max-h-[calc(90vh-80px)]'} overflow-y-auto`}>
            {children}
          </div>
        )}

        {/* Footer */}
        {footer && (
          <div className={`p-6 border-t border-gray-200 ${footerClassName}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Use portal to render at document root level
  return typeof window !== 'undefined'
    ? createPortal(dialogContent, document.body)
    : null;
}
