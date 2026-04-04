export type PropertyType = 'apartment' | 'house' | 'commercial';
export type Availability = 'ready' | 'under construction';

export interface Property {
  id: string;
  location: {
    city: string;
    area: string;
  };
  type: PropertyType;
  price: number; // in Lakhs
  bedrooms?: number;
  bathrooms?: number;
  availability: Availability;
  amenities: string[];
  description: string;
  image: string;
  sqft?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  properties?: Property[]; // Optional: if the AI found specific properties
}
