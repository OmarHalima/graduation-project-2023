import { useState, useEffect } from 'react';
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
}

export function ProjectKnowledgebase({ projectId, canEdit }: ProjectKnowledgebaseProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
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
      await Promise.all([
        fetchDocuments(),
        fetchFAQs(),
        fetchResources(),
        fetchTeamMembers(),
      ]);
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
      const { data, error } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
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
            {canEdit && (
              <Button
                variant="contained"
                startIcon={<Plus />}
                onClick={() => handleOpenDialog('document')}
                sx={{ mb: 3 }}
              >
                Add Document
              </Button>
            )}
            
            {documents.length > 0 ? (
              <List>
                {documents.map((doc) => (
                  <ListItem
                    key={doc.id}
                    sx={{
                      bgcolor: 'background.paper',
                      mb: 2,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
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
                            label={doc.category}
                            size="small"
                            sx={{ mt: 1 }}
                          />
                        </Box>
                      }
                    />
                    {canEdit && (
                      <Box>
                        <IconButton
                          onClick={() => handleOpenDialog('document', doc)}
                          size="small"
                        >
                          <Edit2 size={16} />
                        </IconButton>
                        <IconButton
                          onClick={() => handleDelete('document', doc.id)}
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
                No documents added yet
              </Typography>
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
                          <Typography noWrap>
                            {member.user?.department || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell width={150}>
                        <Tooltip title={member.user?.position || '-'}>
                          <Typography noWrap>
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
                                </Tooltip>
                              ))}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell width={150}>
                        <Tooltip title={member.knowledge?.work_experience || '-'}>
                          <Typography
                            variant="body2"
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
                          <Typography noWrap>
                            {member.knowledge?.languages || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell width={150}>
                        <Tooltip title={member.knowledge?.education || '-'}>
                          <Typography
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
          {editItem ? 'Edit' : 'Add'} {dialogType === 'document' ? 'Document' : dialogType === 'faq' ? 'FAQ' : 'Resource'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {dialogType === 'document' && (
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
                  label="Category"
                  fullWidth
                  value={formData.category}
                  onChange={handleInputChange('category')}
                  sx={{ mb: 2 }}
                  required
                />
                <TextField
                  label="Content"
                  multiline
                  rows={10}
                  fullWidth
                  value={formData.content}
                  onChange={handleInputChange('content')}
                  helperText="Supports Markdown formatting"
                  required
                />
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (dialogType === 'document') {
                handleSaveDocument(formData);
              } else if (dialogType === 'faq') {
                handleSaveFAQ(formData);
              } else {
                handleSaveResource(formData);
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 