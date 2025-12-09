import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

interface ForceUpdateButtonProps {
  variant?: 'default' | 'minimal';
  showLabel?: boolean;
}

export function ForceUpdateButton({ variant = 'default', showLabel = true }: ForceUpdateButtonProps) {
  const [updating, setUpdating] = useState(false);

  const handleForceUpdate = async () => {
    setUpdating(true);
    
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }

      // Clear local storage cache flags
      localStorage.removeItem('app-version');
      
      toast.success('Cache limpo! Recarregando...');
      
      // Force reload without cache
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Error clearing cache:', error);
      // Force reload anyway
      window.location.reload();
    }
  };

  if (variant === 'minimal') {
    return (
      <button
        onClick={handleForceUpdate}
        disabled={updating}
        className="p-2 rounded-lg hover:bg-accent transition-colors"
        title="Atualizar aplicativo"
      >
        <RefreshCw className={`w-5 h-5 ${updating ? 'animate-spin' : ''}`} />
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleForceUpdate}
      disabled={updating}
      className="gap-2"
    >
      <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
      {showLabel && (updating ? 'Atualizando...' : 'Atualizar App')}
    </Button>
  );
}
