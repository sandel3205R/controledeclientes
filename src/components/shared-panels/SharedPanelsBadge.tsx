import { Badge } from '@/components/ui/badge';

interface SharedPanelsBadgeProps {
  count: number;
}

export function SharedPanelsBadge({ count }: SharedPanelsBadgeProps) {
  if (count === 0) return null;

  return (
    <Badge 
      variant="destructive" 
      className="ml-auto h-5 min-w-5 flex items-center justify-center text-xs px-1.5 animate-pulse"
    >
      {count}
    </Badge>
  );
}
