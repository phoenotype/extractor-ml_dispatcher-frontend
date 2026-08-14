import { useState } from "react";

interface JsonConfigFieldProps {
  label: string;
  value: unknown;
  disabled?: boolean;
  requireObject?: boolean;
  onChange: (value: unknown) => void;
}

export function JsonConfigField({
  label,
  value,
  disabled,
  requireObject,
  onChange,
}: JsonConfigFieldProps) {
  const [draft, setDraft] = useState(() =>
    value === undefined ? "" : JSON.stringify(value, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <label>
      {label} (JSON)
      <textarea
        disabled={disabled}
        rows={7}
        value={draft}
        placeholder={
          label.toLowerCase() === "headers"
            ? '{\n  "X-Source": "dispatcher"\n}'
            : '{\n  "protocol": "{{ document.protocol }}"\n}'
        }
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (!next.trim()) {
            setError(null);
            onChange(undefined);
            return;
          }
          try {
            const parsed = JSON.parse(next) as unknown;
            if (
              requireObject &&
              (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            ) {
              setError("Inserisci un oggetto JSON");
              return;
            }
            onChange(parsed);
            setError(null);
          } catch {
            setError("JSON non valido");
          }
        }}
      />
      {error ? <small className="field-error">{error}</small> : null}
      <small className="field-hint">
        Puoi usare template come {"{{ document.protocol }}"}. Lascia vuoto per
        omettere il campo.
      </small>
    </label>
  );
}
