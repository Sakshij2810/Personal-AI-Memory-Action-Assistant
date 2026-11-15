import type { ChangeEvent, HTMLInputTypeAttribute } from "react";

interface CustomInputFieldProps {
  label?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  type?: HTMLInputTypeAttribute;
  className?: string;
}

const CustomInputField = ({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
  className = "",
}: CustomInputFieldProps) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="flex w-full flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}

      <input
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full rounded-lg border-2 border-black/25 bg-white px-2.5 py-2 text-xs text-[#0A0A0A] shadow-[0_2px_8px_rgba(0,0,0,0.04)] outline-none transition-colors placeholder:text-gray-400 focus:border-black/60 ${className}`}
      />
    </div>
  );
};

export default CustomInputField;
