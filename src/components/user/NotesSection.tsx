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
  Stack,
  Divider,
  Grid,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Plus, Edit2, Trash2, User, Clock } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

interface Note {
  id: string;
  note: string;
  created_at: string;
  created_by: string;
  creator?: {
    full_name: string;
  };
}

interface NotesSectionProps {
  userId: string;
  canEdit: boolean;
  onUpdate: () => void;
}

export function NotesSection({ userId, canEdit, onUpdate }: NotesSectionProps) {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [formData, setFormData] = useState({
    note: '',
    created_by: ''
  });
  const [creatorName, setCreatorName] = useState<string>('');
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);

  useEffect(() => {
    fetchNotes();
    fetchUsers();
    if (currentUser?.id) {
      fetchCreatorName(currentUser.id);
      setFormData(prev => ({ ...prev, created_by: currentUser.id }));
    }
  }, [userId, currentUser?.id]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('user_notes')
        .select(`
          *,
          creator:created_by(full_name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error: any) {
      console.error('Error fetching notes:', error);
      toast.error('Error loading notes');
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error loading users');
    }
  };

  const fetchCreatorName = async (creatorId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', creatorId)
        .single();

      if (error) throw error;
      setCreatorName(data?.full_name || 'Unknown');
    } catch (error) {
      console.error('Error fetching creator name:', error);
      setCreatorName('Unknown');
    }
  };

  const handleOpenDialog = async (note?: Note) => {
    if (note) {
      setSelectedNote(note);
      setFormData({
        note: note.note,
        created_by: note.created_by
      });
    } else {
      setSelectedNote(null);
      if (currentUser?.id) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', currentUser.id)
            .single();

          if (error) throw error;
          setCreatorName(data.full_name);
          setFormData({
            note: '',
            created_by: currentUser.id
          });
        } catch (error) {
          console.error('Error fetching current user name:', error);
          setCreatorName('Unknown');
        }
      }
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedNote(null);
    setFormData({
      note: '',
      created_by: ''
    });
  };

  const handleSubmit = async () => {
    if (!formData.note.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setLoading(true);
    try {
      if (selectedNote) {
        // Update existing note
        const { error } = await supabase
          .from('user_notes')
          .update({
            note: formData.note.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedNote.id);

        if (error) throw error;
        toast.success('Note updated successfully');
      } else {
        // Create new note
        const { error } = await supabase
          .from('user_notes')
          .insert([{
            user_id: userId,
            note: formData.note.trim(),
            created_by: formData.created_by,
          }]);

        if (error) throw error;
        toast.success('Note added successfully');
      }

      handleCloseDialog();
      onUpdate();
      fetchNotes();
    } catch (error: any) {
      console.error('Error saving note:', error);
      toast.error('Error saving note');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      toast.success('Note deleted successfully');
      fetchNotes();
    } catch (error: any) {
      console.error('Error deleting note:', error);
      toast.error('Error deleting note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, backgroundColor: 'background.default' }}>
      <Box mb={4}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Notes
        </Typography>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<Plus />}
            onClick={() => handleOpenDialog()}
            sx={{ mt: 2 }}
          >
            Add Note
          </Button>
        )}
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress size={28} />
        </Box>
      )}

      <Box>
        {notes.map((note) => (
          <Card key={note.id} sx={{ mb: 2, p: 2 }}>
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                    {note.note}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <User size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Added by {note.creator?.full_name || 'Unknown'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Clock size={16} />
                      <Typography variant="body2" color="text.secondary">
                        {format(new Date(note.created_at), 'PPp')}
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>
              </Grid>
              {canEdit && (
                <>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(note)}
                      sx={{ 
                        color: 'primary.main',
                        '&:hover': { backgroundColor: 'primary.lighter' }
                      }}
                    >
                      <Edit2 size={18} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(note.id)}
                      sx={{ 
                        color: 'error.main',
                        '&:hover': { backgroundColor: 'error.lighter' }
                      }}
                    >
                      <Trash2 size={18} />
                    </IconButton>
                  </Box>
                </>
              )}
            </Stack>
          </Card>
        ))}

        {notes.length === 0 && (
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
              No notes recorded yet.
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
          <Typography 
            variant="subtitle1" 
            component="div" 
            sx={{ fontSize: '1.25rem', fontWeight: 600 }}
          >
            {selectedNote ? 'Edit Note' : 'Add Note'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <FormControl fullWidth>
              <InputLabel>Added by</InputLabel>
              <Select
                value={formData.created_by}
                label="Added by"
                onChange={(e) => setFormData({ ...formData, created_by: e.target.value })}
              >
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.full_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="Enter your note here..."
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