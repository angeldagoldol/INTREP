import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Modal } from '../../../components/ui/index.js';
import { useBrochures } from '../../../context/BrochureContext.jsx';
import { useToast } from '../../../context/ToastContext.jsx';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { clearDraft, DRAFT_KEY, readDraft, writeDraft } from '../../../components/studio/draftStore.js';
import { createBlank, createFromTemplate, createRemix, TEMPLATES } from '../../../components/studio/templates.js';
import { loadBrochure } from '../../../data/catalog.js';
import { stagger, viewportOnce } from '../../../lib/motion.js';
import { BlankArt } from './BlankArt.jsx';
import { ContinueDraft } from './ContinueDraft.jsx';
import { OptionCard } from './OptionCard.jsx';
import { RemixArt } from './RemixArt.jsx';
import { RemixPicker } from './RemixPicker.jsx';
import { SectionTitle } from './SectionTitle.jsx';
import { StartHero } from './StartHero.jsx';
import { TemplateCard } from './TemplateCard.jsx';
import styles from './StudioStart.module.css';

/**
 * Studio start screen (#/studio): continue a draft, or begin from one of
 * five templates, a blank brochure or a remix of a library brochure.
 * Starting something new while a draft exists asks before replacing it.
 */
export function StudioStart() {
  const navigate = useNavigate();
  const toast = useToast();
  const { builtins } = useBrochures();
  const [draft, setDraft] = useState(() => readDraft(DRAFT_KEY));
  const [pending, setPending] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [remixOpen, setRemixOpen] = useState(false);

  useDocumentTitle('Studio');

  const open = (doc) => {
    if (!writeDraft(DRAFT_KEY, { doc, selectedId: doc.pages[0]?.id ?? null })) {
      toast({ title: 'Storage is full', description: 'Your browser refused to save the draft — free some space and try again.', tone: 'error' });
      return;
    }
    navigate('/studio?draft=1');
  };

  /** Open what `make` returns; a library brochure's pages may still have to load (a promise). */
  const run = (make) => {
    const doc = make();
    if (typeof doc?.then !== 'function') {
      open(doc);
      return;
    }
    doc.then(open, () =>
      toast({ title: 'That brochure didn’t load', description: 'Check your connection and try again.', tone: 'error' }),
    );
  };

  /** Run `make` now, or after confirming that the current draft may be replaced. */
  const start = (label, make) => {
    if (draft) setPending({ label, make });
    else run(make);
  };

  const discardDraft = () => {
    clearDraft(DRAFT_KEY);
    setDraft(null);
    setConfirmDiscard(false);
    toast({ title: 'Draft discarded' });
  };

  const draftTitle = draft?.doc.title?.trim() || 'Untitled brochure';

  return (
    <div className={styles.start}>
      <StartHero />

      {draft && <ContinueDraft draft={draft} onContinue={() => navigate('/studio?draft=1')} onDiscard={() => setConfirmDiscard(true)} />}

      <section className="container" aria-labelledby="studio-templates">
        <SectionTitle index="01" id="studio-templates" title="Start from a template" jp="型から" note={`${TEMPLATES.length} ready-to-edit Japan brochures`} />
        <motion.ul className={styles.templates} initial="hidden" whileInView="show" viewport={viewportOnce} variants={stagger(0.08)}>
          {TEMPLATES.map((template, index) => (
            <TemplateCard key={template.id} template={template} index={index} onChoose={(t) => start(t.name, () => createFromTemplate(t.id))} />
          ))}
        </motion.ul>
      </section>

      <section className={`container ${styles.more}`} aria-labelledby="studio-other">
        <SectionTitle index="02" id="studio-other" title="Or begin your own way" jp="自由に" />
        <motion.ul className={styles.options} initial="hidden" whileInView="show" viewport={viewportOnce} variants={stagger(0.1)}>
          <OptionCard index={0} art={<BlankArt />} title="Blank brochure" jp="白紙" cta="Start blank" onChoose={() => start('a blank brochure', () => createBlank())}>
            A cover, an introduction and a back cover — the rest is up to you. Add pages as you go.
          </OptionCard>
          <OptionCard index={1} art={<RemixArt brochures={builtins} />} title="Remix a library brochure" jp="写し" cta="Choose a brochure" onChoose={() => setRemixOpen(true)}>
            Copy any of the {builtins.length} brochures in the library and make it your own. The original stays untouched.
          </OptionCard>
        </motion.ul>
        <p className={styles.privacy}>
          <span lang="ja" aria-hidden="true">
            保存
          </span>
          Everything you make stays in this browser — nothing is uploaded.
        </p>
      </section>

      <RemixPicker
        open={remixOpen}
        onClose={() => setRemixOpen(false)}
        brochures={builtins}
        onPick={(brochure) => {
          setRemixOpen(false);
          start(`a remix of “${brochure.title}”`, () => loadBrochure(brochure).then((full) => createRemix(full)));
        }}
      />

      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        size="sm"
        title="Replace your draft?"
        description={`“${draftTitle}” hasn’t been published yet. Starting ${pending?.label ?? 'something new'} will replace it.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Keep my draft
            </Button>
            <Button variant="accent" onClick={() => run(pending.make)}>
              Replace draft
            </Button>
          </>
        }
      >
        <p className={styles.modalNote}>Tip: open your draft and use Export JSON first if you want to keep a copy.</p>
      </Modal>

      <Modal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        size="sm"
        title="Discard this draft?"
        description={`“${draftTitle}” will be deleted from this browser. This can’t be undone.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>
              Keep it
            </Button>
            <Button variant="accent" onClick={discardDraft}>
              Discard draft
            </Button>
          </>
        }
      />
    </div>
  );
}
