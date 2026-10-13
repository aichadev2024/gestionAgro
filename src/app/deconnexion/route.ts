import { signOut } from "@/lib/auth";

// Utilisé quand le compte a été désactivé ou supprimé : on ferme la session puis on revient à la connexion.
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
