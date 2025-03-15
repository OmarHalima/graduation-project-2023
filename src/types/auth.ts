export type UserRole = 'admin' | 'project_manager' | 'employee';
export type UserStatus = 'active' | 'inactive' | 'pending';

export interface User {
  id: string;
  auth_id?: string; // Optional auth_id for linking to Supabase Auth
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  position?: string;
  avatar_url?: string;
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface AuthState {
  user: User | null;
  session: any | null;
  loading: boolean;
}