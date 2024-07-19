import { Markup } from "telegraf";

export const askForConfirmation = async (
  ctx: any,
  action: any,
  confirmedData: any
) => {
  await ctx.replyWithHTML(
    `Are you sure you want to proceed with this action?\n` +
      `<i>Once you proceed, this action is not able to recovered!</i>`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "✅ Sure",
            `confirm_${action}_${confirmedData}`
          ),
          Markup.button.callback("❌ No", `cancel_${action}_${confirmedData}`),
        ],
      ]),
    }
  );
};
