import type { User } from '../types/auth';
import type { Task } from '../types/task';

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

// New function to check if user can update task status specifically
export const canUpdateTaskStatus = (user: User, task: Task) => {
  // Admins and project managers can update any task status
  if (isAdmin(user) || isProjectManager(user)) return true;
  
  // Employees can only update status of tasks assigned to them
  if (isEmployee(user) && task.assigned_to === user.id) return true;
  
  return false;
};

// New function to check if user can edit all task fields
export const canEditTask = (user: User, task: Task) => {
  // Only admins and project managers can edit all task fields
  return isAdmin(user) || isProjectManager(user);
};

export const canViewAnalytics = (user: User) => {
  return isAdmin(user) || isProjectManager(user);
};

export const canAccessSettings = (user: User) => {
  return isAdmin(user) || isProjectManager(user);
}; 