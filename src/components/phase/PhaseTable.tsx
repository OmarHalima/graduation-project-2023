import { useState } from 'react';
import { Edit, Trash, MoreVertical } from 'lucide-react';
import type { Phase, PhaseStatus } from '../../types/phase';
import type { User } from '../../types/auth';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  TableSortLabel,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Typography,
  Tooltip,
} from '@mui/material';
import { EditPhaseModal } from './EditPhaseModal';
import { logActivity } from '../../lib/services/activityLogger';

interface PhaseTableProps {
  phases: Phase[];
  onUpdatePhase: (phaseId: string, updates: Partial<Phase>) => Promise<void>;
  currentUser: User;
  canManagePhases: boolean;
}

export function PhaseTable({ phases, onUpdatePhase, currentUser, canManagePhases }: PhaseTableProps) {
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'sequence_order'>('sequence_order');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleRequestSort = (property: 'name' | 'status' | 'sequence_order') => {
    const isAsc = sortBy === property && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortBy(property);
  };

  const handleEditClick = (phase: Phase) => {
    setSelectedPhase(phase);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = async (phase: Phase) => {
    try {
      // Check if there are any tasks associated with this phase
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('phase_id', phase.id);

      if (tasksError) throw tasksError;

      // If there are tasks associated with this phase, ask for confirmation
      if (tasksData && tasksData.length > 0) {
        const isConfirmed = window.confirm(
          `This phase has ${tasksData.length} associated tasks. Deleting this phase will also delete all associated tasks. Are you sure you want to continue?`
        );
        
        if (!isConfirmed) {
          return;
        }
        
        // Delete all tasks associated with this phase
        const { error: deleteTasksError } = await supabase
          .from('tasks')
          .delete()
          .eq('phase_id', phase.id);
          
        if (deleteTasksError) throw deleteTasksError;
        
        toast.success(`Deleted ${tasksData.length} tasks associated with this phase`);
      }

      // Proceed with phase deletion
      const { error } = await supabase
        .from('project_phases')
        .delete()
        .eq('id', phase.id);

      if (error) throw error;

      toast.success('Phase deleted successfully');
      
      // Emit a custom event instead of reloading the page
      const phaseDeletedEvent = new CustomEvent('phase-deleted', {
        detail: { phaseId: phase.id }
      });
      window.dispatchEvent(phaseDeletedEvent);
      
      // Also emit a task-updated event to refresh task lists
      const taskUpdatedEvent = new CustomEvent('task-updated', {
        detail: { projectId: phase.project_id }
      });
      window.dispatchEvent(taskUpdatedEvent);
    } catch (error: any) {
      console.error('Error deleting phase:', error);
      toast.error('Error deleting phase: ' + (error.message || 'Unknown error'));
    }
  };

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

  const handleStatusChange = async (phaseId: string, newStatus: PhaseStatus) => {
    try {
      // Get the phase data before updating
      const phase = phases.find(p => p.id === phaseId);
      if (!phase) {
        toast.error('Phase not found');
        return;
      }
      
      // Update the phase
      await onUpdatePhase(phaseId, { status: newStatus });
      
      // If the phase is being marked as completed, log the activity
      if (newStatus === 'completed' && phase.status !== 'completed') {
        try {
          // Count tasks in this phase
          const { data: tasksData, error: tasksError } = await supabase
            .from('tasks')
            .select('id')
            .eq('phase_id', phaseId);
            
          if (tasksError) throw tasksError;
          
          const taskCount = tasksData?.length || 0;
          
          await logActivity({
            projectId: phase.project_id,
            userId: currentUser.id,
            activityType: 'phase_completed',
            title: `Phase Completed: ${phase.name}`,
            description: phase.description || 'No description provided',
            relatedEntityId: phaseId,
            relatedEntityType: 'phase',
            metadata: {
              phase_id: phaseId,
              phase_name: phase.name,
              completed_by: currentUser.id,
              completed_by_name: currentUser.full_name,
              task_count: taskCount,
              start_date: phase.start_date,
              end_date: phase.end_date,
              sequence_order: phase.sequence_order
            }
          });
          
          // Emit a custom event to notify that the knowledgebase should be refreshed
          const knowledgebaseRefreshEvent = new CustomEvent('knowledgebase-refresh');
          window.dispatchEvent(knowledgebaseRefreshEvent);
        } catch (logError) {
          console.error('Error logging phase completion:', logError);
          // Don't fail the phase update if logging fails
        }
      }
    } catch (error) {
      console.error('Error updating phase status:', error);
      toast.error('Failed to update phase status');
    }
  };

  // Sort phases
  const sortedPhases = [...phases].sort((a, b) => {
    if (sortBy === 'name') {
      return sortDirection === 'asc' 
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    } else if (sortBy === 'status') {
      return sortDirection === 'asc'
        ? (a.status || '').localeCompare(b.status || '')
        : (b.status || '').localeCompare(a.status || '');
    } else {
      return sortDirection === 'asc'
        ? (a.sequence_order - b.sequence_order)
        : (b.sequence_order - a.sequence_order);
    }
  });

  return (
    <>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'sequence_order'}
                  direction={sortBy === 'sequence_order' ? sortDirection : 'asc'}
                  onClick={() => handleRequestSort('sequence_order')}
                >
                  #
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'name'}
                  direction={sortBy === 'name' ? sortDirection : 'asc'}
                  onClick={() => handleRequestSort('name')}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>Description</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'status'}
                  direction={sortBy === 'status' ? sortDirection : 'asc'}
                  onClick={() => handleRequestSort('status')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell>Timeline</TableCell>
              <TableCell>Tasks</TableCell>
              <TableCell>Created By</TableCell>
              {canManagePhases && <TableCell align="center">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedPhases.map((phase) => (
              <TableRow key={phase.id}>
                <TableCell>{phase.sequence_order}</TableCell>
                <TableCell>{phase.name}</TableCell>
                <TableCell>{phase.description || '-'}</TableCell>
                <TableCell>
                  {canManagePhases ? (
                    <Select
                      value={phase.status}
                      onChange={(e) => handleStatusChange(phase.id, e.target.value as PhaseStatus)}
                      size="small"
                      sx={{ minWidth: 120 }}
                    >
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="in_progress">In Progress</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                    </Select>
                  ) : (
                    <Chip
                      label={phase.status}
                      color={getStatusColor(phase.status)}
                      size="small"
                    />
                  )}
                </TableCell>
                <TableCell>
                  {phase.start_date && phase.end_date ? (
                    <>
                      {format(new Date(phase.start_date), 'MMM d, yyyy')} - 
                      {format(new Date(phase.end_date), 'MMM d, yyyy')}
                    </>
                  ) : (
                    'Not scheduled'
                  )}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={`${phase.task_count || 0} tasks`} 
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{phase.creator?.full_name || (phase.created_by ? 'Loading...' : '-')}</TableCell>
                {canManagePhases && (
                  <TableCell align="center">
                    <Box display="flex" justifyContent="center" gap={1}>
                      <Tooltip title="Edit Phase">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleEditClick(phase)}
                        >
                          <Edit size={18} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Phase">
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleDeleteClick(phase)}
                        >
                          <Trash size={18} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {phases.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManagePhases ? 8 : 7} align="center">
                  <Typography color="text.secondary" py={2}>
                    No phases found. Create your first phase to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Modal */}
      {isEditModalOpen && selectedPhase && (
        <EditPhaseModal
          phase={selectedPhase}
          onClose={() => setIsEditModalOpen(false)}
          onSave={async (updates) => {
            await onUpdatePhase(selectedPhase.id, updates);
            setIsEditModalOpen(false);
          }}
        />
      )}
    </>
  );
} 