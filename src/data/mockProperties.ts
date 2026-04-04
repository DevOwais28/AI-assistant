import { Property } from '../types/property';

export const mockProperties: Property[] = [
  {
    id: '1',
    location: { city: 'Karachi', area: 'Gulshan-e-Iqbal' },
    type: 'apartment',
    price: 9.5,
    bedrooms: 2,
    bathrooms: 2,
    availability: 'ready',
    amenities: ['Parking', 'Garden', 'Security'],
    description: 'A cozy 2-bedroom apartment in the heart of Gulshan-e-Iqbal. Perfect for small families.',
    image: 'https://picsum.photos/seed/apt1/800/600',
    sqft: 950
  },
  {
    id: '2',
    location: { city: 'Lahore', area: 'Gulberg' },
    type: 'commercial',
    price: 25,
    availability: 'ready',
    amenities: ['Main Road Access', 'Parking', 'CCTV'],
    description: 'Prime commercial shop in Gulberg, ideal for retail or office space.',
    image: 'https://picsum.photos/seed/comm1/800/600',
    sqft: 500
  },
  {
    id: '3',
    location: { city: 'Karachi', area: 'DHA Phase 6' },
    type: 'house',
    price: 450,
    bedrooms: 4,
    bathrooms: 5,
    availability: 'ready',
    amenities: ['Swimming Pool', 'Lawn', 'Modern Kitchen', 'Servant Quarter'],
    description: 'Luxurious 4-bedroom villa with high-end finishes and a private pool.',
    image: 'https://picsum.photos/seed/house1/800/600',
    sqft: 4500
  },
  {
    id: '4',
    location: { city: 'Islamabad', area: 'F-7' },
    type: 'apartment',
    price: 180,
    bedrooms: 3,
    bathrooms: 3,
    availability: 'under construction',
    amenities: ['Gym', 'Elevator', 'Backup Generator'],
    description: 'Modern luxury apartment under construction with scenic Margalla views.',
    image: 'https://picsum.photos/seed/apt2/800/600',
    sqft: 1800
  },
  {
    id: '5',
    location: { city: 'Lahore', area: 'DHA Phase 5' },
    type: 'house',
    price: 120,
    bedrooms: 3,
    bathrooms: 3,
    availability: 'ready',
    amenities: ['Parking', 'Terrace', 'Small Garden'],
    description: 'Beautifully maintained 3-bedroom house in a secure gated community.',
    image: 'https://picsum.photos/seed/house2/800/600',
    sqft: 2200
  },
  {
    id: '6',
    location: { city: 'Karachi', area: 'Clifton' },
    type: 'commercial',
    price: 85,
    availability: 'ready',
    amenities: ['Sea View', 'High-speed Internet', 'Reception'],
    description: 'Executive office space with stunning sea views in Clifton.',
    image: 'https://picsum.photos/seed/comm2/800/600',
    sqft: 1200
  },
  {
    id: '7',
    location: { city: 'Karachi', area: 'North Nazimabad' },
    type: 'apartment',
    price: 12,
    bedrooms: 2,
    bathrooms: 2,
    availability: 'ready',
    amenities: ['Gated Community', 'Play Area'],
    description: 'Affordable 2-bedroom apartment in a family-friendly neighborhood.',
    image: 'https://picsum.photos/seed/apt3/800/600',
    sqft: 850
  },
  {
    id: '8',
    location: { city: 'Lahore', area: 'Bahria Town' },
    type: 'house',
    price: 35,
    bedrooms: 5,
    bathrooms: 5,
    availability: 'under construction',
    amenities: ['Park Facing', 'Modern Design'],
    description: 'Spacious 5-bedroom house under construction in Bahria Town.',
    image: 'https://picsum.photos/seed/house3/800/600',
    sqft: 3500
  }
];
