import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Tabs, 
  Tab, 
  Alert,
  Container,
  Paper,
  Button,
  Grid,
  Avatar,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  AvatarGroup,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { supabase } from '../lib/supabase';
import { TaskBoard } from '../components/task/TaskBoard';
import { TeamManagementModal } from '../components/project/TeamManagementModal';
import type { Project, ProjectMember } from '../types/project';
import type { User, UserRole } from '../types/auth';
import type { Phase, PhaseStatus } from '../types/phase';
import type { Task } from '../types/task';
import { useAuth } from '../contexts/auth/AuthContext';
import { toast } from 'react-hot-toast';
import { UserPlus, Sparkles, Plus, Check, Info, CheckCircle } from 'lucide-react';
import { ProjectAnalysis } from '../components/project/ProjectAnalysis';
import { ProjectKnowledgebase } from '../components/project/ProjectKnowledgebase';
import { ProjectActivityLogs } from '../components/project/ProjectActivityLogs';
import { PhaseTable } from '../components/phase/PhaseTable';
import { NewPhaseModal } from '../components/phase/NewPhaseModal';
import { suggestPhases } from '../lib/ai/suggest-phases';
import type { PhaseSuggestion } from '../types/phase';
import { format } from 'date-fns';
import { UserAvatar } from '../components/UserAvatar';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`project-tabpanel-${index}`}
      aria-labelledby={`project-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface ProjectMemberWithUser extends ProjectMember {
  id: string;
  user: User;
}

interface ProjectData extends Project {
  owner: User;
  manager: User;
  team_members: ProjectMemberWithUser[];
}

export function ProjectDetailsPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user: currentUser, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [isNewPhaseModalOpen, setIsNewPhaseModalOpen] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [suggestedPhases, setSuggestedPhases] = useState<(PhaseSuggestion & { added: boolean })[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestedPhase, setSelectedSuggestedPhase] = useState<PhaseSuggestion | null>(null);
  const [showTaskSelectionModal, setShowTaskSelectionModal] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [projectProgress, setProjectProgress] = useState(0);
  const [refreshKnowledgebase, setRefreshKnowledgebase] = useState(0);

  const fetchProject = async () => {
    console.log('fetchProject called with:', { projectId, currentUser });
    
    if (!projectId) {
      console.error('No projectId provided');
      setError('Project ID is required');
      setLoading(false);
      return;
    }

    if (!currentUser) {
      console.error('No currentUser available');
      setError('Authentication required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const userRole: UserRole = currentUser.role;
      const isAdmin = userRole === 'admin';
      const isProjectManager = userRole === 'project_manager';
      console.log('Fetching project with access level:', { isAdmin, isProjectManager, userId: currentUser.id });
      
      const query = supabase
        .from('projects')
        .select(`
          *,
          owner:users!projects_owner_id_fkey(
            id,
            email,
            full_name,
            role,
            avatar_url
          ),
          manager:users!projects_manager_id_fkey(
            id,
            email,
            full_name,
            role,
            avatar_url
          ),
          team_members:project_members!project_members_project_id_fkey(
            id,
            user_id,
            role,
            user:users(
              id,
              full_name,
              email,
              role,
              avatar_url,
              department,
              position
            )
          )
        `)
        .eq('id', projectId);

      console.log('Executing query for project:', projectId);
      const { data, error: queryError } = await query.single();

      if (queryError) {
        console.error('Query error:', queryError);
        throw queryError;
      }

      if (!data) {
        console.error('No project data returned');
        throw new Error('Project not found');
      }

      // Check if employee has access to this project
      if (userRole === 'employee') {
        const hasAccess = 
          data.owner_id === currentUser.id ||
          data.manager_id === currentUser.id ||
          data.team_members?.some((member: ProjectMemberWithUser) => member.user_id === currentUser.id);

        if (!hasAccess) {
          throw new Error('access_denied');
        }
      }

      // Log the full project data to debug owner/manager fields
      console.log('Raw project data:', data);

      setProject(data as ProjectData);
    } catch (error: any) {
      console.error('Error in fetchProject:', error);
      let errorMessage = 'Failed to load project details';
      
      if (error.message === 'Project not found') {
        errorMessage = 'Project not found or you don\'t have access';
      } else if (error.message === 'access_denied') {
        errorMessage = 'You do not have permission to view this project';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);

      if (error.message === 'Project not found' || error.message === 'access_denied') {
        setTimeout(() => navigate('/admin/projects'), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPhases = async () => {
    if (!projectId) return;
    
    try {
      setLoadingPhases(true);
      
      // First, fetch the phases without trying to join the creator
      const { data: phasesData, error: phasesError } = await supabase
        .from('project_phases')
        .select(`
          *,
          project:projects(id, name)
        `)
        .eq('project_id', projectId)
        .order('sequence_order', { ascending: true });

      if (phasesError) throw phasesError;
      
      // If phases exist and have creator IDs, fetch the creators separately
      if (phasesData && phasesData.length > 0) {
        // Get unique creator IDs
        const creatorIds = phasesData
          .filter(phase => phase.created_by)
          .map(phase => phase.created_by);
        
        if (creatorIds.length > 0) {
          // Fetch users for these IDs
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, full_name, email')
            .in('id', creatorIds);
            
          if (!usersError && usersData) {
            // Create a map of user ID to user data
            const usersMap: Record<string, { id: string, full_name: string, email: string }> = {};
            usersData.forEach(user => {
              usersMap[user.id] = user;
            });
            
            // Add creator info to each phase
            phasesData.forEach(phase => {
              if (phase.created_by && usersMap[phase.created_by]) {
                phase.creator = usersMap[phase.created_by];
              }
            });
          }
        }
        
        // Fetch task counts for each phase
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('id, phase_id')
          .eq('project_id', projectId)
          .not('phase_id', 'is', null);
        
        if (!tasksError && tasksData) {
          // Count tasks by phase_id
          const taskCountByPhase: Record<string, number> = {};
          tasksData.forEach(task => {
            if (task.phase_id) {
              taskCountByPhase[task.phase_id] = (taskCountByPhase[task.phase_id] || 0) + 1;
            }
          });
          
          // Update phases with task counts
          phasesData.forEach(phase => {
            phase.task_count = taskCountByPhase[phase.id] || 0;
          });
        }
      }
      
      console.log('Fetched phases with task counts:', phasesData);
      setPhases(phasesData || []);
    } catch (error: any) {
      console.error('Error fetching phases:', error);
      toast.error('Error loading phases');
    } finally {
      setLoadingPhases(false);
    }
  };

  const handleUpdatePhase = async (phaseId: string, updates: Partial<Phase>) => {
    try {
      const { error } = await supabase
        .from('project_phases')
        .update(updates)
        .eq('id', phaseId);

      if (error) throw error;
      await fetchPhases();
      toast.success('Phase updated successfully');
    } catch (error: any) {
      console.error('Error updating phase:', error);
      toast.error('Error updating phase');
    }
  };

  const getAISuggestions = async () => {
    try {
      setLoadingSuggestions(true);

      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          description,
          status,
          start_date,
          end_date,
          progress,
          created_at,
          updated_at
        `)
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // First get team members
      const { data: teamMembers, error: teamError } = await supabase
        .from('project_members')
        .select(`
          user_id,
          role,
          joined_at,
          user:users(
            id,
            full_name,
            email,
            position,
            department
          )
        `)
        .eq('project_id', projectId);

      if (teamError) throw teamError;

      // Fetch existing tasks for context
      const { data: existingTasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          status,
          phase_id
        `)
        .eq('project_id', projectId);

      if (tasksError) throw tasksError;
      
      // Fetch project documentation
      const { data: projectDocuments, error: docsError } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (docsError) {
        console.error('Error fetching project documents:', docsError);
        toast.error('Error fetching project documentation');
      }

      // Fetch project FAQs
      const { data: projectFaqs, error: faqsError } = await supabase
        .from('project_faqs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (faqsError) {
        console.error('Error fetching project FAQs:', faqsError);
      }

      // Fetch project resources
      const { data: projectResources, error: resourcesError } = await supabase
        .from('project_resources')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (resourcesError) {
        console.error('Error fetching project resources:', resourcesError);
      }

      // Get AI suggestions using Gemini
      const suggestions = await suggestPhases(
        projectData,
        { 
          team_members: teamMembers,
          documentation: {
            documents: projectDocuments || [],
            faqs: projectFaqs || [],
            resources: projectResources || []
          }
        },
        phases,
        existingTasks || []
      );

      setSuggestedPhases(suggestions.map(suggestion => ({ ...suggestion, added: false })));
      setShowSuggestionsModal(true);
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      toast.error('Failed to get AI suggestions. Please try again.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAddSuggestedPhase = async (phase: PhaseSuggestion) => {
    // Instead of directly adding the phase, show the task selection modal
    setSelectedSuggestedPhase(phase);
    setShowTaskSelectionModal(true);
  };

  const handleAddPhaseWithTasks = async (phase: PhaseSuggestion) => {
    try {
      // Ensure currentUser is not null
      if (!currentUser) {
        toast.error('You must be logged in to add a phase');
        return;
      }
      
      // Create the phase
      const { data, error } = await supabase
        .from('project_phases')
        .insert([
          {
            project_id: projectId,
            name: phase.name,
            description: phase.description,
            status: phase.suggested_status,
            sequence_order: phase.suggested_sequence_order,
            start_date: phase.estimated_start_date,
            end_date: phase.estimated_end_date,
            created_by: currentUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Mark the suggestion as added
      setSuggestedPhases(prevSuggestions =>
        prevSuggestions.map(suggestion =>
          suggestion.name === phase.name
            ? { ...suggestion, added: true }
            : suggestion
        )
      );
      
      // Refresh phases
      await fetchPhases();
      toast.success('Phase added successfully');
      
      // Close the task selection modal
      setShowTaskSelectionModal(false);
    } catch (error) {
      console.error('Error adding phase:', error);
      toast.error('Failed to add phase');
    }
  };

  const fetchTasks = async () => {
    if (!projectId) return;
    
    try {
      setLoadingTasks(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId);
        
      if (error) throw error;
      
      setTasks(data || []);
      
      // Calculate and update project progress
      if (data && data.length > 0) {
        calculateAndUpdateProgress(data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };
  
  const calculateAndUpdateProgress = async (projectTasks: Task[]) => {
    if (!projectId || !projectTasks.length) return;
    
    // Calculate progress based on completed tasks
    const totalTasks = projectTasks.length;
    const completedTasks = projectTasks.filter(task => task.status === 'completed').length;
    
    // Calculate percentage (rounded to nearest integer)
    const progressPercentage = Math.round((completedTasks / totalTasks) * 100);
    
    setProjectProgress(progressPercentage);
    
    // Update project progress in the database
    if (project && project.progress !== progressPercentage) {
      try {
        const { error } = await supabase
          .from('projects')
          .update({ progress: progressPercentage })
          .eq('id', projectId);
          
        if (error) throw error;
        
        // Update local project state with new progress
        setProject(prev => prev ? { ...prev, progress: progressPercentage } : null);
      } catch (error) {
        console.error('Error updating project progress:', error);
      }
    }
  };

  // Function to refresh the knowledgebase
  const handleKnowledgebaseRefresh = () => {
    setRefreshKnowledgebase(prev => prev + 1);
  };

  // Listen for knowledgebase refresh events
  useEffect(() => {
    const handleKnowledgebaseRefreshEvent = () => {
      handleKnowledgebaseRefresh();
    };

    window.addEventListener('knowledgebase-refresh', handleKnowledgebaseRefreshEvent);

    return () => {
      window.removeEventListener('knowledgebase-refresh', handleKnowledgebaseRefreshEvent);
    };
  }, []);

  useEffect(() => {
    console.log('ProjectDetailsPage useEffect triggered:', {
      projectId,
      hasCurrentUser: !!currentUser,
      authLoading
    });

    if (authLoading) {
      console.log('Auth is still loading...');
      return;
    }

    if (!currentUser) {
      console.log('No current user, showing auth required message');
      setError('Authentication required');
      setLoading(false);
      return;
    }

    if (projectId) {
      console.log('Initiating project fetch...');
      fetchProject();
      fetchTasks(); // Fetch tasks to calculate progress
    } else {
      console.log('No projectId available');
      setError('Project ID is required');
      setLoading(false);
    }

    if (projectId && currentUser && tabValue === 3) {
      console.log('Fetching phases for project:', projectId);
      fetchPhases();
    }
  }, [projectId, currentUser, authLoading, tabValue]);

  // Add a listener for task updates to recalculate progress
  useEffect(() => {
    if (!projectId) return;
    
    const tasksSubscription = supabase
      .channel('tasks-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'tasks',
          filter: `project_id=eq.${projectId}`
        }, 
        () => {
          fetchTasks();
        }
      )
      .subscribe();
      
    // Add event listener for custom task-updated event
    const handleTaskUpdated = () => {
      fetchTasks();
    };
    
    window.addEventListener('task-updated', handleTaskUpdated);
      
    return () => {
      supabase.removeChannel(tasksSubscription);
      window.removeEventListener('task-updated', handleTaskUpdated);
    };
  }, [projectId]);

  // Add a listener for phase deletion
  useEffect(() => {
    if (!projectId) return;
    
    // Add event listener for custom phase-deleted event
    const handlePhaseDeleted = () => {
      fetchPhases();
    };
    
    window.addEventListener('phase-deleted', handlePhaseDeleted);
      
    return () => {
      window.removeEventListener('phase-deleted', handlePhaseDeleted);
    };
  }, [projectId]);

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
          <Typography ml={2} color="text.secondary">
            Authenticating...
          </Typography>
        </Box>
      </Container>
    );
  }

  // Show auth error if no user
  if (!currentUser) {
    return (
      <Container maxWidth="lg">
        <Alert severity="warning">
          Please log in to view project details
        </Alert>
      </Container>
    );
  }

  // Show loading state while fetching project
  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
          <Typography ml={2} color="text.secondary">
            Loading project details...
          </Typography>
        </Box>
      </Container>
    );
  }

  // Show error state
  if (error || !project) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error">
          {error || 'Project not found or you don\'t have access'}
        </Alert>
      </Container>
    );
  }

  // Safe to use currentUser here as we've checked it's not null
  const isUserProjectManager = currentUser.role === 'project_manager';
  const canManageTasks = currentUser.role === 'admin' || 
    project.owner_id === currentUser.id || 
    project.manager_id === currentUser.id ||
    project.team_members.some(member => 
      member.user_id === currentUser.id && 
      (member.role as 'member' | 'manager') === 'manager'
    );

  const canManagePhases = canManageTasks;
  const userRole: UserRole = currentUser.role;
  const isAdmin = userRole === 'admin';
  const isProjectManager = userRole === 'project_manager';

  // Add the missing getStatusColor function
  const getStatusColor = (status: PhaseStatus) => {
    switch (status) {
      case 'pending':
        return 'info';
      case 'in_progress':
        return 'warning';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="lg">
      <Paper elevation={3} sx={{ mb: 4, overflow: 'hidden', borderRadius: 2 }}>
        {/* Project Header Section - New Style */}
        <Box sx={{ 
          position: 'relative',
          pt: 4, 
          pb: 3,
          px: 4,
          backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(74, 144, 226, 0.1) 0%, rgba(74, 144, 226, 0) 60%)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)'
        }}>
          {/* Project title and status */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography variant="h4" component="h1" fontWeight="bold">
              {project.name}
            </Typography>
            <Chip 
              label={project.status || 'Not set'}
              color={
                project.status === 'completed' ? 'success' :
                project.status === 'in_progress' ? 'primary' :
                project.status === 'on_hold' ? 'warning' : 'default'
              }
              sx={{ fontWeight: 'medium' }}
            />
          </Box>
          
          {/* Project description */}
          <Typography color="text.secondary" sx={{ mb: 3, maxWidth: '90%' }}>
            {project.description || 'No description provided'}
          </Typography>
          
          {/* Project metadata and progress */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={7}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {/* Team info */}
                <Box>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
                    Owner
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <UserAvatar 
                      user={project.owner} 
                      sx={{ width: 24, height: 24, mr: 1 }}
                      showTooltip={false}
                    />
                    <Typography variant="body2" fontWeight="medium">
                      {project.owner?.full_name || 'Not assigned'}
                    </Typography>
                  </Box>
                </Box>
                
                <Box>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
                    Manager
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <UserAvatar 
                      user={project.manager} 
                      sx={{ width: 24, height: 24, mr: 1 }}
                      showTooltip={false}
                    />
                    <Typography variant="body2" fontWeight="medium">
                      {project.manager?.full_name || 'Not assigned'}
                    </Typography>
                  </Box>
                </Box>
                
                <Box>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
                    Team Size
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="body2">
                      {project.team_members?.length || 0} members
                    </Typography>
                    {project.team_members && project.team_members.length > 0 && (
                      <AvatarGroup max={5} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.75rem' } }}>
                        {project.team_members.map((member) => (
                          <UserAvatar 
                            key={member.id}
                            user={member.user}
                            sx={{ width: 24, height: 24 }}
                            showTooltip={false}
                          />
                        ))}
                      </AvatarGroup>
                    )}
                  </Box>
                </Box>
                
                <Box>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
                    Created
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {project.created_at ? format(new Date(project.created_at), 'MMM dd, yyyy') : 'N/A'}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={5}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Overall Progress
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {project.progress || 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={project.progress || 0}
                  sx={{ 
                    height: 8, 
                    borderRadius: 4,
                    backgroundColor: 'rgba(0,0,0,0.05)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4
                    }
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {tasks.filter(t => t.status === 'completed').length} of {tasks.length} tasks completed
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
        
        <Box sx={{ p: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(event, newValue) => setTabValue(newValue)}>
              <Tab label="Overview" />
              <Tab label="Team" />
              <Tab label="Tasks" />
              <Tab label="Phases" />
              <Tab label="Activity Logs" />
              <Tab label="Analysis" />
              {(currentUser.role === 'admin' || currentUser.role === 'project_manager') && (
                <Tab label="Project Knowledgebase" />
              )}
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Project Information
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={3}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Status
                      </Typography>
                      <Chip
                        label={project.status || 'Not set'}
                        color={
                          project.status === 'completed' ? 'success' :
                          project.status === 'in_progress' ? 'primary' :
                          project.status === 'on_hold' ? 'warning' : 'default'
                        }
                        size="small"
                      />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Progress
                      </Typography>
                      <Box display="flex" alignItems="center" gap={2}>
                        <LinearProgress
                          variant="determinate"
                          value={project.progress || 0}
                          sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="body2" sx={{ minWidth: 45 }}>
                          {project.progress || 0}%
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        {tasks.length} tasks total, {tasks.filter(t => t.status === 'completed').length} completed
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Timeline
                      </Typography>
                      <Box display="flex" gap={3}>
                        <Box flex={1}>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            Start Date
                          </Typography>
                          <Typography variant="body2">
                            {project.start_date ? new Date(project.start_date).toLocaleDateString() : 'Not set'}
                          </Typography>
                        </Box>
                        <Box flex={1}>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            End Date
                          </Typography>
                          <Typography variant="body2">
                            {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'Not set'}
                          </Typography>
                        </Box>
                      </Box>
                      {project.end_date && (
                        <Box mt={2}>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            Time Remaining
                          </Typography>
                          <Box 
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 1,
                              p: 1.5,
                              bgcolor: 'background.default',
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'divider'
                            }}
                          >
                            {(() => {
                              const today = new Date();
                              const endDate = new Date(project.end_date);
                              const diffTime = endDate.getTime() - today.getTime();
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                              
                              let color = 'success.main';
                              let message = '';
                              
                              if (diffDays < 0) {
                                color = 'error.main';
                                message = `${Math.abs(diffDays)} days overdue`;
                              } else if (diffDays === 0) {
                                color = 'warning.main';
                                message = 'Due today';
                              } else if (diffDays <= 7) {
                                color = 'warning.main';
                                message = `${diffDays} days remaining`;
                              } else {
                                message = `${diffDays} days remaining`;
                              }

                              return (
                                <>
                                  <Box
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      bgcolor: color,
                                      flexShrink: 0
                                    }}
                                  />
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      color: color,
                                      fontWeight: 'medium'
                                    }}
                                  >
                                    {message}
                                  </Typography>
                                </>
                              );
                            })()}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Team Overview
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={3}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Project Owner
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <UserAvatar 
                          user={project.owner} 
                          sx={{ width: 32, height: 32 }}
                          showTooltip={false}
                        />
                        <Typography sx={{ 
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {project.owner?.full_name || 'Not assigned'}
                        </Typography>
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Project Manager
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <UserAvatar 
                          user={project.manager} 
                          sx={{ width: 32, height: 32 }}
                          showTooltip={false}
                        />
                        <Typography sx={{ 
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {project.manager?.full_name || 'Not assigned'}
                        </Typography>
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Team Size
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="body2">
                          {project.team_members?.length || 0} members
                        </Typography>
                        {project.team_members && project.team_members.length > 0 && (
                          <AvatarGroup max={5} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.75rem' } }}>
                            {project.team_members.map((member) => (
                              <UserAvatar 
                                key={member.id}
                                user={member.user}
                                sx={{ width: 24, height: 24 }}
                                showTooltip={false}
                              />
                            ))}
                          </AvatarGroup>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6">
                  Team Members ({project.team_members?.length || 0})
                </Typography>
                {canManageTasks && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => setShowTeamModal(true)}
                    startIcon={<UserPlus />}
                  >
                    Manage Team
                  </Button>
                )}
              </Box>
              
              {project.team_members?.length > 0 ? (
                <Paper variant="outlined">
                  <Box sx={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(0, 0, 0, 0.02)' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid rgba(0, 0, 0, 0.12)', width: '250px' }}>Member</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid rgba(0, 0, 0, 0.12)', width: '200px' }}>Email</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid rgba(0, 0, 0, 0.12)', width: '150px' }}>Department</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid rgba(0, 0, 0, 0.12)', width: '150px' }}>Position</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid rgba(0, 0, 0, 0.12)', width: '100px' }}>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.team_members.map((member) => (
                          <tr key={member.id} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
                            <td style={{ padding: '12px 16px', width: '250px' }}>
                              <Box display="flex" alignItems="center" gap={2}>
                                <UserAvatar 
                                  user={member.user} 
                                  sx={{ width: 32, height: 32 }}
                                  showTooltip={false}
                                />
                                <Typography 
                                  variant="body2"
                                  sx={{
                                    maxWidth: '170px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {member.user?.full_name || 'Unknown User'}
                                </Typography>
                              </Box>
                            </td>
                            <td style={{ padding: '12px 16px', width: '200px' }}>
                              <Typography 
                                variant="body2" 
                                color="text.secondary"
                                sx={{
                                  maxWidth: '200px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {member.user?.email}
                              </Typography>
                            </td>
                            <td style={{ padding: '12px 16px', width: '150px' }}>
                              <Typography 
                                variant="body2" 
                                color="text.secondary"
                                sx={{
                                  maxWidth: '150px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {member.user?.department || '-'}
                              </Typography>
                            </td>
                            <td style={{ padding: '12px 16px', width: '150px' }}>
                              <Typography 
                                variant="body2" 
                                color="text.secondary"
                                sx={{
                                  maxWidth: '150px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {member.user?.position || '-'}
                              </Typography>
                            </td>
                            <td style={{ padding: '12px 16px', width: '100px' }}>
                              <Chip 
                                label={member.role} 
                                size="small"
                                color={member.role === 'manager' ? 'primary' : 'default'}
                                sx={{ textTransform: 'capitalize' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                </Paper>
              ) : (
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <Typography color="text.secondary">
                    No team members assigned yet
                  </Typography>
                  {canManageTasks && (
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => setShowTeamModal(true)}
                      startIcon={<UserPlus />}
                      sx={{ mt: 2 }}
                    >
                      Add Team Members
                    </Button>
                  )}
                </Paper>
              )}
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <TaskBoard
              projectId={project.id}
              currentUser={currentUser as User}
              canManageTasks={canManageTasks}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <Box>
              <Box mb={4} display="flex" justifyContent="space-between" alignItems="center">
                <div>
                  <Typography variant="h6" component="h2" gutterBottom>
                    Project Phases
                  </Typography>
                  <Typography color="text.secondary">
                    Manage the phases of your project
                  </Typography>
                </div>
                {canManagePhases && (
                  <Box display="flex" gap={2}>
                    <Button 
                      variant="outlined"
                      color="primary"
                      startIcon={<Sparkles />}
                      onClick={getAISuggestions}
                      disabled={loadingSuggestions}
                    >
                      {loadingSuggestions ? 'Getting Suggestions...' : 'AI Suggestions'}
                    </Button>
                    <Button 
                      variant="contained" 
                      color="primary"
                      startIcon={<Plus />}
                      onClick={() => setIsNewPhaseModalOpen(true)}
                    >
                      New Phase
                    </Button>
                  </Box>
                )}
              </Box>

              {loadingPhases ? (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress />
                </Box>
              ) : phases.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <Typography color="text.secondary" gutterBottom>
                    No phases have been created for this project yet.
                  </Typography>
                  {canManagePhases && (
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => setIsNewPhaseModalOpen(true)}
                      sx={{ mt: 2 }}
                    >
                      Create First Phase
                    </Button>
                  )}
                </Paper>
              ) : (
                <PhaseTable
                  phases={phases}
                  onUpdatePhase={handleUpdatePhase}
                  currentUser={currentUser}
                  canManagePhases={canManagePhases}
                />
              )}
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            <ProjectActivityLogs 
              projectId={project.id}
              canEdit={canManageTasks}
              onActivityAdded={handleKnowledgebaseRefresh}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={5}>
            <ProjectAnalysis projectId={project.id} />
          </TabPanel>

          {(currentUser.role === 'admin' || currentUser.role === 'project_manager') && (
            <TabPanel value={tabValue} index={6}>
              <ProjectKnowledgebase 
                projectId={project.id} 
                canEdit={isAdmin || isProjectManager}
                key={`knowledgebase-${refreshKnowledgebase}`} 
              />
            </TabPanel>
          )}
        </Box>
      </Paper>

      {showTeamModal && (
        <TeamManagementModal
          projectId={project.id}
          onClose={() => setShowTeamModal(false)}
          onUpdate={fetchProject}
        />
      )}

      {isNewPhaseModalOpen && projectId && (
        <NewPhaseModal 
          projectId={projectId}
          currentUser={currentUser}
          onClose={() => setIsNewPhaseModalOpen(false)}
          onCreated={() => {
            fetchPhases();
            setIsNewPhaseModalOpen(false);
          }}
        />
      )}

      {showTaskSelectionModal && selectedSuggestedPhase && (
        <NewPhaseModal 
          projectId={projectId}
          currentUser={currentUser}
          onClose={() => {
            setShowTaskSelectionModal(false);
            setSelectedSuggestedPhase(null);
          }}
          onCreated={() => {
            fetchPhases();
            setShowTaskSelectionModal(false);
            setSelectedSuggestedPhase(null);
            
            // Mark the suggestion as added
            setSuggestedPhases(prevSuggestions =>
              prevSuggestions.map(suggestion =>
                suggestion.name === selectedSuggestedPhase.name
                  ? { ...suggestion, added: true }
                  : suggestion
              )
            );
          }}
          suggestedTasks={selectedSuggestedPhase.suggested_tasks}
          phaseDetails={{
            name: selectedSuggestedPhase.name,
            description: selectedSuggestedPhase.description,
            status: selectedSuggestedPhase.suggested_status,
            sequence_order: selectedSuggestedPhase.suggested_sequence_order,
            startDate: selectedSuggestedPhase.estimated_start_date || '',
            endDate: selectedSuggestedPhase.estimated_end_date || ''
          }}
        />
      )}

      <Dialog
        open={showSuggestionsModal}
        onClose={() => setShowSuggestionsModal(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '80vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Sparkles size={20} />
          <Typography variant="h6" component="span">
            AI Phase Suggestions
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {suggestedPhases.length === 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography color="text.secondary">
                Generating phase suggestions...
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                AI is analyzing project documentation and requirements to create tailored phase suggestions
              </Typography>
            </Box>
          ) : suggestedPhases.length === 1 && suggestedPhases[0].name === "No New Phases Suggested" ? (
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <Info size={48} color="#1976d2" style={{ marginBottom: '16px' }} />
              <Typography variant="h6" gutterBottom>
                {suggestedPhases[0].name}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', maxWidth: '80%', mb: 3 }}>
                {suggestedPhases[0].description}
              </Typography>
              <List sx={{ width: '100%', maxWidth: 500 }}>
                {suggestedPhases[0].suggested_tasks.map((task, index) => (
                  <ListItem key={index} sx={{ py: 0.5 }}>
                    <ListItemIcon>
                      <CheckCircle size={20} color="#1976d2" />
                    </ListItemIcon>
                    <ListItemText primary={task} />
                  </ListItem>
                ))}
              </List>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => setShowSuggestionsModal(false)}
                sx={{ mt: 3 }}
              >
                Close
              </Button>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {suggestedPhases.map((suggestion, index) => (
                <ListItem
                  key={index}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    mb: 2,
                    p: 2.5,
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    bgcolor: suggestion.added ? 'action.selected' : 'background.paper',
                    '&:hover': {
                      bgcolor: suggestion.added ? 'action.selected' : 'action.hover',
                    },
                    transition: 'background-color 0.2s',
                  }}
                >
                  <Box width="100%" display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box flex={1} pr={2}>
                      <Typography variant="h6" gutterBottom>
                        {suggestion.name}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ 
                          whiteSpace: 'pre-wrap',
                          mb: 2
                        }}
                      >
                        {suggestion.description}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleAddSuggestedPhase(suggestion)}
                      startIcon={suggestion.added ? <Check size={16} /> : <Plus size={16} />}
                      disabled={suggestion.added}
                      sx={{ 
                        minWidth: 100,
                        boxShadow: 'none',
                        bgcolor: suggestion.added ? 'success.main' : 'primary.main',
                        '&:hover': {
                          bgcolor: suggestion.added ? 'success.dark' : 'primary.dark',
                          boxShadow: 'none'
                        }
                      }}
                    >
                      {suggestion.added ? 'Added' : 'Add Phase'}
                    </Button>
                  </Box>
                  
                  <Box 
                    display="flex" 
                    flexDirection="column"
                    gap={1.5}
                    width="100%"
                  >
                    <Box display="flex" gap={2}>
                      <Chip
                        label={`Status: ${suggestion.suggested_status}`}
                        color={getStatusColor(suggestion.suggested_status)}
                        size="small"
                      />
                      <Chip
                        label={`Sequence: ${suggestion.suggested_sequence_order}`}
                        size="small"
                        variant="outlined"
                      />
                      {suggestion.estimated_start_date && suggestion.estimated_end_date && (
                        <Chip
                          label={`${format(new Date(suggestion.estimated_start_date), 'MMM d, yyyy')} - ${format(new Date(suggestion.estimated_end_date), 'MMM d, yyyy')}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                    
                    {suggestion.suggested_tasks && suggestion.suggested_tasks.length > 0 && (
                      <Box mt={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          Suggested Tasks:
                        </Typography>
                        <List disablePadding dense>
                          {suggestion.suggested_tasks.map((task, taskIndex) => (
                            <ListItem key={taskIndex} disablePadding sx={{ py: 0.5 }}>
                              <Typography variant="body2" sx={{ 
                                display: 'flex', 
                                alignItems: 'center',
                                '&:before': {
                                  content: '"•"',
                                  marginRight: 1,
                                  color: 'primary.main'
                                }
                              }}>
                                {task}
                              </Typography>
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSuggestionsModal(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
} 