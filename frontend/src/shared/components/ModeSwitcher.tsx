import { useNavigate } from "react-router-dom";
import { useAppStore, type AppMode } from "../../features/app/stores/appStore";

export default function ModeSwitcher() {
  const navigate = useNavigate();
  const { mode, setMode, hasWorkerProfile } = useAppStore();

  if (!hasWorkerProfile) {
    return (
      <button
        id="become-worker-btn"
        onClick={() => navigate("/become-worker")}
        className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg
          border-2 border-primary text-primary
          hover:bg-primary hover:text-white
          transition-all duration-200 cursor-pointer whitespace-nowrap"
      >
        Become a Worker
      </button>
    );
  }

  const options: { value: AppMode; label: string }[] = [
    { value: "customer", label: "Customer" },
    { value: "worker", label: "Worker" },
  ];

  return (
    <div className="flex bg-bg rounded-lg p-0.5 border border-border">
      {options.map((opt) => (
        <button
          key={opt.value}
          id={`mode-${opt.value}-btn`}
          onClick={() => setMode(opt.value)}
          className={`px-3 py-1 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 cursor-pointer
            ${
              mode === opt.value
                ? "bg-primary text-white shadow-sm"
                : "text-text-secondary hover:text-text"
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
