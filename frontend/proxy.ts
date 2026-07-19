import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Vérification optimiste seulement : la vraie autorisation reste appliquée
// côté DRF (IsAuthenticated) sur chaque appel d'API protégé.
export function proxy(request: NextRequest) {
  const token = request.cookies.get('access');
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
