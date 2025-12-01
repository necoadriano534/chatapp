import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Key, Fingerprint, Trash2, Shield } from 'lucide-react';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';

interface WebAuthnCredential {
  id: string;
  deviceType: string | null;
  createdAt: string;
}

export default function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: credentials = [] } = useQuery({
    queryKey: ['webauthn-credentials'],
    queryFn: () => api.get<WebAuthnCredential[]>('/webauthn/credentials'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.put('/auth/password', data),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Senha alterada com sucesso!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao alterar senha',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  const deleteCredentialMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/webauthn/credentials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webauthn-credentials'] });
      toast({ title: 'Chave de segurança removida!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover chave',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas não coincidem',
        description: 'A nova senha e a confirmação devem ser iguais',
        variant: 'destructive',
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A nova senha deve ter pelo menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleRegisterWebAuthn = async () => {
    try {
      // Check browser support
      if (!browserSupportsWebAuthn()) {
        toast({
          title: 'Não suportado',
          description: 'Seu navegador não suporta WebAuthn',
          variant: 'destructive',
        });
        return;
      }

      // Get registration options from server
      const options = await api.get<PublicKeyCredentialCreationOptionsJSON>('/webauthn/register-options');

      // Start registration
      const attestationResponse = await startRegistration({ optionsJSON: options });

      // Verify registration on server
      await api.post('/webauthn/register-verify', attestationResponse);

      queryClient.invalidateQueries({ queryKey: ['webauthn-credentials'] });
      toast({ title: 'Chave de segurança registrada com sucesso!' });
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        toast({
          title: 'Operação cancelada',
          description: 'O registro foi cancelado pelo usuário',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro ao registrar chave',
          description: error instanceof Error ? error.message : 'Tente novamente',
          variant: 'destructive',
        });
      }
    }
  };

  const getDeviceTypeLabel = (deviceType: string | null) => {
    if (!deviceType) return 'Desconhecido';
    switch (deviceType) {
      case 'singleDevice':
        return 'Dispositivo único (USB, NFC)';
      case 'multiDevice':
        return 'Sincronizado (Face ID, Touch ID, Windows Hello, PIN)';
      default:
        return deviceType;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Segurança</h2>
        <p className="text-muted-foreground">Gerencie sua senha e chaves de segurança</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Alterar Senha
          </CardTitle>
          <CardDescription>Atualize sua senha de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha Atual</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Chaves de Segurança (WebAuthn)
          </CardTitle>
          <CardDescription>
            Configure autenticação biométrica ou chaves de segurança físicas.
            Suporta Face ID, Touch ID, Windows Hello, PIN e chaves USB/NFC.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {credentials.length > 0 ? (
            <div className="space-y-2">
              {credentials.map((credential) => (
                <div
                  key={credential.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Shield className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{getDeviceTypeLabel(credential.deviceType)}</p>
                      <p className="text-sm text-muted-foreground">
                        Registrado em: {new Date(credential.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm('Tem certeza que deseja remover esta chave de segurança?')) {
                        deleteCredentialMutation.mutate(credential.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhuma chave de segurança registrada
            </p>
          )}
          <Button onClick={handleRegisterWebAuthn} variant="outline">
            <Fingerprint className="mr-2 h-4 w-4" />
            Adicionar Chave de Segurança
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
