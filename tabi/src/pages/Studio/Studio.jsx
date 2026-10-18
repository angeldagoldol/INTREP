import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, PenLine, Shuffle } from 'lucide-react';
import { Button } from '../../components/ui/index.js';
import { StudioEditor } from '../../components/studio/StudioEditor.jsx';
import { contentSignature, DRAFT_KEY, editDraftKey, readDraft, writeDraft } from '../../components/studio/draftStore.js';
import { createRemix } from '../../components/studio/templates.js';
import { useBrochures } from '../../context/BrochureContext.jsx';
import { useFullBrochure } from '../../hooks/useFullBrochure.js';
import { StudioMessage } from './sections/StudioMessage.jsx';
import { StudioStart } from './sections/StudioStart.jsx';

/** #/studio?draft=1 — the working draft, restored from storage. */
function DraftSession() {
  const [draft] = useState(() => readDraft(DRAFT_KEY));
  if (!draft) return <Navigate to="/studio" replace />;
  return <StudioEditor key={draft.doc.id} mode="new" initial={draft} storageKey={DRAFT_KEY} />;
}

/** #/studio?from=<slug> — copy a brochure into a fresh draft, asking before replacing one. */
function RemixSession({ slug }) {
  const navigate = useNavigate();
  const { getBySlug } = useBrochures();
  // A built-in is an outline until its pages load (suspends meanwhile).
  const source = useFullBrochure(getBySlug(slug));
  const [existing] = useState(() => readDraft(DRAFT_KEY));
  const [confirmed, setConfirmed] = useState(false);
  const ready = Boolean(source) && (!existing || confirmed);

  useEffect(() => {
    if (!ready) return;
    const doc = createRemix(source);
    writeDraft(DRAFT_KEY, { doc, selectedId: doc.pages[0]?.id ?? null });
    navigate('/studio?draft=1', { replace: true });
  }, [ready, source, navigate]);

  if (!source) {
    return (
      <StudioMessage
        kanji="迷子"
        seal="無"
        eyebrow="Remix · 写し"
        title="We couldn’t find that brochure"
        actions={
          <>
            <Button to="/studio" iconRight={<ArrowRight />}>
              Open the Studio
            </Button>
            <Button to="/brochures" variant="secondary" iconLeft={<BookOpen />}>
              Browse the library
            </Button>
          </>
        }
      >
        <p>There is no brochure called “{slug}” to remix. It may have been renamed or deleted.</p>
      </StudioMessage>
    );
  }

  if (!ready) {
    return (
      <StudioMessage
        kanji="写し"
        seal="下書"
        eyebrow="Remix · 写し"
        title="You already have a draft"
        actions={
          <>
            <Button variant="accent" iconLeft={<Shuffle />} onClick={() => setConfirmed(true)}>
              Remix and replace draft
            </Button>
            <Button variant="secondary" iconLeft={<PenLine />} onClick={() => navigate('/studio?draft=1', { replace: true })}>
              Continue my draft
            </Button>
          </>
        }
      >
        <p>
          Remixing “{source.title}” will replace “{existing.doc.title?.trim() || 'Untitled brochure'}”, which hasn’t been published yet.
        </p>
      </StudioMessage>
    );
  }

  return null;
}

/** #/studio/:id — edit a brochure from your shelf, restoring unsaved changes. */
function EditSession({ id }) {
  const { getById } = useBrochures();
  const [setup] = useState(() => {
    const brochure = getById(id);
    if (!brochure) return { kind: 'missing' };
    if (brochure.source !== 'user') return { kind: 'builtin', brochure };
    const key = editDraftKey(id);
    const stored = readDraft(key);
    const changed = stored && stored.doc.id === id && contentSignature(stored.doc) !== contentSignature(brochure);
    return {
      kind: 'edit',
      key,
      brochure,
      restored: Boolean(changed),
      initial: changed ? stored : { doc: structuredClone(brochure), selectedId: null, savedAt: 0 },
    };
  });

  if (setup.kind === 'missing') {
    const draft = readDraft(DRAFT_KEY);
    return (
      <StudioMessage
        kanji="迷子"
        seal="無"
        eyebrow="Studio · 編集"
        title="This brochure isn’t on your shelf"
        actions={
          <>
            <Button to="/studio" iconRight={<ArrowRight />}>
              Make a new brochure
            </Button>
            {draft && (
              <Button to="/studio?draft=1" variant="secondary" iconLeft={<PenLine />}>
                Continue your draft
              </Button>
            )}
            <Button to="/brochures" variant="ghost" iconLeft={<BookOpen />}>
              Browse the library
            </Button>
          </>
        }
      >
        <p>It may have been deleted, or it was made in another browser — brochures you create are kept on this device only.</p>
      </StudioMessage>
    );
  }

  if (setup.kind === 'builtin') {
    const { brochure } = setup;
    return (
      <StudioMessage
        kanji={brochure.titleJp || '旅'}
        seal="原本"
        eyebrow="Library brochure · 原本"
        title="Library brochures are read-only"
        actions={
          <>
            <Button to={`/studio?from=${encodeURIComponent(brochure.slug)}`} variant="accent" iconLeft={<Shuffle />}>
              Remix this brochure
            </Button>
            <Button to={`/brochures/${brochure.slug}`} variant="secondary" iconLeft={<BookOpen />}>
              Read it
            </Button>
          </>
        }
      >
        <p>“{brochure.title}” is part of the Tabi collection, so it can’t be changed — but you can copy it into the Studio and make it your own.</p>
      </StudioMessage>
    );
  }

  return <StudioEditor mode="edit" initial={setup.initial} baseline={setup.brochure} storageKey={setup.key} restored={setup.restored} />;
}

/**
 * Studio route.
 *   #/studio              start screen (templates, blank, remix, continue draft)
 *   #/studio?draft=1      the working draft in the editor
 *   #/studio?from=<slug>  remix a brochure into a new draft
 *   #/studio/:id          edit one of your published brochures
 */
export default function Studio() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');

  if (id) return <EditSession key={id} id={id} />;
  if (from) return <RemixSession key={from} slug={from} />;
  if (params.has('draft')) return <DraftSession />;
  return <StudioStart />;
}
