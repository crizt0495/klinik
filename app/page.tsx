import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/guard";

export default async function Home() {
  try {
    const user = await getSessionUser();
    void user;
    redirect("/dashboard");
  } catch {
    redirect("/login");
  }
}