import express from 'express';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// Debug helper
const debug = (message, data) => {
    console.log(`[Debug] ${message}:`, data);
};

// Error helper
const handleError = (error, context) => {
    console.error(`[Error] ${context}:`, error);
    return {
        error: error.message || 'Internal server error',
        context,
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
};

// Debug middleware
app.use((req, res, next) => {
    debug('Incoming request', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body
    });
    next();
});

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        debug('Handling OPTIONS request');
        return res.sendStatus(200);
    }
    next();
});

app.use(bodyParser.json());

// Error handling middleware
app.use((err, req, res, next) => {
    const error = handleError(err, 'Global error handler');
    if (!res.headersSent) {
        res.status(500).json(error);
    }
});

// Helper function to convert string to hex bytes
function stringToHex(str, model_name) {
    try {
        const bytes = Buffer.from(str, 'utf-8');
        const byteLength = bytes.length;
        
        // Calculate lengths and fields similar to Python version
        const FIXED_HEADER = 2;
        const SEPARATOR = 1;
        const FIXED_SUFFIX_LENGTH = 0xA3 + model_name.length;

        // 计算文本长度字段
        let textLengthField1, textLengthFieldSize1;
        if (byteLength < 128) {
            textLengthField1 = byteLength.toString(16).padStart(2, '0');
            textLengthFieldSize1 = 1;
        } else {
            const lowByte1 = (byteLength & 0x7F) | 0x80;
            const highByte1 = (byteLength >> 7) & 0xFF;
            textLengthField1 = lowByte1.toString(16).padStart(2, '0') + highByte1.toString(16).padStart(2, '0');
            textLengthFieldSize1 = 2;
        }

        const baseLength = byteLength + 0x2A;
        let textLengthField, textLengthFieldSize;
        if (baseLength < 128) {
            textLengthField = baseLength.toString(16).padStart(2, '0');
            textLengthFieldSize = 1;
        } else {
            const lowByte = (baseLength & 0x7F) | 0x80;
            const highByte = (baseLength >> 7) & 0xFF;
            textLengthField = lowByte.toString(16).padStart(2, '0') + highByte.toString(16).padStart(2, '0');
            textLengthFieldSize = 2;
        }

        const messageTotalLength = FIXED_HEADER + textLengthFieldSize + SEPARATOR + 
                                 textLengthFieldSize1 + byteLength + FIXED_SUFFIX_LENGTH;

        const messageLengthHex = messageTotalLength.toString(16).padStart(10, '0');

        const hexString = (
            messageLengthHex +
            "12" +
            textLengthField +
            "0A" +
            textLengthField1 +
            bytes.toString('hex') +
            "10016A2432343163636435662D393162612D343131382D393239612D3936626330313631626432612" +
            "2002A132F643A2F6964656150726F2F656475626F73733A1E0A"+
            Buffer.from(model_name, 'utf-8').length.toString(16).padStart(2, '0').toUpperCase() +  
            Buffer.from(model_name, 'utf-8').toString('hex').toUpperCase() +  
            "22004A" +
            "24" + "61383761396133342D323164642D343863372D623434662D616636633365636536663765" +
            "680070007A2436393337376535612D386332642D343835342D623564392D653062623232336163303061" +
            "800101B00100C00100E00100E80100"
        ).toUpperCase();

        return Buffer.from(hexString, 'hex');
    } catch (error) {
        console.error('Error in stringToHex:', error);
        throw error;
    }
}

// Helper function to extract text from chunk
function extractTextFromChunk(chunk) {
    try {
        let i = 0;
        let results = [];
        
        while (i < chunk.length) {
            // Skip initial zero bytes
            while (i < chunk.length && chunk[i] === 0) {
                i++;
            }
            
            if (i >= chunk.length) {
                break;
            }
            
            // Skip length byte and newline
            i += 2;
            
            // Read content length
            const contentLength = chunk[i];
            i++;
            
            // Extract actual content if there's enough data
            if (i + contentLength <= chunk.length) {
                const text = chunk.slice(i, i + contentLength).toString('utf-8');
                if (text.length > 0) {
                    results.push(text);
                }
            }
            
            i += contentLength;
        }
        
        return results.join('');
    } catch (error) {
        console.error('Error in extractTextFromChunk:', error);
        return '';
    }
}

// Helper function to process auth token
const processAuthToken = (token) => {
    if (!token) return null;
    
    try {
        // 解码 URL 编码的令牌
        token = decodeURIComponent(token);
        
        // 如果令牌包含 user_ 前缀，提取实际的令牌部分
        if (token.startsWith('user_')) {
            const parts = token.split(/::|\%3A\%3A/);
            if (parts.length === 2) {
                return parts[1];
            }
        }
        
        return token;
    } catch (error) {
        debug('Error processing auth token', error);
        return null;
    }
};

// Test endpoint
app.get('/test', (req, res) => {
    console.log('Test endpoint hit!');
    res.json({ message: 'Test successful' });
});

// Models endpoint
app.get('/v1/models', (req, res) => {
    console.log('Models endpoint hit!');
    const models = [
        {
            id: "gpt-4o",
            object: "model",
            created: 1706745938,
            owned_by: "cursor"
        },
        {
            id: "claude-3-5-sonnet-20241022",
            object: "model",
            created: 1706745938,
            owned_by: "cursor"
        },
        {
            id: "gpt-4o-mini",
            object: "model",
            created: 1706745938,
            owned_by: "cursor"
        }
    ];

    res.json({
        object: "list",
        data: models
    });
});

// Chat completions endpoint
app.post('/v1/chat/completions', async (req, res) => {
    debug('Chat completions endpoint hit', req.body);
    try {
        const { model = 'gpt-4o', messages, stream = false } = req.body;
        let authToken = processAuthToken(req.headers.authorization?.replace('Bearer ', ''));
        
        debug('Request details', {
            model,
            messagesCount: messages?.length,
            stream,
            hasAuthToken: !!authToken,
            authTokenLength: authToken?.length
        });

        if (!messages || !Array.isArray(messages) || messages.length === 0 || !authToken) {
            debug('Invalid request', { 
                hasMessages: !!messages, 
                isArray: Array.isArray(messages), 
                messagesLength: messages?.length, 
                hasToken: !!authToken 
            });
            return res.status(400).json({ 
                error: 'Invalid request. Messages should be a non-empty array and authorization is required',
                timestamp: new Date().toISOString()
            });
        }

        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
        }

        const formattedMessages = messages.map(msg => `${msg.role}:${msg.content}`).join('\n');
        debug('Formatted messages', formattedMessages);

        const hexData = stringToHex(formattedMessages, model);
        debug('Hex data generated', {
            length: hexData.length,
            preview: hexData.toString('hex').substring(0, 50) + '...'
        });

        debug('Sending request to Cursor API');
        const response = await fetch("https://api2.cursor.sh/aiserver.v1.AiService/StreamChat", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/connect+proto',
                'Authorization': `Bearer ${authToken}`,
                'connect-accept-encoding': 'gzip,br',
                'connect-protocol-version': '1',
                'user-agent': 'connect-es/1.4.0',
                'x-amzn-trace-id': `Root=${uuidv4()}`,
                'x-cursor-checksum': 'zo6Qjequ9b9734d1f13c3438ba25ea31ac93d9287248b9d30434934e9fcbfa6b3b22029e/7e4af391f67188693b722eff0090e8e6608bca8fa320ef20a0ccb5d7d62dfdef',
                'x-cursor-client-version': '0.42.3',
                'x-cursor-timezone': 'Asia/Shanghai',
                'x-ghost-mode': 'false',
                'x-request-id': uuidv4(),
                'Host': 'api2.cursor.sh'
            },
            body: hexData
        });

        debug('Cursor API response', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            debug('Cursor API error', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            throw new Error(`Cursor API error: ${response.status} - ${errorText}`);
        }

        const responseId = `chatcmpl-${uuidv4()}`;
        debug('Generated response ID', responseId);

        if (stream) {
            debug('Starting stream processing');
            try {
                for await (const chunk of response.body) {
                    if (chunk && Buffer.isBuffer(chunk)) {
                        debug('Received chunk', {
                            length: chunk.length,
                            preview: chunk.toString('hex').substring(0, 50) + '...'
                        });
                        const text = extractTextFromChunk(chunk);
                        if (text && text.length > 0) {
                            debug('Extracted text', text.substring(0, 50) + '...');
                            const data = {
                                id: responseId,
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: model,
                                choices: [{
                                    index: 0,
                                    delta: {
                                        content: text
                                    }
                                }]
                            };
                            res.write(`data: ${JSON.stringify(data)}\n\n`);
                        }
                    }
                }
                debug('Stream completed successfully');
                res.write('data: [DONE]\n\n');
                res.end();
            } catch (error) {
                const errorResponse = handleError(error, 'Stream processing');
                if (!res.headersSent) {
                    res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
                }
                res.end();
            }
        } else {
            debug('Processing non-stream response');
            let fullText = '';
            for await (const chunk of response.body) {
                if (chunk && Buffer.isBuffer(chunk)) {
                    const text = extractTextFromChunk(chunk);
                    if (text) {
                        fullText += text;
                    }
                }
            }
            debug('Full response text length', fullText.length);

            res.json({
                id: responseId,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: fullText
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0
                }
            });
        }
    } catch (error) {
        const errorResponse = handleError(error, 'Chat completions');
        if (!res.headersSent) {
            res.status(500).json(errorResponse);
        }
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    debug('Server started', { port: PORT });
});
