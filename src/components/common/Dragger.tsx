import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import "../../styles/Dragger.css";

export type DraggerStep = { label: string; content: ReactNode };

type DraggerProps = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  submitting?: boolean;
  headerMeta?: ReactNode;
  headerAction?: ReactNode;
  showSubmit?: boolean;
  compact?: boolean;
  /** Uses a centered dialog instead of the default right-side drawer. */
  variant?: "drawer" | "modal";
  /** Optional workflow steps. Each step receives its own tab and Previous/Next controls. */
  steps?: DraggerStep[];
  previousLabel?: string;
  nextLabel?: string;
  /** Fully custom content with its own form and actions. */
  content?: ReactNode;
  children?: ReactNode;
};

/** Reusable form overlay for drawers and multi-step modal workflows. */
export default function Dragger({
  isOpen, title, subtitle, onClose, onSubmit, submitLabel, submitting,
  headerMeta, headerAction, showSubmit = true, compact = false,
  variant = "drawer", steps = [], previousLabel = "Previous", nextLabel = "Next", content, children,
}: DraggerProps) {
  const [step, setStep] = useState(0);
  const hasSteps = steps.length > 0;
  const activeStep = steps[step];
  const isLastStep = !hasSteps || step === steps.length - 1;

  useEffect(() => {
    if (!isOpen) { setStep(0); return undefined; }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (hasSteps && !isLastStep) {
      event.preventDefault();
      setStep((current) => Math.min(current + 1, steps.length - 1));
      return;
    }
    onSubmit(event);
  };

  return createPortal(
    <div className={`dragger dragger--${variant}`} role="presentation" onMouseDown={onClose}>
      <section className={`dragger__panel dragger__panel--${variant}${compact ? " dragger__panel--compact" : ""}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="dragger__header">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <div className="dragger__header-actions">
            {headerMeta && <div className="dragger__header-meta">{headerMeta}</div>}
            {headerAction}
            <button type="button" onClick={onClose} aria-label="Close dialog"><XMarkIcon /></button>
          </div>
        </header>
        {hasSteps && <nav className="dragger__steps" aria-label="Form steps">
          {steps.map((item, index) => <button key={`${item.label}-${index}`} type="button" className={index === step ? "is-active" : ""} aria-current={index === step ? "step" : undefined} onClick={() => setStep(index)}>{item.label}</button>)}
        </nav>}
        {content ? <div className="dragger__body dragger__body--custom">{content}</div> : <form className="dragger__form" noValidate onSubmit={handleSubmit}>
          <div className="dragger__body">{hasSteps ? activeStep?.content : children}</div>
          <footer className="dragger__footer">
            {hasSteps && <span className="dragger__progress">{activeStep?.label} • {step + 1} of {steps.length}</span>}
            <div className="dragger__footer-actions">
              {hasSteps ? <button type="button" className="dragger__cancel" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>{previousLabel}</button> : <button type="button" className="dragger__cancel" onClick={onClose}>Cancel</button>}
              {showSubmit && (isLastStep ? <button type="submit" className="dragger__submit" disabled={submitting}>{submitting ? "Saving..." : submitLabel}</button> : <button type="button" className="dragger__submit" onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}>{nextLabel}</button>)}
            </div>
          </footer>
        </form>}
      </section>
    </div>, document.body
  );
}
