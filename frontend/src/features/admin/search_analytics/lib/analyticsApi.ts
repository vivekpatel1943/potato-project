import api from "../../../../shared/lib/api";

export interface SearchLog {
  id: string;
  query: string;
  results_count: number;
  selected_subcategory_id: string | null;
  selected_service: string | null;
  user_name: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface AggregatedSearch {
  query: string;
  total_searches: number;
  zero_result_searches: number;
  conversions: number;
  last_searched_at: string;
}

export interface LocationCell {
  cell_lat: number;
  cell_lng: number;
  total_searches: number;
  zero_result_searches: number;
  top_query: string | null;
}

export type CellFilter = { cell_lat: number; cell_lng: number } | null;

const base = "/admin/analytics/searches";

export const analyticsApi = {
  getFeed: (cell: CellFilter = null) =>
    api.get<SearchLog[]>(`${base}/feed`, { params: cell ?? {} }).then((r) => r.data),

  getAggregated: (cell: CellFilter = null) =>
    api.get<AggregatedSearch[]>(`${base}/aggregated`, { params: cell ?? {} }).then((r) => r.data),

  getLocations: () => api.get<LocationCell[]>(`${base}/locations`).then((r) => r.data),
};

/** Google Maps link for a coordinate pair (no external API calls from our side). */
export const mapsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export const formatCoords = (lat: number, lng: number, digits = 3) =>
  `${lat.toFixed(digits)}, ${lng.toFixed(digits)}`;
