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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import { Sparkles, Check } from 'lucide-react';
import { enhanceTasks } from '../lib/ai/enhance-tasks';

export function TasksPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);

  // States for AI enhancement
  const [enhancedTasks, setEnhancedTasks] = useState<any[]>([]);
  const [isEnhancingTasks, setIsEnhancingTasks] = useState(false);
  const [isEnhanceDialogOpen, setIsEnhanceDialogOpen] = useState(false);

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

  // New function to get AI enhancements for tasks
  const handleGetEnhancements = async () => {
    // If no project is selected, show an error
    if (!projectFilter) {
      toast.error('Please select a project to enhance tasks');
      return;
    }

    // Only proceed if we have tasks to enhance
    if (tasks.length === 0) {
      toast.error('No tasks available to enhance');
      return;
    }

    try {
      setIsEnhancingTasks(true);
      
      // Use enhanceTasks function to enhance existing tasks
      const enhancements = await enhanceTasks(tasks, projectFilter);
      
      // Check if we have valid enhancements
      if (!enhancements || enhancements.length === 0) {
        toast.error('No task enhancements were generated');
        return;
      }
      
      setEnhancedTasks(enhancements);
      setIsEnhanceDialogOpen(true);
    } catch (error: any) {
      console.error('Error getting AI enhancements:', error);
      
      // Provide a more specific error message if we know what went wrong
      if (error.message && typeof error.message === 'string') {
        toast.error(`Error: ${error.message}`);
      } else {
        toast.error('Error getting AI task enhancements. Please try again.');
      }
    } finally {
      setIsEnhancingTasks(false);
    }
  };

  // Function to apply a single enhancement
  const handleApplyEnhancement = async (enhancement: any) => {
    try {
      // Extract the relevant updates from the enhancement
      const updates: Partial<Task> = {
        assigned_to: enhancement.assigned_to,
        priority: enhancement.priority,
        estimated_hours: enhancement.estimated_hours
      };

      // Update the task with these suggestions
      await handleUpdateTask(enhancement.id, updates);

      // Mark this enhancement as applied in the UI
      setEnhancedTasks(prev => 
        prev.map(e => 
          e.id === enhancement.id 
            ? { ...e, applied: true } 
            : e
        )
      );

      toast.success(`Task "${enhancement.title}" updated with AI enhancements`);
    } catch (error: any) {
      console.error('Error applying enhancement:', error);
      toast.error('Error applying enhancement');
    }
  };

  // Function to apply all enhancements at once
  const handleApplyAllEnhancements = async () => {
    let successCount = 0;
    let errorCount = 0;

    for (const enhancement of enhancedTasks) {
      if (!enhancement.applied) {
        try {
          const updates: Partial<Task> = {
            assigned_to: enhancement.assigned_to,
            priority: enhancement.priority,
            estimated_hours: enhancement.estimated_hours
          };

          await supabase
            .from('tasks')
            .update(updates)
            .eq('id', enhancement.id);

          successCount++;
        } catch (error) {
          console.error(`Error updating task ${enhancement.id}:`, error);
          errorCount++;
        }
      }
    }

    // Refresh tasks after all updates
    await fetchTasks();

    // Close dialog and show success message
    setIsEnhanceDialogOpen(false);
    
    if (errorCount === 0) {
      toast.success(`Successfully enhanced ${successCount} tasks`);
    } else {
      toast.success(`Enhanced ${successCount} tasks, ${errorCount} failed`);
    }
  };

  // Helper function to get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
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
        {canManageTasks && projectFilter && (
          <Grid item xs={12} md={4}>
            <Button
              variant="outlined"
              startIcon={<Sparkles size={18} />}
              onClick={handleGetEnhancements}
              disabled={isEnhancingTasks || tasks.length === 0}
              sx={{ height: '100%' }}
            >
              {isEnhancingTasks ? 'Enhancing Tasks...' : 'AI Enhance Tasks'}
            </Button>
          </Grid>
        )}
      </Grid>

      <TaskTable
        tasks={tasks}
        onUpdateTask={handleUpdateTask}
        currentUser={currentUser}
        canManageTasks={canManageTasks}
      />

      {/* AI Task Enhancement Dialog */}
      <Dialog
        open={isEnhanceDialogOpen}
        onClose={() => setIsEnhanceDialogOpen(false)}
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
            AI Task Enhancements
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {enhancedTasks.length === 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography color="text.secondary">
                Analyzing tasks and generating enhancements...
              </Typography>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {enhancedTasks.map((enhancement, index) => (
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
                    bgcolor: enhancement.applied ? 'action.selected' : 'background.paper',
                    '&:hover': {
                      bgcolor: enhancement.applied ? 'action.selected' : 'action.hover',
                    },
                    transition: 'background-color 0.2s',
                  }}
                >
                  <Box width="100%" display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box flex={1} pr={2}>
                      <Typography 
                        variant="subtitle1" 
                        sx={{ 
                          fontWeight: 600,
                          mb: 0.5
                        }}
                      >
                        {enhancement.title}
                      </Typography>
                      
                      <Box 
                        display="flex" 
                        gap={1.5}
                        flexWrap="wrap"
                        sx={{
                          '& .MuiChip-root': {
                            borderRadius: 1.5,
                            height: 28
                          }
                        }}
                        mb={2}
                      >
                        <Chip
                          label={`${enhancement.priority.charAt(0).toUpperCase() + enhancement.priority.slice(1)} Priority`}
                          color={getPriorityColor(enhancement.priority)}
                          size="small"
                          sx={{
                            fontWeight: 'medium',
                            '& .MuiChip-label': {
                              px: 1
                            }
                          }}
                        />
                        <Chip
                          label={`${enhancement.estimated_hours} ${enhancement.estimated_hours === 1 ? 'hour' : 'hours'}`}
                          size="small"
                          variant="outlined"
                        />
                        {enhancement.suggested_assignee && (
                          <Chip
                            label={`Assignee: ${enhancement.suggested_assignee}`}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        )}
                      </Box>
                      
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ 
                          whiteSpace: 'pre-wrap',
                          mb: 1
                        }}
                      >
                        <strong>Rationale: </strong>
                        {enhancement.rationale || 'No rationale provided'}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleApplyEnhancement(enhancement)}
                      startIcon={enhancement.applied ? <Check size={16} /> : null}
                      disabled={enhancement.applied}
                      sx={{ 
                        minWidth: 120,
                        boxShadow: 'none',
                        bgcolor: enhancement.applied ? 'success.main' : 'primary.main',
                        '&:hover': {
                          bgcolor: enhancement.applied ? 'success.dark' : 'primary.dark',
                          boxShadow: 'none'
                        }
                      }}
                    >
                      {enhancement.applied ? 'Applied' : 'Apply'}
                    </Button>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={() => setIsEnhanceDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleApplyAllEnhancements}
            disabled={enhancedTasks.length === 0 || enhancedTasks.every(t => t.applied)}
          >
            Apply All Enhancements
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 