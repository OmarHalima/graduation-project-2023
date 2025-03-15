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
  LinearProgress
} from '@mui/material';
import { supabase } from '../lib/supabase';
import { TaskBoard } from '../components/task/TaskBoard';
import { TeamManagementModal } from '../components/project/TeamManagementModal';
import type { Project, ProjectMember } from '../types/project';
import type { User, UserRole } from '../types/auth';
import { useAuth } from '../contexts/auth/AuthContext';
import { toast } from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import { ProjectAnalysis } from '../components/project/ProjectAnalysis';
import { ProjectKnowledgebase } from '../components/project/ProjectKnowledgebase';

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
  const [error, setError] = useState<string | null>(null);

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
    } else {
      console.log('No projectId available');
      setError('Project ID is required');
      setLoading(false);
    }
  }, [projectId, currentUser, authLoading]);

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

  const userRole: UserRole = currentUser.role;
  const isAdmin = userRole === 'admin';
  const isProjectManager = userRole === 'project_manager';

  return (
    <Container maxWidth="lg">
      <Paper>
        <Box p={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                {project.name}
              </Typography>
              <Typography color="text.secondary" paragraph>
                {project.description || 'No description provided'}
              </Typography>
              <Box display="flex" gap={2}>
                <Typography variant="body2" color="text.secondary">
                  Owner: {project.owner?.full_name || 'Not assigned'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manager: {project.manager?.full_name || 'Not assigned'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Team Members: {project.team_members?.length || 0}
                </Typography>
              </Box>
            </Box>
            <Box>
              {(canManageTasks || isProjectManager) && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setShowTeamModal(true)}
                  sx={{ mr: 2 }}
                >
                  Manage Team
                </Button>
              )}
            </Box>
          </Box>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(event, newValue) => setTabValue(newValue)}>
              <Tab label="Overview" />
              <Tab label="Team" />
              <Tab label="Tasks" />
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
                        {project.owner?.avatar_url ? (
                          <Avatar 
                            src={project.owner.avatar_url} 
                            sx={{ width: 32, height: 32 }} 
                          />
                        ) : (
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {project.owner?.full_name?.[0]}
                          </Avatar>
                        )}
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
                        {project.manager?.avatar_url ? (
                          <Avatar 
                            src={project.manager.avatar_url} 
                            sx={{ width: 32, height: 32 }} 
                          />
                        ) : (
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {project.manager?.full_name?.[0]}
                          </Avatar>
                        )}
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
                      <Typography variant="body2">
                        {project.team_members?.length || 0} members
                      </Typography>
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
                                {member.user?.avatar_url ? (
                                  <Avatar 
                                    src={member.user.avatar_url} 
                                    alt={member.user?.full_name}
                                    sx={{ width: 32, height: 32 }}
                                  />
                                ) : (
                                  <Avatar sx={{ width: 32, height: 32 }}>
                                    {member.user?.full_name?.[0]}
                                  </Avatar>
                                )}
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
            <ProjectAnalysis projectId={project.id} />
          </TabPanel>

          {(currentUser.role === 'admin' || currentUser.role === 'project_manager') && (
            <TabPanel value={tabValue} index={4}>
              <ProjectKnowledgebase 
                projectId={project.id} 
                canEdit={isAdmin || isProjectManager} 
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
    </Container>
  );
} 