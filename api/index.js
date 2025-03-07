const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const ESSAYS_FILE = path.join(__dirname, "essays.json");

app.use(express.static(path.join(__dirname, "public")));
// ✅ **Load essays from JSON file (if exists)**
let essays = [];
if (fs.existsSync(ESSAYS_FILE)) {
    try {
        const data = fs.readFileSync(ESSAYS_FILE, "utf8");
        essays = data ? JSON.parse(data) : [];
    } catch (error) {
        console.error("⚠️ Error reading JSON file:", error);
        essays = [];
    }
}

// ✅ **Save essays to JSON file**
function saveEssaysToFile() {
    try {
        fs.writeFileSync(ESSAYS_FILE, JSON.stringify(essays, null, 2));
    } catch (error) {
        console.error("⚠️ Error saving essays:", error);
    }
}

// ✅ **Serve index.html (User Interface)**
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});



// ✅ **Serve admin.html (Admin Dashboard)**
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ✅ **Admin Login**
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

app.post("/admin-login", (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ success: true, message: "Login successful." });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials." });
    }
});

// ✅ **Generate Essay & Save to JSON File**
app.post("/generate", async (req, res) => {
    const { topic, language, length, note, device, browser, os } = req.body;

    if (!topic || !language || !length) {
        return res.status(400).json({ error: "Topic, language, and length are required" });
    }

    try {
        let prompt = `Write a high quality essay in ${language} on the topic: ${topic}. The essay should be ${length} words long.`;

        if (note) {
            prompt += ` Additional note: ${note}`;
        }

        const result = await model.generateContent(prompt);
        const text =
            result.response.candidates?.[0]?.content?.parts?.[0]?.text || "Error: No response from AI.";

        // ✅ Calculate word count
        const wordCount = text.match(/[\u00ff-\uffff]|\S+/g).length;

        // ✅ Ensure Device, Browser, and OS are saved
        const essayData = {
            topic,
            language,
            length,
            wordCount,
            timestamp: new Date().toLocaleString(),
            essay: text,
            device: device || "Unknown",  // ✅ Default to "Unknown" if not provided
            browser: browser || "Unknown",
            os: os || "Unknown"
        };
        essays.push(essayData);
        saveEssaysToFile(); // ✅ Save to JSON file

        res.json({ essay: text, wordCount });
    } catch (error) {
        console.error("Error generating essay:", error);
        res.status(500).json({ error: "Failed to generate essay" });
    }
});

// ✅ **Retrieve All Essays for Admin**
app.get("/getEssays", (req, res) => {
    res.json(essays);
});

app.post("/improveSentence", async (req, res) => {
    const { sentence } = req.body;

    if (!sentence) {
        return res.status(400).json({ error: "No sentence provided." });
    }

    try {
        let prompt = `Improve the following sentence : "${sentence}"only give the improved sentence only `;

        const result = await model.generateContent(prompt);
        const improvedSentence =
            result.response.candidates?.[0]?.content?.parts?.[0]?.text || sentence;

        res.json({ improvedSentence });
    } catch (error) {
        console.error("Error improving sentence:", error);
        res.status(500).json({ error: "Failed to improve sentence." });
    }
});


// ✅ **Start the Server**
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
