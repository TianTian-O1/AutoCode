import requests
import json

url = "http://192.168.1.5:11434/api/generate"
data = {
    "model": "codellama",
    "prompt": "Hello World"
}

response = requests.post(url, json=data, stream=True)
for line in response.iter_lines():
    if line:
        json_response = json.loads(line)
        print(json_response.get('response', ''), end='')
