import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './Cursor.css';

export default function Cursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(max-width: 768px)').matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;

    const xDot = gsap.quickTo(dot, 'x', { duration: 0.08 });
    const yDot = gsap.quickTo(dot, 'y', { duration: 0.08 });
    const xRing = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
    const yRing = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });

    const onMove = (e) => { xDot(e.clientX); yDot(e.clientY); xRing(e.clientX); yRing(e.clientY); };

    const onEnter = () => gsap.to(ring, { scale: 1.7, opacity: 0.5, duration: 0.25, ease: 'power2.out' });
    const onLeave = () => gsap.to(ring, { scale: 1, opacity: 1, duration: 0.25, ease: 'power2.out' });

    window.addEventListener('mousemove', onMove);
    document.querySelectorAll('a, button').forEach(el => {
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
    });

    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  );
}
