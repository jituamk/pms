import { redirect } from "next/navigation";

export default function Home() {
  // For now, send users straight to the login page.
  redirect("/login");
}
