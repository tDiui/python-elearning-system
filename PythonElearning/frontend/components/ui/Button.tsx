import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', fullWidth, className = '', ...props }, ref) => {
    const baseStyle = "flex items-center justify-center font-medium rounded-xl transition-all text-sm px-4 py-3";
    const variants = {
      primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm",
      outline: "border border-gray-200 hover:bg-gray-50 text-gray-700 bg-white shadow-sm",
      ghost: "hover:bg-gray-100 text-gray-600"
    };

    return (
      <button
        ref={ref}
        className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';