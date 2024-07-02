import { mainMenu } from "./mainmenu"; // Ensure this matches the exact file name casing
import { Context } from "telegraf";
import { Collection } from "mongodb";
import * as web3 from "@solana/web3.js";

let userAccountsCollection: Collection;

export const setUserAccountsCollection = (collection: Collection) => {
  userAccountsCollection = collection;
};

const getOrCreateSolanaAccount = async (
  userId: string,
  username: string
): Promise<web3.Keypair> => {
  try {
    let userAccount = await userAccountsCollection.findOne({ userId });
    if (userAccount) {
      console.log("User account found in DB:", userAccount);
      return web3.Keypair.fromSecretKey(Uint8Array.from(userAccount.secretKey));
    } else {
      const newAccount = web3.Keypair.generate();
      const currentTime = new Date().toISOString(); // Get the current time in GMT
      await userAccountsCollection.insertOne({
        userId,
        username: `@${username}`,
        account: newAccount.publicKey.toBase58(),
        secretKey: Array.from(newAccount.secretKey),
        createdAt: currentTime,
      });
      console.log(
        "New user account created and stored in DB:",
        newAccount.publicKey.toBase58()
      );
      return newAccount;
    }
  } catch (error) {
    console.error("Error in getOrCreateSolanaAccount:", error);
    throw new Error("Failed to get or create Solana account");
  }
};

export const goBack = async (ctx: Context) => {
  const userId = ctx.from?.id.toString();
  const username = ctx.from?.username || "";
  const firstName = ctx.from?.first_name || "there";

  if (!userId) {
    ctx.reply("Unable to identify user.");
    return;
  }

  try {
    const userAccount = await getOrCreateSolanaAccount(userId, username);
    const userAddress = userAccount.publicKey.toBase58();

    await mainMenu(ctx, firstName, userAddress);
  } catch (error) {
    console.error("Failed to handle goBack action:", error);
    ctx.reply(
      "There was an error processing your request. Please try again later."
    );
  }
};
