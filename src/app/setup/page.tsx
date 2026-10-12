import { SetupForm } from '@/components/forms';

export default function SetupPage() {
  return (
    <div className="login card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="login-logo" src="/seo-desk-logo.png" alt="SEO Desk" width={1192} height={556} />
      <h1 className="login-title">Buat akun Leader</h1>
      <p className="muted login-lead">
        Belum ada akun. Akun pertama ini menjadi <strong>Leader</strong>: bisa membuka Konfigurasi dan membuat akun
        Staff di menu Setting.
      </p>
      <SetupForm />
    </div>
  );
}
