import { colLiquidities } from "../../utils/mongo";
import { AddLiquidity } from "../../utils/solana";

export const LiquidityInfo = async (ctx: any) => {
  const tgId = ctx.from?.id.toString();

  try {
    const liquidityListItems = await colLiquidities.find({ tgId }).toArray();
    if (liquidityListItems.length === 0) {
      return {
        liquidities: [],
      };
    }

    const liquidityList = liquidityListItems.map(
      (liquidities: {
        tokenName: string;
        publicKey: string;
        secretKey: Uint8Array;
      }) => ({
        tokenName: token.tokenName,
        publicKey: token.publicKey,
        secretKey: token.secretKey,
      })
    );

    return {
      tgId,
      liquidities: liquidityList,
    };
  } catch (error) {
    console.error("Failed to list tokens:", error);
    return {
      message: "Failed to retrieve token list. Please try again later.",
      liquidities: [],
    };
  }
};
