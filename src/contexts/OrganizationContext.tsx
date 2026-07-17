import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export type OrgRole = "owner" | "billing_admin" | "security_admin" | "member";

export interface OrganizationLite {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string | null;
}

interface OrganizationContextValue {
  organizations: OrganizationLite[];
  currentOrganization: OrganizationLite | null;
  currentOrgRole: OrgRole | null;
  setCurrentOrganizationId: (id: string | null) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

const LS_ORG = "qap.currentOrganizationId";

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationLite[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(() => localStorage.getItem(LS_ORG));
  const [currentOrgRole, setCurrentOrgRole] = useState<OrgRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [profileHydrated, setProfileHydrated] = useState(false);

  const persistProfile = useCallback(
    async (orgId: string | null) => {
      if (!user?.id) return;
      try {
        await supabase.from("profiles").update({ last_organization_id: orgId }).eq("id", user.id);
      } catch {
        /* ignore */
      }
    },
    [user?.id],
  );

  const setCurrentOrganizationId = useCallback(
    (id: string | null) => {
      setCurrentIdState(id);
      if (id) localStorage.setItem(LS_ORG, id);
      else localStorage.removeItem(LS_ORG);
      persistProfile(id);
    },
    [persistProfile],
  );

  const ensurePersonalOrg = useCallback(async (): Promise<OrganizationLite | null> => {
    if (!user?.id) return null;
    const nameBase = user.name || user.email?.split("@")[0] || "User";
    const slug = `${nameBase.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${user.id.slice(0, 8)}`;
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name: `${nameBase}'s Organization`, slug, owner_id: user.id })
      .select("id,name,slug,owner_id,require_mfa")
      .single();
    if (error) return null;
    return data as OrganizationLite;
  }, [user?.id, user?.name, user?.email]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setOrganizations([]);
      setCurrentIdState(null);
      setCurrentOrgRole(null);
      return;
    }
    setLoading(true);
    try {
      let { data: orgs } = await supabase
        .from("organizations")
        .select("id,name,slug,owner_id,require_mfa")
        .order("created_at", { ascending: true });
      let list = (orgs || []) as OrganizationLite[];

      // Guarantee at least one org
      if (list.length === 0) {
        const created = await ensurePersonalOrg();
        if (created) list = [created];
      }
      setOrganizations(list);

      let preferred = currentId;
      if (!profileHydrated) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("last_organization_id")
          .eq("id", user.id)
          .maybeSingle();
        if (prof?.last_organization_id) preferred = prof.last_organization_id;
        setProfileHydrated(true);
      }
      let active = preferred;
      if (!active || !list.find((o) => o.id === active)) active = list[0]?.id || null;
      setCurrentIdState(active);
      if (active) localStorage.setItem(LS_ORG, active);

      if (active) {
        const { data: role } = await supabase.rpc("org_role_of", { _org_id: active });
        setCurrentOrgRole((role as OrgRole) || null);
      } else {
        setCurrentOrgRole(null);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id, currentId, profileHydrated, ensurePersonalOrg]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!currentId) {
      setCurrentOrgRole(null);
      return;
    }
    supabase.rpc("org_role_of", { _org_id: currentId }).then(({ data }) => {
      setCurrentOrgRole((data as OrgRole) || null);
    });
  }, [currentId]);

  const currentOrganization = organizations.find((o) => o.id === currentId) || null;

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrganization,
        currentOrgRole,
        setCurrentOrganizationId,
        refresh,
        loading,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
}
