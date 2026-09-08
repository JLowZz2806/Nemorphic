import { useEffect, useRef, type ReactNode } from "react";

import { CloseIcon } from "./SocialIcons";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow || "auto";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const titleId = `nm-modal-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      className="nm-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="nm-modal nm-grain"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
      >
        <button type="button" className="nm-modal-close" onClick={onClose} aria-label="Cerrar">
          <CloseIcon />
        </button>
        <h2
          id={titleId}
          className="nm-display"
          style={{ fontSize: "2rem", color: "var(--nm-pink)" }}
        >
          {title}
        </h2>
        <div className="nm-rule" style={{ marginBottom: "1.75rem" }} />
        {children}
      </div>
    </div>
  );
}
