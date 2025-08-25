import React from 'react';
import { getAutoContrastClass, getSafeTextColor } from '../lib/contrast-utils';

interface ContrastTextProps {
  children: React.ReactNode;
  backgroundColor?: string;
  type?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'error';
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  style?: React.CSSProperties;
}

/**
 * ContrastText component that automatically applies proper text contrast
 * based on the background color to ensure readability
 */
export default function ContrastText({ 
  children, 
  backgroundColor = 'white',
  type = 'primary',
  className = '',
  as: Component = 'span',
  style,
  ...props 
}: ContrastTextProps) {
  const contrastClass = getSafeTextColor(backgroundColor, type);
  const autoContrastClass = getAutoContrastClass(backgroundColor, type === 'muted');
  
  const combinedClassName = `${contrastClass} ${autoContrastClass} ${className}`.trim();
  
  return (
    <Component 
      className={combinedClassName}
      style={style}
      {...props}
    >
      {children}
    </Component>
  );
}

// Specific variants for common use cases
export function ContrastTitle({ 
  children, 
  backgroundColor = 'white', 
  className = '',
  ...props 
}: Omit<ContrastTextProps, 'type' | 'as'>) {
  return (
    <ContrastText 
      backgroundColor={backgroundColor}
      type="primary"
      as="h1"
      className={`font-bold ${className}`}
      {...props}
    >
      {children}
    </ContrastText>
  );
}

export function ContrastSubtitle({ 
  children, 
  backgroundColor = 'white', 
  className = '',
  ...props 
}: Omit<ContrastTextProps, 'type' | 'as'>) {
  return (
    <ContrastText 
      backgroundColor={backgroundColor}
      type="secondary"
      as="h2"
      className={`font-medium ${className}`}
      {...props}
    >
      {children}
    </ContrastText>
  );
}

export function ContrastMuted({ 
  children, 
  backgroundColor = 'white', 
  className = '',
  ...props 
}: Omit<ContrastTextProps, 'type' | 'as'>) {
  return (
    <ContrastText 
      backgroundColor={backgroundColor}
      type="muted"
      as="span"
      className={`text-sm ${className}`}
      {...props}
    >
      {children}
    </ContrastText>
  );
}

// Higher-order component for automatic contrast
export function withContrast<T extends Record<string, any>>(
  WrappedComponent: React.ComponentType<T>,
  defaultBackgroundColor: string = 'white'
) {
  return function ContrastWrapper(props: T & { backgroundColor?: string; className?: string }) {
    const { backgroundColor = defaultBackgroundColor, className = '', ...otherProps } = props;
    const contrastClass = getSafeTextColor(backgroundColor);
    const combinedClassName = `${contrastClass} ${className}`.trim();
    
    return (
      <WrappedComponent 
        {...otherProps as T}
        className={combinedClassName}
      />
    );
  };
} 