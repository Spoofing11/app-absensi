import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/features/auth/actions";
import { cn } from "@/lib/shared/cn";

export function LogoutButton({ className }) {
  return (
    <form action={logoutAction}>
      <Button
        type="submit"
        variant="secondary"
        className={cn("w-full", className)}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Keluar
      </Button>
    </form>
  );
}
