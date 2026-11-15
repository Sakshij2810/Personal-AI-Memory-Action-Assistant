import type { ChangeEvent, HTMLInputTypeAttribute } from "react";

interface CustomInputFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  type?: HTMLInputTypeAttribute;
}

const CustomInputField = ({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
}: CustomInputFieldProps) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-black/70 uppercase tracking-wider">
        {label}
      </label>

      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className="bg-white border-2 border-black/25 text-[#0A0A0A] text-xs rounded-lg px-2.5 py-2 outline-none focus:border-black/60 transition-colors placeholder-black/30 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      />
    </div>
  );
};

export default CustomInputField;
