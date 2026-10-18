import { motion, useReducedMotion } from 'framer-motion';
import { Hanko, RevealText, VerticalText } from '../../../components/ui/index.js';
import { CoverArt } from '../../../components/brochure/index.js';
import { Photo } from '../../../components/photo/Photo.jsx';
import { TEMPLATES } from '../../../components/studio/templates.js';
import { ease, fadeUp, stagger } from '../../../lib/motion.js';
import styles from './StartHero.module.css';

const STEPS = [
  { n: '01', jp: '選ぶ', title: 'Choose', text: 'A template, a blank page or any brochure from the library.' },
  { n: '02', jp: '整える', title: 'Make it yours', text: 'Words, colours, patterns and pages — the preview follows every keystroke.' },
  { n: '03', jp: '刷る', title: 'Publish', text: 'Stamp it, and it joins the library as a flip-through brochure.' },
];

/** Three template covers — each a photograph of its real place — fanned out like proofs on a desk. */
const FAN = [
  { template: TEMPLATES[1], rotate: -11, x: '-30%', y: 18, z: 1 },
  { template: TEMPLATES[2], rotate: 8, x: '30%', y: 26, z: 2 },
  { template: TEMPLATES[0], rotate: -1, x: '0%', y: 0, z: 3 },
];

/**
 * Start-screen masthead: "Make your own Japan brochure · 作る", the three
 * steps, and a fan of template covers (their cover photographs, the art
 * until each arrives) beside a vertical 作る.
 */
export function StartHero() {
  const reduce = useReducedMotion();
  return (
    <header className={`container ${styles.hero}`}>
      <motion.div className={styles.copy} initial="hidden" animate="show" variants={stagger(0.08, 0.05)}>
        <motion.p className="eyebrow" variants={fadeUp}>
          Studio <span lang="ja">· スタジオ</span>
        </motion.p>
        <RevealText
          as="h1"
          immediate
          className={styles.title}
          text={['Make your own ', { text: 'Japan', className: styles.accent }, ' brochure']}
        />
        <motion.p className={styles.lead} variants={fadeUp}>
          Start from a ready-made template, a blank page or any brochure in the library. Change every word, colour and
          pattern, watch the pages update as you type, then publish it to your shelf. It saves as you go.
        </motion.p>
        <motion.ol className={styles.steps} variants={stagger(0.1, 0.35)}>
          {STEPS.map((s) => (
            <motion.li key={s.n} className={styles.step} variants={fadeUp}>
              <span className={styles.stepNo}>{s.n}</span>
              <span lang="ja" className={styles.stepJp} aria-hidden="true">
                {s.jp}
              </span>
              <span className={styles.stepTitle}>{s.title}</span>
              <span className={styles.stepText}>{s.text}</span>
            </motion.li>
          ))}
        </motion.ol>
      </motion.div>

      <div className={styles.stage} aria-hidden="true">
        <span className={styles.crop} />
        <div className={styles.fan}>
          {FAN.map(({ template, rotate, x, y, z }, i) => (
            <motion.div
              key={template.id}
              className={styles.sheet}
              style={{ zIndex: z }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 140, rotate: rotate * 2.2, x }}
              animate={{ opacity: 1, y, rotate, x, transition: { duration: 1.2, ease: ease.out, delay: 0.25 + i * 0.12 } }}
            >
              <Photo
                id={template.brochure.cover.photo}
                alt=""
                sizes="220px"
                priority={i === FAN.length - 1}
                className={styles.sheetPhoto}
                fallback={<CoverArt style={template.brochure.cover.art} seed={template.brochure.cover.seed} theme={template.brochure.theme} animated />}
              />
              <VerticalText className={styles.sheetJp} style={{ color: template.brochure.theme.ink, background: template.brochure.theme.paper }}>
                {template.brochure.titleJp}
              </VerticalText>
            </motion.div>
          ))}
        </div>
        <div className={styles.side}>
          <VerticalText className={styles.make}>作る</VerticalText>
          <motion.span
            className={styles.seal}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.2, rotate: -20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 420, damping: 22, delay: 0.95 } }}
          >
            <Hanko text="制作" size={58} />
          </motion.span>
          <span className={styles.romaji}>tsukuru · to make</span>
        </div>
      </div>
    </header>
  );
}
