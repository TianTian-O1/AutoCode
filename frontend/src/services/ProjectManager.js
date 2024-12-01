class FileCache {
  constructor() {
    this.cache = new Map();
    this.relevanceScores = new Map();
  }

  addToCache(filePath, content) {
    this.cache.set(filePath, {
      content,
      lastAccessed: Date.now(),
      accessCount: 0
    });
  }

  updateRelevanceScore(filePath, score) {
    this.relevanceScores.set(filePath, score);
  }

  getFromCache(filePath) {
    const file = this.cache.get(filePath);
    if (file) {
      file.lastAccessed = Date.now();
      file.accessCount++;
      return file.content;
    }
    return null;
  }

  cleanup() {
    const now = Date.now();
    const MAX_AGE = 30 * 60 * 1000; // 30 minutes
    
    for (const [path, data] of this.cache) {
      if (now - data.lastAccessed > MAX_AGE) {
        this.cache.delete(path);
        this.relevanceScores.delete(path);
      }
    }
  }
}

class ContextManager {
  constructor() {
    this.currentFiles = new Set();
    this.recentChanges = [];
    this.activeContext = null;
  }

  async getRelevantFiles(query) {
    try {
      const response = await fetch('/api/files/relevant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get relevant files');
      }

      const files = await response.json();
      return files;
    } catch (error) {
      console.error('Error getting relevant files:', error);
      return [];
    }
  }

  addToContext(files) {
    files.forEach(file => this.currentFiles.add(file));
  }

  addChange(change) {
    this.recentChanges.push({
      ...change,
      timestamp: Date.now()
    });

    // Keep only last 10 changes
    if (this.recentChanges.length > 10) {
      this.recentChanges.shift();
    }
  }

  getRecentChanges() {
    return this.recentChanges;
  }
}

export class ProjectManager {
  constructor() {
    this.fileCache = new FileCache();
    this.contextManager = new ContextManager();
    
    // 定期清理缓存
    setInterval(() => {
      this.fileCache.cleanup();
    }, 15 * 60 * 1000); // 每15分钟
  }

  async sendToAI(query) {
    try {
      // 1. 获取相关文件
      const relevantFiles = await this.contextManager.getRelevantFiles(query);
      
      // 2. 优化文件内容
      const optimizedFiles = await Promise.all(
        relevantFiles.map(async file => {
          let content = this.fileCache.getFromCache(file.path);
          
          if (!content) {
            // 如果缓存中没有，从服务器获取
            const response = await fetch(`/api/files/content?path=${encodeURIComponent(file.path)}`);
            content = await response.text();
            this.fileCache.addToCache(file.path, content);
          }

          return {
            path: file.path,
            content: this.optimizeContent(content)
          };
        })
      );
      
      // 3. 构建上下文
      const context = this.buildMinimalContext(optimizedFiles);
      
      // 4. 发送到 AI
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          context
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      return await response.json();
    } catch (error) {
      console.error('Error in sendToAI:', error);
      throw error;
    }
  }

  optimizeContent(content) {
    return content
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // 移除注释
      .replace(/console\.log\([^)]*\);?/g, '') // 移除日志
      .replace(/\s+/g, ' ') // 压缩空白
      .trim();
  }

  buildMinimalContext(files) {
    return {
      projectStructure: {
        files: files.map(f => f.path)
      },
      relevantFiles: files,
      recentChanges: this.contextManager.getRecentChanges()
    };
  }

  // 添加文件变更记录
  recordChange(change) {
    this.contextManager.addChange(change);
  }
}

export default new ProjectManager(); 