import { useState, useEffect } from 'react';
import { 
  fetchRecentActivities, 
  fetchProjectStatus, 
  Activity, 
  Project 
} from '../services/dashboardService';

export interface DashboardData {
  activities: Activity[];
  projects: Project[];
  isLoadingActivities: boolean;
  isLoadingProjects: boolean;
  error: Error | null;
  refreshData: () => Promise<void>;
}

export function useDashboardData(): DashboardData {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      setIsLoadingActivities(true);
      setIsLoadingProjects(true);
      
      const activitiesData = await fetchRecentActivities();
      setActivities(activitiesData);
      setIsLoadingActivities(false);
      
      const projectsData = await fetchProjectStatus();
      setProjects(projectsData);
      setIsLoadingProjects(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError(error as Error);
      setIsLoadingActivities(false);
      setIsLoadingProjects(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return {
    activities,
    projects,
    isLoadingActivities,
    isLoadingProjects,
    error,
    refreshData: loadData
  };
} 