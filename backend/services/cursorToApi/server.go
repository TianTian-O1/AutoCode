package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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

type ChatResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index   int `json:"index"`
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
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

func handleChatCompletions(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 如果请求指定了非流式响应
	if !req.Stream {
		handleNonStreamingResponse(c, req)
		return
	}

	// 处理流式响应
	handleStreamingResponse(c, req)
}

func handleNonStreamingResponse(c *gin.Context, req ChatRequest) {
	// 创建响应数据
	response := ChatResponse{
		ID:      uuid.New().String(),
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   req.Model,
		Choices: []struct {
			Index   int `json:"index"`
			Message struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		}{
			{
				Index: 0,
				Message: struct {
					Role    string `json:"role"`
					Content string `json:"content"`
				}{
					Role:    "assistant",
					Content: "你好！我是一个AI助手。你的输入是: " + req.Messages[len(req.Messages)-1].Content,
				},
				FinishReason: "stop",
			},
		},
		Usage: struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		}{
			PromptTokens:     10,
			CompletionTokens: 10,
			TotalTokens:      20,
		},
	}

	c.JSON(http.StatusOK, response)
}

func handleStreamingResponse(c *gin.Context, req ChatRequest) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")

	// 创建流式响应
	messages := []string{
		"你好！",
		"我是",
		"一个",
		"AI",
		"助手。",
		"\n你的输入是: ",
		req.Messages[len(req.Messages)-1].Content,
	}

	for _, msg := range messages {
		response := StreamResponse{
			ID:      uuid.New().String(),
			Object:  "chat.completion.chunk",
			Created: time.Now().Unix(),
			Model:   req.Model,
			Choices: []struct {
				Index        int    `json:"index"`
				Delta       struct {
					Content string `json:"content"`
				} `json:"delta"`
				FinishReason *string `json:"finish_reason"`
			}{
				{
					Index: 0,
					Delta: struct {
						Content string `json:"content"`
					}{
						Content: msg,
					},
				},
			},
		}

		// 发送响应
		jsonData, _ := json.Marshal(response)
		c.Writer.Write([]byte("data: " + string(jsonData) + "\n\n"))
		c.Writer.Flush()
		time.Sleep(100 * time.Millisecond) // 添加延迟使流式效果更明显
	}

	// 发送结束标记
	finish := "stop"
	response := StreamResponse{
		ID:      uuid.New().String(),
		Object:  "chat.completion.chunk",
		Created: time.Now().Unix(),
		Model:   req.Model,
		Choices: []struct {
			Index        int    `json:"index"`
			Delta       struct {
				Content string `json:"content"`
			} `json:"delta"`
			FinishReason *string `json:"finish_reason"`
		}{
			{
				Index: 0,
				Delta: struct {
					Content string `json:"content"`
				}{
					Content: "",
				},
				FinishReason: &finish,
			},
		},
	}
	jsonData, _ := json.Marshal(response)
	c.Writer.Write([]byte("data: " + string(jsonData) + "\n\n"))
	c.Writer.Write([]byte("data: [DONE]\n\n"))
	c.Writer.Flush()
}

func main() {
	// 加载环境变量
	if err := godotenv.Load(); err != nil {
		log.Printf("Error loading .env file: %v", err)
	}

	// 设置端口
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// 创建路由
	r := gin.Default()

	// 配置CORS
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	r.Use(cors.New(config))

	// 注册路由
	r.POST("/v1/chat/completions", handleChatCompletions)

	// 启动服务器
	log.Printf("Server starting on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}
