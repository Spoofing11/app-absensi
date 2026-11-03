import { requireWorkspace } from "@/lib/server/auth/permissions";
export default async function Layout({ children }) {
  await requireWorkspace();
  return children;
}
