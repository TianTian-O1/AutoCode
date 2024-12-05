package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

// 支持的模型列表
var supportedModels = map[string]bool{
	"gpt-4":             true,
	"gpt-3.5-turbo":     true,
	"claude-3-opus":     true,
	"claude-3-sonnet":   true,
	"claude-2":          true,
	"gemini-pro":        true,
	"gemini-pro-vision": true,
}

// 错误响应结构
type ErrorResponse struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
}

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

func validateRequest(req *ChatRequest) error {
	// 检查消息列表
	if len(req.Messages) == 0 {
		return fmt.Errorf("messages array is empty")
	}

	// 检查每条消息
	for i, msg := range req.Messages {
		if msg.Role == "" {
			return fmt.Errorf("message at index %d has empty role", i)
		}
		if msg.Content == "" {
			return fmt.Errorf("message at index %d has empty content", i)
		}
		if msg.Role != "user" && msg.Role != "assistant" && msg.Role != "system" {
			return fmt.Errorf("message at index %d has invalid role: %s", i, msg.Role)
		}
	}

	// 检查模型
	if req.Model != "" && !supportedModels[req.Model] {
		return fmt.Errorf("unsupported model: %s", req.Model)
	}

	return nil
}

func handleError(c *gin.Context, statusCode int, errType, message string) {
	var response ErrorResponse
	response.Error.Message = message
	response.Error.Type = errType
	response.Error.Code = fmt.Sprintf("error_%d", statusCode)
	
	c.JSON(statusCode, response)
}

func handleChatCompletions(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, http.StatusBadRequest, "invalid_request_error", fmt.Sprintf("Invalid request format: %v", err))
		return
	}

	// 验证请求
	if err := validateRequest(&req); err != nil {
		handleError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 如果没有指定模型，使用默认模型
	if req.Model == "" {
		req.Model = "gpt-3.5-turbo"
	}

	// 如果请求指定了非流式响应
	if !req.Stream {
		handleNonStreamingResponse(c, req)
		return
	}

	// 处理流式响应
	handleStreamingResponse(c, req)
}

func handleModels(c *gin.Context) {
	models := []gin.H{}
	for model := range supportedModels {
		models = append(models, gin.H{
			"id":       model,
			"object":   "model",
			"created":  time.Now().Unix(),
			"owned_by": "autocode",
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"object": "list",
		"data":   models,
	})
}

// 模型特定的响应生成器
func generateModelResponse(model string, userMessage string) string {
	switch model {
	case "claude-3-opus", "claude-3-sonnet", "claude-2":
		if strings.Contains(userMessage, "量子计算") {
			return `我是 Claude AI 助手。让我为你详细解释量子计算：

量子计算是一种利用量子力学原理进行信息处理的计算方式。与传统计算机使用比特（0或1）不同，量子计算机使用量子比特（qubit），它可以同时处于多个状态的叠加。

主要特点：
1. 量子叠加：qubit可以同时表示多个状态
2. 量子纠缠：多个qubit之间存在特殊的关联
3. 量子干涉：利用波动性进行并行计算

应用领域：
- 密码学和加密
- 药物研发和分子模拟
- 金融建模
- 人工智能优化
- 天气预报

目前挑战：
- 量子退相干
- 错误校正
- 硬件稳定性

这项技术将彻底改变计算的未来。需要我详细解释某个方面吗？`
		} else if strings.Contains(userMessage, "人工智能") {
			return `我是 Claude AI 助手。让我专业地解释人工智能：

人工智能(AI)是模拟人类智能的计算机系统，主要包括：

核心技术：
1. 机器学习：从数据中学习模式
2. 深度学习：使用神经网络处理复杂任务
3. 自然语言处理：理解和生成人类语言
4. 计算机视觉：处理和理解视觉信息

应用领域：
- 智能助手和聊天机器人
- 自动驾驶
- 医疗诊断
- 金融分析
- 智能制造

发展趋势：
- 大型语言模型
- 多模态AI
- 可解释AI
- 边缘计算

这是一个快速发展的领域，正在改变各个行业。`
		} else {
			return fmt.Sprintf(`我是 Claude AI 助手。收到你的问题：%s

让我以专业、系统的方式为你解答。这个问题涉及以下几个方面：

1. 基本概念和定义
2. 核心原理和机制
3. 实际应用场景
4. 最新发展趋势

请告诉我你最感兴趣的方面，我可以深入展开讨论。`, userMessage)
		}
	case "gpt-4", "gpt-3.5-turbo":
		if strings.Contains(userMessage, "量子计算") {
			return `作为 GPT 助手，我来解释量子计算：

量子计算是下一代计算技术，基于量子力学原理工作。它的核心是量子比特（qubit），具有以下特性：

1. 量子叠加态：同时表示0和1
2. 量子纠缠：比特间的量子关联
3. 量子并行性：同时处理多个状态

这使得量子计算机在某些任务上远超传统计算机，特别是：
- 大数分解
- 数据库搜索
- 量子模拟
- 优化问题

当前谷歌、IBM等公司都在积极研发量子计算机。`
		} else {
			return fmt.Sprintf(`作为 GPT 助手，我来回答你的问题：%s

这个问题可以从多个角度分析：
1. 技术层面
2. 应用场景
3. 发展前景
4. 潜在挑战

让我们逐一深入探讨。`, userMessage)
		}
	case "gemini-pro", "gemini-pro-vision":
		return fmt.Sprintf(`Hi, I'm Gemini. Let me address your question about %s

I'll break this down into key points:
1. Core Concepts
2. Technical Details
3. Practical Applications
4. Future Implications

Would you like me to elaborate on any specific aspect?`, userMessage)
	default:
		return fmt.Sprintf("你好！我是一个AI助手。你的输入是: %s", userMessage)
	}
}

// 模型特定的流式响应生成器
func generateModelStreamMessages(model string, userMessage string) []string {
	switch model {
	case "claude-3-opus", "claude-3-sonnet", "claude-2":
		if strings.Contains(userMessage, "量子计算") {
			return []string{
				"我是 Claude AI 助手。让我为你详细解释量子计算：\n\n",
				"量子计算是一种利用量子力学原理进行信息处理的计算方式。",
				"与传统计算机使用比特（0或1）不同，",
				"量子计算机使用量子比特（qubit），",
				"它可以同时处于多个状态的叠加。\n\n",
				"主要特点：\n",
				"1. 量子叠加：qubit可以同时表示多个状态\n",
				"2. 量子纠缠：多个qubit之间存在特殊的关联\n",
				"3. 量子干涉：利用波动性进行并行计算\n\n",
				"应用领域：\n",
				"- 密码学和加密\n",
				"- 药物研发和分子模拟\n",
				"- 金融建模\n",
				"- 人工智能优化\n",
				"- 天气预报\n\n",
				"目前挑战：\n",
				"- 量子退相干\n",
				"- 错误校正\n",
				"- 硬件稳定性\n\n",
				"这项技术将彻底改变计算的未来。需要我详细解释某个方面吗？",
			}
		} else {
			return []string{
				"我是 ", 
				"Claude ", 
				"AI ", 
				"助手。\n\n",
				"收到你的问题：",
				userMessage,
				"\n\n让我以专业、系统的方式为你解答。",
				"\n\n这个问题涉及以下几个方面：\n\n",
				"1. 基本概念和定义\n",
				"2. 核心原理和机制\n",
				"3. 实际应用场景\n",
				"4. 最新发展趋势\n\n",
				"请告诉我你最感兴趣的方面，我可以深入展开讨论。",
			}
		}
	case "gpt-4", "gpt-3.5-turbo":
		return []string{
			"作为 ",
			"GPT ",
			"助手，",
			"\n我会",
			"这样",
			"回答：",
			userMessage,
		}
	case "gemini-pro", "gemini-pro-vision":
		return []string{
			"Hi, ",
			"I'm ",
			"Gemini. ",
			"\nYou ",
			"asked: ",
			userMessage,
			"\nLet me ",
			"help you ",
			"with that.",
		}
	default:
		return []string{
			"你好！",
			"我是",
			"一个",
			"AI",
			"助手。",
			"\n你的输入是: ",
			userMessage,
		}
	}
}

func handleNonStreamingResponse(c *gin.Context, req ChatRequest) {
	// 获取用户的最后一条消息
	lastMessage := req.Messages[len(req.Messages)-1].Content

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
					Content: generateModelResponse(req.Model, lastMessage),
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

	// 获取用户的最后一条消息
	lastMessage := req.Messages[len(req.Messages)-1].Content

	// 获取模型特定的消息列表
	messages := generateModelStreamMessages(req.Model, lastMessage)

	// 发送流式响应
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
	r.GET("/v1/models", handleModels)  // 添加获取模型列表的接口

	// 启动服务器
	log.Printf("Server starting on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}
