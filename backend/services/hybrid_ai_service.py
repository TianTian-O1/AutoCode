import requests
import json
import asyncio
from typing import List, Dict, Any, Optional, Union
from pathlib import Path
import aiohttp
import logging
import os
from dotenv import load_dotenv
from fastapi import WebSocket

# 加载环境变量
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HybridAIService:
    def __init__(self, 
                 ollama_url: str = "http://localhost:11434",
                 remote_url: str = "https://api.claude-plus.top",
                 remote_api_key: str = None):
        self.ollama_url = ollama_url
        self.remote_url = remote_url
        self.remote_api_key = remote_api_key
        self.session = requests.Session()
        self.active_websockets: Dict[str, WebSocket] = {}
        
    async def register_websocket(self, conversation_id: str, websocket: WebSocket):
        """注册WebSocket连接"""
        self.active_websockets[conversation_id] = websocket
        
    async def unregister_websocket(self, conversation_id: str):
        """注销WebSocket连接"""
        self.active_websockets.pop(conversation_id, None)
        
    async def send_message(self, conversation_id: str, message: str):
        """发送消息到WebSocket"""
        if websocket := self.active_websockets.get(conversation_id):
            try:
                await websocket.send_json({
                    "type": "message",
                    "content": message
                })
            except Exception as e:
                logger.error(f"Error sending message: {e}")

    def _get_remote_headers(self) -> Dict[str, str]:
        """获取远程API请求头"""
        return {
            'Accept': 'application/json',
            'Authorization': f'Bearer {self.remote_api_key}',
            'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
            'Content-Type': 'application/json'
        }
        
    async def analyze_code(self, code: str, task: str = "analyze") -> str:
        """
        使用本地Ollama分析代码
        :param code: 要分析的代码
        :param task: 分析任务类型
        :return: 分析结果
        """
        prompt = f"""任务: {task}
        
        需要分析的代码:
        ```
        {code}
        ```
        
        请用中文提供详细的代码分析，包括：
        1. 代码的主要功能
        2. 代码结构分析
        3. 可能的改进建议
        4. 性能和安全性考虑
        """
        
        try:
            response = self.session.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": "qwen2.5-coder:14b",
                    "prompt": prompt,
                    "stream": True
                },
                stream=True
            )
            response.raise_for_status()
            
            # 收集流式响应
            full_response = ""
            for line in response.iter_lines():
                if line:
                    try:
                        json_response = json.loads(line)
                        full_response += json_response.get('response', '')
                    except json.JSONDecodeError:
                        continue
            
            return full_response
            
        except Exception as e:
            logger.error(f"Error using Ollama: {str(e)}")
            return str(e)
            
    async def process_code_changes(self, 
                                 original_code: str, 
                                 changes_description: str) -> Dict[str, Any]:
        """
        使用Ollama处理代码更改
        :param original_code: 原始代码
        :param changes_description: 更改描述
        :return: 处理结果
        """
        prompt = f"""请根据以下描述修改代码：
        
        原始代码:
        ```
        {original_code}
        ```
        
        需要进行的修改:
        {changes_description}
        
        请提供修改后的代码，并用中文解释所做的更改。"""
        
        try:
            response = self.session.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": "qwen2.5-coder:14b",
                    "prompt": prompt,
                    "stream": True
                },
                stream=True
            )
            response.raise_for_status()
            
            # 收集流式响应
            full_response = ""
            for line in response.iter_lines():
                if line:
                    try:
                        json_response = json.loads(line)
                        full_response += json_response.get('response', '')
                    except json.JSONDecodeError:
                        continue
            
            # 提取修改后的代码和解释
            parts = full_response.split("```")
            if len(parts) >= 3:
                modified_code = parts[1].strip()
                explanation = parts[2].strip()
            else:
                modified_code = full_response
                explanation = "No separate explanation provided"
                
            return {
                "success": True,
                "modified_code": modified_code,
                "explanation": explanation
            }
            
        except Exception as e:
            logger.error(f"Error processing code changes: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
            
    async def _scan_project_structure(self, workspace_path: str) -> List[Dict[str, str]]:
        """扫描项目结构，不读取文件内容"""
        structure = []
        try:
            for root, dirs, files in os.walk(workspace_path):
                # 跳过隐藏目录和无关目录
                dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'venv']]
                
                rel_root = os.path.relpath(root, workspace_path)
                if rel_root == '.':
                    rel_root = ''
                
                # 记录目录
                if rel_root:
                    structure.append({
                        'type': 'dir',
                        'path': rel_root
                    })
                
                # 记录文件
                for file in files:
                    if not file.startswith('.') and file.endswith(('.py', '.js', '.jsx', '.ts', '.tsx', '.json', 'requirements.txt', 'package.json')):
                        structure.append({
                            'type': 'file',
                            'path': os.path.join(rel_root, file)
                        })
            
            return structure
        except Exception as e:
            print(f"Error scanning project: {str(e)}")
            return []

    async def _read_important_files(self, workspace_path: str, structure: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """读取重要文件内容"""
        important_patterns = [
            'main', 'app', 'index',
            'requirements.txt', 'package.json',
            'config', 'settings'
        ]
        
        important_files = []
        for item in structure:
            if item['type'] == 'file':
                filename = os.path.basename(item['path']).lower()
                if any(pattern in filename for pattern in important_patterns):
                    try:
                        with open(os.path.join(workspace_path, item['path']), 'r', encoding='utf-8') as f:
                            content = f.read()
                            important_files.append({
                                'path': item['path'],
                                'content': content
                            })
                    except Exception as e:
                        print(f"Error reading {item['path']}: {e}")
        
        return important_files

    async def _quick_analyze(self, workspace_path: str, focus: str, conversation_id: str) -> str:
        """快速分析项目"""
        try:
            if focus == "structure":
                # 发送开始分析的消息
                await self.send_message(conversation_id, "开始分析项目结构...\n")
                
                # 只分析项目结构
                structure = await self._scan_project_structure(workspace_path)
                if not structure:
                    return "未找到项目文件"
                
                await self.send_message(conversation_id, "已扫描项目结构，正在分析...\n")
                
                prompt = f"""分析这个项目的文件结构：

目录和文件列表：
{chr(10).join(f"{'    ' if item['type'] == 'file' else ''}{item['path']}" for item in structure)}

请简要说明：
1. 项目的基本架构（前后端/单体等）
2. 主要模块划分
3. 最重要的几个文件是哪些"""

            elif focus == "core":
                # 发送开始分析的消息
                await self.send_message(conversation_id, "开始分析核心文件...\n")
                
                # 分析核心文件
                structure = await self._scan_project_structure(workspace_path)
                important_files = await self._read_important_files(workspace_path, structure)
                
                if not important_files:
                    return "未找到核心文件"
                
                await self.send_message(conversation_id, "已读取核心文件，正在分析...\n")
                
                prompt = f"""分析项目的核心文件：

{chr(10).join(f'=== {f["path"]} ===\n```\n{f["content"][:300]}...\n```' for f in important_files)}

请简要说明：
1. 每个文件的主要功能
2. 核心功能实现
3. 关键依赖和技术选择"""

            else:
                return "不支持的分析类型"

            response = await self._generate_with_ollama(prompt, conversation_id)
            return f"=== {focus.title()} ===\n{response}"

        except Exception as e:
            error_msg = f"分析出错: {str(e)}"
            await self.send_message(conversation_id, error_msg)
            return error_msg

    async def chat_with_context(self, 
                              messages: List[Dict[str, str]], 
                              code_context: Optional[str] = None,
                              use_remote: bool = False,
                              conversation_id: str = None,
                              websocket: Optional[WebSocket] = None) -> Dict[str, Any]:
        """Chat with context, choose to use local or remote model"""
        
        if websocket and conversation_id:
            await self.register_websocket(conversation_id, websocket)
        
        try:
            last_message = messages[-1]['content'].lower()
            
            # 检查是否是项目分析请求
            if any(keyword in last_message for keyword in ['分析', '查看', '了解']):
                workspace_path = code_context or self.workspace_path
                
                # 确定分析焦点
                focus = "structure"  # 默认分析结构
                if '文件' in last_message or 'core' in last_message:
                    focus = "core"
                
                # 异步进行分析
                try:
                    analysis_task = asyncio.create_task(
                        self._quick_analyze(workspace_path, focus, conversation_id)
                    )
                    analysis_result = await analysis_task
                    
                    # 添加引导语
                    if focus == "structure":
                        guide = "\n\n你可以输入：\n'分析核心文件' 来了解重要文件的具体实现"
                        analysis_result += guide
                        await self.send_message(conversation_id, guide)
                    
                    return {
                        "choices": [{
                            "message": {
                                "role": "assistant",
                                "content": analysis_result
                            }
                        }]
                    }
                except asyncio.CancelledError:
                    await self.send_message(conversation_id, "分析任务被取消")
                    return {
                        "choices": [{
                            "message": {
                                "role": "assistant",
                                "content": "分析任务被取消"
                            }
                        }]
                    }
                except Exception as e:
                    error_msg = f"分析过程出现错误: {str(e)}"
                    await self.send_message(conversation_id, error_msg)
                    return {
                        "choices": [{
                            "message": {
                                "role": "assistant",
                                "content": error_msg
                            }
                        }]
                    }
                finally:
                    if conversation_id:
                        await self.unregister_websocket(conversation_id)
            
            # 原有的聊天逻辑
            if code_context:
                messages.insert(0, {
                    "role": "system",
                    "content": f"Code context:\n```\n{code_context}\n```\n请根据这段代码上下文来回答问题，使用中文回答。"
                })
            
            if use_remote:
                # 使用远程API
                try:
                    response = self.session.post(
                        f"{self.remote_url}/v1/chat/completions",
                        headers=self._get_remote_headers(),
                        json={
                            "model": "gpt-4",
                            "messages": messages
                        }
                    )
                    response.raise_for_status()
                    return response.json()
                except Exception as e:
                    logger.error(f"Error using remote API: {str(e)}")
                    return {"error": str(e)}
            else:
                # 使用本地Ollama
                try:
                    # 将消息列表转换为单个提示，添加中文要求
                    messages_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in messages])
                    prompt = f"""请用中文回答以下问题：\n\n{messages_text}"""
                    
                    response = self.session.post(
                        f"{self.ollama_url}/api/generate",
                        json={
                            "model": "qwen2.5-coder:14b",
                            "prompt": prompt,
                            "stream": True
                        },
                        stream=True
                    )
                    response.raise_for_status()
                    
                    # 收集流式响应
                    full_response = ""
                    for line in response.iter_lines():
                        if line:
                            try:
                                json_response = json.loads(line)
                                full_response += json_response.get('response', '')
                            except json.JSONDecodeError:
                                continue
                    
                    return {
                        "choices": [{
                            "message": {
                                "role": "assistant",
                                "content": full_response
                            }
                        }]
                    }
                    
                except Exception as e:
                    logger.error(f"Error using Ollama: {str(e)}")
                    return {"error": str(e)}
                
        except Exception as e:
            error_msg = f"处理请求出错: {str(e)}"
            if conversation_id:
                await self.send_message(conversation_id, error_msg)
            return {"error": error_msg}
                
    async def optimize_code(self, code: str) -> Dict[str, Any]:
        """
        Optimize code using local model
        :param code: The code to optimize
        :return: Optimization result
        """
        prompt = f"""Please optimize the following code:
        
        ```
        {code}
        ```
        
        Consider:
        1. Performance improvements
        2. Code readability
        3. Best practices
        4. Potential bugs
        
        Provide the optimized code and explain the improvements."""
        
        try:
            response = self.session.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": "qwen2.5-coder:14b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "system": "You are a code optimization expert. Please analyze the code and provide professional recommendations."
                    }
                }
            )
            response.raise_for_status()
            
            # 获取响应
            response_data = response.json()
            full_response = response_data.get('response', '')
            
            # 提取优化后的代码和解释
            parts = full_response.split("```")
            if len(parts) >= 3:
                optimized_code = parts[1].strip()
                explanation = parts[2].strip()
            else:
                optimized_code = full_response
                explanation = "No separate explanation provided"
                
            return {
                "success": True,
                "optimized_code": optimized_code,
                "explanation": explanation
            }
            
        except Exception as e:
            logger.error(f"Error optimizing code: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
            
    def close(self):
        """关闭会话"""
        self.session.close()
        
    async def analyze_project_structure(self, workspace_path: str) -> str:
        """分析项目结构并返回分析过程"""
        analysis_steps = []
        
        # 步骤1: 扫描文件结构
        try:
            file_structure = []
            for root, dirs, files in os.walk(workspace_path):
                rel_root = os.path.relpath(root, workspace_path)
                for file in files:
                    if not file.startswith('.') and not file.endswith(('.pyc', '.log')):
                        file_structure.append(os.path.join(rel_root, file))
            
            prompt_file_structure = f"""分析以下项目文件结构：

文件列表：
{chr(10).join(file_structure)}

请分析：
1. 项目的主要组件和目录结构
2. 前后端分离情况
3. 主要配置文件的作用"""

            structure_analysis = await self._generate_with_ollama(prompt_file_structure)
            analysis_steps.append(("文件结构分析", structure_analysis))

            # 步骤2: 分析后端架构
            backend_files = [f for f in file_structure if f.startswith('backend/')]
            if backend_files:
                backend_content = []
                for file in backend_files:
                    if file.endswith(('.py', '.txt')):
                        try:
                            with open(os.path.join(workspace_path, file), 'r', encoding='utf-8') as f:
                                content = f.read()
                                backend_content.append(f"文件: {file}\n```python\n{content}\n```")
                        except Exception as e:
                            print(f"Error reading {file}: {e}")

                prompt_backend = f"""分析后端代码架构：

{chr(10).join(backend_content[:2])}  # 限制文件数量以避免超出上下文长度

请分析：
1. 后端使用的框架和主要依赖
2. API接口设计
3. 业务逻辑组织方式"""

                backend_analysis = await self._generate_with_ollama(prompt_backend)
                analysis_steps.append(("后端架构分析", backend_analysis))

            # 步骤3: 分析前端架构
            frontend_files = [f for f in file_structure if f.startswith('frontend/src/')]
            if frontend_files:
                frontend_content = []
                for file in frontend_files:
                    if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
                        try:
                            with open(os.path.join(workspace_path, file), 'r', encoding='utf-8') as f:
                                content = f.read()
                                frontend_content.append(f"文件: {file}\n```javascript\n{content}\n```")
                        except Exception as e:
                            print(f"Error reading {file}: {e}")

                prompt_frontend = f"""分析前端代码架构：

{chr(10).join(frontend_content[:2])}  # 限制文件数量以避免超出上下文长度

请分析：
1. 前端框架和主要依赖
2. 组件结构
3. 状态管理方式"""

                frontend_analysis = await self._generate_with_ollama(prompt_frontend)
                analysis_steps.append(("前端架构分析", frontend_analysis))

            # 步骤4: 分析项目依赖
            dependencies = {}
            if os.path.exists(os.path.join(workspace_path, 'requirements.txt')):
                with open(os.path.join(workspace_path, 'requirements.txt'), 'r') as f:
                    dependencies['python'] = f.read()
            if os.path.exists(os.path.join(workspace_path, 'frontend/package.json')):
                with open(os.path.join(workspace_path, 'frontend/package.json'), 'r') as f:
                    dependencies['node'] = f.read()

            prompt_dependencies = f"""分析项目依赖：

Python依赖：
{dependencies.get('python', 'Not found')}

Node依赖：
{dependencies.get('node', 'Not found')}

请分析：
1. 主要依赖包的作用
2. 依赖版本兼容性
3. 潜在的依赖问题"""

            dependencies_analysis = await self._generate_with_ollama(prompt_dependencies)
            analysis_steps.append(("依赖分析", dependencies_analysis))

            # 步骤5: 总结
            summary_prompt = f"""基于以上分析：
{chr(10).join(f"{step[0]}:\n{step[1]}" for step in analysis_steps)}

请总结：
1. 项目的整体架构特点
2. 技术栈选择的优势
3. 可能的改进建议"""

            final_summary = await self._generate_with_ollama(summary_prompt)
            analysis_steps.append(("最终总结", final_summary))

            # 将所有分析步骤组合成一个字符串
            return "\n\n".join(f"=== {step[0]} ===\n{step[1]}" for step in analysis_steps)

        except Exception as e:
            return f"项目分析过程中出现错误: {str(e)}" 

    async def _generate_with_ollama(self, prompt: str, conversation_id: str) -> str:
        """使用Ollama生成响应"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": "qwen2.5-coder:14b",
                        "prompt": prompt,
                        "stream": True
                    }
                ) as response:
                    response.raise_for_status()
                    
                    # 收集流式响应
                    full_response = ""
                    async for line in response.content:
                        if line:
                            try:
                                json_response = json.loads(line)
                                chunk = json_response.get('response', '')
                                full_response += chunk
                                # 实时发送生成的内容
                                await self.send_message(conversation_id, chunk)
                            except json.JSONDecodeError:
                                continue
                    
                    return full_response
            
        except Exception as e:
            error_msg = f"生成过程中出现错误: {str(e)}"
            await self.send_message(conversation_id, error_msg)
            logger.error(f"Error using Ollama: {str(e)}")
            return error_msg