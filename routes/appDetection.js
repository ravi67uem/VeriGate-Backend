const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const FormData = require('form-data');
const { recordTransaction } = require('../utils/transactionHelper');
// require('dotenv').config();

// Initialize Supabase
const supabase = require('../config/supabase');

const upload = multer({ dest: '/tmp/' });

// CheckNumber Task Type mapping and prices per 10k from index.txt
const CHECKNUMBER_SERVICES = {
    // Telegram
    "Telegram Checker": { type: "tg", price: 2.5 },
    "Telegram Days Checker": { type: "tg_active", price: 3.5 },
    "Telegram Age & Gender Checker": { type: "tg_avatar", price: 4.5 },
    "Telegram Username Checker": { type: "tg_username", price: 1.5 },
    "Telegram Username Profile Checker": { type: "tg_username_profile", price: 4.0 },
    "Telegram Username Activity Checker": { type: "tg_username_activity", price: 3.0 },
    // WhatsApp
    "WhatsApp Checker": { type: "ws", price: 1.0 },
    "WhatsApp Days Checker": { type: "ws_active", price: 1.8 },
    "Whatsapp Age & Gender Checker": { type: "ws_avatar", price: 3.8 },
    // Number Checker
    "Phone Number Validation": { type: "phoneCheck", price: 4.0 },
    "Number Active Check": { type: "active_check", price: 6.5 },
    "High Value Users Checker": { type: "high_value_users", price: 7.0 },
    // Viber
    "Viber Checker": { type: "viber", price: 0.5 },
    "Viber Days Checker": { type: "viber_active", price: 5.0 },
    "Viber Age & Gender Checker": { type: "viber_senior", price: 15.0 },
    // iMessage
    "iMessage Checker": { type: "imessage", price: 2.0 },
    // RCS
    "Rcs Checker": { type: "rcs", price: 1.5 },
    // Signal
    "Signal Checker": { type: "signal", price: 1.5 },
    // VK
    "VK (VKontakte) Checker": { type: "vk", price: 5.0 },
    // Apple ID
    "Apple Checker": { type: "apple", price: 1.5 },
    "Apple Email Checker": { type: "apple_email", price: 2.0 },
    // Facebook
    "Facebook Checker": { type: "facebook", price: 0.3 },
    "Facebook Email Checker": { type: "facebook_email", price: 0.3 },
    // Amazon
    "Amazon Checker": { type: "amazon", price: 2.0 },
    "Amazon Email Checker": { type: "amazon_email", price: 2.0 },
    // Instagram
    "Instagram Checker": { type: "instagram", price: 0.3 },
    "Instagram Email Checker": { type: "instagram_email", price: 0.3 },
    // MAX
    "MAX Checker": { type: "max", price: 10.0 },
    "MAX Full Profile Checker": { type: "max_full", price: 20.0 },
    // Netflix
    "Netflix Checker": { type: "netflix", price: 7.0 },
    "Netflix Email Checker": { type: "netflix_email", price: 7.0 },
    // Line
    "Line Checker": { type: "line", price: 5.0 },
    "Line Profile Checker": { type: "line_senior", price: 15.0 },
    // Twitter
    "Twitter Checker": { type: "twitter", price: 1.0 },
    "Twitter/X Email Checker": { type: "twitter_email", price: 1.0 },
    // LinkedIn
    "LinkedIn CheckNumber": { type: "linkedin_phone", price: 5.0 },
    "LinkedIn Email Checker": { type: "linkedin", price: 0.5 },
    "LinkedIn Email Profile Checker": { type: "linkedin_profile", price: 10.0 },
    // Zalo
    "Zalo Checker": { type: "zalo", price: 2.0 },
    // TikTok
    "TikTok Checker": { type: "tiktok", price: 9.0 },
    // Microsoft
    "Microsoft Checker": { type: "microsoft", price: 2.0 },
    // Snapchat
    "Snapchat Checker": { type: "snapchat", price: 15.0 },
    // Messenger
    "Messenger Checker": { type: "messenger", price: 2.8 },
    // GoTo
    "GoTo Checker": { type: "goto", price: 7.0 },
    // Threads
    "Threads Checker": { type: "threads", price: 0.8 },
    // Spotify
    "Spotify Email Checker": { type: "spotify_email", price: 1.0 },
    // Band
    "Band Checker": { type: "band", price: 1.0 },
    // DHL
    "DHL Checker": { type: "dhl", price: 1.5 },
    // Sideline
    "Sideline Checker": { type: "sideline", price: 1.5 },
    // Airbnb
    "Airbnb Checker": { type: "airbnb", price: 2.0 },
    // Pornhub
    "Pornhub Checker": { type: "pornhub", price: 7.0 },
    // Temu
    "Temu Checker": { type: "temu", price: 2.0 },
    // Binance
    "Binance Checker": { type: "Binance", price: 6.5 },
    "Binance Email Checker": { type: "binance_email", price: 15.0 },
    // Kucoin
    "Kucoin Checker": { type: "Kucoin", price: 7.0 },
    "Kucoin Email Checker": { type: "kucoin_email", price: 7.0 },
    // Htx
    "Htx Checker": { type: "htx", price: 3.5 },
    "Htx Email Checker": { type: "htx_email", price: 7.0 },
    // CoinW
    "CoinW Checker": { type: "coinW", price: 2.0 },
    "CoinW Email Checker": { type: "coinw_email", price: 7.0 },
    // Crypto.com
    "Crypto.com Email Checker": { type: "crypto_email", price: 15.0 },
    // Email/Global Carrier
    "Email Check": { type: "email_check", price: 7.0 },
    "Phone Carrier Bulk Lookup": { type: "usaCarrier", price: 2.0 },
    "Advanced US Carrier Checker": { type: "us_carrier_premium", price: 15.0 }
};

const JSZip = require('jszip');
const os = require('os');
const path = require('path');

const PRICE_PER_10K = 5.2; // USDT

// Helper to parse file and get numbers
async function parseFile(filePath, ext) {
    let numbers = [];
    if (ext === 'csv') {
        numbers = await new Promise((resolve, reject) => {
            const arr = [];
            fs.createReadStream(filePath)
                .pipe(csv({ headers: false }))
                .on('data', (row) => {
                    let phone = row[Object.keys(row)[0]];
                    if (phone) arr.push(phone.toString().trim());
                })
                .on('end', () => resolve(arr))
                .on('error', reject);
        });
    } else if (ext === 'xlsx' || ext === 'xls') {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        numbers = sheet.map(row => row[0]).filter(Boolean).map(n => n.toString().trim());
    } else if (ext === 'txt') {
        const content = fs.readFileSync(filePath, 'utf8');
        numbers = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    }
    return numbers;
}

// POST /api/app-detect/upload
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { userId, appType } = req.body;
        const file = req.file;

        if (!file || !userId || !appType) {
            return res.status(400).json({ message: 'Missing file, userId, or appType' });
        }

        const service = CHECKNUMBER_SERVICES[appType];
        const taskType = service ? service.type : "ws";
        const checknumberPrice = service ? service.price : 1.0;

        const ext = file.originalname.split('.').pop().toLowerCase();
        const numbers = await parseFile(file.path, ext);
        const uniqueNumbers = [...new Set(numbers)]; // Dedup
        const count = uniqueNumbers.length;

        if (count < 1000) {
            return res.status(400).json({ message: 'File must contain at least 1000 valid numbers' });
        }

        // Calculate Cost Dynamically based on the user-specified ratio:
        // if cost is 1.5 then deduct 5.2 (ratio = 5.2 / 1.5)
        const costPer10k = checknumberPrice * (5.2 / 1.5);
        const cost = (count / 10000) * costPer10k;

        // Check Balance
        const { data: userLimit, error: limitError } = await supabase
            .from('user_limits')
            .select('usdt_balance')
            .eq('id', userId)
            .single();

        if (limitError || !userLimit) {
            return res.status(404).json({ message: 'User not found' });
        }

        if ((userLimit.usdt_balance || 0) < cost) {
            fs.unlinkSync(file.path); // Clean up
            return res.status(403).json({
                message: `Insufficient balance. Request Cost: $${cost.toFixed(4)}, Available: $${userLimit.usdt_balance.toFixed(4)}`
            });
        }

        // Create Text File for API Upload (One number per line)
        const uploadContent = uniqueNumbers.join('\n');
        const uploadFilePath = path.join(os.tmpdir(), `temp_${Date.now()}.txt`);
        fs.writeFileSync(uploadFilePath, uploadContent);

        const checknumberApiKey = process.env.CHECKNUMBER_API_KEY || process.env.VERIPHONE_API_KEY;

        // Upload to CheckNumber.ai API
        const formData = new FormData();
        formData.append('task_type', taskType);
        formData.append('file', fs.createReadStream(uploadFilePath));

        const apiRes = await axios.post('https://api.checknumber.ai/v1/tasks', formData, {
            headers: {
                ...formData.getHeaders(),
                'X-API-Key': checknumberApiKey
            }
        });

        // Cleanup temp files
        fs.unlinkSync(file.path);
        fs.unlinkSync(uploadFilePath);

        const apiData = apiRes.data;
        console.log('CheckNumber API Response:', apiData);

        if (!apiData.task_id) {
            return res.status(500).json({ message: 'External API Error', error: apiData.message });
        }

        // Deduct Balance ONLY if API success
        const newBalance = userLimit.usdt_balance - cost;
        const { error: updateError } = await supabase
            .from('user_limits')
            .update({ usdt_balance: newBalance })
            .eq('id', userId);

        if (updateError) {
            console.error('❌ Balance Deduction Error:', updateError.message);
        }

        // Log transaction
        await recordTransaction(
            userId,
            "debit",
            cost,
            `App Detection: ${appType} (${count} numbers)`
        );

        // Save Task to History (Encoded into file_path due to missing schema columns)
        const { error: historyError } = await supabase.from('verification_history').insert({
            user_id: userId,
            total_uploaded: Number(count),
            unique_count: Number(count),
            duplicates: 0,
            verified_count: 0, // Added to satisfy NOT NULL constraint
            file_path: `${appType}|${apiData.task_id}`, // Format: APP_TYPE|TASK_ID
            created_at: new Date(),
        });

        if (historyError) {
            console.error('❌ App Detect History Error:', historyError);
        }

        res.json({
            message: 'File uploaded successfully',
            sendID: apiData.task_id,
            deductedCost: cost,
            remainingBalance: newBalance,
            count: count
        });

    } catch (error) {
        console.error('App Detect Upload Error:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});


// POST /api/app-detect/status
router.post('/status', async (req, res) => {
    try {
        const { sendID } = req.body;
        if (!sendID) return res.status(400).json({ message: 'Missing sendID' });

        const checknumberApiKey = process.env.CHECKNUMBER_API_KEY || process.env.VERIPHONE_API_KEY;

        const statusFormData = new FormData();
        statusFormData.append('task_id', sendID);

        const apiRes = await axios.post('https://api.checknumber.ai/v1/gettasks', statusFormData, {
            headers: {
                ...statusFormData.getHeaders(),
                'X-API-Key': checknumberApiKey
            }
        });

        const apiData = apiRes.data;

        if (apiData.status === "exported") {
            res.json({
                RES: "100",
                DATA: {
                    status: "2", // Completed
                    number2: apiData.success || 0,
                    number3: apiData.failure || 0
                }
            });
        } else if (apiData.status === "failed") {
            res.json({
                RES: "100",
                DATA: {
                    status: "Error",
                    number2: 0,
                    number3: 0
                }
            });
        } else {
            res.json({
                RES: "100",
                DATA: {
                    status: "1", // Processing
                    number2: apiData.success || 0,
                    number3: apiData.failure || 0
                }
            });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error checking status', error: error.message });
    }
});

// POST /api/app-detect/download
router.post('/download', async (req, res) => {
    try {
        const { sendID, type } = req.body; // type: 1 = zip, 2 = active, 3 = inactive
        if (!sendID) return res.status(400).json({ message: 'Missing sendID' });

        const checknumberApiKey = process.env.CHECKNUMBER_API_KEY || process.env.VERIPHONE_API_KEY;

        const statusFormData = new FormData();
        statusFormData.append('task_id', sendID);

        const apiRes = await axios.post('https://api.checknumber.ai/v1/gettasks', statusFormData, {
            headers: {
                ...statusFormData.getHeaders(),
                'X-API-Key': checknumberApiKey
            }
        });

        const apiData = apiRes.data;

        if (apiData.status !== "exported" || !apiData.result_url) {
            return res.status(400).json({ message: "Results not ready or task failed." });
        }

        const zipRes = await axios.get(apiData.result_url, { responseType: 'arraybuffer' });
        const downloadType = type ? Number(type) : 1;

        if (downloadType === 2 || downloadType === 3) {
            const zip = await JSZip.loadAsync(zipRes.data);
            const files = Object.keys(zip.files);
            
            let targetFile = null;
            if (downloadType === 2) {
                targetFile = files.find(f => f.toLowerCase().includes('activated.txt') || f.toLowerCase().includes('registered.txt') || (f.toLowerCase().includes('active') && !f.toLowerCase().includes('inactive') && !f.toLowerCase().includes('unregister')));
            } else if (downloadType === 3) {
                targetFile = files.find(f => f.toLowerCase().includes('unregistered.txt') || f.toLowerCase().includes('unactivated.txt') || f.toLowerCase().includes('inactive.txt') || f.toLowerCase().includes('unregister'));
            }

            if (targetFile) {
                const fileContent = await zip.files[targetFile].async("string");
                const filename = downloadType === 2 ? `active_${sendID}.txt` : `inactive_${sendID}.txt`;
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Type', 'text/plain');
                return res.send(fileContent);
            } else {
                return res.status(404).json({ message: `Target result file not found in ZIP` });
            }
        }

        res.setHeader('Content-Disposition', `attachment; filename="results_${sendID}.zip"`);
        res.setHeader('Content-Type', 'application/zip');
        res.send(Buffer.from(zipRes.data));

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ message: 'Error downloading file', error: error.message });
    }
});

module.exports = router;
