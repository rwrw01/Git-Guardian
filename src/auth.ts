import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

// ---------------------------------------------------------------------------
// Allowed admin GitHub usernames — only these can access the admin portal
// ---------------------------------------------------------------------------

const ALLOWED_ADMINS = (process.env.ADMIN_GITHUB_USERS ?? "")
  .split(",")
  .map((u) => u.trim().toLowerCase())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// NextAuth configuration — GitHub OAuth, strict session security
// ---------------------------------------------------------------------------

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    signIn({ profile }) {
      // Only allow whitelisted GitHub users
      const username = (profile?.login as string ?? "").toLowerCase();
      if (ALLOWED_ADMINS.length === 0) return false;
      return ALLOWED_ADMINS.includes(username);
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        (session.user as unknown as Record<string, unknown>).githubUsername =
          token.githubUsername;
      }
      return session;
    },

    jwt({ token, profile }) {
      if (profile) {
        token.githubUsername = (profile.login as string) ?? "";
      }
      return token;
    },
  },

  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — short session for security portal
  },
});
