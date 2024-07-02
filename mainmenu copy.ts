import { Context, Markup } from "telegraf";

export const mainMenu = async (
  ctx: Context,
  firstName: string,
  userAddress: string
) => {
  await ctx.editMessageText(
    `Hi, <b>${firstName}</b>. Welcome to Ziptos on Solana!\n\nYour Solana Account:\n<code>${userAddress}</code>`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
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
      ]),
    }
  );
};
