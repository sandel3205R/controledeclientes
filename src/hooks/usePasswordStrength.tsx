import { useState, useCallback } from 'react';

interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
  feedback: string[];
}

interface PasswordCheckResult {
  strength: PasswordStrength;
  isBreached: boolean | null;
  breachCount: number;
  isChecking: boolean;
}

// Calculate password strength
const calculateStrength = (password: string): PasswordStrength => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length === 0) {
    return { score: 0, label: '', color: '', feedback: [] };
  }

  // Length checks
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length < 8) feedback.push('Use pelo menos 8 caracteres');

  // Complexity checks - all are required
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  if (hasLowercase) score += 0.5;
  else feedback.push('Adicione letras minúsculas');

  if (hasUppercase) score += 0.5;
  else feedback.push('Adicione letras maiúsculas');

  if (hasNumber) score += 0.5;
  else feedback.push('Adicione números');

  if (hasSymbol) score += 0.5;
  else feedback.push('Adicione símbolo especial (!@#$%...)');

  // Common patterns to avoid
  const commonPatterns = [
    /^123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /111111/,
    /000000/,
    /admin/i,
    /letmein/i,
  ];

  if (commonPatterns.some(pattern => pattern.test(password))) {
    score = Math.max(0, score - 2);
    feedback.unshift('Evite senhas comuns');
  }

  // Normalize score to 0-4
  const normalizedScore = Math.min(4, Math.max(0, Math.floor(score)));

  const labels = ['Muito fraca', 'Fraca', 'Razoável', 'Forte', 'Muito forte'];
  const colors = [
    'bg-destructive',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-emerald-500',
  ];

  return {
    score: normalizedScore,
    label: labels[normalizedScore],
    color: colors[normalizedScore],
    feedback: feedback.slice(0, 3), // Max 3 feedback items
  };
};

// Check password against HaveIBeenPwned API using k-anonymity
const checkPasswordBreach = async (password: string): Promise<{ breached: boolean; count: number }> => {
  try {
    // Create SHA-1 hash of password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    // k-anonymity: only send first 5 characters of hash
    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'Add-Padding': 'true', // Helps prevent fingerprinting
      },
    });

    if (!response.ok) {
      console.error('HIBP API error:', response.status);
      return { breached: false, count: 0 };
    }

    const text = await response.text();
    const lines = text.split('\n');

    for (const line of lines) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix.trim() === suffix) {
        return { breached: true, count: parseInt(count.trim(), 10) };
      }
    }

    return { breached: false, count: 0 };
  } catch (error) {
    console.error('Error checking password breach:', error);
    return { breached: false, count: 0 };
  }
};

export function usePasswordStrength() {
  const [result, setResult] = useState<PasswordCheckResult>({
    strength: { score: 0, label: '', color: '', feedback: [] },
    isBreached: null,
    breachCount: 0,
    isChecking: false,
  });

  const checkPassword = useCallback(async (password: string) => {
    const strength = calculateStrength(password);
    
    setResult(prev => ({
      ...prev,
      strength,
      isChecking: password.length >= 6,
      isBreached: null,
    }));

    // Only check breach for passwords with minimum length
    if (password.length >= 6) {
      const { breached, count } = await checkPasswordBreach(password);
      setResult(prev => ({
        ...prev,
        isBreached: breached,
        breachCount: count,
        isChecking: false,
      }));
    }
  }, []);

  const resetCheck = useCallback(() => {
    setResult({
      strength: { score: 0, label: '', color: '', feedback: [] },
      isBreached: null,
      breachCount: 0,
      isChecking: false,
    });
  }, []);

  return { result, checkPassword, resetCheck };
}