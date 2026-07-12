import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Zap } from 'lucide-react';
import { useAuthStore, PlanFeatures } from '../store';

interface FeatureGateProps {
  feature: keyof PlanFeatures;
  children: React.ReactNode;
  /** Label shown in the upgrade prompt, e.g. "Analytics" */
  label?: string;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ feature, children, label }) => {
  const features = useAuthStore((state) => state.features);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  // Admins always have full access; if features not loaded yet, show children (loading state)
  if (user?.role === 'admin') return <>{children}</>;
  if (!features) return <>{children}</>;

  const hasAccess = !!features[feature];
  if (hasAccess) return <>{children}</>;

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="w-20 h-20 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
          <Lock className="w-9 h-9 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          {label ? `${label} Locked` : 'Feature Locked'}
        </h2>
        <p className="text-gray-500 mb-6 leading-relaxed">
          {label
            ? `${label} is not included in your current plan. Upgrade to unlock this feature and more.`
            : 'This feature is not included in your current plan. Upgrade to unlock it.'}
        </p>
        <button
          onClick={() => navigate('/subscribe')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-500 hover:to-purple-500 transition-all shadow-lg hover:shadow-blue-500/30"
        >
          <Zap className="w-4 h-4" />
          Upgrade Plan
        </button>
      </div>
    </div>
  );
};

export default FeatureGate;
