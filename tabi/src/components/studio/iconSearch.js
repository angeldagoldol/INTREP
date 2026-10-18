/**
 * Search for the icon picker: matches icon names ("TreePine" → "tree pine")
 * plus travel keywords, so "temple", "ramen" or "onsen" find the right icon.
 */
const KEYWORDS = {
  Landmark: 'temple shrine museum heritage monument jinja tera',
  Castle: 'castle shiro fortress daimyo samurai',
  Bath: 'onsen hot spring bath sento ryokan',
  Soup: 'ramen udon soba noodles miso broth food',
  Utensils: 'food restaurant dinner meal kaiseki eat',
  Fish: 'sushi sashimi seafood market fish',
  Coffee: 'tea matcha cafe coffee kissaten',
  Wine: 'sake drink bar wine',
  Beer: 'beer izakaya drink pub',
  Martini: 'bar cocktail nightlife drink',
  TrainFront: 'train shinkansen rail station jr metro',
  TramFront: 'tram streetcar train',
  Bus: 'bus coach transport',
  Plane: 'flight airport plane',
  Ship: 'ferry boat ship island cruise',
  Sailboat: 'boat sailing harbour lake',
  MountainSnow: 'fuji mountain snow alps ski',
  Mountain: 'mountain hike peak volcano',
  Flower2: 'sakura cherry blossom hanami spring flower',
  Flower: 'flower garden blossom',
  TreeDeciduous: 'maple momiji autumn tree bamboo forest',
  TreePine: 'pine forest cedar tree',
  Leaf: 'leaf tea green nature autumn',
  Snowflake: 'snow winter ice ski cold',
  Sun: 'sun summer weather',
  Sunrise: 'sunrise dawn morning hinode',
  Sunset: 'sunset dusk evening',
  Moon: 'moon night tsukimi',
  MoonStar: 'night stars sky nightlife',
  Waves: 'sea beach ocean coast water wave',
  Lamp: 'lantern chochin light evening',
  Flame: 'fire grill yakitori festival bonfire',
  Sparkles: 'fireworks hanabi sparkle magic highlight',
  Drama: 'theatre kabuki noh performance mask',
  Music: 'music taiko drum song festival',
  Fan: 'fan uchiwa summer',
  Brush: 'calligraphy shodo art craft brush',
  Palette: 'art paint craft colour',
  Scroll: 'scroll history goshuin calligraphy',
  Swords: 'samurai katana sword martial',
  Footprints: 'walk hike stroll footpath',
  Route: 'route trail itinerary path',
  MapPin: 'location address place pin',
  Compass: 'explore direction compass',
  Hotel: 'hotel stay accommodation',
  Bed: 'ryokan futon sleep stay room',
  House: 'home machiya house minka',
  Tent: 'camp camping outdoors',
  ShoppingBag: 'shopping souvenir omiyage market',
  Store: 'shop store konbini market',
  Ticket: 'ticket pass entry admission',
  Camera: 'photo camera view',
  Gem: 'luxury premium jewel',
  Heart: 'love favourite romance',
  Users: 'group people family friends',
  Mail: 'email contact letter',
  Phone: 'phone call contact',
  Globe: 'website web world internet',
  Wifi: 'wifi internet connection',
  Calendar: 'date calendar schedule season',
  Clock: 'time hours opening',
  Wallet: 'money price budget yen',
  Banknote: 'money cash yen price',
  CreditCard: 'card payment',
  Umbrella: 'rain umbrella tsuyu weather',
  CloudRain: 'rain weather tsuyu',
  Bird: 'bird crane tsuru wildlife',
  Wheat: 'rice field farm harvest noodles',
  Sprout: 'garden grow spring green',
  Bike: 'cycling bicycle bike',
  Luggage: 'luggage travel suitcase trip',
  Shield: 'safe safety secure',
  Award: 'award prize best',
  Star: 'star review rating',
};

/** "TrainFront" → "train front" */
export function humanizeIcon(name) {
  return String(name)
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .toLowerCase();
}

/**
 * Icon names matching `query`, best first: exact name, then name prefix,
 * then any word of the name or its keywords starting with each query word.
 */
export function searchIcons(names, query) {
  const words = String(query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return names;
  const scored = [];
  for (const name of names) {
    const label = humanizeIcon(name);
    const haystack = `${label} ${KEYWORDS[name] ?? ''}`.split(/\s+/);
    if (!words.every((w) => haystack.some((h) => h.startsWith(w)))) continue;
    const joined = words.join(' ');
    const score = label === joined ? 0 : label.startsWith(joined) ? 1 : label.split(' ').some((p) => p.startsWith(words[0])) ? 2 : 3;
    scored.push({ name, score });
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.name);
}
