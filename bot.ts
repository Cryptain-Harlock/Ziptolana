import { Telegraf, Markup } from "telegraf";
import * as web3 from "@solana/web3.js";
import { HttpsProxyAgent } from "https-proxy-agent";
import dotenv from "dotenv";

dotenv.config();

const { PROXY_HOST, PROXY_PORT, TG_BOT_TOKEN } = process.env;

if (!PROXY_HOST || !PROXY_PORT || !TG_BOT_TOKEN) {
  throw new Error("Missing required environment variables");
}

const proxyUrl = `http://${PROXY_HOST}:${PROXY_PORT}`;
const agent = new HttpsProxyAgent(proxyUrl);

const bot = new Telegraf(TG_BOT_TOKEN, {
  telegram: { agent },
});

bot.start((ctx) => {
  const username = ctx.from?.username || ctx.from?.first_name || "there";
  ctx.replyWithHTML(
    `<b>Hi, <u>${username}</u>. Welcome to Ziptos on Solana!</b>\n
    <i>Please select an option:</i>`,
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

// bot.action("createToken", async (ctx) => {
//   ctx.reply(`You've selected to Create a Token!`);
// });

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

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
