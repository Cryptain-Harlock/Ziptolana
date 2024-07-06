import { Telegraf, Markup, Context } from "telegraf";
import { BOT_TOKEN } from "../config";
import { WalletInfo } from "./pages/wallet";

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
  const firstName = ctx.from?.first_name || "there";
  const userame = ctx.from?.username || "";

  try {
    ctx.replyWithHTML(
      `Hi, <b>${firstName}</b>. Welcome to Ziptos on Solana!`,
      Markup.inlineKeyboard([
        [Markup.button.callback("💫 Refresh Balance", "refreshBalance")],
        [Markup.button.callback("🗝 Wallet", "wallet")],
        [Markup.button.callback("💰 Your Tokens", "yourTokens")],
        [Markup.button.callback("💎 Liquidity", "liquidity")],
        [
          Markup.button.callback("❔ FAQ", "faq"),
          Markup.button.callback("📞 Support", "support"),
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

bot.on("callback_query", async (ctx: any) => {
  const callbackQuery = ctx.callbackQuery;
  const data = callbackQuery.data;

  const { wallets } = await WalletInfo(ctx);

  if (data && data.startsWith("wallet_")) {
    const parts = data.split("_");
    const walletIndex = parseInt(parts[1]);

    if (wallets && wallets[walletIndex]) {
      const wallet = wallets[walletIndex];

      await ctx.editMessageText(
        `<b>Wallet Information</b>\n\n` +
          `<b>${wallet.walletName}</b>\n` +
          `<code>${wallet.publicKey}</code>\n`,
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🌟 Create Token", "createToken")],
            [
              Markup.button.callback("🔐 Secret Key", "secretKey"),
              Markup.button.callback("🗑 Delete Wallet", "deleteWallet"),
            ],
            [Markup.button.callback("🔙 Go Back", "wallet")],
          ]),
        }
      );
    }
  } else if (data && data.startsWith("wallet")) {
    try {
      if (wallets.length === 0) {
        await ctx.editMessageText(
          `<i>No wallet found!</i>\n\nPlease create a new wallet.`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              [Markup.button.callback("🔑 Generate Wallet", "generateWallet")],
              [Markup.button.callback("🔙 Go Back", "dashboard")],
            ]),
          }
        );
      } else {
        const walletButtons = [];
        for (let i = 0; i < wallets.length; i += 2) {
          const row = [];
          row.push(
            Markup.button.callback(`💳 ${wallets[i].walletName}`, `wallet_${i}`)
          );
          if (i + 1 < wallets.length) {
            row.push(
              Markup.button.callback(
                `💳 ${wallets[i + 1].walletName}`,
                `wallet_${i + 1}`
              )
            );
          }
          walletButtons.push(row);
        }

        await ctx.editMessageText(`<b>Your Wallets:</b>\n`, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            ...walletButtons,
            [
              Markup.button.callback("🔑 Generate Wallet", "generateWallet"),
              Markup.button.callback("🔙 Go Back", "goHome"),
            ],
          ]),
        });
      }
    } catch (error) {
      console.error("Failed to retrieve wallets:", error);
      ctx.reply("Failed to retrieve wallet. Please try again later.");
    }
  }
});

export default bot;
