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
import { ERROR_MESSAGES, CURSOR_CONFIG } from '../config';
import { sendChatMessage, streamChatResponse, getAvailableModels } from '../services/api';

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
      content: '你好！我是 AI 助手，可以帮你进行代码分析、生成和一般的编程问题。',
      isBot: true, 
      type: 'text',
      model: CURSOR_CONFIG.defaultModel
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(CURSOR_CONFIG.defaultModel);
  const messagesEndRef = useRef(null);
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // 加载可用模型
  useEffect(() => {
    const loadModels = async () => {
      try {
        const availableModels = await getAvailableModels();
        setModels(availableModels);
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };
    loadModels();
  }, []);

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
    }, 20);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: messages.length + 1,
      content: input.trim(),
      isBot: false,
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setDisplayedContent('');

    try {
      // 获取当前文件上下文
      let fileContext = '';
      if (activeFile) {
        fileContext = `当前正在编辑的文件：${activeFile.path}\n文件内容：\n${activeFile.content}\n`;
      }

      // 创建一个空的助手消息
      const assistantMessage = {
        id: messages.length + 2,
        content: '',
        isBot: true,
        type: 'text',
        model: selectedModel
      };
      setMessages(prev => [...prev, assistantMessage]);

      // 构建消息历史
      const messageHistory = messages.map(msg => ({
        role: msg.isBot ? 'assistant' : 'user',
        content: msg.content
      }));

      // 添加系统消息
      const systemMessage = {
        role: 'system',
        content: `你是一个智能的 AI 助手，可以帮助用户处理代码相关的任务。
${fileContext}
请用中文回答，并在需要时主动提出相关的操作建议。`
      };

      // 添加用户的新消息
      messageHistory.push({
        role: 'user',
        content: input
      });

      // 使用流式响应
      let fullContent = '';
      await streamChatResponse(
        [systemMessage, ...messageHistory],
        selectedModel,
        (chunk) => {
          fullContent += chunk;
          setMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage.isBot && lastMessage.id === assistantMessage.id) {
              return [
                ...prev.slice(0, -1),
                { ...lastMessage, content: fullContent }
              ];
            }
            return prev;
          });
        }
      );
    } catch (error) {
      console.error('Chat error:', error);
      // 添加错误消息
      setMessages(prev => [...prev, {
        id: messages.length + 2,
        content: '抱歉，发生了错误：' + error.message,
        isBot: true,
        type: 'text',
        model: selectedModel,
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Model selector */}
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <FormControlLabel
          control={
            <Box sx={{ minWidth: 120 }}>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'transparent',
                  color: 'inherit',
                  border: '1px solid rgba(255, 255, 255, 0.23)',
                  borderRadius: '4px'
                }}
              >
                {models.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))}
              </select>
            </Box>
          }
          label="模型："
          labelPlacement="start"
        />
      </Box>

      {/* Messages list */}
      <List sx={{ 
        flexGrow: 1, 
        overflow: 'auto',
        p: 2,
        '& .MuiListItem-root': {
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 1
        }
      }}>
        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            isBot={message.isBot}
            onRunCode={onSendCode}
          />
        ))}
        <div ref={messagesEndRef} />
      </List>

      {/* Input area */}
      <Box sx={{ 
        p: 2, 
        borderTop: 1, 
        borderColor: 'divider',
        backgroundColor: 'background.paper'
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
            placeholder="输入消息..."
            disabled={isLoading}
            sx={{ '& .MuiOutlinedInput-root': { backgroundColor: 'background.default' } }}
          />
          <IconButton 
            color="primary" 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Speed Dial */}
      <SpeedDial
        ariaLabel="Actions"
        sx={{ position: 'absolute', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
        open={isSpeedDialOpen}
        onOpen={() => setIsSpeedDialOpen(true)}
        onClose={() => setIsSpeedDialOpen(false)}
      >
        <SpeedDialAction
          icon={<AnalyticsIcon />}
          tooltipTitle="分析代码"
          onClick={() => {
            setIsSpeedDialOpen(false);
            onAnalyze();
          }}
        />
        <SpeedDialAction
          icon={<GenerateIcon />}
          tooltipTitle="生成代码"
          onClick={() => {
            setIsSpeedDialOpen(false);
            onGenerate();
          }}
        />
      </SpeedDial>
    </Box>
  );
}

export default ChatPanel; 