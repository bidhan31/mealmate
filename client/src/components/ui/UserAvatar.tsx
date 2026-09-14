import { useState } from 'react';
import { User } from 'lucide-react';

interface UserAvatarProps {
  name?: string | null;
  avatar?: string | null;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

export function UserAvatar({ name, avatar, className = '', size = 'sm' }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = sizeClasses[size];

  const fallbackDiceBear = name ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}` : null;
  const srcUrl = avatar || fallbackDiceBear;

  if (srcUrl && !imgError) {
    return (
      <img
        src={srcUrl}
        alt={name || 'User Avatar'}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover border border-border/60 bg-muted shrink-0 shadow-sm ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full border border-border/60 bg-primary/15 text-primary font-semibold flex items-center justify-center shrink-0 shadow-sm ${className}`}
    >
      {name ? name.charAt(0).toUpperCase() : <User className="w-1/2 h-1/2" />}
    </div>
  );
}
