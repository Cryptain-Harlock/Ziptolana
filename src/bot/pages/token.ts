import { colTokens } from "../../utils/mongo";
import { CreateToken } from "../../utils/solana";
import { Markup } from "telegraf";

export const TokenInfo = async (ctx: any) => {
  const tgId = ctx.from?.id.toString();

  try {
    const tokenListItems = await colTokens.find({ tgId }).toArray();
    if (tokenListItems.length === 0) {
      return {
        tokens: [],
      };
    }

    const tokenList = tokenListItems.map(
      (tokens: {
        tokenName: string;
        symbol: string;
        decimals: number;
        totalSupply: number;
        tokenDescription: string;
        logoUrl: string;
        mintAddress: string;
      }) => ({
        tokenName: tokens.tokenName,
        tokenSymbol: tokens.symbol,
        tokenDecimals: tokens.decimals,
        tokenTotalSupply: tokens.totalSupply,
        tokenDescription: tokens.tokenDescription,
        // tokenLogoUrl = tokens.logoUrl,
        // tokenMintAddress = tokens.mintAddress,
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

export const ShowTokens = async (ctx: any) => {
  const { tokens } = await TokenInfo(ctx);

  if (tokens.length === 0) {
    await ctx.editMessageText(
      `<i>🔴 No token found!</i>\n\nPlease create a new token...\n`,
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

export const ShowTokenInfo = async (ctx: any, tokenIndex: number) => {
  const { tokens } = await TokenInfo(ctx);

  if (tokens && tokens[tokenIndex]) {
    const token = tokens[tokenIndex];

    await ctx.editMessageText(
      `Home > Token > <b>Token Information</b>\n\n` +
        `<b>${token.tokenName}</b>\n` +
        `<code>${token.publicKey}</code>\n`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🌟 Create Token", "createToken")],
          [
            Markup.button.callback(
              "🔐 Secret Key",
              `secretKey_${token.publicKey}`
            ),
            Markup.button.callback(
              "🗑 Delete Token",
              `delToken_${token.publicKey}`
            ),
          ],
          [Markup.button.callback("🔙 Go Back to Token", "token")],
        ]),
      }
    );
  } else {
    await ctx.reply("Token not found.");
  }
};

const awaitingInput = new Map<number, number>();
const tokenDetails = new Map<number, any>();

const isValidNameOrSymbol = (input: string) =>
  /^[A-Za-z][A-Za-z0-9]*$/.test(input);
const isValidSymbol = (input: string) =>
  /^[A-Za-z][A-Za-z0-9]*$/.test(input) && input.length < 5;
const isValidDecimals = (input: string) =>
  /^\d$/.test(input) && parseInt(input, 10) < 10;
const isValidTotalSupply = (input: string) => /^[1-9]\d*$/.test(input);
// const isValidImage = (input: string) =>

export const CreateTokenBoard = async (ctx: any) => {
  const tgId = ctx.from.id;
  const steps = [
    "Token Name..",
    "Token Symbol..",
    "Token Decimals as number..",
    "Total Supply as number..",
    "Token Description..",
    "Upload token logo image:",
  ];

  let currentStep = awaitingInput.get(tgId) || 0;
  const tokenData = tokenDetails.get(tgId) || {};

  if (currentStep === 0) {
    tokenDetails.set(tgId, {});
    await ctx.reply(steps[currentStep]);
    awaitingInput.set(tgId, currentStep + 1);
  } else {
    const input = ctx.message.text || ctx.message.photo;

    if (currentStep < 5) {
      switch (currentStep) {
        case 1:
          if (!isValidNameOrSymbol(input.toString())) {
            await ctx.reply(
              "Token name should not start with a number or special character. Please try again."
            );
            return;
          }
          tokenData.name = input.toString();
          break;
        case 2:
          if (!isValidSymbol(input.toString())) {
            await ctx.reply(
              "Token symbol should not contain any special characters and be less than 5 characters. Please try again."
            );
            return;
          }
          tokenData.symbol = input.toString().toUpperCase();
          break;
        case 3:
          await ctx.reply(
            Markup.keyboard([
              ["7", "8", "9"],
              ["4", "5", "6"],
              ["1", "2", "3"],
              ["0"],
            ])
              .oneTime()
              .resize()
          );
          if (!isValidDecimals(input.toString())) {
            await ctx.reply(
              "Invalid number for decimals. Please enter a valid number less than 10."
            );
            return;
          }
          tokenData.decimals = parseInt(input, 10);
          break;
        case 4:
          await ctx.reply(
            Markup.keyboard([
              ["7", "8", "9"],
              ["4", "5", "6"],
              ["1", "2", "3"],
              ["0"],
            ])
              .oneTime()
              .resize()
          );
          if (!isValidDecimals(input.toString())) {
            await ctx.reply(
              "Invalid number for total supply. Please enter a valid number that does not start with 0."
            );
            return;
          }
          tokenData.totalSupply = parseInt(input, 10);
          break;
        default:
          break;
      }
      await ctx.reply(steps[currentStep]);
      awaitingInput.set(tgId, currentStep + 1);
    } else if (currentStep === 5) {
      tokenData.description = input.toString();
      await ctx.reply(steps[currentStep]);
      awaitingInput.set(tgId, currentStep + 1);
    } else if (currentStep === 6 && ctx.message.photo) {
      await ctx.reply("Please wait, your token metadata is being processed...");

      try {
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        tokenData.logoUrl = fileId.toString();
      } catch (error) {
        console.error("⚠️ Failed to process image:", error);
        await ctx.reply(
          "There was an error processing the image. Please try again."
        );
      }

      try {
        const newToken = await CreateToken(
          ctx,
          tgId.toString(),
          tokenData.name,
          tokenData.symbol,
          tokenData.decimals,
          tokenData.totalSupply,
          tokenData.description,
          tokenData.logoUrl
        );

        await ctx.replyWithHTML(
          `🎉🎉🎉 Token created successfully!🎉🎉🎉\n` +
            `Token address: <code>${newToken.address}</code>\n\n` +
            `Link: <code>${newToken.tokenMintLink}</code>`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              [Markup.button.callback("🔙 Go Back to Token", "token")],
            ]),
          }
        );
      } catch (error) {
        console.error("⚠️ Failed to create token:", error);
        await ctx.reply(
          "There was an error creating the token. Please try again later."
        );
      } finally {
        awaitingInput.delete(tgId);
        tokenDetails.delete(tgId);
      }
    } else {
      await ctx.reply("Invalid input. Please try again.");
    }
  }
};
