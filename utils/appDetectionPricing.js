const fs = require('fs');
const path = require('path');
const os = require('os');

// Standard CheckNumber service definitions with base prices per 10k
const CHECKNUMBER_SERVICES = {
    // Telegram
    "Telegram Checker": { type: "tg", price: 2.5, category: "Messaging" },
    "Telegram Days Checker": { type: "tg_active", price: 3.5, category: "Messaging" },
    "Telegram Age & Gender Checker": { type: "tg_avatar", price: 4.5, category: "Messaging" },
    "Telegram Username Checker": { type: "tg_username", price: 1.5, category: "Messaging" },
    "Telegram Username Profile Checker": { type: "tg_username_profile", price: 4.0, category: "Messaging" },
    "Telegram Username Activity Checker": { type: "tg_username_activity", price: 3.0, category: "Messaging" },
    // WhatsApp
    "WhatsApp Checker": { type: "ws", price: 1.0, category: "Messaging" },
    "WhatsApp Days Checker": { type: "ws_active", price: 1.8, category: "Messaging" },
    "Whatsapp Age & Gender Checker": { type: "ws_avatar", price: 3.8, category: "Messaging" },
    // Number Checker / Validation
    "Phone Number Validation": { type: "phoneCheck", price: 4.0, category: "Carrier & Lookup" },
    "Number Active Check": { type: "active_check", price: 6.5, category: "Carrier & Lookup" },
    "High Value Users Checker": { type: "high_value_users", price: 7.0, category: "Carrier & Lookup" },
    // Viber
    "Viber Checker": { type: "viber", price: 0.5, category: "Messaging" },
    "Viber Days Checker": { type: "viber_active", price: 5.0, category: "Messaging" },
    "Viber Age & Gender Checker": { type: "viber_senior", price: 15.0, category: "Messaging" },
    // iMessage
    "iMessage Checker": { type: "imessage", price: 1.4, category: "Messaging" },
    // RCS
    "Rcs Checker": { type: "rcs", price: 1.5, category: "Messaging" },
    // Signal
    "Signal Checker": { type: "signal", price: 1.5, category: "Messaging" },
    // VK
    "VK (VKontakte) Checker": { type: "vk", price: 5.0, category: "Social Media" },
    // Apple ID
    "Apple Checker": { type: "apple", price: 1.5, category: "Services & Entertainment" },
    "Apple Email Checker": { type: "apple_email", price: 2.0, category: "Services & Entertainment" },
    // Facebook
    "Facebook Checker": { type: "facebook", price: 0.3, category: "Social Media" },
    "Facebook Email Checker": { type: "facebook_email", price: 0.3, category: "Social Media" },
    // Amazon
    "Amazon Checker": { type: "amazon", price: 2.0, category: "Services & Entertainment" },
    "Amazon Email Checker": { type: "amazon_email", price: 2.0, category: "Services & Entertainment" },
    // Instagram
    "Instagram Checker": { type: "instagram", price: 0.3, category: "Social Media" },
    "Instagram Email Checker": { type: "instagram_email", price: 0.3, category: "Social Media" },
    // MAX
    "MAX Checker": { type: "max", price: 10.0, category: "Services & Entertainment" },
    "MAX Full Profile Checker": { type: "max_full", price: 20.0, category: "Services & Entertainment" },
    // Netflix
    "Netflix Checker": { type: "netflix", price: 7.0, category: "Services & Entertainment" },
    "Netflix Email Checker": { type: "netflix_email", price: 7.0, category: "Services & Entertainment" },
    // Line
    "Line Checker": { type: "line", price: 5.0, category: "Messaging" },
    "Line Profile Checker": { type: "line_senior", price: 15.0, category: "Messaging" },
    // Twitter
    "Twitter Checker": { type: "twitter", price: 1.0, category: "Social Media" },
    "Twitter/X Email Checker": { type: "twitter_email", price: 1.0, category: "Social Media" },
    // LinkedIn
    "LinkedIn CheckNumber": { type: "linkedin_phone", price: 5.0, category: "Social Media" },
    "LinkedIn Email Checker": { type: "linkedin", price: 0.5, category: "Social Media" },
    "LinkedIn Email Profile Checker": { type: "linkedin_profile", price: 10.0, category: "Social Media" },
    // Zalo
    "Zalo Checker": { type: "zalo", price: 2.0, category: "Messaging" },
    // TikTok
    "TikTok Checker": { type: "tiktok", price: 9.0, category: "Social Media" },
    // Microsoft
    "Microsoft Checker": { type: "microsoft", price: 2.0, category: "Services & Entertainment" },
    // Snapchat
    "Snapchat Checker": { type: "snapchat", price: 15.0, category: "Social Media" },
    // Messenger
    "Messenger Checker": { type: "messenger", price: 2.8, category: "Messaging" },
    // GoTo
    "GoTo Checker": { type: "goto", price: 7.0, category: "Services & Entertainment" },
    // Threads
    "Threads Checker": { type: "threads", price: 0.8, category: "Social Media" },
    // Spotify
    "Spotify Email Checker": { type: "spotify_email", price: 1.0, category: "Services & Entertainment" },
    // Band
    "Band Checker": { type: "band", price: 1.0, category: "Services & Entertainment" },
    // DHL
    "DHL Checker": { type: "dhl", price: 1.5, category: "Services & Entertainment" },
    // Sideline
    "Sideline Checker": { type: "sideline", price: 1.5, category: "Services & Entertainment" },
    // Airbnb
    "Airbnb Checker": { type: "airbnb", price: 2.0, category: "Services & Entertainment" },
    // Pornhub
    "Pornhub Checker": { type: "pornhub", price: 7.0, category: "Services & Entertainment" },
    // Temu
    "Temu Checker": { type: "temu", price: 2.0, category: "Services & Entertainment" },
    // Binance
    "Binance Checker": { type: "Binance", price: 6.5, category: "Crypto & Exchanges" },
    "Binance Email Checker": { type: "binance_email", price: 15.0, category: "Crypto & Exchanges" },
    // Kucoin
    "Kucoin Checker": { type: "Kucoin", price: 7.0, category: "Crypto & Exchanges" },
    "Kucoin Email Checker": { type: "kucoin_email", price: 7.0, category: "Crypto & Exchanges" },
    // Htx
    "Htx Checker": { type: "htx", price: 3.5, category: "Crypto & Exchanges" },
    "Htx Email Checker": { type: "htx_email", price: 7.0, category: "Crypto & Exchanges" },
    // CoinW
    "CoinW Checker": { type: "coinW", price: 2.0, category: "Crypto & Exchanges" },
    "CoinW Email Checker": { type: "coinw_email", price: 7.0, category: "Crypto & Exchanges" },
    // Crypto.com
    "Crypto.com Email Checker": { type: "crypto_email", price: 15.0, category: "Crypto & Exchanges" },
    // Email/Global Carrier
    "Email Check": { type: "email_check", price: 7.0, category: "Carrier & Lookup" },
    "Phone Carrier Bulk Lookup": { type: "usaCarrier", price: 2.0, category: "Carrier & Lookup" },
    "Advanced US Carrier Checker": { type: "us_carrier_premium", price: 15.0, category: "Carrier & Lookup" }
};

// Default pricing parameters
const DEFAULT_BASE_RATE = 5.2; // Default USDT per 10k for a 1.5 base unit
const DEFAULT_BASE_UNIT = 1.5;

const PRIMARY_CONFIG_PATH = path.join(__dirname, '../config/appDetectionPricing.json');
const FALLBACK_CONFIG_PATH = path.join(os.tmpdir(), 'appDetectionPricing.json');

// In-memory cache
let configState = {
    baseRate: DEFAULT_BASE_RATE,
    baseUnit: DEFAULT_BASE_UNIT,
    customPrices: {} // { "WhatsApp Checker": 4.5, ... }
};

// Load saved config on startup
function loadConfig() {
    try {
        let filePath = null;
        if (fs.existsSync(PRIMARY_CONFIG_PATH)) {
            filePath = PRIMARY_CONFIG_PATH;
        } else if (fs.existsSync(FALLBACK_CONFIG_PATH)) {
            filePath = FALLBACK_CONFIG_PATH;
        }

        if (filePath) {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                if (typeof parsed.baseRate === 'number' && parsed.baseRate > 0) {
                    configState.baseRate = parsed.baseRate;
                }
                if (typeof parsed.baseUnit === 'number' && parsed.baseUnit > 0) {
                    configState.baseUnit = parsed.baseUnit;
                }
                if (parsed.customPrices && typeof parsed.customPrices === 'object') {
                    configState.customPrices = { ...parsed.customPrices };
                }
                console.log(`[AppDetectionPricing] Loaded config from ${filePath}`);
            }
        }
    } catch (err) {
        console.warn('[AppDetectionPricing] Failed to load config file, using defaults:', err.message);
    }
}

// Save config to disk (with fallback for read-only environments)
function saveConfig() {
    const payload = JSON.stringify(configState, null, 2);
    try {
        const configDir = path.dirname(PRIMARY_CONFIG_PATH);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(PRIMARY_CONFIG_PATH, payload, 'utf8');
        return true;
    } catch (err) {
        console.warn(`[AppDetectionPricing] Failed writing to primary config path (${PRIMARY_CONFIG_PATH}):`, err.message);
        try {
            fs.writeFileSync(FALLBACK_CONFIG_PATH, payload, 'utf8');
            return true;
        } catch (fallbackErr) {
            console.error('[AppDetectionPricing] Failed writing to fallback config path:', fallbackErr.message);
            return false;
        }
    }
}

// Initialize config on module load
loadConfig();

/**
 * Calculate the default formula price for a service given its base price
 */
function calculateDefaultPrice(basePrice, baseRate = configState.baseRate, baseUnit = configState.baseUnit) {
    const calculated = basePrice * (baseRate / baseUnit);
    return Number(calculated.toFixed(3));
}

/**
 * Get effective price per 10k for a given app type
 */
function getEffectivePricePer10k(appType) {
    const service = CHECKNUMBER_SERVICES[appType];
    const basePrice = service ? service.price : 1.0;
    const taskType = service ? service.type : "ws";
    const defaultPrice = calculateDefaultPrice(basePrice);

    const custom = configState.customPrices[appType];
    if (typeof custom === 'number' && custom >= 0) {
        return {
            appType,
            taskType,
            basePrice,
            costPer10k: custom,
            defaultPricePer10k: defaultPrice,
            isCustom: true
        };
    }

    return {
        appType,
        taskType,
        basePrice,
        costPer10k: defaultPrice,
        defaultPricePer10k: defaultPrice,
        isCustom: false
    };
}

/**
 * Get complete pricing payload for API consumption
 */
function getPricingPayload() {
    const servicesList = Object.entries(CHECKNUMBER_SERVICES).map(([name, data]) => {
        const defaultPrice = calculateDefaultPrice(data.price);
        const customPrice = typeof configState.customPrices[name] === 'number' ? configState.customPrices[name] : null;
        const effectivePrice = customPrice !== null ? customPrice : defaultPrice;

        return {
            name,
            type: data.type,
            category: data.category || "Other",
            basePrice: data.price,
            defaultPricePer10k: defaultPrice,
            customPricePer10k: customPrice,
            effectivePricePer10k: effectivePrice,
            isCustom: customPrice !== null
        };
    });

    return {
        baseRate: configState.baseRate,
        baseUnit: configState.baseUnit,
        customPrices: { ...configState.customPrices },
        services: servicesList,
        totalServices: servicesList.length,
        customCount: Object.keys(configState.customPrices).length
    };
}

/**
 * Update pricing configuration (Admin only)
 */
function updatePricing({ baseRate, baseUnit, customPrices }) {
    if (typeof baseRate === 'number' && baseRate > 0) {
        configState.baseRate = Number(baseRate.toFixed(4));
    }
    if (typeof baseUnit === 'number' && baseUnit > 0) {
        configState.baseUnit = Number(baseUnit.toFixed(4));
    }
    if (customPrices && typeof customPrices === 'object') {
        const cleanedCustom = {};
        for (const [key, val] of Object.entries(customPrices)) {
            if (CHECKNUMBER_SERVICES[key] && typeof val === 'number' && val >= 0) {
                cleanedCustom[key] = Number(val.toFixed(4));
            }
        }
        configState.customPrices = cleanedCustom;
    }

    saveConfig();
    return getPricingPayload();
}

/**
 * Reset all custom prices back to default formula
 */
function resetAllPricing() {
    configState.baseRate = DEFAULT_BASE_RATE;
    configState.baseUnit = DEFAULT_BASE_UNIT;
    configState.customPrices = {};
    saveConfig();
    return getPricingPayload();
}

module.exports = {
    CHECKNUMBER_SERVICES,
    DEFAULT_BASE_RATE,
    DEFAULT_BASE_UNIT,
    getEffectivePricePer10k,
    getPricingPayload,
    updatePricing,
    resetAllPricing
};
