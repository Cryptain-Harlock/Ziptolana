import * as web3 from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import * as helpers from "@solana-developers/helpers";
import fetch from "node-fetch";
import sharp from "sharp";
import * as meta from "@metaplex-foundation/mpl-token-metadata";
import { colWallets, colTokens, colLiquidities } from "./mongo";

const connection = new web3.Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

export const getOrCreateWallet = async (
  tgId: string,
  username: string
): Promise<web3.Keypair> => {
  try {
    let userAccount = await colWallets.findOne({ tgId });
    if (userAccount) {
      console.log("User account found in DB:", userAccount);
      return web3.Keypair.fromSecretKey(Uint8Array.from(userAccount.secretKey));
    } else {
      const newAccount = web3.Keypair.generate();
      const currentTime = new Date().toISOString(); // Get the current time in GMT
      await colWallets.insertOne({
        tgId,
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

export const getWalletBalance = async (
  publicKey: web3.PublicKey
): Promise<number> => {
  try {
    const balance = await connection.getBalance(publicKey);
    return balance / web3.LAMPORTS_PER_SOL; // Return balance in SOL
  } catch (error) {
    console.error("Error in getWalletBalance:", error);
    throw new Error("Failed to get wallet balance");
  }
};

const resizeImageAndStoreInMongoDB = async (
  ctx: any,
  fileId: string
): Promise<{ url: string; base64Image: string }> => {
  const fileLink = await ctx.telegram.getFileLink(fileId);
  const response = await fetch(fileLink.href);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const resizedBuffer = await sharp(buffer).resize(256, 256).jpeg().toBuffer();
  const base64Image = resizedBuffer.toString("base64");
  const url = `data:image/jpeg;base64,${base64Image}`;
  return { url, base64Image };
};

export const CreateToken = async (
  ctx: any,
  tgId: string,
  tokenName: string,
  symbol: string,
  decimals: number,
  totalSupply: number,
  tokenDescription: string,
  fileId: string
) => {
  try {
    const { url, base64Image } = await resizeImageAndStoreInMongoDB(
      ctx,
      fileId
    );

    let userAccount = await colWallets.findOne({ tgId });
    if (!userAccount) {
      throw new Error("User account not found");
    }

    const payer = web3.Keypair.fromSecretKey(
      Uint8Array.from(userAccount.secretKey)
    );

    // Check wallet balance
    const balance = await connection.getBalance(payer.publicKey);
    const minBalance = 0.5 * web3.LAMPORTS_PER_SOL; // 0.5 SOL in lamports
    if (balance < minBalance) {
      await ctx.reply(
        `⚠️ Minimum balance of SOL to deploy token is 0.5. Please charge your wallet and try again.\nYour wallet: ${
          balance / web3.LAMPORTS_PER_SOL
        } SOL`
      );
      throw new Error(
        "Insufficient SOL balance to create token. Minimum 0.5 SOL required."
      );
    }

    // Create a new token mint
    const mint = await splToken.createMint(
      connection,
      payer,
      payer.publicKey,
      null,
      decimals
    );

    // Create an associated token account for the payer
    const tokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      payer.publicKey
    );

    // Mint the initial supply to the payer's token account
    await splToken.mintTo(
      connection,
      payer,
      mint,
      tokenAccount.address,
      payer.publicKey,
      totalSupply
    );

    // Store the token details in the database
    const tokenCreatedTime = new Date().toISOString(); // Get the current time in GMT
    await colTokens.insertOne({
      tgId,
      tokenName,
      symbol,
      decimals,
      totalSupply,
      tokenDescription,
      mintAddress: mint.toBase58(),
      logoUrl: url,
      logoImage: base64Image,
      createdAt: tokenCreatedTime,
    });

    const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey(
      "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
    );

    const metadataData = {
      name: tokenName,
      symbol,
      uri: "https://arweave.net/1234",
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    };

    const metadataPDAAndBump = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const metadataPDA = metadataPDAAndBump[0];

    const transaction = new web3.Transaction();

    const createMetadataAccountInstruction =
      meta.createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataPDA,
          mint,
          mintAuthority: payer.publicKey,
          payer: payer.publicKey,
          updateAuthority: payer.publicKey,
        },
        {
          createMetadataAccountArgsV3: {
            collectionDetails: null,
            data: metadataData,
            isMutable: true,
          },
        }
      );

    transaction.add(createMetadataAccountInstruction);

    const transactionSignature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [payer]
    );

    const transactionLink = helpers.getExplorerLink(
      "transaction",
      transactionSignature,
      "devnet"
    );

    console.log(
      `✅ Transaction confirmed, explorer link is: ${transactionLink}!`
    );

    const tokenMintLink = helpers.getExplorerLink(
      "address",
      mint.toBase58(),
      "devnet"
    );

    console.log(`✅ Look at the token mint again: ${tokenMintLink}!`);

    console.log("✅ A new token created and stored in DB:", mint.toBase58());

    return {
      address: mint.toBase58(),
      tokenAccount: tokenAccount.address.toBase58(),
      tokenMintLink,
    };
  } catch (error) {
    console.error("⚠️ Error in CreateToken:", error);
    throw new Error("Failed to create Solana token");
  }
};
