import { AnimatePresence, motion } from 'framer-motion';

import { ease } from '../theme';

/** A screen-within-a-screen change: the old one fades, the new one rises in. */
export function Swap({ k, children, style }) {
  return (
    <div style={{ flex: 1, position: 'relative', ...style }}>
      <AnimatePresence initial={false}>
        <motion.div
          key={k}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.35, ease } }}
          transition={{ duration: 0.7, ease, delay: 0.12 }}
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
