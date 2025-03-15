import type { User } from './auth';

export interface ProjectFormData {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: ProjectStatus;
  owner_id: string | null;
  manager_id: string | null;
  budget: number | null;
  progress: number;
}

export interface ProjectMember {
  user_id: string;
  project_id: string;
  role: 'member' | 'manager';
  user: User;
  created_at: string;
  updated_at: string;
}

export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' | 'active' | 'archived';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  start_date: string;
  end_date?: string;
  owner_id: string | null;
  manager_id: string | null;
  budget: number | null;
  progress: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  team_members?: ProjectMember[];
}

export interface ProjectActivity {
  id: string;
  project_id: string;
  user_id: string;
  type: 'task_created' | 'task_updated' | 'task_completed' | 'member_added' | 'member_removed' | 'comment_added' | 'status_changed';
  description: string;
  created_at: string;
  user?: {
    full_name: string;
  };
} 