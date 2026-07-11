import CreditCard from "lucide-solid/icons/credit-card";
import FolderKanban from "lucide-solid/icons/folder-kanban";
import Settings from "lucide-solid/icons/settings";
import ShieldCheck from "lucide-solid/icons/shield-check";

export const navItems = [
  { href: "/app", label: "Projects", icon: FolderKanban },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/admin", label: "Admin", icon: ShieldCheck },
];
