import { colWallets, colTokens } from "../../utils/mongo";
import { checkMintStatus, MintDisable, MintEnable } from "../../utils/solana";
import { TokenInfo } from "../../bot/pages/token";
import { Markup } from "telegraf";

const awaitingDisableMintingInput = new Map();
const awaitingEnableMintingInput = new Map();

const ShowTokenStatus = async (ctx: any) => {
  const { tokens } = await TokenInfo(ctx);
  let message = "<b>Your Tokens:</b>\n\n";
  for (const token of tokens) {
    const mintStatus = await checkMintStatus(token.tokenMintAddress);
    message += `${mintStatus} ${token.tokenName}\n<code>${token.tokenMintAddress}</code>\n\n`;
  }
  await ctx.editMessageText(message, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Go Back to Token", "tokens")],
    ]),
  });
};

export const MintDisableBoard = async (ctx: any) => {
  const tgId = ctx.from.id.toString();

  const currentStep = awaitingDisableMintingInput.get(tgId) || 0;
  if (currentStep === 0) {
    await ShowTokenStatus(ctx);
    await ctx.reply(
      `Please input the mint address of the token you want to disable minting for.`
    );
    awaitingDisableMintingInput.set(tgId, 1);
    return;
  }

  const inputMintAddress = ctx.message?.text;

  try {
    if (!colTokens.findOne({ tokenMintAddress: inputMintAddress })) {
      await ctx.reply("Token not found. Please try again.");
      return;
    }

    await ctx.reply("⌛️ Disabling minting process initiated...");
    const userAccount = await colWallets.findOne({ tgId: tgId });
    const payer = userAccount.secretKey;
    const signature = await MintDisable(inputMintAddress, payer);

    await ctx.replyWithHTML(
      `Token minting disabled successfully for:\n` +
        `<code>${inputMintAddress}</code>\n\n` +
        `TX <code>${signature}</code>`,
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
  } finally {
    awaitingDisableMintingInput.delete(tgId);
  }
};

export const MintEnableBoard = async (ctx: any) => {
  const tgId = ctx.from.id.toString();

  const currentStep = awaitingEnableMintingInput.get(tgId) || 0;
  if (currentStep === 0) {
    await ShowTokenStatus(ctx);
    await ctx.reply(
      `Please input the mint address of the token you want to enable minting for.`
    );
    awaitingEnableMintingInput.set(tgId, 1);
    return;
  }

  const inputMintAddress = ctx.message?.text;

  try {
    if (!colTokens.findOne({ tokenMintAddress: inputMintAddress })) {
      await ctx.reply("Token not found. Please try again.");
      return;
    }

    const userAccount = await colWallets.findOne({ tgId: tgId });
    const payer = userAccount.secretKey;
    const newMintAuthority = userAccount.account;

    await ctx.reply("⌛️ Enabling minting process initiated...");
    const signature = await MintEnable(
      inputMintAddress,
      payer,
      newMintAuthority
    );

    await ctx.replyWithHTML(
      `Token minting enabled successfully for:\n` +
        `<code>${inputMintAddress}</code>\n\n` +
        `New Authority: <code>${newMintAuthority}</code>\n\n` +
        `TX <code>${signature}</code>`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Go Back to Token", "tokens")],
        ]),
      }
    );
  } catch (error) {
    console.error("⚠️ Failed to enable minting:", error);
    await ctx.reply("Failed to enable minting. Please try again later.");
  } finally {
    awaitingEnableMintingInput.delete(tgId);
  }
};
