import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, useRef, useState } from 'react';

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

const floatingStyles = `
  .floating-input:focus {
    border-color: #2563eb;
    outline: none;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
  
  .floating-input:focus + .floating-label,
  .floating-input:not(:placeholder-shown) + .floating-label {
    top: 0 !important;
    font-size: 12px !important;
    color: #2563eb !important;
    font-weight: 500 !important;
    background-color: white !important;
    transform: translateY(-50%) !important;
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

  /* Textarea specific styles */
  textarea.floating-input:focus,
  textarea.floating-input:not(:placeholder-shown) {
    padding-top: 24px !important;
    padding-bottom: 8px !important;
  }

  .floating-select:focus {
    border-color: #2563eb !important;
    outline: none;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
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

  .dark .floating-input:disabled,
  .dark .floating-select:disabled {
    background-color: #1f2937 !important;
    color: #94a3b8 !important;
  }

  .dark .floating-label {
    background-color: #111827 !important;
    color: #94a3b8 !important;
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
`;

function getFloatingLabel(label: string, required: boolean) {
  return `${label}${required && !label.includes("*") ? " *" : ""}`;
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
  const styles = {
    formGroup: {
      position: 'relative' as const,
      marginBottom: '20px',
      width: '100%',
    },
    formInput: {
      width: '100%',
      fontSize: '16px',
      color: '#1f2937',
      padding: '16px 12px 4px 12px',
      border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`,
      borderRadius: '6px',
      backgroundColor: 'white',
      transition: 'all 0.2s ease-in-out',
      height: '52px'
    },
    formLabel: {
      position: 'absolute' as const,
      top: '50%',
      left: '12px',
      fontSize: '16px',
      margin: 0,
      padding: '0 4px',
      backgroundColor: 'transparent',
      transition: 'all 0.2s ease-in-out',
      color: error ? '#dc2626' : '#6b7280',
      pointerEvents: 'none' as const,
      zIndex: 2,
      lineHeight: '1',
      transform: 'translateY(-50%)',
    }
  };

  return (
    <div style={styles.formGroup}>
      <style>{floatingStyles}</style>
      <input
        type={type}
        value={value}
        onChange={onChange}
        style={styles.formInput}
        className={`floating-input ${type === 'date' ? 'floating-datepicker' : ''} ${error ? 'error' : ''} ${className}`}
        required={required}
        placeholder=" "
        name={name}
        {...props}
      />
      <label 
        style={styles.formLabel}
        className="floating-label"
        htmlFor={name}
      >
        {getFloatingLabel(label, required)}
      </label>
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
  const styles = {
    formGroup: {
      position: 'relative' as const,
      marginBottom: '20px',
      width: '100%',
    },
    textareaInput: {
      width: '100%',
      fontSize: '16px',
      color: '#1f2937',
      padding: '24px 12px 8px 12px',
      border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`,
      borderRadius: '6px',
      backgroundColor: 'white',
      transition: 'all 0.2s ease-in-out',
      resize: 'vertical' as const,
      minHeight: '52px',
      fontFamily: 'inherit',
    },
    formLabel: {
      position: 'absolute' as const,
      top: '16px',
      left: '12px',
      fontSize: '16px',
      margin: 0,
      padding: '0 4px',
      backgroundColor: 'transparent',
      transition: 'all 0.2s ease-in-out',
      color: error ? '#dc2626' : '#6b7280',
      pointerEvents: 'none' as const,
      zIndex: 2,
      lineHeight: '1',
    }
  };

  return (
    <div style={styles.formGroup}>
      <style>{floatingStyles}</style>
      <textarea
        value={value}
        onChange={onChange}
        style={styles.textareaInput}
        className={`floating-input ${error ? 'error' : ''} ${className}`}
        required={required}
        placeholder=" "
        name={name}
        rows={rows}
        {...props}
      />
      <label 
        style={styles.formLabel}
        className="floating-label"
        htmlFor={name}
      >
        {getFloatingLabel(label, required)}
      </label>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
};

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
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const styles = {
    formGroup: {
      position: 'relative' as const,
      marginBottom: '20px',
      width: '100%',
    },
    dateInput: {
      width: '100%',
      fontSize: '16px',
      color: '#1f2937',
      padding: '16px 40px 4px 12px',
      border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`,
      borderRadius: '6px',
      backgroundColor: 'white',
      transition: 'all 0.2s ease-in-out',
      height: '52px',
      cursor: 'pointer' as const,
    },
    formLabel: {
      position: 'absolute' as const,
      top: '50%',
      left: '12px',
      fontSize: '16px',
      margin: 0,
      padding: '0 4px',
      backgroundColor: 'transparent',
      transition: 'all 0.2s ease-in-out',
      color: error ? '#dc2626' : '#6b7280',
      pointerEvents: 'none' as const,
      zIndex: 2,
      lineHeight: '1',
      transform: 'translateY(-50%)',
    },
    calendarIcon: {
      position: 'absolute' as const,
      right: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#6b7280',
      pointerEvents: 'none' as const,
      zIndex: 2,
    }
  };

  return (
    <div style={styles.formGroup}>
      <style>{floatingStyles}</style>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={onChange}
        onClick={() => inputRef.current?.showPicker?.()}
        onFocus={() => inputRef.current?.showPicker?.()}
        style={styles.dateInput}
        className={`floating-input floating-datepicker ${error ? 'error' : ''} ${className}`}
        required={required}
        placeholder=" "
        name={name}
        min={minDate}
        max={maxDate}
        {...props}
      />
      <label 
        style={styles.formLabel}
        className="floating-label"
        htmlFor={name}
      >
        {getFloatingLabel(label, required)}
      </label>
      {/* Calendar icon */}
      <svg 
        style={styles.calendarIcon}
        width="20" 
        height="20" 
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
  const [focused, setFocused] = useState(false);
  const isActive = focused || (value && value !== "");

  const styles = {
    formGroup: {
      position: 'relative' as const,
      marginBottom: '20px',
      width: '100%',
    },
    selectInput: {
      width: '100%',
      fontSize: '16px',
      color: '#1f2937',
      padding: '16px 12px 4px 12px',
      border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`,
      borderRadius: '6px',
      backgroundColor: 'white',
      transition: 'all 0.2s ease-in-out',
      appearance: 'none' as const,
      cursor: 'pointer' as const,
      height: '52px',
      backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
      backgroundSize: '16px',
    },
    formLabel: {
      position: 'absolute' as const,
      top: isActive ? '0' : '50%',
      left: '12px',
      fontSize: isActive ? '12px' : '16px',
      margin: 0,
      padding: '0 4px',
      backgroundColor: isActive ? 'white' : 'transparent',
      transition: 'all 0.2s ease-in-out',
      color: error ? '#dc2626' : (isActive ? '#2563eb' : '#6b7280'),
      pointerEvents: 'none' as const,
      zIndex: 2,
      lineHeight: '1',
      transform: isActive ? 'translateY(-50%)' : 'translateY(-50%)',
      fontWeight: isActive ? '500' : '400',
    }
  };

  return (
    <div style={styles.formGroup}>
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.selectInput}
        className={`floating-select ${error ? 'error' : ''} ${className}`}
        required={required}
        name={name}
        {...props}
      >
        <option value=""></option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <label
        style={styles.formLabel}
        className={isActive ? "floating-label floating-label-active" : "floating-label"}
        htmlFor={name}
      >
        {getFloatingLabel(label, required)}
      </label>
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
  const [focused, setFocused] = useState(false);
  const isActive = focused || (value !== "" && value !== undefined && value !== null);

  return (
    <div style={{ position: "relative", marginBottom: "20px", width: "100%" }} className={className}>
      <style>{floatingStyles}</style>
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        name={name}
        disabled={disabled}
        className="floating-select"
        style={{
          width: "100%",
          fontSize: "16px",
          color: "#1f2937",
          padding: "16px 40px 4px 12px",
          border: "1px solid #d1d5db",
          borderRadius: "6px",
          backgroundColor: disabled ? "#f3f4f6" : "white",
          transition: "all 0.2s ease-in-out",
          appearance: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          height: "52px",
          backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
          backgroundSize: "16px",
        }}
      >
        {includeEmptyOption && <option value="">{emptyOptionLabel ?? ""}</option>}
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
          </option>
        ))}
      </select>
      <label
        htmlFor={name}
        className={isActive ? "floating-label floating-label-active" : "floating-label"}
        style={{
          position: "absolute",
          top: isActive ? "0" : "50%",
          left: "12px",
          fontSize: isActive ? "12px" : "16px",
          margin: 0,
          padding: "0 4px",
          backgroundColor: isActive ? "white" : "transparent",
          transition: "all 0.2s ease-in-out",
          color: isActive ? "#2563eb" : "#6b7280",
          pointerEvents: "none",
          zIndex: 2,
          lineHeight: "1",
          transform: "translateY(-50%)",
          fontWeight: isActive ? 500 : 400,
        }}
      >
        {getFloatingLabel(label, required)}
      </label>
    </div>
  );
};  
