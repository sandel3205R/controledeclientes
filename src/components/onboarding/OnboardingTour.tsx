import { useOnboardingTour, TOUR_STEPS } from '@/hooks/useOnboardingTour';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  LayoutDashboard,
  Users,
  Tag,
  MessageSquare,
  Server,
  BarChart3,
  Bell,
  Rocket,
  ChevronLeft,
  ChevronRight,
  X,
  Lightbulb,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'sparkles': Sparkles,
  'layout-dashboard': LayoutDashboard,
  'users': Users,
  'tag': Tag,
  'message-square': MessageSquare,
  'server': Server,
  'bar-chart-3': BarChart3,
  'bell': Bell,
  'rocket': Rocket,
};

const STEP_COLORS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-pink-500 to-rose-500',
  'from-indigo-500 to-blue-500',
  'from-green-500 to-emerald-500',
  'from-yellow-500 to-amber-500',
  'from-primary to-secondary',
];

export default function OnboardingTour() {
  const {
    showTour,
    currentStep,
    totalSteps,
    currentStepData,
    closeTour,
    completeTour,
    nextStep,
    prevStep,
    goToStep,
  } = useOnboardingTour();

  if (!showTour || !currentStepData) return null;

  const Icon = ICON_MAP[currentStepData.icon] || Sparkles;
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const gradientColor = STEP_COLORS[currentStep % STEP_COLORS.length];

  return (
    <Dialog open={showTour} onOpenChange={(open) => !open && closeTour()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0 bg-transparent shadow-2xl">
        <div className="bg-card rounded-xl overflow-hidden">
          {/* Progress bar */}
          <div className="px-6 pt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Passo {currentStep + 1} de {totalSteps}</span>
              <button 
                onClick={completeTour}
                className="hover:text-foreground transition-colors"
              >
                Pular tour
              </button>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          {/* Icon header */}
          <div className="flex justify-center pt-8 pb-4">
            <div className={cn(
              "p-5 rounded-2xl bg-gradient-to-br shadow-lg animate-scale-in",
              gradientColor
            )}>
              <Icon className="h-10 w-10 text-white" />
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-4 text-center animate-fade-in">
            <h2 className="text-xl font-bold mb-3">{currentStepData.title}</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {currentStepData.description}
            </p>
            {/* Highlight important steps */}
            {(currentStepData.id === 'step1-server') && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-sm font-semibold text-destructive">
                  ⚠️ ATENÇÃO: Este é o passo mais importante!
                </p>
              </div>
            )}
          </div>

          {/* Tip box */}
          {currentStepData.tip && (
            <div className="mx-6 mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 animate-fade-in">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-primary">
                  <strong>Dica:</strong> {currentStepData.tip}
                </p>
              </div>
            </div>
          )}

          {/* Step indicators */}
          <div className="flex justify-center gap-1.5 pb-4">
            {TOUR_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => goToStep(index)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  index === currentStep 
                    ? "w-6 bg-primary" 
                    : index < currentStep 
                      ? "w-2 bg-primary/50 hover:bg-primary/70" 
                      : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between p-4 border-t bg-muted/30">
            <Button
              variant="ghost"
              onClick={prevStep}
              disabled={isFirstStep}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>

            <Button
              variant="gradient"
              onClick={isLastStep ? completeTour : nextStep}
              className="gap-1"
            >
              {isLastStep ? (
                <>
                  Começar
                  <Rocket className="h-4 w-4" />
                </>
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
