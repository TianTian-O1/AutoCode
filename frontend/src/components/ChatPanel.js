import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  Avatar,
  CircularProgress,
  Button,
  ButtonGroup,
  Tooltip,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  Code as CodeIcon,
  PlayArrow as PlayIcon,
  GitHub as GitHubIcon,
  Analytics as AnalyticsIcon,
  Menu as MenuIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { chat } from '../services/api';

const Message = ({ message, isBot, onRunCode }) => (
  <Box
    sx={{
      display: 'flex',
      gap: 1,
      mb: 2,
      flexDirection: isBot ? 'row' : 'row-reverse',
    }}
  >
    <Avatar
      sx={{
        bgcolor: isBot ? 'primary.main' : 'secondary.main',
        width: 32,
        height: 32,
      }}
    >
      {isBot ? <BotIcon /> : <PersonIcon />}
    </Avatar>
    <Paper
      sx={{
        p: 1.5,
        maxWidth: '80%',
        bgcolor: isBot ? 'background.paper' : 'primary.dark',
        borderRadius: 2,
      }}
    >
      {message.type === 'code' ? (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CodeIcon sx={{ mr: 1, fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">
                Code Snippet
              </Typography>
            </Box>
            <Button
              size="small"
              startIcon={<PlayIcon />}
              onClick={() => onRunCode(message.content)}
              sx={{ minWidth: 'auto', p: 0.5 }}
            >
              Run
            </Button>
          </Box>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
            <code>{message.content}</code>
          </pre>
        </Box>
      ) : (
        <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</Typography>
      )}
    </Paper>
  </Box>
);

function ChatPanel({ onSendCode, onAnalyze, onGenerate, isAnalyzing }) {
  const [messages, setMessages] = useState([
    { id: 1, content: 'Hello! How can I help you with your code today?', isBot: true, type: 'text' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      content: input,
      isBot: false,
      type: 'text',
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiMessages = messages.map(msg => ({
        role: msg.isBot ? 'assistant' : 'user',
        content: msg.content
      }));

      apiMessages.push({
        role: 'user',
        content: input
      });

      const response = await chat(apiMessages);
      const botResponse = response.choices?.[0]?.message?.content;
      
      if (!botResponse) {
        throw new Error('Invalid response format from AI service');
      }
      
      // Check if the response contains code
      const codeMatch = botResponse.match(/```(?:[\w]*\n)?([\s\S]*?)```/);
      
      if (codeMatch) {
        // If there's code, split into text and code messages
        const textBeforeCode = botResponse.split('```')[0].trim();
        const code = codeMatch[1].trim();
        
        if (textBeforeCode) {
          setMessages(prev => [...prev, {
            id: messages.length + 2,
            content: textBeforeCode,
            isBot: true,
            type: 'text',
          }]);
        }
        
        setMessages(prev => [...prev, {
          id: messages.length + 3,
          content: code,
          isBot: true,
          type: 'code',
        }]);
        
        onSendCode(code);
      } else {
        // If no code, just add as text message
        setMessages(prev => [...prev, {
          id: messages.length + 2,
          content: botResponse,
          isBot: true,
          type: 'text',
        }]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: messages.length + 2,
        content: error.message || 'Network error. Please check your connection.',
        isBot: true,
        type: 'text',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleUndo = async () => {
    try {
      await fetch('/api/undo', { method: 'POST' });
    } catch (error) {
      console.error('Error undoing:', error);
    }
  };

  const handleRedo = async () => {
    try {
      await fetch('/api/redo', { method: 'POST' });
    } catch (error) {
      console.error('Error redoing:', error);
    }
  };

  const handleReset = async () => {
    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch (error) {
      console.error('Error resetting:', error);
    }
  };

  const actions = [
    { icon: <AnalyticsIcon />, name: 'Analyze Code', onClick: () => onAnalyze('gpt') },
    { icon: <CodeIcon />, name: 'Generate Code', onClick: () => onGenerate('gpt') },
    { icon: <GitHubIcon />, name: 'GitHub', onClick: () => {} },
  ];

  return (
    <Box sx={{ 
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      width: '400px',
      bgcolor: 'background.default',
      borderLeft: 1,
      borderColor: 'divider',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1200,
    }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>AI Chat</Typography>
        <SpeedDial
          ariaLabel="Actions"
          sx={{ 
            position: 'absolute',
            right: 16,
            top: 8,
            '& .MuiSpeedDial-fab': { width: 40, height: 40 }
          }}
          icon={<SpeedDialIcon openIcon={<MenuIcon />} />}
          onClose={() => setIsSpeedDialOpen(false)}
          onOpen={() => setIsSpeedDialOpen(true)}
          open={isSpeedDialOpen}
          direction="down"
        >
          {actions.map((action) => (
            <SpeedDialAction
              key={action.name}
              icon={action.icon}
              tooltipTitle={action.name}
              onClick={() => {
                action.onClick();
                setIsSpeedDialOpen(false);
              }}
            />
          ))}
        </SpeedDial>
      </Box>

      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            isBot={message.isBot}
            onRunCode={onSendCode}
          />
        ))}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* 回退按钮组 */}
      <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
        <ButtonGroup size="small" variant="outlined" fullWidth>
          <Tooltip title="撤销">
            <Button startIcon={<UndoIcon />} onClick={handleUndo}>
              撤销
            </Button>
          </Tooltip>
          <Tooltip title="重做">
            <Button startIcon={<RedoIcon />} onClick={handleRedo}>
              重做
            </Button>
          </Tooltip>
          <Tooltip title="重置">
            <Button startIcon={<ResetIcon />} onClick={handleReset}>
              重置
            </Button>
          </Tooltip>
        </ButtonGroup>
      </Box>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          variant="outlined"
          InputProps={{
            endAdornment: (
              <IconButton 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                color="primary"
              >
                <SendIcon />
              </IconButton>
            ),
          }}
        />
      </Box>
    </Box>
  );
}

export default ChatPanel; 