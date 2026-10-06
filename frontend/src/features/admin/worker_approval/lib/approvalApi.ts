import api from "../../../../shared/lib/api";

export interface PendingWorker {
  user_id: string;
  user_name: string;
  email: string;
  phone: string | null;
  avatar_url: string;
  verification_status: string;
  created_at: string;
}

export interface DocumentDetail {
  id: string;
  document_type: string;
  document_url: string;
  document_number: string | null;
  preview_url: string | null;
}

export interface ProofDetail {
  id: string;
  proof_type: string;
  url: string;
  preview_url: string | null;
  title: string | null;
  description: string | null;
}

export interface CapabilityDetail {
  id: string;
  subcategory_id: string;
  subcategory_name: string | null;
  proofs: ProofDetail[];
}

export interface WorkerFullDetail {
  user_id: string;
  user_name: string;
  email: string;
  phone: string | null;
  avatar_url: string;
  verification_status: string;
  verified_by: string | null;
  is_available: boolean;
  created_at: string;
  verification_documents: DocumentDetail[];
  capabilities: CapabilityDetail[];
}

export interface ApprovalResult {
  user_id: string;
  verification_status: string;
  message: string;
}

export const approvalApi = {
  listPending: () =>
    api.get<PendingWorker[]>("/admin/workers/pending").then((r) => r.data),

  getDetail: (workerId: string) =>
    api.get<WorkerFullDetail>(`/admin/workers/${workerId}`).then((r) => r.data),

  approve: (workerId: string) =>
    api.post<ApprovalResult>(`/admin/workers/${workerId}/approve`).then((r) => r.data),

  reject: (workerId: string, reason?: string) =>
    api.post<ApprovalResult>(`/admin/workers/${workerId}/reject`, { reason }).then((r) => r.data),
};
