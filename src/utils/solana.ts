import * as web3 from "@solana/web3.js";
import { colWallets, colTokens, colLiquidities } from "./mongo";

const connection = new web3.Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

export const CreateWallet = async (
  tgId: string,
  username: string,
  walletName: string
): Promise<web3.Keypair> => {
  try {
    let wallet = await colWallets.findOne({ tgId, walletName });
    if (wallet) {
      console.log("🔴 Wallet name was duplicated: ", walletName);
      return web3.Keypair.fromSecretKey(Uint8Array.from(wallet.secretKey));
    } else {
      const newWallet = web3.Keypair.generate();
      const createdTime = new Date().toISOString(); // Get the current time in GMT
      await colWallets.insertOne({
        tgId,
        username: `@${username}`,
        walletName,
        publicKey: newWallet.publicKey.toBase58(),
        secretKey: Array.from(newWallet.secretKey),
        createdAt: createdTime,
      });
      console.log("✅ A new wallet created and stored in DB:");
      return newWallet;
    }
  } catch (error) {
    console.error("⚠️ Error in getOrCreateSolanaAccount:", error);
    throw new Error("Failed to get or create Solana account");
  }
};
