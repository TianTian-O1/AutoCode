export const AI_CONFIG = {
    baseUrl: process.env.BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.MODEL_NAME || 'gpt-4',
    // Other AI-related configurations can be added here
    chat: {
        temperature: 0.7,
        maxTokens: 2000,
        presencePenalty: 0,
        frequencyPenalty: 0,
        topP: 1,
    },
    code: {
        temperature: 0.2,
        maxTokens: 1000,
        presencePenalty: 0,
        frequencyPenalty: 0,
        topP: 1,
    }
};
