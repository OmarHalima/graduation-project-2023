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

// Typewriter component for creating typing animation effect
interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ text, speed = 20, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Reset state when text changes
    setDisplayedText('');
    setCurrentIndex(0);
    setIsComplete(false);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      // Vary the typing speed slightly to make it look more natural
      const variableSpeed = speed + Math.random() * 10 - 5;
      
      // Type faster for spaces and punctuation
      const currentChar = text[currentIndex];
      const adjustedSpeed = /[\s.,;!?]/.test(currentChar) ? variableSpeed * 0.5 : variableSpeed;

      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, adjustedSpeed);
      
      return () => clearTimeout(timer);
    } else {
      setIsComplete(true);
      onComplete?.();
    }
  }, [currentIndex, text, speed, onComplete]);

  return (
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
      {displayedText}
    </ReactMarkdown>
  );
};

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  conversation_id?: string;
  isTyping?: boolean;
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

// Add this function to format and style JSON-like content
const formatStructuredContent = (content: string) => {
  try {
    // Try to parse the content as JSON
    const parsedContent = JSON.parse(content);
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.entries(parsedContent).map(([key, value]: [string, any]) => (
          <Box key={key}>
            {/* Section Header */}
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: 'primary.main',
                mb: 1,
                borderBottom: '2px solid',
                borderColor: 'primary.light',
                pb: 0.5,
              }}
            >
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </Typography>

            {/* Section Content */}
            {typeof value === 'object' ? (
              // Handle nested objects (like SWOT Analysis)
              <Box sx={{ pl: 2 }}>
                {Object.entries(value).map(([subKey, subValue]: [string, any]) => (
                  <Box key={subKey} sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        color: 'secondary.main',
                        mb: 0.5,
                      }}
                    >
                      {subKey}
                    </Typography>
                    <Typography
                      variant="body2"
                      component="div"
                      sx={{
                        color: 'text.secondary',
                        whiteSpace: 'pre-line',
                        pl: 2,
                      }}
                    >
                      {typeof subValue === 'string' ? subValue.replace(/^\* /gm, '• ') : subValue}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              // Handle string values
              <Typography
                variant="body1"
                sx={{
                  color: 'text.secondary',
                  pl: 2,
                  whiteSpace: 'pre-line',
                }}
              >
                {String(value).replace(/^\* /gm, '• ')}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    );
  } catch (e) {
    // If content is not JSON, return it as regular markdown
    return (
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
        {content}
      </ReactMarkdown>
    );
  }
};

export function DeepsearchPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const theme = useTheme();

  // Add debug logging for session ID changes
  useEffect(() => {
    console.log('Session ID Changed:', {
      currentSessionId,
      sessionIdRef: sessionIdRef.current,
      timestamp: new Date().toISOString()
    });
  }, [currentSessionId]);

  // Validate session consistency
  useEffect(() => {
    if (currentSessionId !== sessionIdRef.current) {
      console.warn('Session ID mismatch detected:', {
        currentSessionId,
        sessionIdRef: sessionIdRef.current,
        timestamp: new Date().toISOString()
      });
    }
  }, [currentSessionId, messages]);

  // Handle scrolling
  const scrollToBottom = () => {
    if (!userScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset userScrolled when starting a new conversation
  useEffect(() => {
    if (messages.length === 0) {
      setUserScrolled(false);
    }
  }, [messages.length]);

  // Handle user scroll
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      // Check if user scrolled up (not at the bottom)
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setUserScrolled(!isAtBottom);
      
      // If user scrolls to bottom, reset userScrolled flag
      if (isAtBottom) {
        setUserScrolled(false);
      }
    }
  };

  // Modified useEffect for session ID persistence
  useEffect(() => {
    if (user) {
      loadConversations();
      // Only initialize session ID if it hasn't been set yet
      if (!sessionIdRef.current) {
        const newSessionId = crypto.randomUUID();
        console.log('Initializing new session ID:', {
          newSessionId,
          timestamp: new Date().toISOString()
        });
        sessionIdRef.current = newSessionId;
        setCurrentSessionId(newSessionId);
      }
    }
  }, [user]);

  const validateSessionId = () => {
    if (!sessionIdRef.current) {
      console.error('No session ID available when expected');
      return false;
    }
    if (currentSessionId !== sessionIdRef.current) {
      console.error('Session ID mismatch:', {
        currentSessionId,
        sessionIdRef: sessionIdRef.current
      });
      return false;
    }
    return true;
  };

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
    console.log('Selecting conversation:', {
      conversationId: conversation.id,
      sessionId: conversation.session_id,
      timestamp: new Date().toISOString()
    });
    setCurrentConversationId(conversation.id);
    sessionIdRef.current = conversation.session_id;
    setCurrentSessionId(conversation.session_id);
    setMessages(conversation.messages);
    setIsDrawerOpen(false);
  };

  const startNewConversation = () => {
    const newSessionId = crypto.randomUUID();
    console.log('Starting new conversation:', {
      newSessionId,
      timestamp: new Date().toISOString()
    });
    sessionIdRef.current = newSessionId;
    setCurrentSessionId(newSessionId);
    setCurrentConversationId(null);
    setMessages([]);
    setIsDrawerOpen(false);
  };

  const sendMessageToFlowise = async (message: string, messageHistory: Message[]) => {
    const sessionId = sessionIdRef.current;
    
    // Validate session state before sending
    if (!validateSessionId()) {
      console.warn('Session validation failed, creating new session');
      const newSessionId = crypto.randomUUID();
      sessionIdRef.current = newSessionId;
      setCurrentSessionId(newSessionId);
      return sendMessageToFlowise(message, messageHistory);
    }

    try {
      console.log('Sending message to Flowise:', {
        sessionId,
        messageLength: message.length,
        historyLength: messageHistory.length,
        timestamp: new Date().toISOString()
      });

      const response = await axios.post(`${FLOWISE_CONFIG.apiHost}/api/v1/prediction/${FLOWISE_CONFIG.chatflowId}`, {
        question: message,
        overrideConfig: {
          sessionId: sessionId
        },
        history: messageHistory.map(msg => ({
          role: msg.type === 'user' ? 'userMessage' : 'apiMessage',
          content: msg.content
        }))
      });

      console.log('Received response from Flowise:', {
        sessionId,
        responseReceived: !!response.data,
        timestamp: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Error sending message to Flowise:', {
        sessionId,
        error,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  };

  const createConversation = async (title: string) => {
    if (!user) throw new Error('User not authenticated');
    const sessionId = sessionIdRef.current;
    if (!sessionId) throw new Error('No session ID available');

    const { data, error } = await supabase
      .from('deepsearch_conversations')
      .insert({
        user_id: user.id,
        session_id: sessionId,
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

    // Validate session before proceeding
    if (!validateSessionId()) {
      toast.error('Session validation failed. Please try again.');
      return;
    }

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
        console.log('Creating new conversation for message');
        const newConversation = await createConversation(inputValue.trim().substring(0, 30) + '...');
        conversationId = newConversation.id;
        setCurrentConversationId(conversationId);
      }

      // At this point conversationId is guaranteed to be a string
      const actualConversationId: string = conversationId!;

      // Save user message
      await saveMessage(newMessage, actualConversationId);

      // Add a temporary loading message with isTyping flag
      const tempResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "", // Empty content that will be filled character by character
        type: 'assistant',
        timestamp: new Date(),
        isTyping: true,
      };
      
      setMessages([...currentMessages, tempResponse]);

      // Get AI response
      const flowiseResponse = await sendMessageToFlowise(newMessage.content, currentMessages);
      
      // Now update the content of the temp message to trigger the typing animation
      const response: Message = {
        id: tempResponse.id,
        content: flowiseResponse.text || "I apologize, but I couldn't process that request.",
        type: 'assistant',
        timestamp: new Date(),
        isTyping: true, // Keep isTyping true to start the animation
      };

      // Update the message with actual content - this will start the typing animation
      setMessages(prev => prev.map(msg => 
        msg.id === tempResponse.id ? response : msg
      ));

      // Save AI message to database
      await saveMessage({
        ...response,
        isTyping: false // Don't save the typing state to database
      }, actualConversationId);
      
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
        isTyping: false,
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
        ref={messagesContainerRef}
        onScroll={handleScroll}
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
                    {message.type === 'user' || !message.isTyping ? (
                      formatStructuredContent(message.content)
                    ) : (
                      <TypewriterText 
                        text={message.content} 
                        speed={15} 
                        onComplete={() => {
                          // Mark typing as complete
                          setMessages(prev => prev.map(msg => 
                            msg.id === message.id ? { ...msg, isTyping: false } : msg
                          ));
                        }}
                      />
                    )}
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

      {/* Add scroll to bottom button if user has scrolled up */}
      {userScrolled && messages.length > 0 && (
        <Box 
          sx={{ 
            position: 'absolute', 
            bottom: 80, 
            right: 30, 
            zIndex: 10 
          }}
        >
          <IconButton
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              setUserScrolled(false);
            }}
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              p: 1,
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.2),
              },
            }}
          >
            <ChevronRight style={{ transform: 'rotate(90deg)' }} />
          </IconButton>
        </Box>
      )}

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