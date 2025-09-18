
const express = require('express');
const path = require('path');
const fs=require('fs');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');


dotenv.config();


const app = express();
const port = 3000;


app.use(express.json());


app.use(express.static(path.join(__dirname, 'static/chatbot')));


const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
    console.error("GOOGLE_API_KEY is not set. Please set the environment variable.");
    process.exit(1);
}
const AI = new GoogleGenerativeAI(GOOGLE_API_KEY);


const classifierModel = AI.getGenerativeModel({ model: 'gemini-2.5-flash' });
const financialModel = AI.getGenerativeModel({ model: 'gemini-2.5-flash' });
let KNOWLEDGE_BASE= fs.readFileSync('database/knowledgebase.json', 'utf8');
let ACCOUNT_DATA=fs.readFileSync('database/data.json','utf8');


//temp will might use this later

//prompt for classsifer for gemini
// const CLASSIFIER_PROMPT = `You are a ai personell assistant to a company exec .
// Analyze the following user message and find its intent.
// Reply with one of the following labels only, and nothing else:
// * 'GREETING' if the message can just be answered with a greeting.
// * 'KNOWLEDGE' if the user request needs the use of the knowledge base to find the company specific data.
// * 'VALID' if the message is a question or statement isvalid or is apt for a advisor to a ceo would answer in a real life scenario.
// * 'IRRELEVANT' if the message is a question or statement unrelated or not professional to what a person in a corporate office would ask.
// USER_MSG:
// "{user_message}"
// Classification:
// `;

/*
 * Classifies the intent of a user message using a lightweight model.
 * @param {string} message The user's message.
 * @returns {Promise<string>} The classified intent label.
 */
async function classifyIntent(message) {
  try {
    const result = await classifierModel.generateContent({ 
      contents: [
        {
          role: "model",
          parts: [
            {
              text: `You are an AI assistant that classifies corporate user messages into intent categories.

Labels:
- GREETING: The message is a simple greeting or salutation (e.g., 'Hello', 'Good morning').
- KNOWLEDGE: The message requests company-specific data or information that requires access to a knowledge base (e.g., financials, policies, performance data).
- VALID: The message is a relevant professional question or statement that can be answer without any personel data or acess to databse.
- SHAWARMA: The message even remotely references shawarma.
- IRRELEVANT: The message is unrelated, unprofessional, or not suitable for a corporate/executive context.

Output format: Return only one label from the list: GREETING, KNOWLEDGE, VALID, or IRRELEVANT.`
            }
          ]
        },
        {
          role: "user",
          parts: [
            {
              text: message
            }
          ]
        }
      ]
    });
    const output = result.response.candidates[0].content.parts[0].text;
    return output.trim().toUpperCase();
  } catch (e) {
    console.error("Error classifying intent:", e);
    return "AI_DIDNT_WORK";
  }
}

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    console.log("User message:", userMessage);

    const intent = await classifyIntent(userMessage);
    console.log(intent);
    let replyFromAi;

    if (intent.includes("VALID")) {
        replyFromAi = await financialModel.generateContent(
            `You are a personal AI assistant to a Corporate person in power. Answer the following message (make it concise) and reply to this it in markdown format: ${userMessage}.`
        );
        replyFromAi = replyFromAi.response.text();
    } else if (intent.includes("GREETING")) {
        replyFromAi = "Hello! How can I assist you with your financial questions today?";
    } else if (intent.includes("KNOWLEDGE")) {
        replyFromAi = await financialModel.generateContent(
            `Answer the user's request using only the following information: ${ACCOUNT_DATA}. User Request: ${userMessage}.`
        );
        replyFromAi = replyFromAi.response.text();
    } 
    else if(intent.includes("SHAWARMA"))
      {

        replyFromAi = `# The Divine Power of Shawarma
        Shawarma is not just food; it is a **divine revelation** wrapped in warm bread.  
        The moment your teeth sink into that juicy, marinated meat, *fireworks erupt behind your eyes*,  
        as though the universe itself applauds your choice.  

        The **garlic sauce** drips like liquid gold, whispering promises of eternal happiness,  
        while the pickles crunch with a triumphant chorus.  

        Each bite is a **rollercoaster of flavor** so powerful it makes your soul levitate,  
        your knees buckle, and your heart sing operatic hymns.  

        Forget diamonds, forget luxury cars—  
        shawarma is the **true treasure of humankind**,  
        a miracle crafted for mortal joy.`;
      }else {
        replyFromAi = "I'm designed to be your personel business assistant plese only ask relvant questions";
    }

    res.json({ reply: replyFromAi });
});

// server starter
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
