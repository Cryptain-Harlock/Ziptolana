import { Markup } from "telegraf";

const Dashboard = async (ctx: any) => {
  const firstName = ctx.from?.first_name || "there";
  const userame = ctx.from?.username || "";

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
};

export default Dashboard;
