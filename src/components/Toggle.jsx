import React from 'react';

const Toggle = ({ checked, onChange, label, icon }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-3">
      {icon && <span className="text-purple-600 text-lg">{icon}</span>}
      <span className="text-sm font-medium text-gray-900">{label}</span>
    </div>
    <button
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
        checked ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export default Toggle;
