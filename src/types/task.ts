import type { User } from './auth';
import type { Phase } from './phase';

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  estimated_hours: number | null;
  created_at: string;
  updated_at: string;
  phase_id: string | null;
  assignee?: {
    id: string;
    full_name: string;
    email: string;
  };
  creator?: {
    id: string;
    full_name: string;
    email: string;
  };
  phase?: Phase;
  ai_insights?: {
    risk_assessment?: string;
  };
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: User;
}

export interface TaskActivity {
  id: string;
  task_id: string;
  user_id: string;
  description: string;
  created_at: string;
  user?: {
    full_name: string;
  };
}

export interface TaskDependency {
  dependent_task_id: string;
  dependency_task_id: string;
  created_at: string;
}

export interface TaskSuggestion {
  id?: string;
  title: string;
  description: string;
  priority: TaskPriority;
  estimated_hours: number;
  suggested_assignee: string | null;
  suggested_phase?: string;
  suggested_due_date?: string;
  status?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
  assigned_to?: string | null;
  rationale?: string;
  added?: boolean;
} 