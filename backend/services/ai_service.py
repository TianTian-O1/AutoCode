import os
from dotenv import load_dotenv
from typing import List, Dict, Any
from .hybrid_ai_service import HybridAIService

# 加载环境变量
load_dotenv()

class AIService:
    def __init__(self, workspace_path: str):
        self.workspace_path = workspace_path
        self.api_key = os.getenv('CLAUDE_API_KEY')
        self.ollama_url = os.getenv('OLLAMA_URL', 'http://192.168.1.5:11434')
        self.remote_url = os.getenv('REMOTE_API_URL', 'https://api.claude-plus.top')
        
        self.hybrid_service = HybridAIService(
            ollama_url=self.ollama_url,
            remote_url=self.remote_url,
            remote_api_key=self.api_key
        )
        self.conversation_history: Dict[str, List[Dict[str, str]]] = {}
        
    def create_conversation(self, conversation_id: str) -> str:
        """创建新的对话"""
        if conversation_id not in self.conversation_history:
            self.conversation_history[conversation_id] = []
        return conversation_id
        
    async def chat(self, 
                  conversation_id: str, 
                  message: str, 
                  system_prompt: str = None,
                  context: str = None) -> Dict[str, Any]:
        """处理对话请求"""
        try:
            if conversation_id not in self.conversation_history:
                self.create_conversation(conversation_id)
                
            # 检查是否是项目分析请求
            if any(keyword in message.lower() for keyword in ['分析项目', '项目结构', '代码结构', '项目架构']):
                analysis_result = await self.hybrid_service.analyze_project_structure(self.workspace_path)
                return {
                    "success": True,
                    "message": analysis_result,
                    "conversation_id": conversation_id,
                    "model": "local"
                }
                
            # 准备消息列表
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            if context:
                messages.append({"role": "system", "content": f"当前上下文：\n{context}"})
            messages.extend(self.conversation_history[conversation_id])
            messages.append({"role": "user", "content": message})
            
            # 根据消息内容决定是否使用远程API
            use_remote = any(keyword in message.lower() for keyword in [
                'generate', 'create', 'debug', 'fix', 'solve error',
                'implement', 'write code', 'bug'
            ])
            
            # 调用混合服务
            response = await self.hybrid_service.chat_with_context(
                messages=messages,
                code_context=context if context else None,
                use_remote=use_remote
            )
            
            if 'error' in response:
                return {
                    "success": False,
                    "error": response['error']
                }
                
            # 获取助手回复
            assistant_message = response['choices'][0]['message']['content']
            
            # 更新对话历史
            self.conversation_history[conversation_id].append({"role": "user", "content": message})
            self.conversation_history[conversation_id].append({"role": "assistant", "content": assistant_message})
            
            return {
                "success": True,
                "message": assistant_message,
                "conversation_id": conversation_id,
                "model": "remote" if use_remote else "local"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
            
    async def analyze_code(self, file_path: str) -> Dict[str, Any]:
        """分析代码文件"""
        try:
            full_path = os.path.join(self.workspace_path, file_path)
            if not os.path.exists(full_path):
                return {"success": False, "error": "File not found"}
                
            with open(full_path, 'r', encoding='utf-8') as f:
                code_content = f.read()
                
            # 使用本地模型进行代码分析
            analysis = await self.hybrid_service.analyze_code(code_content)
            
            return {
                "success": True,
                "analysis": analysis,
                "model": "local"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
            
    def close(self):
        """关闭服务"""
        self.hybrid_service.close() 