const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

// Configuration
const { DEBUG_DIR } = require("./config/constants");

// Routes
const myMailRoutes = require("./routes/myMailRoutes");
const appDetectionRoutes = require("./routes/appDetection");
const authRoutes = require("./routes/authRoutes");
const verificationRoutes = require("./routes/verificationRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const toolRoutes = require("./routes/toolRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// Initialize Debug Directory
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

// Global Middleware
app.use(cors({
  origin: ["https://nexusauth.vercel.app", "http://localhost:3000", "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Accept-Version", "X-Api-Version", "X-CSRF-Token"]
}));

app.options("*", cors());

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Normalize URL for Vercel Serverless environment
app.use((req, res, next) => {
  const vercelPath = req.headers['x-matched-path'] || req.headers['x-vercel-matched-path'] || req.headers['x-now-route-matches'];
  if (vercelPath && (req.url === '/server.js' || req.url === '/api' || req.url === '/api/index' || req.url.startsWith('/server.js?') || req.url.startsWith('/api/index?'))) {
    const queryIndex = req.url.indexOf('?');
    const queryString = queryIndex !== -1 ? req.url.substring(queryIndex) : '';
    req.url = vercelPath + queryString;
  } else if (req.url === '/server.js' || req.url === '/api/index') {
    req.url = '/';
  }
  next();
});

// Serve Static Files
const uploadsDir = path.join(__dirname, "uploads");
app.use("/uploads/invoices", express.static(path.join(uploadsDir, "invoices")));
app.use("/uploads/screenshots", express.static(path.join(uploadsDir, "ScreenShots")));
app.use("/uploads/verified-data", express.static(path.join(uploadsDir, "verified-data")));
app.use("/uploads/reports", express.static(path.join(uploadsDir, "reports")));
app.use("/reports", express.static(path.join(uploadsDir, "reports")));

// Basic Health Check
app.get("/", (req, res) => {
  res.send("NexAuth API is running...");
});

// Mount Module Routes (supports both direct and /api prefixed requests)
app.use("/", authRoutes);                 // /login, /register, etc.
app.use("/api", authRoutes);              // /api/login, /api/register, etc.
app.use("/", verificationRoutes);         // /verify-number, etc.
app.use("/api", verificationRoutes);
app.use("/", purchaseRoutes);             // /purchase, etc.
app.use("/api", purchaseRoutes);
app.use("/", adminRoutes);                // /admin/history, /user-history
app.use("/api", adminRoutes);
app.use("/", toolRoutes);                 // /api/generate-invoice, etc.
app.use("/api", toolRoutes);
app.use("/api/mymail", myMailRoutes);
app.use("/api/app-detect", appDetectionRoutes);
app.use("/app-detect", appDetectionRoutes);

// Server Setup
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;