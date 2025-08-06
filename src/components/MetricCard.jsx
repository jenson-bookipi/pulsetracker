import React from 'react';

const MetricCard = ({ 
  icon, 
  title, 
  value, 
  subValue, 
  change, 
  changeType = 'neutral',
  className = ''
}) => {
  const changeColors = {
    positive: 'text-green-600 bg-green-50',
    negative: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50',
  };

  return (
    <div className={`bg-white rounded-lg p-4 border border-gray-200 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {icon && <div className="p-2 rounded-full bg-opacity-10 bg-gray-500 mr-3">
            {icon}
          </div>}
          <div>
            <h3 className="text-sm font-medium text-gray-500">{title}</h3>
            <p className="text-2xl font-semibold text-gray-900">
              {value}
              {subValue && <span className="text-sm font-normal text-gray-500 ml-1">/ {subValue}</span>}
            </p>
          </div>
        </div>
        {change && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${changeColors[changeType]}`}>
            {change}
          </span>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
