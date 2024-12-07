import axios from 'axios';
import { API_URL, CURSOR_API_URL, CURSOR_API_KEY, UPLOAD_CONFIG, API_ENDPOINTS, ERROR_MESSAGES, CURSOR_CONFIG } from '../config';

// Debug helper
const debug = (message, data) => {
  if (CURSOR_CONFIG.debug) {
    console.log(`[Debug] ${message}:`, data);
  }
};

// Error helper
const handleError = (error, context) => {
  debug(`Error in ${context}:`, error);
  
  if (error.response) {
    debug(`Response error in ${context}:`, {
      status: error.response.status,
      data: error.response.data,
      headers: error.response.headers
    });
    
    switch (error.response.status) {
      case 401:
        throw new Error(ERROR_MESSAGES.authError);
      case 408:
        throw new Error(ERROR_MESSAGES.timeoutError);
      default:
        throw new Error(error.response.data?.error || ERROR_MESSAGES.serverError);
    }
  } else if (error.request) {
    debug(`Network error in ${context}:`, error.request);
    throw new Error(ERROR_MESSAGES.networkError);
  } else {
    debug(`Unknown error in ${context}:`, error.message);
    throw new Error(error.message);
  }
};

// Create axios instance with custom config
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: UPLOAD_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: false
});

// Create Cursor API client
const cursorClient = axios.create({
  baseURL: CURSOR_API_URL,
  timeout: CURSOR_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: false
});

// Add request interceptor for debugging
cursorClient.interceptors.request.use(
  config => {
    // 在每个请求中动态添加认证头
    config.headers['Authorization'] = `Bearer ${CURSOR_API_KEY}`;
    debug('Cursor API Request', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data
    });
    return config;
  },
  error => {
    debug('Cursor Request Error', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
cursorClient.interceptors.response.use(
  response => {
    debug('Cursor API Response', {
      url: response.config.url,
      method: response.config.method,
      status: response.status,
      headers: response.headers,
      data: response.data
    });
    return response;
  },
  error => {
    handleError(error, 'Cursor API Response');
    return Promise.reject(error);
  }
);

// Retry mechanism for failed requests
const retryRequest = async (fn, retries = CURSOR_CONFIG.retryAttempts) => {
  try {
    return await fn();
  } catch (error) {
    debug('Retry request error', { error, retriesLeft: retries });
    if (retries > 0 && (!error.response || error.response.status >= 500)) {
      await new Promise(resolve => setTimeout(resolve, CURSOR_CONFIG.retryDelay));
      return retryRequest(fn, retries - 1);
    }
    throw error;
  }
};

// File system operations
export const uploadFile = async (file, path = '') => {
  try {
    if (file.size > UPLOAD_CONFIG.maxFileSize) {
      throw new Error(ERROR_MESSAGES.invalidFile);
    }

    // 处理文件路径和名称
    const fullPath = file.webkitRelativePath || file.name;
    const pathParts = fullPath.split('/');
    const filename = pathParts.pop();  // 获取文件名
    const dirPath = pathParts.join('/');  // 获取目录路径

    // 去掉文件名中的 test_ 前缀
    const newFilename = filename.startsWith('test_') ? filename.substring(5) : filename;

    // 构建新的完整路径
    const newPath = dirPath ? `${dirPath}/${newFilename}` : newFilename;

    // 创建新的 File 对象
    const newFile = new File([file], newPath, { type: file.type });

    const formData = new FormData();
    formData.append('file', newFile);

    const response = await retryRequest(() => 
      apiClient.post(API_ENDPOINTS.upload, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`Upload progress: ${percentCompleted}%`);
        },
      })
    );

    return response.data;
  } catch (error) {
    console.error('Upload error:', error);
    if (error.response) {
      throw new Error(error.response.data?.error || ERROR_MESSAGES.uploadFailed);
    } else if (error.request) {
      throw new Error(ERROR_MESSAGES.networkError);
    } else {
      throw new Error(error.message || ERROR_MESSAGES.uploadFailed);
    }
  }
};

export const listFiles = async (path = '') => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(API_ENDPOINTS.files, { params: { path } })
    );
    return response.data.files || [];
  } catch (error) {
    console.error('List files error:', error);
    return [];
  }
};

export const getFileContent = async (path) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(API_ENDPOINTS.fileContent, { params: { path } })
    );
    return response.data.content;
  } catch (error) {
    console.error('Get file content error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.serverError);
  }
};

export const deletePath = async (path) => {
  try {
    const response = await retryRequest(() =>
      apiClient.delete(API_ENDPOINTS.files, { params: { path } })
    );
    return response.data;
  } catch (error) {
    console.error('Delete error:', error);
    if (error.response) {
      throw new Error(error.response.data?.error || ERROR_MESSAGES.serverError);
    } else if (error.request) {
      throw new Error(ERROR_MESSAGES.networkError);
    } else {
      throw new Error(error.message);
    }
  }
};

export const getRelevantFiles = async (query) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.relevantFiles, { query })
    );
    return response.data || [];
  } catch (error) {
    console.error('Get relevant files error:', error);
    return [];
  }
};

export const recordChange = async (path, type) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.changes, { path, type })
    );
    return response.data;
  } catch (error) {
    console.error('Record change error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.serverError);
  }
};

export const getProjectStructure = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(API_ENDPOINTS.fileStructure)
    );
    return response.data;
  } catch (error) {
    console.error('Get project structure error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.serverError);
  }
};

// Chat operations
export const sendChatMessage = async (messages, model = CURSOR_CONFIG.defaultModel) => {
  debug('Sending chat message', { messages, model });
  try {
    const response = await fetch(`${CURSOR_API_URL}${API_ENDPOINTS.chat}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CURSOR_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    debug('Chat error', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.chatError);
  }
};

// Get available models
export const getAvailableModels = async () => {
  debug('Getting available models');
  try {
    const response = await fetch(`${CURSOR_API_URL}${API_ENDPOINTS.models}`, {
      headers: {
        'Authorization': `Bearer ${CURSOR_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data || CURSOR_CONFIG.models;
  } catch (error) {
    debug('Get models error', error);
    return CURSOR_CONFIG.models;
  }
};

// Stream chat response
export const streamChatResponse = async (messages, model = CURSOR_CONFIG.defaultModel, onChunk) => {
  debug('Starting stream chat', { messages, model });
  try {
    const response = await fetch(`${CURSOR_API_URL}${API_ENDPOINTS.chat}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${CURSOR_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 使用原生的文本流处理
    const textStream = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();

    let buffer = '';
    let messageStarted = false;

    while (true) {
      const { done, value } = await textStream.read();
      if (done) break;

      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          // 检查是否是结束标记
          if (data === '[DONE]') {
            messageStarted = false;
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              const content = parsed.choices[0].delta.content;
              
              // 如果是消息的开始，检查并移除可能的乱码
              if (!messageStarted) {
                messageStarted = true;
                // 找到第一个有效的文本字符
                const validStart = content.search(/[\x20-\x7E\u4E00-\u9FFF]/);
                if (validStart > 0) {
                  continue; // 跳过包含乱码的第一个块
                }
              }

              // 只保留有效的文本字符
              const cleanContent = content.split('')
                .filter(char => {
                  const code = char.charCodeAt(0);
                  return (
                    (code >= 0x20 && code <= 0x7E) || // 基本 ASCII 可打印字符
                    (code >= 0x4E00 && code <= 0x9FFF) || // 中文字符
                    (code >= 0x3000 && code <= 0x303F) || // 中文标点
                    (code >= 0xFF00 && code <= 0xFFEF) // 全角字符
                  );
                })
                .join('');

              if (cleanContent) {
                onChunk(cleanContent);
              }
            }
          } catch (e) {
            debug('Error parsing chunk', e);
            continue;
          }
        }
      }
    }
  } catch (error) {
    debug('Stream chat error', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.chatError);
  }
};

// Code analysis and generation
export const analyzeCode = async (code, options = {}) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.analyze, { code, ...options })
    );
    return response.data;
  } catch (error) {
    console.error('Code analysis error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.analyzeError);
  }
};

export const generateCode = async (prompt, options = {}) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.generate, { prompt, ...options })
    );
    return response.data;
  } catch (error) {
    console.error('Code generation error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.generateError);
  }
};

// Version control operations
export const undoAction = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.undo)
    );
    return response.data;
  } catch (error) {
    console.error('Undo error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.versionControlError);
  }
};

export const redoAction = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.redo)
    );
    return response.data;
  } catch (error) {
    console.error('Redo error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.versionControlError);
  }
};

export const resetProject = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.reset)
    );
    return response.data;
  } catch (error) {
    console.error('Reset error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.versionControlError);
  }
};

export default apiClient; 