function Loader({ label = 'Loading...', className = '', size = 'md' }) {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-10 w-10 border-[3px]',
    lg: 'h-14 w-14 border-4',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`.trim()} role="status" aria-live="polite">
      <div
        className={`${sizeClasses[size] || sizeClasses.md} animate-spin rounded-full border-blue-200 border-t-blue-600`}
        aria-hidden="true"
      />
      {label ? <p className="text-sm font-medium text-slate-500">{label}</p> : null}
    </div>
  );
}

export default Loader;