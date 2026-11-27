export default {
  async scheduled(event, env) {
    if (!env.GITHUB_ACTIONS_TOKEN) throw new Error("Missing GitHub Actions token");
    const response = await fetch("https://api.github.com/repos/vslole-app/fire-app/actions/workflows/remind.yml/dispatches", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_ACTIONS_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "vslole-reading-reminders"
      },
      body: JSON.stringify({ ref: "main", inputs: { force: "false" } })
    });
    if (!response.ok) throw new Error(`GitHub dispatch failed: ${response.status}`);
  }
};
