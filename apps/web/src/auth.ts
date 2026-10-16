import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Account identity and provider inference are separate systems.
// Never share Google tokens with the Python AI provider router.
const id = process.env.AUTH_GOOGLE_ID;
const clientSecret = process.env.AUTH_GOOGLE_SECRET;
const secret = process.env.AUTH_SECRET;

export const googleLoginConfigured = Boolean(id && clientSecret && secret && secret.length >= 32);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,
  providers: googleLoginConfigured
    ? [Google({ clientId: id!, clientSecret: clientSecret! })]
    : [],
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    async signIn({ account, profile }) {
      return account?.provider === "google" && profile?.email_verified === true;
    },
  },
});
