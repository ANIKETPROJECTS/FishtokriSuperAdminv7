// QZ Tray silent printing utility.
// Loads qz-tray.min.js from CDN once, reuses a single WebSocket connection,
// and prints HTML to a thermal printer.
// Falls back gracefully if QZ Tray is not running.
//
// CERTIFICATE SETUP:
//   The certificate below was generated with:
//     openssl req -x509 -newkey rsa:2048 -keyout private.pem -out cert.pem \
//       -days 3650 -nodes -subj "/CN=FishTokri Admin/O=FishTokri/C=IN"
//
//   To trust this certificate in QZ Tray permanently:
//     1. Open QZ Tray → right-click tray icon → "Site Manager"
//     2. Add your site's domain (e.g. yourdomain.com)
//     3. Import the certificate (the PUBLIC cert below) as the "Digital Certificate"
//   After that, QZ Tray will never show the "Untrusted website" popup for your domain.

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qz: any;
  }
}

const QZ_CDN_URL = "https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.min.js";
const PREFERRED_PRINTER = "TENAX TN-260";
const CONNECT_TIMEOUT_MS = 5_000;

// ─── CERTIFICATE (public — safe to embed) ────────────────────────────────────
const QZ_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDVzCCAj+gAwIBAgIUG1Lh9UYiWQ5gxgmtCTaKx+1+SUYwDQYJKoZIhvcNAQEL
BQAwOzEYMBYGA1UEAwwPRmlzaFRva3JpIEFkbWluMRIwEAYDVQQKDAlGaXNoVG9r
cmkxCzAJBgNVBAYTAklOMB4XDTI2MDUyODA3NTIwMloXDTM2MDUyNTA3NTIwMlow
OzEYMBYGA1UEAwwPRmlzaFRva3JpIEFkbWluMRIwEAYDVQQKDAlGaXNoVG9rcmkx
CzAJBgNVBAYTAklOMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx7wQ
/KPv45GwKImWRdIo+sLSb1L4VoLgRXyWQHrANzIoKuf0wdVJpKVyX7J2EGE/g0VE
yLblrLb2p0ml4jzs1UYloljHfeE2Ye4nWZbklcM0qjQ4C5UUJgiiFYQRwAeSlPE+
Gun83/tlrBeuWhETnYLKgFxjATTwImfdvGlYbww4d2P9epTQ1jR5AV6IM45uc4PS
+rgODGn1f4xDr4ZWtXNdcN03V3WbxaUposPpCUIljxrMDEM4Eq/S/TZ+VMbHRILN
yrQSRjF/OX2QlI7lDKf5bchQySxSTrplJJoCdZ0joOpfvbGbWMGNpCA/aOwE8UWH
Ywu88mNasbvoZBka5wIDAQABo1MwUTAdBgNVHQ4EFgQUA6Bom9sJHsOYHwOZaNJ7
RQKxM/owHwYDVR0jBBgwFoAUA6Bom9sJHsOYHwOZaNJ7RQKxM/owDwYDVR0TAQH/
BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAJUIeTLRX0yMC6u+efmPN+2C/Hk86
MdswBcDKoeY9bT5hRKhT1CwppBbEFgA+zAYe2RGj1ZDdNHUyYb9ERe2WaPUEW6os
I1PLJ/J9g2uapryVcAafkQqetoveIRAPGzYigVpfcb66xMYbhwLLip+r2zzuR+j0
esZhpCtEQv/JyIuQ3jC9ntrqqlHZfsoYNgiWgJ3uzqxugohUwiE6vZqeBc+r0PqS
NxWsvFb4qYkgCLimOQ+hjmjeEY9L0jO3afPFmvxciHCUhsaXbol9vcBZySly+2Yf
SZDZq4JlFvzwolVxkDs/T/OxX0D41ntY+pm7NEmKvg3IndktHzh/lRUxhg==
-----END CERTIFICATE-----`;

// ─── PRIVATE KEY (kept in frontend for this internal admin panel) ─────────────
// For higher security on a public-facing site, move signing to the server and
// call it via a /api/qz-sign endpoint instead.
const QZ_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDHvBD8o+/jkbAo
iZZF0ij6wtJvUvhWguBFfJZAesA3Migq5/TB1UmkpXJfsnYQYT+DRUTItuWstvan
SaXiPOzVRiWiWMd94TZh7idZluSVwzSqNDgLlRQmCKIVhBHAB5KU8T4a6fzf+2Ws
F65aEROdgsqAXGMBNPAiZ928aVhvDDh3Y/16lNDWNHkBXogzjm5zg9L6uA4MafV/
jEOvhla1c11w3TdXdZvFpSmiw+kJQiWPGswMQzgSr9L9Nn5UxsdEgs3KtBJGMX85
fZCUjuUMp/ltyFDJLFJOumUkmgJ1nSOg6l+9sZtYwY2kID9o7ATxRYdjC7zyY1qx
u+hkGRrnAgMBAAECggEADMSne1cJh00xay38dsMsDne01xwBNxqPtrFzs3SFZCHn
MnL4kQmO9yECcj6o0Hw/AKfFcWVLwmJB20jYe2F0rF+bGUk+m3vxq4n7Zv0/6Jj9
fWHwMUFa8+F6ZxC1x8ZUJwRS+Yp6uWDLS5iJ80UDMX8Cbfk59QJK1ZA5Owmq9xI+
geaZPclkLfTeSrQrV3qI7afb2FL+zyD+z31hHVOBcYqR6FnsIDLiSmg6kjlE52hU
ZgksJ504l8JLAGjCNfaY/4I6e9S9xf5NYZD3pEOLhUSGTyqwhPIcs1Ka3LBv8Dzi
v/slhBGIWwasStSvFBszehH+FZQOSZ3TpVl7pr3AaQKBgQDldtS2H1x0eQncGpzz
/i3BAk6ih5sR/yDcPh6pqLfWwUtZM++TYOlsA4x/Ua/FUs2nbBpk1W+XZSQQ7wBH
jqG68PtxXcg4bLil1LaS3huum+2PpNup9kn5hF8m/liGQ2/N5PiGnahRWNldBVJT
eDn/ove2PWz59kAatOBlnraDCQKBgQDe1RuBoIkspm24wsxUpm4BDY7sD9O97lEy
491Td9gEB5ZA2+8rZS2JC6pu1XEx4NkFxI8p6H9Z27fEs4QN+QbF3ZT86hyq6AqA
P9Flk8rCSnk9aSw4XjIkJwDy2ZTDfrjWtGeRQJo0XWVnzExyBImYN3PYcdcb2hCJ
Jn4kYWR6bwKBgEocokEcSfE4cq3LTqwjiUWQaDNoVvZuD3/y9FZZrt7G2X47HwLb
xyhi0QsCKCI0R0XuzWuJ4Bvmx8pMVyvFbokBckTARH2s58pvtHQlFo3DwOunFGeF
q4jSbyUZ+x+KQl8euAJKg2Waq8G2iUt6RklBqn4KwtrM5RF7IArSQyJ5AoGAHNws
+9T27zl+7HcOT8heZvSClkBWhDrheV3ZxH25FIyHAU964nvwMde48zHhvzwH359d
i2f5VoIGgwtdBxJBtk7EhR0tKVV0Rrf9PtKtaAyNN07v0z0f8V672LgldExtVCF5
aG6dijqub4seO4Yq6/QCpP3Zhlnv2lOJ8txKTzECgYAEhzr/U55LoyboxzNLwMV0
fwQ6FAM3BJHmadX2+3WPPPss21OAxDCXihU+FNn5Vfm5Sh5Ms22gqfJU2vzPOVrl
2ftRRQWAphrQFX6eycZYv7wcX/J8qu7bwP6bKkDkOM5ZVq6pMgTsQ7eqNTZ7CZ7z
DUQo/C492UBuNX3EuYeNHA==
-----END PRIVATE KEY-----`;

// ─── SCRIPT LOADER ────────────────────────────────────────────────────────────
let _scriptLoaded = false;
let _scriptLoadingPromise: Promise<void> | null = null;

function loadQzScript(): Promise<void> {
  if (_scriptLoaded && window.qz) return Promise.resolve();
  if (_scriptLoadingPromise) return _scriptLoadingPromise;

  _scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    if (window.qz) {
      _scriptLoaded = true;
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${QZ_CDN_URL}"]`);
    if (existing) {
      const start = Date.now();
      const poll = () => {
        if (window.qz) { _scriptLoaded = true; resolve(); return; }
        if (Date.now() - start > 5_000) { reject(new Error("QZ Tray script timed out")); return; }
        setTimeout(poll, 100);
      };
      poll();
      return;
    }
    const script = document.createElement("script");
    script.src = QZ_CDN_URL;
    script.async = true;
    script.onload = () => { _scriptLoaded = true; _scriptLoadingPromise = null; resolve(); };
    script.onerror = () => { _scriptLoadingPromise = null; reject(new Error("Failed to load QZ Tray script from CDN")); };
    document.head.appendChild(script);
  });

  return _scriptLoadingPromise;
}

// ─── RSA-SHA512 SIGNING via Web Crypto API ────────────────────────────────────
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

let _cryptoKey: CryptoKey | null = null;

async function getCryptoKey(): Promise<CryptoKey> {
  if (_cryptoKey) return _cryptoKey;
  const keyData = pemToArrayBuffer(QZ_PRIVATE_KEY);
  _cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
    false,
    ["sign"]
  );
  return _cryptoKey;
}

async function signWithKey(toSign: string): Promise<string> {
  const key = await getCryptoKey();
  const data = new TextEncoder().encode(toSign);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ─── SECURITY SETUP ───────────────────────────────────────────────────────────
function setupSecurity(): void {
  const qz = window.qz;

  qz.security.setCertificatePromise((resolve: (cert: string) => void) => {
    resolve(QZ_CERTIFICATE);
  });

  qz.security.setSignaturePromise((toSign: string) => {
    return (resolve: (sig: string) => void, reject: (err: unknown) => void) => {
      signWithKey(toSign).then(resolve).catch(reject);
    };
  });
}

// ─── CONNECTION ───────────────────────────────────────────────────────────────
async function ensureConnected(): Promise<void> {
  const qz = window.qz;
  if (qz.websocket.isActive()) return;

  await Promise.race([
    qz.websocket.connect(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("QZ Tray connection timed out — is QZ Tray running?")),
        CONNECT_TIMEOUT_MS
      )
    ),
  ]);
}

// ─── PRINTER RESOLUTION ───────────────────────────────────────────────────────
async function resolvePrinter(): Promise<string> {
  const qz = window.qz;

  try {
    const found = await qz.printers.find(PREFERRED_PRINTER);
    const name = Array.isArray(found) ? found[0] : found;
    if (name && typeof name === "string" && name.trim().length > 0) return name;
  } catch {
    // preferred printer not found — fall through
  }

  const all = await qz.printers.find();
  const list: string[] = Array.isArray(all) ? all : (all ? [String(all)] : []);
  const first = list.find((p) => p && p.trim().length > 0);
  if (!first) throw new Error("No printers found via QZ Tray");
  return first;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
export interface QzPrintResult {
  success: boolean;
  error?: string;
}

/**
 * Print an HTML string silently to the thermal printer via QZ Tray.
 * Returns { success: false } if QZ Tray is unavailable — caller should
 * fall back to window.print().
 */
export async function printHtmlWithQZ(htmlContent: string): Promise<QzPrintResult> {
  try {
    await loadQzScript();

    const qz = window.qz;
    if (!qz) throw new Error("window.qz not available after script load");

    setupSecurity();
    await ensureConnected();

    const printerName = await resolvePrinter();

    const config = qz.configs.create(printerName, {
      size: { width: 80, height: null },
      units: "mm",
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      orientation: "portrait",
      scaleContent: true,
      colorType: "blackwhite",
    });

    await qz.print(config, [
      {
        type: "pixel",
        format: "html",
        flavor: "plain",
        data: htmlContent,
      },
    ]);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
