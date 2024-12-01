from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
import shutil
from pathlib import Path
from werkzeug.utils import secure_filename
from services.file_service import FileService
from config import WORKSPACE_PATH

app = Flask(__name__)
CORS(app)

# 初始化文件服务
file_service = FileService()

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """处理文件上传"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
            
        file = request.files['file']
        if not file.filename:
            return jsonify({'error': 'No file selected'}), 400
            
        try:
            # 处理文件路径，保持目录结构
            file_path = file.filename.replace('\\', '/').lstrip('/')
            
            # 获取目标目录路径
            dir_path = os.path.dirname(file_path)
            if dir_path:
                target_dir = os.path.join(WORKSPACE_PATH, dir_path)
                # 创建目标目录
                os.makedirs(target_dir, exist_ok=True)
            
            # 构建完整的文件路径
            full_path = os.path.join(WORKSPACE_PATH, file_path)
            
            # 确保路径安全
            if not os.path.abspath(full_path).startswith(os.path.abspath(WORKSPACE_PATH)):
                return jsonify({'error': 'Invalid file path'}), 400
            
            # 保存文件
            print(f"Saving file to: {full_path}")
            file.save(full_path)
            
            # 获取相对路径
            rel_path = os.path.relpath(full_path, WORKSPACE_PATH)
            
            # 更新文件索引
            file_service.record_change(rel_path, 'upload')
            
            return jsonify({
                'message': 'File uploaded successfully',
                'file': {
                    'name': os.path.basename(file_path),
                    'path': rel_path,
                    'type': 'file',
                    'size': os.path.getsize(full_path)
                }
            })
            
        except Exception as e:
            print(f"Upload error: {str(e)}")
            return jsonify({'error': f'Failed to save file: {str(e)}'}), 500
            
    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/files', methods=['GET', 'DELETE'])
def handle_files():
    """处理文件操作"""
    if request.method == 'GET':
        try:
            files = file_service.get_file_list()
            print("Files to return:", files)  # 打印要返回的文件列表
            return jsonify({'files': files})
        except Exception as e:
            print(f"Error listing files: {str(e)}")
            return jsonify({'error': str(e)}), 500
    elif request.method == 'DELETE':
        try:
            file_path = request.args.get('path')
            if not file_path:
                return jsonify({'error': 'File path is required'}), 400
                
            abs_path = os.path.join(WORKSPACE_PATH, file_path)
            
            # 确保路径安全
            if not os.path.abspath(abs_path).startswith(os.path.abspath(WORKSPACE_PATH)):
                return jsonify({'error': 'Invalid file path'}), 400
                
            if not os.path.exists(abs_path):
                return jsonify({'error': 'File not found'}), 404
                
            # 删除文件或目录
            try:
                if os.path.isfile(abs_path):
                    os.remove(abs_path)
                else:
                    shutil.rmtree(abs_path)
                    
                # 更新文件索引
                file_service.record_change(file_path, 'delete')
                
                return jsonify({'success': True})
            except Exception as e:
                print(f"Error deleting {abs_path}: {e}")
                return jsonify({'error': f'Failed to delete file: {str(e)}'}), 500
                
        except Exception as e:
            print(f"Error in delete: {str(e)}")
            return jsonify({'error': str(e)}), 500

@app.route('/api/files/content')
def get_file_content():
    """获取件内容"""
    try:
        file_path = request.args.get('path')
        if not file_path:
            return jsonify({'error': 'File path is required'}), 400
            
        abs_path = os.path.join(WORKSPACE_PATH, file_path)
        
        # 确保路径安全
        if not os.path.abspath(abs_path).startswith(os.path.abspath(WORKSPACE_PATH)):
            return jsonify({'error': 'Invalid file path'}), 400
            
        if not os.path.exists(abs_path):
            return jsonify({'error': 'File not found'}), 404
            
        # 读取文件内容
        with open(abs_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'content': content})
            
    except Exception as e:
        print(f"Error reading file: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/reset', methods=['POST'])
def reset():
    """重置项目"""
    try:
        # 清空工作区
        if os.path.exists(WORKSPACE_PATH):
            for item in os.listdir(WORKSPACE_PATH):
                item_path = os.path.join(WORKSPACE_PATH, item)
                try:
                    if os.path.isfile(item_path):
                        os.remove(item_path)
                    else:
                        shutil.rmtree(item_path)
                except Exception as e:
                    print(f"Error removing {item_path}: {e}")
            
            # 删除工作区目录本身
            shutil.rmtree(WORKSPACE_PATH)
        
        # 重新创建空的工作区目录
        os.makedirs(WORKSPACE_PATH, exist_ok=True)
        
        # 清空文件索引并重新扫描
        file_service.reset()
        
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error in reset: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
