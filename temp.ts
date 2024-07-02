import { Telegraf, Markup } from "telegraf";
import * as web3 from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { HttpsProxyAgent } from "https-proxy-agent";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const {
  PROXY_HOST,
  PROXY_PORT,
  TG_BOT_TOKEN,
  MONGO_URI,
  MONGO_DB_NAME,
  MONGO_COLLECTION_NAME,
} = process.env;

if (
  !PROXY_HOST ||
  !PROXY_PORT ||
  !TG_BOT_TOKEN ||
  !MONGO_URI ||
  !MONGO_DB_NAME ||
  !MONGO_COLLECTION_NAME
) {
  throw new Error("Missing required environment variables");
}

const proxyUrl = `http://${PROXY_HOST}:${PROXY_PORT}`;
const agent = new HttpsProxyAgent(proxyUrl);

const bot = new Telegraf(TG_BOT_TOKEN, {
  telegram: { agent },
});

const connection = new web3.Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

const userAccounts: { [key: string]: web3.Keypair } = {};

const generateSolanaAccount = (userId: string): web3.Keypair => {
  return web3.Keypair.generate();
};

bot.start((ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) {
    ctx.reply("Unable to identify user.");
    return;
  }

  let userAccount = userAccounts[userId];
  if (!userAccount) {
    userAccount = generateSolanaAccount(userId);
    userAccounts[userId] = userAccount;
  }

  const userAddress = userAccount.publicKey.toBase58();

  const username = ctx.from?.first_name || ctx.from?.username || "there";
  ctx.replyWithHTML(
    `Hi, <b>${username}</b>. Welcome to Ziptos on Solana!\n
    Your Solana Account:\n<code>${userAddress}</code>`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("🌟 Create Token", "createToken"),
        Markup.button.callback("💫 Refresh Balance", "refreshBalance"),
        Markup.button.callback("🗝 Wallet", "wallet"),
      ],
      [
        Markup.button.callback("➕ Import Wallet", "importWallet"),
        Markup.button.callback("🔴 Disconnect Wallet", "disconnectWallet"),
      ],
      [
        Markup.button.callback("💎 Add Liquidity", "addLiquidity"),
        Markup.button.callback("❌ Remove Liquidity", "removeLiquidity"),
      ],
      [
        Markup.button.callback("💱 Swap", "swap"),
        Markup.button.callback("💰 Your Tokens", "yourTokens"),
      ],
      [
        Markup.button.callback("❔ FAQ", "faq"),
        Markup.button.callback("📞 Support", "support"),
      ],
    ])
  );
});

bot.on("text", (ctx) => ctx.reply(`You said: ${ctx.message.text}`));

console.log("Attempting to launch bot...");

bot
  .launch()
  .then(() => {
    console.log("Bot is running");
  })
  .catch((error) => {
    console.error(`Failed to launch bot: ${error.message}`, error);
  });

process.once("SIGINT", () => {
  // Save user accounts or perform cleanup if needed
  console.log("Bot stopped");
  process.exit();
});

process.once("SIGTERM", () => {
  // Save user accounts or perform cleanup if needed
  console.log("Bot stopped");
  process.exit();
});