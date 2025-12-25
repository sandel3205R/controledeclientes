import { useTheme } from '@/hooks/useTheme';
import christmasBg from '@/assets/theme-christmas-bg.jpg';
import newyearBg from '@/assets/theme-newyear-bg.jpg';
import carnivalBg from '@/assets/theme-carnival-bg.jpg';

const seasonalBackgrounds: Record<string, string> = {
  christmas: christmasBg,
  newyear: newyearBg,
  carnival: carnivalBg,
};

export default function ThemeBackground() {
  const { theme } = useTheme();
  
  const backgroundImage = seasonalBackgrounds[theme];
  
  if (!backgroundImage) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: 0.15,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/70 to-background" />
    </div>
  );
}
