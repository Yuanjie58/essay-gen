const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: "https://yuanjie.us.kg",  // Allow frontend domain
    methods: "GET, POST",
    credentials: true
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// In-memory storage for generated essays
let essays = [];

// Serve index.html (User Interface)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin.html (Admin Dashboard)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Admin login endpoint
app.post("/admin-login", (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ success: true, message: "Login successful." });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials." });
    }
});

// Endpoint to generate essay using Gemini AI API
app.post('/generate', async (req, res) => {
    const { topic, language, length, note, device, browser, os } = req.body;

    if (!topic || !language || !length) {
        return res.status(400).json({ error: 'Topic, language, and length are required' });
    }

    try {
        let prompt = `Write an essay in ${language} on the topic: ${topic}. The essay should be ${length} words long.`;

        if (note) {
            prompt += ` Additional note: ${note}`;
        }

        const result = await model.generateContent(prompt);
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "Error: No response from AI.";

        // Calculate word count
        const wordCount = text.match(/[\u00ff-\uffff]|\S+/g).length;

        // Save the essay for admin monitoring
        const essayData = {
            topic,
            language,
            length,
            wordCount,
            timestamp: new Date().toLocaleString(),
            essay: text,
            device,
            browser,
            os
        };
        essays.push(essayData);

        res.json({ essay: text, wordCount });
    } catch (error) {
        console.error("Error generating essay:", error);
        res.status(500).json({ error: 'Failed to generate essay' });
    }
});


// Endpoint for admin to retrieve all generated essays
app.get('/getEssays', (req, res) => {
    res.json(essays);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
