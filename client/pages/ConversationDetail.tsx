import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Send, ArrowLeft, XCircle, CheckCircle, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { initializeSocket, joinConversation, leaveConversation, getSocket } from '@/lib/socket';

interface Message {
  id: string;
  content: string;
  senderId: string;
  sender: { id: string; name: string };
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  protocol: string;
  status: 'pending' | 'active' | 'closed';
  client: { id: string; name: string; email: string };
  attendant: { id: string; name: string; email: string } | null;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const { data: conversation, isLoading } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api.get<ConversationDetail>(`/conversations/${id}`),
    enabled: !!id,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      api.post('/messages', { conversationId: id, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      setMessage('');
    },
    onError: (error) => {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: () => api.post(`/conversations/${id}/assign`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
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

  const closeMutation = useMutation({
    mutationFn: () => api.post(`/conversations/${id}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      toast({ title: 'Conversa encerrada!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao encerrar conversa',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  // Initialize socket and join conversation room
  useEffect(() => {
    if (token && id) {
      const socket = initializeSocket(token);
      joinConversation(id);

      // Listen for new messages
      socket.on('message:new', (newMessage: Message) => {
        queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      });

      // Listen for typing events
      socket.on('typing:user', ({ user: typingUserInfo }: { user: { id: string; name: string } }) => {
        if (typingUserInfo.id !== user?.id) {
          setTypingUser(typingUserInfo.name);
        }
      });

      socket.on('typing:stop', () => {
        setTypingUser(null);
      });

      return () => {
        leaveConversation(id);
        socket.off('message:new');
        socket.off('typing:user');
        socket.off('typing:stop');
      };
    }
  }, [token, id, user?.id, queryClient]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const canSendMessage = () => {
    if (!conversation) return false;
    if (conversation.status === 'closed') return false;
    if (user?.role === 'client' && conversation.status === 'pending') return false;
    if (user?.role === 'attendant' && conversation.attendantId !== user.id) return false;
    return true;
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { icon: Clock, label: 'Aguardando atendimento', color: 'text-yellow-500' };
      case 'active':
        return { icon: CheckCircle, label: 'Em atendimento', color: 'text-green-500' };
      case 'closed':
        return { icon: XCircle, label: 'Encerrada', color: 'text-gray-500' };
      default:
        return { icon: Clock, label: status, color: 'text-gray-500' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground">Conversa não encontrada</p>
        <Button variant="link" onClick={() => navigate('/conversations')}>
          Voltar para conversas
        </Button>
      </div>
    );
  }

  const statusInfo = getStatusInfo(conversation.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <Card className="mb-4">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/conversations')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  #{conversation.protocol}
                  <StatusIcon className={cn('h-4 w-4', statusInfo.color)} />
                </CardTitle>
                <p className="text-sm text-muted-foreground">{statusInfo.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(user?.role === 'attendant' || user?.role === 'admin') &&
                conversation.status === 'pending' && (
                  <Button onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
                    Atender
                  </Button>
                )}
              {conversation.status === 'active' &&
                (user?.role === 'admin' || user?.id === conversation.attendant?.id) && (
                  <Button
                    variant="outline"
                    onClick={() => closeMutation.mutate()}
                    disabled={closeMutation.isPending}
                  >
                    Encerrar
                  </Button>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-2 border-t">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Cliente: {conversation.client.name}</span>
            </div>
            {conversation.attendant && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Atendente: {conversation.attendant.name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {conversation.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p>Nenhuma mensagem ainda</p>
              {conversation.status === 'pending' && user?.role === 'client' && (
                <p className="text-sm mt-2">Aguardando um atendente aceitar a conversa</p>
              )}
            </div>
          ) : (
            conversation.messages.map((msg) => {
              const isOwnMessage = msg.senderId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    isOwnMessage ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[70%] rounded-lg px-4 py-2',
                      isOwnMessage
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <p className="text-xs font-medium mb-1">
                      {isOwnMessage ? 'Você' : msg.sender.name}
                    </p>
                    <p className="break-words">{msg.content}</p>
                    <p
                      className={cn(
                        'text-xs mt-1',
                        isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          {typingUser && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2 text-sm text-muted-foreground">
                {typingUser} está digitando...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input */}
        {canSendMessage() && (
          <div className="border-t p-4">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                disabled={sendMessageMutation.isPending}
              />
              <Button type="submit" disabled={!message.trim() || sendMessageMutation.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}
        {!canSendMessage() && conversation.status !== 'closed' && (
          <div className="border-t p-4 text-center text-muted-foreground text-sm">
            {conversation.status === 'pending'
              ? 'Aguardando um atendente aceitar a conversa para enviar mensagens'
              : 'Você não pode enviar mensagens nesta conversa'}
          </div>
        )}
        {conversation.status === 'closed' && (
          <div className="border-t p-4 text-center text-muted-foreground text-sm">
            Esta conversa foi encerrada
          </div>
        )}
      </Card>
    </div>
  );
}
