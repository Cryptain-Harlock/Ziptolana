import { Telegraf, Markup } from "telegraf";
import * as web3 from "@solana/web3.js";
import { HttpsProxyAgent } from "https-proxy-agent";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

// Import parammeters from environment
const {
  PROXY_HOST,
  PROXY_PORT,
  TG_BOT_TOKEN,
  MONGO_URI,
  MONGO_DB_NAME,
  MONGO_COLLECTION_NAME,
} = process.env;

if (
  !PROXY_HOST ||
  !PROXY_PORT ||
  !TG_BOT_TOKEN ||
  !MONGO_URI ||
  !MONGO_DB_NAME ||
  !MONGO_COLLECTION_NAME
) {
  throw new Error("Missing required environment variables");
}
// Using proxy
const proxyUrl = `http://${PROXY_HOST}:${PROXY_PORT}`;
const agent = new HttpsProxyAgent(proxyUrl);
// Declare the main bot: ZiptosSol@ziptos_sol_bot

const client = new MongoClient(MONGO_URI);
let userAccountsCollection: any;

const connectToMongoDB = async () => {
  try {
    await client.connect();
    const db = client.db(MONGO_DB_NAME);
    userAccountsCollection = db.collection(MONGO_COLLECTION_NAME);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1); // Exit the process if unable to connect
  }
};

const getOrCreateSolanaAccount = async (
  userId: string,
  username: string,
  firstName: string,
  lastName: string
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
        username,
        firstName,
        lastName,
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

const bot = new Telegraf(TG_BOT_TOKEN, {
  telegram: { agent },
});

bot.start(async (ctx) => {
  const userId = ctx.from?.id.toString();
  const firstName = ctx.from?.first_name || "there";
  const lastName = ctx.from?.last_name || "";
  const username = ctx.from?.username || "";

  if (!userId) {
    ctx.reply("Unable to identify user.");
    return;
  }

  try {
    const userAccount = await getOrCreateSolanaAccount(
      userId,
      username,
      firstName,
      lastName
    );
    const userAddress = userAccount.publicKey.toBase58();

    ctx.replyWithHTML(
      `Hi, <b>${firstName}</b>. Welcome to Ziptos on Solana!\n
      Your Solana Account:\n<code>${userAddress}</code>`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("🌟 Create Token", "createToken"),
          Markup.button.callback("💫 Refresh Balance", "refreshBalance"),
          Markup.button.callback("🗝 Wallet", "wallet"),
        ],
        [
          Markup.button.callback("➕ Import Wallet", "importWallet"),
          Markup.button.callback("🔴 Disconnect Wallet", "disconnectWallet"),
        ],
        [
          Markup.button.callback("💎 Add Liquidity", "addLiquidity"),
          Markup.button.callback("❌ Remove Liquidity", "removeLiquidity"),
        ],
        [
          Markup.button.callback("💱 Swap", "swap"),
          Markup.button.callback("💰 Your Tokens", "yourTokens"),
        ],
        [
          Markup.button.callback("❔ FAQ", "faq"),
          Markup.button.callback("📞 Support", "support"),
        ],
      ])
    );
  } catch (error) {
    console.error("Failed to handle start command:", error);
    ctx.reply(
      "There was an error processing your request. Please try again later."
    );
  }
});

bot.on("text", (ctx) => ctx.reply(`You said: ${ctx.message.text}`));
const connection = new web3.Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

console.log("Attempting to launch bot...");

connectToMongoDB().then(() => {
  bot
    .launch()
    .then(() => {
      console.log("Bot is running");
    })
    .catch((error) => {
      console.error(`Failed to launch bot: ${error.message}`, error);
    });
});

process.once("SIGINT", () => {
  client.close().then(() => {
    console.log("MongoDB connection closed");
    process.exit();
  });
});

process.once("SIGTERM", () => {
  client.close().then(() => {
    console.log("MongoDB connection closed");
    process.exit();
  });
});
