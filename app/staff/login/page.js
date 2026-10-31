import { Brand } from '@/components/ui/brand';
import { readSupabaseConfig } from '@/lib/supabase/config';
export const metadata = { title: 'Staff sign in' };
export default async function StaffLogin({ searchParams }) {
  const params = await searchParams;
  const configured = readSupabaseConfig(process.env).configured;
  return <main id="main-content" className="container error-page" style={{ maxWidth: 520 }}><Brand /><p className="eyebrow" style={{ marginTop: 40 }}>CLUB WORKSPACE</p><h1>Staff sign in</h1><p>Authorized staff access. The demonstration still uses synthetic dashboard figures.</p>
    {!configured ? <p role="status">Staff access is unavailable until the local development connection is configured.</p> : <form action="/auth/login" method="post" className="staff-login-form">
      {params.error && <p role="alert">Sign in could not be completed. Check your details and staff access, then try again.</p>}
      <label htmlFor="staff-email">Email</label><input id="staff-email" type="email" name="email" autoComplete="username" required maxLength={254} />
      <label htmlFor="staff-password">Password</label><input id="staff-password" type="password" name="password" autoComplete="current-password" required maxLength={256} />
      <button className="button button-navy" type="submit">Sign in</button>
    </form>}
  </main>;
}
