import React from 'react';
import StuffApp from './StuffApp';
import { AuthProvider } from './AuthContext';

export default function AppRoot() {
  return <AuthProvider><StuffApp /></AuthProvider>;
}
