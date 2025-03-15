import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Avatar,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  useTheme,
  Fade,
  CircularProgress,
  alpha,
} from '@mui/material';
import { Send, Bot, User, History, ChevronRight, Clock, Sparkles } from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/auth/AuthContext';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  conversation_id?: string;
}

interface Conversation {
  id: string;
  session_id: string;
  title: string;
  timestamp: Date;
  messages: Message[];
}

const FLOWISE_CONFIG = {
  chatflowId: import.meta.env.VITE_FLOWISE_CHATFLOW_ID,
  apiHost: import.meta.env.VITE_FLOWISE_API_HOST,
};

export function DeepsearchPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string>(crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations from Supabase on component mount
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    try {
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('deepsearch_conversations')
        .select('*')
        .order('created_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      if (conversationsData) {
        const conversationsWithMessages = await Promise.all(
          conversationsData.map(async (conv) => {
            const { data: messagesData, error: messagesError } = await supabase
              .from('deepsearch_messages')
              .select('*')
              .eq('conversation_id', conv.id)
              .order('timestamp', { ascending: true });

            if (messagesError) throw messagesError;

            return {
              ...conv,
              timestamp: new Date(conv.created_at),
              messages: messagesData?.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              })) || []
            };
          })
        );

        setConversations(conversationsWithMessages);
      }
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      toast.error('Failed to load conversations');
    }
  };

  const handleConversationSelect = async (conversation: Conversation) => {
    setCurrentConversationId(conversation.id);
    setCurrentSessionId(conversation.session_id);
    setMessages(conversation.messages);
    setIsDrawerOpen(false);
  };

  const startNewConversation = () => {
    const newSessionId = crypto.randomUUID();
    setCurrentSessionId(newSessionId);
    setCurrentConversationId(null);
    setMessages([]);
    setIsDrawerOpen(false);
  };

  const sendMessageToFlowise = async (message: string, messageHistory: Message[]) => {
    if (!currentSessionId) {
      throw new Error('No session ID available');
    }

    try {
      const response = await axios.post(`${FLOWISE_CONFIG.apiHost}/api/v1/prediction/${FLOWISE_CONFIG.chatflowId}`, {
        question: message,
        sessionId: currentSessionId,
        history: messageHistory.map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      });

      return response.data;
    } catch (error) {
      console.error('Error sending message to Flowise:', error);
      throw error;
    }
  };

  const createConversation = async (title: string) => {
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('deepsearch_conversations')
      .insert({
        user_id: user.id,
        session_id: currentSessionId,
        title,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const saveMessage = async (message: Message, conversationId: string) => {
    const { data, error } = await supabase
      .from('deepsearch_messages')
      .insert({
        conversation_id: conversationId,
        content: message.content,
        type: message.type,
        timestamp: message.timestamp.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !user) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      type: 'user',
      timestamp: new Date(),
    };

    let currentMessages: Message[] = [...messages, newMessage];
    setMessages(currentMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      // Create new conversation if needed
      let conversationId = currentConversationId;
      if (!conversationId) {
        const newConversation = await createConversation(inputValue.trim().substring(0, 30) + '...');
        conversationId = newConversation.id;
        setCurrentConversationId(conversationId);
      }

      // Save user message
      await saveMessage(newMessage, conversationId);

      // Get AI response
      const flowiseResponse = await sendMessageToFlowise(newMessage.content, currentMessages);
      
      const response: Message = {
        id: (Date.now() + 1).toString(),
        content: flowiseResponse.text || "I apologize, but I couldn't process that request.",
        type: 'assistant',
        timestamp: new Date(),
      };

      // Save AI message
      await saveMessage(response, conversationId);

      currentMessages = [...currentMessages, response];
      setMessages(currentMessages);
      
      // Refresh conversations list
      await loadConversations();
    } catch (error: any) {
      console.error('Error processing message:', error);
      toast.error('Failed to process message');
      
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but there was an error processing your request. Please try again later.",
        type: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box 
      sx={{ 
        height: 'calc(100vh - 100px)', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative',
        bgcolor: 'background.default',
        gap: 2,
        p: 2,
      }}
    >
      {/* Chat Header */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 2, 
          borderRadius: 2,
          backgroundColor: theme.palette.background.paper,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.9),
              width: 45,
              height: 45,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <Bot size={24} />
          </Avatar>
          <Box>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600,
                color: theme.palette.text.primary,
                fontSize: '1.25rem',
                lineHeight: 1.3,
                mb: 0.5,
              }}
            >
              DeepSearch AI
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: theme.palette.text.secondary,
                display: 'block',
                fontSize: '0.85rem',
              }}
            >
              Research Assistant
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button
            size="medium"
            onClick={startNewConversation}
            startIcon={<Sparkles size={18} />}
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              color: theme.palette.text.primary,
              px: 2,
              py: 1,
              fontSize: '0.9rem',
              textTransform: 'none',
              borderRadius: 1.5,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.15),
              },
              transition: 'all 0.2s ease',
            }}
          >
            New Chat
          </Button>
          <IconButton
            size="medium"
            onClick={() => setIsDrawerOpen(true)}
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.15),
                transform: 'rotate(15deg)',
              },
              transition: 'all 0.2s ease',
              width: 40,
              height: 40,
            }}
          >
            <History size={20} />
          </IconButton>
        </Box>
      </Paper>

      {/* Messages Container */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          py: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: alpha(theme.palette.primary.main, 0.05),
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: alpha(theme.palette.primary.main, 0.2),
            borderRadius: '10px',
            '&:hover': {
              background: alpha(theme.palette.primary.main, 0.3),
            },
          },
        }}
      >
        {messages.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100%',
              gap: 4,
              py: 4,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: alpha(theme.palette.primary.main, 0.9),
                  boxShadow: '0 0 40px rgba(0,0,0,0.1)',
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': {
                      boxShadow: '0 0 0 0 rgba(0,0,0,0.1)',
                    },
                    '70%': {
                      boxShadow: '0 0 0 20px rgba(0,0,0,0)',
                    },
                    '100%': {
                      boxShadow: '0 0 0 0 rgba(0,0,0,0)',
                    },
                  },
                }}
              >
                <Sparkles size={32} />
              </Avatar>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                  textAlign: 'center',
                }}
              >
                How can I help you today?
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 2,
                width: '100%',
                maxWidth: '800px',
                px: 2,
              }}
            >
              {[
                {
                  title: 'Research Analysis',
                  description: 'Get insights from research papers and academic sources',
                  icon: <Bot size={20} />,
                  prompt: 'Help me analyze recent research papers about artificial intelligence.',
                },
                {
                  title: 'Market Research',
                  description: 'Explore market trends and competitor analysis',
                  icon: <Sparkles size={20} />,
                  prompt: 'What are the current market trends in renewable energy?',
                },
                {
                  title: 'Data Insights',
                  description: 'Extract meaningful patterns from data',
                  icon: <Bot size={20} />,
                  prompt: 'Help me understand the patterns in this dataset.',
                },
                {
                  title: 'Literature Review',
                  description: 'Comprehensive analysis of academic literature',
                  icon: <Sparkles size={20} />,
                  prompt: 'Can you help me review literature about machine learning?',
                },
              ].map((suggestion) => (
                <Paper
                  key={suggestion.title}
                  elevation={0}
                  onClick={() => setInputValue(suggestion.prompt)}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    cursor: 'pointer',
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    bgcolor: alpha(theme.palette.background.paper, 0.6),
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      bgcolor: alpha(theme.palette.background.paper, 0.9),
                      borderColor: alpha(theme.palette.primary.main, 0.2),
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                      }}
                    >
                      {suggestion.icon}
                    </Avatar>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                      }}
                    >
                      {suggestion.title}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme.palette.text.secondary,
                      fontSize: '0.85rem',
                    }}
                  >
                    {suggestion.description}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Box>
        ) : (
          messages.map((message) => (
            <Fade in={true} key={message.id}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                  gap: 1.5,
                  maxWidth: '85%',
                  alignSelf: message.type === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: message.type === 'user' 
                      ? alpha(theme.palette.primary.main, 0.1)
                      : alpha(theme.palette.secondary.main, 0.1),
                    alignSelf: 'flex-start',
                    color: message.type === 'user'
                      ? theme.palette.primary.main
                      : theme.palette.secondary.main,
                  }}
                >
                  {message.type === 'user' ? <User size={20} /> : <Bot size={20} />}
                </Avatar>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: message.type === 'user'
                      ? alpha(theme.palette.primary.main, 0.1)
                      : alpha(theme.palette.background.paper, 0.9),
                    maxWidth: '100%',
                    border: `1px solid ${alpha(
                      message.type === 'user' ? theme.palette.primary.main : theme.palette.divider,
                      0.1
                    )}`,
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      color: message.type === 'user'
                        ? theme.palette.text.primary
                        : theme.palette.text.primary,
                      lineHeight: 1.6,
                    }}
                  >
                    <ReactMarkdown
                      components={{
                        code: ({ node, inline, className, children, ...props }: any) => {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <Box sx={{ mt: 2, mb: 2 }}>
                              <SyntaxHighlighter
                                style={materialDark}
                                language={match[1]}
                                PreTag="div"
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            </Box>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: alpha(theme.palette.text.secondary, 0.7),
                      mt: 1,
                      display: 'block',
                    }}
                  >
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </Typography>
                </Paper>
              </Box>
            </Fade>
          ))
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Paper
        component="form"
        onSubmit={handleSubmit}
        elevation={3}
        sx={{
          p: 2,
          borderRadius: 3,
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          backgroundColor: theme.palette.background.paper,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          position: 'sticky',
          bottom: 0,
          transition: 'transform 0.2s ease',
          '&:focus-within': {
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 25px rgba(0,0,0,0.12)',
          },
        }}
      >
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type your message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isLoading}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.background.default, 0.6),
              '&:hover': {
                backgroundColor: alpha(theme.palette.background.default, 0.8),
              },
              '&.Mui-focused': {
                backgroundColor: alpha(theme.palette.background.default, 0.8),
              },
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={!inputValue.trim() || isLoading}
          sx={{
            borderRadius: 2,
            px: 3,
            py: 1.5,
            minWidth: 'auto',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
            },
          }}
        >
          {isLoading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            <Send size={20} />
          )}
        </Button>
      </Paper>

      {/* History Drawer */}
      <Drawer
        anchor="right"
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 320,
            p: 2,
            bgcolor: theme.palette.background.paper,
          },
        }}
      >
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Chat History</Typography>
          <IconButton onClick={() => setIsDrawerOpen(false)}>
            <ChevronRight />
          </IconButton>
        </Box>
        <Button
          fullWidth
          variant="outlined"
          onClick={startNewConversation}
          sx={{
            mb: 2,
            borderRadius: 2,
            gap: 1,
            textTransform: 'none',
            py: 1.5,
          }}
        >
          <Sparkles size={20} />
          New Conversation
        </Button>
        <List sx={{ mt: 2 }}>
          {conversations.map((conversation) => (
            <React.Fragment key={conversation.id}>
              <ListItemButton
                selected={conversation.id === currentConversationId}
                onClick={() => handleConversationSelect(conversation)}
                sx={{
                  borderRadius: 2,
                  mb: 1,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <ListItemText
                  primary={conversation.title}
                  secondary={new Date(conversation.timestamp).toLocaleDateString()}
                  primaryTypographyProps={{
                    noWrap: true,
                    fontWeight: conversation.id === currentConversationId ? 600 : 400,
                  }}
                  secondaryTypographyProps={{
                    sx: { display: 'flex', alignItems: 'center', gap: 0.5 },
                  }}
                />
              </ListItemButton>
              <Divider sx={{ my: 1 }} />
            </React.Fragment>
          ))}
        </List>
      </Drawer>
    </Box>
  );
} 