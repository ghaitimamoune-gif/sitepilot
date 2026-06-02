// ============================================================
// SITEPILOT — Types TypeScript
// ============================================================

export type ObsStatus = 'open' | 'progress' | 'corrected' | 'validated'
export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type TaskStatus = 'pending' | 'in_progress' | 'done'
export type DocType = 'plan' | 'doe' | 'contract' | 'report' | 'photo'
export type IntervenantType = 'Entreprise générale' | 'Sous-traitant' | 'Architecte' | "Maître d'ouvrage" | "Bureau d'études" | 'MOE'

// ---- Profiles ----
export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'chef_projet' | 'conducteur' | 'intervenant' | 'viewer'
  created_at: string
}

// ---- Projects ----
export interface Project {
  id: string
  name: string
  address: string
  description: string | null
  phase: string
  start_date: string | null
  end_date: string | null
  progress: number
  owner_id: string
  created_at: string
  updated_at: string
}

// ---- Intervenants ----
export interface Intervenant {
  id: string
  project_id: string
  name: string
  type: IntervenantType
  contact: string | null
  email: string | null
  phone: string | null
  color: string
  created_at: string
}

// ---- Plans ----
export interface Plan {
  id: string
  project_id: string
  name: string
  zone: string
  file_url: string | null
  thumb_url: string | null
  file_size: string | null
  version: string
  uploaded_by: string | null
  uploaded_at: string
}

// ---- Observations ----
export interface Observation {
  id: string
  project_id: string
  plan_id: string | null
  title: string
  description: string | null
  priority: Priority
  status: ObsStatus
  zone: string | null
  pos_x: number | null
  pos_y: number | null
  intervenant_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Relations
  intervenant?: Intervenant
  plan?: Plan
  photos?: ObsPhoto[]
  comments?: ObsComment[]
  history?: ObsHistory[]
}

export interface ObsPhoto {
  id: string
  observation_id: string
  url: string
  caption: string | null
  uploaded_at: string
}

export interface ObsComment {
  id: string
  observation_id: string
  author_name: string
  author_id: string | null
  content: string
  created_at: string
}

export interface ObsHistory {
  id: string
  observation_id: string
  action: string
  by_name: string
  note: string | null
  created_at: string
}

// ---- Reserves ----
export interface Reserve {
  id: string
  project_id: string
  title: string
  description: string | null
  status: ObsStatus
  priority: Priority
  zone: string | null
  plan_id: string | null
  intervenant_id: string | null
  created_at: string
  // Relations
  intervenant?: Intervenant
  photos?: ReservePhoto[]
}

export interface ReservePhoto {
  id: string
  reserve_id: string
  url: string
  uploaded_at: string
}

// ---- Tasks ----
export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  priority: Priority
  status: TaskStatus
  assignee_id: string | null
  due_date: string | null
  obs_id: string | null
  reserve_id: string | null
  phase: string | null
  created_at: string
  // Relations
  assignee?: Intervenant
  observation?: Observation
}

// ---- Documents ----
export interface Document {
  id: string
  project_id: string
  name: string
  type: DocType
  file_url: string | null
  file_size: string | null
  version: string
  uploader_name: string | null
  uploaded_at: string
}

// ---- Checklists ----
export interface Checklist {
  id: string
  project_id: string
  name: string
  assigned_to: string | null
  created_at: string
  items: ChecklistItem[]
  // Relations
  assignee?: Intervenant
}

export interface ChecklistItem {
  id: string
  checklist_id: string
  text: string
  done: boolean
  order_index: number
}

// ---- Notifications ----
export interface Notification {
  id: string
  project_id: string
  user_id: string
  type: 'obs' | 'reserve' | 'task' | 'correction' | 'validation'
  title: string
  message: string
  entity_id: string | null
  is_read: boolean
  created_at: string
}

// ---- Config ----
export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critique', color: '#E84040', bg: 'rgba(232,64,64,0.12)' },
  high:     { label: 'Élevée',   color: '#F07040', bg: 'rgba(240,112,64,0.12)' },
  medium:   { label: 'Moyenne',  color: '#F5A623', bg: 'rgba(245,166,35,0.10)' },
  low:      { label: 'Basse',    color: '#3D8EF0', bg: 'rgba(61,142,240,0.10)' },
}

export const OBS_STATUS_CONFIG: Record<ObsStatus, { label: string; color: string }> = {
  open:      { label: 'Ouverte',   color: '#E84040' },
  progress:  { label: 'En cours',  color: '#F5A623' },
  corrected: { label: 'Corrigée',  color: '#3D8EF0' },
  validated: { label: 'Validée',   color: '#2EC972' },
}

export const PHASES = [
  'Fondations', 'Gros œuvre', 'Second œuvre',
  'Menuiseries', 'Finitions', 'Réception',
]

export const INTERVENANT_TYPES: IntervenantType[] = [
  'Entreprise générale', 'Sous-traitant', 'Architecte',
  "Maître d'ouvrage", "Bureau d'études", 'MOE',
]
