import { useCallback, useEffect, useId, useRef, useState } from "react";
import api from "../../../shared/lib/api";
import { taskApi } from "../lib/taskApi";
import { sendSearchLog } from "../lib/searchLogApi";
import { warmSearchLocation } from "../../../shared/lib/searchLocation";
import { useAuthStore } from "../../auth/stores/authStore";
import type { ServiceSearchResult } from "../schemas/taskSchemas";

interface Props {
  onSelect: (service: ServiceSearchResult) => void;
  variant?: "hero" | "compact";
  autoFocus?: boolean;
  showPopular?: boolean;
}

interface CategoryWithSubs {
  id: string;
  name: string;
  subcategories: { id: string; name: string; description: string | null; keywords?: string[] }[];
}

const CATEGORY_EMOJI: [RegExp, string][] = [
  [/cook|food|chef|kitchen|bak/i, "🍳"],
  [/clean|maid|wash/i, "🧹"],
  [/repair|plumb|electric|fix|carpent|mechanic/i, "🔧"],
  [/beauty|salon|hair|makeup|spa/i, "💅"],
  [/tutor|teach|lesson|class/i, "📚"],
  [/garden|plant/i, "🌿"],
  [/paint/i, "🎨"],
  [/move|pack|deliver|driver/i, "📦"],
  [/pet|dog/i, "🐾"],
  [/tech|computer|it\b|phone/i, "💻"],
  [/photo|video/i, "📷"],
  [/fitness|yoga|train/i, "🧘"],
];

export function emojiFor(name: string): string {
  return CATEGORY_EMOJI.find(([re]) => re.test(name))?.[1] ?? "✨";
}

export default function ServiceSearch({ onSelect, variant = "hero", autoFocus, showPopular = true }: Props) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ServiceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [popular, setPopular] = useState<ServiceSearchResult[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  // ── Search analytics: one log per search *session*, never per keystroke ──
  const isLoggedIn = useAuthStore((s) => !!s.accessToken);
  // Latest settled search that hasn't been logged yet
  const pending = useRef<{ query: string; results_count: number } | null>(null);

  const flushLog = useCallback((selectedId: string | null = null) => {
    if (!pending.current) return;
    sendSearchLog({ ...pending.current, selected_subcategory_id: selectedId });
    pending.current = null;
  }, []);

  // Popular chips — first subcategory of a handful of categories
  useEffect(() => {
    if (!showPopular) return;
    api
      .get<CategoryWithSubs[]>("/categories/")
      .then(({ data }) => {
        const picks: ServiceSearchResult[] = [];
        for (const cat of data) {
          for (const sub of cat.subcategories.slice(0, 2)) {
            picks.push({
              id: sub.id,
              name: sub.name,
              description: sub.description,
              keywords: sub.keywords ?? [],
              category_id: cat.id,
              category_name: cat.name,
            });
          }
          if (picks.length >= 8) break;
        }
        setPopular(picks.slice(0, 8));
      })
      .catch(() => {});
  }, [showPopular]);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      flushLog(); // user cleared the box => close the session
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      taskApi
        .searchServices(q, ctrl.signal)
        .then((r) => {
          setResults(r);
          setActive(0);
          setOpen(true);
          pending.current = { query: q, results_count: r.length }; // overwrite, don't send
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, flushLog]);

  // Flush the pending log on tab hide / page close / unmount
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushLog();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flushLog();
    };
  }, [flushLog]);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        flushLog(); // abandoned search
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [flushLog]);

  const choose = (s: ServiceSearchResult, fromResults = true) => {
    // Conversion: record what they picked. Popular chips aren't search results,
    // so any pending search is logged as abandoned.
    flushLog(fromResults ? s.id : null);
    setOpen(false);
    setQuery("");
    onSelect(s);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      flushLog();
    }
  };

  const matchedKeyword = (s: ServiceSearchResult) => {
    const q = query.trim().toLowerCase();
    if (!q || s.name.toLowerCase().includes(q)) return null;
    return s.keywords.find((k) => k.toLowerCase().includes(q)) ?? null;
  };

  const isHero = variant === "hero";

  return (
    <div ref={boxRef} className="relative">
      <div
        className={`flex items-center gap-3 bg-surface border-2 rounded-2xl transition-all duration-200
          ${open && query ? "border-primary shadow-lg shadow-primary/10" : "border-border hover:border-primary-light focus-within:border-primary focus-within:shadow-lg focus-within:shadow-primary/10"}
          ${isHero ? "px-5 py-4" : "px-4 py-3"}`}
      >
        <svg className={`${isHero ? "w-6 h-6" : "w-5 h-5"} text-text-secondary shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          id="service-search-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            warmSearchLocation(isLoggedIn); // background, never awaited
            if (results.length) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={isHero ? "Try “biryani”, “leaking tap”, “deep cleaning”…" : "Search for a service…"}
          className={`flex-1 bg-transparent outline-none text-text placeholder:text-text-secondary/70 ${isHero ? "text-lg" : "text-base"}`}
        />
        {loading && <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
      </div>

      {open && query.trim() && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-2 w-full bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-[fadeIn_150ms_ease-out] max-h-80 overflow-y-auto"
        >
          {results.length === 0 && !loading ? (
            <li className="px-5 py-6 text-sm text-text-secondary text-center">
              No services match “{query}”. Try a different word.
            </li>
          ) : (
            results.map((s, i) => {
              const kw = matchedKeyword(s);
              return (
                <li
                  key={s.id}
                  id={`service-option-${s.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(s);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${i === active ? "bg-primary-ghost" : ""}`}
                >
                  <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-ghost to-primary-light/60 flex items-center justify-center text-xl shrink-0">
                    {emojiFor(`${s.name} ${s.category_name}`)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text truncate">{s.name}</p>
                    <p className="text-xs text-text-secondary truncate">
                      {s.category_name}
                      {kw && <span className="ml-1.5 text-primary">· matches “{kw}”</span>}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </li>
              );
            })
          )}
        </ul>
      )}

      {showPopular && popular.length > 0 && (
        <div className={`${isHero ? "mt-5" : "mt-3"}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2.5">Popular</p>
          <div className="flex flex-wrap gap-2">
            {popular.map((p) => (
              <button
                key={p.id}
                id={`popular-${p.id}`}
                type="button"
                onClick={() => choose(p, false)}
                className="group inline-flex items-center gap-1.5 px-3.5 py-2 bg-surface border border-border rounded-full text-sm font-medium text-text
                  hover:border-primary hover:text-primary hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer"
              >
                <span className="transition-transform group-hover:scale-110">{emojiFor(`${p.name} ${p.category_name}`)}</span>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
