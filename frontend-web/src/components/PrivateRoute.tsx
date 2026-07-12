import React from 'react';
import { useAuthStore } from '../store';
import { Navigate } from 'react-router-dom';

interface PrivateRouteProps {
  children: React.ReactNode;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  return token ? <>{children}</> : <Navigate to="/login" />;
};
