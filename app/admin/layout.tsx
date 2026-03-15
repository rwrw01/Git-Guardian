import { getSessionEmail } from "../../src/auth";
import { redirect } from "next/navigation";
import AdminNav from "./nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = await getSessionEmail();

  if (!email) {
    redirect("/login");
  }

  return (
    <div className="admin-layout" style={{ display: "flex", minHeight: "100vh" }}>
      <AdminNav email={email} />
      <main className="admin-main" style={{ flex: 1, padding: "32px 40px", overflowY: "auto", background: "#1e1e1e" }}>
        {children}
      </main>
    </div>
  );
}
