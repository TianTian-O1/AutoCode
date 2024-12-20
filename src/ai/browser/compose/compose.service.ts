import { Autowired, Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-browser';
import { ChatService } from '@opensumi/ide-ai-native/lib/browser/chat/chat.api.service';
import { ChatServiceToken } from '@opensumi/ide-core-common';
import { CreateService } from './components/create.service';
import { EditService } from './components/edit.service';
import { AnalysisService } from './components/analysis.service';
import { SearchService } from './components/search.service';
import { RunService } from './components/run.service';
import { ResetService } from './components/reset.service';

interface ComposeStep {
  type: 'thinking' | 'action';
  content: string;
  tool?: string;
  params?: Record<string, any>;
}

@Domain()
@Injectable()
export class ComposeService {
  @Autowired(ChatServiceToken)
  private readonly chatService: ChatService;

  @Autowired()
  private readonly createService: CreateService;

  @Autowired()
  private readonly editService: EditService;

  @Autowired()
  private readonly analysisService: AnalysisService;

  @Autowired()
  private readonly searchService: SearchService;

  @Autowired()
  private readonly runService: RunService;

  @Autowired()
  private readonly resetService: ResetService;

  async processPrompt(prompt: string, send: (message: string) => void): Promise<void> {
    try {
      send('开始处理您的需求...');

      const messages = [
        {
          role: 'system',
          content: `你是一个代码编辑助手。你必须一步一步地使用工具来完成任务。

每个任务都必须按照以下步骤执行：

1. 搜索相关文件
2. 分析文件内容
3. 根据分析结果进行修改

每个步骤必须等待上一个步骤完成后才能继续。
每个步骤必须以 STEP: 开头，后面跟着一个 JSON 对象。
不要一次返回多个步骤。
不要直接返回代码或结果。
等待每个步骤的执行结果后，再返回下一个步骤。

示例步骤：

STEP: {
  "type": "action",
  "content": "搜索 Button 组件文件",
  "tool": "search",
  "params": {
    "pattern": "Button",
    "directory": "/src"
  }
}

等待搜索结果...

STEP: {
  "type": "action",
  "content": "分析找到的文件",
  "tool": "analysis",
  "params": {
    "path": "搜索结果中的文件路径"
  }
}

等待分析结果...

STEP: {
  "type": "action",
  "content": "修改文件",
  "tool": "edit",
  "params": {
    "path": "文件路径",
    "content": "根据分析结果生成的新内容"
  }
}

可用的工具：
1. search: 搜索文件
   - pattern: 搜索模式
   - directory: 搜索目录
2. analysis: 分析代码
   - path: 文件路径
3. edit: 编辑文件
   - path: 文件路径
   - content: 新内容
4. create: 创建文件
   - path: 文件路径
   - content: 文件内容

记住：
1. 必须等待每个步骤完成
2. 必须使用工具，不要直接返回结果
3. 每次只返回一个步骤
4. 根据前一个步骤的结果来决定下一步`
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      let currentStep = 1;
      let lastContent = '';

      const response = await this.chatService.sendMessage({
        messages,
        stream: true,
        onProgress: async (content: string) => {
          const newContent = content.slice(lastContent.length);
          lastContent = content;
          
          console.log('New content:', newContent);
          
          const stepMatch = newContent.match(/STEP:\s*(\{[\s\S]*?\})/);
          if (stepMatch) {
            try {
              const step = JSON.parse(stepMatch[1]);
              console.log(`执行步骤 ${currentStep}:`, step);
              
              if (step.type === 'action') {
                send(`步骤 ${currentStep}: ${step.content}`);
                
                // 执行步骤并等待结果
                await this.executeStep(step, send);
                
                // 增加步骤计数
                currentStep++;
                
                // 发送提示等待下一步
                send('等待下一步指令...');
              }
            } catch (e) {
              console.error('Parse step error:', e);
            }
          }
        }
      });

      send('任务完成！');
    } catch (error) {
      console.error('Compose error:', error);
      if (error instanceof Error) {
        send(`执行过程中发生错误: ${error.message}`);
      } else {
        send('执行过程中发生未知错误');
      }
      throw error;
    }
  }

  private async executeStep(step: ComposeStep, send: (message: string) => void) {
    try {
      if (!step.tool || !step.params) {
        throw new Error(`步骤格式不正确: ${JSON.stringify(step)}`);
      }

      switch (step.tool) {
        case 'search':
          if (!step.params.pattern || !step.params.directory) {
            throw new Error('搜索需要 pattern 和 directory 参数');
          }
          const searchResults = await this.searchService.searchFiles(step.params.pattern, step.params.directory);
          send(`搜索结果:\n${JSON.stringify(searchResults, null, 2)}`);
          return searchResults;

        case 'analysis':
          if (!step.params.path) {
            throw new Error('分析文件需要 path 参数');
          }
          const analysis = await this.analysisService.analyzeFile(step.params.path);
          send(`分析结果:\n${JSON.stringify(analysis, null, 2)}`);
          return analysis;

        case 'edit':
          if (!step.params.path || !step.params.content) {
            throw new Error('编辑文件需要 path 和 content 参数');
          }
          await this.editService.editFile(step.params.path, step.params.content);
          send(`编辑文件成功: ${step.params.path}`);
          return true;

        case 'create':
          if (!step.params.path || !step.params.content) {
            throw new Error('创建文件需要 path 和 content 参数');
          }
          await this.createService.createFile(step.params.path, step.params.content);
          send(`创建文件成功: ${step.params.path}`);
          return true;

        case 'run':
          if (!step.params.command) {
            throw new Error('执行命令需要 command 参数');
          }
          await this.runService.runCommand(step.params.command);
          send(`执行命令成功: ${step.params.command}`);
          return true;

        case 'reset':
          if (!step.params.type || !step.params.path) {
            throw new Error('重置需要 type 和 path 参数');
          }
          await this.resetService.reset(step.params.type, step.params.path, step.params.commit);
          send(`重置成功: ${step.params.path}`);
          return true;

        default:
          throw new Error(`未知的工具类型: ${step.tool}`);
      }
    } catch (error) {
      console.error('Execute step error:', error);
      if (error instanceof Error) {
        send(`执行步骤失败: ${error.message}`);
      } else {
        send('执行步骤时发生未知错误');
      }
      throw error;
    }
  }
}
