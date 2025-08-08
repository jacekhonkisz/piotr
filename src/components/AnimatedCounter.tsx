'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  delay?: number;
  formatValue?: (value: number) => string;
  className?: string;
}

export default function AnimatedCounter({
  value,
  duration = 2,
  delay = 0,
  formatValue = (value) => value.toLocaleString(),
  className = "text-4xl font-bold"
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const count = useMotionValue(0);

  useEffect(() => {
    const controls = animate(count, value, {
      duration,
      delay,
      ease: "easeOut",
      onUpdate: (latest) => {
        setDisplayValue(Math.round(latest));
      }
    });

    return controls.stop;
  }, [value, count, duration, delay]);

  return (
    <motion.span className={className}>
      {formatValue(displayValue)}
    </motion.span>
  );
} 