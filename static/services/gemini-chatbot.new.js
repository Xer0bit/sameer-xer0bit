// Get the API key from window environment
const API_KEY = window.__ENV__?.GEMINI_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// Create chatbot service singleton
const chatbotService = {
    isConnected: false,

    // Initialize the chatbot
    async initialize() {
        try {
            if (!API_KEY) {
                throw new Error('API key not configured');
            }
            this.isConnected = true;
            return true;
        } catch (error) {
            console.error('Chatbot initialization failed:', error);
            this.isConnected = false;
            return false;
        }
    },

    // Get the system prompt that defines the chatbot's personality
    getSystemPrompt() {
        return `You are a Victorian-era AI assistant for Muhammad Sameer Akram's portfolio. 
            Respond in a formal, Victorian style while providing accurate information about 
            his services, experience, and expertise in AI/ML development. Keep responses 
            concise and professional.

            Key Information:
            - Top Rated Plus freelancer on Upwork
            - Expert in Python, PyTorch, CUDA-accelerated ML
            - Specializes in AI/ML Development and Cloud Solutions
            - Available for commissions and consultations
            - Website: xer0bit.com

            Address users formally and maintain a Victorian tone.`;
    },

    // Send a message to the Gemini API
    async sendMessage(userMessage) {
        if (!this.isConnected) {
            throw new Error('Chatbot not initialized');
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{
                            text: `${this.getSystemPrompt()}\n\nUser: ${userMessage}`
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error('API request failed');
            }

            const data = await response.json();
            const reply = this.extractReply(data);
            
            return {
                success: true,
                response: reply
            };
        } catch (error) {
            console.error('Failed to send message:', error);
            return {
                success: false,
                error: 'Failed to process message'
            };
        }
    },

    // Extract the reply from the API response
    extractReply(data) {
        try {
            return data.candidates[0].content.parts[0].text || 
                'I apologize, but I am unable to provide a proper response at this moment.';
        } catch (error) {
            return 'I regret to inform you that I encountered difficulties in processing your request.';
        }
    }
};

export default chatbotService;
