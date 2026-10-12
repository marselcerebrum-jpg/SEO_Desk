import { LoginForm } from '@/components/forms';

export default function LoginPage() {
  return (
    <div className="login card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="login-logo" src="/seo-desk-logo.png" alt="SEO Desk" width={1192} height={556} />
      <h1 className="login-title">Masuk</h1>
      <p className="muted login-lead">Belum punya akun? Minta Leader tim membuatkannya.</p>
      <LoginForm />
    </div>
  );
}
