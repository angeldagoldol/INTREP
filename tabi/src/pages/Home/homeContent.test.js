import { describe, expect, it } from 'vitest';
import { getPhoto } from '../../data/photos/index.js';
import { REGIONS } from '../../data/regions.js';
import { ART_STYLES } from '../../data/schema.js';
import { SEASONS } from '../../data/seasons.js';
import {
  FACTS,
  HAIKU,
  HERO_PANELS,
  NOSTALGIC,
  REGION_NOTES,
  SEASON_LINES,
  SEASON_PHOTOS,
  SECTIONS,
  TRANSLATION_CREDIT,
  WORDS,
  homePhotoIds,
  nostalgicPhotos,
  splitCaption,
} from './homeContent.js';
import { MOSAIC_MAX } from './sections/mosaic.js';

/** The poems exactly as logged in docs/research/home.md §1.1. */
const RESEARCHED_HAIKU = {
  'basho-furuike': '古池や蛙飛びこむ水の音',
  'basho-hiraizumi': '夏草や兵どもが夢の跡',
  'basho-yamadera': '閑さや岩にしみ入る蝉の声',
  'issa-kashiwabara': '是がまあつひの栖か雪五尺',
  'shiki-horyuji': '柿食へば鐘が鳴るなり法隆寺',
};

describe('haiku postcards (no invented people)', () => {
  it('are the five researched poems, word for word', () => {
    expect(Object.fromEntries(HAIKU.map((h) => [h.id, h.jp.join('')]))).toEqual(RESEARCHED_HAIKU);
  });

  it('are by real poets of the public-domain era, with their names in Japanese', () => {
    const poets = { 'Matsuo Bashō': '松尾芭蕉', 'Kobayashi Issa': '小林一茶', 'Masaoka Shiki': '正岡子規' };
    for (const h of HAIKU) {
      expect(poets[h.poet], h.id).toBe(h.poetJp);
    }
  });

  it('give each poem three phrases in Japanese, romaji and translation, plus a place, postmark and year', () => {
    for (const h of HAIKU) {
      for (const lines of [h.jp, h.romaji, h.en]) {
        expect(lines, h.id).toHaveLength(3);
        lines.forEach((line) => expect(line.trim(), h.id).not.toBe(''));
      }
      expect(h.place, h.id).toBeTruthy();
      expect(h.postmark, h.id).toMatch(/^[A-Z]+$/);
      expect(h.year, h.id).toMatch(/^(c\. )?\d{4}$/);
      expect(ART_STYLES, h.id).toContain(h.art);
    }
  });

  it('softens the year the research marks uncertain, and credits our translations', () => {
    expect(HAIKU.find((h) => h.id === 'issa-kashiwabara').year).toBe('c. 1812');
    expect(TRANSLATION_CREDIT).toBe('Translation: Tabi Guides');
    expect(SECTIONS.haiku).toEqual({ num: '09', label: 'Haiku', jp: '俳句' });
  });
});

describe('Japan in numbers (research corrections)', () => {
  const note = (id) => FACTS.find((f) => f.id === id).note;

  it('does not claim more than the sources support', () => {
    expect(note('volcanoes')).toMatch(/^About 50 /);
    expect(note('shinkansen')).toContain('between Utsunomiya and Morioka');
    expect(note('islands')).toContain('6,852');
  });

  it('keeps the figures themselves', () => {
    expect(Object.fromEntries(FACTS.map((f) => [f.id, f.value]))).toEqual({ prefectures: 47, islands: 14125, volcanoes: 111, shinkansen: 320 });
  });
});

describe('copy corrections', () => {
  const meaning = (romaji) => WORDS.flat().find((w) => w.romaji === romaji).meaning;

  it('glosses ma and wabi-sabi as the research suggests', () => {
    expect(meaning('ma')).toBe('the space between');
    expect(meaning('wabi-sabi')).toBe('beauty in the imperfect and impermanent');
  });

  it('matches the summer line to its photograph (lavender)', () => {
    expect(SEASON_LINES.summer).toContain('lavender in Hokkaidō');
    expect(SEASON_LINES.autumn).toContain('from the peaks down');
  });
});

describe('photo slots', () => {
  it('point at photos the home manifest lists', () => {
    const ids = [...Object.values(HERO_PANELS).map((p) => p.photo), ...Object.values(SEASON_PHOTOS), ...Object.values(REGION_NOTES).map((n) => n.photo)];
    for (const id of ids) {
      expect(id).toMatch(/^home-/);
      expect(getPhoto(id), id).not.toBeNull();
    }
  });

  it('cover every season and every region, each with fallback art', () => {
    expect(Object.keys(SEASON_PHOTOS).sort()).toEqual(SEASONS.map((s) => s.id).sort());
    expect(Object.keys(REGION_NOTES).sort()).toEqual(REGIONS.map((r) => r.id).sort());
    for (const [id, note] of Object.entries(REGION_NOTES)) {
      expect(ART_STYLES, id).toContain(note.art);
      expect(note.place, id).toBeTruthy();
      expect(note.placeJp, id).toMatch(/[぀-ヿ一-鿿]/);
      expect(note.knownFor.length, id).toBeLessThanOrEqual(100);
    }
  });

  it('keep the hero panel bodies short enough for the panel (≤ 80 characters)', () => {
    for (const panel of Object.values(HERO_PANELS)) {
      expect(panel.body.length, panel.title).toBeLessThanOrEqual(80);
      expect(ART_STYLES).toContain(panel.art);
    }
  });
});

describe('sections', () => {
  it('are numbered 01–10 in page order, with Nostalgic Japan third and no map', () => {
    expect(Object.values(SECTIONS).map((s) => s.num)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
    expect(SECTIONS.nostalgic).toEqual({ num: '03', label: 'Nostalgic Japan', jp: '懐かしい日本' });
    expect(JSON.stringify(SECTIONS)).not.toMatch(/地図|map/i);
  });
});

describe('Nostalgic Japan (懐かしい日本)', () => {
  const photo = (id, use = 'any') => ({ id, use, caption: '', place: '' });

  it('takes the "nostalgic-" photos only, a cover-shaped lead first, wide ones last, at most the mosaic’s size', () => {
    const list = [photo('home-hero-fuji', 'cover'), photo('nostalgic-a', 'wide'), photo('nostalgic-b', 'any'), photo('nostalgic-c', 'cover'), photo('nostalgic-d', 'full'), photo('kyoto-x')];
    expect(nostalgicPhotos(list).map((p) => p.id)).toEqual(['nostalgic-c', 'nostalgic-b', 'nostalgic-d', 'nostalgic-a']);
    const many = Array.from({ length: 12 }, (_, i) => photo(`nostalgic-${String(i).padStart(2, '0')}`));
    expect(nostalgicPhotos(many)).toHaveLength(NOSTALGIC.limit);
    expect(NOSTALGIC.limit).toBe(MOSAIC_MAX);
  });

  it('is empty, not broken, while there are no such photos', () => {
    expect(nostalgicPhotos([])).toEqual([]);
    expect(nostalgicPhotos(undefined)).toEqual([]);
    expect(nostalgicPhotos([photo('home-x'), null, { id: 5 }])).toEqual([]);
  });

  it('splits a caption into its English line, Japanese name, title and note', () => {
    expect(splitCaption('Ginzan Onsen, Yamagata · 銀山温泉')).toMatchObject({ text: 'Ginzan Onsen, Yamagata', jp: '銀山温泉' });
    expect(splitCaption('Ouchi-juku (大内宿), Fukushima')).toMatchObject({ text: 'Ouchi-juku, Fukushima', jp: '大内宿' });
    expect(splitCaption('Narai-juku 奈良井宿 on the Nakasendō')).toMatchObject({ text: 'Narai-juku on the Nakasendō', jp: '奈良井宿' });
    expect(splitCaption('銀山温泉 — snow on the old inns')).toMatchObject({ text: 'snow on the old inns', jp: '銀山温泉' });
    expect(splitCaption('Tsumago-juku, Nagano — the 42nd post town of the Nakasendō')).toEqual({
      text: 'Tsumago-juku, Nagano — the 42nd post town of the Nakasendō',
      jp: '',
      title: 'Tsumago-juku, Nagano',
      note: 'the 42nd post town of the Nakasendō',
    });
    expect(splitCaption('A wooden station in the snow')).toEqual({ text: 'A wooden station in the snow', jp: '', title: 'A wooden station in the snow', note: '' });
    expect(splitCaption(null)).toEqual({ text: '', jp: '', title: '', note: '' });
  });

  it('shows each place once (a second view of the same street waits for the brochure)', () => {
    const at = (id, use, place) => ({ ...photo(id, use), place });
    const list = [at('nostalgic-ginzan', 'cover', 'Ginzan Onsen, Yamagata'), at('nostalgic-ginzan-lamps', 'wide', 'Ginzan Onsen, Yamagata'), at('nostalgic-otaru', 'wide', 'Otaru Canal'), at('nostalgic-x', 'any', '')];
    expect(nostalgicPhotos(list).map((p) => p.id)).toEqual(['nostalgic-ginzan', 'nostalgic-x', 'nostalgic-otaru']);
  });

  it('says what 懐かしい means, and adds its photos to the Home page’s set', () => {
    expect(NOSTALGIC.intro).toContain('懐かしい');
    expect(NOSTALGIC.slug).toBe('nostalgic-japan');
    const ids = homePhotoIds([photo('nostalgic-a'), photo('kyoto-x')]);
    expect(ids).toContain('nostalgic-a');
    expect(ids).not.toContain('kyoto-x');
    expect(ids).toContain(HERO_PANELS.left.photo);
    expect(ids).toContain(REGION_NOTES.kansai.photo);
  });
});
