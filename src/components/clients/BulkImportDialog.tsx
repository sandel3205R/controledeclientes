import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useCrypto } from '@/hooks/useCrypto';
import { toast } from 'sonner';
import { Copy, FileText, Loader2, AlertTriangle } from 'lucide-react';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  servers: { id: string; name: string }[];
}

interface ParsedClient {
  name: string;
  phone: string | null;
  login: string | null;
  password: string | null;
  server_name: string | null;
  plan_price: number | null;
  expiration_date: string;
  isDuplicate?: boolean;
  duplicateReason?: string;
}

const EXAMPLE_FORMAT = `Nome,Telefone,Usuário,Senha,Servidor,Valor,Data
Maria Santos,11912345678,maria123,senha123,ULTRA TV,25,20/01/2026
Carlos Oliveira,21987654321,carlos456,minhasenha,MEGA PLAY,30,15/02/2026
João Silva,31999887766,joao789,123456,IPTV PREMIUM,35,10/03/2026`;

const HEADER_LINE = 'Nome,Telefone,Usuário,Senha,Servidor,Valor,Data';

export default function BulkImportDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  servers 
}: BulkImportDialogProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ParsedClient[]>([]);
  const { encryptCredentials } = useCrypto();

  const parseDate = (dateStr: string): string => {
    if (!dateStr || !dateStr.trim()) {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      return date.toISOString().split('T')[0];
    }
    
    // Handle DD/MM/YYYY or DD-MM-YYYY format
    const parts = dateStr.trim().split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${year}-${month}-${day}`;
    }
    // Default to 30 days from now
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  };

  const cleanPhone = (phone: string): string | null => {
    if (!phone) return null;
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned || cleaned.length < 8) return null;
    // Add Brazil country code if not present
    if (cleaned.length <= 11 && !cleaned.startsWith('55')) {
      return '+55' + cleaned;
    }
    return '+' + cleaned;
  };

  const parseClients = (inputText: string): ParsedClient[] => {
    const clients: ParsedClient[] = [];
    const lines = inputText.trim().split('\n').filter(line => line.trim());
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip header line
      if (line.toLowerCase().startsWith('nome,') || 
          line.toLowerCase() === HEADER_LINE.toLowerCase()) {
        continue;
      }
      
      // Parse CSV line - handle quoted values
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      // Expected format: Nome,Telefone,Usuário,Senha,Servidor,Valor,Data
      const [name, phone, login, password, serverName, valorStr, dataStr] = values;
      
      if (!name || !name.trim()) continue;
      
      const valor = valorStr ? parseFloat(valorStr.replace(',', '.')) : null;
      
      clients.push({
        name: name.trim(),
        phone: cleanPhone(phone || ''),
        login: login?.trim() || null,
        password: password?.trim() || null,
        server_name: serverName?.trim() || null,
        plan_price: valor && !isNaN(valor) ? valor : null,
        expiration_date: parseDate(dataStr || ''),
      });
    }

    return clients;
  };

  const checkDuplicates = async (clients: ParsedClient[]): Promise<ParsedClient[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return clients;

    const { data: existingClients } = await supabase
      .from('clients')
      .select('name, phone, login')
      .eq('seller_id', user.id);

    if (!existingClients) return clients;

    return clients.map(client => {
      const duplicates: string[] = [];
      
      if (client.name && existingClients.some(e => e.name?.toLowerCase() === client.name.toLowerCase())) {
        duplicates.push('nome');
      }
      if (client.phone && existingClients.some(e => e.phone === client.phone)) {
        duplicates.push('telefone');
      }
      if (client.login && existingClients.some(e => e.login === client.login)) {
        duplicates.push('usuário');
      }

      return {
        ...client,
        isDuplicate: duplicates.length > 0,
        duplicateReason: duplicates.length > 0 ? `Duplicado: ${duplicates.join(', ')}` : undefined
      };
    });
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const parsed = parseClients(text);
      const withDuplicates = await checkDuplicates(parsed);
      setPreview(withDuplicates);
      
      const duplicateCount = withDuplicates.filter(c => c.isDuplicate).length;
      if (parsed.length === 0) {
        toast.error('Nenhum cliente encontrado. Verifique o formato.');
      } else if (duplicateCount > 0) {
        toast.warning(`${parsed.length} cliente(s) detectado(s), ${duplicateCount} duplicado(s)`);
      } else {
        toast.success(`${parsed.length} cliente(s) detectado(s)`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const parsed = parseClients(text);
    const clientsWithDuplicates = await checkDuplicates(parsed);
    const clients = clientsWithDuplicates.filter(c => !c.isDuplicate);
    
    if (clients.length === 0) {
      toast.error('Nenhum cliente válido para importar (todos são duplicados)');
      return;
    }

    const skippedCount = clientsWithDuplicates.length - clients.length;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      let successCount = 0;
      let errorCount = 0;

      for (const client of clients) {
        // Try to match server by name
        let serverId: string | null = null;
        let serverName = client.server_name;
        
        if (client.server_name) {
          const matchedServer = servers.find(s => 
            s.name.toLowerCase().includes(client.server_name!.toLowerCase()) ||
            client.server_name!.toLowerCase().includes(s.name.toLowerCase())
          );
          if (matchedServer) {
            serverId = matchedServer.id;
            serverName = matchedServer.name;
          }
        }

        // Encrypt credentials if present
        let encryptedLogin = client.login;
        let encryptedPassword = client.password;
        
        if (client.login || client.password) {
          try {
            const encrypted = await encryptCredentials({
              login: client.login,
              password: client.password,
            });
            encryptedLogin = encrypted.login;
            encryptedPassword = encrypted.password;
          } catch (err) {
            console.error('Encryption error:', err);
            // Continue with unencrypted if encryption fails
          }
        }

        const { error } = await supabase.from('clients').insert({
          seller_id: user.id,
          name: client.name,
          phone: client.phone,
          login: encryptedLogin,
          password: encryptedPassword,
          server_id: serverId,
          server_name: serverName,
          plan_price: client.plan_price,
          expiration_date: client.expiration_date,
        });

        if (error) {
          console.error('Error importing client:', client.name, error);
          errorCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        const skipMsg = skippedCount > 0 ? ` (${skippedCount} duplicado(s) ignorado(s))` : '';
        toast.success(`${successCount} cliente(s) importado(s)${skipMsg}`);
        onSuccess();
        onOpenChange(false);
        setText('');
        setPreview([]);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} cliente(s) falharam na importação`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao importar clientes');
    } finally {
      setLoading(false);
    }
  };

  const copyExample = () => {
    navigator.clipboard.writeText(EXAMPLE_FORMAT);
    toast.success('Formato copiado!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Clientes em Massa
          </DialogTitle>
          <DialogDescription>
            Cole os dados no formato CSV. Cada linha é um cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Example format */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Formato CSV:</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={copyExample}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copiar
              </Button>
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-background/50 p-2 rounded overflow-x-auto">
{EXAMPLE_FORMAT}
            </pre>
            <p className="text-[10px] text-muted-foreground">
              Colunas: Nome, Telefone, Usuário, Senha, Servidor, Valor, Data (DD/MM/AAAA)
            </p>
          </div>

          {/* Text input */}
          <div className="space-y-2">
            <Label htmlFor="bulk-text">Cole os dados aqui:</Label>
            <Textarea
              id="bulk-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setPreview([]);
              }}
              placeholder={EXAMPLE_FORMAT}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Preview ({preview.length} clientes
                {preview.filter(c => c.isDuplicate).length > 0 && (
                  <span className="text-destructive"> - {preview.filter(c => c.isDuplicate).length} duplicado(s)</span>
                )}):
              </Label>
              <div className="max-h-[150px] overflow-y-auto rounded-lg border bg-muted/30 p-2 space-y-2">
                {preview.map((client, index) => (
                  <div 
                    key={index} 
                    className={`text-xs p-2 rounded border ${
                      client.isDuplicate 
                        ? 'bg-destructive/10 border-destructive/30' 
                        : 'bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-1 font-medium">
                      {client.isDuplicate && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      {client.name}
                    </div>
                    <div className="text-muted-foreground flex flex-wrap gap-1">
                      {client.phone && <span>{client.phone} •</span>}
                      {client.login && <span>User: {client.login} •</span>}
                      {client.server_name && <span>{client.server_name} •</span>}
                      {client.plan_price && <span>R${client.plan_price} •</span>}
                      <span>Venc: {new Date(client.expiration_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                    {client.isDuplicate && (
                      <div className="text-destructive text-[10px] mt-1">{client.duplicateReason}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handlePreview}
              disabled={!text.trim() || loading}
            >
              Visualizar
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleImport}
              disabled={!text.trim() || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                'Importar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
