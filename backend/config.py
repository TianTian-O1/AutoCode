import os

# 配置工作区路径
WORKSPACE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'workspace'))
os.makedirs(WORKSPACE_PATH, exist_ok=True) 