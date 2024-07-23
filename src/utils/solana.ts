import * as web3 from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import * as helpers from "@solana-developers/helpers";
import * as meta from "@metaplex-foundation/mpl-token-metadata";
import * as raydium from "@raydium-io/raydium-sdk";
import { BN } from "bn.js";
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

export const getTokenCreatedByOwner = async (walletAddress: string) => {
  try {
    const walletPublicKey = new web3.PublicKey(walletAddress);
    const tokenAccounts = await connection.getTokenAccountsByOwner(
      walletPublicKey,
      { programId: splToken.TOKEN_PROGRAM_ID }
    );

    const tokenInfoPromises = tokenAccounts.value.map(async (accountInfo) => {
      const accountData = await splToken.getAccount(
        connection,
        accountInfo.pubkey
      );
      const mintAddress = accountData.mint;
      const mintData = await splToken.getMint(connection, mintAddress);

      return {
        tokenAccount: accountInfo.pubkey.toBase58(),
        mintAddress: mintAddress.toBase58(),
        amount: accountData.amount.toString(),
        decimals: mintData.decimals,
        supply: mintData.supply.toString(),
        isInitialized: mintData.isInitialized,
        freezeAuthority: mintData.freezeAuthority?.toBase58(),
        mintAuthority: mintData.mintAuthority?.toBase58(),
      };
    });

    return Promise.all(tokenInfoPromises);
  } catch (error) {
    console.error("Failed to get tokens created by wallet:", error);
    throw new Error("Failed to get tokens created by wallet");
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

export const getTokenAmount = async (
  userAccount: string,
  mintAddress: string
) => {
  try {
    const userWallet = new web3.PublicKey(userAccount);
    const tokenMint = new web3.PublicKey(mintAddress);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      userWallet,
      { mint: tokenMint }
    );

    if (tokenAccounts.value.length === 0) {
      console.log("No token account found for this wallet");
      return;
    }

    const tokenAccount = tokenAccounts.value[0];
    if (
      !tokenAccount ||
      !tokenAccount.account ||
      !tokenAccount.account.data ||
      !tokenAccount.account.data.parsed ||
      !tokenAccount.account.data.parsed.info ||
      !tokenAccount.account.data.parsed.info.tokenAmount
    ) {
      throw new Error("Invalid token account data");
    }

    const tokenAmount =
      tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
    return tokenAmount;
  } catch (error) {
    console.error("Failed to get token amount:", error);
    throw new Error("Failed to get token amount");
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
  try {
    const mint = new web3.PublicKey(mintAddress);
    const payer = web3.Keypair.fromSecretKey(Uint8Array.from(payerSecretKey));
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

async function getWalletTokenAccount(
  connection: web3.Connection,
  wallet: web3.PublicKey
): Promise<raydium.TokenAccount[]> {
  const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
    programId: raydium.TOKEN_PROGRAM_ID,
  });
  return walletTokenAccount.value.map((i) => ({
    pubkey: i.pubkey,
    programId: i.account.owner,
    accountInfo: raydium.SPL_ACCOUNT_LAYOUT.decode(i.account.data),
  }));
}

export const CreateAndAddLP = async (
  tgId: string,
  mintAddress: string,
  quoteAmount: number,
  solAmount: number
) => {
  try {
    const userAccount = await colWallets.findOne({ tgId: tgId });
    const feePayer = web3.Keypair.fromSecretKey(
      new Uint8Array(userAccount.secretKey)
    );

    const SOL_MINT_ADDRESS = splToken.NATIVE_MINT;
    const QUOTE_MINT_ADDRESS = new web3.PublicKey(mintAddress);
    const PROGRAMIDS = raydium.DEVNET_PROGRAM_ID;

    const solDecimals = (await splToken.getMint(connection, SOL_MINT_ADDRESS))
      .decimals;
    const quoteDecimals = (
      await splToken.getMint(connection, QUOTE_MINT_ADDRESS)
    ).decimals;

    const walletTokenAccounts = await getWalletTokenAccount(
      connection,
      feePayer.publicKey
    );

    const associatedTokenAccount = await splToken.getAssociatedTokenAddress(
      splToken.NATIVE_MINT,
      feePayer.publicKey
    );

    // Create token account to hold your wrapped SOL
    let tx = new web3.Transaction().add(
      // Transfer SOL
      web3.SystemProgram.transfer({
        fromPubkey: feePayer.publicKey,
        toPubkey: associatedTokenAccount,
        lamports: solAmount * web3.LAMPORTS_PER_SOL,
      }),
      // Sync wrapped SOL balance
      splToken.createSyncNativeInstruction(associatedTokenAccount)
    );

    await web3.sendAndConfirmTransaction(connection, tx, [feePayer]);

    // Construct the liquidity transaction
    const { innerTransactions } =
      await raydium.Liquidity.makeCreatePoolV4InstructionV2Simple({
        connection,
        programId: PROGRAMIDS.AmmV4,
        marketInfo: {
          marketId: await web3.Keypair.generate().publicKey,
          programId: new web3.PublicKey(PROGRAMIDS.OPENBOOK_MARKET),
        },
        baseMintInfo: { mint: associatedTokenAccount, decimals: solDecimals },
        quoteMintInfo: { mint: QUOTE_MINT_ADDRESS, decimals: quoteDecimals },
        baseAmount: new BN(solAmount * web3.LAMPORTS_PER_SOL),
        quoteAmount: new BN(quoteAmount),
        startTime: new BN(Math.floor(Date.now() / 1000) + 30),
        ownerInfo: {
          feePayer: feePayer.publicKey,
          wallet: feePayer.publicKey,
          tokenAccounts: walletTokenAccounts,
        },
        associatedOnly: false,
        checkCreateATAOwner: true,
        makeTxVersion: raydium.TxVersion.V0,
        feeDestinationId: new web3.PublicKey(
          "8owZuag8Fbg4imbERYjc7yN4cUU8BTzFo4yHqxaoWZHc"
        ),
      });

    // Create a new transaction and add the inner transaction instructions
    const transaction = new web3.Transaction();
    innerTransactions.forEach((innerTx: any) => {
      innerTx.instructions.forEach((instruction: any) => {
        transaction.add(instruction);
      });
    });

    transaction.recentBlockhash = (
      await connection.getRecentBlockhash()
    ).blockhash;
    transaction.feePayer = feePayer.publicKey;

    // Sign and send the transaction
    const transactionSignature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [feePayer] // Ensure this is a valid Keypair
    );

    // Generate explorer links for the transaction and the liquidity pool
    const transactionLink = helpers.getExplorerLink(
      "transaction",
      transactionSignature,
      "devnet"
    );

    console.log(
      `✅ Transaction confirmed, explorer link is: ${transactionLink}!`
    );

    const liquidityLink = helpers.getExplorerLink("address", "devnet");

    console.log(`✅ Look at the liquidity again: ${liquidityLink}!`);
    return { liquidityLink, transactionLink };
  } catch (error: any) {
    console.error("Failed to create and add LP:", error);
    throw new Error("Failed to create and add LP");
  }
};
