// Environment variables configuration
export const ENV = {
    BASE_URL: (window as any).ENV_BASE_URL || 'https://api.openai.com/v1',
    OPENAI_API_KEY: (window as any).ENV_OPENAI_API_KEY || '',
    MODEL_NAME: (window as any).ENV_MODEL_NAME || 'gpt-4',
};
