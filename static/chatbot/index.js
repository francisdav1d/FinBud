        const messagesDiv = document.getElementById('messages');
        const chatForm = document.getElementById('chat-form');
        const userInput = document.getElementById('user-input');

        function addMessage(text, sender) {
            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${sender}`;
            const bubble = document.createElement('div');
            bubble.className = `bubble ${sender}`;
            if (sender === "bot" ) {
                bubble.innerHTML = marked.parse(text);
            } else {
                bubble.textContent = text;
                console.log(text);
            }
            msgDiv.appendChild(bubble);       
            messagesDiv.appendChild(msgDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        async function getBotReply(message) {

            const typdiv=document.createElement('div');
            typingremark(typdiv,true);
            try {
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });
                const data = await response.json();
                typingremark(typdiv,false);
                return data.reply || "Sorry, I can't answer that.";
            } catch (e) {
                typingremark(typdiv,false);
                return "Bot is offline.";
            }
        }

        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = userInput.value.trim();
            if (!text) return;
            addMessage(text, 'user');
            userInput.value = '';
            const reply = await getBotReply(text);
            addMessage(reply, 'bot');
        });

function createTypingIndicator() {
    const indicatorContainer = document.createElement('div');
    indicatorContainer.classList.add('flex', 'justify-start');
    indicatorContainer.innerHTML = `
        <div class="bg-gray-200 text-gray-800 p-3 rounded-xl rounded-bl-none max-w-[80%] shadow">
            <div class="flex space-x-1">
                <span class="animate-bounce-dot w-2 h-2 bg-gray-500 rounded-full"></span>
                <span class="animate-bounce-dot w-2 h-2 bg-gray-500 rounded-full animation-delay-200"></span>
                <span class="animate-bounce-dot w-2 h-2 bg-gray-500 rounded-full animation-delay-400"></span>
            </div>
        </div>
    `;
    return indicatorContainer;
}
function typingremark(typediv,create)
{
    console.log("called");
    if(create)
    {
        const typingdiv=createTypingIndicator();
        typediv.className = `message bot`;
        typingdiv.className = `bubble bot`;
        typediv.appendChild(typingdiv);
        messagesDiv.appendChild(typediv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    else
    {
        typediv.remove();
    }

}