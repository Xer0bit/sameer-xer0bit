// Get the API key from window environment
const API_KEY = window.__ENV__?.GEMINI_API_KEY;
// Use v1beta with recommended model; pass API key via query param for browser usage
const MODEL = 'gemini-1.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(API_KEY || '')}`;
const STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?key=${encodeURIComponent(API_KEY || '')}`;
const STORAGE_KEY = 'chat_history_v1';

// Create chatbot service singleton
const chatbotService = {
    isConnected: false,
    history: [], // [{ role: 'user'|'model', text: '...' }]

    // Initialize the chatbot
    async initialize() {
        try {
            if (!API_KEY) {
                throw new Error('API key not configured');
            }
            // load session history
            this.loadSession();
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
            concise and professional. keep answers short and to the point.

            Key Information:
            - Top Rated freelancer on Upwork
            - Expert in Python, PyTorch, CUDA-accelerated ML
            - Specializes in AI/ML Development and Cloud Solutions
            - Available for commissions and consultations
            - Website: xer0bit.com
            - LinkedIn: linkedin.com/in/sameer-samiullah
            - GitHub: github.com/xer0bit
            - email: sameer@xer0bit.com


            Address users formally and maintain a Victorian tone.`;
    },

    // Session memory helpers
    loadSession() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) this.history = parsed.slice(-50); // cap history
            }
        } catch (e) {
            console.warn('Failed to load session history', e);
            this.history = [];
        }
    },
    saveSession() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.history.slice(-50)));
        } catch (e) {
            console.warn('Failed to save session history', e);
        }
    },
    clearSession() {
        this.history = [];
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    },
    getHistory() {
        return this.history.slice();
    },

    // Build contents array from history and optional new user message
    buildContents(userMessage) {
        const contents = [];
        // Include a brief system preface as part of first user message for compatibility
        let system = this.getSystemPrompt();
        let first = true;
        for (const m of this.history) {
            contents.push({
                role: m.role,
                parts: [{ text: first && m.role === 'user' ? `${system}\n\nUser: ${m.text}` : m.text }]
            });
            first = false;
        }
        if (userMessage) {
            contents.push({
                role: 'user',
                parts: [{ text: (this.history.length === 0 ? `${system}\n\nUser: ${userMessage}` : userMessage) }]
            });
        }
        return contents;
    },

    // Send a message to the Gemini API
    async sendMessage(userMessage) {
        if (!this.isConnected) {
            throw new Error('Chatbot not initialized');
        }

        try {
            // push user message to history
            this.history.push({ role: 'user', text: userMessage });
            this.saveSession();

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: this.buildContents(userMessage)
                })
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(`API request failed: ${response.status} ${response.statusText} ${errText}`);
            }

            const data = await response.json();
            const reply = this.extractReply(data);
            // save assistant reply
            this.history.push({ role: 'model', text: reply });
            this.saveSession();
            
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

    // Stream a message reply; onDelta is called with text chunks
    async sendMessageStreaming(userMessage, { onDelta, onDone, onError } = {}) {
        if (!this.isConnected) {
            throw new Error('Chatbot not initialized');
        }

        // push user message to history before streaming
        this.history.push({ role: 'user', text: userMessage });
        this.saveSession();

        const controller = new AbortController();
        let fullText = '';
        const notifyDelta = (t) => { try { onDelta && onDelta(t); } catch {} };
        const notifyDone = () => { try { onDone && onDone(fullText); } catch {} };
        const notifyError = (e) => { try { onError && onError(e); } catch {} };

        try {
            const res = await fetch(STREAM_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: this.buildContents(userMessage) }),
                signal: controller.signal
            });
            if (!res.ok || !res.body) {
                const errText = await res.text().catch(() => '');
                throw new Error(`Stream request failed: ${res.status} ${res.statusText} ${errText}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // Streaming parsing: support SSE (data:) and raw NDJSON-style lines
                let idx;
                while ((idx = buffer.indexOf('\n\n')) !== -1) {
                    const chunk = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 2);
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();
                        let jsonStr = null;
                        if (trimmed.startsWith('data:')) {
                            jsonStr = trimmed.slice(5).trim();
                            if (jsonStr === '[DONE]') continue;
                        } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                            jsonStr = trimmed;
                        }
                        if (!jsonStr) continue;
                        try {
                            const obj = JSON.parse(jsonStr);
                            const text = this.extractReply(obj);
                            if (text) {
                                let delta = text;
                                if (text.startsWith(fullText)) {
                                    delta = text.slice(fullText.length);
                                }
                                fullText += delta;
                                if (delta) notifyDelta(delta);
                            }
                        } catch (e) {
                            // ignore parsing errors for non-payload lines
                        }
                    }
                }
            }

            // finalize
            this.history.push({ role: 'model', text: fullText || ' ' });
            this.saveSession();
            notifyDone();
        } catch (e) {
            console.error('Streaming error:', e);
            notifyError(e);
        }

        return { cancel: () => controller.abort() };
    },

    // Extract the reply from the API response
    extractReply(data) {
        try {
            // Safety block or empty candidates
            if (!data || !Array.isArray(data.candidates) || data.candidates.length === 0) {
                return 'I regret to inform you that no response could be generated at this moment.';
            }
            const first = data.candidates[0];
            if (first.finishReason === 'SAFETY') {
                return 'For reasons of propriety and safety, I must refrain from addressing that request.';
            }
            if (first && first.content && Array.isArray(first.content.parts)) {
                const partWithText = first.content.parts.find(p => typeof p.text === 'string' && p.text.trim().length > 0);
                if (partWithText) return partWithText.text;
            }
            return 'I apologize, but I am unable to provide a proper response at this moment.';
        } catch (error) {
            return 'I regret to inform you that I encountered difficulties in processing your request.';
        }
    }
};

export default chatbotService;
