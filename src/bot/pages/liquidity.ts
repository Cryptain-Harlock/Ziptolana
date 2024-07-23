import { colLiquidities, colTokens, colWallets } from "../../utils/mongo";
import { TokenInfo } from "./token";
import { getTokenAmount, CreateAndAddLP } from "../../utils/solana";
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
            Markup.button.callback("💎 Add Liquidity", "addLP"),
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
          Markup.button.callback("💎 Add Liquidity", "addLP"),
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
          Markup.button.callback("💎 Add Liquidity", "addLP"),
        ],
      ]),
    });
  }
};

const awaitingLPCreationInput = new Map();
const lpDetails = new Map();

const isValidTokenAmount = (input: string) =>
  /^\d$/.test(input) && parseFloat(input) > 0;
const isValidSOLAmount = (input: string) =>
  /^\d$/.test(input) && parseFloat(input) > 0;

export const AddLPBoard = async (ctx: any) => {
  const tgId = ctx.from?.id.toString();
  const lpSteps = ["Token list", "Initial token amount", "Initial SOL amount"];

  let currentLPStep = awaitingLPCreationInput.get(tgId) || 0;
  const lpData = lpDetails.get(tgId) || {};

  const { tokens } = await TokenInfo(ctx);
  const userAccount = await colWallets.findOne({ tgId: tgId });

  if (currentLPStep === 0) {
    lpDetails.set(tgId, {});
    if (!tokens || tokens.length === 0) {
      await ctx.reply(
        "🟡 No tokens found in your account. Please create a token first."
      );
      return;
    }

    let tokenListMessage = `Click any address to copy for creating and adding liquidity:\n\n`;
    for (let i = 0; i < tokens.length; i++) {
      let tokenAmount = await getTokenAmount(
        userAccount.account,
        tokens[i].tokenMintAddress
      );
      tokenListMessage +=
        `${i + 1}. ${tokens[i].tokenName}    |    ` +
        `<code>${tokenAmount}</code>  ${tokens[i].tokenSymbol}  you have\n` +
        `<code>${tokens[i].tokenMintAddress}</code>\n\n`;
    }

    await ctx.replyWithHTML(tokenListMessage);
    awaitingLPCreationInput.set(tgId, currentLPStep + 1);
  } else {
    const inputLP = ctx.message.text;

    if (currentLPStep < 4) {
      switch (currentLPStep) {
        case 1:
          if (!(await colTokens.findOne({ mintAddress: inputLP.toString() }))) {
            await ctx.reply(
              "🟡 Cannot find mint address from your account. Please try again."
            );
            return;
          }
          lpData.quoteMintAddress = inputLP.toString();
          lpDetails.set(tgId, lpData);
          break;
        case 2:
          // if (!isValidTokenAmount(inputLP.toString())) {
          //   await ctx.reply("🟡 Invalid token amount. Please try again.");
          //   return;
          // }
          lpData.quoteAmount = inputLP;
          lpDetails.set(tgId, lpData);
          break;
        case 3:
          // if (!isValidSOLAmount(inputLP.toString())) {
          //   await ctx.reply("🟡 Invalid SOL amount. Please try again.");
          //   return;
          // }
          lpData.solAmount = inputLP;
          lpDetails.set(tgId, lpData);
          await ctx.reply(
            "⌛️ Please wait, your token metadata is being processed..."
          );

          try {
            const newLP = await CreateAndAddLP(
              tgId,
              lpData.quoteMintAddress,
              lpData.quoteAmount,
              lpData.solAmount
            );

            await ctx.replyWithHTML(
              `🎉🎉🎉 Liquidity created successfully!🎉🎉🎉\n\n` +
                `
              ${newLP.transactionLink}`,
              {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([
                  [
                    Markup.button.callback(
                      "🔙 Go Back to Liquidity",
                      "liquidity"
                    ),
                  ],
                ]),
              }
            );
          } catch (error) {
            console.error("⚠️ Failed to create and add liquidity:", error);
            await ctx.reply(
              "There was an error creating and adding liquidity. Please try again later."
            );
          } finally {
            awaitingLPCreationInput.delete(tgId);
            lpDetails.delete(tgId);
          }
          return;
        default:
          await ctx.reply("Invalid input. Please try again.");
          return;
      }

      await ctx.reply(lpSteps[currentLPStep]);
      awaitingLPCreationInput.set(tgId, currentLPStep + 1);
    }
  }
};
