# 🎥 Video Upload and Share Web App

A comprehensive video upload and sharing platform with advanced admin analytics, built for Vercel deployment.

## ✨ Features

### 📤 Video Upload & Management
- **Secure Upload**: Video file upload with validation (MP4, AVI, MOV, WMV)
- **Cloud Storage**: Uses Vercel Blob for reliable file storage
- **File Size Limits**: Configurable upload limits (100MB default)
- **Unique Sharing**: Each video gets a unique shareable URL

### 🎬 Video Streaming & Sharing
- **Custom Player**: Built-in HTML5 video player with controls
- **Direct Sharing**: Shareable URLs for each uploaded video
- **Responsive Design**: Works on desktop and mobile devices
- **Video Gallery**: Browse all uploaded videos

### 📊 Admin Analytics Dashboard
- **Comprehensive Stats**: Total videos, total views, detailed metrics
- **View Tracking**: Track who viewed each video including:
  - IP addresses and user agent information
  - Device type (Desktop/Mobile/Tablet)
  - Browser and OS detection
  - Referrer information and precise timestamps
- **Video Management**: Admin interface to view, analyze, and delete videos
- **Analytics Modal**: Detailed view statistics with professional UI

## 🚀 Deployment on Vercel

### Prerequisites
1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **MongoDB Database**: Set up MongoDB Atlas or local MongoDB
3. **Vercel Blob Storage**: Enable Vercel Blob for file storage

### Step 1: Environment Variables
Set up the following environment variables in your Vercel dashboard:

```env
# MongoDB Connection
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# Google Gemini API Key (optional for essay generation)
GEMINI_API_KEY=your_gemini_api_key_here

# Vercel Blob Storage Token (required for file uploads)
BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN=your_vercel_blob_token_here
```

### Step 2: Get Vercel Blob Token
1. Go to your Vercel dashboard
2. Navigate to Storage → Blob
3. Create a new Blob store or use existing one
4. Copy the `BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN` from the store settings

### Step 3: Deploy
1. **Connect Repository**: Link your GitHub repository to Vercel
2. **Configure Build**: Vercel will auto-detect the Node.js project
3. **Set Environment Variables**: Add the variables from Step 1
4. **Deploy**: Click deploy and wait for completion

### Step 4: Verify Deployment
- Visit your deployed URL
- Test video upload functionality
- Check admin dashboard at `/admin`
- Verify analytics tracking

## 🛠️ Local Development

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd video-upload-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# Start development server
npm start
```

### Local Storage vs Vercel Blob
- **Local Development**: Can use local file storage (uploads/ directory)
- **Vercel Production**: Automatically uses Vercel Blob storage
- **Environment Detection**: App automatically switches based on deployment

## 📱 Usage

### For Users
1. **Upload Videos**: Navigate to the main page and upload video files
2. **Share Videos**: Use the generated URLs to share videos
3. **Watch Videos**: Click on shared links to watch videos

### For Admins
1. **Access Dashboard**: Go to `/admin` for comprehensive analytics
2. **View Statistics**: See total videos, views, and detailed metrics
3. **Manage Videos**: View, analyze, and delete videos
4. **Track Analytics**: Click "📊 Details" on any video for detailed view statistics

## 🔧 Technical Details

### Architecture
- **Backend**: Node.js/Express server with MongoDB integration
- **Frontend**: Vanilla HTML/CSS/JavaScript with responsive design
- **Storage**: Vercel Blob for production, local storage for development
- **Database**: MongoDB with enhanced schemas for analytics

### API Endpoints
- `POST /upload-video` - Upload video files
- `GET /video/:shareId` - Stream/serve video files
- `GET /getVideos` - Get all videos (admin)
- `GET /video-views/:id` - Get video analytics
- `DELETE /deleteVideo/:id` - Delete videos

### Security Features
- File type validation (videos only)
- File size limits
- Unique share IDs
- IP tracking for analytics
- Secure blob storage

## 🌟 Key Improvements for Vercel

### ✅ Cloud Storage Integration
- **Vercel Blob**: Replaced local file storage with Vercel Blob
- **Automatic Scaling**: No file size or storage limitations
- **Global CDN**: Fast video delivery worldwide
- **Persistent Storage**: Files persist across deployments

### ✅ Serverless Compatibility
- **Memory Storage**: Uses multer memory storage for uploads
- **Stateless Design**: No local file dependencies
- **Environment Variables**: Configurable for different environments

### ✅ Production Ready
- **Error Handling**: Comprehensive error handling for blob operations
- **Fallback Logic**: Graceful degradation if blob operations fail
- **Monitoring**: Detailed logging for debugging

## 📊 Analytics Features

### View Tracking
- **Real-time Analytics**: Track views as they happen
- **Detailed Information**: IP, device, browser, OS, referrer
- **Historical Data**: Complete view history with timestamps
- **Visual Dashboard**: Professional UI with stats and charts

### Admin Dashboard
- **Video Management**: List all videos with key metrics
- **Quick Actions**: View, analyze, delete videos
- **Responsive Design**: Works on all devices
- **Export Ready**: Data structure ready for export features

## 🔮 Future Enhancements

- **User Authentication**: User accounts and private videos
- **Video Processing**: Automatic transcoding and thumbnails
- **Advanced Analytics**: Geographic data and detailed reports
- **Social Features**: Comments, likes, and sharing
- **API Integration**: RESTful API for third-party integrations

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ for Vercel deployment**