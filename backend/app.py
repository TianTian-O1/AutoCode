from flask import Flask, request, jsonify
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

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def chat():
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response

    try:
        if not SKEY:
            return jsonify({'error': 'API key not configured'}), 500

        data = request.get_json()
        if not data or 'messages' not in data:
            return jsonify({'error': 'No messages provided'}), 400

        messages = data['messages']
        logger.info(f"Chat request received with {len(messages)} messages")

        try:
            # Prepare request payload exactly as in the example
            payload = json.dumps({
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant."
                    }
                ] + messages
            })

            url = BASEURL + "/v1/chat/completions"
            headers = {
                'Accept': 'application/json',
                'Authorization': f'Bearer {SKEY}',
                'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
                'Content-Type': 'application/json'
            }

            logger.info(f"Sending request to API: {payload}")
            logger.info(f"Request URL: {url}")
            logger.info(f"Request headers: {headers}")
            
            # Use session instead of requests.request
            response = session.post(
                url,
                headers=headers,
                data=payload,
                verify=False,
                timeout=30  # 30 seconds timeout
            )
            
            logger.info(f"Response status code: {response.status_code}")
            logger.info(f"Response headers: {response.headers}")
            logger.info(f"Response text: {response.text}")
            
            if response.status_code != 200:
                logger.error(f"API error: {response.text}")
                return jsonify({
                    'error': f'AI service error: {response.text}',
                    'status_code': response.status_code,
                    'headers': dict(response.headers)
                }), response.status_code

            # Parse response JSON as in the example
            data = response.json()
            logger.info(f"API response data: {json.dumps(data)}")
            return jsonify(data)

        except requests.exceptions.RequestException as e:
            logger.error(f"API request error: {str(e)}")
            logger.error(f"Request details: URL={url}, Headers={headers}")
            return jsonify({'error': f'AI service error: {str(e)}'}), 500
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            logger.error(f"Response text: {response.text}")
            return jsonify({'error': 'Invalid JSON response from API'}), 500

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        logger.exception(e)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=8000)
