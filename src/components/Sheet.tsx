import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  title: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  label?: string;
}

export default function Sheet({ title, onClose, children, footer, wide = false, label }: SheetProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="sheet-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section
        className={`sheet${wide ? ' sheet-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label || title}
        tabIndex={-1}
        ref={ref}
      >
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" data-tip="Close">
            <X size={22} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer ? <footer className="sheet-foot">{footer}</footer> : null}
      </section>
    </div>
  );
}
