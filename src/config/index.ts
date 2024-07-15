import dotenv from "dotenv";
dotenv.config();

const {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_BOT_LOGO,
  PINATA_API_KEY,
  PINATA_SECRET_KEY,
  MONGO_URI,
  MONGO_DB,
  MONGO_COL_WALLETS,
  MONGO_COL_TOKENS,
  MONGO_COL_LIQUIDITIES,
} = process.env;

if (
  !TELEGRAM_BOT_TOKEN ||
  !TELEGRAM_BOT_LOGO ||
  !PINATA_API_KEY ||
  !PINATA_SECRET_KEY ||
  !MONGO_URI ||
  !MONGO_DB ||
  !MONGO_COL_WALLETS ||
  !MONGO_COL_TOKENS ||
  !MONGO_COL_LIQUIDITIES
) {
  throw new Error("⚠️ Missing required environment variables");
}

export const BOT_TOKEN = TELEGRAM_BOT_TOKEN;
export const BOT_LOGO = TELEGRAM_BOT_LOGO;
export const PIN_API_KEY = PINATA_API_KEY;
export const PIN_SECRET_KEY = PINATA_SECRET_KEY;
export const URI = MONGO_URI;
export const DB = MONGO_DB;
export const COL_WALLETS = MONGO_COL_WALLETS;
export const COL_TOKENS = MONGO_COL_TOKENS;
export const COL_LIQUIDITIES = MONGO_COL_LIQUIDITIES;
