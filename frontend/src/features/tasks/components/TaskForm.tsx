import { useMemo, useState } from "react";
import LocationPicker, { type PickedLocation } from "./LocationPicker";
import { toLocalInputValue, type TaskCreatePayload } from "../schemas/taskSchemas";

export type TaskFormValues = Omit<TaskCreatePayload, "subcategory_id">;

interface Props {
  initial?: Partial<TaskFormValues>;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: TaskFormValues) => void;
  onCancel?: () => void;
}

const BUDGET_PRESETS = [300, 500, 800, 1200, 2000];

function quickTimes() {
  const now = new Date();
  const at = (dayOffset: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const opts = [
    { label: "This evening", date: at(0, 19) },
    { label: "Tomorrow morning", date: at(1, 9) },
    { label: "Tomorrow evening", date: at(1, 19) },
    { label: "This weekend", date: at(((6 - now.getDay() + 7) % 7) || 7, 11) },
  ];
  return opts.filter((o) => o.date.getTime() > now.getTime() + 30 * 60 * 1000);
}

const labelCls = "block text-sm font-semibold text-text mb-1.5";
const inputCls =
  "w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text placeholder:text-text-secondary/70 focus:border-primary focus:outline-none transition-colors";

export default function TaskForm({ initial, submitLabel, submitting, onSubmit, onCancel }: Props) {
  const [description, setDescription] = useState(initial?.description ?? "");
  const [scheduled, setScheduled] = useState(initial?.scheduled_at ? toLocalInputValue(initial.scheduled_at) : "");
  const [location, setLocation] = useState<PickedLocation | null>(
    initial?.latitude != null && initial?.longitude != null
      ? { latitude: initial.latitude, longitude: initial.longitude }
      : null
  );
  const [address, setAddress] = useState(initial?.address ?? "");
  const [budget, setBudget] = useState(initial?.budget != null ? String(initial.budget) : "");
  const [requirements, setRequirements] = useState(initial?.specific_requirements ?? "");
  const [touched, setTouched] = useState(false);

  const minDate = useMemo(() => toLocalInputValue(new Date(Date.now() + 15 * 60 * 1000)), []);
  const quick = useMemo(quickTimes, []);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (description.trim().length < 5) e.description = "Describe the task in a few words (min 5 characters).";
    if (!scheduled) e.scheduled = "Pick a date and time.";
    else if (new Date(scheduled).getTime() <= Date.now()) e.scheduled = "Time must be in the future.";
    if (!location) e.location = "Pin the task location.";
    const b = parseFloat(budget);
    if (!budget || isNaN(b) || b <= 0) e.budget = "Budget is required.";
    return e;
  }, [description, scheduled, location, budget]);

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) return;
    onSubmit({
      description: description.trim(),
      scheduled_at: new Date(scheduled).toISOString(),
      latitude: location!.latitude,
      longitude: location!.longitude,
      address: address.trim() || null,
      budget: Math.round(parseFloat(budget) * 100) / 100,
      specific_requirements: requirements.trim() || null,
    });
  };

  const err = (k: string) =>
    touched && errors[k] ? <p className="text-xs text-error mt-1.5">{errors[k]}</p> : null;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {/* Description */}
      <div>
        <label htmlFor="task-description" className={labelCls}>What do you need done?</label>
        <textarea
          id="task-description"
          rows={3}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Need chicken biryani cooked for 6 people"
          className={`${inputCls} resize-none`}
        />
        {err("description")}
      </div>

      {/* When */}
      <div>
        <label htmlFor="task-scheduled-at" className={labelCls}>When?</label>
        {quick.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5">
            {quick.map((q) => {
              const v = toLocalInputValue(q.date);
              const selected = v === scheduled;
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setScheduled(v)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-150 cursor-pointer ${
                    selected
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-surface text-text-secondary border-border hover:border-primary hover:text-primary"
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
        )}
        <input
          id="task-scheduled-at"
          type="datetime-local"
          min={minDate}
          value={scheduled}
          onChange={(e) => setScheduled(e.target.value)}
          className={inputCls}
        />
        {err("scheduled")}
      </div>

      {/* Where */}
      <div>
        <span className={labelCls}>Where?</span>
        <LocationPicker value={location} onChange={setLocation} address={address} onAddressChange={setAddress} />
        {err("location")}
      </div>

      {/* Budget */}
      <div>
        <label htmlFor="task-budget" className={labelCls}>Your budget</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-text-secondary">₹</span>
          <input
            id="task-budget"
            type="number"
            inputMode="decimal"
            min={1}
            step="1"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="600"
            className={`${inputCls} pl-9 text-lg font-semibold`}
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-2.5">
          {BUDGET_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setBudget(String(p))}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-150 cursor-pointer ${
                budget === String(p)
                  ? "bg-text text-white border-text"
                  : "bg-surface text-text-secondary border-border hover:border-text hover:text-text"
              }`}
            >
              ₹{p.toLocaleString("en-IN")}
            </button>
          ))}
        </div>
        {err("budget")}
      </div>

      {/* Requirements */}
      <div>
        <label htmlFor="task-requirements" className={labelCls}>
          Anything specific? <span className="font-normal text-text-secondary">(optional)</span>
        </label>
        <textarea
          id="task-requirements"
          rows={2}
          maxLength={2000}
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          placeholder="e.g. Please bring your own ingredients"
          className={`${inputCls} resize-none`}
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="sm:flex-none px-6 py-3.5 border border-border rounded-xl text-sm font-semibold text-text-secondary hover:bg-bg transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          id="task-form-submit"
          type="submit"
          disabled={submitting}
          className="flex-1 px-6 py-3.5 bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-bold rounded-xl
            shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0
            transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {submitting ? "Please wait…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
