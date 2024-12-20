import { ENV } from './env';

export const AI_CONFIG = {
    baseUrl: ENV.BASE_URL,
    apiKey: ENV.OPENAI_API_KEY,
    model: ENV.MODEL_NAME,
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
