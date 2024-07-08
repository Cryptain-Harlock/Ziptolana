import { Telegraf, Markup, Context, session } from "telegraf";
import { BOT_TOKEN } from "../config";
// import { Dashboard, fetchSolanaRate } from "./pages/dashboard";
import { WalletInfo } from "./pages/wallet";
import { CreateWallet } from "../utils/solana";
import { colWallets } from "../utils/mongo";

const bot = new Telegraf(BOT_TOKEN);

bot.use(session());

const awaitingInput = new Map<number, string>();

bot.start(async (ctx) => {
  const firstName = ctx.from?.first_name || "there";

  try {
    ctx.replyWithHTML(
      `Hi, <b>${firstName}</b>. Welcome to Ziptos on Solana!\n\n`,
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
  const tgId = ctx.from?.id;

  const { wallets } = await WalletInfo(ctx);

  if (data && data.startsWith("wallet_")) {
    const parts = data.split("_");
    const walletIndex = parseInt(parts[1]);

    if (wallets && wallets[walletIndex]) {
      const wallet = wallets[walletIndex];

      await ctx.editMessageText(
        `<b>Home > Wallet > Wallet Information</b>\n\n` +
          `<b>${wallet.walletName}</b>\n` +
          `<code>${wallet.publicKey}</code>\n`,
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🌟 Create Token", "createToken")],
            [
              Markup.button.callback(
                "🔐 Secret Key",
                `secretKey_${wallet.publicKey}`
              ),
              Markup.button.callback(
                "🗑 Delete Wallet",
                `deleteWallet_${wallet.publicKey}`
              ),
            ],
            [Markup.button.callback("🔙 Go Back to Wallet", "wallet")],
          ]),
        }
      );
    }
  }
  // Show Secret Key -----------------
  else if (data && data.startsWith("secretKey")) {
    const publicKeyInString = data.split("secretKey_")[1];
    const walletForPub = await colWallets.findOne({
      publicKey: publicKeyInString,
    });

    const secretKey = Uint8Array.from(walletForPub.secretKey);
    await ctx.editMessageText(`<b>Secret Key:</b>\n<code>${secretKey}</code>`, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([[Markup.button.callback("👌 Done", "wallet")]]),
    });
  }
  // Delete wallet --------------------
  else if (data && data.startsWith("deleteWallet")) {
    const delWalletPubKey = data.split("deleteWallet_")[1];
    const walletToDelete = await colWallets.findOne({
      publicKey: delWalletPubKey,
    });

    await ctx.editMessageText(
      `Are you sure you want to delete the wallet <b>${walletToDelete.walletName}</b>?`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          Markup.button.callback("✅ Yes", `confirmDelete_${delWalletPubKey}`),
          Markup.button.callback("❌ No", "wallet"),
        ]),
      }
    );
  } else if (data && data.startsWith("confirmDelete_")) {
    const delWalletPubKey = data.split("confirmDelete_")[1];
    const walletToDelete = await colWallets.findOne({
      publicKey: delWalletPubKey,
    });

    if (walletToDelete) {
      await colWallets.deleteOne({ publicKey: delWalletPubKey });
      await ctx.editMessageText(
        `<b>${walletToDelete.walletName}</b> wallet has been deleted!`,
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("👌 Done", "wallet")],
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
              [Markup.button.callback("🏘 Home", "dashboard")],
              [Markup.button.callback("🔑 Generate Wallet", "generateWallet")],
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

        await ctx.editMessageText(`<b>Home > Your Wallets:</b>\n`, {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            ...walletButtons,
            [
              Markup.button.callback("🏘 Home", "goHome"),
              Markup.button.callback("🔑 Generate Wallet", "generateWallet"),
            ],
          ]),
        });
      }
    } catch (error) {
      console.error("Failed to retrieve wallets:", error);
      ctx.reply("Failed to retrieve wallet. Please try again later.");
    }
  } else if (data && data.startsWith("generateWallet")) {
    ctx.reply("Please input your wallet name:");
    awaitingInput.set(tgId, "awaitingWalletName");
    ctx.answerCbQuery(); // To answer the callback query
  }
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const state = awaitingInput.get(userId);

  if (state === "awaitingWalletName") {
    const walletName = ctx.message.text.toString();
    const tgId = ctx.from.id.toString();
    const username = ctx.from.username || "";
    const existWalletName = await colWallets.findOne(walletName).toString();
    console.log(existWalletName + "-----------------------");

    if (walletName === existWalletName) {
      ctx.reply(
        "Warning! You have already a wallet with the same name. Please input another wallet name."
      );
    } else {
      const wallet = await CreateWallet(tgId, username, walletName);
      const walletAddress = wallet.publicKey.toBase58();

      ctx.replyWithHTML(
        `🎉🎉🎉A new wallet created successfully!🎉🎉🎉\n\n  ${walletName}\n<code>${walletAddress}</code>`,
        Markup.inlineKeyboard([Markup.button.callback("🎊 Done", "wallet")])
      );

      awaitingInput.delete(userId); // Reset the state
    }
  }
});

export default bot;
