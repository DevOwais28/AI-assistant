import React from 'react';
import { Property } from '../../types/property';
import { Bed, Bath, MapPin, Home, Building2, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PropertyCardProps {
  property: Property;
  className?: string;
  onClick?: (property: Property) => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property, className, onClick }) => {
  return (
    <div 
      onClick={() => onClick?.(property)}
      className={cn("bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer", className)}
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={property.image} 
          alt={property.description} 
          className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-semibold text-slate-700 shadow-sm">
          {property.type.charAt(0).toUpperCase() + property.type.slice(1)}
        </div>
        <div className="absolute bottom-3 left-3 bg-blue-600 px-3 py-1 rounded-lg text-sm font-bold text-white shadow-lg">
          {property.price} Lakh
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-start gap-2 mb-2">
          <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-slate-900 leading-tight">{property.location.area}</h3>
            <p className="text-xs text-slate-500">{property.location.city}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 py-2 border-y border-slate-50">
          {property.bedrooms && (
            <div className="flex items-center gap-1 text-slate-600">
              <Bed className="w-4 h-4" />
              <span className="text-xs font-medium">{property.bedrooms}</span>
            </div>
          )}
          {property.bathrooms && (
            <div className="flex items-center gap-1 text-slate-600">
              <Bath className="w-4 h-4" />
              <span className="text-xs font-medium">{property.bathrooms}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-slate-600">
            {property.type === 'commercial' ? <Building2 className="w-4 h-4" /> : <Home className="w-4 h-4" />}
            <span className="text-xs font-medium">{property.sqft} sqft</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {property.availability === 'ready' ? (
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-3 h-3" />
              Ready
            </div>
          ) : (
            <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <Clock className="w-3 h-3" />
              Under Construction
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {property.amenities.slice(0, 3).map((amenity, i) => (
            <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
              {amenity}
            </span>
          ))}
          {property.amenities.length > 3 && (
            <span className="text-[10px] text-slate-400 px-1 py-0.5">+{property.amenities.length - 3} more</span>
          )}
        </div>
      </div>
    </div>
  );
};
