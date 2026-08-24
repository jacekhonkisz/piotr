import React from 'react';
import Image from 'next/image';

interface BrandLogoProps {
  /** Visual size of the logo mark. */
  size?: 'sm' | 'md' | 'lg';
  /** Show wordmark next to the logo when the image is used as a compact mark. */
  showWordmark?: boolean;
  className?: string;
  priority?: boolean;
}

const SIZE_PX = {
  sm: 28,
  md: 40,
  lg: 72
} as const;

/**
 * Piotr Bajerlein Marketing brand mark used across the product UI and favicon.
 */
export default function BrandLogo({
  size = 'md',
  showWordmark = false,
  className = '',
  priority = false
}: BrandLogoProps) {
  const px = SIZE_PX[size];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src="/logo.png"
        alt="Piotr Bajerlein Marketing"
        width={px}
        height={px}
        priority={priority}
        className="object-contain"
      />
      {showWordmark && (
        <span className="leading-tight text-left">
          <span className="block text-sm font-semibold tracking-tight text-gray-900">
            Piotr Bajerlein
          </span>
          <span className="block text-[11px] font-medium tracking-[0.18em] uppercase text-[#F15A22]">
            Marketing
          </span>
        </span>
      )}
    </span>
  );
}
