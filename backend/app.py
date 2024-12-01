from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import logging
import shutil
from werkzeug.utils import secure_filename
import openai
from dotenv import load_dotenv
import requests
import json
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import subprocess
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Configure API keys
BASEURL = os.getenv('CLAUDE_API_BASE', 'https://api.claude-Plus.top')
SKEY = os.getenv('CLAUDE_API_KEY')

if not SKEY:
    logger.warning("CLAUDE_API_KEY not set in environment variables or .env file")

# Configure requests session with retry mechanism
session = requests.Session()
retry_strategy = Retry(
    total=3,  # number of retries
    backoff_factor=1,  # wait 1, 2, 4 seconds between retries
    status_forcelist=[500, 502, 503, 504]  # HTTP status codes to retry on
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("http://", adapter)
session.mount("https://", adapter)

app = Flask(__name__)

# Configure CORS
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept", "Authorization", "X-Requested-With", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"],
        "expose_headers": ["Content-Length", "Content-Range"],
        "supports_credentials": True
    }
})

# Configure file upload settings
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
app.config['UPLOAD_EXTENSIONS'] = None  # Allow all file types

# Configure workspace path
WORKSPACE_PATH = os.getenv('WORKSPACE_PATH', os.path.join(os.path.dirname(__file__), 'workspace'))
os.makedirs(WORKSPACE_PATH, exist_ok=True)

# 配置 OpenAI API
openai.api_key = os.getenv('OPENAI_API_KEY')

@app.route('/api/upload', methods=['POST', 'OPTIONS'])
def upload_file():
    # Handle preflight request
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response

    try:
        logger.info("=== Starting file upload ===")
        logger.info(f"Request headers: {dict(request.headers)}")
        logger.info(f"Request files: {list(request.files.keys())}")
        logger.info(f"Request form: {dict(request.form)}")
        
        if 'file' not in request.files:
            logger.error("No file in request")
            return jsonify({'error': 'No file provided'}), 400
            
        file = request.files['file']
        path = request.form.get('path', '').strip('/')
        
        logger.info(f"Uploading file: {file.filename} to path: {path}")
        
        if not file.filename:
            logger.error("Empty filename")
            return jsonify({'error': 'No file selected'}), 400
            
        try:
            # Process the path components
            if path:
                # Split path and clean each component
                path_parts = []
                for part in path.split('/'):
                    # Remove any problematic characters but keep more valid ones
                    cleaned_part = ''.join(c for c in part if c.isalnum() or c in '-._')
                    if cleaned_part:
                        path_parts.append(cleaned_part)
                save_path = os.path.join(WORKSPACE_PATH, *path_parts)
            else:
                save_path = WORKSPACE_PATH
            
            logger.info(f"Save path: {save_path}")
            
            # Create directory structure
            os.makedirs(save_path, exist_ok=True)
            logger.info(f"Created/verified directory: {save_path}")
            
            # Clean the filename but preserve extension
            filename = file.filename
            if '/' in filename or '\\' in filename:
                filename = os.path.basename(filename)
            
            # Split filename and extension
            name, ext = os.path.splitext(filename)
            # Clean the name part
            clean_name = ''.join(c for c in name if c.isalnum() or c in '-._')
            # Truncate if too long (leaving room for extension)
            if len(clean_name) > 200:
                clean_name = clean_name[:200]
            # Reassemble filename
            filename = clean_name + ext
            
            # Get the full file path
            file_path = os.path.join(save_path, filename)
            logger.info(f"Full file path: {file_path}")
            
            # Ensure the final path is still within WORKSPACE_PATH
            if not os.path.abspath(file_path).startswith(os.path.abspath(WORKSPACE_PATH)):
                logger.error(f"Invalid file path: {file_path}")
                return jsonify({'error': 'Invalid file path'}), 400
            
            # Handle duplicate filenames
            counter = 1
            original_name, ext = os.path.splitext(filename)
            while os.path.exists(file_path):
                new_name = f"{original_name}_{counter}{ext}"
                file_path = os.path.join(save_path, new_name)
                counter += 1
            
            # Save the file
            file.save(file_path)
            file_size = os.path.getsize(file_path)
            logger.info(f"Successfully saved file: {file_path} (size: {file_size} bytes)")
            
            # Get relative path
            rel_path = os.path.relpath(file_path, WORKSPACE_PATH)
            
            response_data = {
                'message': 'File uploaded successfully',
                'file': {
                    'name': os.path.basename(file_path),
                    'path': rel_path,
                    'type': 'file',
                    'size': file_size
                }
            }
            logger.info(f"Sending response: {response_data}")
            return jsonify(response_data), 200
            
        except Exception as e:
            logger.error(f"Error saving file: {str(e)}")
            logger.exception(e)
            return jsonify({'error': f'Failed to save file: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"Error in upload endpoint: {str(e)}")
        logger.exception(e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/files', methods=['GET', 'DELETE', 'OPTIONS'])
def handle_files():
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response
        
    if request.method == 'DELETE':
        try:
            path = request.args.get('path', '').strip('/')
            logger.info(f"Deleting path: {path}")
            
            if not path:
                return jsonify({'error': 'No path provided'}), 400
                
            # Get the full path
            full_path = os.path.join(WORKSPACE_PATH, path)
            full_path = os.path.abspath(full_path)
            
            # Ensure the path is within WORKSPACE_PATH
            if not full_path.startswith(os.path.abspath(WORKSPACE_PATH)):
                logger.error(f"Invalid path: {full_path}")
                return jsonify({'error': 'Invalid path'}), 400
                
            if not os.path.exists(full_path):
                logger.error(f"Path not found: {full_path}")
                return jsonify({'error': 'Path not found'}), 404
                
            try:
                if os.path.isfile(full_path):
                    os.remove(full_path)
                    logger.info(f"Deleted file: {full_path}")
                else:
                    shutil.rmtree(full_path)
                    logger.info(f"Deleted directory and its contents: {full_path}")
                    
                return jsonify({'message': 'Successfully deleted'})
            except Exception as e:
                logger.error(f"Error deleting {full_path}: {str(e)}")
                logger.exception(e)
                return jsonify({'error': f'Failed to delete: {str(e)}'}), 500
                
        except Exception as e:
            logger.error(f"Error in delete endpoint: {str(e)}")
            logger.exception(e)
            return jsonify({'error': str(e)}), 500
            
    # GET method - list files
    try:
        path = request.args.get('path', '').strip('/')
        logger.info(f"Listing files for path: {path}")
        
        # Get the full directory path
        dir_path = os.path.join(WORKSPACE_PATH, path) if path else WORKSPACE_PATH
        dir_path = os.path.abspath(dir_path)
        
        # Ensure the path is within WORKSPACE_PATH
        if not dir_path.startswith(os.path.abspath(WORKSPACE_PATH)):
            logger.error(f"Invalid path: {dir_path}")
            return jsonify({'error': 'Invalid path'}), 400
        
        if not os.path.exists(dir_path):
            return jsonify({'files': []})
            
        files = []
        for root, dirs, filenames in os.walk(dir_path):
            # Get relative path from WORKSPACE_PATH
            rel_root = os.path.relpath(root, WORKSPACE_PATH)
            if rel_root == '.':
                rel_root = ''
                
            # Add directories
            for dirname in dirs:
                dir_path = os.path.join(root, dirname)
                rel_path = os.path.relpath(dir_path, WORKSPACE_PATH)
                
                files.append({
                    'name': dirname,
                    'path': rel_path,
                    'type': 'directory',
                    'itemCount': len(os.listdir(dir_path))
                })
            
            # Add files
            for filename in filenames:
                file_path = os.path.join(root, filename)
                rel_path = os.path.relpath(file_path, WORKSPACE_PATH)
                
                try:
                    files.append({
                        'name': filename,
                        'path': rel_path,
                        'type': 'file',
                        'size': os.path.getsize(file_path)
                    })
                except Exception as e:
                    logger.error(f"Error processing file {file_path}: {str(e)}")
                    continue
            
        logger.info(f"Found {len(files)} files/directories")
        return jsonify({'files': files})
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        logger.exception(e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/files/read', methods=['GET', 'OPTIONS'])
def read_file():
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response

    try:
        path = request.args.get('path', '').strip('/')
        logger.info(f"Reading file: {path}")
        
        if not path:
            return jsonify({'error': 'No path provided'}), 400
            
        # Get the full path
        full_path = os.path.join(WORKSPACE_PATH, path)
        full_path = os.path.abspath(full_path)
        
        # Ensure the path is within WORKSPACE_PATH
        if not full_path.startswith(os.path.abspath(WORKSPACE_PATH)):
            logger.error(f"Invalid path: {full_path}")
            return jsonify({'error': 'Invalid path'}), 400
            
        if not os.path.exists(full_path):
            logger.error(f"File not found: {full_path}")
            return jsonify({'error': 'File not found'}), 404
            
        if not os.path.isfile(full_path):
            logger.error(f"Not a file: {full_path}")
            return jsonify({'error': 'Not a file'}), 400
            
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            logger.info(f"Successfully read file: {full_path}")
            return jsonify({
                'content': content,
                'path': path,
                'name': os.path.basename(path)
            })
        except UnicodeDecodeError:
            logger.error(f"Binary file detected: {full_path}")
            return jsonify({'error': 'Cannot read binary file'}), 400
        except Exception as e:
            logger.error(f"Error reading file {full_path}: {str(e)}")
            logger.exception(e)
            return jsonify({'error': f'Failed to read file: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"Error in read endpoint: {str(e)}")
        logger.exception(e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        message = data.get('message')
        file_path = data.get('filePath')
        chat_history = data.get('history', [])

        if not message:
            return jsonify({'error': 'No message provided'}), 400

        # 如果指定了文件路径，读取文件内容
        file_content = None
        if file_path:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    file_content = f.read()
            except Exception as e:
                return jsonify({'error': f'Failed to read file: {str(e)}'}), 500

        # 构建系统提示
        system_prompt = """You are an AI assistant that helps users modify their code through natural language conversation. 
        You can understand user requirements and suggest code changes. When modifying files:
        1. First analyze the current code and understand what needs to be changed
        2. Explain your proposed changes clearly
        3. Show the exact code changes that need to be made
        4. Ask for confirmation before making any changes"""

        # 构建消息历史
        messages = [
            {"role": "system", "content": system_prompt}
        ]

        # 添加聊天历史
        for chat in chat_history:
            messages.append({
                "role": "user" if chat['isUser'] else "assistant",
                "content": chat['message']
            })

        # 如果有文件内容，添加到当前上下文
        if file_content:
            messages.append({
                "role": "system",
                "content": f"Current file content:\n```\n{file_content}\n```"
            })

        # 添加用户的新消息
        messages.append({"role": "user", "content": message})

        # 调用 OpenAI API
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.7,
            max_tokens=2000
        )

        # 获取 AI 的回复
        ai_response = response.choices[0].message['content']

        # 检查是否包含代码修改建议
        if '```' in ai_response:
            # 这里可以添加代码解析和文件修改的逻辑
            pass

        return jsonify({
            'message': ai_response,
            'needsConfirmation': '```' in ai_response
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/apply-changes', methods=['POST'])
def apply_changes():
    try:
        data = request.json
        file_path = data.get('filePath')
        new_content = data.get('content')

        if not file_path or not new_content:
            return jsonify({'error': 'File path and content are required'}), 400

        # 备份原文件
        backup_path = f"{file_path}.bak"
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(original_content)
        except Exception as e:
            return jsonify({'error': f'Failed to create backup: {str(e)}'}), 500

        # 写入新内容
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
        except Exception as e:
            # 如果写入失败，尝试恢复备份
            try:
                with open(backup_path, 'r', encoding='utf-8') as f:
                    backup_content = f.read()
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(backup_content)
            except:
                pass
            return jsonify({'error': f'Failed to write file: {str(e)}'}), 500

        # 删除备份文件
        try:
            os.remove(backup_path)
        except:
            pass

        return jsonify({'message': 'Changes applied successfully'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/git/commit', methods=['POST'])
def git_commit():
    try:
        data = request.json
        message = data.get('message', f'Auto commit at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        
        # 获取当前工作目录
        cwd = os.getcwd()
        
        # 执行 git add
        subprocess.run(['git', 'add', '.'], check=True, cwd=cwd)
        
        # 执行 git commit
        subprocess.run(['git', 'commit', '-m', message], check=True, cwd=cwd)
        
        return jsonify({'message': 'Successfully committed changes'})
    except subprocess.CalledProcessError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/git/history', methods=['GET'])
def git_history():
    try:
        # 获取当前工作目录
        cwd = os.getcwd()
        
        # 获取 git log
        result = subprocess.run(
            ['git', 'log', '--pretty=format:%H|%an|%ad|%s', '--date=iso'],
            capture_output=True,
            text=True,
            check=True,
            cwd=cwd
        )
        
        # 解析 git log 输出
        commits = []
        for line in result.stdout.split('\n'):
            if line:
                hash_id, author, date, message = line.split('|')
                commits.append({
                    'hash': hash_id,
                    'author': author,
                    'date': date,
                    'message': message
                })
        
        return jsonify(commits)
    except subprocess.CalledProcessError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/git/revert', methods=['POST'])
def git_revert():
    try:
        data = request.json
        commit_hash = data.get('hash')
        
        if not commit_hash:
            return jsonify({'error': 'Commit hash is required'}), 400
        
        # 获取当前工作目录
        cwd = os.getcwd()
        
        # 检查是否有未提交的更改
        status = subprocess.run(
            ['git', 'status', '--porcelain'],
            capture_output=True,
            text=True,
            check=True,
            cwd=cwd
        )
        
        if status.stdout.strip():
            # 如果有未提交的更改，先创建一个临时提交
            subprocess.run(['git', 'add', '.'], check=True, cwd=cwd)
            subprocess.run(
                ['git', 'commit', '-m', 'Temporary commit before revert'],
                check=True,
                cwd=cwd
            )
        
        # 执行 git revert
        subprocess.run(['git', 'revert', '--no-commit', commit_hash], check=True, cwd=cwd)
        subprocess.run(
            ['git', 'commit', '-m', f'Revert to {commit_hash}'],
            check=True,
            cwd=cwd
        )
        
        return jsonify({'message': f'Successfully reverted to commit {commit_hash}'})
    except subprocess.CalledProcessError as e:
        # 如果出错，尝试中止 revert
        try:
            subprocess.run(['git', 'revert', '--abort'], cwd=cwd)
        except:
            pass
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/git/reset', methods=['POST'])
def git_reset():
    try:
        data = request.json
        commit_hash = data.get('hash')
        mode = data.get('mode', 'mixed')  # 可以是 soft, mixed, 或 hard
        
        if not commit_hash:
            return jsonify({'error': 'Commit hash is required'}), 400
        
        if mode not in ['soft', 'mixed', 'hard']:
            return jsonify({'error': 'Invalid reset mode'}), 400
        
        # 获取当前工作目录
        cwd = os.getcwd()
        
        # 执行 git reset
        subprocess.run(['git', 'reset', f'--{mode}', commit_hash], check=True, cwd=cwd)
        
        return jsonify({'message': f'Successfully reset to commit {commit_hash} with mode {mode}'})
    except subprocess.CalledProcessError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=8000)
