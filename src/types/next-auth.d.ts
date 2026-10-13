import type { Role } from "@/lib/roles";

declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: { id: string; name: string; email: string; role: Role };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
