"""Background friend notifications using the existing reminder service account."""
import datetime as dt
import json
import os
import re
from pathlib import Path

SITE = "https://bible-fire.ru/"
ROOT = Path(__file__).resolve().parents[2]


def load_words():
    source = (ROOT / "src/encouragement-config.js").read_text(encoding="utf-8")
    return {kind: (verb, json.loads(re.search(r"const " + name + r"\s*=\s*(\[[\s\S]*?\]);", source).group(1)))
            for kind, verb, name in [
                ("cheer", "воодушевляет вас", "CHEERS"),
                ("invite", "зовёт почитать вместе", "INVITES")]}


def payload(message, message_id, words):
    kind = message.get("kind", "cheer")
    if kind not in words:
        return None
    verb, phrases = words[kind]
    i = message.get("msg")
    if type(i) is not int or not 0 <= i < len(phrases):
        return None
    name = str(message.get("name") or "Друг").strip()[:60] or "Друг"
    return {"title": name + " " + verb, "body": phrases[i],
            "url": SITE, "tag": "cheer-" + message_id}


def main():
    import firebase_admin
    from firebase_admin import credentials, firestore, messaging
    from google.cloud.firestore_v1.base_query import FieldFilter

    firebase_admin.initialize_app(credentials.Certificate(json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])))
    db = firestore.client()
    words = load_words()
    now = dt.datetime.now(dt.timezone.utc)
    sent = failed = 0

    @firestore.transactional
    def claim(tx, ref):
        snap = ref.get(transaction=tx)
        if not snap.exists:
            return False
        data = snap.to_dict()
        now = dt.datetime.now(dt.timezone.utc)
        if data.get("friendPushDeliveredAt") or (data.get("friendPushLeaseUntil") or now) > now:
            return False
        tx.update(ref, {"friendPushLeaseUntil": now + dt.timedelta(minutes=3)})
        return True

    @firestore.transactional
    def finish(tx, ref, delivered):
        snap = ref.get(transaction=tx)
        if not snap.exists:
            return
        patch = {"friendPushLeaseUntil": firestore.DELETE_FIELD}
        if delivered:
            patch["friendPushDeliveredAt"] = firestore.SERVER_TIMESTAMP
        tx.update(ref, patch)

    # Independent of reading-reminder hours and the reading-completion status.
    # No new public access rules or client-side FCM credentials.
    for subscription in db.collection("push").stream():
        try:
            settings = subscription.to_dict()
            if settings.get("friends") is False:
                continue
            tokens = list(dict.fromkeys(t for t in settings.get("tokens", []) if isinstance(t, str) and t))
            if not tokens:
                continue
            inbox = db.collection("cheers").document(subscription.id).collection("inbox")
            # Let the real-time trigger, if deployed, have the first two minutes.
            recent = inbox.where(filter=FieldFilter("at", ">=", now - dt.timedelta(hours=1))).where(
                filter=FieldFilter("at", "<=", now - dt.timedelta(minutes=2)))
            for item in recent.stream():
                data = payload(item.to_dict(), item.id, words)
                if not data or not claim(db.transaction(), item.reference):
                    continue
                delivered = False
                try:
                    for token in tokens:
                        try:
                            messaging.send(messaging.Message(token=token, data=data,
                                webpush=messaging.WebpushConfig(headers={"Urgency": "high", "TTL": "3600"})))
                            delivered = True
                            sent += 1
                        except Exception as exc:
                            failed += 1
                            print("Friend push send failed:", type(exc).__name__)
                finally:
                    finish(db.transaction(), item.reference, delivered)
        except Exception as exc:
            failed += 1
            print("Friend push processing failed:", type(exc).__name__)
    print(f"Friend push accepted: {sent}, failures: {failed}")


if __name__ == "__main__":
    main()
