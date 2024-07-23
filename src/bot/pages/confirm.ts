import { Markup } from "telegraf";

export const askForConfirmation = async (
  ctx: any,
  action: any,
  confirmedData: any
) => {
  try {
    await ctx.replyWithHTML(
      `⚠️ Warning!\n\nAre you sure you want to proceed with this action?\n` +
        `<i>Once you proceed, this action is not able to recovered!</i>`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "✅ Sure",
              `confirm_${action}_${confirmedData}`
            ),
            Markup.button.callback(
              "❌ No",
              `cancel_${action}_${confirmedData}`
            ),
          ],
        ]),
      }
    );
  } catch (error: any) {
    console.error(error);
    await ctx.reply("An error occurred while processing your request.");
  }
};
