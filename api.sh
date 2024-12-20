#!/bin/bash

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    source .env
fi

curl -X POST "${BASE_URL:-https://tiantian.yicp.top/v1}/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${OPENAI_API_KEY}" \
  -d '{
    "model": "'"${MODEL_NAME:-claude-3-5-sonnet-20241022}"'",
    "messages": [
      {
        "role": "user",
        "content": "Hello! How are you?"
      }
    ]
  }'
