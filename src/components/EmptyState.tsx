interface EmptyStateProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  children,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 px-6 py-12 text-center ${className}`}
    >
      <p className="text-pds-base font-medium text-pds-text">{title}</p>
      {description && (
        <p className="max-w-sm text-pds-sm leading-relaxed text-pds-muted">
          {description}
        </p>
      )}
      {children ? (
        <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
