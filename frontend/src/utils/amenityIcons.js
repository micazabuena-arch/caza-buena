import {
  BedDouble,
  Building2,
  Bus,
  Candy,
  Car,
  Coffee,
  CookingPot,
  MapPin,
  Mic2,
  Projector,
  ShowerHead,
  Sparkles,
  Utensils,
  Waves,
  Wifi,
  Wind,
} from 'lucide-react';

/** Map amenity icon names from API/seed to Lucide components (never import * from lucide-react). */
export const AMENITY_ICONS = {
  Building2,
  Waves,
  Projector,
  Coffee,
  Candy,
  Mic2,
  CookingPot,
  BedDouble,
  Wind,
  ShowerHead,
  Utensils,
  Wifi,
  MapPin,
  Car,
  Bus,
  Sparkles,
};

export function getAmenityIcon(name) {
  return AMENITY_ICONS[name] || Sparkles;
}
