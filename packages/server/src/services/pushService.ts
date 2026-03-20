import webpush from "web-push";
import fs from "node:fs";
import path from "node:path";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let vapidKeys: VapidKeys | null = null;

function isValidVapidKeys(keys: unknown): keys is VapidKeys {
  return (
    typeof keys === "object" &&
    keys !== null &&
    typeof (keys as VapidKeys).publicKey === "string" &&
    typeof (keys as VapidKeys).privateKey === "string" &&
    (keys as VapidKeys).publicKey.length > 0 &&
    (keys as VapidKeys).privateKey.length > 0
  );
}

function generateAndSaveKeys(keysPath: string): VapidKeys {
  console.log("Generating new VAPID keys...");
  const generated = webpush.generateVAPIDKeys();
  const keys: VapidKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
  };

  try {
    fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error(`Failed to write VAPID keys to ${keysPath}:`, err);
    throw err;
  }

  return keys;
}

export function initVapidKeys(dataDir: string, publicOrigin: string): VapidKeys {
  const secretsDir = path.join(dataDir, "secrets");
  const keysPath = path.join(secretsDir, "webpush.json");

  fs.mkdirSync(secretsDir, { recursive: true });

  if (fs.existsSync(keysPath)) {
    console.log("Loading existing VAPID keys...");
    try {
      const raw = fs.readFileSync(keysPath, "utf-8");
      const parsed = JSON.parse(raw);

      if (isValidVapidKeys(parsed)) {
        vapidKeys = parsed;
      } else {
        console.error("VAPID keys file has invalid structure, regenerating...");
        vapidKeys = generateAndSaveKeys(keysPath);
      }
    } catch (err) {
      console.error("Failed to parse VAPID keys file, regenerating...", err);
      vapidKeys = generateAndSaveKeys(keysPath);
    }
  } else {
    vapidKeys = generateAndSaveKeys(keysPath);
  }

  webpush.setVapidDetails(publicOrigin, vapidKeys.publicKey, vapidKeys.privateKey);

  return vapidKeys;
}

export function getVapidPublicKey(): string | null {
  return vapidKeys?.publicKey ?? null;
}
