import { colTokens, colWallets } from "../../utils/mongo";
import {
  getTokenAmount,
  getTokenCreatedByOwner,
  CreateToken,
  checkMintStatus,
  MintDisable,
  checkFreezeAuthStatus,
  FreezeAuthority,
} from "../../utils/solana";
import { askForConfirmation } from "./confirm";
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
      (token: {
        tokenName: string;
        symbol: string;
        decimals: number;
        totalSupply: number;
        tokenDescription: string;
        logoUrl: string;
        mintAddress: string;
      }) => ({
        tokenName: token.tokenName,
        tokenSymbol: token.symbol,
        tokenDecimals: token.decimals,
        tokenTotalSupply: token.totalSupply,
        tokenDescription: token.tokenDescription,
        tokenLogoUrl: token.logoUrl,
        tokenMintAddress: token.mintAddress,
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
  const tgId = ctx.from.id;
  try {
    const userAccount = await colWallets.findOne({ tgId: tgId.toString() });
    if (!userAccount || !userAccount.account) {
      throw new Error("User account not found or invalid.");
    }

    const { tokens } = await TokenInfo(ctx);
    // const tokens = await getTokenCreatedByOwner(userAccount.account);
    if (!tokens || tokens.length === 0) {
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
      // GET TOKENS METADATA FROM OWNER'S WALLET
      // let tokenAmountBoard = "";
      // for (let i = 0; i < tokens.length; i++) {
      //   const tokenAmount = await getTokenAmount(
      //     userAccount.account.toString(),
      //     tokens[i].mintAddress
      //   );
      //   if (tokenAmount !== undefined) {
      //     tokenAmountBoard += `💸 ${tokens[i].tokenName}    |    ${tokenAmount} ${tokens[i].symbol}\n\n`;
      //   } else {
      //     tokenAmountBoard += `💸 ${tokens[i].tokenName}    |    N/A ${tokens[i].symbol}\n\n`;
      //   }
      // }

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

      await ctx.editMessageText(
        `Home > <b>Your Tokens:</b>\n\n\n`,
        // `${tokenAmountBoard}`,
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            ...tokenButtons,
            [
              Markup.button.callback("🏘 Home", "dashboard"),
              Markup.button.callback("🌟 Create Token", "createToken"),
            ],
          ]),
        }
      );
    }
  } catch (error: any) {
    console.error("Failed to show token info:", error);
    await ctx.reply("Failed to retrieve token info. Please try again later.");
  }
};

export const ShowTokenInfo = async (ctx: any) => {
  const tgId = ctx.from?.id.toString();
  try {
    const callbackData = ctx.callbackQuery.data;
    const tokenIndex = parseInt(callbackData.split("_")[1]);

    const { tokens } = await TokenInfo(ctx);
    const userAccount = await colWallets.findOne({ tgId: tgId });
    if (tokens.length > tokenIndex) {
      const token = tokens[tokenIndex];
      const tokenAmount = await getTokenAmount(
        userAccount.account,
        token.tokenMintAddress
      );

      const freezeAuthStatusMark = (await checkFreezeAuthStatus(
        token.tokenMintAddress
      ))
        ? "🔥 Authority is alive"
        : "❄️ Authority is frozen";
      const freezeAuthButton = (await checkFreezeAuthStatus(
        token.tokenMintAddress
      ))
        ? Markup.button.callback(
            "❄️ Freeze Authority",
            `freezeAuth_${tokenIndex}`
          )
        : null;
      const mintStatusMark = (await checkMintStatus(token.tokenMintAddress))
        ? "🔵 Mint Enabled"
        : "🔴 Mint Disabled";
      const mintButton = (await checkMintStatus(token.tokenMintAddress))
        ? Markup.button.callback(
            "🔴 Disable Minting",
            `mintDisable_${tokenIndex}`
          )
        : null;

      await ctx.editMessageText(
        `${freezeAuthStatusMark}    |    ${mintStatusMark}\n\n` +
          `<b>${token.tokenName}    |    ${token.tokenSymbol}</b>\n` +
          `<i>(${token.tokenDescription})</i>\n\n` +
          `<b>Decimals:</b>    <code>${token.tokenDecimals}</code>\n` +
          `<b>Total Supply:</b>    <code>${
            token.tokenTotalSupply / Math.pow(10, token.tokenDecimals)
          }</code> / <code>${tokenAmount}</code> <i>you have</i>\n` +
          `<b>Mint Address:</b> <code>${token.tokenMintAddress}</code>\n\n` +
          `Logo: ${token.tokenLogoUrl}\n`,
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [
              ...(mintButton ? [mintButton] : []),
              ...(freezeAuthButton ? [freezeAuthButton] : []),
            ],
            [Markup.button.callback("🔙 Back", "tokens")],
          ]),
        }
      );
    } else {
      await ctx.editMessageText("Token not found.", {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("🏘 Home", "dashboard"),
            Markup.button.callback("🌟 Create Token", "createToken"),
          ],
        ]),
      });
    }
  } catch (error: any) {
    console.error("Failed to show token info:", error);
    await ctx.reply("Failed to retrieve token info. Please try again later.");
  }
};

const awaitingTokenCreationInput = new Map();
const tokenDetails = new Map();

const isValidNameOrSymbol = (input: string) =>
  /^[A-Za-z][A-Za-z0-9 ]*$/.test(input);
const isValidSymbol = (input: string) =>
  /^[A-Za-z][A-Za-z0-9]*$/.test(input) && input.length < 5;
const isValidDecimals = (input: string) =>
  /^\d$/.test(input) && parseInt(input, 10) < 10;
const isValidTotalSupply = (input: string) =>
  /^\d+$/.test(input) && parseInt(input, 10) > 0;

export const CreateTokenBoard = async (ctx: any) => {
  const tgId = ctx.from.id;
  const steps = [
    "1. Token Name:",
    "2. Token Symbol:",
    "3. Token Decimals as a number:",
    "4. Total Supply as a number:",
    "5. Token Description:",
    "6. Upload token logo image:",
  ];

  let currentStep = awaitingTokenCreationInput.get(tgId) || 0;
  const tokenData = tokenDetails.get(tgId) || {};

  if (currentStep === 0) {
    tokenDetails.set(tgId, {});
    await ctx.reply(steps[currentStep]);
    awaitingTokenCreationInput.set(tgId, currentStep + 1);
  } else {
    const input = ctx.message.text || ctx.message.photo;

    if (currentStep < 6) {
      switch (currentStep) {
        case 1:
          if (!isValidNameOrSymbol(input.toString())) {
            await ctx.reply(
              "🟡 Token name should not start with a number or special character. Please try again."
            );
            return;
          }
          tokenData.name = input.toString();
          break;
        case 2:
          if (!isValidSymbol(input.toString())) {
            await ctx.reply(
              "🟡 Token symbol should not contain any special characters and be less than 5 characters. Please try again."
            );
            return;
          }
          tokenData.symbol = input.toString().toUpperCase();
          break;
        case 3:
          if (!isValidDecimals(input.toString())) {
            await ctx.reply(
              "🟡 Invalid number for decimals. Please enter a valid number less than 10."
            );
            return;
          }
          tokenData.decimals = parseInt(input, 10);
          break;
        case 4:
          if (!isValidTotalSupply(input.toString())) {
            await ctx.reply(
              "🟡 Invalid number for total supply. Please enter a valid number that does not start with 0."
            );
            return;
          }
          tokenData.totalSupply = parseInt(input, 10);
          break;
        case 5:
          tokenData.description = input.toString();
          break;
        default:
          break;
      }
      await ctx.reply(steps[currentStep]);
      awaitingTokenCreationInput.set(tgId, currentStep + 1);
    } else if (currentStep === 6 && ctx.message.photo) {
      await ctx.reply(
        "⌛️ Please wait, your token metadata is being processed..."
      );

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
          `🎉🎉🎉 Token created successfully!🎉🎉🎉\n\n` +
            `Token address: <a href='${newToken.transactionLink}'>TX</a>` +
            `<code>${newToken.address}</code>\n\n` +
            `Link: <a>${newToken.tokenMintLink}</a>`,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              [Markup.button.callback("🔙 Go Back to Token", "tokens")],
            ]),
          }
        );
      } catch (error) {
        console.error("⚠️ Failed to create token:", error);
        await ctx.reply(
          "There was an error creating the token. Please try again later."
        );
      } finally {
        awaitingTokenCreationInput.delete(tgId);
        tokenDetails.delete(tgId);
      }
    } else {
      await ctx.reply("Invalid input. Please try again.");
    }
  }
};

export const MintDisableBoard = async (ctx: any) => {
  const callbackData = ctx.callbackQuery.data;
  const tokenIndex = parseInt(callbackData.split("_")[1]);

  const { tokens } = await TokenInfo(ctx);
  const token = tokens[tokenIndex];

  await askForConfirmation(ctx, "mintDisable", token.tokenMintAddress);
};

export const MintDisableConfirmed = async (
  ctx: any,
  tokenMintAddress: string
) => {
  const tgId = ctx.from.id.toString();

  try {
    await ctx.editMessageText("⌛️ Disabling minting process initiated...");
    const userAccount = await colWallets.findOne({ tgId: tgId });
    const payer = userAccount.secretKey;
    const signature = await MintDisable(tokenMintAddress, payer);

    await ctx.editMessageText(
      `Token minting disabled successfully for:\n` +
        `<code>${tokenMintAddress}</code>\n\n` +
        `Signature<code>${signature}</code>`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Go Back to Token", "tokens")],
        ]),
      }
    );
  } catch (error) {
    console.error("⚠️ Failed to disable minting:", error);
    await ctx.reply("Failed to disable minting. Please try again later.");
  }
};

export const FreezeAuthBoard = async (ctx: any) => {
  const callbackData = ctx.callbackQuery.data;
  const tokenIndex = parseInt(callbackData.split("_")[1]);

  const { tokens } = await TokenInfo(ctx);
  const token = tokens[tokenIndex];

  await askForConfirmation(ctx, "freezeAuth", token.tokenMintAddress);
};

export const FreezeAuthConfirmed = async (
  ctx: any,
  tokenMintAddress: string
) => {
  const tgId = ctx.from.id.toString();

  try {
    await ctx.editMessageText("⌛️ Freezing authority process initiated...");
    const userAccount = await colWallets.findOne({ tgId: tgId });
    const payer = userAccount.secretKey;
    const signature = await FreezeAuthority(tokenMintAddress, payer);

    await ctx.editMessageText(
      `Authority freezed successfully for:\n` +
        `<code>${tokenMintAddress}</code>\n\n` +
        `Signature<code>${signature}</code>`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Go Back to Token", "tokens")],
        ]),
      }
    );
  } catch (error) {
    console.error("⚠️ Failed to freeze authority:", error);
    await ctx.reply("Failed to freeze authority. Please try again later.");
  }
};
