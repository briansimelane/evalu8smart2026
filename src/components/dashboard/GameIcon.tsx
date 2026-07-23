import React from 'react';
import { Package, Wrench, Microscope, Truck, DollarSign, ClipboardList, Store, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GameCategory =
  | 'planning'
  | 'Planning'
  | 'price'
  | 'Price'
  | 'Price Plus'
  | 'Price Minus'
  | 'Price and Product'
  | 'production'
  | 'Product'
  | 'Production'
  | 'products'
  | 'improvement'
  | 'Improvement'
  | 'Improve'
  | 'research'
  | 'Research'
  | 'innovation'
  | 'logistics'
  | 'Logistic'
  | 'Logistics'
  | 'expansion'
  | 'sales'
  | 'Sales'
  | 'control'
  | 'Control';

export interface GameIconProps {
  type: GameCategory | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  label?: string;
  className?: string;
  iconClassName?: string;
  badgeClassName?: string;
}

export const getCategoryKey = (
  type: string
): 'planning' | 'price' | 'production' | 'improvement' | 'research' | 'logistics' | 'sales' | 'control' | null => {
  const normalized = type.toLowerCase();
  if (normalized.includes('plan')) return 'planning';
  if (normalized.includes('price') || normalized.includes('dollar') || normalized.includes('cost')) return 'price';
  if (normalized.includes('product') || normalized === 'production') return 'production';
  if (normalized.includes('improve') || normalized === 'improvement') return 'improvement';
  if (normalized.includes('research') || normalized === 'innovation') return 'research';
  if (normalized.includes('logistic') || normalized === 'expansion') return 'logistics';
  if (normalized.includes('sale')) return 'sales';
  if (normalized.includes('control')) return 'control';
  return null;
};

export const GAME_CATEGORY_CONFIG = {
  planning: {
    label: 'Planning',
    icon: ClipboardList,
    bgClass: 'bg-blue-600',
    textClass: 'text-white',
    borderClass: 'border-blue-700',
    fullClass: 'bg-blue-600 text-white border-blue-700',
  },
  price: {
    label: 'Price',
    icon: DollarSign,
    bgClass: 'bg-red-600',
    textClass: 'text-white',
    borderClass: 'border-red-700',
    fullClass: 'bg-red-600 text-white border-red-700',
  },
  production: {
    label: 'Production',
    icon: Package,
    bgClass: 'bg-black',
    textClass: 'text-white',
    borderClass: 'border-black dark:border-zinc-700',
    fullClass: 'bg-black text-white border-black dark:border-zinc-700',
  },
  improvement: {
    label: 'Improvement',
    icon: Wrench,
    bgClass: 'bg-yellow-400',
    textClass: 'text-black',
    borderClass: 'border-yellow-500',
    fullClass: 'bg-yellow-400 text-black border-yellow-500',
  },
  research: {
    label: 'Research',
    icon: Microscope,
    bgClass: 'bg-purple-600',
    textClass: 'text-white',
    borderClass: 'border-purple-700',
    fullClass: 'bg-purple-600 text-white border-purple-700',
  },
  logistics: {
    label: 'Logistics',
    icon: Truck,
    bgClass: 'bg-cyan-500',
    textClass: 'text-white',
    borderClass: 'border-cyan-600',
    fullClass: 'bg-cyan-500 text-white border-cyan-600',
  },
  sales: {
    label: 'Sales',
    icon: Store,
    bgClass: 'bg-emerald-600',
    textClass: 'text-white',
    borderClass: 'border-emerald-700',
    fullClass: 'bg-emerald-600 text-white border-emerald-700',
  },
  control: {
    label: 'Control',
    icon: CheckSquare,
    bgClass: 'bg-indigo-600',
    textClass: 'text-white',
    borderClass: 'border-indigo-700',
    fullClass: 'bg-indigo-600 text-white border-indigo-700',
  },
};

const SIZE_MAP = {
  xs: {
    container: 'p-0.5 rounded gap-1 text-[10px]',
    icon: 'h-3 w-3',
  },
  sm: {
    container: 'p-1 rounded-md gap-1.5 text-xs',
    icon: 'h-3.5 w-3.5',
  },
  md: {
    container: 'p-1.5 rounded-md gap-1.5 text-sm',
    icon: 'h-4 w-4',
  },
  lg: {
    container: 'p-2 rounded-lg gap-2 text-base',
    icon: 'h-5 w-5',
  },
  xl: {
    container: 'p-2.5 rounded-xl gap-2.5 text-lg',
    icon: 'h-7 w-7',
  },
};

export const GameIcon: React.FC<GameIconProps> = ({
  type,
  size = 'md',
  showLabel = false,
  label,
  className,
  iconClassName,
  badgeClassName,
}) => {
  const categoryKey = getCategoryKey(type);

  if (!categoryKey) {
    return null;
  }

  const config = GAME_CATEGORY_CONFIG[categoryKey];
  const IconComponent = config.icon;
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;
  const displayLabel = label || config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-bold border shadow-sm transition-colors shrink-0 select-none',
        config.fullClass,
        sizeConfig.container,
        className,
        badgeClassName
      )}
      title={displayLabel}
    >
      <IconComponent className={cn(sizeConfig.icon, 'shrink-0', iconClassName)} />
      {showLabel && <span className="whitespace-nowrap">{displayLabel}</span>}
    </span>
  );
};

export default GameIcon;
