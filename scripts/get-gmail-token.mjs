#!/usr/bin/env node
// One-time setup: exchange an OAuth consent approval for a Gmail API refresh token.
//
// Usage:  node scripts/get-gmail-token.mjs
// Prereq: an OAuth Client ID of type "Desktop" in your Google Cloud project
//         (see README "Email via Gmail API"). Nothing is printed except the
//         consent URL; the resulting credentials are written to
//         .gmail-oauth.local.json (gitignored) for the agent to upload to Railway.
import { createServer } from "node:http";
import { createInterface } from "node:readline/promises";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 42831;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/gmail.send";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const clientId = (await rl.question("OAuth Client ID: ")).trim();
const clientSecret = (await rl.question("OAuth Client Secret: ")).trim();
rl.close();

if (!clientId || !clientSecret) {
  console.error("Both values are required.");
  process.exit(1);
}

const state = Math.random().toString(36).slice(2);
const consentUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
consentUrl.searchParams.set("client_id", clientId);
consentUrl.searchParams.set("redirect_uri", REDIRECT_URI);
consentUrl.searchParams.set("response_type", "code");
consentUrl.searchParams.set("scope", SCOPE);
consentUrl.searchParams.set("access_type", "offline");
consentUrl.searchParams.set("prompt", "consent");
consentUrl.searchParams.set("state", state);

const codePromise = new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, REDIRECT_URI);
    res.setHeader("Content-Type", "text/html");
    if (url.searchParams.get("state") !== state) {
      res.end("<h2>State mismatch — close this tab and retry.</h2>");
      reject(new Error("state mismatch"));
      return;
    }
    const code = url.searchParams.get("code");
    if (code) {
      res.end("<h2>Approved! You can close this tab and return to the terminal.</h2>");
      resolve(code);
    } else {
      res.end(`<h2>Consent failed: ${url.searchParams.get("error") ?? "unknown"} — close this tab and retry.</h2>`);
      reject(new Error(url.searchParams.get("error") ?? "no code"));
    }
    server.close();
  });
  server.listen(PORT, () => console.log(`\nListening for the consent redirect on ${REDIRECT_URI}`));
});

console.log("\n1. Open this URL in your browser and approve access:\n");
console.log(consentUrl.toString());
console.log("\n2. Sign in with the account that should send TaskNest email.");
console.log("   (If you see 'unverified app': click Advanced -> Go to project (unsafe) — it is your own app in testing mode.)\n");

let code;
try {
  code = await codePromise;
} catch {
  process.exit(1);
}

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  }),
});
if (!tokenRes.ok) {
  console.error("Token exchange failed:", tokenRes.status, (await tokenRes.text()).slice(0, 400));
  process.exit(1);
}
const tokens = await tokenRes.json();
if (!tokens.refresh_token) {
  console.error("No refresh token returned. Re-run the script — consent must be requested with prompt=consent (already set), and the account must not have a previous grant for this client.");
  process.exit(1);
}

let email = "";
if (tokens.id_token) {
  const payload = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8"));
  email = payload.email ?? "";
}

const outFile = path.join(repoRoot, ".gmail-oauth.local.json");
writeFileSync(
  outFile,
  JSON.stringify({ client_id: clientId, client_secret: clientSecret, refresh_token: tokens.refresh_token, user: email }, null, 2) + "\n",
  { encoding: "utf8" },
);
console.log(`\nDone. Authorized account: ${email || "(unknown — check the file)"}`);
console.log(`Credentials written to ${outFile} (gitignored). Tell the agent it can continue.`);
