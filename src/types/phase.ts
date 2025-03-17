import type { User } from './auth';
import type { Task } from './task';

export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Phase {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  status: PhaseStatus;
  sequence_order: number;
  start_date?: string | null;
  end_date?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  creator?: {
    id: string;
    full_name: string;
    email: string;
  };
  task_count?: number;
}

export interface PhaseSuggestion {
  name: string;
  description: string;
  suggested_status: PhaseStatus;
  suggested_sequence_order: number;
  estimated_start_date: string | null;
  estimated_end_date: string | null;
  suggested_tasks: string[];
  added?: boolean;
} 