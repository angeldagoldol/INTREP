import {
  ArrowLeft, ArrowRight, ArrowUpRight, Award, Banknote, Bath, Bed, Beer, Bike, Bird, Bookmark, BookOpen, Briefcase,
  Brush, Building2, Bus, Calendar, Camera, Castle, Check, ChevronDown, ChevronLeft, ChevronRight, Cloud, CloudRain,
  Clock, Coffee, Compass, Copy, CreditCard, Download, Drama, Eye, Fan, Fish, Flame, Flower, Flower2, Footprints,
  Gamepad2, Gem, Globe, Heart, Hotel, House, Info, Lamp, Landmark, Languages, Layers, LayoutGrid, Leaf, List,
  Luggage, Mail, MapPin, Martini, Moon, MoonStar, Mountain, MountainSnow, Music, Palette, PenLine, Phone,
  Plane, Plug, Plus, Printer, Recycle, Route, Sailboat, Scroll, Search, Share2, Shield, Ship, ShoppingBag,
  Signpost, Smartphone, Snowflake, Soup, Sparkles, Sprout, Star, Store, Sun, Sunrise, Sunset, Swords, Tent,
  Ticket, TrainFront, TramFront, TreeDeciduous, TreePine, Umbrella, Users, Utensils, Wallet, Waves, Wheat, Wifi,
  Wind, Wine, Zap,
} from 'lucide-react';
import { dict } from '../../data/lookup.js';

/**
 * Named icon registry. Brochure data stores icons by name (e.g. "Landmark") so
 * it stays JSON-serialisable; this maps names to components. Only icons listed
 * here end up in the bundle. The registry has no prototype, so a stored name
 * like "constructor" falls back to the sparkle instead of finding Object.
 */
export const ICONS = dict({
  ArrowLeft, ArrowRight, ArrowUpRight, Award, Banknote, Bath, Bed, Beer, Bike, Bird, Bookmark, BookOpen, Briefcase,
  Brush, Building2, Bus, Calendar, Camera, Castle, Check, ChevronDown, ChevronLeft, ChevronRight, Cloud, CloudRain,
  Clock, Coffee, Compass, Copy, CreditCard, Download, Drama, Eye, Fan, Fish, Flame, Flower, Flower2, Footprints,
  Gamepad2, Gem, Globe, Heart, Hotel, House, Info, Lamp, Landmark, Languages, Layers, LayoutGrid, Leaf, List,
  Luggage, Mail, MapPin, Martini, Moon, MoonStar, Mountain, MountainSnow, Music, Palette, PenLine, Phone,
  Plane, Plug, Plus, Printer, Recycle, Route, Sailboat, Scroll, Search, Share2, Shield, Ship, ShoppingBag,
  Signpost, Smartphone, Snowflake, Soup, Sparkles, Sprout, Star, Store, Sun, Sunrise, Sunset, Swords, Tent,
  Ticket, TrainFront, TramFront, TreeDeciduous, TreePine, Umbrella, Users, Utensils, Wallet, Waves, Wheat, Wifi,
  Wind, Wine, Zap,
});

export const ICON_NAMES = Object.keys(ICONS);

/** <Icon name="Landmark" size={20} />. Unknown names render a neutral sparkle. */
export function Icon({ name, size = 18, strokeWidth = 1.75, ...rest }) {
  const Component = ICONS[name] ?? Sparkles;
  return <Component size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...rest} />;
}
