export function PageHeader({
  kicker,
  title,
  description,
  children,
}: {
  kicker?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-line pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          {kicker ? <p className="eyebrow text-accent">{kicker}</p> : null}
          <h1 className="headline mt-1.5 text-4xl sm:text-5xl">{title}</h1>
          {description ? (
            <p className="mt-3 text-base leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </header>
  );
}
