import { colWallets } from "../../utils/mongo";
import { CreateWallet } from "../../utils/solana";

export const WalletInfo = async (ctx: any) => {
  const tgId = ctx.from?.id.toString();

  try {
    const walletListItems = await colWallets.find({ tgId }).toArray();
    if (walletListItems.length === 0) {
      return {
        wallets: [],
      };
    }

    const walletList = walletListItems.map(
      (wallet: {
        walletName: string;
        publicKey: string;
        secretKey: Uint8Array;
      }) => ({
        walletName: wallet.walletName,
        publicKey: wallet.publicKey,
        secretKey: wallet.secretKey,
      })
    );

    return {
      tgId,
      wallets: walletList,
    };
  } catch (error) {
    console.error("Failed to list wallets:", error);
    return {
      message: "Failed to retrieve wallet list. Please try again later.",
      wallets: [],
    };
  }
};

export const generateNewWallet = async (ctx: any) => {
  const tgId = ctx.from?.id.toString();
  const username = ctx.from?.username || "";

  if (ctx.session && ctx.session.awaitingWalletName) {
    const walletName = ctx.message.text.trim();
    console.log("input done");
    try {
      const wallet = await CreateWallet(tgId, username, walletName);
      const walletAddress = wallet.publicKey.toBase58();

      delete ctx.session.awaitingWalletName;

      await ctx.reply(
        `Your wallet created successfully!\n\n${walletName}\n ${walletAddress}`
      );
    } catch (error) {
      console.error("Failed to create wallet:", error);
      await ctx.reply(
        "There was an error processing your request. Please try again later."
      );
    }
  } else {
    if (!ctx.session) {
      ctx.session = {}; // Initialize session if not already initialized
    }
    ctx.session.awaitingWalletName = true;
    await ctx.reply("Please input your wallet name:");
  }
};
