import React from 'react';
import { ToastProvider } from 'react-native-toast-notifications';
import { Router } from 'expo-router';  // or your routing component

export default function App() {
  return (
    <ToastProvider>
      <Router />
    </ToastProvider>
  );
}
