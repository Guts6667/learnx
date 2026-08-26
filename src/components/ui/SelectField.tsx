import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';

import { classNames } from '@/components/ui/classNames';

export interface SelectFieldOption {
  disabled?: boolean;
  label: string;
  value: string;
}

export interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'children' | 'className' | 'id'
> {
  className?: string;
  description?: string;
  error?: string;
  id?: string;
  label: string;
  options: readonly SelectFieldOption[];
  placeholder?: string;
}

/** Native select with the same label, error and help contract as text fields. */
export function SelectField({
  className,
  description,
  error,
  id,
  label,
  options,
  placeholder,
  ...selectProps
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const descriptionId = description ? `${selectId}-description` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ');

  return (
    <div className={classNames('ui-field', className)}>
      <label className="ui-field__label" htmlFor={selectId}>
        {label}
      </label>
      <select
        {...selectProps}
        aria-describedby={describedBy || undefined}
        aria-invalid={Boolean(error) || undefined}
        className="ui-field__control ui-field__select"
        defaultValue={
          placeholder &&
          selectProps.defaultValue === undefined &&
          selectProps.value === undefined
            ? ''
            : selectProps.defaultValue
        }
        id={selectId}
      >
        {placeholder ? (
          <option disabled value="">
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option
            disabled={option.disabled}
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
      {description ? (
        <p className="ui-field__message" id={descriptionId}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p
          className="ui-field__message ui-field__message--error"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
