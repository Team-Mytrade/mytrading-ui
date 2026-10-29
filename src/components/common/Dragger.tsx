import { ReactNode, useEffect, useState } from "react";
import { t } from "../../i18n/i18n";
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
  /** Optional workflow steps (tabs). Each step gets its own tab and Previous/Next controls. */
  steps?: DraggerStep[];
  previousLabel?: string;
  nextLabel?: string;
  /** Controlled active step. When left out, the Dragger manages the step itself. */
  activeStep?: number;
  onStepChange?: (step: number) => void;
  /** Marks a tab that contains errors (red dot). */
  stepHasError?: (index: number) => boolean;
  /** Called before moving forward with Next; return false to stay on the current step. */
  onBeforeNext?: (index: number) => boolean;
  /** Shows the submit button on every step (tabs style), not only on the last one. */
  submitOnEveryStep?: boolean;
  /** Fully custom content with its own form and actions. */
  content?: ReactNode;
  children?: ReactNode;
};

/** Reusable form overlay for drawers and multi-step modal workflows. */
export default function Dragger({
  isOpen, title, subtitle, onClose, onSubmit, submitLabel, submitting,
  headerMeta, headerAction, showSubmit = true, compact = false,
  variant = "drawer", steps = [], previousLabel = "Previous", nextLabel = "Next",
  activeStep, onStepChange, stepHasError, onBeforeNext, submitOnEveryStep = false,
  content, children,
}: DraggerProps) {
  const [innerStep, setInnerStep] = useState(0);
  const hasSteps = steps.length > 0;
  const step = Math.min(activeStep ?? innerStep, Math.max(0, steps.length - 1));
  const activeStepItem = steps[step];
  const isLastStep = !hasSteps || step === steps.length - 1;

  const goToStep = (next: number) => {
    const clamped = Math.max(0, Math.min(next, steps.length - 1));
    if (onStepChange) onStepChange(clamped);
    else setInnerStep(clamped);
  };

  const goNext = () => {
    if (onBeforeNext && !onBeforeNext(step)) return;
    goToStep(step + 1);
  };

  useEffect(() => {
    if (!isOpen) { setInnerStep(0); return undefined; }
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
    // Pressing Enter before the last step moves to the next step instead of saving
    // (unless the form allows saving from every step).
    if (hasSteps && !isLastStep && !submitOnEveryStep) {
      event.preventDefault();
      goNext();
      return;
    }
    onSubmit(event);
  };

  const showSubmitButton = showSubmit && (isLastStep || submitOnEveryStep);

  return createPortal(
    <div className={`dragger dragger--${variant}`} role="presentation" onMouseDown={onClose}>
      <section className={`dragger__panel dragger__panel--${variant}${compact ? " dragger__panel--compact" : ""}`} role="dialog" aria-modal="true" aria-label={t(title)} onMouseDown={(event) => event.stopPropagation()}>
        <header className="dragger__header">
          <div><h2>{t(title)}</h2>{subtitle && <p>{t(subtitle)}</p>}</div>
          <div className="dragger__header-actions">
            {headerMeta && <div className="dragger__header-meta">{headerMeta}</div>}
            {headerAction}
            <button type="button" onClick={onClose} aria-label="Close dialog"><XMarkIcon /></button>
          </div>
        </header>
        {hasSteps && <nav className="dragger__steps" aria-label="Form steps">
          {steps.map((item, index) => {
            const hasError = stepHasError?.(index);
            return (
              <button
                key={`${item.label}-${index}`}
                type="button"
                className={index === step ? "is-active" : ""}
                aria-current={index === step ? "step" : undefined}
                onClick={() => goToStep(index)}
                title={hasError ? `${item.label}: has errors` : item.label}
              >
                {item.label}
                {hasError && <span aria-label="has errors" style={{ color: "#dc2626", marginLeft: 6, fontWeight: 700 }}>•</span>}
              </button>
            );
          })}
        </nav>}
        {content ? <div className="dragger__body dragger__body--custom">{content}</div> : <form className="dragger__form" noValidate onSubmit={handleSubmit}>
          <div className="dragger__body">{hasSteps ? activeStepItem?.content : children}</div>
          <footer className="dragger__footer">
            {hasSteps && <span className="dragger__progress">{activeStepItem?.label} • {step + 1} of {steps.length}</span>}
            <div className="dragger__footer-actions">
              {hasSteps
                ? <button type="button" className="dragger__cancel" onClick={() => goToStep(step - 1)} disabled={step === 0}>{t(previousLabel)}</button>
                : <button type="button" className="dragger__cancel" onClick={onClose}>{t("Cancel")}</button>}

              {/* Next and Submit are separate buttons with their own keys. Reusing one button and
                  switching its type made React turn the clicked Next into a submit button,
                  which saved the form as soon as the last step was reached. */}
              {hasSteps && !isLastStep && (
                <button
                  key="next"
                  type="button"
                  className={submitOnEveryStep ? "dragger__cancel" : "dragger__submit"}
                  onClick={(event) => {
                    event.preventDefault();
                    goNext();
                  }}
                >
                  {t(nextLabel)}
                </button>
              )}
              {showSubmitButton && (
                <button key="submit" type="submit" className="dragger__submit" disabled={submitting}>
                  {t(submitting ? "Saving..." : submitLabel)}
                </button>
              )}
            </div>
          </footer>
        </form>}
      </section>
    </div>, document.body
  );
}
