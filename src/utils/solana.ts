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
    console.error("⚠️ Error in CreateWallet:", error);
    throw new Error("Failed to get or create Wallet");
  }
};

export const CreateToken = async (
  trId: string,
  walletName: string,
  tokenName: string,
  tokenSymbol: string,
  tokenDecimals: number,
  tokenAmount: number
) => {
  try {
    let token = await colTokens.findOne({});
    if (token) {
      console.log("🔴 Token was duplicated: ", token);
      return token;
    } else {
      const newToken = web3.Keypair.generate();
      const createdTime = new Date().toISOString(); // Get the current time in GMT
      await colTokens.insertOne({
        publicKey: newToken.publicKey.toBase58(),
        secretKey: Array.from(newToken.secretKey),
        createdAt: createdTime,
      });
      console.log("✅ A new token created and stored in DB:");
      return newToken;
    }
  } catch (error) {
    console.error("⚠️ Error in getOrCreateSolanaAccount:", error);
    throw new Error("Failed to get or create Solana account");
  }
};
