import { MongoClient } from "mongodb";
import { URI, DB, COL_WALLETS, COL_TOKENS, COL_LIQUIDITIES } from "../config";

const client = new MongoClient(URI);

let colWallets: any;
let colTokens: any;
let colLiquidities: any;

export const ConnectDB = async () => {
  try {
    await client.connect();
    const db = client.db(DB);
    colWallets = db.collection(COL_WALLETS);
    colTokens = db.collection(COL_TOKENS);
    colLiquidities = db.collection(COL_LIQUIDITIES);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("⚠️ Failed to connect to MongoDB:", error);
    process.exit(1);
  }
};

export { colWallets, colTokens, colLiquidities };
