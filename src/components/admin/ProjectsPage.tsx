import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Filter, Search, X, SlidersHorizontal, Grid as GridIcon, List, Archive, RefreshCw } from 'lucide-react';
import { supabase, debugSession } from '../../lib/supabase';
import type { Project, ProjectStatus, ProjectFormData, ProjectMember } from '../../types/project';
import type { User } from '../../types/auth';
import { useAuth } from '../../contexts/auth/AuthContext';
import { ProjectCard } from '../project/ProjectCard';
import { NewProjectModal } from '../project/NewProjectModal';
import { DeleteProjectModal } from '../project/DeleteProjectModal';
import { toast } from 'react-hot-toast';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Chip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  Fade,
  Card,
  Collapse,
  Switch,
  FormControlLabel,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';

type SortField = 'name' | 'status' | 'start_date' | 'created_at';
type SortDirection = 'asc' | 'desc';
type ViewType = 'active' | 'archived';

export function ProjectsPage() {
  const { user: currentUser, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectManagers, setProjectManagers] = useState<User[]>([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<'upcoming' | 'past' | 'all'>('all');
  const [viewType, setViewType] = useState<ViewType>('active');
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [projectToArchive, setProjectToArchive] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    status: 'planning',
    owner_id: null,
    manager_id: null,
    budget: null,
    progress: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchProjects = async () => {
    try {
      // Debug session state
      const currentSession = await debugSession();
      
      if (!currentSession?.access_token) {
        console.error('No valid session found');
        throw new Error('You must be logged in to view projects');
      }

      // First ensure the current user exists in the users table
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', currentUser?.id)
        .single();

      if (userError || !existingUser) {
        // If user doesn't exist, create them
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: currentUser?.id,
            email: currentUser?.email,
            full_name: currentUser?.full_name || '',
            role: currentUser?.role || 'user',
            status: currentUser?.status || 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error creating user profile:', insertError);
          throw new Error(`Failed to create user profile: ${insertError.message}`);
        }
      }

      // Now fetch projects with relationships
      const { data, error: supabaseError } = await supabase
        .from('projects')
        .select(`
          *,
          owner:users!projects_owner_id_fkey(id, email, full_name),
          manager:users!projects_manager_id_fkey(id, email, full_name),
          team_members:project_members!project_members_project_id_fkey(
            id,
            role,
            user:users!project_members_user_id_fkey(id, email, full_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (supabaseError) {
        console.error('Supabase error:', {
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint,
          code: supabaseError.code
        });
        throw new Error(supabaseError.message);
      }

      let filteredData = data || [];
      
      // Filter projects based on user role
      if (currentUser?.role === 'employee') {
        // For employees, only show projects where they are team members
        filteredData = filteredData.filter(project => 
          project.team_members?.some((member: ProjectMember & { user?: User }) => member.user?.id === currentUser.id) ||
          project.owner_id === currentUser.id ||
          project.manager_id === currentUser.id
        );
      } else if (currentUser?.role === 'project_manager') {
        // For project managers, show projects they manage or are part of
        filteredData = filteredData.filter(project =>
          project.manager_id === currentUser.id ||
          project.owner_id === currentUser.id ||
          project.team_members?.some((member: ProjectMember & { user?: User }) => member.user?.id === currentUser.id)
        );
      }
      // Admins can see all projects, so no filtering needed

      console.log('Successfully fetched projects:', filteredData);
      setProjects(filteredData);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError(err.message || 'Failed to fetch projects');
      toast.error(err.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectManagers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, status, created_at, updated_at, last_login, mfa_enabled, department, position, avatar_url')
        .eq('role', 'project_manager')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Error fetching project managers:', error);
        return;
      }

      setProjectManagers(data as User[] || []);
    } catch (err) {
      console.error('Error fetching project managers:', err);
    }
  };

  useEffect(() => {
    if (session) {
      console.log('Session available, fetching data...');
      Promise.all([fetchProjects(), fetchProjectManagers()]);
    } else {
      console.log('No session available');
      setLoading(false);
    }
  }, [session]);

  const filteredAndSortedProjects = useMemo(() => {
    return projects
      .filter(project => {
        // Filter by active/archived status first
        const isArchived = project.status === 'archived';
        if (viewType === 'active' && isArchived) return false;
        if (viewType === 'archived' && !isArchived) return false;

        // Then apply other filters
        const matchesSearch = 
          project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = 
          statusFilter === 'all' || project.status === statusFilter;

        const matchesDate = () => {
          if (dateFilter === 'all') return true;
          const today = new Date();
          const startDate = project.start_date ? new Date(project.start_date) : null;
          
          if (dateFilter === 'upcoming') {
            return startDate ? startDate >= today : false;
          } else {
            return startDate ? startDate < today : false;
          }
        };

        return matchesSearch && matchesStatus && matchesDate();
      })
      .sort((a, b) => {
        let comparison = 0;
        
        switch (sortField) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'status':
            comparison = a.status.localeCompare(b.status);
            break;
          case 'start_date':
            comparison = new Date(a.start_date || '').getTime() - 
                        new Date(b.start_date || '').getTime();
            break;
          case 'created_at':
            comparison = new Date(a.created_at).getTime() - 
                        new Date(b.created_at).getTime();
            break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [projects, searchQuery, statusFilter, dateFilter, sortField, sortDirection, viewType]);

  const handleOpenDialog = (project?: Project) => {
    if (project) {
      setSelectedProject(project);
      setFormData({
        name: project.name,
        description: project.description,
        start_date: project.start_date.slice(0, 10),
        end_date: project.end_date?.slice(0, 10) || '',
        status: project.status,
        owner_id: project.owner_id,
        manager_id: project.manager_id,
        budget: project.budget,
        progress: project.progress
      });
    } else {
      setSelectedProject(null);
      setFormData({
        name: '',
        description: '',
        start_date: new Date().toISOString().slice(0, 10),
        end_date: '',
        status: 'planning',
        owner_id: null,
        manager_id: null,
        budget: null,
        progress: 0
      });
    }
    setShowNewProjectModal(true);
  };

  const handleCloseDialog = () => {
    setShowNewProjectModal(false);
    setSelectedProject(null);
  };

  const handleSubmit = async () => {
    try {
      const currentSession = await debugSession();
      
      if (!currentSession?.access_token) {
        throw new Error('You must be logged in to perform this action');
      }

      if (!currentUser?.id) {
        throw new Error('User profile not found');
      }

      // First, ensure the user exists in the users table
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', currentUser.id)
        .single();

      if (userError || !existingUser) {
        // If user doesn't exist, create them
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: currentUser.id,  // This will match auth.uid()
            email: currentUser.email,
            full_name: currentUser.full_name || '',
            role: currentUser.role || 'user',
            status: currentUser.status || 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error creating user profile:', insertError);
          throw new Error(`Failed to create user profile: ${insertError.message}`);
        }
      }

      if (selectedProject) {
        // Update existing project
        const { error } = await supabase
          .from('projects')
          .update({
            name: formData.name,
            description: formData.description,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
            status: formData.status,
            owner_id: formData.owner_id || currentUser.id,
            manager_id: formData.manager_id,
            budget: formData.budget,
            progress: formData.progress,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedProject.id);

        if (error) {
          console.error('Error updating project:', error);
          throw error;
        }
        toast.success('Project updated successfully');
      } else {
        // Create new project
        const { error } = await supabase
          .from('projects')
          .insert({
            name: formData.name,
            description: formData.description,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
            status: formData.status,
            owner_id: formData.owner_id || currentUser.id,
            manager_id: formData.manager_id,
            budget: formData.budget,
            progress: formData.progress,
            created_by: currentUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('Error creating project:', error);
          throw error;
        }
        toast.success('Project created successfully');
      }

      handleCloseDialog();
      fetchProjects();
    } catch (error: any) {
      console.error('Error saving project:', error);
      toast.error(error.message || 'Error saving project');
    }
  };

  const handleDelete = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      toast.success('Project deleted successfully');
      fetchProjects();
      setShowDeleteModal(false);
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error('Error deleting project');
    }
  };

  const handleArchiveProject = async (project: Project) => {
    // If project is not completed, show confirmation dialog
    if (project.status !== 'completed' && project.status !== 'archived') {
      setProjectToArchive(project);
      setShowArchiveConfirm(true);
      return;
    }

    // Otherwise, directly archive/unarchive
    try {
      const newStatus = project.status === 'archived' ? 'completed' : 'archived';
      const { error } = await supabase
        .from('projects')
        .update({ 
          status: newStatus, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', project.id);

      if (error) throw error;
      
      toast.success(
        project.status === 'archived' 
          ? 'Project unarchived successfully' 
          : 'Project archived successfully'
      );
      
      fetchProjects();
    } catch (error: any) {
      console.error('Error archiving/unarchiving project:', error);
      toast.error('Error archiving/unarchiving project');
    }
  };

  const confirmArchiveProject = async () => {
    if (!projectToArchive) return;
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          status: 'archived', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', projectToArchive.id);

      if (error) throw error;
      
      toast.success('Project archived successfully');
      fetchProjects();
      setShowArchiveConfirm(false);
      setProjectToArchive(null);
    } catch (error: any) {
      console.error('Error archiving project:', error);
      toast.error('Error archiving project');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateFilter('all');
    setSortField('created_at');
    setSortDirection('desc');
  };

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || dateFilter !== 'all';

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 2,
          background: 'linear-gradient(135deg, #4776E6 0%, #8E54E9 100%)',
          color: 'white'
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h4" fontWeight="bold" color="white">
              {viewType === 'active' ? 'Projects' : 'Archived Projects'}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={viewType === 'archived'}
                  onChange={() => setViewType(viewType === 'active' ? 'archived' : 'active')}
                  color="default"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#ffffff',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: 'rgba(255, 255, 255, 0.5)',
                    },
                  }}
                />
              }
              label={
                <Typography variant="body2" color="white" sx={{ opacity: 0.9 }}>
                  Show archived projects
                </Typography>
              }
            />
          </Box>
          
          {viewType === 'active' && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Plus />}
              onClick={() => setShowNewProjectModal(true)}
              sx={{ 
                px: 3, 
                py: 1, 
                borderRadius: '8px',
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.3)',
                },
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
              }}
            >
              New Project
            </Button>
          )}
        </Box>
        
        <Typography variant="body1" color="white" sx={{ opacity: 0.9 }} mb={2}>
          {viewType === 'active' 
            ? 'Manage and track all your organization\'s active projects in one place.'
            : 'View and manage your archived projects. You can restore projects if needed.'
          }
        </Typography>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <TextField
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search className="h-4 w-4" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton 
                      size="small" 
                      onClick={() => setSearchQuery('')}
                      sx={{ p: 0.5 }}
                    >
                      <X className="h-4 w-4" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
                sx: { borderRadius: 2 }
              }}
              sx={{ width: 250 }}
            />

            <Button
              variant={showFilters ? "contained" : "outlined"}
              color={showFilters ? "primary" : "inherit"}
              startIcon={<SlidersHorizontal className="h-4 w-4" />}
              onClick={() => setShowFilters(!showFilters)}
              size="small"
              sx={{ borderRadius: 2, py: 1 }}
            >
              Filters
              {hasActiveFilters && !showFilters && (
                <Box
                  component="span"
                  sx={{
                    width: 6,
                    height: 6,
                    bgcolor: 'error.main',
                    borderRadius: '50%',
                    display: 'inline-block',
                    ml: 1,
                  }}
                />
              )}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="text"
                color="inherit"
                size="small"
                onClick={clearFilters}
                sx={{ color: 'text.secondary' }}
              >
                Clear filters
              </Button>
            )}
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <ToggleButtonGroup
              size="small"
              value={viewMode}
              exclusive
              onChange={(e, newValue) => {
                if (newValue) setViewMode(newValue);
              }}
              sx={{ 
                '& .MuiToggleButtonGroup-grouped': {
                  border: '1px solid',
                  borderColor: 'divider',
                  p: 1,
                }
              }}
            >
              <ToggleButton value="grid">
                <GridIcon className="h-4 w-4" />
              </ToggleButton>
              <ToggleButton value="list">
                <List className="h-4 w-4" />
              </ToggleButton>
            </ToggleButtonGroup>
            
            <FormControl size="small" sx={{ minWidth: 120, borderRadius: 2 }}>
              <Select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                displayEmpty
                sx={{ fontSize: '0.875rem', height: '40px', borderRadius: 2 }}
              >
                <MenuItem value="created_at">Recent</MenuItem>
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="status">Status</MenuItem>
                <MenuItem value="start_date">Start Date</MenuItem>
              </Select>
            </FormControl>
            
            <IconButton 
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              sx={{ 
                border: '1px solid', 
                borderColor: 'divider', 
                borderRadius: 2, 
                p: 1,
                color: '#4776E6'
              }}
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={showFilters}>
          <Box mt={2} mb={3} py={2} px={3} borderRadius={2} bgcolor="#f9fafb" border={1} borderColor="#e5e7eb">
            <Typography variant="subtitle2" fontWeight="medium" mb={2} color="#4776E6">
              Filter projects
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel id="status-filter-label">Status</InputLabel>
                  <Select
                    labelId="status-filter-label"
                    value={statusFilter}
                    label="Status"
                    onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
                  >
                    <MenuItem value="all">All Statuses</MenuItem>
                    <MenuItem value="planning">Planning</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="on_hold">On Hold</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel id="date-filter-label">Timeline</InputLabel>
                  <Select
                    labelId="date-filter-label"
                    value={dateFilter}
                    label="Timeline"
                    onChange={(e) => setDateFilter(e.target.value as 'upcoming' | 'past' | 'all')}
                  >
                    <MenuItem value="all">All Projects</MenuItem>
                    <MenuItem value="upcoming">Upcoming</MenuItem>
                    <MenuItem value="past">Past</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            {hasActiveFilters && (
              <Box display="flex" alignItems="center" mt={2} gap={1}>
                <Typography variant="caption" color="text.secondary">
                  Active filters:
                </Typography>
                {statusFilter !== 'all' && (
                  <Chip 
                    label={`Status: ${statusFilter.replace('_', ' ')}`}
                    size="small"
                    onDelete={() => setStatusFilter('all')}
                    sx={{ textTransform: 'capitalize' }}
                  />
                )}
                {dateFilter !== 'all' && (
                  <Chip 
                    label={`Timeline: ${dateFilter}`}
                    size="small"
                    onDelete={() => setDateFilter('all')}
                    sx={{ textTransform: 'capitalize' }}
                  />
                )}
                {searchQuery && (
                  <Chip 
                    label={`Search: ${searchQuery}`}
                    size="small"
                    onDelete={() => setSearchQuery('')}
                  />
                )}
              </Box>
            )}
          </Box>
        </Collapse>
      </Paper>

      {loading ? (
        <Box 
          display="flex" 
          justifyContent="center" 
          alignItems="center" 
          p={6}
          borderRadius={2}
          bgcolor="background.paper"
        >
          <CircularProgress size={40} thickness={4} />
        </Box>
      ) : filteredAndSortedProjects.length > 0 ? (
        <Fade in={!loading}>
          {viewMode === 'grid' ? (
            <Grid container spacing={3}>
              {filteredAndSortedProjects.map((project) => (
                <Grid item xs={12} sm={6} md={6} lg={4} key={project.id}>
                  <ProjectCard
                    project={project}
                    isAdmin={currentUser?.role === 'admin'}
                    onEdit={handleOpenDialog}
                    onDelete={(id) => {
                      setSelectedProject(project);
                      setShowDeleteModal(true);
                    }}
                    onArchive={() => handleArchiveProject(project)}
                    isArchived={project.status === 'archived'}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Paper elevation={0}>
              {filteredAndSortedProjects.map((project, index) => (
                <Box key={project.id}>
                  <Box 
                    p={2.5} 
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    onClick={() => window.location.href = `/admin/projects/${project.id}`}
                  >
                    <Box display="flex" justifyContent="space-between">
                      <Box>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {project.name}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          sx={{ 
                            maxWidth: '500px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {project.description || 'No description provided'}
                        </Typography>
                      </Box>
                      
                      <Box display="flex" alignItems="center" gap={2}>
                        <Chip
                          label={project.status.replace('_', ' ')}
                          color={project.status === 'in_progress' ? 'success' : 
                                project.status === 'planning' ? 'primary' : 
                                project.status === 'on_hold' ? 'warning' : 
                                project.status === 'completed' ? 'info' : 
                                project.status === 'archived' ? 'secondary' : 'error'}
                          size="small"
                          sx={{ 
                            textTransform: 'capitalize',
                            fontWeight: 'medium',
                            ...(project.status === 'in_progress' && {
                              bgcolor: '#34D399',
                              color: '#064E3B'
                            }),
                            ...(project.status === 'planning' && {
                              bgcolor: '#60A5FA',
                              color: '#1E3A8A'
                            }),
                            ...(project.status === 'on_hold' && {
                              bgcolor: '#FBBF24',
                              color: '#78350F'
                            }),
                            ...(project.status === 'completed' && {
                              bgcolor: '#A78BFA',
                              color: '#4C1D95'
                            }),
                            ...(project.status === 'archived' && {
                              bgcolor: '#9CA3AF',
                              color: '#1F2937'
                            }),
                            ...(project.status === 'cancelled' && {
                              bgcolor: '#F87171',
                              color: '#7F1D1D'
                            })
                          }}
                        />
                        
                        <Box display="flex" alignItems="center" gap={1}>
                          {currentUser?.role === 'admin' && (
                            <>
                              <Tooltip title={project.status === 'archived' ? "Unarchive" : "Archive"}>
                                <IconButton 
                                  size="small" 
                                  color={project.status === 'archived' ? "primary" : "default"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleArchiveProject(project);
                                  }}
                                >
                                  {project.status === 'archived' ? (
                                    <RefreshCw className="h-4 w-4" />
                                  ) : (
                                    <Archive className="h-4 w-4" />
                                  )}
                                </IconButton>
                              </Tooltip>
                              
                              <IconButton 
                                size="small" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDialog(project);
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </IconButton>
                              
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProject(project);
                                  setShowDeleteModal(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                  {index < filteredAndSortedProjects.length - 1 && <Divider />}
                </Box>
              ))}
            </Paper>
          )}
        </Fade>
      ) : (
        <Paper 
          elevation={0} 
          sx={{ 
            p: 6, 
            textAlign: 'center', 
            borderRadius: 2,
            background: 'linear-gradient(to right, #f9fafb, #f3f4f6)',
            border: '1px dashed #e5e7eb'
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {viewType === 'active' ? 'No projects found' : 'No archived projects found'}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {searchQuery || statusFilter !== 'all' || dateFilter !== 'all' 
              ? 'Try adjusting your filters to see more results' 
              : viewType === 'active' 
                ? 'Create your first project to get started'
                : 'You have not archived any projects yet.'
            }
          </Typography>
          {!(searchQuery || statusFilter !== 'all' || dateFilter !== 'all') && viewType === 'active' && (
            <Button
              variant="contained"
              startIcon={<Plus />}
              onClick={() => setShowNewProjectModal(true)}
              sx={{ 
                mt: 2,
                background: 'linear-gradient(135deg, #4776E6 0%, #8E54E9 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #3967D7 0%, #7F45DA 100%)',
                },
              }}
            >
              Create Project
            </Button>
          )}
        </Paper>
      )}

      {/* Project modals */}
      {showNewProjectModal && (
        <NewProjectModal
          project={selectedProject}
          onClose={handleCloseDialog}
          onSubmit={handleSubmit}
          formData={formData}
          setFormData={setFormData}
          projectManagers={projectManagers}
        />
      )}

      {showDeleteModal && selectedProject && (
        <DeleteProjectModal
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            fetchProjects();
            setShowDeleteModal(false);
          }}
        />
      )}

      {/* Archive Confirmation Dialog */}
      <Dialog
        open={showArchiveConfirm}
        onClose={() => {
          setShowArchiveConfirm(false);
          setProjectToArchive(null);
        }}
      >
        <DialogTitle>Archive Project</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This project is not marked as completed. Are you sure you want to archive it? 
            Archiving is typically done for completed projects to keep your active projects list clean.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setShowArchiveConfirm(false);
              setProjectToArchive(null);
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmArchiveProject} 
            color="primary" 
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #4776E6 0%, #8E54E9 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #3967D7 0%, #7F45DA 100%)',
              },
            }}
          >
            Archive Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 