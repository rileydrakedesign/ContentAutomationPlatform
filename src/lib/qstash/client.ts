import { Client } from "@upstash/qstash";

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
  baseUrl: "https://qstash-us-east-1.upstash.io",
});
