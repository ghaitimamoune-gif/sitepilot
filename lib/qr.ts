import QRCode from "qrcode";
import { headers } from "next/headers";

/** QR code en SVG (affiché tel quel, sans image externe). */
export async function qrSvg(texte: string): Promise<string> {
  return QRCode.toString(texte, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#18181b", light: "#ffffff" } });
}

/** Adresse publique de l'application (APP_URL, sinon déduite de la requête). */
export async function origine(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = host.startsWith("localhost") || host.startsWith("127.");
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}
