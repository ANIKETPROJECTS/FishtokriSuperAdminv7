import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { getConfig, saveConfig, type Config } from "../api";

type FormState = {
  market_handling_cost: string;
  fixed_cost: string;
  packaging_cost: string;
  delivery_cost: string;
};

function parseNumberOrNull(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toForm(cfg: Config): FormState {
  return {
    market_handling_cost: String(cfg.market_handling_cost),
    fixed_cost: String(cfg.fixed_cost),
    packaging_cost: String(cfg.packaging_cost),
    delivery_cost: String(cfg.delivery_cost)
  };
}

export function ConfigPage() {
  const [form, setForm] = useState<FormState>({
    market_handling_cost: "0",
    fixed_cost: "0",
    packaging_cost: "0",
    delivery_cost: "0"
  });
  const [loaded, setLoaded] = useState<Config | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const validationError = useMemo(() => {
    const fields: Array<[keyof FormState, string]> = [
      ["market_handling_cost", "Market Handling Cost"],
      ["fixed_cost", "Fixed Cost"],
      ["packaging_cost", "Packaging Cost"],
      ["delivery_cost", "Delivery Cost"]
    ];

    for (const [key, label] of fields) {
      const v = parseNumberOrNull(form[key]);
      if (v === null) return `Enter ${label} (₹/g).`;
      if (v < 0) return `${label} must be ≥ 0.`;
    }
    return null;
  }, [form]);

  async function onLoad(opts?: { quiet?: boolean }) {
    setError(null);
    if (!opts?.quiet) setMessage(null);
    setLoading(true);
    try {
      const cfg = await getConfig();
      setForm(toForm(cfg));
      setLoaded(cfg);
      setIsEditing(false);
      if (!opts?.quiet) setMessage("Config loaded.");
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        setError(
          (e.response?.data as any)?.detail || e.message || "Failed to load config."
        );
      } else {
        setError("Failed to load config.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Auto-load actual backend config when this page opens.
    void onLoad({ quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave() {
    setError(null);
    setMessage(null);

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload: Config = {
      market_handling_cost: Number(form.market_handling_cost),
      fixed_cost: Number(form.fixed_cost),
      packaging_cost: Number(form.packaging_cost),
      delivery_cost: Number(form.delivery_cost)
    };

    setSaving(true);
    try {
      const saved = await saveConfig(payload);
      setLoaded(saved);
      setIsEditing(false);
      setMessage("Config saved.");
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        setError(
          (e.response?.data as any)?.detail || e.message || "Failed to save config."
        );
      } else {
        setError("Failed to save config.");
      }
    } finally {
      setSaving(false);
    }
  }

  function onEdit() {
    setError(null);
    setMessage(null);
    setIsEditing(true);
  }

  function onCancel() {
    setError(null);
    setMessage(null);
    if (loaded) setForm(toForm(loaded));
    setIsEditing(false);
  }

  return (
    <div className="card">
      <h2 className="card__title">Configuration</h2>
      <p className="muted">
        All costs are stored as <b>₹ per gram (₹/g)</b>.
      </p>

      <div className="grid">
        <label className="field">
          <span className="field__label">Market Handling Cost (₹/g)</span>
          <input
            className="input"
            inputMode="decimal"
            value={form.market_handling_cost}
            onChange={(e) => setForm((f) => ({ ...f, market_handling_cost: e.target.value }))}
            disabled={!isEditing || loading || saving}
          />
        </label>

        <label className="field">
          <span className="field__label">Fixed Cost (₹/g)</span>
          <input
            className="input"
            inputMode="decimal"
            value={form.fixed_cost}
            onChange={(e) => setForm((f) => ({ ...f, fixed_cost: e.target.value }))}
            disabled={!isEditing || loading || saving}
          />
        </label>

        <label className="field">
          <span className="field__label">Packaging Cost (₹/g)</span>
          <input
            className="input"
            inputMode="decimal"
            value={form.packaging_cost}
            onChange={(e) => setForm((f) => ({ ...f, packaging_cost: e.target.value }))}
            disabled={!isEditing || loading || saving}
          />
        </label>

        <label className="field">
          <span className="field__label">Delivery Cost (₹/g)</span>
          <input
            className="input"
            inputMode="decimal"
            value={form.delivery_cost}
            onChange={(e) => setForm((f) => ({ ...f, delivery_cost: e.target.value }))}
            disabled={!isEditing || loading || saving}
          />
        </label>
      </div>

      <div className="row">
        {!isEditing ? (
          <button className="button" type="button" onClick={onEdit} disabled={loading || saving}>
            Edit
          </button>
        ) : (
          <>
            <button
              className="button"
              type="button"
              onClick={onSave}
              disabled={saving || loading || !!validationError}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button className="button button--secondary" type="button" onClick={onCancel} disabled={loading || saving}>
              Cancel
            </button>
          </>
        )}

        <button className="button button--secondary" type="button" onClick={() => onLoad()} disabled={loading || saving}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>

        {validationError && !error ? (
          <span className="hint">Tip: {validationError}</span>
        ) : null}
      </div>

      {error ? <div className="alert alert--error">{error}</div> : null}
      {message ? <div className="alert alert--success">{message}</div> : null}
    </div>
  );
}


