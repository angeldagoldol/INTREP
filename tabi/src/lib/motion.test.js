import { backdrop, ease, fadeUp, spring, stagger } from './motion.js';

describe('motion presets', () => {
  it('builds staggered parents', () => {
    expect(stagger()).toEqual({ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0 } } });
    expect(stagger(0.05, 0.2).show.transition).toEqual({ staggerChildren: 0.05, delayChildren: 0.2 });
  });

  it('exposes cubic-bezier curves and spring configs', () => {
    for (const curve of Object.values(ease)) expect(curve).toHaveLength(4);
    for (const config of Object.values(spring)) expect(config.type).toBe('spring');
  });

  it('pairs hidden and shown states for variants', () => {
    expect(fadeUp.hidden.opacity).toBe(0);
    expect(fadeUp.show.opacity).toBe(1);
    expect(backdrop.exit.opacity).toBe(0);
  });
});
