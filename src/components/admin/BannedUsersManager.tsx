import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Unlock, Search, AlertTriangle, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BannedUser {
  email: string;
  failedAttempts: number;
  lastAttempt: string;
}

const MAX_FAILED_ATTEMPTS = 10;

export default function BannedUsersManager() {
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [unbanningEmail, setUnbanningEmail] = useState<string | null>(null);

  const fetchBannedUsers = async () => {
    setLoading(true);
    try {
      // Get all login attempts grouped by email
      const { data, error } = await supabase
        .from('login_attempts')
        .select('email, attempted_at')
        .eq('is_successful', false)
        .order('attempted_at', { ascending: false });

      if (error) throw error;

      // Group by email and count failures
      const emailCounts: Record<string, { count: number; lastAttempt: string }> = {};
      data?.forEach((attempt) => {
        if (!emailCounts[attempt.email]) {
          emailCounts[attempt.email] = { count: 0, lastAttempt: attempt.attempted_at };
        }
        emailCounts[attempt.email].count++;
        // Keep the most recent attempt
        if (new Date(attempt.attempted_at) > new Date(emailCounts[attempt.email].lastAttempt)) {
          emailCounts[attempt.email].lastAttempt = attempt.attempted_at;
        }
      });

      // Filter only banned users (>= MAX_FAILED_ATTEMPTS)
      const banned: BannedUser[] = Object.entries(emailCounts)
        .filter(([_, info]) => info.count >= MAX_FAILED_ATTEMPTS)
        .map(([email, info]) => ({
          email,
          failedAttempts: info.count,
          lastAttempt: info.lastAttempt
        }))
        .sort((a, b) => new Date(b.lastAttempt).getTime() - new Date(a.lastAttempt).getTime());

      setBannedUsers(banned);
    } catch (error) {
      console.error('Error fetching banned users:', error);
      toast.error('Erro ao carregar usuários banidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBannedUsers();
  }, []);

  const handleUnban = async (email: string) => {
    setUnbanningEmail(email);
    try {
      const { error } = await supabase
        .from('login_attempts')
        .delete()
        .eq('email', email)
        .eq('is_successful', false);

      if (error) throw error;

      toast.success(`Usuário ${email} foi desbanido`);
      setBannedUsers(prev => prev.filter(u => u.email !== email));
    } catch (error) {
      console.error('Error unbanning user:', error);
      toast.error('Erro ao desbanir usuário');
    } finally {
      setUnbanningEmail(null);
    }
  };

  const filteredUsers = bannedUsers.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card variant="glow" className="border-destructive/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Shield className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg">Usuários Banidos</CardTitle>
              <CardDescription>
                Gerenciar usuários bloqueados por tentativas de login falhas
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchBannedUsers} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{bannedUsers.length} usuário(s) banido(s)</span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
            Carregando...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhum usuário banido</p>
            <p className="text-sm">Usuários são banidos após {MAX_FAILED_ATTEMPTS} tentativas de login falhas</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="text-center">Tentativas</TableHead>
                  <TableHead>Última Tentativa</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.email}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive">
                        {user.failedAttempts} falhas
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(user.lastAttempt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnban(user.email)}
                        disabled={unbanningEmail === user.email}
                      >
                        <Unlock className="w-4 h-4 mr-2" />
                        {unbanningEmail === user.email ? 'Desbanindo...' : 'Desbanir'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
