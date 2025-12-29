import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthMeterProps {
  strength: {
    score: number;
    label: string;
    color: string;
    feedback: string[];
  };
  isBreached: boolean | null;
  breachCount: number;
  isChecking: boolean;
  password: string;
}

export function PasswordStrengthMeter({
  strength,
  isBreached,
  breachCount,
  isChecking,
  password,
}: PasswordStrengthMeterProps) {
  if (!password) return null;

  const progressValue = ((strength.score + 1) / 5) * 100;

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Força da senha</span>
          {strength.label && (
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] px-1.5 py-0",
                strength.score >= 3 ? "border-green-500 text-green-600" : 
                strength.score >= 2 ? "border-yellow-500 text-yellow-600" : 
                "border-destructive text-destructive"
              )}
            >
              {strength.label}
            </Badge>
          )}
        </div>
        <Progress 
          value={progressValue} 
          className={cn(
            "h-1.5",
            strength.score >= 3 ? "[&>div]:bg-green-500" : 
            strength.score >= 2 ? "[&>div]:bg-yellow-500" : 
            strength.score >= 1 ? "[&>div]:bg-orange-500" : 
            "[&>div]:bg-destructive"
          )} 
        />
      </div>

      {/* Feedback */}
      {strength.feedback.length > 0 && (
        <ul className="space-y-0.5">
          {strength.feedback.map((item, index) => (
            <li key={index} className="text-[11px] text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-yellow-500 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )}

      {/* Breach Check */}
      <div className="pt-1 border-t border-border/50">
        {isChecking ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Verificando vazamentos...
          </div>
        ) : isBreached === true ? (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Senha comprometida!</p>
              <p className="text-destructive/80">
                Esta senha apareceu em {breachCount.toLocaleString()} vazamentos de dados. 
                Escolha outra senha.
              </p>
            </div>
          </div>
        ) : isBreached === false ? (
          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-500/10 p-2 rounded-md">
            <ShieldCheck className="w-4 h-4" />
            <span>Senha não encontrada em vazamentos conhecidos</span>
          </div>
        ) : null}
      </div>

      {/* Security Tips */}
      {strength.score >= 3 && isBreached === false && (
        <div className="flex items-center gap-1 text-[11px] text-green-600">
          <Check className="w-3 h-3" />
          Senha segura!
        </div>
      )}
    </div>
  );
}