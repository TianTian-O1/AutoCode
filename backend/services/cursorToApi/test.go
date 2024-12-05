package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Messages []Message `json:"messages"`
	Model    string    `json:"model,omitempty"`
	Stream   bool      `json:"stream,omitempty"`
}

type StreamResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index        int    `json:"index"`
		Delta       struct {
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
}

// 添加模型列表响应结构
type ModelsResponse struct {
	Object string `json:"object"`
	Data   []struct {
		ID      string `json:"id"`
		Object  string `json:"object"`
		Created int64  `json:"created"`
		OwnedBy string `json:"owned_by"`
	} `json:"data"`
}

func main() {
	// 加载环境变量
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found")
	}

	apiKey := os.Getenv("CURSOR_API_KEY")
	if apiKey == "" {
		log.Fatal("CURSOR_API_KEY environment variable is not set")
	}
	log.Printf("Using API key: %s", apiKey)

	// 1. 测试模型列表接口
	log.Println("\nTesting models endpoint...")
	testModels(apiKey)

	// 2. 测试聊天接口
	log.Println("\nTesting chat completions endpoint...")
	testChatCompletions(apiKey)
}

func testModels(apiKey string) {
	// 创建HTTP请求
	req, err := http.NewRequest("GET", "http://localhost:3000/v1/models", nil)
	if err != nil {
		log.Fatalf("Error creating models request: %v", err)
	}

	// 设置请求头
	req.Header.Set("Authorization", "Bearer "+apiKey)

	// 发送请求
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Error sending models request: %v", err)
	}
	defer resp.Body.Close()

	// 检查响应状态
	log.Printf("Models response status: %s", resp.Status)
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Fatalf("Error response: %s", string(body))
	}

	// 解析响应
	var modelsResp ModelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&modelsResp); err != nil {
		log.Fatalf("Error decoding models response: %v", err)
	}

	// 打印模型列表
	fmt.Println("\nAvailable models:")
	fmt.Println(strings.Repeat("-", 80))
	for _, model := range modelsResp.Data {
		fmt.Printf("ID: %s\nObject: %s\nCreated: %d\nOwned by: %s\n\n",
			model.ID, model.Object, model.Created, model.OwnedBy)
	}
}

func testChatCompletions(apiKey string) {
	// 准备请求数据
	req := ChatRequest{
		Messages: []Message{
			{Role: "user", Content: "你好，请介绍一下你自己。"},
		},
		Model:  "gpt-4o",
		Stream: true,
	}

	// 转换为JSON
	jsonData, err := json.Marshal(req)
	if err != nil {
		log.Fatalf("Error marshaling request: %v", err)
	}
	log.Printf("Request data: %s", string(jsonData))

	// 创建HTTP请求
	httpReq, err := http.NewRequest("POST", "http://localhost:3000/v1/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Fatalf("Error creating request: %v", err)
	}

	// 设置请求头
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	// 发送请求
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		log.Fatalf("Error sending request: %v", err)
	}
	defer resp.Body.Close()

	// 检查响应状态
	log.Printf("Response status: %s", resp.Status)
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Fatalf("Error response: %s", string(body))
	}

	fmt.Println("\nStreaming response:")
	fmt.Println(strings.Repeat("-", 80))

	// 读取流式响应
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		log.Printf("Raw line: %s", line)
		
		if line == "" {
			continue
		}

		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			fmt.Println("\n" + strings.Repeat("-", 80))
			fmt.Println("Stream finished")
			break
		}

		var streamResp StreamResponse
		if err := json.Unmarshal([]byte(data), &streamResp); err != nil {
			log.Printf("Error parsing response: %v", err)
			continue
		}

		if len(streamResp.Choices) > 0 {
			content := streamResp.Choices[0].Delta.Content
			if content != "" {
				fmt.Print(content)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		log.Printf("Error reading response: %v", err)
	}
} 