import { motion } from 'motion/react';

export default function MotionLink({ children, className = '', ...props }) {
  return (
    <motion.a
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={className}
      {...props}
    >
      {children}
    </motion.a>
  );
}
