const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { put, del } = require("@vercel/blob");
require("dotenv").config();
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 12000;

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

// Video Schema
const videoSchema = new mongoose.Schema({
    originalName: String,
    filename: String,
    shareId: { type: String, unique: true },
    blobUrl: String, // Vercel Blob URL
    mimetype: String,
    size: Number,
    uploadDate: { 
        type: Date, 
        default: () => {
            const now = new Date();
            now.setHours(now.getHours() + 8); // Convert to UTC+8 (Malaysia Time)
            return now;
        } 
    },
    title: String,
    description: String,
    views: { type: Number, default: 0 },
    device: String,
    browser: String,
    os: String,
    viewHistory: [{
        viewDate: { 
            type: Date, 
            default: () => {
                const now = new Date();
                now.setHours(now.getHours() + 8); // Convert to UTC+8 (Malaysia Time)
                return now;
            } 
        },
        ipAddress: String,
        userAgent: String,
        device: String,
        browser: String,
        os: String,
        location: String,
        referrer: String
    }]
});

const Video = mongoose.model("Video", videoSchema);

// Check if we're in production (Vercel) or development
const isProduction = process.env.VERCEL || (process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN !== 'your_vercel_blob_token_here');

// Configure multer for video uploads
const storage = isProduction ? 
    multer.memoryStorage() : // Use memory storage for Vercel Blob
    multer.diskStorage({     // Use disk storage for local development
        destination: function (req, file, cb) {
            const uploadDir = path.join(__dirname, '../uploads/videos');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            const shareId = uuidv4();
            req.shareId = shareId; // Store shareId for later use
            const filename = `${shareId}${path.extname(file.originalname)}`;
            cb(null, filename);
        }
    });

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: function (req, file, cb) {
        // Check if file is a video
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed!'), false);
        }
    }
});


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const ESSAYS_FILE = path.join(__dirname, "essays.json");

app.use(express.static(path.join(__dirname, "public")));

// ✅ **Serve index.html (User Interface)**
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ **Serve video upload page**
app.get("/videos", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "videos.html"));
});

// ✅ **Video Upload Endpoint**
app.post("/upload-video", upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No video file uploaded" });
        }

        const { title, description, device, browser, os } = req.body;
        let shareId, filename, blobUrl = null;

        if (isProduction) {
            // Production: Use Vercel Blob
            shareId = uuidv4();
            filename = `${shareId}${path.extname(req.file.originalname)}`;
            
            const blob = await put(filename, req.file.buffer, {
                access: 'public',
                contentType: req.file.mimetype,
            });
            blobUrl = blob.url;
        } else {
            // Development: Use local storage
            shareId = req.shareId || uuidv4();
            filename = req.file.filename;
            blobUrl = null; // No blob URL for local storage
        }

        const newVideo = new Video({
            originalName: req.file.originalname,
            filename: filename,
            shareId: shareId,
            blobUrl: blobUrl,
            mimetype: req.file.mimetype,
            size: req.file.size,
            title: title || req.file.originalname,
            description: description || "",
            device: device || "Unknown",
            browser: browser || "Unknown",
            os: os || "Unknown"
        });

        await newVideo.save();

        res.json({
            success: true,
            message: "Video uploaded successfully",
            shareId: shareId,
            shareUrl: `/share/${shareId}`,
            videoId: newVideo._id,
            blobUrl: blobUrl,
            environment: isProduction ? 'production' : 'development'
        });
    } catch (error) {
        console.error("❌ Error uploading video:", error);
        res.status(500).json({ error: "Failed to upload video" });
    }
});

// ✅ **Get All Videos (Admin)**
app.get("/getVideos", async (req, res) => {
    try {
        const videos = await Video.find().sort({ uploadDate: -1 });
        res.json(videos);
    } catch (error) {
        console.error("❌ Error fetching videos:", error);
        res.status(500).json({ error: "Failed to fetch videos" });
    }
});

// ✅ **Serve Video File (Blob or Local)**
app.get("/video/:shareId", async (req, res) => {
    try {
        const { shareId } = req.params;
        const video = await Video.findOne({ shareId });

        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }

        // Check if we should serve from blob or local storage
        if (video.blobUrl) {
            // Production: Redirect to Vercel Blob URL
        } else {
            // Development: Serve from local storage
            const videoPath = path.join(__dirname, '../uploads/videos', video.filename);
            
            if (!fs.existsSync(videoPath)) {
                return res.status(404).json({ error: "Video file not found" });
            }

            const stat = fs.statSync(videoPath);
            const fileSize = stat.size;
            const range = req.headers.range;

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;
                const file = fs.createReadStream(videoPath, { start, end });
                const head = {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': video.mimetype,
                };
                res.writeHead(206, head);
                file.pipe(res);
            } else {
                const head = {
                    'Content-Length': fileSize,
                    'Content-Type': video.mimetype,
                };
                res.writeHead(200, head);
                fs.createReadStream(videoPath).pipe(res);
            }
        }

        // Get user info for tracking
        function getDeviceInfo(userAgent) {
            let device = 'Desktop';
            let browser = 'Unknown';
            let os = 'Unknown';

            // Detect device
            if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
                device = 'Mobile';
            } else if (/iPad/i.test(userAgent)) {
                device = 'Tablet';
            }

            // Detect browser
            if (userAgent.includes('Chrome')) browser = 'Chrome';
            else if (userAgent.includes('Firefox')) browser = 'Firefox';
            else if (userAgent.includes('Safari')) browser = 'Safari';
            else if (userAgent.includes('Edge')) browser = 'Edge';

            // Detect OS
            if (userAgent.includes('Windows')) os = 'Windows';
            else if (userAgent.includes('Mac')) os = 'macOS';
            else if (userAgent.includes('Linux')) os = 'Linux';
            else if (userAgent.includes('Android')) os = 'Android';
            else if (userAgent.includes('iOS')) os = 'iOS';

            return { device, browser, os };
        }

        const userAgent = req.headers['user-agent'] || 'Unknown';
        const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
        const referrer = req.headers.referer || req.headers.referrer || 'Direct';
        const deviceInfo = getDeviceInfo(userAgent);

        // Add view to history and increment view count
        await Video.findByIdAndUpdate(video._id, { 
            $inc: { views: 1 },
            $push: {
                viewHistory: {
                    ipAddress: ipAddress,
                    userAgent: userAgent,
                    device: deviceInfo.device,
                    browser: deviceInfo.browser,
                    os: deviceInfo.os,
                    referrer: referrer
                }
            }
        });

        // If we have a blob URL, redirect to it (production)
        if (video.blobUrl) {
            res.redirect(video.blobUrl);
        }
        // If no blob URL, we already served the file from local storage (development)
    } catch (error) {
        console.error("❌ Error serving video:", error);
        res.status(500).json({ error: "Failed to serve video" });
    }
});

// ✅ **Share Video Page**
app.get("/share/:shareId", async (req, res) => {
    try {
        const { shareId } = req.params;
        const video = await Video.findOne({ shareId });

        if (!video) {
            return res.status(404).send("Video not found");
        }

        // Serve the video player page
        res.sendFile(path.join(__dirname, "public", "player.html"));
    } catch (error) {
        console.error("❌ Error loading share page:", error);
        res.status(500).send("Error loading video");
    }
});

// ✅ **Get Video Info**
app.get("/video-info/:shareId", async (req, res) => {
    try {
        const { shareId } = req.params;
        const video = await Video.findOne({ shareId });

        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }

        res.json({
            title: video.title,
            description: video.description,
            uploadDate: video.uploadDate,
            views: video.views,
            size: video.size,
            shareId: video.shareId
        });
    } catch (error) {
        console.error("❌ Error fetching video info:", error);
        res.status(500).json({ error: "Failed to fetch video info" });
    }
});

// ✅ **Get Video View History**
app.get("/video-views/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const video = await Video.findById(id).select('title viewHistory views');

        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }

        res.json({
            title: video.title,
            totalViews: video.views,
            viewHistory: video.viewHistory.sort((a, b) => new Date(b.viewDate) - new Date(a.viewDate))
        });
    } catch (error) {
        console.error("❌ Error fetching video views:", error);
        res.status(500).json({ error: "Failed to fetch video views" });
    }
});

// ✅ **Delete Video**
app.delete("/deleteVideo/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const video = await Video.findById(id);

        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }

        // Delete file from storage
        if (video.blobUrl) {
            // Production: Delete from Vercel Blob
            try {
                await del(video.blobUrl);
            } catch (blobError) {
                console.warn("⚠️ Warning: Could not delete blob file:", blobError.message);
                // Continue with database deletion even if blob deletion fails
            }
        } else {
            // Development: Delete from local storage
            const videoPath = path.join(__dirname, '../uploads/videos', video.filename);
            if (fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
            }
        }

        // Delete from database
        await Video.findByIdAndDelete(id);

        res.json({ success: true, message: "Video deleted successfully" });
    } catch (error) {
        console.error("❌ Error deleting video:", error);
        res.status(500).json({ error: "Failed to delete video" });
    }
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
async function getMalaysiaTime() {
    try {
        const response = await axios.get("http://worldtimeapi.org/api/timezone/Asia/Kuala_Lumpur");
        return new Date(response.data.datetime);
    } catch (error) {
        console.error("❌ Error fetching time from server:", error);
        return new Date(); // Default to system time if API fails
    }
}

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

        // ✅ Fetch Malaysia Time from the time server
        const malaysiaTime = await getMalaysiaTime();

        const newEssay = new Essay({
            topic,
            language,
            length,
            wordCount,
            timestamp: malaysiaTime, // ✅ Save time from the time server
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});
