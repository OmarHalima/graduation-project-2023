import type { User } from './auth';

export type ActivityType = 'task_completed' | 'decision' | 'note' | 'phase_completed';

export interface ActivityLog {
  id: string;
  project_id: string;
  user_id: string;
  activity_type: ActivityType;
  title: string;
  description: string;
  related_entity_id: string | null;
  related_entity_type: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  user?: User;
} 