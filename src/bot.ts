import bot from "./bot/actions";
import { ConnectDB } from "./utils/mongo";

export const StartBot = async () => {
  await ConnectDB();
  console.log("Bot is running");

  bot.launch().then(() => {
    console.log("Bot started");
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
};
