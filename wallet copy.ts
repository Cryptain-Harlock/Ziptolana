import { Context, Markup } from "telegraf";
import { Collection } from "mongodb";
import * as web3 from "@solana/web3.js";

let userAccountsCollection: Collection;

export const setUserAccountsCollection = (collection: Collection) => {
  userAccountsCollection = collection;
};

export const displayWalletInfo = async (ctx: Context) => {
  const userId = ctx.from?.id.toString();

  if (!userId) {
    ctx.reply("Unable to identify user.");
    return;
  }

  try {
    const userAccount = await userAccountsCollection.findOne({ userId });
    if (!userAccount) {
      ctx.reply("User account not found.");
      return;
    }

    const publicKey = userAccount.account;
    const secretKey = userAccount.secretKey.join(", ");

    await ctx.editMessageText(
      `<b>Your Wallet Information:</b>\n\n<b>Public Key:</b>\n<code>${publicKey}</code>\n\n<b>Secret Key:</b>\n<code>${secretKey}</code>`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Go Back", "goBack")],
        ]),
      }
    );
  } catch (error) {
    console.error("Failed to display wallet info:", error);
    ctx.reply("Failed to retrieve wallet information. Please try again later.");
  }
};
