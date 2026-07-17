import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Building2, Check, ChevronsUpDown, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function OrgSwitcher() {
  const { organizations, currentOrganization, setCurrentOrganizationId } = useOrganization();
  const navigate = useNavigate();

  if (!currentOrganization) return null;

  if (organizations.length <= 1) {
    return (
      <button
        onClick={() => navigate("/organization")}
        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted text-sm min-w-0"
        title="Organization settings"
      >
        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate max-w-[140px]">{currentOrganization.name}</span>
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate max-w-[140px] text-sm">{currentOrganization.name}</span>
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((o) => (
          <DropdownMenuItem key={o.id} onClick={() => setCurrentOrganizationId(o.id)}>
            <span className="flex-1 truncate">{o.name}</span>
            {o.id === currentOrganization.id && <Check className="h-4 w-4 text-accent" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/organization")}>
          <Settings className="h-4 w-4 mr-2" /> Organization settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
