import React from 'react';
import { Property } from '../../types/property';
import { X, Bed, Bath, MapPin, Home, Building2, CheckCircle2, Clock, Share2, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface PropertyModalProps {
  property: Property | null;
  onClose: () => void;
}

export const PropertyModal: React.FC<PropertyModalProps> = ({ property, onClose }) => {
  if (!property) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        >
          {/* Image Section */}
          <div className="relative w-full md:w-1/2 h-64 md:h-auto">
            <img 
              src={property.image} 
              alt={property.description} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <button 
              onClick={onClose}
              className="absolute top-4 left-4 p-2 bg-white/90 backdrop-blur-sm rounded-full text-slate-800 shadow-lg hover:bg-white transition-colors md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute top-4 right-4 flex gap-2">
              <button className="p-2 bg-white/90 backdrop-blur-sm rounded-full text-slate-800 shadow-lg hover:bg-white transition-colors">
                <Heart className="w-5 h-5" />
              </button>
              <button className="p-2 bg-white/90 backdrop-blur-sm rounded-full text-slate-800 shadow-lg hover:bg-white transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 p-6 md:p-10 overflow-y-auto flex flex-col">
            <div className="hidden md:flex justify-end mb-4">
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                property.availability === 'ready' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              )}>
                {property.availability}
              </span>
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                {property.type}
              </span>
            </div>

            <h2 className="text-3xl font-bold text-slate-900 mb-2 leading-tight">
              {property.location.area}, {property.location.city}
            </h2>
            
            <div className="text-3xl font-black text-blue-600 mb-6">
              {property.price} Lakh
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8 py-6 border-y border-slate-100">
              {property.bedrooms && (
                <div className="flex flex-col items-center gap-1">
                  <Bed className="w-6 h-6 text-slate-400" />
                  <span className="text-sm font-bold text-slate-900">{property.bedrooms}</span>
                  <span className="text-[10px] text-slate-500 uppercase font-medium">Bedrooms</span>
                </div>
              )}
              {property.bathrooms && (
                <div className="flex flex-col items-center gap-1">
                  <Bath className="w-6 h-6 text-slate-400" />
                  <span className="text-sm font-bold text-slate-900">{property.bathrooms}</span>
                  <span className="text-[10px] text-slate-500 uppercase font-medium">Bathrooms</span>
                </div>
              )}
              <div className="flex flex-col items-center gap-1">
                <Home className="w-6 h-6 text-slate-400" />
                <span className="text-sm font-bold text-slate-900">{property.sqft}</span>
                <span className="text-[10px] text-slate-500 uppercase font-medium">Sq Ft</span>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Description</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                {property.description}
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((amenity, i) => (
                  <span key={i} className="bg-slate-50 text-slate-600 px-4 py-2 rounded-xl text-xs font-medium border border-slate-100">
                    {amenity}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-6 flex gap-4">
              <button className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-[0.98]">
                Contact Agent
              </button>
              <button className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-[0.98]">
                Book Visit
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
