import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Card,
  Tabs,
  Tab,
  IconButton,
} from '@mui/material';
import { ArrowLeft, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CVSection } from '../components/user/CVSection';
import { InterviewSection } from '../components/user/InterviewSection';
import { ProjectsSection } from '../components/user/ProjectsSection';
import { NotesSection } from '../components/user/NotesSection';
import { useAuth } from '../contexts/auth/AuthContext';
import toast from 'react-hot-toast';
import UserAnalysis from '../components/user/UserAnalysis';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && children}
    </div>
  );
}

export function UserDetailsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (userId) {
      fetchUserDetails();
    }
  }, [userId]);

  const fetchUserDetails = async () => {
    try {
      // First fetch the user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Then fetch related knowledge base data
      const [
        { data: cvData },
        { data: interviewData },
        { data: projectData },
        { data: notesData }
      ] = await Promise.all([
        supabase
          .from('user_cvs')
          .select('*')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('user_interviews')
          .select(`
            *,
            interviewer:interviewer_id(full_name)
          `)
          .eq('user_id', userId)
          .order('interview_date', { ascending: false }),
        supabase
          .from('user_projects')
          .select(`
            *,
            project:project_id(name)
          `)
          .eq('user_id', userId)
          .order('start_date', { ascending: false }),
        supabase
          .from('user_notes')
          .select(`
            *,
            creator:created_by(full_name)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ]);

      setUser({
        ...userData,
        user_cvs: cvData || null,
        user_interviews: interviewData || [],
        user_projects: projectData || [],
        user_notes: notesData || []
      });
    } catch (error: any) {
      console.error('Error fetching user details:', error);
      toast.error('Error loading user details');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const canEdit = currentUser?.role === 'admin' || currentUser?.id === userId;
  const canEditNotes = currentUser?.role === 'project_manager';

  // Prevent project managers from viewing admin or other project managers' information
  if (currentUser?.role === 'project_manager' && 
      ((user?.role === 'project_manager' || user?.role === 'admin') && 
      currentUser?.id !== userId)) {
    return (
      <Box 
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          p: 4
        }}
      >
        <Card 
          elevation={0}
          sx={{ 
            p: 4, 
            maxWidth: 400, 
            width: '100%',
            borderRadius: 2,
            bgcolor: 'error.lighter',
            border: '1px solid',
            borderColor: 'error.light'
          }}
        >
          <Box sx={{ mb: 3 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: 'error.light',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                mb: 2
              }}
            >
              <Lock size={32} color="currentColor" style={{ color: '#d32f2f' }} />
            </Box>
            <Typography variant="h5" color="error.main" gutterBottom>
              Access Denied
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {user?.role === 'admin' 
                ? "Project managers cannot view administrator information."
                : "Project managers cannot view other project managers' information."}
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={() => navigate('/users')}
            startIcon={<ArrowLeft />}
            sx={{
              bgcolor: 'error.main',
              '&:hover': {
                bgcolor: 'error.dark',
              }
            }}
          >
            Back to Users List
          </Button>
        </Card>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box textAlign="center" p={4}>
        <Typography>User not found</Typography>
        <Button onClick={() => navigate('/users')}>Back to Users</Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box mb={4} display="flex" alignItems="center" gap={2}>
        <IconButton onClick={() => navigate('/users')}>
          <ArrowLeft />
        </IconButton>
        <Box>
          <Typography variant="h5">
            {user.full_name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user.email}
          </Typography>
        </Box>
      </Box>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="user details tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="CV" />
            <Tab label="Interviews" />
            <Tab label="Projects" />
            <Tab label="Notes" />
            <Tab label="User Analysis" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <CVSection
            userId={userId!}
            canEdit={canEdit}
            onUpdate={fetchUserDetails}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <InterviewSection
            userId={userId!}
            canEdit={canEdit}
            onUpdate={fetchUserDetails}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <ProjectsSection
            userId={userId!}
            canEdit={canEdit}
            onUpdate={fetchUserDetails}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <NotesSection
            userId={userId!}
            canEdit={canEditNotes}
            onUpdate={fetchUserDetails}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <UserAnalysis userId={userId!} />
        </TabPanel>
      </Card>
    </Box>
  );
} 