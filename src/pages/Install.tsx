import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tv, Download, Smartphone, Check, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary mb-4 glow-effect animate-pulse-glow">
            <Tv className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">StreamControl</h1>
          <p className="text-muted-foreground mt-2">Instale o app no seu dispositivo</p>
        </div>

        <Card variant="gradient" className="animate-slide-up">
          <CardHeader className="text-center">
            <CardTitle className="text-xl flex items-center justify-center gap-2">
              <Smartphone className="w-5 h-5" />
              Instalar App
            </CardTitle>
            <CardDescription>
              Tenha acesso rápido ao StreamControl direto da sua tela inicial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isInstalled ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20 mb-4">
                  <Check className="w-8 h-8 text-success" />
                </div>
                <h3 className="font-semibold text-lg mb-2">App já instalado!</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  O StreamControl já está instalado no seu dispositivo.
                </p>
                <Button variant="gradient" onClick={() => navigate('/dashboard')}>
                  Ir para o Dashboard
                </Button>
              </div>
            ) : isIOS ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-center">Como instalar no iPhone/iPad:</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">1</span>
                    <p className="text-sm">Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta) na barra do Safari</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">2</span>
                    <p className="text-sm">Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">3</span>
                    <p className="text-sm">Toque em <strong>"Adicionar"</strong> no canto superior direito</p>
                  </div>
                </div>
              </div>
            ) : deferredPrompt ? (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground text-sm">
                  Clique no botão abaixo para instalar o app
                </p>
                <Button variant="gradient" size="lg" className="w-full" onClick={handleInstall}>
                  <Download className="w-5 h-5 mr-2" />
                  Instalar StreamControl
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold text-center">Como instalar:</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">1</span>
                    <p className="text-sm">No Chrome, toque no menu <strong>(⋮)</strong> no canto superior direito</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">2</span>
                    <p className="text-sm">Toque em <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong></p>
                  </div>
                </div>
              </div>
            )}

            {/* Benefits */}
            <div className="pt-4 border-t border-border">
              <h4 className="font-medium text-sm mb-3 text-muted-foreground">Benefícios do app instalado:</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Acesso rápido',
                  'Funciona offline',
                  'Notificações',
                  'Tela cheia',
                ].map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/auth')}
            >
              Continuar no navegador
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
