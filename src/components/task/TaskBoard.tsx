import { useState, useEffect, useCallback } from 'react';
import { Plus, Sparkles, Check, Filter, Grid as GridIcon, List as ListIcon } from 'lucide-react';
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
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import { suggestTasks } from '../../lib/ai/suggest-tasks';
import { enhanceTasks } from '../../lib/ai/enhance-tasks';
import { logActivity } from '../../lib/services/activityLogger';
import type { Phase } from '../../types/phase';
import { EditTaskModal } from './EditTaskModal';
import { BoardView } from './BoardView';
import { isEmployee } from '../../lib/permissions';

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
  const [suggestedTasks, setSuggestedTasks] = useState<(TaskSuggestion & { added: boolean })[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isSuggestionsDialogOpen, setIsSuggestionsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [view, setView] = useState<'table' | 'board'>('table');
  
  // New states for AI task edition
  const [enhancedTasks, setEnhancedTasks] = useState<(TaskSuggestion & { applied: boolean })[]>([]);
  const [isEnhancingTasks, setIsEnhancingTasks] = useState(false);
  const [isEnhanceDialogOpen, setIsEnhanceDialogOpen] = useState(false);
  const [showEnhancementsModal, setShowEnhancementsModal] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchProjectMembers();
    fetchPhases();

    // Set up polling to refresh tasks every 30 seconds
    const intervalId = setInterval(fetchTasks, 30000);

    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assignee:assigned_to(id, full_name, email),
          creator:created_by(id, full_name, email),
          phase:phase_id(id, name)
        `)
        .eq('project_id', projectId);
      
      // If user is an employee, only show tasks assigned to them
      if (isEmployee(currentUser)) {
        query = query.eq('assigned_to', currentUser.id);
      }
        
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tasks:', error);
        return;
      }
      
      setTasks(data || []);
      
    } catch (error) {
      console.error('Error in fetchTasks:', error);
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

  const fetchPhases = async () => {
    try {
      setLoadingPhases(true);
      
      const { data: projectPhases, error: projectPhasesError } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('sequence_order', { ascending: true });

      if (projectPhasesError) throw projectPhasesError;
      
      setPhases(projectPhases || []);
    } catch (error) {
      console.error('Error fetching phases:', error);
    } finally {
      setLoadingPhases(false);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      // Check if the task is being marked as completed
      const isCompletingTask = updates.status === 'completed';
      
      // If completing the task, get the full task data first
      let taskData: Task | null = null;
      if (isCompletingTask) {
        const { data: taskDetails, error: taskDetailsError } = await supabase
          .from('tasks')
          .select(`
            *,
            phase:project_phases(id, name)
          `)
          .eq('id', taskId)
          .single();
          
        if (taskDetailsError) {
          console.error('Error fetching task details:', taskDetailsError);
          throw taskDetailsError;
        }
        
        taskData = taskDetails;
      }
      
      // Update the task
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select();

      if (error) {
        console.error('Error updating task:', error);
        toast.error('Failed to update task');
        return;
      }

      // After updating in the database, we need to refresh the tasks to get the updated assignee info
      await fetchTasks();

      // Emit a custom event to notify that a task has been updated
      const taskUpdateEvent = new CustomEvent('task-updated', {
        detail: { projectId, taskId, updates }
      });
      window.dispatchEvent(taskUpdateEvent);
      
      // If the task was marked as completed, log the activity
      if (isCompletingTask && taskData) {
        try {
          await logActivity({
            projectId,
            userId: currentUser.id,
            activityType: 'task_completed',
            title: `Task Completed: ${taskData.title}`,
            description: taskData.description || 'No description provided',
            relatedEntityId: taskId,
            relatedEntityType: 'task',
            metadata: {
              task_id: taskId,
              task_title: taskData.title,
              completed_by: currentUser.id,
              completed_by_name: currentUser.full_name,
              phase_id: taskData.phase_id,
              phase_name: taskData.phase?.name || 'No Phase',
              priority: taskData.priority,
              estimated_hours: taskData.estimated_hours,
              due_date: taskData.due_date
            }
          });
          
          // Emit a custom event to notify that the knowledgebase should be refreshed
          const knowledgebaseRefreshEvent = new CustomEvent('knowledgebase-refresh');
          window.dispatchEvent(knowledgebaseRefreshEvent);
        } catch (logError) {
          console.error('Error logging task completion:', logError);
          // Don't fail the task update if logging fails
        }
      }

      toast.success('Task updated successfully');
      return data[0];
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
      return null;
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

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
  };

  const getAISuggestions = async () => {
    try {
      setSuggestedTasks([]);
      setIsSuggestionsDialogOpen(true);
      setLoadingSuggestions(true);
      
      // Fetch project information
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (projectError) throw projectError;

      // Fetch team members with their details
      const { data: teamMembersData, error: teamError } = await supabase
        .from('project_members')
        .select(`
          id,
          project_id,
          user_id,
          role,
          joined_at,
          user:users(
            id,
            full_name,
            email,
            department,
            position
          )
        `)
        .eq('project_id', projectId);

      if (teamError) {
        console.error('Error fetching team members:', teamError);
        throw teamError;
      }

      // Get user IDs from team members
      const userIds = teamMembersData?.map((member: any) => member.user_id) || [];
      
      // Fetch CV data for team members
      const { data: cvData, error: cvError } = await supabase
        .from('cv_parsed_data')
        .select(`
          user_id,
          education,
          skills,
          languages,
          certifications,
          work_experience
        `)
        .in('user_id', userIds);

      if (cvError) {
        console.error('Error fetching CV data:', cvError);
        // Continue even if CV data fails
      }
      
      // Fetch project education data
      const { data: educationData, error: eduError } = await supabase
        .from('project_education')
        .select('*')
        .eq('project_id', projectId)
        .in('user_id', userIds);
        
      if (eduError) {
        console.error('Error fetching education data:', eduError);
        // Continue even if education data fails
      }
      
      // Fetch project experience data
      const { data: experienceData, error: expError } = await supabase
        .from('project_experience')
        .select('*')
        .eq('project_id', projectId)
        .in('user_id', userIds);
        
      if (expError) {
        console.error('Error fetching experience data:', expError);
        // Continue even if experience data fails
      }

      // Fetch interview results if available
      const { data: interviewData, error: interviewError } = await supabase
        .from('user_interviews')
        .select('*')
        .in('user_id', userIds);
        
      if (interviewError) {
        console.error('Error fetching interview data:', interviewError);
        // Continue even if interview data fails
      }

      // Fetch current tasks
      const { data: currentTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId);
      
      if (tasksError) throw tasksError;
      
      // Create a knowledge base object with all collected data
      const knowledgeBase = {
        teamMembers: teamMembersData || [],
        teamMemberCVs: cvData || [],
        education: educationData || [],
        experience: experienceData || [],
        interviews: interviewData || []
      };
      
      // Call the AI to suggest tasks
      const suggestions = await suggestTasks(
        projectData,
        knowledgeBase,
        currentTasks || []
      );
      
      setSuggestedTasks(suggestions.map(suggestion => ({ ...suggestion, added: false })));
    } catch (error: any) {
      toast.error('Error getting AI suggestions: ' + error.message);
      console.error('Error getting AI suggestions:', error);
      setIsSuggestionsDialogOpen(false);
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

      // Parse the suggested due date or use null if not provided
      let dueDate = null;
      if (task.suggested_due_date) {
        try {
          // Make sure it's a valid date format by parsing and reformatting
          const date = new Date(task.suggested_due_date);
          if (!isNaN(date.getTime())) {
            dueDate = task.suggested_due_date;
          }
        } catch (e) {
          console.warn('Invalid date format in suggestion, ignoring', e);
        }
      }

      // If the suggestion includes a phase name, try to find or create the phase
      let phaseId = null;
      if (task.suggested_phase) {
        // First check if a phase with this name already exists for this project
        const { data: existingPhases, error: phaseError } = await supabase
          .from('project_phases')
          .select('id, name')
          .eq('project_id', projectId)
          .ilike('name', task.suggested_phase)
          .limit(1);
          
        if (phaseError) throw phaseError;
        
        if (existingPhases && existingPhases.length > 0) {
          // Use existing phase
          phaseId = existingPhases[0].id;
          
          // No need to check phases table, we'll use project_phases directly
          
          // Create the task
          const { data: taskData, error: taskError } = await supabase
            .from('tasks')
            .insert([
              {
                project_id: projectId,
                title: task.title,
                description: task.description,
                status: task.status || 'todo',
                priority: task.priority,
                phase_id: phaseId,
                assigned_to: task.suggested_assignee,
                created_by: currentUser.id,
                due_date: task.suggested_due_date || null,
                estimated_hours: task.estimated_hours || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ])
            .select()
            .single();
          
          if (taskError) throw taskError;
          
          // Add the new task to the list
          setTasks(prevTasks => [...prevTasks, taskData]);
          
          // Mark the suggestion as added
          setSuggestedTasks(prevSuggestions =>
            prevSuggestions.map(suggestion =>
              suggestion.title === task.title
                ? { ...suggestion, added: true }
                : suggestion
            )
          );
          
          toast.success('Task added successfully');
          
          // Refresh tasks to ensure everything is up-to-date
          fetchTasks();
        } else {
          // Create a new phase in project_phases
          const { data: newPhase, error: createPhaseError } = await supabase
            .from('project_phases')
            .insert({
              project_id: projectId,
              name: task.suggested_phase,
              description: `Auto-generated phase for ${task.title}`,
              status: 'pending',
              sequence_order: 999, // High number to place at end
              created_by: currentUser.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();
            
          if (createPhaseError) throw createPhaseError;
          phaseId = newPhase.id;
          
          // Create matching entry in phases table using RPC function to bypass RLS
          try {
            // Use the RPC function to bypass RLS policies
            const { error: rpcError } = await supabase.rpc('create_phase_with_admin_rights', {
              phase_id: phaseId,
              project_id: projectId,
              phase_name: task.suggested_phase,
              phase_description: `Auto-generated phase for ${task.title}`,
              phase_order: 999,
              phase_status: 'not_started',
              phase_start_date: null,
              phase_end_date: null
            });
              
            if (rpcError) {
              console.error('Error running create_phase_with_admin_rights RPC:', rpcError);
              phaseId = null; // Reset phaseId to avoid constraint error
            }
          } catch (e) {
            console.error('Error creating phase with RPC:', e);
            phaseId = null;
          }
        }
      }
      
      // Only proceed with phase_id if we successfully created/verified it in both tables
      // Create the task
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert([
          {
            project_id: projectId,
            title: task.title,
            description: task.description,
            status: task.status || 'todo',
            priority: task.priority,
            phase_id: phaseId,
            assigned_to: task.suggested_assignee,
            created_by: currentUser.id,
            due_date: task.suggested_due_date || null,
            estimated_hours: task.estimated_hours || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (taskError) throw taskError;

      // Add the new task to the list
      setTasks(prevTasks => [...prevTasks, taskData]);
      
      // Mark the suggestion as added
      setSuggestedTasks(prevSuggestions =>
        prevSuggestions.map(suggestion =>
          suggestion.title === task.title
            ? { ...suggestion, added: true }
            : suggestion
        )
      );
      
      toast.success('Task added successfully');
      
      // Refresh tasks to ensure everything is up-to-date
      fetchTasks();
    } catch (error: any) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task: ' + (error.message || 'Unknown error'));
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

  // New function to get AI enhancements for existing tasks
  const handleGetTaskEnhancements = async () => {
    try {
      // Check if we have tasks to enhance
      if (tasks.length === 0) {
        toast.error('No tasks available to enhance');
        return;
      }
      
      setIsEnhancingTasks(true);
      setEnhancedTasks([]);
      setIsEnhanceDialogOpen(true);
      
      // Use the enhanceTasks function to get AI enhancements for existing tasks
      const enhancements = await enhanceTasks(tasks, projectId);
      
      // Check if we have valid enhancements
      if (!enhancements || enhancements.length === 0) {
        toast.error('No task enhancements were generated');
        setIsEnhanceDialogOpen(false);
        return;
      }
      
      // Set the enhanced tasks with an "applied" flag initialized to false
      setEnhancedTasks(enhancements.map(enhancement => ({ ...enhancement, applied: false })));
    } catch (error: any) {
      console.error('Error getting AI task enhancements:', error);
      
      // Provide a more specific error message if we know what went wrong
      if (error.message && typeof error.message === 'string') {
        toast.error(`Error: ${error.message}`);
      } else {
        toast.error('Error getting AI task enhancements. Please try again.');
      }
      
      setIsEnhanceDialogOpen(false);
    } finally {
      setIsEnhancingTasks(false);
    }
  };
  
  // Function to apply a single enhancement to an existing task
  const handleApplyEnhancement = async (enhancement: TaskSuggestion & { applied?: boolean }) => {
    try {
      if (!enhancement.id) {
        toast.error("Cannot apply enhancement - task ID is missing");
        return;
      }

      // Extract the relevant updates from the enhancement
      const updates: Partial<Task> = {};
      
      // Only include valid properties in updates
      if (enhancement.priority) {
        updates.priority = enhancement.priority;
      }
      
      if (enhancement.estimated_hours !== undefined && enhancement.estimated_hours !== null) {
        updates.estimated_hours = enhancement.estimated_hours;
      }
      
      // For assigned_to, we need to be extra careful to prevent foreign key errors
      if (enhancement.assigned_to || enhancement.assigned_to === null) {
        updates.assigned_to = enhancement.assigned_to;
      }
      
      // If there are no updates to apply, display a message and return
      if (Object.keys(updates).length === 0) {
        toast.error(`No valid updates for task "${enhancement.title}"`);
        return;
      }
      
      // Update the task with these enhancements
      const updatedTask = await handleUpdateTask(enhancement.id as string, updates);
      
      // Mark this enhancement as applied in the UI
      setEnhancedTasks(prev => 
        prev.map(e => 
          e.id === enhancement.id 
            ? { ...e, applied: true } 
            : e
        )
      );
      
      toast.success(`Task "${enhancement.title}" updated with AI enhancements`);
      
      // Ensure the tasks are refreshed to show the new assignee
      if (!updatedTask) {
        await fetchTasks();
      }
    } catch (error: any) {
      console.error('Error applying enhancement:', error);
      toast.error(`Error applying enhancement: ${error.message || 'Unknown error'}`);
    }
  };
  
  // Function to apply all enhancements at once
  const handleApplyAllEnhancements = async () => {
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Show loading toast
    const loadingToast = toast.loading('Applying enhancements to tasks...');
    
    try {
      for (const enhancement of enhancedTasks) {
        if (!enhancement.applied) {
          try {
            if (!enhancement.id) {
              console.warn('Enhancement missing task ID, skipping', enhancement);
              skippedCount++;
              continue;
            }
            
            // Build the updates object carefully, only including valid properties
            const updates: Partial<Task> = {};
            
            if (enhancement.priority) {
              updates.priority = enhancement.priority;
            }
            
            if (enhancement.estimated_hours !== undefined && enhancement.estimated_hours !== null) {
              updates.estimated_hours = enhancement.estimated_hours;
            }
            
            // For assigned_to, we need to be extra careful to prevent foreign key errors
            if (enhancement.assigned_to || enhancement.assigned_to === null) {
              updates.assigned_to = enhancement.assigned_to;
            }
            
            // If there are no updates to apply for this enhancement, skip it
            if (Object.keys(updates).length === 0) {
              console.warn('No valid updates for enhancement', enhancement);
              skippedCount++;
              continue;
            }
            
            // Use handleUpdateTask which will properly handle the update
            const result = await handleUpdateTask(enhancement.id as string, updates);
            
            if (result) {
              successCount++;
              
              // Mark as applied in UI
              setEnhancedTasks(prev => 
                prev.map(e => 
                  e.id === enhancement.id 
                    ? { ...e, applied: true } 
                    : e
                )
              );
            } else {
              errorCount++;
            }
          } catch (error) {
            console.error(`Error updating task ${enhancement.id}:`, error);
            errorCount++;
          }
        } else {
          // Enhancement was already applied
          skippedCount++;
        }
      }
      
      // Ensure tasks are fully refreshed
      await fetchTasks();
      
      // Close dialog and show success message
      setIsEnhanceDialogOpen(false);
      
      if (errorCount === 0 && skippedCount === 0) {
        toast.success(`Successfully enhanced ${successCount} tasks`);
      } else if (errorCount === 0) {
        toast.success(`Enhanced ${successCount} tasks, ${skippedCount} already applied or skipped`);
      } else {
        toast.success(`Enhanced ${successCount} tasks, ${errorCount} failed, ${skippedCount} skipped`);
      }
    } catch (error: any) {
      console.error('Error applying all enhancements:', error);
      toast.error(`Error applying enhancements: ${error.message || 'Unknown error'}`);
    } finally {
      // Dismiss loading toast
      toast.dismiss(loadingToast);
    }
  };

  // Filter tasks based on selected phase
  const filteredTasks = phaseFilter 
    ? tasks.filter(task => task.phase_id === phaseFilter)
    : tasks;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h6">
            Tasks ({filteredTasks.length})
          </Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={phaseFilter || ''}
              onChange={(e) => setPhaseFilter(e.target.value === '' ? null : e.target.value)}
              displayEmpty
              size="small"
              startAdornment={<Filter size={16} style={{ marginRight: 8 }} />}
            >
              <MenuItem value="">All Phases</MenuItem>
              {phases.map((phase) => (
                <MenuItem key={phase.id} value={phase.id}>{phase.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box ml={2} display="flex" border={1} borderColor="divider" borderRadius={1}>
            <Button 
              size="small"
              variant={view === 'table' ? 'contained' : 'text'}
              onClick={() => setView('table')}
              sx={{ 
                minWidth: 40, 
                p: 1,
                borderRadius: view === 'table' ? 1 : 0
              }}
            >
              <ListIcon size={16} />
            </Button>
            <Button 
              size="small"
              variant={view === 'board' ? 'contained' : 'text'}
              onClick={() => setView('board')}
              sx={{ 
                minWidth: 40, 
                p: 1,
                borderRadius: view === 'board' ? 1 : 0
              }}
            >
              <GridIcon size={16} />
            </Button>
          </Box>
        </Box>
        {canManageTasks && (
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<Sparkles />}
              onClick={handleGetTaskEnhancements}
              disabled={isEnhancingTasks || tasks.length === 0}
            >
              {isEnhancingTasks ? 'Enhancing Tasks...' : 'AI Task Edition'}
            </Button>
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

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {view === 'table' ? (
          <TaskTable 
            tasks={filteredTasks} 
            onUpdateTask={handleUpdateTask} 
            onDeleteTask={handleDeleteTask}
            onEditTask={handleEditTask}
            currentUser={currentUser} 
            canManageTasks={canManageTasks}
            projectMembers={projectMembers}
          />
        ) : (
          <BoardView 
            tasks={filteredTasks}
            phases={phases}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            currentUser={currentUser}
            canManageTasks={canManageTasks}
          />
        )}
      </Box>

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
        open={isSuggestionsDialogOpen}
        onClose={() => setIsSuggestionsDialogOpen(false)}
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
                      <Typography 
                        variant="subtitle1" 
                        sx={{ 
                          fontWeight: 600,
                          mb: 0.5
                        }}
                      >
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
                      
                      {/* Display rationale if available */}
                      {suggestion.rationale && (
                        <Typography 
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mt: 1,
                            mb: 2,
                            p: 1.5,
                            bgcolor: 'background.paper',
                            border: '1px dashed',
                            borderColor: 'divider',
                            borderRadius: 1,
                            fontSize: '0.85rem'
                          }}
                        >
                          <strong>AI Rationale:</strong> {suggestion.rationale}
                        </Typography>
                      )}
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
                    flexWrap="wrap"
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
                      label={`${suggestion.estimated_hours} ${suggestion.estimated_hours === 1 ? 'hour' : 'hours'}`}
                      size="small"
                      variant="outlined"
                    />
                    {suggestion.suggested_assignee && (
                      <Chip
                        label={`Assignee: ${suggestion.suggested_assignee}`}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    )}
                    {suggestion.suggested_phase && (
                      <Chip
                        label={`Phase: ${suggestion.suggested_phase}`}
                        size="small"
                        variant="outlined"
                        color="secondary"
                      />
                    )}
                    {suggestion.suggested_due_date && (
                      <Chip
                        label={`Due: ${new Date(suggestion.suggested_due_date).toLocaleDateString()}`}
                        size="small"
                        variant="outlined"
                        color="info"
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
            onClick={() => setIsSuggestionsDialogOpen(false)}
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

      {selectedTask && (
        <EditTaskModal
          task={selectedTask}
          projectMembers={projectMembers}
          phases={phases}
          onClose={() => setSelectedTask(null)}
          onSave={handleUpdateTask}
          currentUser={currentUser}
        />
      )}
    </Box>
  );
} 