import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({title, size = '', onClose, footer, children}) {
  const dialog = useRef(null);

  useEffect(() => {
    const previous = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    dialog.current.focus();

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function handleKeyDown(event) {
    if (event.key === 'Escape' && onClose) {
      event.stopPropagation();
      onClose();

      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const nodes = Array.from(dialog.current.querySelectorAll('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]'));

    if (nodes.length === 0) {
      return;
    }

    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div className="overlay">
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={dialog} onKeyDown={handleKeyDown}>
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
        </div>

        <div className="modal-body">{children}</div>

        <div className="modal-foot">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}
