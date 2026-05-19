import { useEffect, useMemo, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { nextRenewalDateKey } from "../lib/db/dates";
import { insertItem } from "../lib/db/items";
import { detectTags } from "../lib/tags/keywordTagger";
import {
  CUSTOM_CATEGORY_ID,
  SUBSCRIPTION_CATALOG,
  SUBSCRIPTION_CADENCE_OPTIONS,
  amountForCadence,
  formatSubscriptionAmount,
  getServiceDefaults,
  type SubscriptionCategory,
  type SubscriptionCadence,
} from "../lib/subscriptions/catalog";
import type { Item } from "../lib/db/types";

type Step = "categories" | "services" | "custom" | "details";

interface AddSubscriptionPickerProps {
  onClose: () => void;
  onCreated: (item: Item) => void;
  onToast: (message: string, kind: "success" | "error") => void;
}

function PickerHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="rounded px-2 py-1 text-[11px] text-pds-muted hover:text-pds-text"
        >
          ← Back
        </button>
      )}
      <h3 className="min-w-0 flex-1 text-xs font-medium text-pds-text">
        {title}
      </h3>
      <button
        type="button"
        onClick={onClose}
        className="rounded px-2 py-1 text-[11px] text-pds-muted hover:text-pds-text"
      >
        Close
      </button>
    </div>
  );
}

function defaultCadenceForService(serviceName: string): SubscriptionCadence {
  return getServiceDefaults(serviceName)?.cadence ?? "monthly";
}

function estimatedAmountForService(
  serviceName: string,
  cadence: SubscriptionCadence,
): number | null {
  const defaults = getServiceDefaults(serviceName);
  if (!defaults) return null;
  const baseCadence = defaults.cadence ?? "monthly";
  return amountForCadence(defaults.amount, baseCadence, cadence);
}

function formatCadenceLabel(cadence: SubscriptionCadence): string {
  return (
    SUBSCRIPTION_CADENCE_OPTIONS.find((o) => o.value === cadence)?.label ??
    cadence
  );
}

export function AddSubscriptionPicker({
  onClose,
  onCreated,
  onToast,
}: AddSubscriptionPickerProps) {
  const [step, setStep] = useState<Step>("categories");
  const [category, setCategory] = useState<SubscriptionCategory | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [customName, setCustomName] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<SubscriptionCadence>("monthly");
  const [amountTouched, setAmountTouched] = useState(false);
  const [dateTouched, setDateTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const catalogDefaults = useMemo(
    () => (serviceName ? getServiceDefaults(serviceName) : undefined),
    [serviceName],
  );

  const estimatedRenewalDate = useMemo(
    () => nextRenewalDateKey(cadence),
    [cadence],
  );

  const estimatedAmount = useMemo(() => {
    if (!serviceName) return null;
    return estimatedAmountForService(serviceName, cadence);
  }, [serviceName, cadence]);

  useEffect(() => {
    if (step !== "details" || !serviceName) return;
    const baseCadence = defaultCadenceForService(serviceName);
    setCadence(baseCadence);
    setAmountTouched(false);
    setDateTouched(false);
    const est = estimatedAmountForService(serviceName, baseCadence);
    setAmount(est != null ? formatSubscriptionAmount(est) : "");
    setRenewalDate(nextRenewalDateKey(baseCadence));
  }, [step, serviceName]);

  useEffect(() => {
    if (step !== "details" || !serviceName || dateTouched) return;
    setRenewalDate(estimatedRenewalDate);
  }, [step, serviceName, estimatedRenewalDate, dateTouched]);

  useEffect(() => {
    if (step !== "details" || !serviceName || amountTouched) return;
    if (estimatedAmount != null) {
      setAmount(formatSubscriptionAmount(estimatedAmount));
    }
  }, [step, serviceName, estimatedAmount, amountTouched]);

  function resetDetailsFields() {
    setRenewalDate("");
    setAmount("");
    setCadence("monthly");
    setAmountTouched(false);
    setDateTouched(false);
    setNotes("");
  }

  function selectCategory(cat: SubscriptionCategory) {
    setCategory(cat);
    setServiceName("");
    resetDetailsFields();
    setStep("services");
  }

  function selectService(name: string) {
    setServiceName(name);
    setStep("details");
  }

  function openCustom() {
    setCategory(null);
    setServiceName("");
    setCustomName("");
    resetDetailsFields();
    setStep("custom");
  }

  function confirmCustom() {
    const name = customName.trim();
    if (!name) {
      onToast("Enter a subscription name.", "error");
      return;
    }
    setServiceName(name);
    setCadence("monthly");
    setAmount("");
    setRenewalDate(nextRenewalDateKey("monthly"));
    setAmountTouched(false);
    setDateTouched(false);
    setStep("details");
  }

  function goBack() {
    if (step === "details") {
      setStep(category ? "services" : "custom");
      return;
    }
    if (step === "services" || step === "custom") {
      setCategory(null);
      setServiceName("");
      setStep("categories");
    }
  }

  function handleCadenceChange(next: SubscriptionCadence) {
    setCadence(next);
    if (!dateTouched) {
      setRenewalDate(nextRenewalDateKey(next));
    }
    if (!amountTouched && serviceName) {
      const est = estimatedAmountForService(serviceName, next);
      if (est != null) setAmount(formatSubscriptionAmount(est));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const name = serviceName.trim();
    if (!name) {
      onToast("Subscription name is required.", "error");
      return;
    }

    const finalCadence = cadence;
    const finalDate =
      renewalDate.trim() || nextRenewalDateKey(finalCadence);
    let finalAmount = amount.trim();
    if (!finalAmount && estimatedAmount != null) {
      finalAmount = formatSubscriptionAmount(estimatedAmount);
    }

    setSaving(true);
    try {
      const categoryId = category?.id ?? CUSTOM_CATEGORY_ID;
      const tags = [
        ...new Set([
          "#subscription",
          `#sub-${categoryId}`,
          ...detectTags(name),
        ]),
      ].slice(0, 8);

      const saved = await insertItem({
        type: "subscription",
        content: name,
        tags,
        source: "subscription-picker",
        metadata: {
          renewal_date: finalDate,
          amount: finalAmount || null,
          cadence: finalCadence,
          status: "active",
          category: categoryId,
          service: name,
          notes: notes.trim() || null,
        },
      });

      await emit("item:saved", {});
      onCreated(saved);
      onToast(`Added ${name}.`, "success");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onToast(message || "Failed to add subscription", "error");
    } finally {
      setSaving(false);
    }
  }

  const headerTitle =
    step === "categories"
      ? "Add subscription"
      : step === "services"
        ? (category?.label ?? "Services")
        : step === "custom"
          ? "Custom subscription"
          : "Confirm details";

  return (
    <div className="border-b border-pds-border bg-pds-panel-2/60 px-4 py-3">
      <PickerHeader
        title={headerTitle}
        onBack={step !== "categories" ? goBack : undefined}
        onClose={onClose}
      />

      {step === "categories" && (
        <div className="mt-3">
          <p className="mb-2 text-[11px] text-pds-muted">
            Choose a category, then pick a service.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {SUBSCRIPTION_CATALOG.map((cat) => (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => selectCategory(cat)}
                  className="flex w-full items-center justify-between rounded-lg border border-pds-border bg-pds-panel px-3 py-2.5 text-left text-sm text-pds-text transition hover:border-emerald-500/50 hover:bg-emerald-950/20"
                >
                  <span>{cat.label}</span>
                  <span className="text-[10px] text-pds-subtle">
                    {cat.services.length}
                  </span>
                </button>
              </li>
            ))}
            <li className="sm:col-span-2">
              <button
                type="button"
                onClick={openCustom}
                className="flex w-full items-center justify-between rounded-lg border border-dashed border-pds-border bg-pds-panel/80 px-3 py-2.5 text-left text-sm text-pds-text transition hover:border-emerald-500/50 hover:bg-emerald-950/20"
              >
                <span>Custom subscription</span>
                <span className="text-[10px] text-pds-muted">Type your own</span>
              </button>
            </li>
          </ul>
        </div>
      )}

      {step === "services" && category && (
        <div className="mt-3">
          <p className="mb-2 text-[11px] text-pds-muted">
            Select a service in {category.label.toLowerCase()}.
          </p>
          <ul className="max-h-64 overflow-y-auto rounded-lg border border-pds-border bg-pds-panel">
            {category.services.map((name) => (
              <li
                key={name}
                className="border-b border-pds-border/60 last:border-0"
              >
                <button
                  type="button"
                  onClick={() => selectService(name)}
                  className="w-full px-3 py-2 text-left text-sm text-pds-text hover:bg-emerald-950/25"
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === "custom" && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Subscription name…"
            disabled={saving}
            autoFocus
            className="min-w-0 flex-1 rounded border border-pds-border bg-pds-panel px-3 py-2 text-sm text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmCustom();
              }
            }}
          />
          <button
            type="button"
            disabled={saving || !customName.trim()}
            onClick={confirmCustom}
            className="pds-btn-primary shrink-0 px-4 py-2 text-xs disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}

      {step === "details" && (
        <form onSubmit={(e) => void handleSave(e)} className="mt-3 space-y-3">
          <div>
            <p className="text-sm font-medium text-pds-text">{serviceName}</p>
            <p className="text-[11px] text-pds-muted">
              {category ? category.label : "Custom"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-[11px] text-pds-muted">
              Renewal
              <input
                type="date"
                value={renewalDate}
                onChange={(e) => {
                  setDateTouched(true);
                  setRenewalDate(e.target.value);
                }}
                disabled={saving}
                className="mt-1 block rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-sm text-pds-text"
              />
            </label>
            <label className="text-[11px] text-pds-muted">
              Amount (USD)
              <input
                value={amount}
                onChange={(e) => {
                  setAmountTouched(true);
                  setAmount(e.target.value);
                }}
                placeholder="9.99"
                disabled={saving}
                className="mt-1 block w-28 rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-sm text-pds-text"
              />
            </label>
            <label className="text-[11px] text-pds-muted">
              Recurrence
              <select
                value={cadence}
                onChange={(e) =>
                  handleCadenceChange(e.target.value as SubscriptionCadence)
                }
                disabled={saving}
                className="mt-1 block w-36 rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-sm text-pds-text"
              >
                {SUBSCRIPTION_CADENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-[11px] text-pds-muted">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={saving}
              placeholder="Cancel after next month…"
              className="mt-1 w-full resize-y rounded border border-pds-border bg-pds-panel px-2 py-1.5 text-sm text-pds-text placeholder:text-pds-subtle focus:border-pds-muted focus:outline-none"
            />
          </label>
          <p className="text-[11px] text-pds-subtle">
            Estimated next renewal:{" "}
            <span className="text-pds-muted">{estimatedRenewalDate}</span>
            {estimatedAmount != null && (
              <>
                {" "}
                · Estimated cost:{" "}
                <span className="text-pds-muted">
                  ${formatSubscriptionAmount(estimatedAmount)}/
                  {formatCadenceLabel(cadence).toLowerCase()}
                </span>
              </>
            )}
            {!catalogDefaults && (
              <span className="text-pds-subtle">
                {" "}
                (no catalog price — enter amount manually)
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="pds-btn-primary px-4 py-2 text-xs disabled:opacity-40"
            >
              {saving ? "Adding…" : "Add subscription"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded border border-pds-border px-3 py-2 text-xs text-pds-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
