import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useLayoutEffect, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import { t } from '../../i18n/i18n';

interface BaseFloatingProps {
  label: string;
  required?: boolean;
  error?: string;
}

interface FloatingInputProps extends BaseFloatingProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'time' | 'datetime-local' | 'url' | 'tel';
}

interface FloatingSelectProps extends BaseFloatingProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'placeholder'> {
  options: string[];
}

interface FloatingTextareaProps extends BaseFloatingProps, TextareaHTMLAttributes<HTMLTextAreaElement> {
  rows?: number;
}

interface FloatingDatePickerProps extends BaseFloatingProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder' | 'type'> {
  minDate?: string;
  maxDate?: string;
  dateFormat?: string;
}

interface FloatingDateRangePickerProps extends BaseFloatingProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (dates: [Date | null, Date | null]) => void;
  minDate?: Date;
  maxDate?: Date;
  filterDate?: (date: Date) => boolean;
  disabled?: boolean;
  helperText?: string;
  dateFormat?: string;
  monthsShown?: number;
  placeholder?: string;
  className?: string;
  closeOnScroll?: boolean;
  singleSelection?: boolean;
  showTimeSelect?: boolean;
  timeFormat?: string;
  timeIntervals?: number;
  closeOnSelect?: boolean;
}

const floatingStyles = `
  .floating-input:focus {
    border-color: #26c6da;
    outline: none;
    box-shadow: 0 0 0 3px rgba(77, 208, 225, 0.25);
  }

  .floating-input::placeholder {
    color: transparent !important;
  }
  
  .floating-input.error {
    border-color: #dc2626;
  }
  
  .floating-input.error:focus {
    border-color: #dc2626;
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
  }
  
  .error-text {
    color: #dc2626;
    font-size: 12px;
    margin-top: 4px;
    display: block;
  }

  /* Date picker specific styles */
  .floating-datepicker {
    position: relative;
  }

  .floating-datepicker::-webkit-calendar-picker-indicator {
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    margin-right: 4px;
  }

  .floating-datepicker::-webkit-calendar-picker-indicator:hover {
    background-color: #f3f4f6;
  }

  .floating-datepicker:focus::-webkit-calendar-picker-indicator {
    background-color: #eff6ff;
  }

  .floating-select:focus {
    border-color: #26c6da !important;
    outline: none;
    box-shadow: 0 0 0 3px rgba(77, 208, 225, 0.25);
  }

  .dark .floating-input,
  .dark .floating-select {
    background-color: #111827 !important;
    border-color: #374151 !important;
    color: #f9fafb !important;
  }

  .dark .floating-input::placeholder {
    color: transparent !important;
  }

  /* Native date/time controls otherwise retain Chrome's dark calendar glyph. */
  .dark input[type="date"]::-webkit-calendar-picker-indicator,
  .dark input[type="time"]::-webkit-calendar-picker-indicator,
  .dark input[type="datetime-local"]::-webkit-calendar-picker-indicator {
    filter: invert(1);
    opacity: 1;
  }

  /* FloatingDatePicker uses its own SVG rather than the native glyph. */
  .dark .floating-datepicker ~ svg {
    color: #fff !important;
  }

  .dark .floating-input:disabled,
  .dark .floating-select:disabled {
    background-color: #1f2937 !important;
    color: #94a3b8 !important;
  }

  .dark .floating-label {
    background-color: transparent !important;
    color: #cbd5e1 !important;
  }

  .dark .floating-input:focus + .floating-label,
  .dark .floating-input:not(:placeholder-shown) + .floating-label,
  .dark .floating-label-active {
    background-color: #111827 !important;
    color: #22d3ee !important;
  }

  .dark .floating-select option {
    background-color: #111827;
    color: #f9fafb;
  }

  /* Single date picker */
  .floating-datepicker-wrapper { display: block; width: 100%; }
  .floating-datepicker-wrapper .react-datepicker__input-container { display: block; width: 100%; }
  .floating-datepicker-wrapper .react-datepicker__close-icon { right: 36px; }
  #floating-datepicker-portal .react-datepicker-popper,
  .react-datepicker-popper { z-index: 100000 !important; }
  .floating-range-picker .react-datepicker__month-dropdown-container select,
  .floating-range-picker .react-datepicker__year-dropdown-container select {
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 2px 6px;
    font-size: 13px;
    background: #ffffff;
    color: #111827;
  }
  .dark .floating-range-picker .react-datepicker__month-dropdown-container select,
  .dark .floating-range-picker .react-datepicker__year-dropdown-container select {
    background: #1f2937 !important;
    border-color: #374151 !important;
    color: #f9fafb !important;
  }
  .floating-range-picker .react-datepicker__day--selected {
    background: #0891b2;
    color: #ffffff;
    border-radius: 9999px;
  }
  .floating-range-picker .react-datepicker__today-button {
    background: #f8fafc;
    border-top: 1px solid #e5e7eb;
    color: #0e7490;
  }
  .dark .floating-range-picker .react-datepicker__today-button {
    background: #111827 !important;
    border-top-color: #374151 !important;
    color: #22d3ee !important;
  }
  .dark .floating-datepicker-icon { color: #94a3b8 !important; }

  .floating-range-trigger {
    width: 100%;
    font-size: 12px;
    color: #1f2937;
    padding: 0 34px 0 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background-color: white;
    transition: all 0.2s ease-in-out;
    height: 32px;
    text-align: left;
    cursor: pointer;
  }

  /* ✅ FIX: dark trigger button */
  .dark .floating-range-trigger {
    background-color: #111827 !important;
    border-color: #374151 !important;
    color: #f9fafb !important;
  }

  .floating-range-trigger:focus {
    border-color: #26c6da;
    outline: none;
    box-shadow: 0 0 0 3px rgba(77, 208, 225, 0.25);
  }

  .floating-range-trigger.error {
    border-color: #dc2626;
  }

  .floating-range-trigger:disabled {
    background-color: #f3f4f6;
    color: #94a3b8;
    cursor: not-allowed;
  }

  /* ✅ FIX: dark disabled trigger */
  .dark .floating-range-trigger:disabled {
    background-color: #1f2937 !important;
    color: #94a3b8 !important;
    border-color: #374151 !important;
  }

  .floating-range-value {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .floating-range-popover {
    position: absolute;
    left: 0;
    top: calc(100% + 8px);
    z-index: 50;
    width: auto;
    max-width: min(100vw - 32px, 320px);
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.16);
    overflow: hidden;
  }

  /* ✅ FIX: dark popover shell */
  .dark .floating-range-popover {
    background: #111827 !important;
    border-color: #374151 !important;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.6) !important;
  }

  .floating-range-popover.upward {
    top: auto;
    bottom: calc(100% + 8px);
  }

  .floating-range-picker.react-datepicker {
    border: 0;
    border-radius: 12px;
    background: #ffffff;
    color: #111827;
    font-family: inherit;
  }

  /* ✅ FIX: dark calendar shell */
  .dark .floating-range-picker.react-datepicker {
    background: #111827 !important;
    color: #f9fafb !important;
  }

  .floating-range-picker .react-datepicker__month-container {
    float: none;
  }

  .floating-range-picker .react-datepicker__header {
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    padding-top: 12px;
  }

  /* ✅ FIX: dark calendar header */
  .dark .floating-range-picker .react-datepicker__header {
    background: #111827 !important;
    border-bottom-color: #374151 !important;
  }

  .floating-range-picker .react-datepicker__current-month {
    color: #111827;
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 10px;
  }

  /* ✅ FIX: dark current month */
  .dark .floating-range-picker .react-datepicker__current-month {
    color: #f9fafb !important;
  }

  .floating-range-picker .react-datepicker__day-name,
  .floating-range-picker .react-datepicker__day,
  .floating-range-picker .react-datepicker__time-name {
    color: #111827;
    width: 2rem;
    line-height: 2rem;
    margin: 0.15rem;
    font-size: 13px;
  }

  /* ✅ FIX: dark day text */
  .dark .floating-range-picker .react-datepicker__day-name,
  .dark .floating-range-picker .react-datepicker__day,
  .dark .floating-range-picker .react-datepicker__time-name {
    color: #f9fafb !important;
  }

  .floating-range-picker .react-datepicker__day-name {
    font-weight: 700;
    color: #6b7280;
  }

  /* ✅ FIX: dark day-of-week header */
  .dark .floating-range-picker .react-datepicker__day-name {
    color: #94a3b8 !important;
  }

  .floating-range-picker .react-datepicker__day {
    border-radius: 9999px;
  }

  .floating-range-picker .react-datepicker__day:hover,
  .floating-range-picker .react-datepicker__day--keyboard-selected {
    background: #eff6ff;
    color: #111827;
  }

  /* ✅ FIX: dark day hover */
  .dark .floating-range-picker .react-datepicker__day:hover,
  .dark .floating-range-picker .react-datepicker__day--keyboard-selected {
    background: #1f2937 !important;
    color: #f9fafb !important;
  }

  .floating-range-picker .react-datepicker__day--in-range,
  .floating-range-picker .react-datepicker__day--in-selecting-range {
    background: #dbeafe;
    color: #1e3a8a;
    border-radius: 9999px;
  }

  /* ✅ FIX: dark in-range day */
  .dark .floating-range-picker .react-datepicker__day--in-range,
  .dark .floating-range-picker .react-datepicker__day--in-selecting-range {
    background: #1e40af !important;
    color: #dbeafe !important;
  }

  .floating-range-picker .react-datepicker__day--range-start,
  .floating-range-picker .react-datepicker__day--range-end,
  .floating-range-picker .react-datepicker__day--selecting-range-start,
  .floating-range-picker .react-datepicker__day--selecting-range-end {
    background: #2563eb;
    color: #ffffff;
    font-weight: 700;
  }

  .floating-range-picker .react-datepicker__day--outside-month {
    color: #6b7280;
  }

  /* ✅ FIX: dark outside-month day */
  .dark .floating-range-picker .react-datepicker__day--outside-month {
    color: #4b5563 !important;
  }

  .floating-range-picker .react-datepicker__day--disabled {
    color: #4b5563;
    cursor: not-allowed;
  }

  /* ✅ FIX: dark disabled day */
  .dark .floating-range-picker .react-datepicker__day--disabled {
    color: #374151 !important;
  }

  .floating-range-picker .react-datepicker__navigation {
    top: 14px;
  }

  .floating-range-picker .react-datepicker__navigation-icon::before {
    border-color: #d1d5db;
  }

  /* ✅ FIX: dark navigation arrows */
  .dark .floating-range-picker .react-datepicker__navigation-icon::before {
    border-color: #94a3b8 !important;
  }

  .floating-range-picker .react-datepicker__month {
    margin: 0.75rem;
  }

  .floating-range-helper {
    padding: 8px 12px 10px;
    border-top: 1px solid #e5e7eb;
    color: #6b7280;
    font-size: 12px;
    line-height: 1.4;
    background: #ffffff;
  }

  /* ✅ FIX: dark helper text */
  .dark .floating-range-helper {
    background: #111827 !important;
    border-top-color: #374151 !important;
    color: #94a3b8 !important;
  }

  /* ✅ FIX: dark time-select column (react-datepicker ships one) */
  .dark .floating-range-picker .react-datepicker__time-container {
    border-left-color: #374151 !important;
  }

  .dark .floating-range-picker .react-datepicker__time-container .react-datepicker__time,
  .dark .floating-range-picker .react-datepicker__time-container .react-datepicker__time-box {
    background-color: #111827 !important;
    color: #f9fafb !important;
  }

  .dark .floating-range-picker .react-datepicker__time-list-item {
    color: #f9fafb !important;
  }

  .dark .floating-range-picker .react-datepicker__time-list-item:hover {
    background-color: #1f2937 !important;
  }

  .dark .floating-range-picker .react-datepicker__time-list-item--selected {
    background-color: #2563eb !important;
    color: #ffffff !important;
  }

  .dark .floating-range-picker .react-datepicker__time-container .react-datepicker__header {
    background-color: #1f2937 !important;
    border-bottom-color: #374151 !important;
  }

  .dark .floating-range-picker .react-datepicker-time__header {
    color: #f9fafb !important;
  }
`;

// In the screen language; a trailing "*" written into the label is kept outside the translation
function getFloatingLabel(label: string, required: boolean) {
  const bare = label.replace(/\s*\*\s*$/, "");
  const starred = required || bare !== label;
  return `${t(bare)}${starred ? " *" : ""}`;
}

/*
 * These fields used to float the label inside a 52px box. They now match the Create Employee form:
 * the label sits above a 32px field with 12px text (same names and props, so callers are unchanged).
 */
const FIELD_GROUP = { position: 'relative' as const, marginBottom: '12px', width: '100%' };
const FIELD_LABEL: React.CSSProperties = {
  display: 'block',
  marginBottom: '2px',
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: 1.4,
  color: '#374151',
};
const fieldBox = (error?: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
  width: '100%',
  height: '32px',
  fontSize: '12px',
  color: '#1f2937',
  padding: '0 10px',
  border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`,
  borderRadius: '8px',
  backgroundColor: 'white',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  ...extra,
});
const CHEVRON =
  "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")";
const selectBox = (error?: string, disabled?: boolean): React.CSSProperties =>
  fieldBox(error, {
    padding: '0 32px 0 10px',
    appearance: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    backgroundColor: disabled ? '#f3f4f6' : 'white',
    backgroundImage: CHEVRON,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    backgroundSize: '14px',
  });

const FieldLabel: React.FC<{ htmlFor?: string; label: string; required: boolean; error?: string }> = ({ htmlFor, label, required, error }) => (
  <label htmlFor={htmlFor} className="floating-label" style={{ ...FIELD_LABEL, color: error ? '#dc2626' : FIELD_LABEL.color }}>
    {getFloatingLabel(label, required)}
  </label>
);

function createNumberInputEvent(
  event: React.ChangeEvent<HTMLInputElement>,
  nextValue: string
): React.ChangeEvent<HTMLInputElement> {
  const nextTarget = {
    ...event.target,
    value: nextValue,
  };

  return {
    ...event,
    target: nextTarget,
    currentTarget: nextTarget,
  } as React.ChangeEvent<HTMLInputElement>;
}

export const FloatingInput: React.FC<FloatingInputProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  error,
  name,
  className = '',
  ...props
}) => {
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (
      type === "number" &&
      String(value ?? "") === "0" &&
      event.target.value.length > 1 &&
      event.target.value.startsWith("0") &&
      !event.target.value.startsWith("0.")
    ) {
      onChange?.(createNumberInputEvent(event, event.target.value.slice(1)));
      return;
    }

    onChange?.(event);
  };

  return (
    <div style={FIELD_GROUP}>
      <style>{floatingStyles}</style>
      <FieldLabel htmlFor={name} label={label} required={required} error={error} />
      <input
        type={type}
        value={value}
        onChange={handleInputChange}
        style={fieldBox(error)}
        className={`floating-input ${type === 'date' ? 'floating-datepicker' : ''} ${error ? 'error' : ''} ${className}`}
        required={required}
        placeholder=" "
        name={name}
        id={props.id ?? name}
        {...props}
      />
      {error && <span className="error-text">{error}</span>}
    </div>
  );
};

export const FloatingTextarea: React.FC<FloatingTextareaProps> = ({
  label,
  value,
  onChange,
  required = false,
  error,
  name,
  className = '',
  rows = 4,
  ...props
}) => {
  return (
    <div style={FIELD_GROUP}>
      <style>{floatingStyles}</style>
      <FieldLabel htmlFor={name} label={label} required={required} error={error} />
      <textarea
        value={value}
        onChange={onChange}
        style={fieldBox(error, { height: 'auto', minHeight: '60px', padding: '6px 10px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' })}
        className={`floating-input ${error ? 'error' : ''} ${className}`}
        required={required}
        placeholder=" "
        name={name}
        id={props.id ?? name}
        rows={Math.min(rows, 3)}
        {...props}
      />
      {error && <span className="error-text">{error}</span>}
    </div>
  );
};

/** "2026-10-13" → local Date (no time-zone shift), or null. */
const parseIsoDate = (value: unknown): Date | null => {
  const text = String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Local Date → "2026-10-13" (what forms and APIs use). */
const toIsoDate = (date: Date | null) => (date ? format(date, "yyyy-MM-dd") : "");

/**
 * Date field with a calendar. Shows the date as "13 Oct 2026" and has month and year
 * dropdowns, but still gives the form "2026-10-13", so callers don't change:
 * onChange receives an event-like object with target.value.
 */
export const FloatingDatePicker: React.FC<FloatingDatePickerProps> = ({
  label,
  value,
  onChange,
  required = false,
  error,
  name,
  minDate,
  maxDate,
  className = '',
  dateFormat = 'dd MMM yyyy',
  disabled,
}) => {
  const [, setOpen] = useState(false);
  const selected = parseIsoDate(value);

  const emit = (date: Date | null) => {
    const nextValue = toIsoDate(date);
    onChange?.({ target: { name, value: nextValue }, currentTarget: { name, value: nextValue } } as unknown as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div style={FIELD_GROUP} className={className}>
      <style>{floatingStyles}</style>
      <FieldLabel htmlFor={name} label={label} required={required} error={error} />
      <div style={{ position: 'relative' }}>
      <DatePicker
        selected={selected}
        onChange={(date: Date | null) => emit(date)}
        onCalendarOpen={() => setOpen(true)}
        onCalendarClose={() => setOpen(false)}
        dateFormat={dateFormat}
        minDate={parseIsoDate(minDate) ?? undefined}
        maxDate={parseIsoDate(maxDate) ?? undefined}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        todayButton="Today"
        isClearable={!required && Boolean(selected)}
        disabled={disabled}
        name={name}
        placeholderText=" "
        autoComplete="off"
        // Shown above drawers and popups, never cut off by them.
        portalId="floating-datepicker-portal"
        calendarClassName="floating-range-picker"
        wrapperClassName="floating-datepicker-wrapper"
        className={`floating-input floating-datepicker ${error ? 'error' : ''}`}
        customInput={
          <input id={name} style={fieldBox(error, { padding: '0 34px 0 10px', cursor: 'pointer' })} />
        }
      />
      <svg
        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none', zIndex: 2 }}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="floating-datepicker-icon"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      </div>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
};

export const FloatingDateRangePicker: React.FC<FloatingDateRangePickerProps> = ({
  label,
  required = false,
  error,
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate,
  filterDate,
  disabled = false,
  helperText,
  dateFormat = "MM/dd/yyyy",
  monthsShown = 1,
  placeholder = "Select date range",
  className = "",
  closeOnScroll = true,
  singleSelection = false,
  showTimeSelect = false,
  timeFormat = "hh:mm aa",
  timeIntervals = 15,
  closeOnSelect = !showTimeSelect,
}) => {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !wrapperRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const estimatedPopoverHeight = helperText ? 340 : 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    setOpenUpward(spaceBelow < estimatedPopoverHeight && spaceAbove > spaceBelow);
  }, [open, helperText]);

  const displayValue =
    singleSelection
      ? startDate
        ? format(startDate, dateFormat)
        : placeholder
      : startDate && endDate
      ? `${format(startDate, dateFormat)} - ${format(endDate, dateFormat)}`
      : startDate
        ? `${format(startDate, dateFormat)} -`
        : placeholder;

  const normalizeDate = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const resolveRangeChange = (dates: [Date | null, Date | null]): [Date | null, Date | null] => {
    const [nextStart, nextEnd] = dates;

    if (!(startDate && endDate) || nextEnd) {
      return dates;
    }

    if (!nextStart) {
      return dates;
    }

    const currentStart = normalizeDate(startDate);
    const currentEnd = normalizeDate(endDate);
    const clickedDate = normalizeDate(nextStart);

    if (clickedDate.getTime() <= currentStart.getTime()) {
      return [clickedDate, currentEnd];
    }

    if (clickedDate.getTime() >= currentEnd.getTime()) {
      return [currentStart, clickedDate];
    }

    const distanceToStart = clickedDate.getTime() - currentStart.getTime();
    const distanceToEnd = currentEnd.getTime() - clickedDate.getTime();

    return distanceToStart <= distanceToEnd
      ? [clickedDate, currentEnd]
      : [currentStart, clickedDate];
  };

  return (
    <div
      ref={wrapperRef}
      style={FIELD_GROUP}
      className={className}
    >
      <style>{floatingStyles}</style>
      <FieldLabel label={label} required={required} error={error} />
      <div style={{ position: "relative" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`floating-range-trigger ${error ? "error" : ""}`}
      >
        <span className="floating-range-value">{displayValue}</span>
      </button>
      <svg
        style={{
          position: "absolute",
          right: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          color: "#6b7280",
          pointerEvents: "none",
          zIndex: 2,
        }}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      </div>

      {open && !disabled && (
        <div className={`floating-range-popover ${openUpward ? "upward" : ""}`}>
          {singleSelection ? (
            <DatePicker
              inline
              selected={startDate || endDate}
              onChange={(selectedDate: Date | null) => {
                onChange([selectedDate, selectedDate]);
                if (selectedDate && closeOnSelect) {
                  setOpen(false);
                }
              }}
              minDate={minDate}
              maxDate={maxDate}
              filterDate={filterDate}
              monthsShown={monthsShown}
              showTimeSelect={showTimeSelect}
              timeFormat={timeFormat}
              timeIntervals={timeIntervals}
              calendarClassName="floating-range-picker"
              closeOnScroll={closeOnScroll}
            />
          ) : (
            <DatePicker
              inline
              selected={startDate}
              startDate={startDate}
              endDate={endDate}
              onChange={(value: [Date | null, Date | null]) => {
                const resolvedDates = resolveRangeChange(value);
                onChange(resolvedDates);
                if (resolvedDates[0] && resolvedDates[1] && closeOnSelect) {
                  setOpen(false);
                }
              }}
              selectsRange
              minDate={minDate}
              maxDate={maxDate}
              filterDate={filterDate}
              monthsShown={monthsShown}
              showTimeSelect={showTimeSelect}
              timeFormat={timeFormat}
              timeIntervals={timeIntervals}
              calendarClassName="floating-range-picker"
              closeOnScroll={closeOnScroll}
            />
          )}
          {helperText && <div className="floating-range-helper">{helperText}</div>}
        </div>
      )}
      {error && <span className="error-text">{error}</span>}
    </div>
  );
};

export const FloatingSelect: React.FC<FloatingSelectProps> = ({
  label,
  value,
  onChange,
  options,
  required = false,
  error,
  name,
  className = '',
  ...props
}) => {
  return (
    <div style={FIELD_GROUP}>
      <style>{floatingStyles}</style>
      <FieldLabel htmlFor={name} label={label} required={required} error={error} />
      <select
        value={value}
        onChange={onChange}
        style={selectBox(error, props.disabled)}
        className={`floating-select ${error ? 'error' : ''} ${className}`}
        required={required}
        name={name}
        id={props.id ?? name}
        {...props}
      >
        <option value="">{t("Select")}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{t(opt)}</option>
        ))}
      </select>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
};

// Generic option type
export interface Option {
  id: string | number;
  name: string;
}

interface FloatingSelectProps1 {
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Option[]; // Accept array of {id, name}
  required?: boolean;
  name?: string;
  className?: string;
  disabled?: boolean;
  includeEmptyOption?: boolean;
  emptyOptionLabel?: string;
}

export const FloatingSelect1: React.FC<FloatingSelectProps1> = ({
  label,
  value,
  onChange,
  options,
  required = false,
  name,
  className = "",
  disabled = false,
  includeEmptyOption = true,
  emptyOptionLabel,
}) => {
  return (
    <div style={FIELD_GROUP} className={className}>
      <style>{floatingStyles}</style>
      <FieldLabel htmlFor={name} label={label} required={required} />
      <select
        value={value}
        onChange={onChange}
        required={required}
        name={name}
        id={name}
        disabled={disabled}
        className="floating-select"
        style={selectBox(undefined, disabled)}
      >
        {includeEmptyOption && <option value="">{t(emptyOptionLabel ?? "Select")}</option>}
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {t(String(opt.name ?? ""))}
          </option>
        ))}
      </select>
    </div>
  );
};
