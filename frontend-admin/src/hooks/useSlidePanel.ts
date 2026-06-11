import { useState, useEffect, useCallback } from 'react';

export function useSlidePanel(open: boolean, onClose: () => void, duration = 200) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    } else {
      setVisible(false);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => onClose(), duration);
  }, [onClose, duration]);

  const slideClass = visible ? 'translate-x-0' : 'translate-x-full';
  const shouldRender = open || visible;

  return { slideClass, shouldRender, handleClose };
}
