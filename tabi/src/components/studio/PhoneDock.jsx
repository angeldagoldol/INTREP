import { Eye, PenLine, Stamp } from 'lucide-react';
import { Button } from '../ui/index.js';
import { SavedIndicator } from './SavedIndicator.jsx';
import { SegmentedControl } from './SegmentedControl.jsx';
import styles from './PhoneDock.module.css';

const VIEWS = [
  { value: 'edit', label: 'Edit', icon: <PenLine />, sub: '編集', lang: 'ja' },
  { value: 'preview', label: 'Preview', icon: <Eye />, sub: '確認', lang: 'ja' },
];

/**
 * Thumb-reach dock for phones: switch between editing and the live preview,
 * see the autosave state and publish.
 */
export function PhoneDock({ view, onViewChange, onPublish, publishLabel, publishDisabled, save, mode, dirty }) {
  return (
    <div className={styles.dock} data-print="hide">
      <SegmentedControl label="Studio view" value={view} onChange={onViewChange} options={VIEWS} className={styles.views} />
      <SavedIndicator {...save} mode={mode} dirty={dirty} compact />
      <Button variant="accent" size="md" iconLeft={<Stamp />} onClick={onPublish} disabled={publishDisabled}>
        {publishLabel}
      </Button>
    </div>
  );
}
