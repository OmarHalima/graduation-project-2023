import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Autocomplete,
  Stack,
  Paper,
  Divider
} from '@mui/material';
import { Plus, Edit2, Trash2, Calendar, Briefcase } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Project {
  id: string;
  project_name: string;
  role: string;
  start_date: string;
  end_date: string | null;
  responsibilities: string | null;
  user_id: string;
}

interface ProjectOption {
  id: string;
  project_name: string;
  role: string;
  start_date: string;
  end_date: string;
  responsibilities: string;
}

interface FormData {
  project_name: string;
  role: string;
  start_date: string;
  end_date: string;
  responsibilities: string;
}

interface ProjectsSectionProps {
  userId: string;
  canEdit: boolean;
  onUpdate: () => void;
}

export function ProjectsSection({ userId, canEdit, onUpdate }: ProjectsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<FormData>({
    project_name: '',
    role: '',
    start_date: '',
    end_date: '',
    responsibilities: '',
  });

  useEffect(() => {
    fetchProjects();
    if (canEdit) {
      fetchProjectOptions();
    }
  }, [userId, canEdit]);

  const fetchProjects = async () => {
    try {
      const { data: projects, error } = await supabase
        .from('user_projects')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });

      if (error) throw error;

      setProjects(projects || []);
      
      // Map projects to options with correct types
      const options: ProjectOption[] = (projects || []).map(project => ({
        id: project.id,
        project_name: project.project_name,
        role: project.role,
        start_date: project.start_date,
        end_date: project.end_date || '',
        responsibilities: project.responsibilities || ''
      }));
      
      setProjectOptions(options);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to fetch projects');
    }
  };

  const fetchProjectOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name');

      if (error) throw error;

      // Map the projects data to match ProjectOption interface
      const options: ProjectOption[] = (data || []).map(project => ({
        id: project.id,
        project_name: project.name,
        role: '',
        start_date: project.start_date || '',
        end_date: project.end_date || '',
        responsibilities: ''
      }));

      setProjectOptions(options);
    } catch (error: any) {
      console.error('Error fetching project options:', error);
      toast.error('Error loading project options');
    }
  };

  const handleOpenDialog = (project?: Project) => {
    if (project) {
      setSelectedProject(project);
      setFormData({
        project_name: project.project_name,
        role: project.role,
        start_date: project.start_date,
        end_date: project.end_date || '',
        responsibilities: project.responsibilities || '',
      });
    } else {
      setSelectedProject(null);
      setFormData({
        project_name: '',
        role: '',
        start_date: '',
        end_date: '',
        responsibilities: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedProject(null);
    setFormData({
      project_name: '',
      role: '',
      start_date: '',
      end_date: '',
      responsibilities: '',
    });
  };

  const handleSubmit = async () => {
    // Validate all required fields
    if (!formData.project_name) {
      toast.error('Please enter a project name');
      return;
    }
    if (!formData.role) {
      toast.error('Please enter your role');
      return;
    }
    if (!formData.start_date) {
      toast.error('Please enter the start date');
      return;
    }

    setLoading(true);
    try {
      const projectData = {
        user_id: userId,
        project_name: formData.project_name.trim(),
        role: formData.role.trim(),
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        responsibilities: formData.responsibilities ? formData.responsibilities.trim() : null
      };

      if (selectedProject) {
        // Update existing project
        const { error } = await supabase
          .from('user_projects')
          .update(projectData)
          .eq('id', selectedProject.id);

        if (error) {
          console.error('Error updating project:', error);
          toast.error(error.message || 'Error updating project');
          return;
        }
        toast.success('Project updated successfully');
      } else {
        // Create new project
        const { error } = await supabase
          .from('user_projects')
          .insert([projectData]);

        if (error) {
          console.error('Error creating project:', error);
          toast.error(error.message || 'Error creating project');
          return;
        }
        toast.success('Project added successfully');
      }

      handleCloseDialog();
      onUpdate();
      fetchProjects();
    } catch (error: any) {
      console.error('Error saving project:', error);
      toast.error(error.message || 'Error saving project');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      toast.success('Project deleted successfully');
      fetchProjects();
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error('Error deleting project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, backgroundColor: 'background.default' }}>
      <Box mb={4}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Projects
        </Typography>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<Plus />}
            onClick={() => handleOpenDialog()}
            sx={{ mt: 2 }}
          >
            Add Project
          </Button>
        )}
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress size={28} />
        </Box>
      )}

      <Box>
        {projects.map((project) => (
          <Card key={project.id} sx={{ mb: 2, p: 2 }}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">{project.project_name}</Typography>
                <Box>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(project)}
                    sx={{ mr: 1 }}
                  >
                    <Edit2 size={18} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(project.id)}
                  >
                    <Trash2 size={18} />
                  </IconButton>
                </Box>
              </Box>
              <Divider />
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Briefcase size={16} />
                  <Typography>{project.role}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Calendar size={16} />
                  <Typography>
                    {format(new Date(project.start_date), 'MMM yyyy')}
                    {project.end_date && ` - ${format(new Date(project.end_date), 'MMM yyyy')}`}
                  </Typography>
                </Box>
                {project.responsibilities && (
                  <Typography variant="body2" color="text.secondary">
                    {project.responsibilities}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Card>
        ))}

        {projects.length === 0 && (
          <Box 
            sx={{ 
              py: 8,
              textAlign: 'center',
              backgroundColor: 'background.paper',
              borderRadius: 2,
              border: '1px dashed',
              borderColor: 'divider'
            }}
          >
            <Typography color="text.secondary">
              No projects recorded yet.
            </Typography>
          </Box>
        )}
      </Box>

      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontSize: '1.25rem', fontWeight: 600 }}>
            {selectedProject ? 'Edit Project' : 'Add Project'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              fullWidth
              required
              label="Project Name"
              value={formData.project_name}
              onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
              placeholder="Enter project name"
            />
            <Autocomplete
              options={projectOptions}
              getOptionLabel={(option) => option.project_name}
              value={projectOptions.find(p => p.project_name === formData.project_name) || null}
              onChange={(_, newValue) => {
                setFormData({ 
                  ...formData, 
                  project_name: newValue?.project_name || '',
                  role: newValue?.role || '',
                  start_date: newValue?.start_date || '',
                  end_date: newValue?.end_date || '',
                  responsibilities: newValue?.responsibilities || ''
                });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Project Name"
                  required
                  error={!formData.project_name}
                  helperText={!formData.project_name ? 'Project name is required' : ''}
                />
              )}
            />
            <TextField
              fullWidth
              required
              label="Role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              placeholder="Your role in the project"
            />
            <TextField
              fullWidth
              required
              type="date"
              label="Start Date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              type="date"
              label="End Date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="Leave empty if still ongoing"
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Responsibilities"
              value={formData.responsibilities}
              onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
              placeholder="Describe your responsibilities and achievements in this project"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button 
            onClick={handleCloseDialog}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 