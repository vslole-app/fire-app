import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { friendPush } from "./friend-push.js";

initializeApp();

const invalidTokens = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token"
]);

export const notifyFriend = onDocumentCreated("cheers/{recipient}/inbox/{messageId}", async event => {
  const message = event.data?.data();
  if (!message) return;
  const settings = getFirestore().doc("push/" + event.params.recipient);
  const push = friendPush(message, event.params.messageId, (await settings.get()).data());
  if (!push) return;

  const db = getFirestore();
  const ref = event.data.ref;
  const claimed = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return false;
    const state = snapshot.data();
    if (state.friendPushDeliveredAt || (state.friendPushLeaseUntil?.toMillis() || 0) > Date.now()) return false;
    tx.update(ref, {friendPushLeaseUntil: Timestamp.fromMillis(Date.now() + 180000)});
    return true;
  });
  if (!claimed) return;
  const expired = [];
  let delivered = false;
  try {
  for (let offset = 0; offset < push.tokens.length; offset += 500) {
    const tokens = push.tokens.slice(offset, offset + 500);
    const result = await getMessaging().sendEachForMulticast({
      tokens,
      data: push.data,
      webpush: {headers: {Urgency: "high", TTL: "3600"}}
    });
    result.responses.forEach((response, index) => {
      if (response.success) delivered = true;
      const code = response.error?.code;
      if (invalidTokens.has(code)) expired.push(tokens[index]);
      else if (code) console.warn("Friend notification delivery failed", code);
    });
  }
  if (expired.length) await settings.update({tokens: FieldValue.arrayRemove(...expired)});
  } finally {
    await db.runTransaction(async tx => {
      if (!(await tx.get(ref)).exists) return;
      const patch = {friendPushLeaseUntil: FieldValue.delete()};
      if (delivered) patch.friendPushDeliveredAt = FieldValue.serverTimestamp();
      tx.update(ref, patch);
    });
  }
});
