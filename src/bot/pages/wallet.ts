import * as web3 from "@solana/web3.js";
import { Markup } from "telegraf";
import { colWallets } from "../../utils/mongo";
import { getWalletBalance } from "../../utils/solana";

const WalletInfo = async (ctx: any) => {
  const tgId = ctx.from?.id.toString();
  const account = await colWallets.findOne({ tgId });

  if (!account) {
    return {
      message: "No wallet found.",
      account: null,
      balance: 0,
    };
  }

  const userAccount = account.account || "";
  const balance = await getWalletBalance(new web3.PublicKey(userAccount));
  return {
    account: userAccount,
    secretKey: account.secretKey,
    balance,
  };
};

export const ShowWalletInfo = async (ctx: any) => {
  const { account, balance } = await WalletInfo(ctx);
  if (!account) {
    await ctx.reply("No wallet found.");
    return;
  }

  await ctx.editMessageText(
    `Home > <b>Wallet Information</b>\n\n` +
      `Address:    |    <i>${balance}</i>  SOL\n<code>${account}</code>\n\n` +
      ``,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("🏘 Home", "dashboard"),
          Markup.button.callback("🔐 Secret Key", `secretKey`),
        ],
      ]),
    }
  );
};

export const ShowSecretKey = async (ctx: any) => {
  const { secretKey } = await WalletInfo(ctx);

  if (!secretKey) {
    await ctx.reply("No secret key found.");
    return;
  }

  await ctx.editMessageText(
    `... Wallet Information > <b>Secret Key:</b>\n\n<code>${Uint8Array.from(
      secretKey
    )}</code>`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Done", "wallet")]]),
    }
  );
};
