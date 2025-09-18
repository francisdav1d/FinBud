const express = require('express');
const path = require('path');
const fs=require('fs');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require("mongoose");
const rp = require('request-promise');

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hackathonDB";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("Connected to MongoDB"))
.catch(err => console.error("MongoDB connection error:", err));

const app = express();
const port = 3000;


app.use(express.json());


app.use(express.static(path.join(__dirname, 'static')));
app.use('/db', express.static(path.join(__dirname, 'database')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'Landing_Page', 'index.html'));
});


const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
    console.error("GOOGLE_API_KEY is not set. Please set the environment variable.");
    process.exit(1);
}
const AI = new GoogleGenerativeAI(GOOGLE_API_KEY);


const classifierModel = AI.getGenerativeModel({ model: 'gemini-2.5-flash' });
const financialModel = AI.getGenerativeModel({ model: 'gemini-2.5-flash' });

//read database

const KNOWLEDGE_BASE= fs.readFileSync('database/knowledgebase.json', 'utf8');
const LARGE_ACCOUNT_DATA=fs.readFileSync('database/income_history_large.json','utf8');
const SMC_ACCOUNT_DATA=fs.readFileSync('database/income_history_smc.json','utf8')
const MAIN_DATA=fs.readFileSync('database/MAIN_DATA.json');

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
- EXCEL: The user requested to make a excel sheet from the database.
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
function buildClassifierPrompt(userRequest) {
  const prerequisiteData = `
    Knowledge Base:
    - This company has two business units: Large Customers and Small and Medium Customers (SMC).
    - Large Customers (LC):
      - Go-to-market strategy: Uses sales executives to acquire 1-2 customers per month.
      - Revenue Model: Each customer pays a fixed, high software license fee per month (e.g., $16,500).
      - Revenue is calculated as: # of paying customers * fixed revenue per customer per month.
      -database contains: time_period,no_of_sales_exec,new_signings,total_paying_customers,avg_revenue_per_customer,revenue.
    - Small and Medium Customers (SMC):
      - Go-to-market strategy: Relies on marketing spend (e.g., Google Ads, LinkedIn) to drive website traffic for demos.
      - Conversion: A percentage of demo participants convert to paying customers.
      - Metrics: Key metrics include marketing cost, customer acquisition cost (CAC), and conversion rates.
      - Revenue Model: Revenue is calculated as: # of paying customers * average revenue per customer.
      - database contains: time_period,monthly_marketing_cost,new_signings,total_paying_customers,avg_revenue_per_customer,month_revenue
    -Main_Database:
      -database contains: yearly history of marketing budget, hiring budget,no of employees hired,current number of employees,no of employees fired, money spent on salary
  `;

  const systemInstruction = `
    Your job is to find which data to use from the database look into the prerequisite data to understand about the company.
    ${prerequisiteData}
    Only return one the DATA_LABELS and nothing else.

    DATA_LABLES:
    * SMALL_DB - if the the user prompt needs only the smc department sales data to answer.
    * MAIN_DB - if the prompt needs the entire company's all-time stats and not history. The query is about the company and not a specific department.
    * LARGE_DB - if the user prompt needs only the large department sales data to answer.
    * ALL - if the prompt needs the entire company's data history to answer, also choose this as a safe bet if you are uncertain about choosing the other ones.
  `;

  const payload = {
    contents: [
      {
        role: "model",
        parts: [
          { text: systemInstruction }
        ]
      },
      {
        role: "user",
        parts: [
          { text: userRequest }
        ]
      }
    ]
  };

  return payload;
}
async function path_method(user_request)
{
  try {
    const prompt=buildClassifierPrompt(user_request);
    const result = await classifierModel.generateContent(prompt);
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
            `You are a personal AI assistant to a Corporate person in power. Answer the following message (make it concise without skipping any trivial data) and reply to this it in markdown format: ${userMessage}.`
        );
        replyFromAi = replyFromAi.response.text();
    } else if (intent.includes("GREETING")) {
        replyFromAi = "Hello! How can I assist you with your financial questions today?";
    }else if(intent.includes("EXCEL")){
      replyFromAi = "Generating a excel sheet...."
    }else if (intent.includes("KNOWLEDGE")) {

      // replyFromAi = await financialModel.generateContent(
      //     `Answer the user's request using only the following information: ${LARGE_ACCOUNT_DATA}. (refer ${KNOWLEDGE_BASE} for methods). User Request: ${userMessage}.`
      // );
      // replyFromAi = replyFromAi.response.text();
      const target_db= await path_method(userMessage);
      console.log(target_db)
      if(target_db.includes("SMALL_DB"))
      {
        const prompt=`using context from the ${KNOWLEDGE_BASE} and the data from ${SMC_ACCOUNT_DATA} answer the user query: ${userMessage} and reply to this it in markdown format with clear seperators for all tables.NOTE:all currencies are in INR and if the data provided was not enough assume  data needed for that answer and make an answer based on the assumed data.`;
        replyFromAi=await financialModel.generateContent(prompt);
        replyFromAi=replyFromAi.response.text();
      }
      else if(target_db.includes("MAIN_DB"))
      {
        const prompt=`using context from the ${KNOWLEDGE_BASE} and the data from ${MAIN_ACCOUNT_DATA} answer the user query: ${userMessage} and reply to this it in markdown format with clear seperators for all tables. NOTE:all currencies are in INR and if the data provided was not enough assume  data needed for that answer and make an answer based on the assumed data`;
        replyFromAi=await financialModel.generateContent(prompt);
          replyFromAi=replyFromAi.response.text();
      }
      else if(target_db.includes("LARGE_DB"))
      {
        const prompt=`using context from the ${KNOWLEDGE_BASE} and the data from ${LARGE_ACCOUNT_DATA} answer the user query: ${userMessage} and reply to this it in markdown format with clear seperators for all tables.NOTE:all currencies are in INR and if the data provided was not enough assume  data needed for that answer and make an answer based on the assumed data`;
        replyFromAi=await financialModel.generateContent(prompt);
        replyFromAi=replyFromAi.response.text();
      }
      else
      {
        const prompt=`using context from the ${KNOWLEDGE_BASE} and the data from ${SMC_ACCOUNT_DATA} , DATA_FOR_LARGE_${LARGE_ACCOUNT_DATA},MAIN_DATA:${MAIN_DATA} answer the user query: ${userMessage} and reply to this it in markdown format with clear seperators for all tables. NOTE:all currencies are in INR and if the data provided was not enough assume  data needed for that answer and make an answer based on the assumed data.`;
        replyFromAi=await financialModel.generateContent(prompt);
        replyFromAi=replyFromAi.response.text();
      }
    }else {
        replyFromAi = "I'm designed to be your personel business assistant plese only ask relvant questions";
    }

    res.json({ reply: replyFromAi });
});
app.post('/upload-knowledgebase', async (req, res) => {
  try {
    const knowledgeBaseData = JSON.parse(KNOWLEDGE_BASE);
    const knowledgeSchema = new mongoose.Schema({}, { strict: false });
    const Knowledge = mongoose.models.Knowledge || mongoose.model('Knowledge', knowledgeSchema);


    await Knowledge.deleteMany({});

    // Insert new data
    if (Array.isArray(knowledgeBaseData)) {
      await Knowledge.insertMany(knowledgeBaseData);
    } else {
      await Knowledge.create(knowledgeBaseData);
    }

    res.json({ success: true, message: 'Knowledge base uploaded to MongoDB.' });
  } catch (err) {
    console.error('Error uploading knowledge base:', err);
    res.status(500).json({ success: false, error: 'Failed to upload knowledge base.' });
  }
});

/**
 * Fetches data from a MongoDB collection.
 * @param {string} collectionName - The name of the collection.
 * @param {object} query - The MongoDB query object.
 * @returns {Promise<Array>} - Array of documents matching the query.
 */
async function fetchFromMongo(collectionName) {
  try {
    const schema = new mongoose.Schema({}, { strict: false });
    const Model = mongoose.models[collectionName] || mongoose.model(collectionName, schema, collectionName);
    const results = await Model.find().lean();
    return results;
  } catch (err) {
    console.log(`Error fetching from ${collectionName}:`, err);
    return ['fuck this'];
  }
}

// Example usage:
// const data = await fetchFromMongo('Knowledge', { key: 'value' });

// server starter
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
