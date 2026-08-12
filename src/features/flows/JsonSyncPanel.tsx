interface JsonSyncPanelProps {
  value: string;
  error: string | null;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onApply: () => void;
}

export function JsonSyncPanel({
  value,
  error,
  readOnly,
  onChange,
  onApply,
}: JsonSyncPanelProps) {
  return (
    <div className="json-editor">
      <textarea
        spellCheck={false}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
      <div>
        <span className={error ? "json-error" : "json-ok"}>
          {error || "Canvas e JSON sincronizzati"}
        </span>
        <button type="button" disabled={readOnly} onClick={onApply}>
          Applica JSON
        </button>
      </div>
    </div>
  );
}
