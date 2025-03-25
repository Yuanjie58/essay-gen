const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

mongoose.connect(process.env.MONGO_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));

const essaySchema = new mongoose.Schema({
    topic: String,
    language: String,
    length: Number,
    wordCount: Number,
    timestamp: { 
        type: Date, 
        default: () => {
            const now = new Date();
            now.setHours(now.getHours() + 8); // Convert to UTC+8 (Malaysia Time)
            return now;
        } 
    },
    essay: String,
    device: String,
    browser: String,
    os: String
});

const Essay = mongoose.model("Essay", essaySchema);


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const ESSAYS_FILE = path.join(__dirname, "essays.json");

app.use(express.static(path.join(__dirname, "public")));

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
        let prompt = `Write a high-quality essay in ${language} on the topic: ${topic}. The essay should be ${length} words long.`;

        if (note) {
            prompt += ` Additional note: ${note}`;
        }

        const result = await model.generateContent(prompt);
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "Error: No response from AI.";
        const wordCount = text.match(/[\u00ff-\uffff]|\S+/g)?.length || 0;

        // Convert to Malaysia Time (UTC+8)
        const now = new Date();
        now.setHours(now.getHours() + 8);

        const newEssay = new Essay({
            topic,
            language,
            length,
            wordCount,
            timestamp: now, // ✅ Save in UTC+8 Malaysia Time
            essay: text,
            device: device || "Unknown",
            browser: browser || "Unknown",
            os: os || "Unknown"
        });

        await newEssay.save();

        res.json({ essay: text, wordCount });
    } catch (error) {
        console.error("❌ Error generating essay:", error);
        res.status(500).json({ error: "Failed to generate essay" });
    }
});


// ✅ **Retrieve All Essays for Admin**
app.get("/getEssays", async (req, res) => {
    try {
        const essays = await Essay.find().sort({ timestamp: -1 }); // Sort by latest
        res.json(essays);
    } catch (error) {
        console.error("❌ Error fetching essays:", error);
        res.status(500).json({ error: "Failed to fetch essays" });
    }
});

app.delete("/deleteEssay/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const deletedEssay = await Essay.findByIdAndDelete(id);

        if (!deletedEssay) {
            return res.status(404).json({ error: "Essay not found" });
        }

        res.json({ success: true, message: "Essay deleted successfully" });
    } catch (error) {
        console.error("❌ Error deleting essay:", error);
        res.status(500).json({ error: "Failed to delete essay" });
    }
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

app.get("/export-docx/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const essay = await Essay.findById(id);

        if (!essay) {
            return res.status(404).json({ error: "Essay not found" });
        }

        // Create a DOCX document
        const doc = new Document({
            sections: [
                {
                    properties: {},
                    children: [
                        new Paragraph({ children: [new TextRun(`Topic: ${essay.topic}`)], heading: "Heading1" }),
                        new Paragraph({ text: "" }),
                        new Paragraph({ children: [new TextRun(essay.essay)] })
                    ],
                },
            ],
        });

        const buffer = await Packer.toBuffer(doc);

        // Set response headers for DOCX file
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${essay.topic.replace(/\s+/g, "_")}.docx"`);
        res.send(buffer);
    } catch (error) {
        console.error("❌ Error exporting DOCX:", error);
        res.status(500).json({ error: "Failed to export DOCX" });
    }
});



// ✅ **Start the Server**
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
