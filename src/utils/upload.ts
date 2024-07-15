import pinataSDK from "@pinata/sdk";
import fetch from "node-fetch";
import sharp from "sharp";
import streamifier from "streamifier";
import { PIN_API_KEY, PIN_SECRET_KEY } from "../config";

const pinata = new pinataSDK(PIN_API_KEY, PIN_SECRET_KEY);

const uploadToPinata = async (buffer: Buffer) => {
  try {
    const readableStream = streamifier.createReadStream(buffer);
    const result = await pinata.pinFileToIPFS(readableStream, {
      pinataMetadata: {
        name: "token-logo",
      },
    });
    return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
  } catch (error) {
    console.error("⚠️ Failed to upload image to Pinata:", error);
    throw new Error("Failed to upload image to Pinata");
  }
};

export const resizeImageAndStoreInPinata = async (
  ctx: any,
  fileId: string
): Promise<string> => {
  const fileLink = await ctx.telegram.getFileLink(fileId);
  const response = await fetch(fileLink.href);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const resizedBuffer = await sharp(buffer)
    .resize({ width: 128 })
    .jpeg()
    .toBuffer();
  const url = await uploadToPinata(resizedBuffer);
  return url;
};
