import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, Database, AlertTriangle, CheckCircle, FileJson, Unlock, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BackupMetadata {
  total_profiles: number;
  total_clients: number;
  total_servers: number;
  total_plans: number;
  total_templates: number;
}

interface RestoreResults {
  plans: { inserted: number; errors: number };
  servers: { inserted: number; errors: number };
  clients: { inserted: number; errors: number };
  whatsapp_templates: { inserted: number; errors: number };
}

export default function Backup() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [lastBackupInfo, setLastBackupInfo] = useState<BackupMetadata | null>(null);
  const [restoreResults, setRestoreResults] = useState<RestoreResults | null>(null);
  const [decryptBackup, setDecryptBackup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async (decrypt: boolean = false) => {
    if (!user) return;
    
    setExporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await supabase.functions.invoke('backup-data', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: { decrypt },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const backupData = response.data;
      setLastBackupInfo(backupData.metadata);

      // Create and download the backup file
      const suffix = decrypt ? '_DESCRIPTOGRAFADO' : '';
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_clientes_control${suffix}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(decrypt ? 'Backup descriptografado exportado!' : 'Backup exportado com sucesso!');
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Erro ao exportar backup');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setShowConfirmDialog(true);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!user || !pendingFile) return;
    
    setShowConfirmDialog(false);
    setImporting(true);
    setRestoreResults(null);

    try {
      const fileContent = await pendingFile.text();
      const backupData = JSON.parse(fileContent);

      if (!backupData.version || !backupData.tables) {
        throw new Error('Formato de backup inválido');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await supabase.functions.invoke('restore-data', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: backupData,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setRestoreResults(response.data.results);
      toast.success('Backup restaurado com sucesso!');
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Erro ao importar backup');
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Backup & Restauração</h1>
          <p className="text-muted-foreground">Exporte e importe todos os dados do sistema</p>
        </div>

        {/* Warning Alert */}
        <Alert variant="default" className="border-warning/50 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Importante</AlertTitle>
          <AlertDescription className="text-warning/80">
            O backup inclui todos os dados de clientes, servidores, planos e templates. 
            Ao restaurar, os dados existentes com o mesmo ID serão atualizados.
          </AlertDescription>
        </Alert>

        {/* Export Card */}
        <Card variant="glow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Exportar Backup</CardTitle>
                <CardDescription>Baixe todos os dados do sistema em formato JSON</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <FileJson className="w-10 h-10 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">O que será exportado:</p>
                <p className="text-xs text-muted-foreground">
                  Perfis, Clientes, Servidores, Planos e Templates de WhatsApp
                </p>
              </div>
            </div>

            {/* Decrypt Option */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-dashed border-warning/50 bg-warning/5">
              <div className="flex items-center gap-3">
                {decryptBackup ? (
                  <Unlock className="w-5 h-5 text-warning" />
                ) : (
                  <Lock className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <Label htmlFor="decrypt-toggle" className="text-sm font-medium cursor-pointer">
                    Exportar Descriptografado
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Senhas e logins dos clientes serão exportados em texto limpo
                  </p>
                </div>
              </div>
              <Switch
                id="decrypt-toggle"
                checked={decryptBackup}
                onCheckedChange={setDecryptBackup}
              />
            </div>

            {decryptBackup && (
              <Alert className="border-warning/50 bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning/80 text-sm">
                  <strong>Atenção:</strong> O backup descriptografado contém senhas em texto limpo. 
                  Armazene com segurança e não compartilhe!
                </AlertDescription>
              </Alert>
            )}

            {lastBackupInfo && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="p-2 rounded bg-muted/30">
                  <p className="text-lg font-bold">{lastBackupInfo.total_profiles}</p>
                  <p className="text-xs text-muted-foreground">Perfis</p>
                </div>
                <div className="p-2 rounded bg-muted/30">
                  <p className="text-lg font-bold">{lastBackupInfo.total_clients}</p>
                  <p className="text-xs text-muted-foreground">Clientes</p>
                </div>
                <div className="p-2 rounded bg-muted/30">
                  <p className="text-lg font-bold">{lastBackupInfo.total_servers}</p>
                  <p className="text-xs text-muted-foreground">Servidores</p>
                </div>
                <div className="p-2 rounded bg-muted/30">
                  <p className="text-lg font-bold">{lastBackupInfo.total_plans}</p>
                  <p className="text-xs text-muted-foreground">Planos</p>
                </div>
                <div className="p-2 rounded bg-muted/30">
                  <p className="text-lg font-bold">{lastBackupInfo.total_templates}</p>
                  <p className="text-xs text-muted-foreground">Templates</p>
                </div>
              </div>
            )}

            <Button 
              variant={decryptBackup ? "destructive" : "gradient"}
              onClick={() => handleExport(decryptBackup)} 
              disabled={exporting}
              className="w-full"
            >
              {decryptBackup ? (
                <Unlock className="w-4 h-4 mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {exporting ? 'Exportando...' : decryptBackup ? 'Exportar Descriptografado' : 'Exportar Backup'}
            </Button>
          </CardContent>
        </Card>

        {/* Import Card */}
        <Card variant="glow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/10">
                <Upload className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <CardTitle className="text-lg">Restaurar Backup</CardTitle>
                <CardDescription>Importe dados de um arquivo de backup</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <Database className="w-10 h-10 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Restauração segura:</p>
                <p className="text-xs text-muted-foreground">
                  Dados existentes com mesmo ID serão atualizados, novos dados serão inseridos
                </p>
              </div>
            </div>

            {restoreResults && (
              <Alert className="border-success/50 bg-success/10">
                <CheckCircle className="h-4 w-4 text-success" />
                <AlertTitle className="text-success">Restauração Concluída</AlertTitle>
                <AlertDescription>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div>Planos: {restoreResults.plans.inserted} inseridos</div>
                    <div>Servidores: {restoreResults.servers.inserted} inseridos</div>
                    <div>Clientes: {restoreResults.clients.inserted} inseridos</div>
                    <div>Templates: {restoreResults.whatsapp_templates.inserted} inseridos</div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Button 
              variant="secondary" 
              onClick={() => fileInputRef.current?.click()} 
              disabled={importing}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {importing ? 'Restaurando...' : 'Selecionar Arquivo de Backup'}
            </Button>
          </CardContent>
        </Card>

        {/* Confirm Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Restauração</AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a restaurar dados do arquivo:
                <br />
                <strong className="text-foreground">{pendingFile?.name}</strong>
                <br /><br />
                Esta ação irá:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Inserir novos registros</li>
                  <li>Atualizar registros existentes com mesmo ID</li>
                </ul>
                <br />
                Deseja continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingFile(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleImport}>Confirmar Restauração</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
