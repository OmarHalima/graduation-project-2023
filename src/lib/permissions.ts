import type { User } from '../types/auth';

export const isAdmin = (user: User) => user.role === 'admin';
export const isProjectManager = (user: User) => user.role === 'project_manager';
export const isEmployee = (user: User) => user.role === 'employee';

export const canManageUsers = (user: User) => {
  return isAdmin(user) || isProjectManager(user);
};

export const canManageAdmins = (user: User) => {
  return isAdmin(user);
};

export const canDeleteProjects = (user: User) => {
  return isAdmin(user);
};

export const canManageProjects = (user: User) => {
  return isAdmin(user) || isProjectManager(user);
};

export const canCreateProjects = (user: User) => {
  return isAdmin(user) || isProjectManager(user);
};

export const canManageTasks = (user: User, taskAssignedTo?: string | null) => {
  if (isAdmin(user) || isProjectManager(user)) return true;
  if (isEmployee(user) && taskAssignedTo === user.id) return true;
  return false;
};

export const canViewAnalytics = (user: User) => {
  return isAdmin(user) || isProjectManager(user);
};

export const canAccessSettings = (user: User) => {
  return isAdmin(user) || isProjectManager(user);
}; 