import { useTheme } from '@/hooks/useTheme';
import christmasBg from '@/assets/theme-christmas-bg.jpg';
import newyearBg from '@/assets/theme-newyear-bg.jpg';
import carnivalBg from '@/assets/theme-carnival-bg.jpg';
import clientsControlBg from '@/assets/theme-clients-control-bg.jpg';

const seasonalBackgrounds: Record<string, string> = {
  christmas: christmasBg,
  newyear: newyearBg,
  carnival: carnivalBg,
  'clients-control': clientsControlBg,
};

function Snowflakes() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="snowflake absolute text-white opacity-80"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${8 + Math.random() * 7}s`,
            fontSize: `${8 + Math.random() * 12}px`,
          }}
        >
          ❄
        </div>
      ))}
      <style>{`
        @keyframes snowfall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(360deg);
            opacity: 0.3;
          }
        }
        
        @keyframes sway {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(20px);
          }
        }
        
        .snowflake {
          animation: snowfall linear infinite, sway ease-in-out infinite;
          animation-duration: 10s, 3s;
          text-shadow: 0 0 5px rgba(255,255,255,0.8);
        }
      `}</style>
    </div>
  );
}

export default function ThemeBackground() {
  const { theme } = useTheme();
  
  const backgroundImage = seasonalBackgrounds[theme];
  const isChristmas = theme === 'christmas';
  
  if (!backgroundImage) {
    return null;
  }

  return (
    <>
      {isChristmas && <Snowflakes />}
      <div 
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.2,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
      </div>
    </>
  );
}
