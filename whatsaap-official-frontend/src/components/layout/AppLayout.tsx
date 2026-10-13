import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Header } from "./Header";
import { SidebarNav } from "./Sidebar";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border transition-[width] duration-200 lg:block",
          collapsed ? "w-[52px]" : "w-44",
        )}
      >
        <SidebarNav collapsed={collapsed} onToggleCollapse={() => setCollapsed((v) => !v)} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-48 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className={cn("flex min-h-screen flex-col", collapsed ? "lg:pl-[52px]" : "lg:pl-44")}>
        <Header onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="flex-1 px-3 py-2 lg:px-3.5 lg:py-2.5">{children}</main>
      </div>
    </div>
  );
}
