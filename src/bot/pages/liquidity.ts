import { colTokens, colLiquidities } from "../../utils/mongo";
import { CreateLiquidityPool } from "../../utils/solana";
import { Markup } from "telegraf";

export const LiquidityInfo = async (ctx: any) => {
  const tgId = ctx.from?.id.toString();

  try {
    const tokenListItems = await colTokens.find({ tgId }).toArray();
    if (tokenListItems.length === 0) {
      return {
        tokens: [],
      };
    }

    const tokenList = tokenListItems.map(
      (tokens: { tokenName: string; mintAddress: string }) => ({
        tokenName: tokens.tokenName,
        mintAddress: tokens.mintAddress,
      })
    );

    return {
      tgId,
      tokens: tokenList,
    };
  } catch (error) {
    console.error("Failed to list tokens:", error);
    return {
      message: "Failed to retrieve token list. Please try again later.",
      tokens: [],
    };
  }
};

export const ShowLiquidityOptions = async (ctx: any) => {
  const { tokens } = await LiquidityInfo(ctx);

  if (tokens.length === 0) {
    await ctx.editMessageText(
      `<i>🔴 No token found!</i>\n\nPlease create a new token to provide liquidity...\n`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("🏘 Home", "dashboard"),
            Markup.button.callback("🌟 Create Token", "createToken"),
          ],
        ]),
      }
    );
  } else {
    const tokenButtons = [];
    for (let i = 0; i < tokens.length; i += 2) {
      const row = [];
      row.push(
        Markup.button.callback(`💵 ${tokens[i].tokenName}`, `token_${i}`)
      );
      if (i + 1 < tokens.length) {
        row.push(
          Markup.button.callback(
            `💵 ${tokens[i + 1].tokenName}`,
            `token_${i + 1}`
          )
        );
      }
      tokenButtons.push(row);
    }

    await ctx.editMessageText(`Home > <b>Your Tokens:</b>\n\n`, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        ...tokenButtons,
        [
          Markup.button.callback("🏘 Home", "dashboard"),
          Markup.button.callback("🌟 Create Token", "createToken"),
        ],
      ]),
    });
  }
};

const awaitingInput = new Map<number, number>();
const liquidityDetails = new Map<number, any>();

export const CreateLiquidityBoard = async (ctx: any, tokenIndex: number) => {
  const tgId = ctx.from.id;
  const steps = [
    "Enter the amount of your token to provide:",
    "Enter the amount of SOL to pair with your token:",
  ];

  let currentStep = awaitingInput.get(tgId) || 0;
  const liquidityData = liquidityDetails.get(tgId) || {};

  if (currentStep === 0) {
    liquidityDetails.set(tgId, { tokenIndex });
    await ctx.reply(steps[currentStep]);
    awaitingInput.set(tgId, currentStep + 1);
  } else {
    const input = ctx.message.text;

    if (currentStep === 1) {
      liquidityData.tokenAmount = parseFloat(input);
      await ctx.reply(steps[currentStep]);
      awaitingInput.set(tgId, currentStep + 1);
    } else if (currentStep === 2) {
      liquidityData.solAmount = parseFloat(input);
      const { tokens } = await LiquidityInfo(ctx);
      const selectedToken = tokens[liquidityData.tokenIndex];

      await ctx.reply("Please wait, your liquidity pool is being created...");

      try {
        const newLiquidityPool = await CreateLiquidityPool(
          ctx,
          tgId.toString(),
          selectedToken.mintAddress,
          liquidityData.tokenAmount,
          liquidityData.solAmount
        );

        await ctx.replyWithHTML(
          `🎉🎉🎉 Liquidity pool created successfully!🎉🎉🎉\n` +
            `Transaction link: <a href="${newLiquidityPool.transactionLink}">${newLiquidityPool.transactionLink}</a>\n\n` +
            `Liquidity Pool Address: <code>${newLiquidityPool.lpAddress}</code>`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              [Markup.button.callback("🔙 Go Back", "dashboard")],
            ]),
          }
        );
      } catch (error) {
        console.error("⚠️ Failed to create liquidity pool:", error);
        await ctx.reply(
          "There was an error creating the liquidity pool. Please try again later."
        );
      } finally {
        awaitingInput.delete(tgId);
        liquidityDetails.delete(tgId);
      }
    } else {
      await ctx.reply("Invalid input. Please try again.");
    }
  }
};
