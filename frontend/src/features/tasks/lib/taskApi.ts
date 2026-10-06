import api from "../../../shared/lib/api";
import type {
  Application,
  MyApplication,
  ServiceSearchResult,
  Task,
  TaskCreatePayload,
  TaskUpdatePayload,
} from "../schemas/taskSchemas";

export const taskApi = {
  searchServices: (q: string, signal?: AbortSignal) =>
    api.get<ServiceSearchResult[]>("/categories/search", { params: { q }, signal }).then((r) => r.data),

  // Customer
  create: (payload: TaskCreatePayload) => api.post<Task>("/tasks", payload).then((r) => r.data),
  mine: () => api.get<Task[]>("/tasks/mine").then((r) => r.data),
  get: (id: string) => api.get<Task>(`/tasks/${id}`).then((r) => r.data),
  update: (id: string, payload: TaskUpdatePayload) =>
    api.patch<Task>(`/tasks/${id}`, payload).then((r) => r.data),
  cancel: (id: string) => api.post<Task>(`/tasks/${id}/cancel`).then((r) => r.data),
  reopenNotify: (id: string) =>
    api.post<{ task: Task; notified_workers: number }>(`/tasks/${id}/reopen-notify`).then((r) => r.data),
  applications: (id: string) => api.get<Application[]>(`/tasks/${id}/applications`).then((r) => r.data),
  approve: (taskId: string, appId: string) =>
    api.post<Task>(`/tasks/${taskId}/approve/${appId}`).then((r) => r.data),
  reject: (taskId: string, appId: string) => api.post(`/tasks/${taskId}/reject/${appId}`),

  // Worker
  available: () => api.get<Task[]>("/tasks/available").then((r) => r.data),
  myApplications: () => api.get<MyApplication[]>("/tasks/applications/mine").then((r) => r.data),
  apply: (id: string, body: { message?: string | null; proposed_budget?: number | null }) =>
    api.post<Task>(`/tasks/${id}/apply`, body).then((r) => r.data),
  withdraw: (id: string) => api.post<Task>(`/tasks/${id}/withdraw`).then((r) => r.data),
  cancelAssignment: (id: string) => api.post<Task>(`/tasks/${id}/cancel-assignment`).then((r) => r.data),
};
