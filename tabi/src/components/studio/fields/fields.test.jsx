import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { MemoryRouter } from 'react-router-dom';
import { BrochureProvider } from '../../../context/BrochureContext.jsx';
import { CoordsField } from './CoordsField.jsx';
import { PhotoField } from './PhotoField.jsx';
import { PhotoPicker } from './PhotoPicker.jsx';
import { UrlField } from './UrlField.jsx';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

const brochure = {
  title: 'Osaka',
  theme: { paper: '#f4eee2', ink: '#22140f', accent: '#d23a22', accent2: '#1d4f7a', muted: '#6e5b4f', typeface: 'serif' },
  cover: { art: 'seigaiha', seed: 3 },
  pages: [],
};
const upload = { src: 'data:image/jpeg;base64,QUJD', alt: 'Lanterns over a lane', width: 1600, height: 1067, credit: { author: 'Your photo', license: '' } };

const withProviders = (ui) => render(<MemoryRouter>{<BrochureProvider>{ui}</BrochureProvider>}</MemoryRouter>);

describe('<CoordsField>', () => {
  function Harness({ initial = { lat: '', lng: '' }, onChange = () => {} }) {
    const [coords, setCoords] = useState(initial);
    return (
      <CoordsField
        lat={coords.lat}
        lng={coords.lng}
        onChange={(next, typing) => {
          setCoords(next);
          onChange(next, typing);
        }}
      />
    );
  }

  it('fills both boxes from a pasted pair', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const lat = screen.getByLabelText('Latitude');
    fireEvent.paste(lat, { clipboardData: { getData: () => '34.99485, 135.78505' } });
    expect(onChange).toHaveBeenLastCalledWith({ lat: 34.9949, lng: 135.7851 }, false);
    expect(lat).toHaveValue('34.9949');
    expect(screen.getByLabelText('Longitude')).toHaveValue('135.7851');
    expect(screen.getByText('34.9949° N, 135.7851° E')).toBeInTheDocument();
  });

  it('keeps half-typed numbers and explains what is missing', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '34.' } });
    expect(screen.getByLabelText('Latitude')).toHaveValue('34.');
    expect(onChange).toHaveBeenLastCalledWith({ lat: 34, lng: '' }, true);
    expect(screen.getByText(/Add the longitude too/)).toBeInTheDocument();
  });

  it('offers to swap a pair typed the wrong way round', () => {
    const onChange = vi.fn();
    render(<Harness initial={{ lat: 135.7727, lng: 34.9671 }} onChange={onChange} />);
    expect(screen.getByText(/These look swapped/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Swap them/ }));
    expect(onChange).toHaveBeenLastCalledWith({ lat: 34.9671, lng: 135.7727 }, false);
    expect(screen.queryByText(/These look swapped/)).not.toBeInTheDocument();
  });

  it('warns about a point outside Japan, and draws no map', () => {
    render(<Harness initial={{ lat: 48.8566, lng: 2.3522 }} />);
    expect(screen.getByText(/outside Japan/)).toBeInTheDocument();
    expect(screen.getByLabelText('Latitude')).toHaveAccessibleDescription(/outside Japan/);
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('<UrlField>', () => {
  function Harness({ initial = '', onChange = () => {} }) {
    const [value, setValue] = useState(initial);
    return (
      <UrlField
        label="Official website"
        value={value}
        onChange={(next, typing) => {
          setValue(next);
          onChange(next, typing);
        }}
      />
    );
  }

  it('says where a good link leads', () => {
    render(<Harness initial="https://www.kiyomizudera.or.jp/en/" />);
    expect(screen.getByLabelText('Official website')).toHaveAccessibleDescription('Opens kiyomizudera.or.jp in a new tab');
  });

  it('fixes http and bare addresses in one click, and bare ones on leaving the box', () => {
    const onChange = vi.fn();
    render(<Harness initial="http://example.jp" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Use https/ }));
    expect(onChange).toHaveBeenLastCalledWith('https://example.jp', false);
    const input = screen.getByLabelText('Official website');
    fireEvent.change(input, { target: { value: 'www.japan.travel' } });
    expect(screen.getByRole('button', { name: /Add https:\/\// })).toBeInTheDocument();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith('https://www.japan.travel', false);
  });

  it('marks anything that is not a web link as an error', () => {
    render(<Harness initial="javascript:alert(1)" />);
    expect(screen.getByLabelText('Official website')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Only web links can go here/)).toBeInTheDocument();
  });
});

describe('<PhotoPicker>', () => {
  const renderPicker = (props = {}) => {
    const handlers = { onClose: vi.fn(), onPick: vi.fn(), onAdd: vi.fn(), onUpdatePhoto: vi.fn(), onRemovePhoto: vi.fn() };
    withProviders(<PhotoPicker open value="" brochure={brochure} label="Photo" hints={['Dōtonbori']} {...handlers} {...props} />);
    return handlers;
  };

  it('lists the library by brochure, says nothing is downloaded yet, and suggests photos of the place', () => {
    renderPicker();
    const dialog = screen.getByRole('dialog', { name: 'Choose a photo' });
    expect(within(dialog).getByText(/None is downloaded yet/)).toBeInTheDocument();
    const suggested = within(dialog).getByRole('group', { name: /Suggested for Dōtonbori/ });
    expect(within(suggested).getAllByRole('option').length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('group', { name: /Osaka: Eat Until You Drop/ })).toBeInTheDocument();
  });

  it('searches across places and captions, and uses a photo with Enter', () => {
    const { onPick, onClose } = renderPicker({ hints: [] });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search photos' }), { target: { value: 'kuromon' } });
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveAccessibleName(/Kuromon Market/);
    fireEvent.keyDown(options[0], { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('osaka-kuromon-market');
    expect(onClose).toHaveBeenCalled();
  });

  it('selects with a click and uses the selection from the footer', () => {
    const { onPick } = renderPicker({ hints: [] });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search photos' }), { target: { value: 'kuromon' } });
    fireEvent.click(screen.getByRole('option'));
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Use this photo/ }));
    expect(onPick).toHaveBeenCalledWith('osaka-kuromon-market');
  });

  it('explains an empty search and offers to upload instead', () => {
    renderPicker({ hints: [] });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search photos' }), { target: { value: 'zzzz-no-such-place' } });
    expect(screen.getByText(/No photos match “zzzz-no-such-place”/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Upload your own/ }));
    expect(screen.getByText(/Drop a photo here/)).toBeInTheDocument();
  });

  it('refuses a file that is not a photo, with a reason', async () => {
    renderPicker({ hints: [] });
    fireEvent.click(screen.getByRole('tab', { name: /Your photos/ }));
    const input = screen.getByLabelText(/Drop a photo here/);
    const file = new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/notes\.pdf isn’t a photo the Studio can use/);
  });

  it('shows the brochure’s own uploads with their size, and removes one after a confirmation', () => {
    const doc = { ...brochure, userPhotos: { ph1: upload }, pages: [{ id: 'p1', type: 'intro', photo: 'user:ph1' }] };
    const { onRemovePhoto } = renderPicker({ brochure: doc, value: 'user:ph1', hints: [] });
    // The tab holding the current photo opens first, with it selected.
    const option = screen.getByRole('option', { name: /Lanterns over a lane/ });
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/1600 × 1067 · 27 B stored · on 1 page/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemovePhoto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove from 1 page?' }));
    expect(onRemovePhoto).toHaveBeenCalledWith('ph1');
  });

  it('edits an upload’s description and credit in place', () => {
    const doc = { ...brochure, userPhotos: { ph1: upload } };
    const { onUpdatePhoto } = renderPicker({ brochure: doc, value: 'user:ph1', hints: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    fireEvent.change(screen.getByLabelText(/Credit/), { target: { value: 'Aiko Tanaka' } });
    expect(onUpdatePhoto).toHaveBeenCalledWith('ph1', ['credit', 'author'], 'Aiko Tanaka', true);
  });
});

describe('<PhotoField>', () => {
  it('says when a chosen photo is not downloaded yet, and removes it', () => {
    const photos = { place: vi.fn(), upload: vi.fn(), update: vi.fn(), remove: vi.fn() };
    withProviders(<PhotoField label="Photo" value="osaka-kuromon-market" brochure={brochure} photos={photos} />);
    expect(screen.getByText('Not downloaded yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(photos.place).toHaveBeenCalledWith('');
  });

  it('suggests library photos of the place when empty and opens the picker', async () => {
    const photos = { place: vi.fn(), upload: vi.fn(), update: vi.fn(), remove: vi.fn() };
    withProviders(<PhotoField label="Photo" value="" brochure={brochure} hints={['Kuromon Market']} photos={photos} />);
    fireEvent.click(screen.getByRole('button', { name: /library photo.* match.* “Kuromon Market”/ }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Choose a photo' })).toBeInTheDocument());
  });

  it('shows an upload as the brochure’s own photo', () => {
    const photos = { place: vi.fn(), upload: vi.fn(), update: vi.fn(), remove: vi.fn() };
    withProviders(<PhotoField label="Photo" value="user:ph1" brochure={{ ...brochure, userPhotos: { ph1: upload } }} photos={photos} />);
    expect(screen.getByText('Lanterns over a lane')).toBeInTheDocument();
    expect(screen.getAllByText('Your photo').length).toBeGreaterThan(0);
    expect(screen.getByText(/1600 × 1067 · stored in this brochure/)).toBeInTheDocument();
  });
});
