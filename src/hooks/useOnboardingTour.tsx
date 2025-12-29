import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

const TOUR_STORAGE_KEY = 'onboarding_tour_completed';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  tip?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao Sistema!',
    description: 'Este guia vai te mostrar as principais funcionalidades para você aproveitar ao máximo a plataforma.',
    icon: 'sparkles',
    tip: 'Você pode refazer este tour a qualquer momento nas Configurações.',
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Aqui você tem uma visão geral do seu negócio: total de clientes, vencimentos próximos, receita mensal e muito mais.',
    icon: 'layout-dashboard',
    tip: 'Os cards são clicáveis e te levam para as páginas correspondentes.',
  },
  {
    id: 'clients',
    title: 'Gerenciamento de Clientes',
    description: 'Adicione, edite e organize seus clientes. Filtre por status de vencimento, tipo de conta e muito mais.',
    icon: 'users',
    tip: 'Use os filtros para encontrar rapidamente clientes que vencem hoje ou estão atrasados.',
  },
  {
    id: 'categories',
    title: 'Categorias Personalizadas',
    description: 'Crie suas próprias categorias de conta além das padrão (Premium, SSH, IPTV, P2P). Acesse em Configurações > Categorias de Conta.',
    icon: 'tag',
    tip: 'Cada categoria pode ter mensagens personalizadas diferentes!',
  },
  {
    id: 'templates',
    title: 'Templates de Mensagem',
    description: 'Crie mensagens personalizadas para WhatsApp e Telegram. Use variáveis como {nome}, {vencimento}, {preco} que são preenchidas automaticamente.',
    icon: 'message-square',
    tip: 'Você pode criar templates específicos para cada categoria de conta.',
  },
  {
    id: 'servers',
    title: 'Gerenciamento de Servidores',
    description: 'Controle seus servidores, créditos disponíveis e custos. Vincule clientes a servidores específicos.',
    icon: 'server',
    tip: 'Acompanhe o consumo de créditos e custos mensais de cada servidor.',
  },
  {
    id: 'reports',
    title: 'Relatórios',
    description: 'Visualize relatórios detalhados de receita, clientes por período e exportação de dados.',
    icon: 'bar-chart-3',
    tip: 'Use os filtros de data para analisar períodos específicos.',
  },
  {
    id: 'notifications',
    title: 'Notificações Automáticas',
    description: 'Configure alertas para ser notificado sobre vencimentos de clientes. Ative as notificações push no navegador.',
    icon: 'bell',
    tip: 'Você pode escolher quantos dias antes quer ser notificado.',
  },
  {
    id: 'finish',
    title: 'Pronto para Começar!',
    description: 'Agora você conhece as principais funcionalidades. Explore o sistema e qualquer dúvida, estamos aqui para ajudar!',
    icon: 'rocket',
    tip: 'Comece adicionando seus primeiros clientes na página Clientes.',
  },
];

export function useOnboardingTour() {
  const { user, role } = useAuth();
  const [showTour, setShowTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(true);

  // Check if user has completed the tour
  useEffect(() => {
    if (!user || role === 'admin') return;

    const storageKey = `${TOUR_STORAGE_KEY}_${user.id}`;
    const completed = localStorage.getItem(storageKey);
    
    if (!completed) {
      setHasCompletedTour(false);
      // Auto-show tour for new users after a short delay
      const timer = setTimeout(() => {
        setShowTour(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setHasCompletedTour(true);
    }
  }, [user, role]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setShowTour(true);
  }, []);

  const closeTour = useCallback(() => {
    setShowTour(false);
  }, []);

  const completeTour = useCallback(() => {
    if (!user) return;
    
    const storageKey = `${TOUR_STORAGE_KEY}_${user.id}`;
    localStorage.setItem(storageKey, 'true');
    setHasCompletedTour(true);
    setShowTour(false);
  }, [user]);

  const nextStep = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  }, [currentStep, completeTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < TOUR_STEPS.length) {
      setCurrentStep(step);
    }
  }, []);

  const resetTour = useCallback(() => {
    if (!user) return;
    
    const storageKey = `${TOUR_STORAGE_KEY}_${user.id}`;
    localStorage.removeItem(storageKey);
    setHasCompletedTour(false);
    setCurrentStep(0);
    setShowTour(true);
  }, [user]);

  return {
    showTour,
    currentStep,
    totalSteps: TOUR_STEPS.length,
    currentStepData: TOUR_STEPS[currentStep],
    hasCompletedTour,
    startTour,
    closeTour,
    completeTour,
    nextStep,
    prevStep,
    goToStep,
    resetTour,
  };
}
