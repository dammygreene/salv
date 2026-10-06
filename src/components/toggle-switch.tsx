"use client";

export function ToggleSwitch({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <span className="toggle-switch">
      <input type="checkbox" id={id} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <label htmlFor={id} className="toggle-track" aria-label={label}>
        <span className="toggle-thumb" />
      </label>
      {label && (
        <label htmlFor={id} className="toggle-label">
          {label}
        </label>
      )}
    </span>
  );
}
