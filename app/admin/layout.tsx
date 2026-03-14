import { auth } from "../../src/auth";
import { redirect } from "next/navigation";
import AdminNav from "./nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const username = (session.user as Record<string, unknown>).githubUsername as string ?? session.user.email ?? "";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <AdminNav username={username} />
      <main style={{ flex: 1, padding: "32px 40px", overflowY: "auto", background: "#1e1e1e" }}>
        {children}
      </main>
    </div>
  );
}
