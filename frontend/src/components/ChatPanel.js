import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Avatar,
  Button,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Switch,
  FormControlLabel,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  Code as CodeIcon,
  AutoFixHigh as GenerateIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  PlayArrow as PlayIcon,
  Menu as MenuIcon,
  GitHub as GitHubIcon,
  Analytics as AnalyticsIcon,
  Cloud as CloudIcon,
  Computer as ComputerIcon,
} from '@mui/icons-material';
import { ERROR_MESSAGES } from '../config';
import axios from 'axios';
import { getFileContent } from '../services/api';

const API_BASE_URL = 'http://localhost:8000';

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
      {message.model && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {message.model === 'local' ? (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
              <ComputerIcon sx={{ fontSize: 14, mr: 0.5 }} />
              Local Model
            </Box>
          ) : (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
              <CloudIcon sx={{ fontSize: 14, mr: 0.5 }} />
              Remote Model
            </Box>
          )}
        </Typography>
      )}
    </Paper>
  </Box>
);

function ChatPanel({ 
  onSendCode, 
  onAnalyze, 
  onGenerate, 
  isAnalyzing,
  activeFile,
  handleFileSelect 
}) {
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      content: '你好！我是AI助手，可以帮你进行代码分析、生成和一般的编程问题。我会根据任务复杂度自动选择使用本地或远程模型。',
      isBot: true, 
      type: 'text',
      model: 'local'
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(Date.now().toString());
  const [forceRemoteModel, setForceRemoteModel] = useState(false);
  const messagesEndRef = useRef(null);
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, displayedContent]);

  // 打字机效果
  const typeMessage = useCallback((content) => {
    setIsTyping(true);
    let index = 0;
    const interval = setInterval(() => {
      setDisplayedContent(content.substring(0, index));
      index++;
      if (index > content.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 20); // 调整速度
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: messages.length + 1,
      content: input,
      isBot: false,
      type: 'text',
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setDisplayedContent('');

    try {
      // 获取当前文件上下文
      let fileContext = null;
      if (activeFile) {
        fileContext = {
          path: activeFile.path,
          content: activeFile.content,
          language: activeFile.language
        };
      }

      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        conversation_id: conversationId,
        message: input,
        system_prompt: `你是一个智能的AI助手，可以帮助用户处理代码相关的任务。
根据用户的输入，你需要判断：
1. 是否需要访问文件系统（读取、修改、创建文件等）
2. 是否需要进行代码补全或生成
3. 是否需要进行代码分析

当前文件上下文：${fileContext ? JSON.stringify(fileContext) : '无'}

请用中文回答，并在需要时主动提出相关的操作建议。`,
        file_context: fileContext
      });

      if (response.data.success) {
        const botResponse = {
          id: messages.length + 2,
          content: response.data.message,
          isBot: true,
          type: 'text',
          model: response.data.model || (forceRemoteModel ? 'remote' : 'local')
        };
        
        setMessages(prev => [...prev, botResponse]);
        typeMessage(response.data.message);

        // 如果模型返回了需要执行的操作，执行它们
        if (response.data.actions) {
          let fileContent;
          for (const action of response.data.actions) {
            switch (action.type) {
              case 'read_file':
                // 读取文件
                fileContent = await getFileContent(action.path);
                if (fileContent) {
                  handleFileSelect({
                    path: action.path,
                    content: fileContent,
                    name: action.path.split('/').pop()
                  });
                }
                break;
              case 'modify_file':
                // 修改文件
                if (action.content && action.path) {
                  // TODO: 实现文件修改逻辑
                }
                break;
              case 'analyze_code':
                // 分析代码
                if (action.path) {
                  onAnalyze(action.path);
                }
                break;
              case 'generate_code':
                // 生成代码
                if (action.content) {
                  onSendCode(action.content);
                }
                break;
            }
          }
        }
      } else {
        throw new Error(response.data.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: messages.length + 2,
        content: error.message || ERROR_MESSAGES.networkError,
        isBot: true,
        type: 'text',
        model: 'local'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      width: '400px',
      position: 'relative',
      bgcolor: 'background.paper',
    }}>
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider', 
        display: 'flex', 
        alignItems: 'center',
        minHeight: 64,
      }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>AI Chat</Typography>
        <Tooltip title="Force using remote model for all requests">
          <FormControlLabel
            control={
              <Switch
                checked={forceRemoteModel}
                onChange={(e) => setForceRemoteModel(e.target.checked)}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {forceRemoteModel ? <CloudIcon sx={{ mr: 0.5 }} /> : <ComputerIcon sx={{ mr: 0.5 }} />}
                <Typography variant="body2">
                  {forceRemoteModel ? 'Remote' : 'Auto'}
                </Typography>
              </Box>
            }
          />
        </Tooltip>
      </Box>

      {/* Messages Container */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'hidden',
        display: 'flex',
        borderLeft: 1,
        borderColor: 'divider',
      }}>
        {/* Messages List with Scroll */}
        <Box sx={{ 
          flexGrow: 1,
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '8px',
            bgcolor: 'background.paper',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
          },
        }}>
          <List sx={{ p: 2 }}>
            {messages.map((message) => (
              <Message
                key={message.id}
                message={{
                  ...message,
                  content: message.id === messages.length && message.isBot && isTyping
                    ? displayedContent
                    : message.content
                }}
                isBot={message.isBot}
                onRunCode={onSendCode}
              />
            ))}
            <div ref={messagesEndRef} />
          </List>
        </Box>
      </Box>

      {/* Input Box */}
      <Box sx={{ 
        p: 2, 
        borderTop: 1,
        borderLeft: 1,
        borderColor: 'divider',
      }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Type your message... ${isLoading ? '(Processing...)' : ''}`}
          variant="outlined"
          size="small"
          disabled={isLoading}
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

      {/* Loading Indicator */}
      {isLoading && (
        <Box sx={{
          position: 'absolute',
          top: 64, // Header height
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          p: 1,
          bgcolor: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          zIndex: 1,
        }}>
          <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
          <Typography variant="body2">
            AI is thinking...
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default ChatPanel; 