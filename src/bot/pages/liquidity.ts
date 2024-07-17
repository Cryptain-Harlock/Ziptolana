import { colLiquidities } from "../../utils/mongo";
// import { AddLiquidity } from "../../utils/solana";
import { Markup } from "telegraf";

export const LPInfo = async (ctx: any) => {
  const tgId = ctx.from?.id.toString();

  try {
    const lpListItems = await colLiquidities.find({ tgId }).toArray();
    if (lpListItems.length === 0) {
      return {
        lps: [],
      };
    }

    const lpList = lpListItems.map((lp: {}) => ({}));

    return {
      tgId,
      lps: lpList,
    };
  } catch (error) {
    console.error("Failed to list liquidities:", error);
    return {
      message: "Failed to retrieve liquidity list. Please try again later.",
      tokens: [],
    };
  }
};

export const ShowLPs = async (ctx: any) => {
  const { lps } = await LPInfo(ctx);
  if (lps.length === 0) {
    await ctx.editMessageText(
      `<i>🔴 No Liquidity Pool found!</i>\n\nPlease create a new LP...\n`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("🏘 Home", "dashboard"),
            Markup.button.callback("💎 Add Liquidity", "addlp"),
          ],
        ]),
      }
    );
  } else {
    const tokenButtons = [];
    for (let i = 0; i < lps.length; i += 2) {
      const row = [];
      row.push(Markup.button.callback(`💧 ${lps[i].tokenName}`, `lp_${i}`));
      if (i + 1 < lps.length) {
        row.push(Markup.button.callback(`💧 ${lps[i + 1]}`, `token_${i + 1}`));
      }
      tokenButtons.push(row);
    }

    await ctx.editMessageText(`Home > <b>Your Tokens:</b>\n\n`, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        ...tokenButtons,
        [
          Markup.button.callback("🏘 Home", "dashboard"),
          Markup.button.callback("💎 Add Liquidity", "addlp"),
        ],
      ]),
    });
  }
};

export const ShowLPInfo = async (ctx: any) => {
  const callbackData = ctx.callbackQuery.data;
  const lpIndex = parseInt(callbackData.split("_")[1]);

  const { lps } = await LPInfo(ctx);

  if (lps.length > lpIndex) {
    const lp = lps[lpIndex];

    await ctx.editMessageText(``, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🔥 Delete Liquidity ",
            `deleteLiquidity_${lpIndex}`
          ),
          Markup.button.callback("🔙 Back", "liquidities"),
        ],
      ]),
    });
  } else {
    await ctx.editMessageText("Token not found.", {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("🏘 Home", "dashboard"),
          Markup.button.callback("💎 Add Liquidity", "addlp"),
        ],
      ]),
    });
  }
};
