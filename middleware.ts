import { NextResponse, type NextRequest } from "next/server";

const COOKIE_APPAREIL = "eb_appareil";
const COOKIE_SESSION = "eb_session";

/**
 * Garde légère : présence des cookies d'enrôlement et de session. Les droits réels sont
 * vérifiés côté serveur dans chaque page et chaque action (section 13, sécurité).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const appareil = req.cookies.get(COOKIE_APPAREIL)?.value;
  const session = req.cookies.get(COOKIE_SESSION)?.value;

  if (pathname === "/enroler") {
    return NextResponse.next();
  }
  if (!appareil) {
    const url = req.nextUrl.clone();
    url.pathname = "/enroler";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/connexion")) {
    return NextResponse.next();
  }
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Tout sauf les ressources statiques, le manifeste, les icônes et l'API cron.
    "/((?!_next/|api/cron|api/photos|manifest\\.json|sw\\.js|hors-ligne\\.html|icon|apple-touch-icon|favicon|robots\\.txt).*)",
  ],
};
