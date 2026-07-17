import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TIMEZONES } from "@/lib/user-tz";
import {
  User, Shield, Palette, Globe, Key, Save, Camera, Moon, Sun, Monitor, Lock, Mail, Loader2,
} from "lucide-react";
import { MfaPanel } from "@/components/security/MfaPanel";
import { AccountDeletionPanel } from "@/components/security/AccountDeletionPanel";

type Theme = "light" | "dark" | "system";

const THEME_KEY = "qap.theme";

function applyTheme(t: Theme) {
  const root = document.documentElement;
  const isDark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}

async function signedAvatarUrl(path: string | null | undefined) {
  if (!path) return null;
  // If it's already a full URL, return as-is (older records)
  if (/^https?:\/\//.test(path)) return path;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl || null;
}

export default function SettingsPage() {
  const { user, session, refreshProfile, logout } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  // --- Profile query (full row) ---
  const { data: profile } = useQuery({
    queryKey: ["settings-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data as any;
    },
  });

  // form
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState<string>("");
  const [language, setLanguage] = useState<string>("en");
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme) || "dark",
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name || "");
    setTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    setLanguage(profile.language || "en");
    signedAvatarUrl(profile.avatar).then(setAvatarUrl);
  }, [profile]);

  // --- Save profile ---
  const saveProfile = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await (supabase as any).from("profiles").update(patch).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      qc.invalidateQueries({ queryKey: ["settings-profile", user?.id] });
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const handleSaveProfile = () => saveProfile.mutate({ name, timezone, language });
  const handleSaveAppearance = () => {
    localStorage.setItem(THEME_KEY, theme);
    saveProfile.mutate({ timezone, language });
  };

  // --- Avatar upload ---
  const onPickAvatar = () => fileRef.current?.click();
  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !user?.id) return;
    if (f.size > 2 * 1024 * 1024) { toast.error("Max 2MB"); return; }
    if (!/^image\//.test(f.type)) { toast.error("Only images allowed"); return; }
    setUploading(true);
    try {
      const ext = f.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, f, {
        upsert: true, contentType: f.type,
      });
      if (upErr) throw upErr;
      const { error: updErr } = await supabase.from("profiles").update({ avatar: path }).eq("id", user.id);
      if (updErr) throw updErr;
      const url = await signedAvatarUrl(path);
      setAvatarUrl(url);
      await refreshProfile();
      qc.invalidateQueries({ queryKey: ["settings-profile", user.id] });
      toast.success("Photo updated");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // --- Password change ---
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwErr, setPwErr] = useState("");

  const changePw = useMutation({
    mutationFn: async () => {
      setPwErr("");
      if (newPw.length < 8) throw new Error("Password must be at least 8 characters");
      if (newPw !== confirmPw) throw new Error("Passwords don't match");
      // Verify current password by re-authenticating
      const email = user?.email;
      if (!email) throw new Error("No email on session");
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: currentPw });
      if (signErr) throw new Error("Current password is incorrect");
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password updated");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    },
    onError: (e: any) => { setPwErr(e?.message || "Update failed"); toast.error(e?.message || "Update failed"); },
  });

  // --- Sign out other sessions ---
  const signOutOthers = useMutation({
    mutationFn: async () => {
      // Supabase JS: 'others' scope signs out all except current
      const { error } = await supabase.auth.signOut({ scope: "others" } as any);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Other sessions signed out"),
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const currentUA = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const browserLabel = /Chrome/.test(currentUA) ? "Chrome"
    : /Firefox/.test(currentUA) ? "Firefox"
    : /Safari/.test(currentUA) ? "Safari" : "Browser";
  const osLabel = /Mac/.test(currentUA) ? "macOS"
    : /Windows/.test(currentUA) ? "Windows"
    : /Linux/.test(currentUA) ? "Linux"
    : /iPhone|iPad|iOS/.test(currentUA) ? "iOS"
    : /Android/.test(currentUA) ? "Android" : "Unknown";

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Manage your account and application preferences"
        />

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="flex items-center gap-2"><User className="h-4 w-4" />Profile</TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2"><Palette className="h-4 w-4" />Appearance</TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2"><Shield className="h-4 w-4" />Security</TabsTrigger>
          </TabsList>

          {/* ========== PROFILE ========== */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information and profile picture</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                      {name?.charAt(0).toUpperCase() || user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <input ref={fileRef} type="file" accept="image/*" onChange={onAvatarChange} className="hidden" />
                    <Button variant="outline" size="sm" onClick={onPickAvatar} disabled={uploading}>
                      {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                      {uploading ? "Uploading…" : "Change Photo"}
                    </Button>
                    <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max size 2MB.</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" value={user?.email || ""} disabled />
                    <p className="text-xs text-muted-foreground">Contact support to change your email</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Input id="role" value={user?.role?.replace("_", " ") || ""} disabled />
                  </div>
                </div>

                <div>
                  <Button onClick={handleSaveProfile} disabled={saveProfile.isPending} className="ai-gradient text-white">
                    {saveProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== APPEARANCE ========== */}
          <TabsContent value="appearance" className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>Customize the look and feel of the application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  {([
                    ["light", Sun, "Light"],
                    ["dark", Moon, "Dark"],
                    ["system", Monitor, "System"],
                  ] as const).map(([t, Icon, label]) => (
                    <motion.button
                      key={t}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => { setThemeState(t); localStorage.setItem(THEME_KEY, t); applyTheme(t); }}
                      className={`p-4 rounded-lg border-2 transition-colors ${theme === t ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Icon className="h-8 w-8" />
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Language & Region</CardTitle>
                <CardDescription>Set your preferred language and regional settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="pt">Português</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Button onClick={handleSaveAppearance} disabled={saveProfile.isPending} className="ai-gradient text-white">
                    {saveProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== SECURITY ========== */}
          <TabsContent value="security" className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />Password</CardTitle>
                <CardDescription>Change your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pwErr && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {pwErr}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => changePw.mutate()}
                  disabled={changePw.isPending || !currentPw || !newPw || !confirmPw}
                >
                  {changePw.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                  Update Password
                </Button>
              </CardContent>
            </Card>

            <MfaPanel />

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Session Management</CardTitle>
                <CardDescription>Your current session and options to revoke others</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                  <div>
                    <p className="font-medium">Current Session</p>
                    <p className="text-sm text-muted-foreground">
                      {browserLabel} on {osLabel}
                      {session?.expires_at ? ` • expires ${new Date(session.expires_at * 1000).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Per-device session listing isn't available client-side yet. You can revoke every other session below —
                  this signs out all devices except the one you're on.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => signOutOthers.mutate()}
                    disabled={signOutOthers.isPending}
                  >
                    {signOutOthers.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Sign Out All Other Sessions
                  </Button>
                  <Button variant="ghost" onClick={() => logout()}>Sign out this device</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
