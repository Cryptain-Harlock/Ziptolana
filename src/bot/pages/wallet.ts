import { colWallets } from "../../utils/mongo";

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
      (wallet: { walletName: string; publicKey: string }) => ({
        walletName: wallet.walletName,
        publicKey: wallet.publicKey,
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
