import React from 'react';
import { Sparkles, BookOpen, Briefcase, Coffee, Circle, Dumbbell, Target, Star, Zap, ShoppingBag, Flame } from 'lucide-react';

export const getIcon = (name: string, size = 18) => {
  switch (name) {
    case 'Sparkles': return <Sparkles size={size} />;
    case 'BookOpen': return <BookOpen size={size} />;
    case 'Briefcase': return <Briefcase size={size} />;
    case 'Coffee': return <Coffee size={size} />;
    case 'Dumbbell': return <Dumbbell size={size} />;
    case 'Target': return <Target size={size} />;
    case 'Star': return <Star size={size} />;
    case 'Zap': return <Zap size={size} />;
    case 'ShoppingBag': return <ShoppingBag size={size} />;
    case 'Flame': return <Flame size={size} />;
    default: return <Circle size={size} />;
  }
};

export const AVAILABLE_ICONS = [
  'Circle', 'Sparkles', 'BookOpen', 'Briefcase', 
  'Coffee', 'Dumbbell', 'Target', 'Star', 'Zap', 'ShoppingBag', 'Flame'
];
