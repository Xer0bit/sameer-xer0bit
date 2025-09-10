import chatbotService from './services/gemini-chatbot.js';

// Helper function to add message to chat
function addMessage(avatar, content, messageClass, chatMessages) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${messageClass}`;

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.textContent = avatar;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const p = document.createElement('p');
    p.textContent = content; // prevent HTML injection
    contentDiv.appendChild(p);

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Main initialization function
async function initializeApp() {
    // Get chat elements
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const statusIndicator = document.getElementById('connection-status');
    const typingIndicator = document.getElementById('typing-indicator');
    const stopButton = document.getElementById('stop-button');
    const clearButton = document.getElementById('clear-button');

    // Initialize chatbot
    async function initializeChatbot() {
        statusIndicator.textContent = 'Connecting...';
        statusIndicator.className = 'status-indicator';

        try {
            const initialized = await chatbotService.initialize();
            if (initialized) {
                statusIndicator.textContent = 'Connected';
                statusIndicator.className = 'status-indicator connected';
                chatInput.disabled = false;
                sendButton.disabled = false;
                // restore prior session messages if present
                const history = chatbotService.getHistory?.() || [];
                if (history.length === 0) {
                    addMessage('⚙️', 'Mechanical Assistant is ready! How may I assist you?', 'bot-message', chatMessages);
                } else {
                    for (const m of history) {
                        addMessage(m.role === 'user' ? '👤' : '⚙️', m.text, m.role === 'user' ? 'user-message' : 'bot-message', chatMessages);
                    }
                }
            } else {
                throw new Error('Initialization failed');
            }
        } catch (error) {
            statusIndicator.textContent = 'Connection Failed';
            statusIndicator.className = 'status-indicator error';
            addMessage('⚙️', 'Apologies, the mechanical assistant is currently offline. Please try again later.', 'bot-message', chatMessages);
        }
    }

    // Handle sending messages
    async function handleMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        addMessage('👤', message, 'user-message', chatMessages);
        chatInput.value = '';

        sendButton.disabled = true;
        chatInput.disabled = true;

        try {
            // Stream the assistant reply
            let botDiv;
            let botP;
            let gotAny = false;
            const appendDelta = (delta) => {
                if (!botDiv) {
                    // create a new bot message container on first delta
                    botDiv = document.createElement('div');
                    botDiv.className = 'message bot-message';
                    const avatarDiv = document.createElement('div');
                    avatarDiv.className = 'message-avatar';
                    avatarDiv.textContent = '⚙️';
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'message-content';
                    botP = document.createElement('p');
                    botP.textContent = '';
                    contentDiv.appendChild(botP);
                    botDiv.appendChild(avatarDiv);
                    botDiv.appendChild(contentDiv);
                    chatMessages.appendChild(botDiv);
                }
                gotAny = true;
                botP.textContent += delta;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            };

            typingIndicator && (typingIndicator.style.display = 'flex');
            stopButton && (stopButton.disabled = false);

            const stream = await chatbotService.sendMessageStreaming(message, {
                onDelta: appendDelta,
                onDone: async (fullText) => {
                    typingIndicator && (typingIndicator.style.display = 'none');
                    stopButton && (stopButton.disabled = true);
                    // Fallback if no streaming text was received
                    if (!fullText && !gotAny) {
                        try {
                            const result = await chatbotService.sendMessage(message);
                            if (result.success) {
                                if (!botDiv) {
                                    // if no container yet, add the message now
                                    addMessage('⚙️', result.response, 'bot-message', chatMessages);
                                } else {
                                    botP.textContent = result.response || ' '; 
                                }
                            } else {
                                addMessage('⚙️', 'Apologies, there seems to be a malfunction in the communication apparatus. Please try again.', 'bot-message', chatMessages);
                            }
                        } catch {}
                    }
                },
                onError: () => {
                    addMessage('⚙️', 'Apologies, there seems to be a malfunction in the communication apparatus. Please try again.', 'bot-message', chatMessages);
                    typingIndicator && (typingIndicator.style.display = 'none');
                    stopButton && (stopButton.disabled = true);
                }
            });

            if (stopButton) {
                stopButton.onclick = () => {
                    try { stream.cancel && stream.cancel(); } catch {}
                    typingIndicator && (typingIndicator.style.display = 'none');
                    stopButton.disabled = true;
                };
            }
        } catch (error) {
            addMessage('⚙️', 'Apologies, there seems to be a malfunction in the communication apparatus. Please try again.', 'bot-message', chatMessages);
        }

        sendButton.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
    }

    // Initialize chatbot first
    initializeChatbot().then(() => {
        // Set up event listeners for chat
        if (sendButton) {
            sendButton.addEventListener('click', handleMessage);
        }
        if (chatInput) {
            chatInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter' && !sendButton.disabled) {
                    await handleMessage();
                }
            });
        }

        if (clearButton) {
            clearButton.addEventListener('click', () => {
                try { chatbotService.clearSession && chatbotService.clearSession(); } catch {}
                // remove all children
                while (chatMessages.firstChild) chatMessages.removeChild(chatMessages.firstChild);
                addMessage('⚙️', 'Conversation cleared. How may I assist you anew?', 'bot-message', chatMessages);
            });
        }
    });

    // Set up navigation
    function setupNavigation() {
        const levers = document.querySelectorAll('.nav-lever');
        const contents = document.querySelectorAll('.display-content');

        levers.forEach(lever => {
            lever.addEventListener('click', function() {
                // Deactivate all levers and hide all content
                levers.forEach(l => l.classList.remove('active'));
                contents.forEach(c => c.classList.remove('visible'));

                // Activate the clicked lever
                this.classList.add('active');

                // Show the targeted content
                const targetId = this.getAttribute('data-target');
                const targetContent = document.getElementById(targetId);
                if (targetContent) {
                    targetContent.classList.add('visible');
                    // Scroll to top when switching sections
                    const centralDisplay = document.querySelector('.central-display');
                    if (centralDisplay) {
                        centralDisplay.scrollTop = 0;
                    }
                }
            });
        });
        
        // Setup project filter buttons
        setupProjectFilters();
    }
    
    // Set up project filters
    function setupProjectFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        const projectCards = document.querySelectorAll('.project-card');
        
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Update active button
                filterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // Filter projects
                const filter = this.getAttribute('data-filter');
                projectCards.forEach(card => {
                    if (filter === 'all' || card.getAttribute('data-category') === filter) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
    }

    // Initialize navigation
    setupNavigation();
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
