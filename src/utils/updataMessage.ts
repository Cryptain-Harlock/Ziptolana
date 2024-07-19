import { Markup } from "telegraf";

export const updateMessage = async (ctx: any, text: any, buttons: any) => {
  if (ctx.update.callback_query && ctx.update.callback_query.message) {
    const messageId = ctx.update.callback_query.message.message_id;
    await ctx.deleteMessage(messageId);
  }

  await ctx.replyWithHTML(text, {
    ...Markup.inlineKeyboard(buttons),
  });
};
