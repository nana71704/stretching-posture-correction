import { useEffect, useId, useRef } from 'react';
import styles from './Modal.module.css';

export default function Modal({ open, title, children, actions, onClose }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <div className={styles.body}>{children}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </dialog>
  );
}
