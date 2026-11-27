import { createEncouragementConfig } from "./encouragement-config.js";

const { KIND } = createEncouragementConfig();

export function friendPush(message, messageId, settings) {
  if (!message || settings?.friends === false || !Array.isArray(settings?.tokens)) return null;
  const kind = message.kind ?? "cheer";
  if (kind !== "cheer" && kind !== "invite") return null;
  const copy = KIND[kind];
  if (!Number.isInteger(message.msg) || !copy.list[message.msg]) return null;
  const tokens = [...new Set(settings.tokens.filter(token => typeof token === "string" && token.length))];
  if (!tokens.length) return null;
  const name = typeof message.name === "string" ? message.name.trim().slice(0, 60) : "";
  return {tokens, data:{
    title: (name || "Друг") + " " + copy.verb,
    body: copy.list[message.msg],
    tag: "cheer-" + messageId,
    url: "./"
  }};
}
