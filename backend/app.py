from fastapi import FastAPI, HTTPException, Request, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import os
import json
import shutil
from pathlib import Path
from services.ai_service import AIService

app = FastAPI()

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化AI服务
workspace_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ai_service = AIService(workspace_path)

# 确保工作区目录存在
workspace_dir = os.path.join(workspace_path, 'workspace')
os.makedirs(workspace_dir, exist_ok=True)

class ChatRequest(BaseModel):
    conversation_id: str
    message: str
    system_prompt: Optional[str] = None
    file_context: Optional[Dict[str, Any]] = None

class CodeAnalysisRequest(BaseModel):
    file_path: str

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """处理聊天请求"""
    try:
        # 准备上下文信息
        context = ""
        if request.file_context:
            context = f"""当前文件上下文：
路径: {request.file_context.get('path')}
语言: {request.file_context.get('language')}
内容:
```
{request.file_context.get('content')}
```
"""

        # 调用AI服务
        response = await ai_service.chat(
            request.conversation_id,
            request.message,
            request.system_prompt,
            context
        )

        # 解析模型的响应，查找可能的操作指令
        actions = []
        if isinstance(response.get('message'), str):
            message = response['message']
            # 检查是否包含文件操作指令
            if '需要读取文件' in message or '查看文件' in message:
                actions.append({
                    'type': 'read_file',
                    'path': request.file_context.get('path') if request.file_context else None
                })
            if '需要修改文件' in message or '修改代码' in message:
                actions.append({
                    'type': 'modify_file',
                    'path': request.file_context.get('path') if request.file_context else None
                })
            if '分析代码' in message or '代码分析' in message:
                actions.append({
                    'type': 'analyze_code',
                    'path': request.file_context.get('path') if request.file_context else None
                })
            if '生成代码' in message or '补全代码' in message:
                actions.append({
                    'type': 'generate_code',
                    'content': None  # 将在后续实现中填充
                })

        # 将操作指令添加到响应中
        response['actions'] = actions
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-code")
async def analyze_code(request: CodeAnalysisRequest):
    """分析代码"""
    try:
        response = await ai_service.analyze_code(request.file_path)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """处理文件上传"""
    try:
        # 处理文件路径，保持目录结构
        file_path = file.filename.replace('\\', '/').lstrip('/')
        
        # 获取目标目录路径
        dir_path = os.path.dirname(file_path)
        if dir_path:
            target_dir = os.path.join(workspace_dir, dir_path)
            # 创建目标目录
            os.makedirs(target_dir, exist_ok=True)
        
        # 构建完整的文件路径
        full_path = os.path.join(workspace_dir, file_path)
        
        # 确保路径安全
        if not os.path.abspath(full_path).startswith(os.path.abspath(workspace_dir)):
            raise HTTPException(status_code=400, detail="Invalid file path")
        
        # 保存文件
        try:
            with open(full_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        finally:
            file.file.close()
        
        # 获取相对路径
        rel_path = os.path.relpath(full_path, workspace_dir)
        
        return {
            "message": "File uploaded successfully",
            "file": {
                "name": os.path.basename(file_path),
                "path": rel_path,
                "type": "file",
                "size": os.path.getsize(full_path)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files")
async def list_files():
    """列出所有文件"""
    try:
        files = []
        for root, dirs, filenames in os.walk(workspace_dir):
            # 获取相对于工作区的路径
            rel_root = os.path.relpath(root, workspace_dir)
            if rel_root == ".":
                rel_root = ""
            
            # 添加目录
            for dir_name in dirs:
                dir_path = os.path.join(rel_root, dir_name)
                files.append({
                    "name": dir_name,
                    "path": dir_path,
                    "type": "directory",
                    "size": 0
                })
            
            # 添加文件
            for filename in filenames:
                file_path = os.path.join(rel_root, filename)
                full_path = os.path.join(workspace_dir, file_path)
                files.append({
                    "name": filename,
                    "path": file_path,
                    "type": "file",
                    "size": os.path.getsize(full_path)
                })
        
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/files")
async def delete_file(path: str):
    """删除文件"""
    try:
        full_path = os.path.join(workspace_dir, path)
        
        # 确保路径安全
        if not os.path.abspath(full_path).startswith(os.path.abspath(workspace_dir)):
            raise HTTPException(status_code=400, detail="Invalid file path")
        
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # 删除文件或目录
        if os.path.isfile(full_path):
            os.remove(full_path)
        else:
            shutil.rmtree(full_path)
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files/content")
async def get_file_content(path: str):
    """获取文件内容"""
    try:
        full_path = os.path.join(workspace_dir, path)
        
        # 确保路径安全
        if not os.path.abspath(full_path).startswith(os.path.abspath(workspace_dir)):
            raise HTTPException(status_code=400, detail="Invalid file path")
        
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # 读取文件内容
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reset")
async def reset_workspace():
    """重置工作区"""
    try:
        # 清空工作区
        if os.path.exists(workspace_dir):
            for item in os.listdir(workspace_dir):
                item_path = os.path.join(workspace_dir, item)
                try:
                    if os.path.isfile(item_path):
                        os.remove(item_path)
                    else:
                        shutil.rmtree(item_path)
                except Exception as e:
                    print(f"Error removing {item_path}: {e}")
        
        # 重新创建工作区目录
        os.makedirs(workspace_dir, exist_ok=True)
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("shutdown")
def shutdown_event():
    """关闭服务"""
    ai_service.close()

@app.post("/api/undo")
async def undo_action():
    """撤销操作"""
    try:
        # TODO: 实现版本控制功能
        return {"success": True, "message": "Operation not supported yet"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/redo")
async def redo_action():
    """重做操作"""
    try:
        # TODO: 实现版本控制功能
        return {"success": True, "message": "Operation not supported yet"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/search")
async def search_files(query: str):
    """搜索文件"""
    try:
        results = []
        for root, dirs, files in os.walk(workspace_dir):
            for name in files:
                if query.lower() in name.lower():
                    file_path = os.path.join(root, name)
                    rel_path = os.path.relpath(file_path, workspace_dir)
                    results.append({
                        "name": name,
                        "path": rel_path,
                        "type": "file",
                        "size": os.path.getsize(file_path)
                    })
        return {"files": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/{conversation_id}")
async def websocket_endpoint(websocket: WebSocket, conversation_id: str):
    await websocket.accept()
    try:
        while True:
            # 等待消息
            data = await websocket.receive_text()
            
            # 解析消息
            try:
                message_data = json.loads(data)
                message = message_data.get('message', '')
                system_prompt = message_data.get('system_prompt')
                file_context = message_data.get('file_context')
                
                # 调用AI服务
                response = await ai_service.chat(
                    conversation_id=conversation_id,
                    message=message,
                    system_prompt=system_prompt,
                    context=file_context.get('content') if file_context else None,
                    websocket=websocket
                )
                
                # 发送完整响应
                await websocket.send_json(response)
                
            except json.JSONDecodeError:
                await websocket.send_json({
                    "error": "Invalid message format"
                })
                
    except WebSocketDisconnect:
        # 处理连接断开
        pass
    except Exception as e:
        await websocket.send_json({
            "error": str(e)
        })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
