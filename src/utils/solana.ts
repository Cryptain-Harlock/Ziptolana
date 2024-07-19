import * as web3 from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import * as helpers from "@solana-developers/helpers";
import * as meta from "@metaplex-foundation/mpl-token-metadata";
import * as raydium from "@raydium-io/raydium-sdk";
import { colWallets, colTokens, colLiquidities } from "./mongo";
import { resizeImageAndStoreInPinata } from "./upload";

const connection = new web3.Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export const getOrCreateWallet = async (
  tgId: string,
  username: string
): Promise<web3.Keypair> => {
  try {
    let userAccount = await colWallets.findOne({ tgId });
    if (userAccount) {
      console.log(`🟣 ${userAccount.username} has started the bot`);
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
    return balance / web3.LAMPORTS_PER_SOL;
  } catch (error) {
    console.error("Error in getWalletBalance:", error);
    throw new Error("Failed to get wallet balance");
  }
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
    const url = await resizeImageAndStoreInPinata(ctx, fileId);

    let userAccount = await colWallets.findOne({ tgId });
    if (!userAccount) {
      throw new Error("User account not found");
    }

    const payer = web3.Keypair.fromSecretKey(
      Uint8Array.from(userAccount.secretKey)
    );

    const balance = await connection.getBalance(payer.publicKey);
    const minBalance = 0.5 * web3.LAMPORTS_PER_SOL;
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

    const mint = await splToken.createMint(
      connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      decimals
    );

    const tokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      payer.publicKey
    );

    await splToken.mintTo(
      connection,
      payer,
      mint,
      tokenAccount.address,
      payer.publicKey,
      totalSupply
    );

    const tokenCreatedTime = new Date().toISOString();
    // Insert Metadata of Token to MongoDB
    await colTokens.insertOne({
      tgId,
      tokenName,
      symbol,
      decimals,
      totalSupply,
      tokenDescription,
      mintAuthority: userAccount.secretKey,
      freezeAuthority: userAccount.secretKey,
      mintAddress: mint.toBase58(),
      logoUrl: url,
      createdAt: tokenCreatedTime,
    });

    const metadataData = {
      name: tokenName,
      symbol,
      uri: url,
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

    return {
      address: mint.toBase58(),
      tokenAccount: tokenAccount.address.toBase58(),
      tokenMintLink,
      transactionLink,
    };
  } catch (error) {
    console.error("⚠️ Error in CreateToken:", error);
    throw new Error("Failed to create Solana token");
  }
};

export const checkMintStatus = async (mintAddress: string) => {
  try {
    const mint = new web3.PublicKey(mintAddress);
    const mintInfo = await splToken.getMint(connection, mint);
    return mintInfo.mintAuthority !== null ? true : false;
  } catch (error) {
    console.error("Failed to check mint status:", error);
    return "Unknown";
  }
};

export const checkFreezeAuthStatus = async (mintAddress: string) => {
  try {
    const mint = new web3.PublicKey(mintAddress);
    const mintInfo = await splToken.getMint(connection, mint);
    return mintInfo.freezeAuthority !== null ? true : false;
  } catch (error) {
    console.error("Failed to check freeze authority status:", error);
    return "Unknown";
  }
};

export const MintDisable = async (mintAddress: string, payerSecretKey: any) => {
  const payer = web3.Keypair.fromSecretKey(Uint8Array.from(payerSecretKey));
  try {
    const mint = new web3.PublicKey(mintAddress);
    const transaction = new web3.Transaction();
    const mintInfo = await splToken.getMint(connection, mint);

    if (mintInfo.mintAuthority === null) {
      throw new Error("Minting is already disabled for this token.");
    }

    const revokeMintAuthorityInstruction =
      splToken.createSetAuthorityInstruction(
        mint,
        payer.publicKey,
        splToken.AuthorityType.MintTokens,
        null
      );

    transaction.add(revokeMintAuthorityInstruction);

    const signature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [payer],
      {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }
    );

    return signature;
  } catch (error) {
    console.error("Failed to disable minting:", error);
    throw error;
  }
};

export const FreezeAuthority = async (
  mintAddress: string,
  payerSecretKey: any
) => {
  const payer = web3.Keypair.fromSecretKey(Uint8Array.from(payerSecretKey));
  try {
    const mint = new web3.PublicKey(mintAddress);
    const transaction = new web3.Transaction();
    const mintInfo = await splToken.getMint(connection, mint);

    if (mintInfo.freezeAuthority === null) {
      throw new Error("Freeze authority is already disabled for this token.");
    }

    const revokeFreezeAuthorityInstruction =
      splToken.createSetAuthorityInstruction(
        mint,
        payer.publicKey,
        splToken.AuthorityType.FreezeAccount,
        null
      );

    transaction.add(revokeFreezeAuthorityInstruction);

    const signature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [payer],
      {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }
    );

    return signature;
  } catch (error) {
    console.error("Failed to disable freeze authority:", error);
    throw error;
  }
};

const SOL_MINT_ADDRESS = new web3.PublicKey(splToken.NATIVE_MINT);
/*
const CreateAndAddLP = async (mintAddress: string, payerSecretKey: any) => {
  const payer = web3.Keypair.fromSecretKey(Uint8Array.from(payerSecretKey));
  try {
    const solTokenAccount = await splToken.getAssociatedTokenAddress(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      SOL_MINT_ADDRESS,
      payer
    );
    const userTokenAccount = await splToken.getAssociatedTokenAddress(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      mintAddress,
      payer
    );

    const transaction = new web3.Transaction();
    transaction.add(
      splToken.createAssociatedTokenAccountInstruction(
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        splToken.TOKEN_PROGRAM_ID,
        SOL_MINT_ADDRESS,
        solTokenAccount,
        payer.publicKey,
        payer.publicKey
      ),
      splToken.createAssociatedTokenAccountInstruction(
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        splToken.TOKEN_PROGRAM_ID,
        SOL_MINT_ADDRESS,
        solTokenAccount,
        payer.publicKey,
        payer.publicKey
      )
    );
    const poolInstruction = raydium.createPoolInstruction(
      payer.publicKey,
      solTokenAccount,
      userTokenAccount,
      mintAddress,
      SOL_MINT_ADDRESS
    );
    transaction.add(poolInstruction);

    const signature = await connection.sendTransaction(transaction, [payer], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await connection.confirmTransaction(signature, "confirmed");
    console.log(`Liquidity pool created. Transaction signature: ${signature}`);
  } catch (error: any) {
    console.log("Faild to create liquidity pool", error);
  }
};
*/
