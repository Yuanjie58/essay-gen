const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Allow CORS from any origin (adjust if needed)
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to generate essay using Gemini AI API
app.post('/generate', async (req, res) => {
    const { topic, language, length, note } = req.body;

    if (!topic || !language || !length) {
        return res.status(400).json({ error: 'Topic, language, and length are required' });
    }

    try {
        let prompt = `Write an essay in ${language} on the topic: ${topic}. The essay should be ${length} words long.If the essay is in chinese and malay translation is no require.`;

        if (note) {
            prompt += ` Additional note: ${note}`;
        }

        const result = await model.generateContent(prompt);
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "Error: No response from AI.";

        // Calculate word count
        const wordCount = text.match(/[\u00ff-\uffff]|\S+/g).length;

        res.json({ essay: text, wordCount });
    } catch (error) {
        console.error("Error generating essay:", error);
        res.status(500).json({ error: 'Failed to generate essay' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
