import { supabase } from '../lib/supabase';
import { LucideIcon, Users, FileText, CheckCircle, AlertTriangle, MessageSquare, Clock } from 'lucide-react';

export interface Activity {
  id: string;
  icon: LucideIcon;
  message: string;
  time: string;
  color: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
  };
}

export interface Project {
  id: string;
  name: string;
  progress: number;
  status: string;
  total_tasks: number;
  completed_tasks: number;
}

interface TaskWithUser {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  users: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

// Function to fetch recent activities based on tasks and projects
export async function fetchRecentActivities(): Promise<Activity[]> {
  try {
    // First try to get activities from project_activities or activities table
    const { data: taskActivities, error: taskError } = await supabase
      .from('tasks')
      .select(`
        id, 
        title, 
        status, 
        created_at, 
        updated_at,
        users:assigned_to(id, full_name, avatar_url)
      `)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (taskError) throw taskError;

    // Transform the data into the Activity format
    const activities: Activity[] = (taskActivities || []).map((task: any) => {
      let icon: LucideIcon = FileText;
      let color = 'primary.main';
      let message = '';
      
      if (task.status === 'completed') {
        icon = CheckCircle;
        color = 'success.main';
        message = `Task "${task.title}" was completed`;
      } else if (task.status === 'in_progress') {
        icon = Clock;
        color = 'warning.main';
        message = `Task "${task.title}" is in progress`;
      } else {
        message = `New task "${task.title}" was created`;
      }

      // Calculate the time difference
      const timeAgo = getTimeAgo(new Date(task.updated_at || task.created_at));

      return {
        id: task.id,
        icon,
        message,
        time: timeAgo,
        color,
        user: task.users
      };
    });

    return activities;
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return [];
  }
}

// Function to fetch project status
export async function fetchProjectStatus(): Promise<Project[]> {
  try {
    // Direct query to projects and tasks tables since get_project_progress RPC doesn't exist
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id, name, status, progress');

    if (projectError) throw projectError;

    // For each project, get the task counts
    const projectsWithProgress = await Promise.all((projectData || []).map(async (project) => {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('project_id', project.id);

      if (taskError) throw taskError;

      const totalTasks = taskData?.length || 0;
      const completedTasks = taskData?.filter(task => task.status === 'completed').length || 0;
      
      // Calculate progress based on completed tasks
      const calculatedProgress = totalTasks > 0 
        ? Math.round((completedTasks / totalTasks) * 100) 
        : 0;

      return {
        id: project.id,
        name: project.name,
        status: project.status,
        progress: project.progress || calculatedProgress,
        total_tasks: totalTasks,
        completed_tasks: completedTasks
      };
    }));

    return projectsWithProgress;
  } catch (error) {
    console.error('Error fetching project status:', error);
    return [];
  }
}

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  const diffHours = Math.round(diffMins / 60);
  const diffDays = Math.round(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }
} 