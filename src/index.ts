import { Client, LocalAuth } from "whatsapp-web.js";
import fs from "fs";
import axios from "axios";
import { GoogleSpreadsheet } from "google-spreadsheet";
import creds from "../credentials.json"; // Load Google API credentials

const client = new Client({
  authStrategy: new LocalAuth(),
});

const expensesFile = "expenses.json";
const expenses: Array<{ category: string; amount: number; currency: string }> =
  fs.existsSync(expensesFile)
    ? JSON.parse(fs.readFileSync(expensesFile, "utf-8"))
    : [];

let defaultCurrency: string = "THB"; // Default currency, can be set manually or based on country
let customExchangeRate: number | null = null; // Manually set exchange rate
const exchangeRateApiUrl: string =
  "https://api.exchangerate-api.com/v4/latest/"; // API for currency conversion
let userLanguage: "he" | "en" = "he"; // Default language is Hebrew
let weekStartDay: string = "Sunday"; // Default first day of the week (Israel uses Sunday)

const icons: Record<string, string> = {
  success: "✅",
  summary: "📊",
  expense: "💰",
  calendar: "📅",
  bullet: "🔹",
};

const translations: Record<"he" | "en", Record<string, string>> = {
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
const t = (key: string): string =>
  `${icons[key] || ""} ${translations[userLanguage][key] || key}`;

// Connect to Google Sheets
const sheetId: string = "YOUR_GOOGLE_SHEET_ID"; // Replace with your Google Sheet ID
const doc = new GoogleSpreadsheet(sheetId);

const initGoogleSheet = async (): Promise<void> => {
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
};

const saveExpenseToGoogleSheets = async (expense: {
  category: string;
  amount: number;
  currency: string;
}): Promise<void> => {
  try {
    const sheet = doc.sheetsByTitle["Expenses"];
    if (!sheet) {
      console.error("Sheet 'Expenses' not found!");
      return;
    }
    await sheet.addRow({
      Category: expense.category,
      Amount: expense.amount,
      Currency: expense.currency,
      Date: new Date().toLocaleString(),
    });
  } catch (error) {
    console.error("Error saving to Google Sheets:", error);
  }
};

// Fetches exchange rate from API
const getExchangeRate = async (
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> => {
  if (customExchangeRate) return customExchangeRate;

  try {
    const response = await axios.get(`${exchangeRateApiUrl}${fromCurrency}`);
    return response.data.rates[toCurrency] || null;
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return null;
  }
};

// Parses message to extract category, amount, and currency
const parseExpense = (
  message: string
): { category: string; amount: number; currency: string } | null => {
  const regex = /(.*) (\d+) ?([A-Za-z]*)?/;
  const match = message.match(regex);
  if (!match) return null;

  return {
    category: match[1].trim(),
    amount: parseFloat(match[2]),
    currency: match[3] || defaultCurrency,
  };
};

// Saves expense to file and Google Sheets
const saveExpense = async (expense: {
  category: string;
  amount: number;
  currency: string;
}): Promise<void> => {
  const updatedExpenses = [...expenses, expense];
  fs.writeFileSync(expensesFile, JSON.stringify(updatedExpenses, null, 2));
  await saveExpenseToGoogleSheets(expense);
};

// Calculates weekly summary
const getWeeklyReport = (): string => {
  const summary = expenses.reduce<Record<string, number>>(
    (acc, { category, amount }) => {
      acc[category] = (acc[category] || 0) + amount;
      return acc;
    },
    {}
  );

  return Object.entries(summary).reduce((report, [category, total]) => {
    return `${report}\n${icons.bullet} ${category}: ${total} ${defaultCurrency}`;
  }, `${t("summary")} ${t("weeklySummary")}\n${icons.calendar} ${t("setWeekStart")}${weekStartDay}`);
};

// Listens for messages
client.on("message", async (msg) => {
  const message = msg.body.toLowerCase();

  if (message === t("weeklySummaryCommand")) {
    msg.reply(getWeeklyReport());
    return;
  }

  const expense = parseExpense(msg.body);
  if (expense) {
    if (expense.currency !== defaultCurrency) {
      const exchangeRate = await getExchangeRate(
        expense.currency,
        defaultCurrency
      );
      if (exchangeRate) {
        expense.amount = parseFloat((expense.amount * exchangeRate).toFixed(2));
        expense.currency = defaultCurrency;
      }
    }
    await saveExpense(expense);
    msg.reply(
      `${t("expense")} ${t("expenseAdded")}${expense.category} - ${
        expense.amount
      } ${expense.currency}`
    );
  }
});

client.initialize();
initGoogleSheet();
