import { auth, googleLoginConfigured, signIn, signOut } from "@/auth";
import { CircleUserRound, LogOut, LogIn, ShieldCheck } from "lucide-react";

export async function AccountActions({ compact = false }: { compact?: boolean }) {
  const session = googleLoginConfigured ? await auth() : null;
  if (session?.user) {
    return <div className="account-status">
      <span className="account-identity"><CircleUserRound size={17} />
        {session.user.name || session.user.email || "Conta Google"}
      </span>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
        <button type="submit" className="account-signout"><LogOut size={15} /> Sair</button>
      </form>
    </div>;
  }
  if (!googleLoginConfigured) {
    return compact
      ? <span className="account-guest"><ShieldCheck size={16} /> Community local</span>
      : <div className="account-provider-unavailable">
          <ShieldCheck size={18} />
          <span>Entrar com Google estará disponível quando o proprietário configurar o OAuth.</span>
        </div>;
  }
  return <form action={async () => { "use server"; await signIn("google", { redirectTo: "/inicio" }); }}>
    <button type="submit" className="account-google"><LogIn size={19} /> Continuar com Google</button>
  </form>;
}
