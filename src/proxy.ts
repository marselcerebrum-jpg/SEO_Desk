import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { accountFromSessionToken, hasLocalAccounts, SESSION_COOKIE } from '@/lib/local-auth';
import { getSettings, isSupabaseConfigured } from '@/lib/settings';

const go = (request: NextRequest, path: string) => NextResponse.redirect(new URL(path, request.url));

// Arahkan tamu ke /login. Mode Supabase juga me-refresh sesi di setiap request.
// Mode lokal tanpa akun sama sekali: semua diarahkan ke /setup untuk membuat Leader pertama.
// Hak akses per jabatan dicek di halaman dan server action (requireLeader).
export async function proxy(request: NextRequest) {
  const settings = getSettings();
  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith('/login');
  const isSetup = path.startsWith('/setup');

  if (!isSupabaseConfigured(settings)) {
    if (!hasLocalAccounts()) return isSetup ? NextResponse.next() : go(request, '/setup');
    const signedIn = !!accountFromSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!signedIn && !isLogin) return go(request, '/login');
    if (signedIn && isLogin) return go(request, '/');
    if (isSetup) return go(request, signedIn ? '/' : '/login');
    return NextResponse.next();
  }

  if (isSetup) return go(request, '/login');
  let response = NextResponse.next({ request });
  const supabase = createServerClient(settings.supabaseUrl, settings.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!data.user && !isLogin) return go(request, '/login');
  if (data.user && isLogin) return go(request, '/');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)'],
};
