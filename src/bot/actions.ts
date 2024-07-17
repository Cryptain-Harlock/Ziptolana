import { Telegraf, Markup } from "telegraf";
import { getOrCreateWallet } from "../utils/solana";
import { colWallets, colTokens } from "../utils/mongo";
import { BOT_TOKEN, BOT_LOGO } from "../config";

import Dashboard from "./pages/dashboard";
import { ShowWalletInfo, ShowSecretKey } from "./pages/wallet";
import {
  TokenInfo,
  ShowTokens,
  ShowTokenInfo,
  CreateTokenBoard,
} from "./pages/token";
import { MintEnableBoard, MintDisableBoard } from "./pages/mintToken";
import { LPInfo, ShowLPs, ShowLPInfo } from "./pages/liquidity";

const bot = new Telegraf(BOT_TOKEN);
const awaitingTokenCreationInput = new Map();
const awaitingDisableMintingInput = new Map();
const awaitingEnableMintingInput = new Map();
const tokenDetails = new Map();

bot.start(async (ctx) => {
  const tgId = ctx.from?.id.toString();
  const username = ctx.from?.username || "";
  const firstName = ctx.from?.first_name || "there";

  try {
    const wallet = await getOrCreateWallet(tgId, username);
    const userAccount = wallet.publicKey.toBase58();

    ctx.replyWithHTML(
      `Hi, <b>${firstName}</b>. Welcome to Ziptos on Solana!\n\nYour Solana Account:\n<code>${userAccount}</code>\n\n`,
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
  const callbackQuery = ctx.callbackQuery;
  const data = callbackQuery.data;

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
  } else if (data && data.startsWith("burnToken")) {
    // Burn token
  } else if (data && data.startsWith("mintEnable")) {
    awaitingEnableMintingInput.set(ctx.from.id, 0);
    await MintEnableBoard(ctx);
  } else if (data && data.startsWith("mintDisable")) {
    awaitingDisableMintingInput.set(ctx.from.id, 0);
    await MintDisableBoard(ctx);
  } else if (data && data.startsWith("freezeAuth")) {
  } else if (data && data.startsWith("liquidities")) {
    await ShowLPs(ctx);
  } else if (data && data.startsWith("createLiquidity")) {
    // await ShowLiquidityOptions(ctx);
  } else if (data && data.startsWith("create")) {
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
  } else if (awaitingDisableMintingInput.has(tgId)) {
    await MintDisableBoard(ctx);
  } else if (awaitingEnableMintingInput.has(tgId)) {
    await MintEnableBoard(ctx);
  }
});

export default bot;
