import unittest
from friend_push import load_words, payload

class FriendPushTest(unittest.TestCase):
    def test_invite(self):
        data = payload({"name":"Виталий","kind":"invite","msg":3}, "a_inv", load_words())
        self.assertEqual(data["title"], "Виталий зовёт почитать вместе")
        self.assertEqual(data["body"], "10 минут со Словом — давай прямо сейчас, вместе")
        self.assertEqual(data["tag"], "cheer-a_inv")

    def test_cheer_and_invalid(self):
        words = load_words()
        self.assertEqual(payload({"name":"Друг","msg":0}, "a", words)["title"], "Друг воодушевляет вас")
        for data in [{"msg":-1},{"msg":8},{"msg":True},{"kind":"conf","msg":0}]:
            self.assertIsNone(payload(data, "a", words))

if __name__ == "__main__":
    unittest.main()
