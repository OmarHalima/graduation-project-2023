import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Chip,
  Avatar,
  Card,
  CardContent,
  Grid,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  MenuItem,
  Collapse,
  Select,
} from '@mui/material';
import {
  FileText,
  HelpCircle,
  Link as LinkIcon,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  File,
  Download,
  Users,
  Briefcase,
  Award,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/auth/AuthContext';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';

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
      id={`knowledgebase-tabpanel-${index}`}
      aria-labelledby={`knowledgebase-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface DocumentItem {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

interface ResourceItem {
  id: string;
  title: string;
  url: string;
  description: string;
  type: string;
  created_at: string;
}

interface TeamMemberRecord {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    department: string | null;
    position: string | null;
  };
  knowledge: {
    education: string | null;
    skills: string | null;
    languages: string | null;
    certifications: string | null;
    work_experience: string | null;
  } | null;
}

interface ProjectKnowledgebaseProps {
  projectId: string;
  canEdit: boolean;
  key?: string;
}

export function ProjectKnowledgebase({ projectId, canEdit }: ProjectKnowledgebaseProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [completedPhases, setCompletedPhases] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'document' | 'faq' | 'resource'>('document');
  const [editItem, setEditItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    question: '',
    answer: '',
    url: '',
    description: '',
    type: 'link'
  });
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, [projectId]);

  useEffect(() => {
    if (editItem) {
      setFormData({
        title: editItem.title || '',
        content: editItem.content || '',
        category: editItem.category || '',
        question: editItem.question || '',
        answer: editItem.answer || '',
        url: editItem.url || '',
        description: editItem.description || '',
        type: editItem.type || 'link'
      });
    } else {
      setFormData({
        title: '',
        content: '',
        category: '',
        question: '',
        answer: '',
        url: '',
        description: '',
        type: 'link'
      });
    }
  }, [editItem]);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching all knowledge base data');
      await Promise.all([
        fetchDocuments(),
        fetchFAQs(),
        fetchResources(),
        fetchTeamMembers(),
        fetchCompletedTasks(),
        fetchCompletedPhases(),
      ]);
    } catch (error) {
      console.error('Error fetching knowledge base data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      // First fetch project members with user data
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select(`
          id,
          project_id,
          user_id,
          role,
          joined_at,
          created_at,
          updated_at,
          user:users(
            id,
            full_name,
            email,
            avatar_url,
            department,
            position
          )
        `)
        .eq('project_id', projectId)
        .order('joined_at', { ascending: false });

      if (memberError) {
        console.error('Error fetching team members:', memberError);
        toast.error('Failed to load team members');
        return;
      }

      // Then fetch CV data for all members
      const userIds = memberData?.map(member => member.user_id) || [];
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
        // Don't return here, we can still show member data without CV info
      }

      // Combine the data
      const transformedData = (memberData || []).map((item: any): TeamMemberRecord => ({
        id: item.id,
        project_id: item.project_id,
        user_id: item.user_id,
        role: item.role,
        joined_at: item.joined_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
        user: Array.isArray(item.user) ? item.user[0] : item.user,
        knowledge: cvData?.find(cv => cv.user_id === item.user_id) || null
      }));

      setTeamMembers(transformedData);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error loading team members');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleOpenDialog = (type: 'document' | 'faq' | 'resource', item?: any) => {
    setDialogType(type);
    setEditItem(item);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditItem(null);
  };

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleSaveDocument = async (formData: any) => {
    try {
      const { title, content, category } = formData;
      
      if (editItem) {
        const { error } = await supabase
          .from('project_documents')
          .update({
            title,
            content,
            category,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editItem.id);

        if (error) throw error;
        toast.success('Document updated successfully');
      } else {
        const { error } = await supabase
          .from('project_documents')
          .insert({
            project_id: projectId,
            title,
            content,
            category,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success('Document created successfully');
      }

      handleCloseDialog();
      fetchDocuments();
    } catch (error: any) {
      console.error('Error saving document:', error);
      toast.error('Error saving document');
    }
  };

  const handleSaveFAQ = async (formData: any) => {
    try {
      const { question, answer } = formData;
      
      if (editItem) {
        const { error } = await supabase
          .from('project_faqs')
          .update({
            question,
            answer,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editItem.id);

        if (error) throw error;
        toast.success('FAQ updated successfully');
      } else {
        const { error } = await supabase
          .from('project_faqs')
          .insert({
            project_id: projectId,
            question,
            answer,
          });

        if (error) throw error;
        toast.success('FAQ created successfully');
      }

      handleCloseDialog();
      fetchFAQs();
    } catch (error: any) {
      console.error('Error saving FAQ:', error);
      toast.error('Error saving FAQ');
    }
  };

  const handleSaveResource = async (formData: any) => {
    try {
      const { title, url, description, type } = formData;
      
      if (editItem) {
        const { error } = await supabase
          .from('project_resources')
          .update({
            title,
            url,
            description,
            type,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editItem.id);

        if (error) throw error;
        toast.success('Resource updated successfully');
      } else {
        const { error } = await supabase
          .from('project_resources')
          .insert({
            project_id: projectId,
            title,
            url,
            description,
            type,
          });

        if (error) throw error;
        toast.success('Resource created successfully');
      }

      handleCloseDialog();
      fetchResources();
    } catch (error: any) {
      console.error('Error saving resource:', error);
      toast.error('Error saving resource');
    }
  };

  const fetchDocuments = async () => {
    try {
      console.log('Fetching documents for project:', projectId);
      const { data, error } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        throw error;
      }
      
      console.log('Successfully fetched documents:', data?.length);
      
      // Extract unique categories from documents
      const uniqueCategories = Array.from(
        new Set(data?.map(doc => {
          // Map old categories to new ones for the filter
          if (doc.category === 'Project Progress') {
            if (doc.title === 'Completed Tasks Log') {
              return 'Task Logs';
            } else if (doc.title === 'Project Phases Progress') {
              return 'Phase Logs';
            }
          }
          return doc.category || 'Uncategorized';
        }))
      ).filter(Boolean) as string[];
      
      // Always include important categories
      const allCategories = ['all'];
      
      // Add core categories
      const coreCategories = ['Documentation', 'Task Logs', 'Phase Logs', 'Direct Task Logs', 'Direct Phase Logs'];
      coreCategories.forEach(category => {
        if (!allCategories.includes(category)) {
          allCategories.push(category);
        }
      });
      
      // Add other unique categories found in documents
      uniqueCategories.forEach(category => {
        if (!allCategories.includes(category)) {
          allCategories.push(category);
        }
      });
      
      console.log('Setting categories:', allCategories);
      setCategories(allCategories);
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      // Set default categories even if document fetch fails
      setCategories(['all', 'Documentation', 'Task Logs', 'Phase Logs', 'Direct Task Logs', 'Direct Phase Logs']);
      setDocuments([]);
    }
  };

  const fetchFAQs = async () => {
    try {
      const { data, error } = await supabase
        .from('project_faqs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFaqs(data || []);
    } catch (error) {
      console.error('Error fetching FAQs:', error);
    }
  };

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('project_resources')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResources(data || []);
    } catch (error) {
      console.error('Error fetching resources:', error);
    }
  };

  const fetchCompletedTasks = async () => {
    try {
      console.log('Fetching completed tasks for project:', projectId);
      
      // Try a simplified query without joins that were causing errors
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching completed tasks:', error);
        throw error;
      }
      
      console.log('Successfully fetched completed tasks:', data?.length);
      
      // Get assignee names in a separate query if needed
      if (data && data.length > 0) {
        const userIds = data
          .map(task => task.assigned_to)
          .filter(id => id !== null && id !== undefined);
        
        if (userIds.length > 0) {
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('id, full_name')
              .in('id', userIds);
            
            if (userData) {
              // Enhance tasks with user names
              const enhancedTasks = data.map(task => {
                const user = userData.find(u => u.id === task.assigned_to);
                return {
                  ...task,
                  assignee_name: user ? user.full_name : 'Unknown'
                };
              });
              
              setCompletedTasks(enhancedTasks);
              return;
            }
          } catch (userError) {
            console.error('Error fetching user data for tasks:', userError);
          }
        }
      }
      
      setCompletedTasks(data || []);
    } catch (error) {
      console.error('Failed to fetch completed tasks:', error);
      setCompletedTasks([]);
    }
  };

  const fetchCompletedPhases = async () => {
    try {
      console.log('Fetching completed phases for project:', projectId);
      
      // Try a simplified query without joins that were causing errors
      const { data, error } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching completed phases:', error);
        throw error;
      }
      
      console.log('Successfully fetched completed phases:', data?.length);
      
      // Get creator names in a separate query if needed
      if (data && data.length > 0) {
        const userIds = data
          .map(phase => phase.created_by)
          .filter(id => id !== null && id !== undefined);
        
        if (userIds.length > 0) {
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('id, full_name')
              .in('id', userIds);
            
            if (userData) {
              // Enhance phases with creator names
              const enhancedPhases = data.map(phase => {
                const user = userData.find(u => u.id === phase.created_by);
                return {
                  ...phase,
                  creator_name: user ? user.full_name : 'Unknown'
                };
              });
              
              setCompletedPhases(enhancedPhases);
              return;
            }
          } catch (userError) {
            console.error('Error fetching user data for phases:', userError);
          }
        }
      }
      
      setCompletedPhases(data || []);
    } catch (error) {
      console.error('Failed to fetch completed phases:', error);
      setCompletedPhases([]);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await supabase
        .from(`project_${type}s`)
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Item deleted successfully');
      
      if (type === 'document') fetchDocuments();
      else if (type === 'faq') fetchFAQs();
      else if (type === 'resource') fetchResources();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Error deleting item');
    }
  };

  const handleDocumentClick = (docId: string) => {
    setSelectedDocumentId(prevId => prevId === docId ? null : docId);
  };

  const renderDirectTaskLogs = () => {
    if (completedTasks.length === 0) {
      return (
        <Typography color="text.secondary" align="center">
          No completed tasks found
        </Typography>
      );
    }

    return (
      <List>
        {completedTasks.map((task) => (
          <ListItem
            key={task.id}
            sx={{
              bgcolor: 'background.paper',
              mb: 2,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <ListItemIcon>
              <File size={20} />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="subtitle1">
                  {task.title}
                </Typography>
              }
              secondary={
                <Box>
                  <Typography variant="body2" component="div">
                    {task.description}
                  </Typography>
                  <Box mt={1} display="flex" flexWrap="wrap" gap={1}>
                    <Chip 
                      label={`Priority: ${task.priority}`} 
                      size="small" 
                      color={task.priority === 'high' ? 'error' : (task.priority === 'medium' ? 'warning' : 'default')}
                    />
                    <Chip 
                      label={`Assigned to: ${task.assignee_name || task.assigned_to || 'Unknown'}`} 
                      size="small" 
                      variant="outlined" 
                    />
                    <Chip 
                      label="Phase Task" 
                      size="small" 
                      variant="outlined" 
                    />
                    {task.due_date && (
                      <Chip 
                        label={`Due: ${format(new Date(task.due_date), 'MMM d, yyyy')}`} 
                        size="small" 
                        variant="outlined" 
                      />
                    )}
                    {task.estimated_hours && (
                      <Chip 
                        label={`Est. Hours: ${task.estimated_hours}`} 
                        size="small" 
                        variant="outlined" 
                      />
                    )}
                    <Chip 
                      label={`Completed: ${format(new Date(task.updated_at), 'MMM d, yyyy')}`} 
                      size="small" 
                      color="success" 
                    />
                  </Box>
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>
    );
  };

  const renderDirectPhaseLogs = () => {
    if (completedPhases.length === 0) {
      return (
        <Typography color="text.secondary" align="center">
          No completed phases found
        </Typography>
      );
    }

    return (
      <List>
        {completedPhases.map((phase) => (
          <ListItem
            key={phase.id}
            sx={{
              bgcolor: 'background.paper',
              mb: 2,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <ListItemIcon>
              <Briefcase size={20} />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="subtitle1">
                  {phase.name}
                </Typography>
              }
              secondary={
                <Box>
                  <Typography variant="body2" component="div">
                    {phase.description}
                  </Typography>
                  <Box mt={1} display="flex" flexWrap="wrap" gap={1}>
                    <Chip 
                      label={`Sequence: ${phase.sequence_order}`} 
                      size="small" 
                      variant="outlined" 
                    />
                    <Chip 
                      label={`Created by: ${phase.creator_name || phase.created_by || 'Unknown'}`} 
                      size="small" 
                      variant="outlined" 
                    />
                    {phase.start_date && (
                      <Chip 
                        label={`Start: ${format(new Date(phase.start_date), 'MMM d, yyyy')}`} 
                        size="small" 
                        variant="outlined" 
                      />
                    )}
                    {phase.end_date && (
                      <Chip 
                        label={`End: ${format(new Date(phase.end_date), 'MMM d, yyyy')}`} 
                        size="small" 
                        variant="outlined" 
                      />
                    )}
                    <Chip 
                      label={`Completed: ${format(new Date(phase.updated_at), 'MMM d, yyyy')}`} 
                      size="small" 
                      color="success" 
                    />
                  </Box>
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>
    );
  };

  useEffect(() => {
    // Add direct task and phase log categories
    if ((completedTasks.length > 0 || completedPhases.length > 0) && categories.length > 0) {
      console.log('Updating categories with task and phase logs');
      const newCategories = [...categories];
      
      if (completedTasks.length > 0 && !newCategories.includes('Direct Task Logs')) {
        newCategories.push('Direct Task Logs');
      }
      
      if (completedPhases.length > 0 && !newCategories.includes('Direct Phase Logs')) {
        newCategories.push('Direct Phase Logs');
      }
      
      if (newCategories.length !== categories.length) {
        console.log('Setting new categories:', newCategories);
        setCategories(newCategories);
      }
    }
  }, [completedTasks, completedPhases, categories]);

  // Ensure we always have Direct Task Logs category if we have completed tasks
  useEffect(() => {
    if (completedTasks.length > 0 && !categoryFilter.includes('Task')) {
      console.log('Adding Direct Task Logs to categories');
      setCategories(prev => {
        if (!prev.includes('Direct Task Logs')) {
          return [...prev, 'Direct Task Logs'];
        }
        return prev;
      });
    }
  }, [completedTasks, categoryFilter]);

  // Filter documents by category
  const filteredDocuments = useMemo(() => {
    console.log('Filtering documents by category:', categoryFilter);
    console.log('Available documents:', documents.length);
    console.log('Completed tasks:', completedTasks.length);
    
    if (categoryFilter === 'all') {
      return documents;
    }
    
    if (categoryFilter === 'Direct Task Logs') {
      return []; // We render tasks separately
    }
    
    if (categoryFilter === 'Direct Phase Logs') {
      return []; // We render phases separately
    }
    
    return documents.filter(doc => {
      // Handle both old and new category names
      if (categoryFilter === 'Task Logs') {
        return doc.category === 'Task Logs' || 
               doc.category === 'Completed Tasks' ||
               (doc.category === 'Project Progress' && doc.title === 'Completed Tasks Log') ||
               (doc.category === 'Project Progress' && doc.title === 'Task Logs') ||
               (doc.title && doc.title.toLowerCase().includes('task'));
      } else if (categoryFilter === 'Phase Logs') {
        return doc.category === 'Phase Logs' || 
               doc.category === 'Completed Phases' ||
               (doc.category === 'Project Progress' && doc.title === 'Project Phases Progress') ||
               (doc.category === 'Project Progress' && doc.title === 'Phase Logs') ||
               (doc.title && doc.title.toLowerCase().includes('phase'));
      } else {
        return doc.category === categoryFilter;
      }
    });
  }, [categoryFilter, documents, completedTasks, completedPhases]);
  
  // Map category display names for UI
  const getCategoryDisplayName = (category: string, title: string): string => {
    if (category === 'Project Progress') {
      if (title === 'Completed Tasks Log') {
        return 'Task Logs';
      } else if (title === 'Project Phases Progress') {
        return 'Phase Logs';
      }
    }
    return category;
  };

  return (
    <Box>
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            px: 2,
          }}
        >
          <Tab
            icon={<FileText size={18} />}
            label="Documentation"
            iconPosition="start"
          />
          <Tab
            icon={<HelpCircle size={18} />}
            label="FAQs"
            iconPosition="start"
          />
          <Tab
            icon={<LinkIcon size={18} />}
            label="Resources"
            iconPosition="start"
          />
          <Tab
            icon={<Users size={18} />}
            label="Team Members"
            iconPosition="start"
          />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <Box px={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="subtitle1">Filter by category:</Typography>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  size="small"
                  sx={{ minWidth: 200 }}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  
                  {/* Task Categories */}
                  <MenuItem 
                    value="Direct Task Logs" 
                    sx={{ 
                      fontWeight: completedTasks.length > 0 ? 'bold' : 'normal',
                      color: completedTasks.length > 0 ? 'primary.main' : 'inherit'
                    }}
                  >
                    Completed Tasks ({completedTasks.length})
                  </MenuItem>
                  
                  {/* Phase Categories */}
                  <MenuItem 
                    value="Direct Phase Logs" 
                    sx={{ 
                      fontWeight: completedPhases.length > 0 ? 'bold' : 'normal',
                      color: completedPhases.length > 0 ? 'primary.main' : 'inherit'
                    }}
                  >
                    Completed Phases ({completedPhases.length})
                  </MenuItem>
                  
                  {/* Divider */}
                  <Divider />
                  
                  {/* Other Categories */}
                  {categories
                    .filter(cat => 
                      cat !== 'all' && 
                      cat !== 'Direct Task Logs' && 
                      cat !== 'Direct Phase Logs'
                    )
                    .sort() // Sort alphabetically
                    .map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                  ))}
                </Select>
              </Box>
              
              {canEdit && (
                <Button
                  variant="contained"
                  startIcon={<Plus />}
                  onClick={() => handleOpenDialog('document')}
                >
                  Add Document
                </Button>
              )}
            </Box>
            
            {/* Render direct task logs when that filter is selected */}
            {categoryFilter === 'Direct Task Logs' && renderDirectTaskLogs()}
            
            {/* Render direct phase logs when that filter is selected */}
            {categoryFilter === 'Direct Phase Logs' && renderDirectPhaseLogs()}
            
            {/* Render regular documents for other categories */}
            {categoryFilter !== 'Direct Task Logs' && categoryFilter !== 'Direct Phase Logs' && (
              filteredDocuments.length > 0 ? (
                <List>
                  {filteredDocuments.map((doc) => (
                    <Box key={doc.id}>
                      <ListItem
                        sx={{
                          bgcolor: 'background.paper',
                          mb: selectedDocumentId === doc.id ? 0 : 2,
                          borderRadius: selectedDocumentId === doc.id ? '8px 8px 0 0' : 8,
                          border: '1px solid',
                          borderColor: 'divider',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleDocumentClick(doc.id)}
                      >
                        <ListItemIcon>
                          <BookOpen size={20} />
                        </ListItemIcon>
                        <ListItemText
                          primary={doc.title}
                          secondary={
                            <Box>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Last updated: {new Date(doc.updated_at).toLocaleDateString()}
                              </Typography>
                              <Chip
                                label={getCategoryDisplayName(doc.category, doc.title)}
                                size="small"
                                sx={{ mt: 1 }}
                              />
                            </Box>
                          }
                        />
                        <Box display="flex" alignItems="center">
                          {selectedDocumentId === doc.id ? 
                            <ChevronUp size={18} /> : 
                            <ChevronDown size={18} />
                          }
                          {canEdit && (
                            <Box ml={1}>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDialog('document', doc);
                                }}
                                size="small"
                              >
                                <Edit2 size={16} />
                              </IconButton>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete('document', doc.id);
                                }}
                                size="small"
                                color="error"
                              >
                                <Trash2 size={16} />
                              </IconButton>
                            </Box>
                          )}
                        </Box>
                      </ListItem>
                      <Collapse in={selectedDocumentId === doc.id}>
                        <Paper 
                          variant="outlined" 
                          sx={{ 
                            p: 3, 
                            borderTop: 0,
                            borderRadius: '0 0 8px 8px',
                            mb: 2,
                            bgcolor: 'background.default'
                          }}
                        >
                          <ReactMarkdown components={{
                            p: ({ node, ...props }) => <p style={{ margin: '0.5em 0' }} {...props} />
                          }}>
                            {doc.content}
                          </ReactMarkdown>
                        </Paper>
                      </Collapse>
                    </Box>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary" align="center">
                  {categoryFilter === 'all' 
                    ? 'No documents added yet' 
                    : `No documents found in the "${categoryFilter}" category`}
                </Typography>
              )
            )}
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Box px={3}>
            {canEdit && (
              <Button
                variant="contained"
                startIcon={<Plus />}
                onClick={() => handleOpenDialog('faq')}
                sx={{ mb: 3 }}
              >
                Add FAQ
              </Button>
            )}
            
            {faqs.length > 0 ? (
              <List>
                {faqs.map((faq) => (
                  <ListItem
                    key={faq.id}
                    sx={{
                      bgcolor: 'background.paper',
                      mb: 2,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <ListItemIcon>
                      <HelpCircle size={20} />
                    </ListItemIcon>
                    <ListItemText
                      primary={faq.question}
                      secondary={
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 1 }}
                        >
                          {faq.answer}
                        </Typography>
                      }
                    />
                    {canEdit && (
                      <Box>
                        <IconButton
                          onClick={() => handleOpenDialog('faq', faq)}
                          size="small"
                        >
                          <Edit2 size={16} />
                        </IconButton>
                        <IconButton
                          onClick={() => handleDelete('faq', faq.id)}
                          size="small"
                          color="error"
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Box>
                    )}
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary" align="center">
                No FAQs added yet
              </Typography>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Box px={3}>
            {canEdit && (
              <Button
                variant="contained"
                startIcon={<Plus />}
                onClick={() => handleOpenDialog('resource')}
                sx={{ mb: 3 }}
              >
                Add Resource
              </Button>
            )}
            
            {resources.length > 0 ? (
              <List>
                {resources.map((resource) => (
                  <ListItem
                    key={resource.id}
                    sx={{
                      bgcolor: 'background.paper',
                      mb: 2,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <ListItemIcon>
                      {resource.type === 'link' ? (
                        <LinkIcon size={20} />
                      ) : (
                        <File size={20} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={resource.title}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {resource.description}
                          </Typography>
                          <Button
                            startIcon={<Download size={16} />}
                            href={resource.url}
                            target="_blank"
                            size="small"
                            sx={{ mt: 1 }}
                          >
                            Access Resource
                          </Button>
                        </Box>
                      }
                    />
                    {canEdit && (
                      <Box>
                        <IconButton
                          onClick={() => handleOpenDialog('resource', resource)}
                          size="small"
                        >
                          <Edit2 size={16} />
                        </IconButton>
                        <IconButton
                          onClick={() => handleDelete('resource', resource.id)}
                          size="small"
                          color="error"
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Box>
                    )}
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary" align="center">
                No resources added yet
              </Typography>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Box px={3}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell width={200}>Member</TableCell>
                    <TableCell width={100}>Role</TableCell>
                    <TableCell width={150}>Department</TableCell>
                    <TableCell width={150}>Position</TableCell>
                    <TableCell width={150}>Skills</TableCell>
                    <TableCell width={150}>Work Experience</TableCell>
                    <TableCell width={150}>Languages</TableCell>
                    <TableCell width={150}>Education</TableCell>
                    <TableCell width={120}>Joined At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teamMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell width={200}>
                        <Box display="flex" alignItems="center" gap={2}>
                          {member.user?.avatar_url ? (
                            <Avatar src={member.user.avatar_url} />
                          ) : (
                            <Avatar>{member.user?.full_name?.[0]}</Avatar>
                          )}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" noWrap>
                              {member.user?.full_name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {member.user?.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell width={100}>
                        <Chip 
                          label={member.role} 
                          color={member.role === 'manager' ? 'primary' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell width={150}>
                        <Tooltip title={member.user?.department || '-'}>
                          <Typography component="div" noWrap>
                            {member.user?.department || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell width={150}>
                        <Tooltip title={member.user?.position || '-'}>
                          <Typography component="div" noWrap>
                            {member.user?.position || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell width={150}>
                        <Box 
                          sx={{
                            maxHeight: 80,
                            overflowY: 'auto',
                            '&::-webkit-scrollbar': {
                              width: '6px'
                            },
                            '&::-webkit-scrollbar-thumb': {
                              backgroundColor: 'rgba(0,0,0,0.2)',
                              borderRadius: '3px'
                            }
                          }}
                        >
                          <Box display="flex" gap={0.5} flexWrap="wrap">
                            {member.knowledge?.skills?.split(',')
                              .filter((skill): skill is string => Boolean(skill))
                              .map((skill, index) => (
                                <Tooltip key={index} title={skill.trim()}>
                                  <div>
                                    <Chip
                                      label={skill.trim()}
                                      size="small"
                                      variant="outlined"
                                      sx={{ 
                                        maxWidth: '140px',
                                        '& .MuiChip-label': {
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          maxWidth: '130px'
                                        }
                                      }}
                                    />
                                  </div>
                                </Tooltip>
                              ))}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell width={150}>
                        <Tooltip title={member.knowledge?.work_experience || '-'}>
                          <Typography
                            variant="body2"
                            component="div"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: '1.4em',
                              maxHeight: '2.8em'
                            }}
                          >
                            {member.knowledge?.work_experience || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell width={150}>
                        <Tooltip title={member.knowledge?.languages || '-'}>
                          <Typography component="div" noWrap>
                            {member.knowledge?.languages || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell width={150}>
                        <Tooltip title={member.knowledge?.education || '-'}>
                          <Typography
                            component="div"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: '1.4em',
                              maxHeight: '2.8em'
                            }}
                          >
                            {member.knowledge?.education || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell width={120}>
                        {format(new Date(member.joined_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        </TabPanel>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editItem ? `Edit ${dialogType}` : `Add ${dialogType}`}
        </DialogTitle>
        <DialogContent>
          {dialogType === 'document' && (
            <Box sx={{ mt: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1">
                  {previewMode ? 'Preview' : 'Edit Document'}
                </Typography>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  {previewMode ? 'Edit' : 'Preview'}
                </Button>
              </Box>

              {previewMode ? (
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 3, 
                    borderRadius: 1,
                    minHeight: '300px',
                    maxHeight: '500px',
                    overflow: 'auto'
                  }}
                >
                  <Typography variant="h5" gutterBottom>
                    {formData.title}
                  </Typography>
                  <Chip
                    label={getCategoryDisplayName(formData.category, formData.title)}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  <ReactMarkdown components={{
                    p: ({ node, ...props }) => <p style={{ margin: '0.5em 0' }} {...props} />
                  }}>
                    {formData.content}
                  </ReactMarkdown>
                </Paper>
              ) : (
                <>
                  <TextField
                    label="Title"
                    value={formData.title}
                    onChange={handleInputChange('title')}
                    fullWidth
                    margin="normal"
                    required
                  />
                  <TextField
                    label="Category"
                    value={formData.category}
                    onChange={handleInputChange('category')}
                    fullWidth
                    margin="normal"
                  />
                  <TextField
                    label="Content (Markdown supported)"
                    value={formData.content}
                    onChange={handleInputChange('content')}
                    fullWidth
                    margin="normal"
                    multiline
                    rows={10}
                    required
                    helperText="Markdown formatting is supported. Use # for headings, * for lists, etc."
                  />
                </>
              )}
            </Box>
          )}

          {dialogType === 'faq' && (
            <Box>
              <TextField
                label="Question"
                fullWidth
                value={formData.question}
                onChange={handleInputChange('question')}
                sx={{ mb: 2 }}
                required
              />
              <TextField
                label="Answer"
                multiline
                rows={4}
                fullWidth
                value={formData.answer}
                onChange={handleInputChange('answer')}
                required
              />
            </Box>
          )}

          {dialogType === 'resource' && (
            <Box>
              <TextField
                label="Title"
                fullWidth
                value={formData.title}
                onChange={handleInputChange('title')}
                sx={{ mb: 2 }}
                required
              />
              <TextField
                label="URL"
                fullWidth
                value={formData.url}
                onChange={handleInputChange('url')}
                sx={{ mb: 2 }}
                required
              />
              <TextField
                label="Description"
                multiline
                rows={3}
                fullWidth
                value={formData.description}
                onChange={handleInputChange('description')}
                sx={{ mb: 2 }}
              />
              <TextField
                select
                label="Type"
                fullWidth
                value={formData.type}
                onChange={handleInputChange('type')}
              >
                <MenuItem value="link">External Link</MenuItem>
                <MenuItem value="document">Document</MenuItem>
                <MenuItem value="video">Video</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={() => {
              if (dialogType === 'document') {
                handleSaveDocument(formData);
              } else if (dialogType === 'faq') {
                handleSaveFAQ(formData);
              } else if (dialogType === 'resource') {
                handleSaveResource(formData);
              }
            }}
            variant="contained"
            color="primary"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 