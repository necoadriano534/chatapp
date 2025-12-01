import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Clock, CheckCircle, XCircle, Plus, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  protocol: string;
  status: 'pending' | 'active' | 'closed';
  client: { id: string; name: string; email: string };
  attendant: { id: string; name: string; email: string } | null;
  lastMessage: { content: string; createdAt: string } | null;
  createdAt: string;
  updatedAt: string;
}

export default function Conversations() {
  const [activeTab, setActiveTab] = useState('all');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<Conversation[]>('/conversations'),
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const createMutation = useMutation({
    mutationFn: (data: { initialMessage?: string }) =>
      api.post('/conversations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast({ title: 'Conversa iniciada com sucesso!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao iniciar conversa',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (conversationId: string) =>
      api.post(`/conversations/${conversationId}/assign`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast({ title: 'Conversa atribuída a você!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atribuir conversa',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  const filteredConversations = conversations.filter((conv) => {
    if (activeTab === 'all') return true;
    return conv.status === activeTab;
  });

  const pendingCount = conversations.filter((c) => c.status === 'pending').length;
  const activeCount = conversations.filter((c) => c.status === 'active').length;
  const closedCount = conversations.filter((c) => c.status === 'closed').length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'closed':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'active':
        return 'Ativo';
      case 'closed':
        return 'Fechado';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Conversas</h1>
        {user?.role === 'client' && (
          <Button onClick={() => createMutation.mutate({})}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Conversa
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            Todas ({conversations.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pendentes ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="active">
            Ativas ({activeCount})
          </TabsTrigger>
          <TabsTrigger value="closed">
            Fechadas ({closedCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma conversa encontrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredConversations.map((conversation) => (
                <Card
                  key={conversation.id}
                  className={cn(
                    'transition-colors hover:bg-accent/50',
                    conversation.status === 'pending' && 'border-yellow-500/50'
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getStatusIcon(conversation.status)}
                        <span>#{conversation.protocol}</span>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'px-2 py-1 rounded-full text-xs',
                            conversation.status === 'pending' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                            conversation.status === 'active' && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                            conversation.status === 'closed' && 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                          )}
                        >
                          {getStatusLabel(conversation.status)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Cliente:</span>{' '}
                        {conversation.client.name}
                      </p>
                      {conversation.attendant && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Atendente:</span>{' '}
                          {conversation.attendant.name}
                        </p>
                      )}
                      {conversation.lastMessage && (
                        <p className="text-sm text-muted-foreground truncate">
                          Última mensagem: {conversation.lastMessage.content}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Criado em: {new Date(conversation.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Link to={`/conversations/${conversation.id}`} className="flex-1">
                        <Button variant="outline" className="w-full">
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Ver Conversa
                        </Button>
                      </Link>
                      {(user?.role === 'attendant' || user?.role === 'admin') &&
                        conversation.status === 'pending' && (
                          <Button
                            onClick={() => assignMutation.mutate(conversation.id)}
                            disabled={assignMutation.isPending}
                          >
                            <UserCheck className="mr-2 h-4 w-4" />
                            Atender
                          </Button>
                        )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
