const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const FormData = require('form-data');
const { recordTransaction } = require('../utils/transactionHelper');
const { isAdmin } = require('../middleware/auth');
const supabase = require('../config/supabase');
const {
    CHECKNUMBER_SERVICES,
    getEffectivePricePer10k,
    getPricingPayload,
    updatePricing,
    resetAllPricing
} = require('../utils/appDetectionPricing');

const upload = multer({ dest: '/tmp/' });
const JSZip = require('jszip');
const os = require('os');
const path = require('path');

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

// GET /api/app-detect/pricing
router.get('/pricing', (req, res) => {
    try {
        const payload = getPricingPayload();
        res.json(payload);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching pricing', error: err.message });
    }
});

// POST /api/app-detect/pricing (Admin update prices & base formula)
router.post('/pricing', isAdmin, (req, res) => {
    try {
        const { baseRate, baseUnit, customPrices } = req.body;
        const updated = updatePricing({ baseRate, baseUnit, customPrices });
        res.json({ success: true, message: 'App detection pricing updated successfully', data: updated });
    } catch (err) {
        res.status(500).json({ message: 'Error updating pricing', error: err.message });
    }
});

// POST /api/app-detect/pricing/reset (Admin reset all prices to default)
router.post('/pricing/reset', isAdmin, (req, res) => {
    try {
        const resetData = resetAllPricing();
        res.json({ success: true, message: 'App detection pricing reset to defaults', data: resetData });
    } catch (err) {
        res.status(500).json({ message: 'Error resetting pricing', error: err.message });
    }
});

// POST /api/app-detect/upload
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { userId, appType } = req.body;
        const file = req.file;

        if (!file || !userId || !appType) {
            return res.status(400).json({ message: 'Missing file, userId, or appType' });
        }

        const priceInfo = getEffectivePricePer10k(appType);
        const taskType = priceInfo.taskType;
        const costPer10k = priceInfo.costPer10k;

        const ext = file.originalname.split('.').pop().toLowerCase();
        const numbers = await parseFile(file.path, ext);
        const uniqueNumbers = [...new Set(numbers)]; // Dedup
        const count = uniqueNumbers.length;

        if (count < 1000) {
            return res.status(400).json({ message: 'File must contain at least 1000 valid numbers' });
        }

        // Calculate Cost Dynamically using effective price per 10k
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
            costPer10k: costPer10k,
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
