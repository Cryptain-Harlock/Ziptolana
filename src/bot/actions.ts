import { Telegraf, Markup } from "telegraf";
import { getOrCreateWallet } from "../utils/solana";
import { colWallets, colTokens } from "../utils/mongo";
import { BOT_TOKEN, BOT_LOGO } from "../config";

import Dashboard from "./pages/dashboard";
import { ShowWalletInfo, ShowSecretKey } from "./pages/wallet";
import {
  ShowTokens,
  ShowTokenInfo,
  CreateTokenBoard,
  MintDisableBoard,
  MintDisableConfirmed,
  FreezeAuthBoard,
  FreezeAuthConfirmed,
} from "./pages/token";
import { LPInfo, ShowLPs, ShowLPInfo, AddLPBoard } from "./pages/liquidity";

import { HttpsProxyAgent } from "https-proxy-agent";

const PROXY_URL = "http://192.168.6.198:808";
const agent = new HttpsProxyAgent(PROXY_URL);

// const bot = new Telegraf(BOT_TOKEN, { telegram: { agent } });
const bot = new Telegraf(BOT_TOKEN);

const awaitingTokenCreationInput = new Map();
const tokenDetails = new Map();

const awaitingLPCreationInput = new Map();
const lpDetails = new Map();

bot.start(async (ctx) => {
  const tgId = ctx.from?.id.toString();
  const username = ctx.from?.username || "";
  const firstName = ctx.from?.first_name || "there";

  try {
    const wallet = await getOrCreateWallet(tgId, username);
    const userAccount = wallet.publicKey.toBase58();

    ctx.replyWithHTML(
      `👋 Hi, <b>${firstName}</b>\n` +
        `Welcome to Ziptos on Solana!\n\nYour Solana Account:\n<code>${userAccount}</code>\n\n`,
      Markup.inlineKeyboard([
        [Markup.button.callback("💫 Refresh Balance", "dashboard")],
        [Markup.button.callback("🗝 Wallet", "wallet")],
        [Markup.button.callback("💰 Token", "tokens")],
        [Markup.button.callback("⚖️ Liquidity", "liquidities")],
        [
          Markup.button.callback("❔ FAQ", "faq"),
          Markup.button.callback("💬 Support", "support"),
        ],
      ])
    );
  } catch (error) {
    console.error("⚠️ Failed to handle start command:", error);
    ctx.reply(
      "There was an error processing your request to start. Please try again later."
    );
  }
});

bot.help((ctx) => {
  ctx.replyWithHTML(
    `Here are the commands you can use:\n\n` +
      `/start - Start the bot and get your Solana account info\n` +
      `/help - Get this help message\n`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🏠 Go to Dashboard", "dashboard")],
      [Markup.button.callback("💬 Contact Support", "support")],
    ])
  );
});

bot.telegram.setMyCommands([
  {
    command: "start",
    description: "Start the bot and get your Solana account info",
  },
  { command: "help", description: "Get a list of available commands" },
]);

bot.on("callback_query", async (ctx: any) => {
  const tgId = ctx.from?.id.toString();
  const firstName = ctx.from?.first_name || "there";
  const account = await colWallets.findOne({ tgId });
  const userAccount = account?.account || "";

  const data = ctx.callbackQuery.data;
  const [action, actionName, confirmedData] = ctx.callbackQuery.data.split("_");

  if (data && data.startsWith("dashboard")) {
    await Dashboard(ctx, firstName, userAccount);
  } else if (data && data.startsWith("wallet")) {
    await ShowWalletInfo(ctx);
  } else if (data && data.startsWith("secretKey")) {
    await ShowSecretKey(ctx);
  } else if (data && data.startsWith("tokens")) {
    await ShowTokens(ctx);
  } else if (data && data.startsWith("token_")) {
    await ShowTokenInfo(ctx);
  } else if (data && data.startsWith("createToken")) {
    awaitingTokenCreationInput.set(ctx.from.id, 0);
    tokenDetails.set(ctx.from.id, {});
    await CreateTokenBoard(ctx);
  } else if (data && data.startsWith("mintDisable_")) {
    await MintDisableBoard(ctx);
  } else if (data && data.startsWith("freezeAuth_")) {
    await FreezeAuthBoard(ctx);
  } else if (data && data.startsWith("liquidities")) {
    await ShowLPs(ctx);
  } else if (data && data.startsWith("addLP")) {
    awaitingLPCreationInput.set(ctx.from.id, 0);
    lpDetails.set(ctx.from.id, {});
    await AddLPBoard(ctx);
  } else if (action === "confirm") {
    switch (actionName) {
      case "mintDisable":
        await MintDisableConfirmed(ctx, confirmedData);
        break;
      case "freezeAuth":
        await FreezeAuthConfirmed(ctx, confirmedData);
        break;
      default:
        await ctx.reply("Unknown action");
    }
  } else if (action === "cancel") {
    await ctx.editMessageText("Action canceled", {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Go Back", "tokens")],
      ]),
    });
  }
});

bot.on("message", async (ctx: any) => {
  const tgId = ctx.from.id;
  if (awaitingTokenCreationInput.has(tgId)) {
    if (ctx.message.photo) {
      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      ctx.message.text = fileId;
    }
    await CreateTokenBoard(ctx);
  } else if (awaitingLPCreationInput.has(tgId)) {
    await AddLPBoard(ctx);
  }
});

export default bot;
