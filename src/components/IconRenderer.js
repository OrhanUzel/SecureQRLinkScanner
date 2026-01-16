import React from 'react';
import { Ionicons, Fontisto, FontAwesome, MaterialCommunityIcons, Entypo, Feather } from '@expo/vector-icons';

export default function IconRenderer({ family, name, size, color }) {
  if (family === 'fontisto') {
    return <Fontisto name={name} size={size} color={color} />;
  }
  if (family === 'fontawesome') {
    return <FontAwesome name={name} size={size} color={color} />;
  }
  if (family === 'mci') {
    return <MaterialCommunityIcons name={name} size={size} color={color} />;
  }
  if (family === 'entypo') {
    return <Entypo name={name} size={size} color={color} />;
  }
  if (family === 'feather') {
    return <Feather name={name} size={size} color={color} />;
  }
  return <Ionicons name={name} size={size} color={color} />;
}

