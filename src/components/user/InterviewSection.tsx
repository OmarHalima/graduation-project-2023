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
} from '@mui/material';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

interface Interview {
  id: string;
  interview_date: string;
  notes: string;
  result: 'passed' | 'failed' | 'pending' | '';
  interviewer_id: string;
  interviewer?: {
    full_name: string;
    id?: string;
  };
}

interface InterviewFormData {
  interview_date: string;
  notes: string;
  result: 'passed' | 'failed' | 'pending' | '';
  interviewer_id: string;
}

interface InterviewSectionProps {
  userId: string;
  canEdit: boolean;
  onUpdate: () => void;
}

export function InterviewSection({ userId, canEdit, onUpdate }: InterviewSectionProps) {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [formData, setFormData] = useState<InterviewFormData>({
    interview_date: new Date().toISOString().slice(0, 16),
    notes: '',
    result: '',
    interviewer_id: '',
  });
  const [interviewers, setInterviewers] = useState<any[]>([]);

  useEffect(() => {
    fetchInterviews();
    fetchInterviewers();
  }, [userId]);

  const fetchInterviews = async () => {
    try {
      const { data, error } = await supabase
        .from('user_interviews')
        .select(`
          id,
          interview_date,
          notes,
          result,
          interviewer_id,
          interviewer:interviewer_id(id, full_name)
        `)
        .eq('user_id', userId)
        .order('interview_date', { ascending: false });

      if (error) throw error;
      setInterviews(data as Interview[] || []);
      console.log('Fetched interviews:', data);
    } catch (error: any) {
      console.error('Error fetching interviews:', error);
      toast.error('Error loading interviews');
    }
  };

  const fetchInterviewers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name');

      if (error) throw error;

      console.log('Fetched interviewers:', data);
      setInterviewers(data || []);
    } catch (error) {
      console.error('Error fetching interviewers:', error);
      toast.error('Error fetching interviewers');
    }
  };

  const handleOpenDialog = (interview?: Interview) => {
    if (interview) {
      setSelectedInterview(interview);
      setFormData({
        interview_date: new Date(interview.interview_date).toISOString().slice(0, 16),
        notes: interview.notes,
        result: interview.result,
        interviewer_id: interview.interviewer?.id || '',
      });
    } else {
      setSelectedInterview(null);
      setFormData({
        interview_date: new Date().toISOString().slice(0, 16),
        notes: '',
        result: '',
        interviewer_id: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedInterview(null);
    setFormData({
      interview_date: new Date().toISOString().slice(0, 16),
      notes: '',
      result: '',
      interviewer_id: '',
    });
  };

  const handleSubmit = async () => {
    if (!formData.interview_date) {
      toast.error('Please select an interview date');
      return;
    }

    setLoading(true);
    try {
      if (selectedInterview) {
        // Update existing interview
        const { error } = await supabase
          .from('user_interviews')
          .update({
            interview_date: formData.interview_date,
            notes: formData.notes,
            result: formData.result,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedInterview.id);

        if (error) throw error;
        toast.success('Interview updated successfully');
      } else {
        // Create new interview
        const { error } = await supabase
          .from('user_interviews')
          .insert([{
            user_id: userId,
            interview_date: formData.interview_date,
            notes: formData.notes,
            result: formData.result,
            interviewer_id: formData.interviewer_id,
          }]);

        if (error) throw error;
        toast.success('Interview added successfully');
      }

      handleCloseDialog();
      onUpdate();
      fetchInterviews();
    } catch (error: any) {
      console.error('Error saving interview:', error);
      toast.error('Error saving interview');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (interviewId: string) => {
    if (!confirm('Are you sure you want to delete this interview?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_interviews')
        .delete()
        .eq('id', interviewId);

      if (error) throw error;
      toast.success('Interview deleted successfully');
      fetchInterviews();
    } catch (error: any) {
      console.error('Error deleting interview:', error);
      toast.error('Error deleting interview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, backgroundColor: 'background.default' }}>
      <Box mb={4}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Interviews
        </Typography>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<Plus />}
            onClick={() => handleOpenDialog()}
            sx={{ mt: 2 }}
          >
            Add Interview
          </Button>
        )}
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress size={28} />
        </Box>
      )}

      <Box>
        {interviews.map((interview) => (
          <Card 
            key={interview.id} 
            sx={{ 
              p: 3, 
              mb: 2,
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'box-shadow 0.3s ease-in-out'
              }
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
              <Box flex={1}>
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography 
                    variant="subtitle1" 
                    sx={{ 
                      fontWeight: 600,
                      color: 'primary.main'
                    }}
                  >
                    {format(new Date(interview.interview_date), 'PPp')}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      ml: 2,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1,
                      backgroundColor: interview.result === 'passed' 
                        ? 'success.lighter'
                        : interview.result === 'failed'
                        ? 'error.lighter'
                        : 'warning.lighter',
                      color: interview.result === 'passed'
                        ? 'success.dark'
                        : interview.result === 'failed'
                        ? 'error.dark'
                        : 'warning.dark',
                    }}
                  >
                    {interview.result ? interview.result.charAt(0).toUpperCase() + interview.result.slice(1) : 'Pending'}
                  </Typography>
                </Box>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    mb: 2,
                    color: 'text.secondary',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  Interviewer: {interview.interviewer?.full_name || 'Not specified'}
                </Typography>
                <Typography 
                  variant="body1" 
                  sx={{
                    whiteSpace: 'pre-line',
                    color: 'text.primary',
                    lineHeight: 1.6
                  }}
                >
                  {interview.notes}
                </Typography>
              </Box>
              {canEdit && (
                <Box ml={2} sx={{ display: 'flex', gap: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(interview)}
                    sx={{ 
                      color: 'primary.main',
                      '&:hover': { backgroundColor: 'primary.lighter' }
                    }}
                  >
                    <Edit2 size={18} />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(interview.id)}
                    sx={{ '&:hover': { backgroundColor: 'error.lighter' } }}
                  >
                    <Trash2 size={18} />
                  </IconButton>
                </Box>
              )}
            </Box>
          </Card>
        ))}

        {interviews.length === 0 && (
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
              No interviews recorded yet.
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
          <Typography variant="h6">
            {selectedInterview ? 'Edit Interview' : 'Add Interview'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              fullWidth
              type="datetime-local"
              label="Interview Date"
              value={formData.interview_date}
              onChange={(e) => setFormData({ ...formData, interview_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Enter interview notes..."
            />
            <TextField
              select
              fullWidth
              label="Result"
              value={formData.result}
              onChange={(e) => setFormData({ ...formData, result: e.target.value as 'passed' | 'failed' | 'pending' | '' })}
              SelectProps={{
                native: true
              }}
            >
              <option value="">Select Result</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </TextField>
            <TextField
              select
              fullWidth
              label="Interviewer"
              value={formData.interviewer_id}
              onChange={(e) => {
                console.log('Selected interviewer ID:', e.target.value);
                setFormData({ ...formData, interviewer_id: e.target.value });
              }}
              SelectProps={{
                native: true
              }}
            >
              <option value="">Select Interviewer</option>
              {interviewers.map((interviewer) => (
                <option key={interviewer.id} value={interviewer.id}>
                  {interviewer.full_name}
                </option>
              ))}
            </TextField>
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