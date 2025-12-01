import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Webhook, Play, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WebhookData {
  id: string;
  name: string;
  url: string;
  events: string[];
  authType: 'Basic' | 'Bearer' | 'ApiKey' | 'Hawk';
  authConfig: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}

export default function WebhooksSettings() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookData | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [authType, setAuthType] = useState<'Basic' | 'Bearer' | 'ApiKey' | 'Hawk'>('Bearer');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get<WebhookData[]>('/webhooks'),
  });

  const { data: availableEvents = [] } = useQuery({
    queryKey: ['webhook-events'],
    queryFn: () => api.get<string[]>('/webhooks/events'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<WebhookData>) => api.post('/webhooks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setIsCreateOpen(false);
      setSelectedEvents([]);
      toast({ title: 'Webhook criado com sucesso!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar webhook',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WebhookData> }) =>
      api.put(`/webhooks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setIsEditOpen(false);
      setSelectedWebhook(null);
      setSelectedEvents([]);
      toast({ title: 'Webhook atualizado com sucesso!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar webhook',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast({ title: 'Webhook excluído com sucesso!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao excluir webhook',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post<{ success: boolean; status?: number; error?: string }>(`/webhooks/${id}/test`),
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: 'Webhook testado com sucesso!', description: `Status: ${data.status}` });
      } else {
        toast({
          title: 'Erro no teste do webhook',
          description: data.error || 'Falha na requisição',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Erro ao testar webhook',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (selectedWebhook) {
      setSelectedEvents(selectedWebhook.events);
      setAuthType(selectedWebhook.authType);
    }
  }, [selectedWebhook]);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const authConfig: Record<string, unknown> = {};

    if (authType === 'Basic') {
      authConfig.username = formData.get('username');
      authConfig.password = formData.get('authPassword');
    } else if (authType === 'Bearer') {
      authConfig.token = formData.get('token');
    } else if (authType === 'ApiKey') {
      authConfig.headerName = formData.get('headerName') || 'X-API-Key';
      authConfig.apiKey = formData.get('apiKey');
    } else if (authType === 'Hawk') {
      authConfig.id = formData.get('hawkId');
      authConfig.key = formData.get('hawkKey');
    }

    createMutation.mutate({
      name: formData.get('name') as string,
      url: formData.get('url') as string,
      events: selectedEvents,
      authType,
      authConfig,
      active: true,
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedWebhook) return;
    const formData = new FormData(e.currentTarget);
    const authConfig: Record<string, unknown> = {};

    if (authType === 'Basic') {
      authConfig.username = formData.get('username');
      authConfig.password = formData.get('authPassword');
    } else if (authType === 'Bearer') {
      authConfig.token = formData.get('token');
    } else if (authType === 'ApiKey') {
      authConfig.headerName = formData.get('headerName') || 'X-API-Key';
      authConfig.apiKey = formData.get('apiKey');
    } else if (authType === 'Hawk') {
      authConfig.id = formData.get('hawkId');
      authConfig.key = formData.get('hawkKey');
    }

    updateMutation.mutate({
      id: selectedWebhook.id,
      data: {
        name: formData.get('name') as string,
        url: formData.get('url') as string,
        events: selectedEvents,
        authType,
        authConfig,
      },
    });
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const toggleActive = (id: string, active: boolean) => {
    updateMutation.mutate({ id, data: { active } });
  };

  const renderAuthFields = () => {
    switch (authType) {
      case 'Basic':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                name="username"
                defaultValue={selectedWebhook?.authConfig?.username as string}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="authPassword">Senha</Label>
              <Input
                id="authPassword"
                name="authPassword"
                type="password"
                defaultValue={selectedWebhook?.authConfig?.password as string}
              />
            </div>
          </>
        );
      case 'Bearer':
        return (
          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <Input
              id="token"
              name="token"
              defaultValue={selectedWebhook?.authConfig?.token as string}
            />
          </div>
        );
      case 'ApiKey':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="headerName">Nome do Header</Label>
              <Input
                id="headerName"
                name="headerName"
                placeholder="X-API-Key"
                defaultValue={(selectedWebhook?.authConfig?.headerName as string) || 'X-API-Key'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                name="apiKey"
                defaultValue={selectedWebhook?.authConfig?.apiKey as string}
              />
            </div>
          </>
        );
      case 'Hawk':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="hawkId">Hawk ID</Label>
              <Input
                id="hawkId"
                name="hawkId"
                defaultValue={selectedWebhook?.authConfig?.id as string}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hawkKey">Hawk Key</Label>
              <Input
                id="hawkKey"
                name="hawkKey"
                type="password"
                defaultValue={selectedWebhook?.authConfig?.key as string}
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const WebhookForm = ({ onSubmit, submitLabel }: { onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; submitLabel: string }) => (
    <form onSubmit={onSubmit}>
      <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" defaultValue={selectedWebhook?.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            name="url"
            type="url"
            placeholder="https://..."
            defaultValue={selectedWebhook?.url}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo de Autenticação</Label>
          <Select value={authType} onValueChange={(v) => setAuthType(v as typeof authType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Basic">Basic Auth</SelectItem>
              <SelectItem value="Bearer">Bearer Token</SelectItem>
              <SelectItem value="ApiKey">API Key</SelectItem>
              <SelectItem value="Hawk">Hawk</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {renderAuthFields()}
        <div className="space-y-2">
          <Label>Eventos</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Selecione os eventos que dispararão este webhook
          </p>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-2">
            {availableEvents.map((event) => (
              <label
                key={event}
                className={cn(
                  'flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent text-sm',
                  selectedEvents.includes(event) && 'bg-primary/10'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="rounded"
                />
                {event}
              </label>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsCreateOpen(false);
            setIsEditOpen(false);
            setSelectedEvents([]);
          }}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Webhooks</h2>
          <p className="text-muted-foreground">
            Configure webhooks para integração com sistemas externos (n8n, Zapier, etc.)
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setSelectedEvents([]);
            setAuthType('Bearer');
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Novo Webhook</DialogTitle>
              <DialogDescription>Configure um novo webhook para receber eventos</DialogDescription>
            </DialogHeader>
            <WebhookForm onSubmit={handleCreate} submitLabel="Criar" />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Eventos Disponíveis</CardTitle>
          <CardDescription>
            Os eventos são gerados automaticamente com base nas rotas da API.
            Formato: {'{recurso}.{ação}'} (ex: auth.login, user.created)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {availableEvents.map((event) => (
              <span
                key={event}
                className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs"
              >
                {event}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum webhook cadastrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {webhook.active ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-500" />
                    )}
                    {webhook.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.active}
                      onCheckedChange={(checked) => toggleActive(webhook.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => testMutation.mutate(webhook.id)}
                      disabled={testMutation.isPending}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedWebhook(webhook);
                        setIsEditOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('Tem certeza que deseja excluir este webhook?')) {
                          deleteMutation.mutate(webhook.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground truncate mb-2">{webhook.url}</p>
                <p className="text-sm text-muted-foreground mb-2">
                  Auth: {webhook.authType}
                </p>
                <div className="flex flex-wrap gap-1">
                  {webhook.events.map((event) => (
                    <span
                      key={event}
                      className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs"
                    >
                      {event}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) {
          setSelectedWebhook(null);
          setSelectedEvents([]);
          setAuthType('Bearer');
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar Webhook</DialogTitle>
            <DialogDescription>Atualize as configurações do webhook</DialogDescription>
          </DialogHeader>
          <WebhookForm onSubmit={handleUpdate} submitLabel="Salvar" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
