import { Markup } from "telegraf";

const Dashboard = async (ctx: any, firstName: string, userAccount: string) => {
  await ctx.editMessageText(
    `Hi, <b>${firstName}</b>. Welcome to Ziptos on Solana!\n\nYour Solana Account:\n<code>${userAccount}</code>\n\n`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("💫 Refresh Balance", "refreshBalance")],
        [Markup.button.callback("🗝 Wallet", "wallet")],
        [Markup.button.callback("💰 Token", "tokens")],
        [Markup.button.callback("💎 Liquidity", "liquidities")],
        [
          Markup.button.callback("❔ FAQ", "faq"),
          Markup.button.callback("💬 Support", "support"),
        ],
      ]),
    }
  );
};

export default Dashboard;
