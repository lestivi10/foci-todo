import { useEffect, useRef, type ReactNode } from "react";
interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}
/** Modal focus stays inside the dialog and returns to its trigger on dismissal. */
export function Modal({ title, onClose, children, busy = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="modal"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) {
            event.preventDefault();
            onClose();
          }
          if (event.key !== "Tab") return;
          const controls = [
            ...(ref.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
            ) ?? []),
          ].filter((element) => !element.closest("fieldset:disabled"));
          const first = controls[0];
          const last = controls.at(-1);
          if (!first) {
            event.preventDefault();
            return;
          }
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === ref.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (
            !event.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === ref.current)
          ) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="modal-heading">
          <h2 id="dialog-title">{title}</h2>
          <button
            disabled={busy}
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
