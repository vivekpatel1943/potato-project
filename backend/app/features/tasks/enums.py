from enum import Enum


class TaskStatus(str, Enum):
    OPEN = "open"                   # Created, accepting applications
    ASSIGNED = "assigned"           # Customer approved a worker
    IN_PROGRESS = "in_progress"     # Worker started the job
    COMPLETED = "completed"         # Job done
    CANCELLED = "cancelled"         # Customer cancelled
    EXPIRED = "expired"             # scheduled_at has passed with no assignment


class ApplicationStatus(str, Enum):
    PENDING = "pending"             # Worker applied, waiting for customer
    APPROVED = "approved"           # Customer selected this worker
    REJECTED = "rejected"           # Customer explicitly rejected this worker
    NOT_SELECTED = "not_selected"   # Another worker was approved; this one was auto-dismissed
    WITHDRAWN = "withdrawn"         # Worker withdrew their own application
    CANCELLED = "cancelled"         # Worker cancelled AFTER being approved
