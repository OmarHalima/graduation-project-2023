import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Filter, Search } from 'lucide-react';
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
} from '@mui/material';

type SortField = 'name' | 'status' | 'start_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

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
  }, [projects, searchQuery, statusFilter, dateFilter, sortField, sortDirection]);

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
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error('Error deleting project');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Projects
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={() => setShowFilters(!showFilters)}
            startIcon={<Filter />}
          >
            Filters
          </Button>
          {(currentUser?.role === 'admin' || currentUser?.role === 'project_manager') && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Plus />}
              onClick={() => handleOpenDialog()}
            >
              New Project
            </Button>
          )}
        </Box>
      </Box>

      {/* Search and Filters */}
      <Box mb={3}>
        <TextField
          fullWidth
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <Search className="h-5 w-5 text-gray-400" />,
          }}
          sx={{ mb: 2 }}
        />

        {showFilters && (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
                  label="Status"
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="planning">Planning</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="on_hold">On Hold</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Date</InputLabel>
                <Select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as 'upcoming' | 'past' | 'all')}
                  label="Date"
                >
                  <MenuItem value="all">All Dates</MenuItem>
                  <MenuItem value="upcoming">Upcoming</MenuItem>
                  <MenuItem value="past">Past</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  label="Sort By"
                >
                  <MenuItem value="created_at">Created Date</MenuItem>
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="status">Status</MenuItem>
                  <MenuItem value="start_date">Start Date</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        )}
      </Box>

      <Grid container spacing={3}>
        {filteredAndSortedProjects.map((project) => (
          <Grid item xs={12} sm={6} md={4} key={project.id}>
            <ProjectCard
              project={project}
              isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'project_manager'}
              onEdit={() => handleOpenDialog(project)}
              onDelete={() => handleDelete(project.id)}
            />
          </Grid>
        ))}
      </Grid>

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
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            setShowDeleteModal(false);
            fetchProjects();
          }}
        />
      )}
    </Box>
  );
} 