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
    title: '👋 Bem-vindo ao Sistema!',
    description: 'Vamos te ensinar o passo a passo para começar a usar o sistema. É muito simples, apenas 3 passos!',
    icon: 'sparkles',
    tip: 'Este guia aparece apenas uma vez. Você pode refazer nas Configurações.',
  },
  {
    id: 'step1-server',
    title: '1️⃣ PRIMEIRO: Cadastre um Servidor',
    description: 'IMPORTANTE! Antes de cadastrar clientes, você PRECISA criar pelo menos 1 servidor. Vá em "Servidores" no menu lateral e clique em "Novo Servidor".',
    icon: 'server',
    tip: 'Sem servidor cadastrado, você não conseguirá vincular clientes!',
  },
  {
    id: 'step2-client',
    title: '2️⃣ DEPOIS: Cadastre seus Clientes',
    description: 'Com o servidor criado, agora você pode cadastrar clientes! Vá em "Clientes" e clique em "Novo Cliente". Escolha o servidor que você criou.',
    icon: 'users',
    tip: 'Cada cliente pode ser vinculado a um ou mais servidores.',
  },
  {
    id: 'step3-templates',
    title: '3️⃣ Configure suas Mensagens',
    description: 'Crie templates de mensagens para WhatsApp/Telegram. Use variáveis como {nome}, {vencimento} que são preenchidas automaticamente.',
    icon: 'message-square',
    tip: 'Acesse "Templates" no menu para criar suas mensagens personalizadas.',
  },
  {
    id: 'dashboard',
    title: '📊 Dashboard - Seu Painel de Controle',
    description: 'Aqui você vê tudo: total de clientes, vencimentos do dia, receita mensal. Os cards são clicáveis!',
    icon: 'layout-dashboard',
    tip: 'Clique nos cards para ir direto para a página correspondente.',
  },
  {
    id: 'filters',
    title: '🔍 Filtros Inteligentes',
    description: 'Na página de Clientes, use os filtros para encontrar rapidamente: vencidos, vencem hoje, vencem amanhã, não pagos, etc.',
    icon: 'tag',
    tip: 'Os filtros ajudam muito no dia a dia para cobranças!',
  },
  {
    id: 'notifications',
    title: '🔔 Notificações Automáticas',
    description: 'Ative as notificações push para ser avisado sobre vencimentos. Vá em Configurações e ative os alertas.',
    icon: 'bell',
    tip: 'Escolha quantos dias antes quer ser notificado.',
  },
  {
    id: 'finish',
    title: '🚀 Pronto para Começar!',
    description: 'Resumo: 1) Crie um SERVIDOR primeiro → 2) Depois cadastre CLIENTES → 3) Configure TEMPLATES. Simples assim!',
    icon: 'rocket',
    tip: 'Comece agora: vá em Servidores e crie seu primeiro servidor!',
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
