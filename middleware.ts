import { NextResponse, type NextRequest } from "next/server";

const COOKIE_APPAREIL = "eb_appareil";
const COOKIE_SESSION = "eb_session";

/** Pages d'entrée : enrôlement, installation du premier propriétaire, invitation personnelle. */
const PAGES_ENTREE = new Set(["/enroler", "/installation", "/invitation"]);

/**
 * Garde légère : présence des cookies d'enrôlement et de session. Les droits réels sont
 * vérifiés côté serveur dans chaque page et chaque action (section 13, sécurité).
 */
export function middleware(req: NextRequest) {
  const redirection = controleAcces(req);
  if (redirection) return redirection;

  // Mode test uniquement : l'aperçu de l'application Claude passe par un proxy dont le domaine
  // n'est pas connu d'avance. Les actions serveur exigent que l'origine corresponde à l'hôte :
  // on aligne l'hôte transmis sur l'origine. (Les cookies SameSite=Lax empêchent déjà les envois
  // intersites ; ce réglage n'est jamais actif en production.)
  if (process.env.MODE_DEMO === "1" && req.method === "POST") {
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        const headers = new Headers(req.headers);
        headers.set("x-forwarded-host", new URL(origin).host);
        return NextResponse.next({ request: { headers } });
      } catch {
        /* origine illisible : traitement normal */
      }
    }
  }
  return NextResponse.next();
}

/** Renvoie une redirection si le téléphone n'est pas enrôlé ou pas connecté ; sinon null. */
function controleAcces(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  if (PAGES_ENTREE.has(pathname)) return null;
  const appareil = req.cookies.get(COOKIE_APPAREIL)?.value;
  if (!appareil) {
    const url = req.nextUrl.clone();
    url.pathname = "/enroler";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/connexion")) return null;
  const session = req.cookies.get(COOKIE_SESSION)?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return null;
}

export const config = {
  matcher: [
    // Tout sauf les ressources statiques, le manifeste, les icônes et les API protégées par secret.
    "/((?!_next/|api/cron|api/demo|api/photos|api/sante|manifest\\.json|sw\\.js|hors-ligne\\.html|icon|apple-touch-icon|favicon|robots\\.txt).*)",
  ],
};
