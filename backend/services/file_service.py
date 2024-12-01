import os
from pathlib import Path
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import WORKSPACE_PATH

class FileService:
    def __init__(self):
        self.file_index = {}
        self.scan_workspace()
        
    def scan_workspace(self):
        """扫描工作区并建立索引"""
        self.file_index.clear()
        try:
            if not os.path.exists(WORKSPACE_PATH):
                os.makedirs(WORKSPACE_PATH)
                
            for root, dirs, files in os.walk(WORKSPACE_PATH):
                # 跳过隐藏文件夹
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                
                for name in files:
                    if name.startswith('.'):
                        continue
                        
                    try:
                        abs_path = os.path.join(root, name)
                        if os.path.exists(abs_path):
                            rel_path = os.path.relpath(abs_path, WORKSPACE_PATH)
                            print(f"Indexing file: {rel_path}")
                            self.file_index[rel_path] = {
                                'name': name,
                                'path': rel_path,
                                'type': 'file',
                                'size': os.path.getsize(abs_path),
                                'last_modified': os.path.getmtime(abs_path)
                            }
                    except Exception as e:
                        print(f"Warning: Failed to index file {name}: {str(e)}")
                        continue
                        
        except Exception as e:
            print(f"Warning: Workspace scan failed: {str(e)}")
            
    def record_change(self, file_path: str, change_type: str):
        """记录文件变更"""
        try:
            abs_path = os.path.join(WORKSPACE_PATH, file_path)
            if not os.path.exists(abs_path):
                if change_type == 'delete':
                    self.file_index.pop(file_path, None)
                return
                
            self.file_index[file_path] = {
                'name': os.path.basename(file_path),
                'path': file_path,
                'type': 'file',
                'size': os.path.getsize(abs_path),
                'last_modified': os.path.getmtime(abs_path)
            }
        except Exception as e:
            print(f"Warning: Failed to record change for {file_path}: {str(e)}")
            
    def get_file_list(self):
        """获取文件列表"""
        print("Current file index:", self.file_index)
        return list(self.file_index.values())
        
    def get_file_info(self, file_path: str):
        """获取文件信息"""
        return self.file_index.get(file_path)
        
    def reset(self):
        """重置文件服务"""
        self.file_index.clear()
        self.scan_workspace()