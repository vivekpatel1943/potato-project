import { useCallback, useEffect, useState } from "react";
import {
  analyticsApi,
  formatCoords,
  mapsUrl,
  type AggregatedSearch,
  type CellFilter,
  type LocationCell,
  type SearchLog,
} from "../lib/analyticsApi";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const th = "text-left px-4 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wider";
const thRight = `${th} text-right`;

function MapLink({ lat, lng, digits = 3 }: { lat: number; lng: number; digits?: number }) {
  return (
    <a
      href={mapsUrl(lat, lng)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-primary hover:underline font-mono text-xs"
    >
      📍 {formatCoords(lat, lng, digits)}
    </a>
  );
}

function SectionCard({
  title,
  subtitle,
  tone = "default",
  children,
}: {
  title: string;
  subtitle?: string;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <section
      className={`bg-surface border rounded-2xl shadow-sm overflow-hidden ${
        tone === "danger" ? "border-rose-200" : "border-border"
      }`}
    >
      <div className="px-5 pt-5 pb-3">
        <h2 className={`text-lg font-bold ${tone === "danger" ? "text-rose-700" : "text-text"}`}>{title}</h2>
        {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-sm text-text-secondary">
        {text}
      </td>
    </tr>
  );
}

export default function SearchAnalyticsPage() {
  const [cell, setCell] = useState<CellFilter>(null);
  const [feed, setFeed] = useState<SearchLog[]>([]);
  const [aggregated, setAggregated] = useState<AggregatedSearch[]>([]);
  const [locations, setLocations] = useState<LocationCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Locations are global (not filtered by cell)
  const loadLocations = useCallback(async () => {
    setLocations(await analyticsApi.getLocations());
  }, []);

  const loadFiltered = useCallback(async (c: CellFilter) => {
    const [f, a] = await Promise.all([analyticsApi.getFeed(c), analyticsApi.getAggregated(c)]);
    setFeed(f);
    setAggregated(a);
  }, []);

  useEffect(() => {
    Promise.all([loadLocations(), loadFiltered(null)]).finally(() => setLoading(false));
  }, [loadLocations, loadFiltered]);

  const selectCell = async (c: CellFilter) => {
    setCell(c);
    setRefreshing(true);
    try {
      await loadFiltered(c);
    } finally {
      setRefreshing(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadLocations(), loadFiltered(cell)]);
    } finally {
      setRefreshing(false);
    }
  };

  const missed = aggregated
    .filter((a) => a.zero_result_searches > 0)
    .sort((a, b) => b.zero_result_searches - a.zero_result_searches);

  const top = aggregated.filter((a) => a.zero_result_searches < a.total_searches);

  const isSelected = (l: LocationCell) =>
    cell !== null && cell.cell_lat === l.cell_lat && cell.cell_lng === l.cell_lng;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="h-8 w-56 bg-surface border border-border rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-surface border border-border rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-[600px] bg-surface border border-border rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Search Analytics</h1>
          <p className="mt-1 text-text-secondary">What customers are looking for, and where.</p>
        </div>
        <button
          id="analytics-refresh-btn"
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface text-sm font-medium text-text
            hover:border-primary hover:text-primary transition-colors disabled:opacity-60 cursor-pointer"
        >
          <span className={refreshing ? "animate-spin" : ""}>↻</span>
          Refresh
        </button>
      </div>

      {/* Active cell filter */}
      {cell && (
        <div className="mb-6 flex items-center gap-3 animate-slide-up">
          <span className="text-sm text-text-secondary">Filtered to area:</span>
          <span className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-full bg-primary-ghost border border-primary-light text-sm">
            <MapLink lat={cell.cell_lat} lng={cell.cell_lng} digits={2} />
            <button
              id="analytics-clear-cell-btn"
              type="button"
              onClick={() => selectCell(null)}
              aria-label="Clear area filter"
              className="w-6 h-6 rounded-full hover:bg-surface text-text-secondary hover:text-text transition-colors cursor-pointer"
            >
              ✕
            </button>
          </span>
        </div>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity ${refreshing ? "opacity-60" : ""}`}>
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Missed opportunities */}
          <SectionCard
            title="⚠️ Missed Opportunities"
            subtitle="Searches that returned zero results: demand we can't serve yet."
            tone="danger"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border bg-bg/50">
                    <th className={th}>Search query</th>
                    <th className={thRight}>Zero-result</th>
                    <th className={`${thRight} hidden sm:table-cell`}>Last searched</th>
                  </tr>
                </thead>
                <tbody>
                  {missed.length === 0 ? (
                    <EmptyRow cols={3} text="None. Every search found something 🎉" />
                  ) : (
                    missed.map((m) => (
                      <tr key={m.query} className="border-b border-border last:border-0 hover:bg-rose-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-text">“{m.query}”</td>
                        <td className="px-4 py-3 text-right font-bold text-rose-600">{m.zero_result_searches}</td>
                        <td className="px-4 py-3 text-right text-xs text-text-secondary hidden sm:table-cell">
                          {timeAgo(m.last_searched_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Demand hotspots */}
          <SectionCard
            title="📍 Demand Hotspots"
            subtitle="Searches grouped into ~1 km areas. Click a row to filter everything to that area."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border bg-bg/50">
                    <th className={th}>Area</th>
                    <th className={th}>Top query</th>
                    <th className={thRight}>Searches</th>
                    <th className={thRight}>Zero-result</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.length === 0 ? (
                    <EmptyRow cols={4} text="No searches with location yet." />
                  ) : (
                    locations.map((l) => {
                      const zeroShare = l.zero_result_searches / l.total_searches;
                      return (
                        <tr
                          key={`${l.cell_lat},${l.cell_lng}`}
                          id={`hotspot-${l.cell_lat}-${l.cell_lng}`}
                          onClick={() => selectCell(isSelected(l) ? null : { cell_lat: l.cell_lat, cell_lng: l.cell_lng })}
                          className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                            isSelected(l)
                              ? "bg-primary-ghost"
                              : zeroShare >= 0.5
                                ? "bg-rose-50/40 hover:bg-rose-50"
                                : "hover:bg-primary-ghost/30"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <MapLink lat={l.cell_lat} lng={l.cell_lng} digits={2} />
                          </td>
                          <td className="px-4 py-3 text-text">{l.top_query ? `“${l.top_query}”` : "—"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-text">{l.total_searches}</td>
                          <td
                            className={`px-4 py-3 text-right font-semibold ${
                              l.zero_result_searches > 0 ? "text-rose-600" : "text-text-secondary"
                            }`}
                          >
                            {l.zero_result_searches}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Top searches */}
          <SectionCard title="🔥 Top Searches" subtitle="Most frequent queries and how often they led to a pick.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border bg-bg/50">
                    <th className={th}>Search query</th>
                    <th className={thRight}>Volume</th>
                    <th className={thRight}>Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {top.length === 0 ? (
                    <EmptyRow cols={3} text="No successful searches yet." />
                  ) : (
                    top.map((t) => {
                      const pct = Math.round((t.conversions / t.total_searches) * 100);
                      return (
                        <tr key={t.query} className="border-b border-border last:border-0 hover:bg-primary-ghost/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-text">“{t.query}”</td>
                          <td className="px-4 py-3 text-right text-text-secondary">{t.total_searches}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden sm:block w-20 h-1.5 rounded-full bg-bg overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="w-10 text-right font-semibold text-emerald-600">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* Right column: live feed */}
        <aside className="bg-surface border border-border rounded-2xl shadow-sm h-fit lg:sticky lg:top-4 max-h-[calc(100vh-2rem)] flex flex-col">
          <div className="px-5 pt-5 pb-3 border-b border-border">
            <h2 className="text-lg font-bold text-text flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Recent Searches
            </h2>
          </div>
          <div className="overflow-y-auto p-3 space-y-2">
            {feed.length === 0 ? (
              <p className="py-10 text-center text-sm text-text-secondary">No searches yet.</p>
            ) : (
              feed.map((log, i) => (
                <div
                  key={log.id}
                  style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                  className="animate-slide-up p-3 rounded-xl border border-border hover:border-primary-light hover:bg-primary-ghost/20 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold text-text break-words">“{log.query}”</span>
                    <span
                      className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        log.results_count > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {log.results_count} result{log.results_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  {log.selected_service && (
                    <p className="mt-1 text-xs text-emerald-700">→ picked {log.selected_service}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                    <span>👤 {log.user_name ?? "Guest"}</span>
                    {log.latitude != null && log.longitude != null ? (
                      <MapLink lat={log.latitude} lng={log.longitude} />
                    ) : (
                      <span className="opacity-70">No location</span>
                    )}
                    <span className="ml-auto">{timeAgo(log.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
