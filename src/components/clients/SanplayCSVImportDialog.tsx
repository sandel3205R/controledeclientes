import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SanplayCSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  servers: { id: string; name: string }[];
}

interface ParsedClient {
  name: string;
  login: string | null;
  password: string | null;
  expiration_date: string;
  phone: string | null;
  mac_address: string | null;
  device: string | null;
  app_name: string | null;
  isDuplicate?: boolean;
  duplicateReason?: string;
}

export default function SanplayCSVImportDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  servers 
}: SanplayCSVImportDialogProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ParsedClient[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseDate = (dateStr: string): string => {
    if (!dateStr) {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      return date.toISOString().split('T')[0];
    }

    // Handle various date formats from Sanplay
    // DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD/MM/YY
    const cleanDate = dateStr.trim();
    
    // Try YYYY-MM-DD format first
    if (/^\d{4}-\d{2}-\d{2}/.test(cleanDate)) {
      return cleanDate.split('T')[0].split(' ')[0];
    }

    // Handle DD/MM/YYYY or DD-MM-YYYY
    const parts = cleanDate.split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) {
        year = parseInt(year) > 50 ? '19' + year : '20' + year;
      }
      return `${year}-${month}-${day}`;
    }

    // Default
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  };

  const cleanPhoneNumber = (phone: string | null): string | null => {
    if (!phone) return null;
    // Remove all non-numeric characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    return cleaned || null;
  };

  const parseCSV = (csvText: string): ParsedClient[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    // Get header line and normalize column names
    const headerLine = lines[0];
    const headers = headerLine.split(/[,;]/).map(h => h.trim().toLowerCase().replace(/"/g, ''));

    // Map common Sanplay column names
    const columnMap: Record<string, string[]> = {
      name: ['nome', 'name', 'cliente', 'client', 'nome do cliente', 'nome cliente'],
      login: ['login', 'usuario', 'usuário', 'user', 'username', 'conta'],
      password: ['senha', 'password', 'pass'],
      expiration_date: ['vencimento', 'expiration', 'data vencimento', 'validade', 'expira', 'expires', 'data_vencimento', 'expiracao'],
      phone: ['telefone', 'phone', 'whatsapp', 'celular', 'tel', 'fone', 'contato'],
      mac_address: ['mac', 'mac_address', 'macaddress', 'mac address', 'endereco mac'],
      device: ['dispositivo', 'device', 'aparelho', 'modelo'],
      app_name: ['app', 'aplicativo', 'servidor', 'server', 'plano', 'plan', 'produto'],
    };

    // Find column indexes
    const indexes: Record<string, number> = {};
    for (const [field, aliases] of Object.entries(columnMap)) {
      const index = headers.findIndex(h => aliases.some(alias => h.includes(alias)));
      if (index !== -1) {
        indexes[field] = index;
      }
    }

    // Parse data rows
    const clients: ParsedClient[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split by comma or semicolon, handling quoted fields
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === ',' || char === ';') && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));

      const getValue = (field: string): string | null => {
        const idx = indexes[field];
        if (idx === undefined || idx >= values.length) return null;
        const val = values[idx]?.trim();
        return val || null;
      };

      const name = getValue('name');
      if (!name) continue;

      clients.push({
        name,
        login: getValue('login'),
        password: getValue('password'),
        expiration_date: parseDate(getValue('expiration_date') || ''),
        phone: cleanPhoneNumber(getValue('phone')),
        mac_address: getValue('mac_address'),
        device: getValue('device'),
        app_name: getValue('app_name'),
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
        duplicates.push('login');
      }

      return {
        ...client,
        isDuplicate: duplicates.length > 0,
        duplicateReason: duplicates.length > 0 ? `Duplicado: ${duplicates.join(', ')}` : undefined
      };
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFileName(file.name);

    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      
      if (parsed.length === 0) {
        toast.error('Nenhum cliente encontrado no arquivo. Verifique o formato CSV.');
        setPreview([]);
        return;
      }

      const withDuplicates = await checkDuplicates(parsed);
      setPreview(withDuplicates);
      
      const duplicateCount = withDuplicates.filter(c => c.isDuplicate).length;
      if (duplicateCount > 0) {
        toast.warning(`${parsed.length} cliente(s) detectado(s), ${duplicateCount} duplicado(s)`);
      } else {
        toast.success(`${parsed.length} cliente(s) detectado(s)`);
      }
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Erro ao ler o arquivo CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const clients = preview.filter(c => !c.isDuplicate);
    
    if (clients.length === 0) {
      toast.error('Nenhum cliente válido para importar (todos são duplicados)');
      return;
    }

    const skippedCount = preview.length - clients.length;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      let successCount = 0;
      let errorCount = 0;

      for (const client of clients) {
        // Try to match server by name
        let serverId: string | null = null;
        let serverName = client.app_name;
        
        if (client.app_name) {
          const matchedServer = servers.find(s => 
            s.name.toLowerCase().includes(client.app_name!.toLowerCase()) ||
            client.app_name!.toLowerCase().includes(s.name.toLowerCase())
          );
          if (matchedServer) {
            serverId = matchedServer.id;
            serverName = matchedServer.name;
          }
        }

        const { error } = await supabase.from('clients').insert({
          seller_id: user.id,
          name: client.name,
          login: client.login,
          password: client.password,
          expiration_date: client.expiration_date,
          phone: client.phone,
          mac_address: client.mac_address,
          device: client.device,
          app_name: client.app_name,
          server_id: serverId,
          server_name: serverName,
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
        toast.success(`${successCount} cliente(s) importado(s) do Sanplay${skipMsg}`);
        onSuccess();
        onOpenChange(false);
        setPreview([]);
        setFileName(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
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

  const handleClose = (open: boolean) => {
    if (!open) {
      setPreview([]);
      setFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Importar do Sanplay (CSV)
          </DialogTitle>
          <DialogDescription>
            Importe seus clientes do Sanplay usando o arquivo CSV exportado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Como exportar do Sanplay:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-xs text-muted-foreground">
                <li>Acesse o painel de revendedor do Sanplay</li>
                <li>Vá em "Clientes" ou "Usuários"</li>
                <li>Clique em "Exportar" ou "Download CSV"</li>
                <li>Selecione o arquivo baixado aqui</li>
              </ol>
            </AlertDescription>
          </Alert>

          {/* File input */}
          <div className="space-y-2">
            <Label>Selecionar arquivo CSV:</Label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
                id="sanplay-csv-input"
              />
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {fileName || 'Escolher arquivo...'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Formatos aceitos: .csv, .txt (separado por vírgula ou ponto-e-vírgula)
            </p>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Preview ({preview.length} clientes
                {preview.filter(c => c.isDuplicate).length > 0 && (
                  <span className="text-destructive"> - {preview.filter(c => c.isDuplicate).length} duplicado(s)</span>
                )}):
              </Label>
              <div className="max-h-[200px] overflow-y-auto rounded-lg border bg-muted/30 p-2 space-y-2">
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
                      {client.login && <span>Login: {client.login}</span>}
                      {client.login && client.expiration_date && <span>•</span>}
                      <span>Venc: {new Date(client.expiration_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      {client.phone && <><span>•</span><span>{client.phone}</span></>}
                      {client.mac_address && <><span>•</span><span>MAC: {client.mac_address}</span></>}
                    </div>
                    {client.isDuplicate && (
                      <div className="text-destructive text-[10px] mt-1">{client.duplicateReason}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import button */}
          {preview.length > 0 && (
            <Button
              type="button"
              className="w-full"
              onClick={handleImport}
              disabled={loading || preview.every(c => c.isDuplicate)}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Importar {preview.filter(c => !c.isDuplicate).length} Cliente(s)
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
