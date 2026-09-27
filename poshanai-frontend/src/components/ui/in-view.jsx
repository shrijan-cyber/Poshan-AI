'use client';

import { useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';

const defaultVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export function InView({
  children,
  variants = defaultVariants,
  transition,
  viewOptions,
  as = 'div',
  once,
  ...props
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, viewOptions);
  const shouldReduceMotion = useReducedMotion();
  const [isViewed, setIsViewed] = useState(false);

  const MotionComponent = motion[as];

  return (
    <MotionComponent
      ref={ref}
      initial={shouldReduceMotion ? false : 'hidden'}
      onAnimationComplete={() => {
        if (once && isInView) setIsViewed(true);
      }}
      animate={shouldReduceMotion || isInView || isViewed ? 'visible' : 'hidden'}
      variants={variants}
      transition={transition}
      {...props}
    >
      {children}
    </MotionComponent>
  );
}
