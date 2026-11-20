/**
 * Legacy `field()` fragment (`legacy/admin/assets/js/ui.js`).
 *
 * `id` is derived from `name` exactly like the original (`f-${name}`), so view
 * code and tests that look up `#f-name` keep working. `.field` / `.input` /
 * `.field__hint` come from the global admin sheet. Note: `site.css` also has a
 * `.field` block, but for a different shape (`flex-direction: column` with a
 * `.field > span` label), so this component is admin-shaped by design.
 */
export function Field(props: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number" | "search" | "email" | "password";
  placeholder?: string;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  icon?: React.ReactNode;
}): JSX.Element {
  const { label, name, value, onChange, type, placeholder, required, hint, disabled, min, max, step, icon } = props;
  const id = "f-" + name;

  return (
    <div className="field">
      <label htmlFor={id}>
        {icon}
        {label}
      </label>
      <input
        className="input"
        id={id}
        name={name}
        type={type ?? "text"}
        value={value}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <div className="field__hint">{hint}</div> : null}
    </div>
  );
}
