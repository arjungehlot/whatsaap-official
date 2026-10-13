import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import {
  Activity,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Key,
  Pencil,
  Plus,
  Save,
  Smartphone,
  Shield,
  TerminalSquare,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiKeyService, whatsappService } from "@/services";
import { relative } from "@/lib/format";
import type { ApiKey, WhatsAppAccount } from "@/types";

export const Route = createFileRoute("/_shell/api-docs")({
  head: () => ({
    meta: [
      { title: "API & Documentation - WAFlow" },
      { name: "description", content: "Live WAFlow API documentation generated from the current backend." },
      { property: "og:title", content: "API & Documentation - WAFlow" },
      { property: "og:description", content: "Swagger-powered REST API reference for the current WAFlow backend." },
    ],
  }),
  component: ApiDocsPage,
});

type OpenApiSpec = {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: { url: string; description?: string }[];
  paths: Record<string, Record<string, unknown>>;
  tags?: { name: string }[];
};

type SwaggerRequest = {
  headers?: Record<string, string>;
};

const AUTH_KEY = "waflow.session";
const API_KEY_STORAGE_KEY = "waflow.docs.apiKey";
const API_KEY_VAULT_STORAGE_KEY = "waflow.docs.apiKeyVault";
const API_BASE_URL = (import.meta.env["VITE_API_BASE_URL"] || "http://localhost:5000/api").replace(/\/$/, "");

function getToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_KEY) || "";
}

function copy(value: string, label: string) {
  void navigator.clipboard?.writeText(value);
  toast.success(`${label} copied`);
}

function getApiKeyVault() {
  if (typeof window === "undefined") return {} as Record<string, string>;
  try {
    return JSON.parse(window.localStorage.getItem(API_KEY_VAULT_STORAGE_KEY) || "{}") as Record<string, string>;
  } catch (_error) {
    return {} as Record<string, string>;
  }
}

function saveApiKeyToVault(key: ApiKey) {
  if (typeof window === "undefined" || !key.key) return;
  const vault = getApiKeyVault();
  vault[key.id] = key.key;
  window.localStorage.setItem(API_KEY_VAULT_STORAGE_KEY, JSON.stringify(vault));
}

function removeApiKeyFromVault(id: string) {
  if (typeof window === "undefined") return;
  const vault = getApiKeyVault();
  delete vault[id];
  window.localStorage.setItem(API_KEY_VAULT_STORAGE_KEY, JSON.stringify(vault));
}

function environmentLabel(url: string) {
  if (/localhost|127\.0\.0\.1/i.test(url)) return "Local";
  return "Production";
}

function methodCount(spec: OpenApiSpec | null) {
  if (!spec) return 0;
  return Object.values(spec.paths).reduce((total, pathItem) => total + Object.keys(pathItem).length, 0);
}

function ApiDocsPage() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [apiKey, setApiKey] = useState(() => (typeof window === "undefined" ? "" : window.localStorage.getItem(API_KEY_STORAGE_KEY) || ""));
  const [newKeyLabel, setNewKeyLabel] = useState("Production integration");
  const [newKeyAccountId, setNewKeyAccountId] = useState("");
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [editingKeyLabel, setEditingKeyLabel] = useState("");
  const [editingKeyAccountId, setEditingKeyAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [savingKey, setSavingKey] = useState(false);
  const [savingKeyUpdate, setSavingKeyUpdate] = useState(false);
  const [revokingId, setRevokingId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const docsUrl = `${API_BASE_URL}/docs/openapi.json`;
  const serverUrl = spec?.servers?.[0]?.url || API_BASE_URL;
  const token = getToken();
  const swaggerSpec = spec as unknown as Record<string, unknown> | null;
  const endpointCount = methodCount(spec);
  const tagCount = spec?.tags?.length ?? 0;

  const requestInterceptor = useMemo(
    () => (request: SwaggerRequest) => {
      const selectedKey = typeof window === "undefined" ? apiKey : window.localStorage.getItem(API_KEY_STORAGE_KEY) || apiKey;
      const headers = { ...(request.headers || {}) };
      const hasApiKeyHeader = Object.keys(headers).some((name) => name.toLowerCase() === "x-api-key");

      // Respect a value entered through Swagger Authorize; otherwise use the API Docs test key.
      if (selectedKey && !hasApiKeyHeader) {
        headers["X-API-Key"] = selectedKey;
      }

      request.headers = headers;
      return request;
    },
    [apiKey],
  );

  async function loadSpec() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(docsUrl, {
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });
      if (!response.ok) throw new Error(`OpenAPI request failed with ${response.status}`);
      setSpec((await response.json()) as OpenApiSpec);
    } catch (loadError) {
      setSpec(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load API docs");
    } finally {
      setLoading(false);
    }
  }

  async function loadKeys() {
    if (!token) {
      setKeys([]);
      setLoadingKeys(false);
      return;
    }

    setLoadingKeys(true);
    try {
      setKeys(await apiKeyService.list());
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Unable to load API keys");
    } finally {
      setLoadingKeys(false);
    }
  }

  async function loadAccounts() {
    if (!token) {
      setAccounts([]);
      setLoadingAccounts(false);
      return;
    }

    setLoadingAccounts(true);
    try {
      const rows = await whatsappService.getAccounts();
      const connected = rows.filter((account) => account.state === "CONNECTED");
      setAccounts(connected);
      setNewKeyAccountId((current) => current || connected[0]?.id || "");
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Unable to load WhatsApp numbers");
    } finally {
      setLoadingAccounts(false);
    }
  }

  async function createKey() {
    const label = newKeyLabel.trim();
    if (label.length < 2) {
      toast.error("Enter a key label");
      return;
    }
    if (!newKeyAccountId) {
      toast.error("Choose the WhatsApp number for this API key");
      return;
    }

    setSavingKey(true);
    try {
      const created = await apiKeyService.create({
        label,
        environment: environmentLabel(serverUrl) === "Local" ? "test" : "live",
        defaultAccountId: newKeyAccountId,
        scopes: ["messages:write", "contacts:read", "contacts:write", "templates:read", "templates:write", "campaigns:read", "campaigns:write", "whatsapp:read", "whatsapp:manage"],
      });
      setKeys((current) => [created, ...current]);
      saveApiKeyToVault(created);
      if (created.key) {
        setApiKey(created.key);
        window.localStorage.setItem(API_KEY_STORAGE_KEY, created.key);
      }
      toast.success("API key created", { description: "Copy it now. The full key is shown only once." });
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : "Unable to create API key");
    } finally {
      setSavingKey(false);
    }
  }

  function knownKeyFor(key: ApiKey) {
    const vaultKey = getApiKeyVault()[key.id];
    if (vaultKey) return vaultKey;
    return apiKey.startsWith(key.prefix) ? apiKey : "";
  }

  function openKeyEditor(key: ApiKey) {
    setEditingKey(key);
    setEditingKeyLabel(key.label);
    setEditingKeyAccountId(key.defaultChannelId || "");
  }

  async function updateKey() {
    if (!editingKey) return;
    const label = editingKeyLabel.trim();
    if (label.length < 2) {
      toast.error("Enter a key label");
      return;
    }
    if (!editingKeyAccountId) {
      toast.error("Choose the WhatsApp number for this API key");
      return;
    }

    setSavingKeyUpdate(true);
    try {
      const updated = await apiKeyService.update(editingKey.id, {
        label,
        defaultAccountId: editingKeyAccountId,
      });
      setKeys((current) => current.map((key) => (key.id === updated.id ? updated : key)));
      setEditingKey(null);
      toast.success("API key updated", { description: "Existing integrations keep using the same API key." });
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "Unable to update API key");
    } finally {
      setSavingKeyUpdate(false);
    }
  }

  async function revokeKey(key: ApiKey) {
    setRevokingId(key.id);
    try {
      await apiKeyService.revoke(key.id);
      const removedKey = knownKeyFor(key);
      setKeys((current) => current.filter((currentKey) => currentKey.id !== key.id));
      removeApiKeyFromVault(key.id);
      if (removedKey && apiKey === removedKey) {
        setApiKey("");
      }
      await loadKeys();
      toast.success("API key revoked");
    } catch (revokeError) {
      toast.error(revokeError instanceof Error ? revokeError.message : "Unable to revoke API key");
    } finally {
      setRevokingId("");
    }
  }

  useEffect(() => {
    void loadSpec();
  }, [docsUrl]);

  useEffect(() => {
    void loadKeys();
    void loadAccounts();
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (apiKey) window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    else window.localStorage.removeItem(API_KEY_STORAGE_KEY);
  }, [apiKey]);

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="API & Documentation"
        description={
          spec
            ? `${spec.info.title} ${spec.info.version} - loaded from ${serverUrl}`
            : `Loading docs from ${docsUrl}`
        }
        actions={
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" className="h-8 text-xs px-3" onClick={loadSpec} disabled={loading}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          { label: "Environment", value: environmentLabel(serverUrl), icon: Server, color: "bg-purple-500" },
          { label: "Base URL", value: serverUrl.replace(/^https?:\/\//, ""), icon: Activity, color: "bg-blue-500" },
          { label: "Endpoints", value: String(endpointCount), icon: CheckCircle2, color: "bg-emerald-500" },
          { label: "Auth", value: apiKey ? "API key ready" : "API key needed", icon: ShieldCheck, color: "bg-orange-500" },
        ].map((stat, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm transition-all hover:shadow-md">
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg shadow-inner text-white ${stat.color}`}>
              <stat.icon className="size-4 drop-shadow-sm" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
              <p className="truncate text-sm font-semibold text-foreground leading-tight mt-0.5">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="reference">
        <TabsList>
          <TabsTrigger value="reference">API reference</TabsTrigger>
          <TabsTrigger value="keys">API keys</TabsTrigger>
          {/* <TabsTrigger value="guide">Testing guide</TabsTrigger> */}
        </TabsList>

        <TabsContent value="reference" className="mt-4">
          {loading ? (
            <div className="card-surface flex min-h-80 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading live OpenAPI spec...
            </div>
          ) : error ? (
            <EmptyState
              icon={Server}
              title="Could not load API docs"
              description={`${error}. Check that the backend is running and VITE_API_BASE_URL points to the correct API.`}
            />
          ) : swaggerSpec ? (
            <div className="waflow-swagger overflow-hidden rounded-xl border border-border bg-white shadow-card">
              <SwaggerUI
                spec={swaggerSpec}
                docExpansion="list"
                defaultModelsExpandDepth={1}
                displayRequestDuration
                tryItOutEnabled
                persistAuthorization
                requestInterceptor={requestInterceptor}
              />
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="keys" className="mt-6 space-y-6">
          <div>
            <SectionCard
              title="Create New Key"
              description="Bind a key to a WhatsApp number."
            >
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-5">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="api-key-label" className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Key label</Label>
                    <Input id="api-key-label" value={newKeyLabel} onChange={(event) => setNewKeyLabel(event.target.value)} placeholder="Production website" className="bg-surface-muted" />
                  </div>
                  <div className="space-y-2 sm:col-span-3">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">WhatsApp number</Label>
                    <Select value={newKeyAccountId} onValueChange={setNewKeyAccountId} disabled={loadingAccounts || accounts.length === 0}>
                      <SelectTrigger className="bg-surface-muted max-w-full">
                        <div className="flex flex-1 items-center gap-2 min-w-0 pr-2">
                          <Smartphone className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            <SelectValue placeholder={loadingAccounts ? "Loading numbers..." : "Choose number"} />
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.displayName} - {account.phone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex-1">
                    {!loadingAccounts && accounts.length === 0 ? (
                      <p className="text-sm text-destructive font-medium flex items-center gap-1"><Shield className="size-4" /> Connect a WhatsApp number first.</p>
                    ) : !token ? (
                      <p className="text-sm text-destructive font-medium flex items-center gap-1"><Shield className="size-4" /> Login required to create keys.</p>
                    ) : <span className="text-xs text-muted-foreground">Permissions: messages:write, contacts:read/write...</span>}
                  </div>
                  <Button onClick={createKey} disabled={savingKey || !token || loadingAccounts || !newKeyAccountId} className="shrink-0">
                    {savingKey ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus className="size-4 mr-2" />}
                    Create Key
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Generated API Keys"
            description="Manage your existing API keys. For security, only the prefix of older keys is visible."
            bodyClassName="p-0 overflow-hidden"
          >
            {loadingKeys ? (
              <div className="flex flex-col items-center justify-center gap-3 p-12 text-sm text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p>Loading your keys...</p>
              </div>
            ) : keys.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                <div className="rounded-full bg-surface-muted p-4 mb-2">
                  <Key className="size-8 text-muted-foreground opacity-50" />
                </div>
                <p className="text-base font-medium">No API keys yet</p>
                <p className="text-sm text-muted-foreground max-w-sm">Create your first API key above to start integrating with our services.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-3xl text-sm whitespace-nowrap">
                  <thead className="bg-slate-50/80 backdrop-blur-md text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Key Details</th>
                      <th className="px-6 py-4 font-semibold">Environment</th>
                      <th className="px-6 py-4 font-semibold">WhatsApp Binding</th>
                      <th className="px-6 py-4 font-semibold">Last Used</th>
                      <th className="px-6 py-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {keys.map((key) => (
                      <tr key={key.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl border border-primary/10 bg-primary/5 p-2.5 text-primary shadow-sm dark:bg-primary/10">
                              <TerminalSquare className="size-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100">{key.label}</p>
                              <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                                {key.prefix}<span className="tracking-widest opacity-50">••••••••</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${key.environment === 'live' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                            {key.environment === 'live' ? 'Live' : 'Test'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
                              <Smartphone className="size-3.5" />
                            </div>
                            <div>
                              <p className="font-medium text-[13px] text-slate-900 dark:text-slate-100">{key.defaultAccountName || "Any connected number"}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{key.defaultAccountPhone || "No default binding"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {key.lastUsedAt ? (
                            <span className="text-slate-600 dark:text-slate-300 font-medium">{relative(key.lastUsedAt)}</span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">Never</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              title={knownKeyFor(key) ? "Copy the full API key stored in this browser" : "The full key is not stored in this browser"}
                              disabled={!knownKeyFor(key)}
                              onClick={() => copy(knownKeyFor(key), "API key")}
                              className={knownKeyFor(key) ? "h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10" : "h-8 w-8 p-0 opacity-50"}
                            >
                              <Copy className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit API key binding"
                              onClick={() => openKeyEditor(key)}
                              className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <ConfirmDialog
                              title="Revoke this API key?"
                              description="This permanently removes the key. Any external integration using it will immediately stop working."
                              confirmLabel="Revoke key"
                              onConfirm={() => revokeKey(key)}
                              trigger={
                                <Button variant="ghost" size="sm" disabled={revokingId === key.id} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="size-4" />
                                </Button>
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <Dialog open={Boolean(editingKey)} onOpenChange={(open) => !open && setEditingKey(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit API key</DialogTitle>
                <DialogDescription>
                  Rebind this integration to a currently connected WhatsApp number. Its API key value and permissions remain unchanged.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-api-key-label">Key label</Label>
                  <Input
                    id="edit-api-key-label"
                    value={editingKeyLabel}
                    onChange={(event) => setEditingKeyLabel(event.target.value)}
                    disabled={savingKeyUpdate}
                  />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp number</Label>
                  <Select
                    value={editingKeyAccountId}
                    onValueChange={setEditingKeyAccountId}
                    disabled={savingKeyUpdate || loadingAccounts || accounts.length === 0}
                  >
                    <SelectTrigger>
                      <div className="flex flex-1 items-center gap-2 min-w-0 pr-2">
                        <Smartphone className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate"><SelectValue placeholder={loadingAccounts ? "Loading numbers..." : "Choose number"} /></span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.displayName} - {account.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!loadingAccounts && accounts.length === 0 ? (
                    <p className="text-sm text-destructive">Connect the replacement WhatsApp number first.</p>
                  ) : null}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingKey(null)} disabled={savingKeyUpdate}>Cancel</Button>
                <Button onClick={() => void updateKey()} disabled={savingKeyUpdate || loadingAccounts || accounts.length === 0}>
                  {savingKeyUpdate ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="guide" className="mt-4">
          <SectionCard
            title="Groups: find the IDs before changing members"
            description="Use these steps for add, remove, promote, and demote. Each API key already has a default WhatsApp number, so channelId is usually not needed."
          >
            <ol className="grid gap-4 text-sm md:grid-cols-3">
              <li className="border-l-2 border-primary pl-3">
                <p className="font-medium">1. Find the group ID</p>
                <p className="mt-1 text-muted-foreground">
                  Call <code>GET /v1/wa/groups</code>. Copy <code>groups[].groupId</code>, for example <code>120363428797010401@g.us</code>.
                </p>
              </li>
              <li className="border-l-2 border-primary pl-3">
                <p className="font-medium">2. Find a member JID</p>
                <p className="mt-1 text-muted-foreground">
                  Call <code>GET /v1/wa/groups/&#123;groupId&#125;</code>. Copy the exact <code>group.members[].jid</code> value for an existing member.
                </p>
              </li>
              <li className="border-l-2 border-primary pl-3">
                <p className="font-medium">3. Choose the correct value</p>
                <p className="mt-1 text-muted-foreground">
                  For <code>add</code>, send a phone number or direct WhatsApp JID. For <code>remove</code>, <code>promote</code>, and <code>demote</code>, send member JIDs returned in step 2.
                </p>
              </li>
            </ol>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted p-3">
              <code className="break-all font-mono text-xs">POST {serverUrl}/v1/wa/groups/&#123;groupId&#125;/participants</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(`${serverUrl}/v1/wa/groups/{groupId}/participants`, "Group participant endpoint")}
              >
                <Copy className="size-4" /> Copy endpoint
              </Button>
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Current backend">
              <dl className="divide-y divide-border text-sm">
                {[
                  ["Docs endpoint", docsUrl],
                  ["API server", serverUrl],
                  ["OpenAPI", spec?.openapi || "-"],
                  ["Tags", String(tagCount)],
                  ["Endpoints", String(endpointCount)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="max-w-[65%] truncate text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>

            <SectionCard title="Authorization">
              <p className="text-sm text-muted-foreground">
                Integration endpoints use an API key in the X-API-Key header. Each key is bound to a WhatsApp number, so send APIs use that number automatically. Pass channelId only when the key is allowed for that same channel.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(apiKey, "API key")}
                  disabled={!apiKey}
                >
                  <Copy className="size-4" /> Copy API key
                </Button>
                <Button variant="outline" size="sm" onClick={() => copy(serverUrl, "API server")}>
                  <Copy className="size-4" /> Copy server URL
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Example curl">
              <pre className="overflow-auto rounded-lg bg-surface-muted p-3 font-mono text-xs">
                {`curl "${serverUrl}/contacts?limit=10" \\
  -H "X-API-Key: ${apiKey ? "<your-api-key>" : "<create-api-key-first>"}"`}
              </pre>
            </SectionCard>

            <SectionCard title="Environment behavior">
              <p className="text-sm text-muted-foreground">
                Local frontend defaults to http://localhost:5000/api. Production should set VITE_API_BASE_URL to the
                production API URL, and this page will load the production spec automatically.
              </p>
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
