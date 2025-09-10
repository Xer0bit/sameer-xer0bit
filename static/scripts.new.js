import chatbotService from './services/gemini-chatbot.js';

// Helper function to add message to chat
function addMessage(avatar, content, messageClass, chatMessages) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${messageClass}`;
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content"><p>${content}</p></div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Initialize chat functionality
async function initializeChat(chatInput, sendButton, chatMessages, statusIndicator) {
    try {
        statusIndicator.textContent = 'Connecting...';
        statusIndicator.className = 'status-indicator';

        const initialized = await chatbotService.initialize();
        
        if (initialized) {
            statusIndicator.textContent = 'Connected';
            statusIndicator.className = 'status-indicator connected';
            chatInput.disabled = false;
            sendButton.disabled = false;
            
            addMessage('⚙️', 'Mechanical Assistant is ready! How may I assist you?', 'bot-message', chatMessages);
            return true;
        } else {
            throw new Error('Initialization failed');
        }
    } catch (error) {
        statusIndicator.textContent = 'Connection Failed';
        statusIndicator.className = 'status-indicator error';
        chatInput.disabled = true;
        sendButton.disabled = true;
        addMessage('⚙️', 'Apologies, the mechanical assistant is currently offline. Please try again later.', 'bot-message', chatMessages);
        return false;
    }
}

// Handle sending a message
async function handleMessage(chatInput, sendButton, chatMessages) {
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message and clear input
    addMessage('👤', message, 'user-message', chatMessages);
    chatInput.value = '';

    // Disable input while processing
    sendButton.disabled = true;
    chatInput.disabled = true;

    try {
        const result = await chatbotService.sendMessage(message);
        if (result.success) {
            addMessage('⚙️', result.response, 'bot-message', chatMessages);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        addMessage('⚙️', 'Apologies, there seems to be a malfunction in the communication apparatus. Please try again.', 'bot-message', chatMessages);
    }

    // Re-enable input
    sendButton.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
}

// Set up navigation
function setupNavigation() {
    const levers = document.querySelectorAll('.nav-lever');
    const contents = document.querySelectorAll('.display-content');

    levers.forEach(lever => {
        lever.addEventListener('click', function() {
            // Update navigation state
            levers.forEach(l => l.classList.remove('active'));
            contents.forEach(c => c.classList.remove('visible'));
            this.classList.add('active');

            // Show selected content
            const targetId = this.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('visible');
                const centralDisplay = document.querySelector('.central-display');
                if (centralDisplay) {
                    centralDisplay.scrollTop = 0;
                }
            }
        });
    });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get chat elements
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const statusIndicator = document.getElementById('connection-status');

    // Initialize chat
    if (chatMessages && chatInput && sendButton && statusIndicator) {
        initializeChat(chatInput, sendButton, chatMessages, statusIndicator).then(success => {
            if (success) {
                // Set up chat event listeners
                sendButton.addEventListener('click', () => {
                    handleMessage(chatInput, sendButton, chatMessages);
                });
                
                chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !sendButton.disabled) {
                        handleMessage(chatInput, sendButton, chatMessages);
                    }
                });
            }
        });
    }

    // Initialize navigation
    setupNavigation();
});
