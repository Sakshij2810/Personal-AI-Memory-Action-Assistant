import type { ChangeEvent, InputHTMLAttributes, Ref } from "react";

type CommonFileInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "multiple" | "onChange" | "value" | "ref"
> & {
  label?: string;
  inputRef?: Ref<HTMLInputElement>;
  containerClassName?: string;
  inputClassName?: string;
  labelClassName?: string;
};

type SingleFileProps = CommonFileInputProps & {
  multiple?: false;
  onChange: (file: File | null) => void;
};

type MultipleFileProps = CommonFileInputProps & {
  multiple: true;
  onChange: (files: File[]) => void;
};

type CustomFileInputFieldProps = SingleFileProps | MultipleFileProps;

const CustomFileInputField = (props: CustomFileInputFieldProps) => {
  const {
    label,
    accept = "image/*",
    disabled = false,
    inputRef,
    containerClassName = "",
    inputClassName = "",
    labelClassName = "",
    className = "",
    ...inputProps
  } = props;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    // TypeScript can now narrow the callback correctly.
    if (props.multiple === true) {
      props.onChange(files ? Array.from(files) : []);
    } else {
      props.onChange(files?.[0] ?? null);
    }
  };

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      {label && (
        <label
          className={`text-[10px] font-semibold uppercase tracking-wider text-black/70 ${labelClassName}`}
        >
          {label}
        </label>
      )}

      <input
        {...inputProps}
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={props.multiple === true}
        disabled={disabled}
        onChange={handleChange}
        className={`rounded-lg border-2 border-black/25 bg-white px-2.5 py-2 text-xs text-[#0A0A0A] outline-none transition-colors focus:border-black/60 disabled:cursor-not-allowed disabled:opacity-50 ${inputClassName} ${className}`}
      />
    </div>
  );
};

export default CustomFileInputField;
