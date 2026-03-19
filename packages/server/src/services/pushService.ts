import webpush from "web-push";
import fs from "node:fs";
import path from "node:path";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let vapidKeys: VapidKeys | null = null;

export function initVapidKeys(dataDir: string, publicOrigin: string): VapidKeys {
  const secretsDir = path.join(dataDir, "secrets");
  const keysPath = path.join(secretsDir, "webpush.json");

  fs.mkdirSync(secretsDir, { recursive: true });

  if (fs.existsSync(keysPath)) {
    console.log("Loading existing VAPID keys...");
    const raw = fs.readFileSync(keysPath, "utf-8");
    vapidKeys = JSON.parse(raw) as VapidKeys;
  } else {
    console.log("Generating new VAPID keys...");
    const generated = webpush.generateVAPIDKeys();
    vapidKeys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
    };
    fs.writeFileSync(keysPath, JSON.stringify(vapidKeys, null, 2), { mode: 0o600 });
  }

  webpush.setVapidDetails(publicOrigin, vapidKeys.publicKey, vapidKeys.privateKey);

  return vapidKeys;
}

export function getVapidPublicKey(): string | null {
  return vapidKeys?.publicKey ?? null;
}
