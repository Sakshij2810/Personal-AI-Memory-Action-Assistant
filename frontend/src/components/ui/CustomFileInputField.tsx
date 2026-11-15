import type { ChangeEvent } from "react";

type SingleFileProps = {
  label: string;
  accept?: string;
  multiple?: false;
  onChange: (file: File | null) => void;
};

type MultipleFileProps = {
  label: string;
  accept?: string;
  multiple: true;
  onChange: (files: File[]) => void;
};

type CustomFileInputFieldProps = SingleFileProps | MultipleFileProps;

const CustomFileInputField = (props: CustomFileInputFieldProps) => {
  const { label, accept = "image/*", multiple = false } = props;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (props.multiple === true) {
      props.onChange(files ? Array.from(files) : []);
    } else {
      props.onChange(files?.[0] ?? null);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-black/70 uppercase tracking-wider">
        {label}
      </label>

      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="bg-white border-2 border-black/25 text-[#0A0A0A] text-xs rounded-lg px-2.5 py-2 outline-none focus:border-black/60 transition-colors"
      />
    </div>
  );
};

export default CustomFileInputField;
