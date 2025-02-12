"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const google_auth_library_1 = require("google-auth-library");
const google_spreadsheet_1 = require("google-spreadsheet");
const whatsapp_web_js_1 = require("whatsapp-web.js");
const credentials_json_1 = __importDefault(require("./credentials.json")); // Load Google API credentials
const client = new whatsapp_web_js_1.Client({
    authStrategy: new whatsapp_web_js_1.LocalAuth(),
});
const expensesFile = "expenses.json";
const expenses = fs_1.default.existsSync(expensesFile)
    ? JSON.parse(fs_1.default.readFileSync(expensesFile, "utf-8"))
    : [];
let defaultCurrency = "THB"; // Default currency, can be set manually or based on country
let customExchangeRate = null; // Manually set exchange rate
const exchangeRateApiUrl = "https://api.exchangerate-api.com/v4/latest/"; // API for currency conversion
let userLanguage = "he"; // Default language is Hebrew
let weekStartDay = "Sunday"; // Default first day of the week (Israel uses Sunday)
const icons = {
    success: "✅",
    summary: "📊",
    expense: "💰",
    calendar: "📅",
    bullet: "🔹",
};
const translations = {
    he: {
        weeklySummary: "סיכום שבועי:",
        setCurrency: "המטבע נקבע ל-",
        setRate: "שער החליפין נקבע ל-",
        expenseAdded: "נוספה הוצאה: ",
        changeLanguage: "השפה שונתה לעברית",
        setWeekStart: "היום הראשון בשבוע נקבע ל-",
        setCurrencyCommand: "הגדר מטבע",
        setRateCommand: "הגדר שער",
        changeLanguageCommand: "שנה שפה",
        setWeekStartCommand: "הגדר יום ראשון",
        weeklySummaryCommand: "סיכום שבועי",
    },
    en: {
        weeklySummary: "Weekly Summary:",
        setCurrency: "Currency set to ",
        setRate: "Exchange rate set to ",
        expenseAdded: "Expense added: ",
        changeLanguage: "Language changed to English",
        setWeekStart: "First day of the week set to ",
        setCurrencyCommand: "set currency",
        setRateCommand: "set rate",
        changeLanguageCommand: "change language",
        setWeekStartCommand: "set week start",
        weeklySummaryCommand: "weekly summary",
    },
};
// Function for translation lookup with icons
const t = (key) => `${icons[key] || ""} ${translations[userLanguage][key] || key}`;
// Connect to Google Sheets
const sheetId = "YOUR_GOOGLE_SHEET_ID"; // Replace with your Google Sheet ID
const doc = new google_spreadsheet_1.GoogleSpreadsheet(sheetId);
const initGoogleSheet = () => __awaiter(void 0, void 0, void 0, function* () {
    const jwt = new google_auth_library_1.JWT({
        email: credentials_json_1.default.client_email,
        key: credentials_json_1.default.private_key,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    yield doc.useServiceAccountAuth(jwt);
    yield doc.loadInfo();
});
const saveExpenseToGoogleSheets = (expense) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sheet = doc.sheetsByTitle["Expenses"];
        if (!sheet) {
            console.error("Sheet 'Expenses' not found!");
            return;
        }
        yield sheet.addRow({
            Category: expense.category,
            Amount: expense.amount,
            Currency: expense.currency,
            Date: new Date().toLocaleString(),
        });
    }
    catch (error) {
        console.error("Error saving to Google Sheets:", error);
    }
});
// Fetches exchange rate from API
const getExchangeRate = (fromCurrency, toCurrency) => __awaiter(void 0, void 0, void 0, function* () {
    if (customExchangeRate)
        return customExchangeRate;
    try {
        const response = yield axios_1.default.get(`${exchangeRateApiUrl}${fromCurrency}`);
        return response.data.rates[toCurrency] || null;
    }
    catch (error) {
        console.error("Error fetching exchange rate:", error);
        return null;
    }
});
// Parses message to extract category, amount, and currency
const parseExpense = (message) => {
    const regex = /(.*) (\d+) ?([A-Za-z]*)?/;
    const match = message.match(regex);
    if (!match)
        return null;
    return {
        category: match[1].trim(),
        amount: parseFloat(match[2]),
        currency: match[3] || defaultCurrency,
    };
};
// Saves expense to file and Google Sheets
const saveExpense = (expense) => __awaiter(void 0, void 0, void 0, function* () {
    const updatedExpenses = [...expenses, expense];
    fs_1.default.writeFileSync(expensesFile, JSON.stringify(updatedExpenses, null, 2));
    yield saveExpenseToGoogleSheets(expense);
});
// Calculates weekly summary
const getWeeklyReport = () => {
    const summary = expenses.reduce((acc, { category, amount }) => {
        acc[category] = (acc[category] || 0) + amount;
        return acc;
    }, {});
    return Object.entries(summary).reduce((report, [category, total]) => {
        return `${report}\n${icons.bullet} ${category}: ${total} ${defaultCurrency}`;
    }, `${t("summary")} ${t("weeklySummary")}\n${icons.calendar} ${t("setWeekStart")}${weekStartDay}`);
};
// Listens for messages
client.on("message", (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const message = msg.body.toLowerCase();
    if (message === t("weeklySummaryCommand")) {
        msg.reply(getWeeklyReport());
        return;
    }
    const expense = parseExpense(msg.body);
    if (expense) {
        if (expense.currency !== defaultCurrency) {
            const exchangeRate = yield getExchangeRate(expense.currency, defaultCurrency);
            if (exchangeRate) {
                expense.amount = parseFloat((expense.amount * exchangeRate).toFixed(2));
                expense.currency = defaultCurrency;
            }
        }
        yield saveExpense(expense);
        msg.reply(`${t("expense")} ${t("expenseAdded")}${expense.category} - ${expense.amount} ${expense.currency}`);
    }
}));
client.initialize();
initGoogleSheet();
