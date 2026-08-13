import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export interface FlowFiltersState {
  search: string;
  status: "all" | "active" | "inactive";
  documentType: string;
}

interface FlowFiltersProps {
  value: FlowFiltersState;
  documentTypes: string[];
  onChange: (next: FlowFiltersState) => void;
}

export function FlowFilters({
  value,
  documentTypes,
  onChange,
}: FlowFiltersProps) {
  const [openDoc, setOpenDoc] = useState(false);
  const [openStatus, setOpenStatus] = useState(false);

  const statusLabel = useMemo(() => {
    if (value.status === "active") return "Attivi";
    if (value.status === "inactive") return "Inattivi";
    return "Tutti gli stati";
  }, [value.status]);

  return (
    <div className="toolbar">
      <label className="search">
        <Search size={17} />
        <input
          value={value.search}
          onChange={(event) =>
            onChange({ ...value, search: event.target.value })
          }
          placeholder="Cerca per nome, descrizione o categoria…"
        />
      </label>
      <div className="filter-buttons">
        <div className="filter-menu">
          <button type="button" onClick={() => setOpenStatus((v) => !v)}>
            {statusLabel} <ChevronDown size={14} />
          </button>
          {openStatus ? (
            <div className="filter-dropdown">
              {(
                [
                  ["all", "Tutti gli stati"],
                  ["active", "Attivi"],
                  ["inactive", "Inattivi"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChange({ ...value, status: key });
                    setOpenStatus(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="filter-menu">
          <button type="button" onClick={() => setOpenDoc((v) => !v)}>
            {value.documentType || "Categoria descrittiva"} <ChevronDown size={14} />
          </button>
          {openDoc ? (
            <div className="filter-dropdown">
              <button
                type="button"
                onClick={() => {
                  onChange({ ...value, documentType: "" });
                  setOpenDoc(false);
                }}
              >
                Tutti i tipi
              </button>
              {documentTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    onChange({ ...value, documentType: type });
                    setOpenDoc(false);
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
