import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Sheet({ title, onClose, children, footer, wide = false, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => {
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
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer ? <footer className="sheet-foot">{footer}</footer> : null}
      </section>
    </div>
  );
}
