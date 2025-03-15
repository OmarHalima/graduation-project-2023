import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Task } from '../types/task';
import type { User } from '../types/auth';
import { useAuth } from '../contexts/AuthContext';
import { TaskTable } from '../components/task/TaskTable';
import { toast } from 'react-hot-toast';
import {
  Box,
  Card,
  Typography,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@mui/material';

export function TasksPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (currentUser) {
      fetchTasks();
      fetchProjects();
    }
  }, [currentUser, projectFilter]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assignee:assigned_to(id, full_name, email),
          creator:created_by(id, full_name, email),
          project:projects(id, name)
        `)
        .order('created_at', { ascending: false });

      if (projectFilter) {
        query = query.eq('project_id', projectFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      toast.error('Error loading tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;
      await fetchTasks();
      toast.success('Task updated successfully');
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast.error('Error updating task');
    }
  };

  if (!currentUser) {
    return (
      <Card sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Please sign in to view tasks
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Go to Sign In
        </Button>
      </Card>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  const canManageTasks = currentUser.role === 'admin' || currentUser.role === 'project_manager';

  return (
    <Box p={3}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Tasks
        </Typography>
        <Typography color="text.secondary">
          View and manage tasks across all projects
        </Typography>
      </Box>

      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Filter by Project</InputLabel>
            <Select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              label="Filter by Project"
            >
              <MenuItem value="">All Projects</MenuItem>
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <TaskTable
        tasks={tasks}
        onUpdateTask={handleUpdateTask}
        currentUser={currentUser}
        canManageTasks={canManageTasks}
      />
    </Box>
  );
} 