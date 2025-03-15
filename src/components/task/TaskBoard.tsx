import { useState, useEffect } from 'react';
import { Plus, Sparkles, Check } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { Task, TaskStatus, TaskSuggestion, TaskPriority } from '../../types/task';
import type { User } from '../../types/auth';
import { toast } from 'react-hot-toast';
import { TaskTable } from './TaskTable';
import { NewTaskModal } from './NewTaskModal';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import { suggestTasks } from '../../lib/ai/suggest-tasks';

interface TaskBoardProps {
  projectId: string;
  currentUser: User;
  canManageTasks: boolean;
}

export function TaskBoard({ projectId, currentUser, canManageTasks }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<(TaskSuggestion & { added?: boolean })[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchProjectMembers();

    // Set up polling to refresh tasks every 30 seconds
    const intervalId = setInterval(fetchTasks, 30000);

    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_user:users!tasks_assigned_to_fkey(
            id,
            full_name,
            email,
            avatar_url
          ),
          creator:users!tasks_created_by_fkey(
            id,
            full_name,
            email
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        throw error;
      }

      setTasks(data || []);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      toast.error('Error loading tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectMembers = async () => {
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId);

      if (memberError) throw memberError;

      if (memberData && memberData.length > 0) {
        const userIds = memberData.map(m => m.user_id);
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .in('id', userIds);

        if (userError) throw userError;
        setProjectMembers(userData as User[]);
      } else {
        setProjectMembers([]);
      }
    } catch (error: any) {
      console.error('Error fetching project members:', error);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Task updated successfully');
      fetchTasks();
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast.error('Error updating task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      // Optimistically remove the task from the UI
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));

      // Then perform the actual deletion
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        // If deletion fails, revert the optimistic update
        fetchTasks();
        throw error;
      }
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast.error('Error deleting task: ' + error.message);
      throw error;
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

      // Then fetch CV data for each team member
      const memberPromises = (teamMembers || []).map(async (member) => {
        try {
          const { data: cvData } = await supabase
            .from('cv_parsed_data')
            .select('education, work_experience, skills, languages, certifications')
            .eq('user_id', member.user_id)
            .maybeSingle();

          return {
            ...member,
            cv_data: cvData || {
              education: '',
              work_experience: '',
              skills: '',
              languages: '',
              certifications: ''
            }
          };
        } catch (error) {
          console.warn(`Failed to fetch CV data for user ${member.user_id}:`, error);
          return {
            ...member,
            cv_data: {
              education: '',
              work_experience: '',
              skills: '',
              languages: '',
              certifications: ''
            }
          };
        }
      });

      const teamData = await Promise.all(memberPromises);

      // Fetch existing tasks with assignee information
      const { data: existingTasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          estimated_hours,
          assigned_to,
          created_at,
          assigned_user:users!tasks_assigned_to_fkey(
            id,
            full_name,
            email,
            position,
            department
          )
        `)
        .eq('project_id', projectId);

      if (tasksError) throw tasksError;

      // Get AI suggestions using Gemini
      const suggestions = await suggestTasks(
        projectData,
        { team_members: teamData },
        existingTasks || []
      );

      // Add status to suggestions
      const transformedSuggestions = suggestions.map((suggestion: TaskSuggestion) => ({
        ...suggestion,
        status: 'todo'
      }));

      setSuggestedTasks(transformedSuggestions.map(suggestion => ({ ...suggestion, added: false })));
      setShowSuggestionsModal(true);
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      toast.error('Failed to get AI suggestions. Please try again.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAddSuggestedTask = async (task: TaskSuggestion) => {
    try {
      // Find the user ID for the suggested assignee by matching their full name
      const assigneeUser = projectMembers.find(
        member => member.full_name.toLowerCase() === task.suggested_assignee?.toLowerCase()
      );

      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            project_id: projectId,
            title: task.title,
            description: task.description,
            priority: task.priority,
            estimated_hours: task.estimated_hours,
            assigned_to: assigneeUser?.id || null,
            status: 'todo',
            created_by: currentUser.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Add the new task to the list
      setTasks(prevTasks => [...prevTasks, data]);
      
      // Mark the suggestion as added
      setSuggestedTasks(prevSuggestions =>
        prevSuggestions.map(suggestion =>
          suggestion.title === task.title
            ? { ...suggestion, added: true }
            : suggestion
        )
      );
      
      toast.success('Task added successfully');
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const handlePriorityChange = (taskId: string, newPriority: 'low' | 'medium' | 'high') => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    handleUpdateTask(taskId, { priority: newPriority });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          Tasks ({tasks.length})
        </Typography>
        {canManageTasks && (
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<Sparkles />}
              onClick={getAISuggestions}
              disabled={loadingSuggestions}
            >
              {loadingSuggestions ? 'Getting Suggestions...' : 'Get AI Suggestions'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Plus />}
              onClick={() => setShowNewTaskModal(true)}
            >
              New Task
            </Button>
          </Box>
        )}
      </Box>

      <TaskTable
        tasks={tasks}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        currentUser={currentUser}
        canManageTasks={canManageTasks}
        projectMembers={projectMembers}
      />

      {showNewTaskModal && (
        <NewTaskModal
          projectId={projectId}
          currentUser={currentUser}
          projectMembers={projectMembers}
          onClose={() => setShowNewTaskModal(false)}
          onCreated={fetchTasks}
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
            AI Task Suggestions
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {suggestedTasks.length === 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography color="text.secondary">
                Generating task suggestions...
              </Typography>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {suggestedTasks.map((suggestion, index) => (
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
                      <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                        {suggestion.title}
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
                      onClick={() => handleAddSuggestedTask(suggestion)}
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
                      {suggestion.added ? 'Added' : 'Add Task'}
                    </Button>
                  </Box>
                  <Box 
                    display="flex" 
                    gap={1.5}
                    sx={{
                      '& .MuiChip-root': {
                        borderRadius: 1.5,
                        height: 28
                      }
                    }}
                  >
                    <Chip
                      label={`${suggestion.priority.charAt(0).toUpperCase() + suggestion.priority.slice(1)} Priority`}
                      color={getPriorityColor(suggestion.priority)}
                      size="small"
                      sx={{
                        fontWeight: 'medium',
                        '& .MuiChip-label': {
                          px: 1
                        }
                      }}
                    />
                    <Chip
                      label={`${suggestion.estimated_hours} hour${suggestion.estimated_hours !== 1 ? 's' : ''}`}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderStyle: 'dashed'
                      }}
                    />
                    {suggestion.suggested_assignee && (
                      <Chip
                        label={suggestion.suggested_assignee}
                        size="small"
                        variant="outlined"
                        sx={{
                          bgcolor: 'background.paper',
                          borderColor: 'primary.main',
                          color: 'primary.main',
                          fontWeight: 'medium'
                        }}
                      />
                    )}
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          px: 3, 
          py: 2,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}>
          <Button 
            onClick={() => setShowSuggestionsModal(false)}
            variant="outlined"
            sx={{
              borderRadius: 1.5,
              px: 3
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 