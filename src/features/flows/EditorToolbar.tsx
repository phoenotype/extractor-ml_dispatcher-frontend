import {
  ArrowLeft,
  Moon,
  Play,
  Redo2,
  Save,
  ShieldCheck,
  Sun,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useThemeContext } from "@/components/theme/ThemeProvider";

interface EditorToolbarProps {
  flowName: string;
  isActive: boolean;
  dirty: boolean;
  legacy: boolean;
  busy?: string | null;
  canEdit: boolean;
  canValidate: boolean;
  canSimulate: boolean;
  canRun: boolean;
  canUndo: boolean;
  canRedo: boolean;
  categoryLabel?: string;
  triggerStatusLine?: string | null;
  triggerTypesLine?: string | null;
  onBack: () => void;
  onRename: (value: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onValidate: () => void;
  onSimulate: () => void;
  onSave: () => void;
  onRun: () => void;
  onCategoryChange?: (value: string) => void;
}

export function EditorToolbar({
  flowName,
  isActive,
  dirty,
  legacy,
  busy,
  canEdit,
  canValidate,
  canSimulate,
  canRun,
  canUndo,
  canRedo,
  categoryLabel = "",
  triggerStatusLine,
  triggerTypesLine,
  onBack,
  onRename,
  onUndo,
  onRedo,
  onValidate,
  onSimulate,
  onSave,
  onRun,
  onCategoryChange,
}: EditorToolbarProps) {
  const { theme, toggleTheme } = useThemeContext();

  return (
    <header className="editor-header-stack">
      <div className="editor-header">
        <button
          type="button"
          className="icon-button"
          aria-label="Torna ai flussi"
          onClick={onBack}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="editor-title">
          <input
            value={flowName}
            disabled={legacy || !canEdit}
            onChange={(event) => onRename(event.target.value)}
          />
          <span className={isActive ? "on" : "off"}>
            {isActive ? "Attivo" : "Inattivo"}
          </span>
          {dirty ? <small>Modifiche non salvate</small> : null}
          {legacy ? <strong>Legacy — sola lettura</strong> : null}
        </div>
        <div className="editor-actions">
          <button
            type="button"
            className="icon-button"
            title={theme === "dark" ? "Tema chiaro" : "Tema scuro"}
            aria-label={theme === "dark" ? "Tema chiaro" : "Tema scuro"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            type="button"
            className="icon-button"
            title="Annulla"
            onClick={onUndo}
            disabled={!canUndo || legacy || !canEdit}
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            title="Ripristina"
            onClick={onRedo}
            disabled={!canRedo || legacy || !canEdit}
          >
            <Redo2 size={17} />
          </button>
          <Button
            onClick={onValidate}
            disabled={legacy || !canValidate || !!busy}
          >
            <ShieldCheck size={16} />{" "}
            {busy === "validate" ? "Validazione…" : "Valida"}
          </Button>
          <Button
            variant="primary"
            onClick={onSimulate}
            disabled={legacy || !canSimulate || !!busy}
          >
            <Play size={16} /> Simula
          </Button>
          <Button
            onClick={onSave}
            disabled={legacy || !canEdit || !!busy}
          >
            <Save size={16} /> {busy === "save" ? "Salvataggio…" : "Salva"}
          </Button>
          <Button onClick={onRun} disabled={!canRun || !!busy}>
            <Play size={16} /> Esegui
          </Button>
        </div>
      </div>
      {!legacy ? (
        <div className="flow-criteria-bar">
          <div className="criteria-block">
            <small>Filtro operativo del trigger</small>
            <b>{triggerStatusLine || "Stati: —"}</b>
            <b>{triggerTypesLine || "Tipi: Tutti"}</b>
          </div>
          <label className="criteria-category">
            <small>Categoria descrittiva</small>
            <input
              value={categoryLabel}
              disabled={!canEdit}
              placeholder="Solo classificazione del flusso"
              onChange={(event) => onCategoryChange?.(event.target.value)}
              title="Non influenza il motore: i filtri operativi sono nel nodo trigger"
            />
          </label>
        </div>
      ) : null}
    </header>
  );
}
