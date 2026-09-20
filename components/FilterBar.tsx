import React from 'react';

export interface Filter {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'daterange';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface FilterBarProps {
  filters: Filter[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onClear?: () => void;
  searchPlaceholder?: string;
}

export default function FilterBar({
  filters,
  values,
  onChange,
  onClear,
  searchPlaceholder = 'Buscar...',
}: FilterBarProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filters.map((filter) => (
          <div
            key={filter.key}
            className={`flex flex-col ${filter.type === 'daterange' ? 'lg:col-span-2' : ''}`}
          >
            <label className="text-sm font-medium text-gray-700 mb-1">
              {filter.label}
            </label>
            {filter.type === 'text' && (
              <input
                type="text"
                value={values[filter.key] || ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                placeholder={filter.placeholder || filter.label}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {filter.type === 'select' && (
              <select
                value={values[filter.key] || ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {filter.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            {filter.type === 'date' && (
              <input
                type="date"
                value={values[filter.key] || ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {filter.type === 'daterange' && (
              <div className="flex space-x-2">
                <input
                  type="date"
                  value={values[`${filter.key}_desde`] || ''}
                  onChange={(e) => onChange(`${filter.key}_desde`, e.target.value)}
                  placeholder="Desde"
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0"
                />
                <input
                  type="date"
                  value={values[`${filter.key}_hasta`] || ''}
                  onChange={(e) => onChange(`${filter.key}_hasta`, e.target.value)}
                  placeholder="Hasta"
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-0"
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {onClear && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClear}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
