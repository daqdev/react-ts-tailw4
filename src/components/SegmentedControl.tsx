import { useState } from 'react';

interface Option {
    label: string;
    value: string;
}

interface SegmentedControlProps {
    options: Option[];
    onChange: (value: string) => void;
}

export default function SegmentedControl({ options, onChange }: SegmentedControlProps) {
    const [selected, setSelected] = useState<string>(options[0].value);

    const handleChange = (value: string) => {
        setSelected(value);
        onChange(value);
    };

    return (
        <div className="flex border border-gray-300 rounded-lg p-1 bg-gray-100">
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => handleChange(option.value)}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        selected === option.value
                            ? "bg-white text-gray-800 shadow-sm"
                            : "bg-transparent text-gray-500 hover:bg-gray-200"
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}