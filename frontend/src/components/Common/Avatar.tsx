// ==========================================
// src/components/Common/Avatar.tsx
// ==========================================
import { useState } from 'react';

interface AvatarProps {
  src?: string;
  name?: string;
  email?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'busy';
  showStatus?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg'
};

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  away: 'bg-yellow-500',
  busy: 'bg-red-500'
};

const statusSizes = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4'
};

export const Avatar = ({
  src,
  name,
  email,
  size = 'md',
  status,
  showStatus = false,
  className = ''
}: AvatarProps) => {
  const [imgError, setImgError] = useState(false);

  const getColor = (text?: string) => {
    if (!text) return 'bg-gradient-to-br from-violet-400 to-violet-600';
    
    const colors = [
      'bg-gradient-to-br from-violet-400 to-violet-600',
      'bg-gradient-to-br from-blue-400 to-blue-600',
      'bg-gradient-to-br from-emerald-400 to-emerald-600',
      'bg-gradient-to-br from-amber-400 to-amber-600',
      'bg-gradient-to-br from-rose-400 to-rose-600',
      'bg-gradient-to-br from-cyan-400 to-cyan-600',
    ];
    
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getInitials = () => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (email) return email[0].toUpperCase();
    return '?';
  };

  const displaySrc = src && !imgError ? src : null;

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`
          ${sizeClasses[size]} 
          rounded-full 
          flex items-center justify-center 
          font-semibold 
          text-white
          ${!displaySrc ? getColor(name || email) : ''}
          transition-all
          hover:scale-105
          shadow-sm
        `}
      >
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={name || email || 'Avatar'}
            onError={() => setImgError(true)}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span>{getInitials()}</span>
        )}
      </div>

      {showStatus && status && (
        <span
          className={`
            absolute 
            -bottom-0.5 
            -right-0.5 
            ${statusSizes[size]} 
            ${statusColors[status]} 
            rounded-full 
            border-2 
            border-white
            shadow-sm
            ${status === 'online' ? 'animate-pulse' : ''}
          `}
          title={status}
        />
      )}
    </div>
  );
};
